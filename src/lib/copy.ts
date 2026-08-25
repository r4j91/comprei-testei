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
): string {
	const ordered = SEALS.map((seal) => seal.id).filter((id) => sealIds.includes(id));
	const lines: string[] = [];

	for (const id of ordered) {
		const seal = getSeal(id, settings);
		if (lines.length > 0) lines.push('');
		lines.push(seal.emojiLine, '', seal.body);
	}

	if (affiliateUrl) {
		lines.push('', affiliateUrl);
	}

	lines.push('', 'CompreiTestei');
	return lines.join('\n');
}
