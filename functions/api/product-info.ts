import { fetchProductMeta } from '../_shared/product-meta';
import { isAllowedAffiliateUrl } from '../_shared/stores';

export const onRequestPost: PagesFunction = async (context) => {
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

	const meta = await fetchProductMeta(url);
	if (!meta) {
		return Response.json({ error: 'Não deu para ler este produto agora.' }, { status: 404 });
	}

	return Response.json(meta);
};
