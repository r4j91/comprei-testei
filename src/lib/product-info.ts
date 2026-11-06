import { detectStore, parseUrl } from './affiliate';
import type { StoreId } from './affiliate';
import { formatBrlPrice, parseBrlPriceText } from './price-brl';

export type ProductMeta = {
	name?: string;
	priceFrom?: string;
	priceTo?: string;
};

function cleanTitle(title: string, store: StoreId | null): string {
	let name = title.trim();
	if (store === 'amazon') name = name.replace(/\s*:\s*Amazon\.(?:com\.br|com).*/i, '');
	if (store === 'mercado-livre') name = name.replace(/\s*\|\s*Mercado\s*Livre.*$/i, '');
	if (store === 'shopee') name = name.replace(/\s*\|\s*Shopee.*$/i, '');
	return name.trim();
}

export function parseProductMarkdown(text: string, store: StoreId | null): ProductMeta {
	const meta: ProductMeta = {};
	const titleLine = text.match(/^Title:\s*(.+)$/m)?.[1];

	if (titleLine) meta.name = cleanTitle(titleLine, store);

	const amazonParts = text.match(
		/"wholeValue"\s*:\s*"(\d+)"[\s\S]{0,200}?"fractionalValue"\s*:\s*"(\d{1,2})"/,
	);
	if (amazonParts) {
		meta.priceTo = `${amazonParts[1]},${amazonParts[2].padStart(2, '0')}`;
	}

	const priceAmount = text.match(/"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]{1,2})?)/);
	if (!meta.priceTo && priceAmount?.[1]) meta.priceTo = formatBrlPrice(priceAmount[1]);

	const mlPair =
		text.match(/"original_price"\s*:\s*([0-9.]+)[\s\S]{0,400}?"price"\s*:\s*([0-9.]+)/) ??
		text.match(/"price"\s*:\s*([0-9.]+)[\s\S]{0,400}?"original_price"\s*:\s*([0-9.]+)/);
	if (mlPair) {
		const first = Number.parseFloat(mlPair[1]);
		const second = Number.parseFloat(mlPair[2]);
		if (mlPair[0].indexOf('"original_price"') < mlPair[0].indexOf('"price"')) {
			meta.priceFrom = formatBrlPrice(first);
			meta.priceTo = formatBrlPrice(second);
		} else {
			meta.priceFrom = formatBrlPrice(second);
			meta.priceTo = formatBrlPrice(first);
		}
	}

	const dePrice =
		text.match(/De:\s*R\$?\s*([0-9][0-9.,]*)/i) ??
		text.match(/Preço sugerido:\s*R\$?\s*([0-9][0-9.,]*)/i);
	if (dePrice?.[1]) meta.priceFrom = parseBrlPriceText(dePrice[1]);

	if (!meta.priceTo) {
		const display =
			text.match(/"displayPrice"\s*:\s*"R\$([0-9.,]+)"/) ??
			text.match(/\bR\$([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})\b/);
		if (display?.[1]) meta.priceTo = parseBrlPriceText(display[1]);
	}

	return meta;
}

async function fetchViaJina(url: string): Promise<ProductMeta | null> {
	const response = await fetch(`https://r.jina.ai/${url}`, {
		headers: { Accept: 'text/plain' },
		signal: AbortSignal.timeout(25_000),
	});
	if (!response.ok) return null;

	const text = await response.text();
	if (text.length < 200) return null;

	const store = detectStore(parseUrl(url) ?? new URL(url));
	const meta = parseProductMarkdown(text, store);
	if (!meta.name && !meta.priceTo && !meta.priceFrom) return null;
	return meta;
}

async function fetchViaServer(url: string): Promise<ProductMeta | null> {
	const response = await fetch(new URL('/api/product-info', window.location.origin).href, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url }),
		signal: AbortSignal.timeout(25_000),
	});
	if (!response.ok) return null;
	return (await response.json()) as ProductMeta;
}

export async function fetchProductInfo(rawUrl: string): Promise<ProductMeta | null> {
	const server = await fetchViaServer(rawUrl);
	if (server && (server.name || server.priceTo || server.priceFrom)) return server;

	try {
		return await fetchViaJina(rawUrl);
	} catch {
		return null;
	}
}
