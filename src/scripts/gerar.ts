import {
	STORES,
	applyAffiliate,
	codeSummary,
	extractCodesFromSample,
	extractFirstUrl,
	mergeCodes,
	shouldShortenForWhatsApp as shouldShorten,
	storeHasCode,
	type StoreId,
} from '../lib/affiliate';
import { SEALS, buildWhatsAppCopy, DEFAULT_MESSAGE_HOOK, type ProductDetails, type SealId } from '../lib/copy';
import {
	fetchProductInfo,
	markSettingsDirty,
	pullCloudSettings,
	pushCloudSettings,
	resolveDisplayUrl,
} from '../lib/gerar-api';
import {
	createPin,
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
	let previewRequest = 0;
	let productInfoTimer = 0;
	let productInfoRequest = 0;
	let lastFetchedUrl = '';
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
	}

	async function openApp(): Promise<void> {
		show('app');
		const sync = await pullCloudSettings();
		setSyncNote(sync);
		syncSealFields();
		refreshCodesUi();
		await refreshPreview();
		input('product-url').focus();
	}

	function setSyncNote(state: 'synced' | 'empty' | 'skipped' | 'saved' | 'uploaded' | 'failed'): void {
		const note = $('sync-note');
		if (state === 'synced') {
			note.dataset.tone = 'ok';
			note.textContent = 'Configurações sincronizadas. Mesma senha = mesmos códigos no celular e no computador.';
			note.hidden = false;
		} else if (state === 'uploaded') {
			note.dataset.tone = 'ok';
			note.textContent = 'Seus códigos deste aparelho foram enviados para a nuvem. Agora sincronizam em todo lugar.';
			note.hidden = false;
		} else if (state === 'saved') {
			note.dataset.tone = 'ok';
			note.textContent = 'Salvo e sincronizado na nuvem.';
			note.hidden = false;
		} else if (state === 'failed') {
			note.dataset.tone = 'error';
			note.textContent = 'Não deu para sincronizar agora. Feche e abra o app de novo em alguns segundos.';
			note.hidden = false;
		} else if (state === 'empty') {
			note.dataset.tone = 'warn';
			note.textContent = 'Nenhum código na nuvem ainda. Abra no computador com a mesma senha ou configure aqui.';
			note.hidden = false;
		} else {
			note.hidden = true;
		}
	}

	function route(): void {
		if (!isUnlocked()) show('unlock');
		else void openApp();
	}

	function setFieldError(id: string, message: string | null): void {
		const el = $(id);
		el.textContent = message ?? '';
		el.hidden = !message;
	}

	function readProductDetails(): ProductDetails {
		return {
			hook: input('message-hook').value,
			name: input('product-name').value,
			priceFrom: input('price-from').value,
			priceTo: input('price-sale').value,
		};
	}

	function setProductInfoStatus(message: string | null, tone: 'ok' | 'warn' = 'ok'): void {
		const note = $('product-info-note');
		if (!message) {
			note.hidden = true;
			note.textContent = '';
			return;
		}
		note.dataset.tone = tone;
		note.textContent = message;
		note.hidden = false;
	}

	async function autoFillProductInfo(raw: string): Promise<void> {
		const url = extractFirstUrl(raw);
		if (!url) {
			lastFetchedUrl = '';
			setProductInfoStatus(null);
			return;
		}
		if (url === lastFetchedUrl) return;

		const requestId = ++productInfoRequest;
		setProductInfoStatus('Buscando nome e preço… pode levar alguns segundos.');

		const meta = await fetchProductInfo(url);
		if (requestId !== productInfoRequest) return;

		if (!meta) {
			setProductInfoStatus('Não deu para buscar automaticamente. Preencha na mão.', 'warn');
			return;
		}

		lastFetchedUrl = url;
		if (meta.name) input('product-name').value = meta.name;
		if (meta.priceFrom) input('price-from').value = meta.priceFrom;
		if (meta.priceTo) input('price-sale').value = meta.priceTo;

		const parts = [meta.name ? 'nome' : null, meta.priceTo ? 'preço' : null].filter(Boolean);
		setProductInfoStatus(`Preenchemos ${parts.join(' e ')} automaticamente.`);
		window.setTimeout(() => {
			if (productInfoRequest === requestId) setProductInfoStatus(null);
		}, 2800);
		void refreshPreview();
	}

	function scheduleProductInfo(raw: string): void {
		window.clearTimeout(productInfoTimer);
		productInfoTimer = window.setTimeout(() => {
			void autoFillProductInfo(raw);
		}, 900);
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
		markSettingsDirty();
		void refreshPreview();
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

	async function refreshPreview(): Promise<void> {
		const requestId = ++previewRequest;
		const raw = input('product-url').value;
		const result = applyAffiliate(raw, loadCodes());
		const sealIds = [...selectedSeals];
		const settings = loadSealSettings();
		const product = readProductDetails();

		let displayUrl = result.outputUrl;
		let shortenFailed = false;
		if (result.outputUrl) {
			if (requestId === previewRequest) {
				$('preview-text').textContent = buildWhatsAppCopy(sealIds, '…', settings, product, result.store);
			}
			const resolved = await resolveDisplayUrl(result.outputUrl, result.store);
			displayUrl = resolved.url;
			shortenFailed = !resolved.shortened && shouldShorten(result.outputUrl, result.store);
		}
		if (requestId !== previewRequest) return;

		$('preview-text').textContent = buildWhatsAppCopy(sealIds, displayUrl, settings, product, result.store);

		const storeNote = $('store-note');
		if (result.error) {
			storeNote.dataset.tone = 'error';
			storeNote.textContent = result.error;
			storeNote.hidden = false;
		} else if (shortenFailed) {
			storeNote.dataset.tone = 'warn';
			storeNote.textContent = 'Não deu para encurtar o link agora. Atualize a página e tente de novo.';
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
		void refreshPreview();
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

	async function currentCopyText(): Promise<string> {
		const result = applyAffiliate(input('product-url').value, loadCodes());
		const { url } = await resolveDisplayUrl(result.outputUrl, result.store);
		return buildWhatsAppCopy([...selectedSeals], url, loadSealSettings(), readProductDetails(), result.store);
	}

	$('form-setup').addEventListener('submit', async (event) => {
		event.preventDefault();
		const error = await createPin(input('setup-pin').value, input('setup-pin-confirm').value);
		setFieldError('setup-error', error);
		if (!error) {
			input('setup-pin').value = '';
			input('setup-pin-confirm').value = '';
			await pushCloudSettings();
			await openApp();
		}
	});

	$('form-unlock').addEventListener('submit', async (event) => {
		event.preventDefault();
		const error = await unlock(input('unlock-pin').value);
		setFieldError('unlock-error', error);
		if (!error) {
			input('unlock-pin').value = '';
			await openApp();
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
		show('unlock');
	});

	$('product-url').addEventListener('input', () => {
		const raw = input('product-url').value;
		void refreshPreview();
		scheduleProductInfo(raw);
	});
	$('product-url').addEventListener('paste', () => {
		window.setTimeout(() => {
			const raw = input('product-url').value;
			void refreshPreview();
			scheduleProductInfo(raw);
		}, 0);
	});

	for (const id of ['message-hook', 'product-name', 'price-from', 'price-sale']) {
		input(id).addEventListener('input', refreshPreview);
	}

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
		markSettingsDirty();
		syncSealFields();
		void refreshPreview();
	});

	$('copy-text').addEventListener('click', async () => {
		const result = applyAffiliate(input('product-url').value, loadCodes());
		if (!result.outputUrl || selectedSeals.size === 0) return;
		await copyValue(await currentCopyText(), $('copy-text') as HTMLButtonElement, 'Textinho copiado');
	});

	stickyCopy?.addEventListener('click', async () => {
		const result = applyAffiliate(input('product-url').value, loadCodes());
		if (!result.outputUrl || !stickyCopy || selectedSeals.size === 0) return;
		await copyValue(await currentCopyText(), stickyCopy, 'Textinho copiado');
	});

	$('copy-link').addEventListener('click', async () => {
		const result = applyAffiliate(input('product-url').value, loadCodes());
		if (!result.outputUrl) return;
		const { url } = await resolveDisplayUrl(result.outputUrl, result.store);
		if (!url) return;
		await copyValue(url, $('copy-link') as HTMLButtonElement, 'Link copiado');
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
			markSettingsDirty();
			errorEl.hidden = true;
			errorEl.textContent = '';
			field.value = '';
			refreshCodesUi();
			void pushCloudSettings().then((ok) => {
				if (ok) setSyncNote('saved');
			});
		});
	});

	$('wipe-app').addEventListener('click', () => {
		if (!window.confirm('Apaga a senha, os códigos e os textos salvos neste aparelho?')) return;
		wipeDevice();
		show('unlock');
	});

	$('go-setup').addEventListener('click', () => {
		setFieldError('setup-error', null);
		setFieldError('unlock-error', null);
		show('setup');
	});

	$('go-unlock').addEventListener('click', () => {
		setFieldError('setup-error', null);
		setFieldError('unlock-error', null);
		show('unlock');
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
