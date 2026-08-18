# Comprei Testei — landing de grupos

Hub de links (Instagram bio / web) com categorias para grupos de WhatsApp. Stack: **Astro + Tailwind**. Hospedagem prevista: **Cloudflare Pages**.

## Ver localmente

```bash
npm install
npm run dev
```

Abra o endereço que o terminal mostrar (em geral `http://localhost:4321`).

## Editar links (só este arquivo)

Tudo que muda no dia a dia fica em [`src/data/links.json`](src/data/links.json):

- `categories[].whatsappUrl` — link de cada grupo (`https://chat.whatsapp.com/...`)
- `brand.instagramUrl` / `brand.websiteUrl`
- `stores[].url` — Amazon, Shopee, Mercado Livre (ou afiliados)

Depois de editar: salvar → `git push` → Cloudflare republica sozinho.

## Deploy no Cloudflare Pages

1. Suba o projeto no GitHub.
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → conectar o repositório.
3. Build settings:
   - **Framework preset:** Astro (ou None)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Em **Custom domains**, adicione o domínio próprio.
5. No DNS da Cloudflare (ou no registrador, apontando nameservers para a Cloudflare), confirme os registros que o Pages indicar (CNAME/`www` e apex). SSL fica automático.

## Estrutura útil

| Caminho | Função |
|---------|--------|
| `src/data/links.json` | Categorias, WhatsApp, lojas, textos |
| `src/pages/index.astro` | Layout da página |
| `public/assets/logo.png` | Logo (extraída do conceito) |
| `public/assets/conceito.png` | Arte de referência |

## Próximo passo (fora desta fase)

Bots de promoções / afiliados são um sistema separado — não fazem parte desta landing estática.
