export type StoreId = 'amazon' | 'mercado-livre' | 'shopee' | 'tiktok-shop';

export const STORES: { id: StoreId; label: string }[] = [
	{ id: 'amazon', label: 'Amazon' },
	{ id: 'mercado-livre', label: 'Mercado Livre' },
	{ id: 'shopee', label: 'Shopee' },
	{ id: 'tiktok-shop', label: 'TikTok Shop' },
];

export type AffiliateCodes = {
	amazon?: { tag: string };
	'mercado-livre'?: { matt_word?: string; matt_tool?: string; affiliate?: string };
	shopee?: { params: Record<string, string> };
	'tiktok-shop'?: { params: Record<string, string> };
};

export type ExtractResult =
	| { ok: true; store: StoreId; codes: AffiliateCodes; summary: string }
	| { ok: false; store: StoreId | null; error: string };

export type ApplyResult = {
	store: StoreId | null;
	outputUrl: string | null;
	applied: boolean;
	summary: string | null;
	warning: string | null;
	error: string | null;
};

const URL_IN_TEXT = /https?:\/\/[^\s<>"'）)]+/i;
const BARE_URL = /(?:www\.)[^\s<>"'）)]+/i;
const AMAZON_ASIN = /(?:\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/ASIN)\/)([A-Z0-9]{10})/i;

const SHOPEE_PARAMS = ['uls_trackid', 'utm_source', 'utm_medium', 'affiliate_id', 'smtt'] as const;
const TIKTOK_PARAMS = [
	'u_code',
	'source_caller',
	'affiliate_id',
	'affiliate_creator_id',
	'sec_uid',
] as const;

export function extractFirstUrl(text: string): string | null {
	const trimmed = text.trim();
	if (!trimmed) return null;

	const withProtocol = trimmed.match(URL_IN_TEXT);
	if (withProtocol) return stripTrailingPunctuation(withProtocol[0]);

	const bare = trimmed.match(BARE_URL);
	if (bare) return stripTrailingPunctuation(`https://${bare[0]}`);

	return null;
}

function stripTrailingPunctuation(url: string): string {
	return url.replace(/[),.;!?]+$/u, '');
}

export function parseUrl(raw: string): URL | null {
	try {
		return new URL(raw);
	} catch {
		return null;
	}
}

export function detectStore(url: URL): StoreId | null {
	const host = url.hostname.toLowerCase().replace(/^www\./, '');

	if (
		host.includes('amazon.') ||
		host === 'amzn.to' ||
		host === 'a.co' ||
		host.endsWith('amzn.com')
	) {
		return 'amazon';
	}

	if (
		host.includes('mercadolivre') ||
		host.includes('mercadolibre') ||
		host.includes('mercadopago')
	) {
		return 'mercado-livre';
	}

	if (host.includes('shopee.') || host === 'shp.ee' || host.endsWith('shp.ee')) {
		return 'shopee';
	}

	if (host.includes('tiktok')) return 'tiktok-shop';

	return null;
}

export function isOurShortLink(url: URL): boolean {
	const host = url.hostname.toLowerCase().replace(/^www\./, '');
	return host === 'compreitestei.com.br' && url.pathname.startsWith('/r/');
}

export function shouldShortenForWhatsApp(outputUrl: string, store: StoreId | null): boolean {
	if (!store) return false;

	const url = parseUrl(outputUrl);
	if (!url) return false;
	if (isOurShortLink(url)) return false;
	if (isShortLink(url, store)) return false;

	return detectStore(url) === store;
}

export function isShortLink(url: URL, store: StoreId): boolean {
	const host = url.hostname.toLowerCase().replace(/^www\./, '');

	if (store === 'amazon') return host === 'amzn.to' || host === 'a.co';
	if (store === 'shopee') {
		return host === 'shp.ee' || host.startsWith('s.shopee.') || host === 'shope.ee';
	}
	if (store === 'tiktok-shop') {
		return host === 'vt.tiktok.com' || host.startsWith('vm.tiktok.');
	}
	if (store === 'mercado-livre') {
		return host.startsWith('click.mercadolivre') || host.startsWith('click.mercadolibre');
	}

	return false;
}

