# Design System — Comprei Testei

Referência nomeada: arte conceito da marca (logo sacola, tagline manuscrita, cartão único de WhatsApp, fita cream, bloco tracejado, selos de categoria).

## Visual Theme

Convite de amiga no celular. Fundo blush claro, um cartão branco para o grupo, ícones-selo só de informação, brilhos de quatro pontas e um botão WhatsApp verde (a única ação principal).

## Color

| Token | Hex | Uso |
| --- | --- | --- |
| blush | `#FFF5F7` | Fundo da página |
| blush-soft | `#FFE8EE` | Bloco da legenda, pílula do grupo silencioso |
| pink | `#E84C89` | Marca, Instagram, bordão |
| pink-deep | `#D63D78` | Hover / profundidade do rosa |
| cream | `#F7EFE6` | Fita da tagline |
| cream-btn | `#F3E6D8` | Botão do site |
| ink | `#1A1D23` | Títulos |
| muted | `#6A4450` | Apoio (rosa-tinto, não cinza) |
| fire | `#F4A261` | Selo “oferta encontrada” |
| gold | `#F5B942` | Brilhos e cadeado |
| wa | `#128C7E` | CTA do grupo (contraste do branco no botão) |
| wa-deep | `#0E7A6E` | Hover do CTA |

Estratégia: **committed**. O rosa da logo carrega a marca. O verde do WhatsApp carrega o único convite para o grupo.

## Typography

- Display/UI: **Nunito** 700/800
- Script: **Itim** (tagline, bordão, rodapé) — manuscrita arredondada, no mesmo clima do Nunito
- H1: ~1.32–1.5rem, extrabold, `text-wrap: balance`
- Corpo/descrição: ≥ 0.8rem
- Sem serif editorial. Sem terceira família.

## Layout

Coluna centrada `max-width: 430px`. No desktop, `760px` com o convite ao lado das categorias e da legenda, para caber mais numa tela. Ritmo: header compacto → grupo + categorias → lojas → redes → bordão.

## Components

- **Group invite:** cartão branco, pílula de grupo silencioso, botão verde único.
- **Category chips:** selos não clicáveis, só para mostrar o que tem no grupo.
- **Tagline:** pílula cream com borda rosa fina.
- **Legend:** caixa com borda tracejada rosa.
- **Stores:** logos oficiais em células brancas.
- **Sparkle:** estrela de quatro pontas em SVG.

## Motion

Hover só em fundo/borda/sombra. Sem scale em imagem. Easing `cubic-bezier(0.25, 1, 0.5, 1)`. Reduced motion: transições quase instantâneas.
