/** Normaliza valor para exibição brasileira: 22,54 */
export function formatBrlPrice(amount: number | string): string | undefined {
	if (typeof amount === 'number') {
		if (!Number.isFinite(amount) || amount <= 0) return undefined;
		return amount.toFixed(2).replace('.', ',');
	}

	const trimmed = amount.trim().replace(/^R\$\s*/i, '');
	if (!trimmed) return undefined;

	// Formato BR: 1.234,56 ou 22,54
	if (trimmed.includes(',')) {
		const normalized = trimmed.replace(/\./g, '').replace(',', '.');
		const num = Number.parseFloat(normalized);
		if (!Number.isFinite(num) || num <= 0) return undefined;
		return num.toFixed(2).replace('.', ',');
	}

	// Formato JSON / US: 22.54 (ponto = decimal)
	const num = Number.parseFloat(trimmed);
	if (!Number.isFinite(num) || num <= 0) return undefined;
	return num.toFixed(2).replace('.', ',');
}

export function parseBrlPriceText(text: string): string | undefined {
	const match = text.match(/([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2}|[0-9]+\.[0-9]{2})/);
	if (!match) return undefined;
	return formatBrlPrice(match[1]);
}