export function storeHasCode(store: StoreId, codes: AffiliateCodes): boolean {
	if (store === 'amazon') return Boolean(codes.amazon?.tag);
	if (store === 'mercado-livre') {
		const ml = codes['mercado-livre'];
		return Boolean(ml?.matt_word || ml?.matt_tool || ml?.affiliate);
	}
	if (store === 'shopee') return Object.keys(codes.shopee?.params ?? {}).length > 0;
	return Object.keys(codes['tiktok-shop']?.params ?? {}).length > 0;
}

export function codeSummary(store: StoreId, codes: AffiliateCodes): string | null {
	if (store === 'amazon' && codes.amazon?.tag) return `tag ${codes.amazon.tag}`;

	if (store === 'mercado-livre' && codes['mercado-livre']) {
		const ml = codes['mercado-livre'];
		if (ml.matt_word && ml.matt_tool) return `${ml.matt_word} · ferramenta ${ml.matt_tool}`;
		if (ml.affiliate) return `afiliada ${ml.affiliate}`;
		if (ml.matt_word) return ml.matt_word;
	}

	if (store === 'shopee' && codes.shopee?.params.uls_trackid) {
		return `uls_trackid ${codes.shopee.params.uls_trackid}`;
	}

	if (store === 'shopee' && codes.shopee?.params.utm_source) {
		return codes.shopee.params.utm_source;
	}

	if (store === 'tiktok-shop' && codes['tiktok-shop']?.params.u_code) {
		return `u_code ${codes['tiktok-shop'].params.u_code}`;
	}

	return storeHasCode(store, codes) ? 'código salvo' : null;
}

export function extractCodesFromSample(raw: string): ExtractResult {
	const found = extractFirstUrl(raw);
	if (!found) {
		return { ok: false, store: null, error: 'Cola o link completo, começando com https://' };
	}

	const url = parseUrl(found);
	if (!url) {
		return { ok: false, store: null, error: 'Esse link não parece válido.' };
	}

	const store = detectStore(url);
	if (!store) {
		return {
			ok: false,
			store: null,
			error: 'Não reconheci a loja. Use Amazon, Mercado Livre, Shopee ou TikTok Shop.',
		};
	}

	if (isShortLink(url, store)) {
		return {
			ok: false,
			store,
			error: 'Esse é o link curtinho. No painel da loja, copie o link comprido da página do produto.',
		};
	}

	if (store === 'amazon') {
		const tag = url.searchParams.get('tag')?.trim();
		if (!tag) {
			return {
				ok: false,
				store,
				error: 'Não achei o código da Amazon. O link costuma terminar com ?tag=seu-nome-20.',
			};
		}
		const codes: AffiliateCodes = { amazon: { tag } };
		return { ok: true, store, codes, summary: codeSummary(store, codes)! };
	}

	if (store === 'mercado-livre') {
		if (url.pathname.startsWith('/social/')) {
			return {
				ok: false,
				store,
				error: 'Esse é o link do perfil, não o de um produto. Gera o link de um produto no painel de afiliada.',
			};
		}

		const matt_word = url.searchParams.get('matt_word')?.trim() || undefined;
		const matt_tool = url.searchParams.get('matt_tool')?.trim() || undefined;
		const affiliate =
			url.searchParams.get('affiliate')?.trim() || url.searchParams.get('tag')?.trim() || undefined;

		if (!matt_word && !matt_tool && !affiliate) {
			return {
				ok: false,
				store,
				error: 'Não achei o código de afiliada. Cole um link gerado no painel do Mercado Livre.',
			};
		}

		const codes: AffiliateCodes = { 'mercado-livre': { matt_word, matt_tool, affiliate } };
		return { ok: true, store, codes, summary: codeSummary(store, codes)! };
	}

	if (store === 'shopee') {
		const params = pickParams(url, SHOPEE_PARAMS);
		if (Object.keys(params).length === 0) {
			return {
				ok: false,
				store,
				error: 'Não achei o rastreio da Shopee. Cole o link gerado no portal de afiliada (com uls_trackid).',
			};
		}
		const codes: AffiliateCodes = { shopee: { params } };
		return { ok: true, store, codes, summary: codeSummary(store, codes)! };
	}

	const params = pickParams(url, TIKTOK_PARAMS);
	if (Object.keys(params).length === 0) {
		return {
			ok: false,
			store,
			error: 'Não achei o código da TikTok Shop. Cole um link gerado no painel de afiliada.',
		};
	}

	const codes: AffiliateCodes = { 'tiktok-shop': { params } };
	return { ok: true, store, codes, summary: codeSummary(store, codes)! };
}

