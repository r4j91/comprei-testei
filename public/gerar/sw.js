const CACHE = 'comprei-testei-gerar-v1';
const ASSETS = [
	'/gerar/',
	'/gerar/manifest.webmanifest',
	'/gerar/icons/icon-192.png',
	'/gerar/icons/icon-512.png',
	'/gerar/icons/apple-touch-icon.png',
	'/favicon.svg',
];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
		).then(() => self.clients.claim()),
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);
	if (!url.pathname.startsWith('/gerar')) return;

	event.respondWith(
		caches.match(event.request).then((cached) => {
			if (cached) return cached;
			return fetch(event.request)
				.then((response) => {
					if (!response.ok || response.type === 'opaque') return response;
					const copy = response.clone();
					caches.open(CACHE).then((cache) => cache.put(event.request, copy));
					return response;
				})
				.catch(() => cached ?? Response.error());
		}),
	);
});
