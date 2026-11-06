import { isAllowedAffiliateUrl } from './stores';

export type ProductMeta = {
	name?: string;
	priceFrom?: string;
	priceTo?: string;
};

type StoreKind = 'amazon' | 'mercado-livre' | 'shopee' | 'tiktok-shop' | 'unknown';

const FETCH_HEADERS: HeadersInit = {
	'User-Agent':
		'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
	Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
};

function detectStore(url: URL): StoreKind {
	const host = url.hostname.toLowerCase().replace(/^www\./, '');
	if (host.includes('amazon.') || host === 'amzn.to' || host === 'a.co') return 'amazon';
	if (host.includes('mercadolivre') || host.includes('mercadolibre') || host.includes('mercadopago')) {
		return 'mercado-livre';
	}
	if (host.includes('shopee.') || host === 'shp.ee') return 'shopee';
	if (host.includes('tiktok')) return 'tiktok-shop';
	return 'unknown';
}

function decodeHtml(text: string): string {
	return text
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim();
}

function formatBrl(amount: number | string): string | undefined {
	if (typeof amount === 'number') {
		if (!Number.isFinite(amount) || amount <= 0) return undefined;
		return amount.toFixed(2).replace('.', ',');
	}

	const trimmed = amount.trim().replace(/^R\$\s*/i, '');
	if (!trimmed) return undefined;

	if (trimmed.includes(',')) {
		const normalized = trimmed.replace(/\./g, '').replace(',', '.');
		const num = Number.parseFloat(normalized);
		if (!Number.isFinite(num) || num <= 0) return undefined;
		return num.toFixed(2).replace('.', ',');
	}

	const num = Number.parseFloat(trimmed);
	if (!Number.isFinite(num) || num <= 0) return undefined;
	return num.toFixed(2).replace('.', ',');
}

function parseBrlText(text: string): string | undefined {
	const match = text.match(/([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2}|[0-9]+\.[0-9]{2})/);
	if (!match) return undefined;
	return formatBrl(match[1]);
}

function metaContent(html: string, key: string): string | null {
	const patterns = [
		new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
		new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, 'i'),
	];
	for (const pattern of patterns) {
		const match = html.match(pattern);
		if (match?.[1]) return decodeHtml(match[1]);
	}
	return null;
}

function cleanStoreTitle(title: string, store: StoreKind): string {
	let name = title.trim();
	if (store === 'amazon') {
		name = name.replace(/^Amazon\.(?:com\.br|com)\s*:\s*/i, '');
	}
	if (store === 'mercado-livre') {
		name = name.replace(/\s*\|\s*Mercado\s*Livre.*$/i, '');
	}
	if (store === 'shopee') {
		name = name.replace(/\s*\|\s*Shopee.*$/i, '');
	}
	return name.trim();
}

function findProducts(node: unknown): Record<string, unknown>[] {
	if (!node) return [];
	if (Array.isArray(node)) return node.flatMap(findProducts);
	if (typeof node !== 'object') return [];

	const obj = node as Record<string, unknown>;
	const type = obj['@type'];
	const types = Array.isArray(type) ? type : type ? [type] : [];
	if (types.includes('Product')) return [obj];

	return Object.values(obj).flatMap(findProducts);
}

function offerPrices(offers: unknown): { priceTo?: string; priceFrom?: string } {
	if (!offers) return {};
	const list = Array.isArray(offers) ? offers : [offers];
	let priceTo: string | undefined;
	let priceFrom: string | undefined;

	for (const offer of list) {
		if (!offer || typeof offer !== 'object') continue;
		const o = offer as Record<string, unknown>;
		if (typeof o.price === 'string' || typeof o.price === 'number') {
			priceTo = formatBrl(o.price);
		}
		if (typeof o.lowPrice === 'string' || typeof o.lowPrice === 'number') {
			priceTo = formatBrl(o.lowPrice);
		}
		if (typeof o.highPrice === 'string' || typeof o.highPrice === 'number') {
			priceFrom = formatBrl(o.highPrice);
		}
	}

	return { priceTo, priceFrom };
}

