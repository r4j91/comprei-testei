const ALLOWED_HOSTS = [
	'amazon.com.br',
	'amazon.com',
	'amzn.to',
	'a.co',
	'shopee.com.br',
	'shopee.br',
	'shp.ee',
	'mercadolivre.com.br',
	'mercadolibre.com',
	'mercadopago.com.br',
	'tiktok.com',
	'shop.tiktok.com',
];

export function isAllowedAffiliateUrl(raw: string): boolean {
	try {
		const url = new URL(raw);
		if (url.protocol !== 'https:') return false;
		const host = url.hostname.toLowerCase().replace(/^www\./, '');
		return ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
	} catch {
		return false;
	}
}

export function isPinHash(value: string): boolean {
	return /^[a-f0-9]{64}$/i.test(value);
}

export function randomSlug(length = 7): string {
	const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}
