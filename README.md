# Conto de Pratas — catálogo com pedido pelo WhatsApp

Site estático (HTML + CSS + JS puro, sem build) hospedado no GitHub Pages. O cliente navega pelo catálogo, monta o carrinho e envia o pedido pronto para o WhatsApp da loja.

## Recursos
- Busca (ignora acentos), filtro por categoria e ordenação
- Selos de promoção (% OFF) e produto esgotado ("Avise-me" via WhatsApp)
- Detalhes com variações (aro, cor...), quantidade e observação
- Link direto para cada produto (`/#produto/<id>`)
- Carrinho salvo no navegador, taxa de entrega e frete grátis acima de um valor
- Checkout com nome, retirada/entrega, endereço, pagamento e troco
- Seção do Instagram da loja
- Painel administrativo em `/admin.html`

## Painel (`/admin.html`)
Cadastra, edita e remove produtos, altera preço e disponibilidade, envia fotos e edita as configurações da loja. As alterações ficam pendentes até clicar em **Publicar no site**; o painel grava os arquivos neste repositório pela API do GitHub e o site atualiza em 1–2 minutos.

Para entrar, crie um token em https://github.com/settings/personal-access-tokens/new:
- **Repository access**: *Only select repositories* → este repositório
- **Repository permissions → Contents**: *Read and write*

O token fica só no seu navegador (e, se marcar "Lembrar neste dispositivo", no `localStorage`).

## Arquivos de dados
- `data/config.json`: nome, WhatsApp (55 + DDD + número), Instagram, banner, entrega, pagamentos
- `data/products.json`: produtos
- `img/produtos/`: fotos enviadas pelo painel

## Rodar localmente
```bash
python3 -m http.server 8080
# abra http://localhost:8080
```
