import { isPinHash } from '../_shared/stores';

interface Env {
	GERAR_KV: KVNamespace;
}

type CloudPayload = {
	codes?: unknown;
	seals?: unknown;
	updatedAt?: number;
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
	const pinHash = new URL(context.request.url).searchParams.get('pinHash')?.trim() ?? '';
	if (!isPinHash(pinHash)) {
		return Response.json({ error: 'Senha inválida.' }, { status: 400 });
	}

	const raw = await context.env.GERAR_KV.get(`settings:${pinHash}`);
	if (!raw) {
		return new Response(null, { status: 204 });
	}

	return Response.json(JSON.parse(raw));
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
	let body: CloudPayload & { pinHash?: string };
	try {
		body = await context.request.json();
	} catch {
		return Response.json({ error: 'JSON inválido.' }, { status: 400 });
	}

	const pinHash = body.pinHash?.trim() ?? '';
	if (!isPinHash(pinHash)) {
		return Response.json({ error: 'Senha inválida.' }, { status: 400 });
	}

	if (!body.codes || typeof body.codes !== 'object' || !body.seals || typeof body.seals !== 'object') {
		return Response.json({ error: 'Configuração incompleta.' }, { status: 400 });
	}

	const payload = {
		codes: body.codes,
		seals: body.seals,
		updatedAt: typeof body.updatedAt === 'number' ? body.updatedAt : Date.now(),
	};

	await context.env.GERAR_KV.put(`settings:${pinHash}`, JSON.stringify(payload));
	return Response.json({ ok: true, updatedAt: payload.updatedAt });
};