export function applyAffiliate(raw: string, codes: AffiliateCodes): ApplyResult {
	const found = extractFirstUrl(raw);
	if (!found) {
		return {
			store: null,
			outputUrl: null,
			applied: false,
			summary: null,
			warning: null,
			error: null,
		};
	}

	const url = parseUrl(found);
	if (!url) {
		return {
			store: null,
			outputUrl: null,
			applied: false,
			summary: null,
			warning: null,
			error: 'Esse link não parece válido.',
		};
	}

	const store = detectStore(url);
	if (!store) {
		return {
			store: null,
			outputUrl: url.toString(),
			applied: false,
			summary: null,
			warning: 'Não reconheci a loja. O textinho vai com o link do jeito que você colou.',
			error: null,
		};
	}

	if (isShortLink(url, store)) {
		return {
			store,
			outputUrl: url.toString(),
			applied: false,
			summary: codeSummary(store, codes),
			warning: `Esse é o link curtinho da ${storeLabel(store)}. Abre o produto e cola a URL completa da página.`,
			error: null,
		};
	}

	if (!storeHasCode(store, codes)) {
		return {
			store,
			outputUrl: url.toString(),
			applied: false,
			summary: null,
			warning: `Ainda não tem código da ${storeLabel(store)}. Abre “Meus códigos” em cima e cola um link de afiliada dessa loja.`,
			error: null,
		};
	}

	const rewritten = rewriteUrl(url, store, codes);
	return {
		store,
		outputUrl: rewritten,
		applied: true,
		summary: codeSummary(store, codes),
		warning: null,
		error: null,
	};
}

function storeLabel(store: StoreId): string {
	return STORES.find((item) => item.id === store)?.label ?? store;
}

function pickParams(url: URL, keys: readonly string[]): Record<string, string> {
	const params: Record<string, string> = {};
	for (const key of keys) {
		const value = url.searchParams.get(key)?.trim();
		if (!value) continue;
		if (key === 'utm_source' && !value.startsWith('an_') && !value.toLowerCase().includes('affiliate')) {
			continue;
		}
		params[key] = value;
	}
	return params;
}

function rewriteUrl(url: URL, store: StoreId, codes: AffiliateCodes): string {
	if (store === 'amazon' && codes.amazon?.tag) {
		const asin = url.pathname.match(AMAZON_ASIN)?.[1];
		if (asin) {
			return `https://www.amazon.com.br/dp/${asin.toUpperCase()}?tag=${encodeURIComponent(codes.amazon.tag)}`;
		}
		const next = new URL(url.toString());
		next.searchParams.set('tag', codes.amazon.tag);
		return next.toString();
	}

	if (store === 'mercado-livre' && codes['mercado-livre']) {
		const next = new URL(url.toString());
		const ml = codes['mercado-livre'];
		if (ml.matt_word) next.searchParams.set('matt_word', ml.matt_word);
		if (ml.matt_tool) next.searchParams.set('matt_tool', ml.matt_tool);
		if (ml.affiliate) next.searchParams.set('affiliate', ml.affiliate);
		return next.toString();
	}

	if (store === 'shopee' && codes.shopee) {
		return withParams(url, SHOPEE_PARAMS, codes.shopee.params);
	}

	if (store === 'tiktok-shop' && codes['tiktok-shop']) {
		return withParams(url, TIKTOK_PARAMS, codes['tiktok-shop'].params);
	}

	return url.toString();
}

function withParams(url: URL, keys: readonly string[], values: Record<string, string>): string {
	const next = new URL(url.toString());
	for (const key of keys) next.searchParams.delete(key);
	for (const [key, value] of Object.entries(values)) next.searchParams.set(key, value);
	return next.toString();
}

export function mergeCodes(current: AffiliateCodes, incoming: AffiliateCodes): AffiliateCodes {
	return {
		amazon: incoming.amazon ?? current.amazon,
		'mercado-livre': incoming['mercado-livre'] ?? current['mercado-livre'],
		shopee: incoming.shopee ?? current.shopee,
		'tiktok-shop': incoming['tiktok-shop'] ?? current['tiktok-shop'],
	};
}