function extractJsonLd(html: string): ProductMeta | null {
	const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
	for (const match of scripts) {
		try {
			const data = JSON.parse(match[1]) as unknown;
			for (const product of findProducts(data)) {
				const name = typeof product.name === 'string' ? decodeHtml(product.name) : undefined;
				const prices = offerPrices(product.offers);
				if (name || prices.priceTo) {
					return { name, priceFrom: prices.priceFrom, priceTo: prices.priceTo };
				}
			}
		} catch {
			// tenta o próximo bloco JSON-LD
		}
	}
	return null;
}

function amazonDisplayPrice(text: string): string | undefined {
	const parts = text.match(/"wholeValue"\s*:\s*"(\d+)"[\s\S]{0,200}?"fractionalValue"\s*:\s*"(\d{1,2})"/);
	if (!parts) return undefined;
	return `${parts[1]},${parts[2].padStart(2, '0')}`;
}

function extractAmazon(html: string): ProductMeta {
	const meta: ProductMeta = {};

	const titleMatch = html.match(/id=["']productTitle["'][^>]*>\s*([\s\S]*?)<\/span>/i);
	if (titleMatch?.[1]) meta.name = decodeHtml(titleMatch[1].replace(/<[^>]+>/g, ''));

	meta.priceTo = amazonDisplayPrice(html);

	const priceAmount = html.match(/"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]{1,2})?)/);
	if (!meta.priceTo && priceAmount?.[1]) meta.priceTo = formatBrl(priceAmount[1]);

	const basis =
		html.match(/apex-basisprice-value[\s\S]{0,220}?a-offscreen">\s*R\$\s*([0-9.,]+)/i) ??
		html.match(/a-text-strike">\s*R\$\s*([0-9.,]+)/i) ??
		html.match(/Preço sugerido:[\s\S]{0,80}?R\$\s*([0-9.,]+)/i);
	if (basis?.[1]) meta.priceFrom = parseBrlText(basis[1]);

	if (!meta.name) {
		const og = metaContent(html, 'og:title');
		if (og) meta.name = cleanStoreTitle(og, 'amazon');
	}

	return meta;
}

function extractMercadoLivre(html: string): ProductMeta {
	const meta: ProductMeta = {};

	const pair =
		html.match(/"original_price"\s*:\s*([0-9.]+)[\s\S]{0,400}?"price"\s*:\s*([0-9.]+)/) ??
		html.match(/"price"\s*:\s*([0-9.]+)[\s\S]{0,400}?"original_price"\s*:\s*([0-9.]+)/);

	if (pair) {
		const first = Number.parseFloat(pair[1]);
		const second = Number.parseFloat(pair[2]);
		if (pair[0].indexOf('"original_price"') < pair[0].indexOf('"price"')) {
			meta.priceFrom = formatBrl(first);
			meta.priceTo = formatBrl(second);
		} else {
			meta.priceFrom = formatBrl(second);
			meta.priceTo = formatBrl(first);
		}
	} else {
		const priceOnly = html.match(/"price"\s*:\s*([0-9.]+)/);
		if (priceOnly?.[1]) meta.priceTo = formatBrl(priceOnly[1]);
	}

	const title =
		html.match(/"item_name"\s*:\s*"([^"]+)"/)?.[1] ??
		html.match(/"title"\s*:\s*"([^"]{8,200})"/)?.[1] ??
		metaContent(html, 'og:title');

	if (title) meta.name = cleanStoreTitle(decodeHtml(title), 'mercado-livre');

	return meta;
}

function extractShopee(html: string): ProductMeta {
	const meta: ProductMeta = {};

	const name =
		html.match(/"item_name"\s*:\s*"([^"]+)"/)?.[1] ??
		html.match(/"name"\s*:\s*"([^"]{8,200})"/)?.[1] ??
		metaContent(html, 'og:title');
	if (name) meta.name = cleanStoreTitle(decodeHtml(name), 'shopee');

	const priceRaw =
		html.match(/"price"\s*:\s*([0-9]{4,9})/)?.[1] ??
		html.match(/"price_min"\s*:\s*([0-9]{4,9})/)?.[1];
	if (priceRaw) {
		const cents = Number.parseInt(priceRaw, 10);
		if (Number.isFinite(cents)) meta.priceTo = formatBrl(cents >= 1000 ? cents / 100_000 : cents / 100);
	}

	const before = html.match(/"price_before_discount"\s*:\s*([0-9]{4,9})/)?.[1];
	if (before) {
		const cents = Number.parseInt(before, 10);
		if (Number.isFinite(cents)) meta.priceFrom = formatBrl(cents >= 1000 ? cents / 100_000 : cents / 100);
	}

	return meta;
}

function extractTikTok(html: string): ProductMeta {
	const meta: ProductMeta = {};

	const name =
		html.match(/"title"\s*:\s*"([^"]{8,200})"/)?.[1] ??
		html.match(/"product_name"\s*:\s*"([^"]+)"/)?.[1] ??
		metaContent(html, 'og:title');
	if (name) meta.name = cleanStoreTitle(decodeHtml(name), 'tiktok-shop');

	const sale =
		html.match(/"sale_price"\s*:\s*"([0-9.]+)"/)?.[1] ??
		html.match(/"sale_price_decimal"\s*:\s*"([0-9.]+)"/)?.[1] ??
		html.match(/"price"\s*:\s*"([0-9.]+)"/)?.[1];
	if (sale) meta.priceTo = formatBrl(sale);

	const original = html.match(/"original_price"\s*:\s*"([0-9.]+)"/)?.[1];
	if (original) meta.priceFrom = formatBrl(original);

	return meta;
}

