import {
	STORES,
	applyAffiliate,
	codeSummary,
	extractCodesFromSample,
	mergeCodes,
	storeHasCode,
	type StoreId,
} from '../lib/affiliate';
import { SEALS, buildWhatsAppCopy, type SealId } from '../lib/copy';
import {
	createPin,
	hasPin,
	isUnlocked,
	loadCodes,
	loadSealSettings,
	resetSealSettings,
	saveCodes,
	saveSealSettings,
	unlock,
	wipeDevice,
} from '../lib/gerar-storage';

type View = 'setup' | 'unlock' | 'app';

function $(id: string): HTMLElement {
	const el = document.getElementById(id);
	if (!el) throw new Error(`Missing #${id}`);
	return el;
}

function input(id: string): HTMLInputElement | HTMLTextAreaElement {
	return $(id) as HTMLInputElement | HTMLTextAreaElement;
}

export function initGerar(): void {
	const selectedSeals = new Set<SealId>(['offer']);
	let copiedTimer = 0;
	const stickyCopy = document.querySelector<HTMLButtonElement>('[data-sticky-copy]');

	const views: Record<View, HTMLElement> = {
		setup: $('view-setup'),
		unlock: $('view-unlock'),
		app: $('view-app'),
	};

	function show(view: View): void {
		for (const [name, el] of Object.entries(views)) {
			el.hidden = name !== view;
		}
		$('sticky-copy').hidden = view !== 'app';
		if (view === 'setup') input('setup-pin').focus();
		if (view === 'unlock') input('unlock-pin').focus();
		if (view === 'app') {
			syncSealFields();
			refreshCodesUi();
			refreshPreview();
			input('product-url').focus();
		}
	}

	function route(): void {
		if (!hasPin()) show('setup');
		else if (!isUnlocked()) show('unlock');
		else show('app');
	}

	function setFieldError(id: string, message: string | null): void {
		const el = $(id);
		el.textContent = message ?? '';
		el.hidden = !message;
	}

	function syncSealFields(): void {
		const settings = loadSealSettings();
		for (const seal of SEALS) {
			const titleField = document.querySelector<HTMLInputElement>(`[data-seal-title="${seal.id}"]`);
			const bodyField = document.querySelector<HTMLTextAreaElement>(`[data-seal-body="${seal.id}"]`);
			if (titleField) titleField.value = settings[seal.id].emojiLine;
			if (bodyField) bodyField.value = settings[seal.id].body;
		}
	}

	function readSealFields(): void {
		const settings = loadSealSettings();
		for (const seal of SEALS) {
			const titleField = document.querySelector<HTMLInputElement>(`[data-seal-title="${seal.id}"]`);
			const bodyField = document.querySelector<HTMLTextAreaElement>(`[data-seal-body="${seal.id}"]`);
			if (titleField) settings[seal.id].emojiLine = titleField.value.trim() || settings[seal.id].emojiLine;
			if (bodyField) settings[seal.id].body = bodyField.value.trim() || settings[seal.id].body;
		}
		saveSealSettings(settings);
		refreshPreview();
	}

	function refreshCodesUi(): void {
		const codes = loadCodes();
		for (const store of STORES) {
			const saved = storeHasCode(store.id, codes);
			const status = $(`status-${store.id}`);
			const summary = codeSummary(store.id, codes);
			status.textContent = saved && summary ? `Salvo: ${summary}` : 'Ainda sem código nesta loja';
			status.classList.toggle('is-saved', saved);
		}
		refreshPreview();
	}

	function refreshPreview(): void {
		const raw = input('product-url').value;
		const result = applyAffiliate(raw, loadCodes());
		const sealIds = [...selectedSeals];
		const settings = loadSealSettings();
		const text = buildWhatsAppCopy(sealIds, result.outputUrl, settings);
		$('preview-text').textContent = text;

		const storeNote = $('store-note');
		if (result.error) {
			storeNote.dataset.tone = 'error';
			storeNote.textContent = result.error;
			storeNote.hidden = false;
		} else if (result.warning) {
			storeNote.dataset.tone = 'warn';
			storeNote.textContent = result.warning;
			storeNote.hidden = false;
		} else if (result.applied && result.store && result.summary) {
			storeNote.dataset.tone = 'ok';
			storeNote.textContent = `Link da ${storeName(result.store)} com ${result.summary}.`;
			storeNote.hidden = false;
		} else if (!raw.trim()) {
			storeNote.hidden = true;
			storeNote.textContent = '';
		} else {
			storeNote.hidden = true;
		}

		const canCopy = Boolean(result.outputUrl) && sealIds.length > 0;
		($('copy-text') as HTMLButtonElement).disabled = !canCopy;
		($('copy-link') as HTMLButtonElement).disabled = !canCopy;
		if (stickyCopy) stickyCopy.disabled = !canCopy;
	}

	function updateSealUi(): void {
		for (const item of SEALS) {
			const btn = document.querySelector<HTMLButtonElement>(`[data-seal="${item.id}"]`);
			if (!btn) continue;
			const active = selectedSeals.has(item.id);
			btn.setAttribute('aria-pressed', active ? 'true' : 'false');
		}
	}

	function toggleSeal(id: SealId): void {
		if (selectedSeals.has(id)) {
			if (selectedSeals.size === 1) return;
			selectedSeals.delete(id);
		} else {
			selectedSeals.add(id);
		}
		updateSealUi();
		refreshPreview();
	}

	async function copyValue(value: string, button: HTMLButtonElement, doneLabel: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(value);
		} catch {
			window.prompt('Copia o texto abaixo:', value);
		}
		const label = button.querySelector<HTMLElement>('.copy-label');
		const original = button.dataset.label ?? label?.textContent ?? '';
		button.dataset.label = original;
		if (label) label.textContent = doneLabel;
		button.classList.add('is-copied');
		window.clearTimeout(copiedTimer);
		copiedTimer = window.setTimeout(() => {
			if (label) label.textContent = button.dataset.label ?? original;
			button.classList.remove('is-copied');
		}, 1800);
		$('copy-live').textContent = doneLabel;
	}

	function currentCopyText(): string {
		const result = applyAffiliate(input('product-url').value, loadCodes());
		return buildWhatsAppCopy([...selectedSeals], result.outputUrl, loadSealSettings());
	}

	$('form-setup').addEventListener('submit', async (event) => {
		event.preventDefault();
		const error = await createPin(input('setup-pin').value, input('setup-pin-confirm').value);
		setFieldError('setup-error', error);
		if (!error) {
			input('setup-pin').value = '';
			input('setup-pin-confirm').value = '';
			show('app');
		}
	});

	$('form-unlock').addEventListener('submit', async (event) => {
		event.preventDefault();
		const error = await unlock(input('unlock-pin').value);
		setFieldError('unlock-error', error);
		if (!error) {
			input('unlock-pin').value = '';
			show('app');
		}
	});

	$('forgot-pin').addEventListener('click', () => {
		$('wipe-confirm').hidden = false;
		$('forgot-pin').hidden = true;
	});

	$('wipe-cancel').addEventListener('click', () => {
		$('wipe-confirm').hidden = true;
		$('forgot-pin').hidden = false;
	});

	$('wipe-confirm-btn').addEventListener('click', () => {
		wipeDevice();
		input('unlock-pin').value = '';
		setFieldError('unlock-error', null);
		$('wipe-confirm').hidden = true;
		$('forgot-pin').hidden = false;
		show('setup');
	});

	$('product-url').addEventListener('input', refreshPreview);
	$('product-url').addEventListener('paste', () => window.setTimeout(refreshPreview, 0));

	document.querySelectorAll<HTMLButtonElement>('[data-seal]').forEach((button) => {
		button.addEventListener('click', () => toggleSeal(button.dataset.seal as SealId));
	});

	document.querySelectorAll<HTMLInputElement>('[data-seal-title]').forEach((field) => {
		field.addEventListener('input', readSealFields);
	});

	document.querySelectorAll<HTMLTextAreaElement>('[data-seal-body]').forEach((field) => {
		field.addEventListener('input', readSealFields);
	});

	$('reset-seal-copy').addEventListener('click', () => {
		if (!window.confirm('Volta os textos dos selos para o padrão?')) return;
		resetSealSettings();
		syncSealFields();
		refreshPreview();
	});

	$('copy-text').addEventListener('click', async () => {
		const result = applyAffiliate(input('product-url').value, loadCodes());
		if (!result.outputUrl || selectedSeals.size === 0) return;
		await copyValue(currentCopyText(), $('copy-text') as HTMLButtonElement, 'Textinho copiado');
	});

	stickyCopy?.addEventListener('click', async () => {
		const result = applyAffiliate(input('product-url').value, loadCodes());
		if (!result.outputUrl || !stickyCopy || selectedSeals.size === 0) return;
		await copyValue(currentCopyText(), stickyCopy, 'Textinho copiado');
	});

	$('copy-link').addEventListener('click', async () => {
		const result = applyAffiliate(input('product-url').value, loadCodes());
		if (!result.outputUrl) return;
		await copyValue(result.outputUrl, $('copy-link') as HTMLButtonElement, 'Link copiado');
	});

	$('settings-toggle').addEventListener('click', () => {
		const panel = $('settings-panel');
		const open = panel.hidden;
		panel.hidden = !open;
		$('settings-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
	});

	document.querySelectorAll<HTMLFormElement>('[data-store-form]').forEach((form) => {
		form.addEventListener('submit', (event) => {
			event.preventDefault();
			const store = form.dataset.storeForm as StoreId;
			const field = form.querySelector('input');
			const errorEl = form.querySelector<HTMLElement>('[data-store-error]');
			if (!field || !errorEl) return;

			const extracted = extractCodesFromSample(field.value);
			if (!extracted.ok) {
				errorEl.hidden = false;
				errorEl.textContent = extracted.error;
				return;
			}

			if (extracted.store !== store) {
				errorEl.hidden = false;
				errorEl.textContent = `Esse link é da ${storeName(extracted.store)}, não da ${storeName(store)}.`;
				return;
			}

			saveCodes(mergeCodes(loadCodes(), extracted.codes));
			errorEl.hidden = true;
			errorEl.textContent = '';
			field.value = '';
			refreshCodesUi();
		});
	});

	$('wipe-app').addEventListener('click', () => {
		if (!window.confirm('Apaga a senha, os códigos e os textos salvos neste aparelho?')) return;
		wipeDevice();
		show('setup');
	});

	updateSealUi();
	route();
	registerServiceWorker();
}

function registerServiceWorker(): void {
	if (!('serviceWorker' in navigator)) return;
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/gerar/sw.js', { scope: '/gerar/' }).catch(() => {
			// PWA opcional: a ferramenta funciona sem instalar.
		});
	});
}

function storeName(store: StoreId): string {
	return STORES.find((item) => item.id === store)?.label ?? store;
}

initGerar();
