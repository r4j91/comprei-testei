import type { AffiliateCodes } from './affiliate';
import { defaultSealSettings, type SealId, type SealSettings } from './copy';

const PIN_KEY = 'ct.gerar.pinHash';
const CODES_KEY = 'ct.gerar.codes';
const SEALS_KEY = 'ct.gerar.sealCopy';
const SESSION_KEY = 'ct.gerar.unlocked';

export async function hashPin(pin: string): Promise<string> {
	const data = new TextEncoder().encode(`comprei-testei.gerar.v1:${pin.trim()}`);
	const buffer = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function hasPin(): boolean {
	return Boolean(localStorage.getItem(PIN_KEY));
}

export function isUnlocked(): boolean {
	return sessionStorage.getItem(SESSION_KEY) === '1';
}

export async function createPin(pin: string, confirm: string): Promise<string | null> {
	if (pin.trim().length < 4) return 'A senha precisa de pelo menos 4 caracteres.';
	if (pin !== confirm) return 'As duas senhas não são iguais.';
	localStorage.setItem(PIN_KEY, await hashPin(pin));
	sessionStorage.setItem(SESSION_KEY, '1');
	return null;
}

export async function unlock(pin: string): Promise<string | null> {
	const saved = localStorage.getItem(PIN_KEY);
	if (!saved) return 'Ainda não tem senha neste aparelho.';
	if ((await hashPin(pin)) !== saved) return 'Senha incorreta.';
	sessionStorage.setItem(SESSION_KEY, '1');
	return null;
}

export function lock(): void {
	sessionStorage.removeItem(SESSION_KEY);
}

export function wipeDevice(): void {
	localStorage.removeItem(PIN_KEY);
	localStorage.removeItem(CODES_KEY);
	localStorage.removeItem(SEALS_KEY);
	sessionStorage.removeItem(SESSION_KEY);
}

export function loadCodes(): AffiliateCodes {
	try {
		const raw = localStorage.getItem(CODES_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as AffiliateCodes;
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

export function saveCodes(codes: AffiliateCodes): void {
	localStorage.setItem(CODES_KEY, JSON.stringify(codes));
}

export function loadSealSettings(): SealSettings {
	const defaults = defaultSealSettings();
	try {
		const raw = localStorage.getItem(SEALS_KEY);
		if (!raw) return defaults;
		const parsed = JSON.parse(raw) as Partial<Record<SealId, Partial<SealCopy>>>;
		if (!parsed || typeof parsed !== 'object') return defaults;

		const merged = { ...defaults };
		for (const id of Object.keys(defaults) as SealId[]) {
			const saved = parsed[id];
			if (!saved) continue;
			merged[id] = {
				emojiLine: saved.emojiLine?.trim() || defaults[id].emojiLine,
				body: saved.body?.trim() || defaults[id].body,
			};
		}
		return merged;
	} catch {
		return defaults;
	}
}

export function saveSealSettings(settings: SealSettings): void {
	localStorage.setItem(SEALS_KEY, JSON.stringify(settings));
}

export function resetSealSettings(): SealSettings {
	const defaults = defaultSealSettings();
	saveSealSettings(defaults);
	return defaults;
}

type SealCopy = SealSettings[SealId];
