import type { StoreId } from './affiliate';

export const SEALS = [
	{
		id: 'tested',
		label: 'Testado por mim',
		emojiLine: '💖 TESTADO POR MIM ✅',
		body: 'Usei de verdade. Te conto os prós e contras.',
	},
	{
		id: 'offer',
		label: 'Oferta encontrada',
		emojiLine: '💛 OFERTA ENCONTRADA 🔥',
		body: 'Preço bom que encontrei. Ainda não testei.',
	},
	{
		id: 'friends',
		label: 'Aprovado pelas amigas',
		emojiLine: '💚 APROVADO PELAS AMIGAS ⭐',
		body: 'Recomendado pela nossa comunidade.',
	},
] as const;

export type SealId = (typeof SEALS)[number]['id'];

export type SealCopy = {
	emojiLine: string;
	body: string;
};

export type SealSettings = Record<SealId, SealCopy>;

export type ProductDetails = {
	hook?: string;
	name?: string;
	priceFrom?: string;
	priceTo?: string;
};

export const DEFAULT_MESSAGE_HOOK = 'VALE CADA CENTAVO, PODE CONFIAR 💯 ❤️ 🛍️';

export const DEFAULT_DISCLAIMER = '⚠️ Promoção sujeita à alteração de preço e estoque do site';

const STORE_BUY_LABELS: Record<StoreId, string> = {
	amazon: 'Amazon',
	'mercado-livre': 'Mercado Livre',
	shopee: 'Shopee',
	'tiktok-shop': 'TikTok Shop',
};

export function storeBuyLabel(store: StoreId): string {
	return STORE_BUY_LABELS[store];
}

function formatPrice(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) return '';
	if (/^R\$\s*/i.test(trimmed)) return trimmed.replace(/^r\$\s*/i, 'R$ ');
	return `R$ ${trimmed}`;
}

function strikethroughPrice(value: string): string {
	const formatted = formatPrice(value);
	return formatted ? `~${formatted}~` : '';
}

export function defaultSealSettings(): SealSettings {
	return Object.fromEntries(SEALS.map((seal) => [seal.id, { emojiLine: seal.emojiLine, body: seal.body }])) as SealSettings;
}

export function getSeal(id: SealId, settings?: SealSettings): SealCopy {
	const defaults = defaultSealSettings();
	return settings?.[id] ?? defaults[id] ?? defaults.offer;
}

export function buildWhatsAppCopy(
	sealIds: SealId[],
	affiliateUrl: string | null,
	settings?: SealSettings,
	product?: ProductDetails,
	store?: StoreId | null,
): string {
	const ordered = SEALS.map((seal) => seal.id).filter((id) => sealIds.includes(id));
	const lines: string[] = [];

	for (const id of ordered) {
		const seal = getSeal(id, settings);
		if (lines.length > 0) lines.push('');
		lines.push(seal.emojiLine, '', seal.body);
	}

	const hook = product?.hook?.trim() || DEFAULT_MESSAGE_HOOK;
	const hasProductInfo = Boolean(product?.name?.trim() || product?.priceFrom?.trim() || product?.priceTo?.trim());
	const showOfferBlock = Boolean(affiliateUrl || hasProductInfo);

	if (showOfferBlock) {
		if (lines.length > 0) lines.push('');
		lines.push(hook);

		if (product?.name?.trim()) {
			lines.push('', `📦 ${product.name.trim()}`);
		}

		if (product?.priceFrom?.trim()) {
			lines.push('', `💰 De: ${strikethroughPrice(product.priceFrom)}`);
		}

		if (product?.priceTo?.trim()) {
			lines.push('', `🟠 Por apenas: ${formatPrice(product.priceTo)}`);
		}

		if (affiliateUrl) {
			const storeLabel = store ? storeBuyLabel(store) : 'loja';
			lines.push('', `🛒 Compre na ${storeLabel}: ${affiliateUrl}`);
		}

		lines.push('', DEFAULT_DISCLAIMER);
	}

	lines.push('', 'CompreiTestei');
	return lines.join('\n');
}
