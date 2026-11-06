interface Env {
	GERAR_KV: KVNamespace;
}

export const onRequest: PagesFunction<Env> = async (context) => {
	const slug = context.params.slug;
	if (!slug || !/^[a-z0-9]{5,12}$/.test(slug)) {
		return new Response('Link inválido.', { status: 400 });
	}

	const target = await context.env.GERAR_KV.get(`link:${slug}`);
	if (!target) {
		return new Response('Esse link expirou ou não existe.', { status: 404 });
	}

	return Response.redirect(target, 302);
};