function mergeMeta(...items: ProductMeta[]): ProductMeta {
	const merged: ProductMeta = {};
	for (const item of items) {
		if (!merged.name && item.name) merged.name = item.name;
		if (!merged.priceFrom && item.priceFrom) merged.priceFrom = item.priceFrom;
		if (!merged.priceTo && item.priceTo) merged.priceTo = item.priceTo;
	}
	return merged;
}

function extractByStore(html: string, store: StoreKind): ProductMeta {
	switch (store) {
		case 'amazon':
			return extractAmazon(html);
		case 'mercado-livre':
			return extractMercadoLivre(html);
		case 'shopee':
			return extractShopee(html);
		case 'tiktok-shop':
			return extractTikTok(html);
		default:
			return {};
	}
}

export async function fetchProductMeta(rawUrl: string): Promise<ProductMeta | null> {
	if (!isAllowedAffiliateUrl(rawUrl)) return null;

	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch {
		return null;
	}

	const store = detectStore(parsed);

	const mlItemId = extractMercadoLivreItemId(parsed);
	if (mlItemId) {
		const apiMeta = await fetchMercadoLivreApi(mlItemId);
		if (apiMeta?.name || apiMeta?.priceTo) return apiMeta;
	}

	let meta = await fetchDirectMeta(parsed.toString(), store);

	const jina = await fetchViaJina(parsed.toString());
	if (jina) {
		meta = mergeMeta(meta ?? {}, extractFromJinaMarkdown(jina, store), extractJsonLd(jina), extractByStore(jina, store));
	}

	if (!meta?.name && !meta?.priceTo && !meta?.priceFrom) return null;
	return meta;
}

function extractMercadoLivreItemId(url: URL): string | null {
	const match =
		url.pathname.match(/\/(MLB-?[0-9]+)/i) ??
		url.pathname.match(/(MLB[0-9]{6,})/i) ??
		url.href.match(/(MLB-?[0-9]{6,})/i);
	if (!match?.[1]) return null;
	return match[1].replace('-', '').toUpperCase();
}

