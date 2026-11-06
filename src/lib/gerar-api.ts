import type { AffiliateCodes, StoreId } from './affiliate';
import { shouldShortenForWhatsApp } from './affiliate';
import type { ProductMeta } from './product-info';
import { fetchProductInfo } from './product-info';
import type { SealSettings } from './copy';
import { getPinHash, loadCodes, loadSealSettings, saveCodes, saveSealSettings } from './gerar-storage';

const UPDATED_AT_KEY = 'ct.gerar.updatedAt';
const shortenCache = new Map<string, string>();

export type CloudSettings = {
	codes: AffiliateCodes;
	seals: SealSettings;
	updatedAt: number;
};

function localUpdatedAt(): number {
	return Number(localStorage.getItem(UPDATED_AT_KEY) ?? 0);
}

function touchLocalUpdatedAt(): number {
	const value = Date.now();
	localStorage.setItem(UPDATED_AT_KEY, String(value));
	return value;
}

export async function shortenUrl(fullUrl: string): Promise<string | null> {
	const cached = shortenCache.get(fullUrl);
	if (cached) return cached;

	const endpoint = new URL('/api/shorten', window.location.origin).href;

	for (let attempt = 0; attempt < 2; attempt += 1) {
		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: fullUrl }),
			});
			if (!response.ok) continue;
			const data = (await response.json()) as { shortUrl?: string };
			if (!data.shortUrl) continue;
			shortenCache.set(fullUrl, data.shortUrl);
			return data.shortUrl;
		} catch {
			// tenta de novo
		}
	}

	return null;
}

export async function resolveDisplayUrl(
	outputUrl: string | null,
	store: StoreId | null,
): Promise<{ url: string | null; shortened: boolean }> {
	if (!outputUrl) return { url: null, shortened: false };
	if (!shouldShortenForWhatsApp(outputUrl, store)) return { url: outputUrl, shortened: false };

	const shortUrl = await shortenUrl(outputUrl);
	return { url: shortUrl ?? outputUrl, shortened: Boolean(shortUrl) };
}

export type { ProductMeta } from './product-info';
export { fetchProductInfo } from './product-info';

function hasLocalSettings(): boolean {
	return Object.keys(loadCodes()).length > 0;
}

export async function pullCloudSettings(): Promise<'synced' | 'empty' | 'skipped' | 'uploaded' | 'failed'> {
	const pinHash = getPinHash();
	if (!pinHash) return 'skipped';

	try {
		const response = await fetch(`/api/settings?pinHash=${encodeURIComponent(pinHash)}`);
		if (response.status === 204) {
			if (hasLocalSettings()) {
				const ok = await pushCloudSettings();
				return ok ? 'uploaded' : 'empty';
			}
			return 'empty';
		}
		if (!response.ok) return response.status >= 500 ? 'failed' : 'skipped';

		const remote = (await response.json()) as CloudSettings;
		const localTime = localUpdatedAt();

		if (!remote.updatedAt || remote.updatedAt >= localTime) {
			saveCodes(remote.codes ?? {});
			saveSealSettings(remote.seals ?? loadSealSettings());
			localStorage.setItem(UPDATED_AT_KEY, String(remote.updatedAt ?? Date.now()));
			return 'synced';
		}

		await pushCloudSettings();
		return 'synced';
	} catch {
		return 'skipped';
	}
}

export async function pushCloudSettings(): Promise<boolean> {
	const pinHash = getPinHash();
	if (!pinHash) return false;

	const payload: CloudSettings = {
		codes: loadCodes(),
		seals: loadSealSettings(),
		updatedAt: touchLocalUpdatedAt(),
	};

	try {
		const response = await fetch('/api/settings', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ pinHash, ...payload }),
		});
		return response.ok;
	} catch {
		return false;
	}
}

let pushTimer = 0;

export function scheduleCloudPush(): void {
	window.clearTimeout(pushTimer);
	pushTimer = window.setTimeout(() => {
		void pushCloudSettings();
	}, 700);
}

export function markSettingsDirty(): void {
	touchLocalUpdatedAt();
	scheduleCloudPush();
}
