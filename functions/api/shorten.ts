import { isAllowedAffiliateUrl, randomSlug } from '../_shared/stores';

interface Env {
	GERAR_KV: KVNamespace;
}

const TTL_SECONDS = 60 * 60 * 24 * 365;

export const onRequestPost: PagesFunction<Env> = async (context) => {
	let body: { url?: string };
	try {
		body = await context.request.json();
	} catch {
		return Response.json({ error: 'JSON inválido.' }, { status: 400 });
	}

	const url = body.url?.trim();
	if (!url || !isAllowedAffiliateUrl(url)) {
		return Response.json({ error: 'URL de loja não permitida.' }, { status: 400 });
	}

	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url));
	const hashKey = `linkhash:${Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')}`;
	const existing = await context.env.GERAR_KV.get(hashKey);
	if (existing) {
		const origin = new URL(context.request.url).origin;
		return Response.json({ shortUrl: `${origin}/r/${existing}` });
	}

	for (let attempt = 0; attempt < 5; attempt += 1) {
		const slug = randomSlug();
		const slugKey = `link:${slug}`;
		const taken = await context.env.GERAR_KV.get(slugKey);
		if (taken) continue;

		await context.env.GERAR_KV.put(slugKey, url, { expirationTtl: TTL_SECONDS });
		await context.env.GERAR_KV.put(hashKey, slug, { expirationTtl: TTL_SECONDS });

		const origin = new URL(context.request.url).origin;
		return Response.json({ shortUrl: `${origin}/r/${slug}` });
	}

	return Response.json({ error: 'Não deu para encurtar agora. Tenta de novo.' }, { status: 503 });
};