async function fetchMercadoLivreApi(itemId: string): Promise<ProductMeta | null> {
	try {
		const response = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
			headers: { Accept: 'application/json', ...FETCH_HEADERS },
			signal: AbortSignal.timeout(8000),
		});
		if (!response.ok) return null;
		const data = (await response.json()) as { title?: string; price?: number; original_price?: number | null };
		if (!data.title && !data.price) return null;
		return {
			name: data.title?.trim(),
			priceTo: data.price ? formatBrl(data.price) : undefined,
			priceFrom: data.original_price ? formatBrl(data.original_price) : undefined,
		};
	} catch {
		return null;
	}
}

async function fetchDirectMeta(url: string, store: StoreKind): Promise<ProductMeta | null> {
	try {
		const response = await fetch(url, {
			headers: FETCH_HEADERS,
			redirect: 'follow',
			signal: AbortSignal.timeout(10_000),
		});
		if (!response.ok) return null;

		const html = await response.text();
		if (!html || html.length < 500) return null;

		const finalStore = detectStore(new URL(response.url));
		const meta = mergeMeta(extractJsonLd(html), extractByStore(html, finalStore === 'unknown' ? store : finalStore));
		if (!meta.name && !meta.priceTo && !meta.priceFrom) return null;
		return meta;
	} catch {
		return null;
	}
}

async function fetchViaJina(url: string): Promise<string | null> {
	try {
		const response = await fetch(`https://r.jina.ai/${url}`, {
			headers: { Accept: 'text/plain' },
			redirect: 'follow',
			signal: AbortSignal.timeout(20_000),
		});
		if (!response.ok) return null;
		const text = await response.text();
		return text.length > 200 ? text : null;
	} catch {
		return null;
	}
}

function extractFromJinaMarkdown(text: string, store: StoreKind): ProductMeta {
	const meta: ProductMeta = {};
	const titleLine = text.match(/^Title:\s*(.+)$/m)?.[1];

	if (titleLine) {
		let name = titleLine.trim();
		if (store === 'amazon') name = name.replace(/\s*:\s*Amazon\.(?:com\.br|com).*/i, '');
		if (store === 'mercado-livre') name = name.replace(/\s*\|\s*Mercado\s*Livre.*$/i, '');
		if (store === 'shopee') name = name.replace(/\s*\|\s*Shopee.*$/i, '');
		meta.name = cleanStoreTitle(name, store);
	}

	meta.priceTo = amazonDisplayPrice(text);

	const priceAmount = text.match(/"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]{1,2})?)/);
	if (!meta.priceTo && priceAmount?.[1]) meta.priceTo = formatBrl(priceAmount[1]);

	const mlPair =
		text.match(/"original_price"\s*:\s*([0-9.]+)[\s\S]{0,400}?"price"\s*:\s*([0-9.]+)/) ??
		text.match(/"price"\s*:\s*([0-9.]+)[\s\S]{0,400}?"original_price"\s*:\s*([0-9.]+)/);
	if (mlPair) {
		const first = Number.parseFloat(mlPair[1]);
		const second = Number.parseFloat(mlPair[2]);
		if (mlPair[0].indexOf('"original_price"') < mlPair[0].indexOf('"price"')) {
			meta.priceFrom = formatBrl(first);
			meta.priceTo = formatBrl(second);
		} else {
			meta.priceFrom = formatBrl(second);
			meta.priceTo = formatBrl(first);
		}
	}

	const dePrice =
		text.match(/De:\s*R\$?\s*([0-9][0-9.,]*)/i) ??
		text.match(/Preço sugerido:\s*R\$?\s*([0-9][0-9.,]*)/i);
	if (dePrice?.[1]) meta.priceFrom = parseBrlText(dePrice[1]);

	if (!meta.priceTo) {
		const display = text.match(/"displayPrice"\s*:\s*"R\$([0-9.,]+)"/) ?? text.match(/\bR\$([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\b/);
		if (display?.[1]) meta.priceTo = parseBrlText(display[1]);
	}

	return meta;
}
