# Catálogo de produtos com pedido pelo WhatsApp

Site estático (HTML + CSS + JS puro, sem build) que funciona como catálogo: o cliente navega, monta o carrinho e envia o pedido pronto para o WhatsApp da loja.

## Recursos
- Busca (ignora acentos), filtro por categoria e ordenação
- Selos de promoção (% OFF) e produto esgotado ("Avise-me quando chegar" via WhatsApp)
- Página de detalhes com variações (tamanho, cor...), quantidade e observação
- Link direto para cada produto (`/#produto/<id>`) — bom para compartilhar no Instagram/Status
- Carrinho salvo no navegador, taxa de entrega e frete grátis acima de um valor
- Checkout com nome, retirada/entrega, endereço, pagamento e troco
- Mensagem formatada enviada via `wa.me` + botão flutuante do WhatsApp
- Responsivo (mobile first)

## Como personalizar
Edite apenas `js/config.js`:
- `STORE_CONFIG`: nome, número do WhatsApp (só dígitos, com 55 + DDD), cor, logo, endereço, entrega, formas de pagamento
- `PRODUCTS`: lista de produtos (imagens podem ficar na pasta `img/`, ex.: `"img/camiseta.jpg"`)

## Rodar localmente
```bash
python3 -m http.server 8080
# abra http://localhost:8080
```

## Publicar (grátis)
Por ser estático, basta enviar a pasta para **GitHub Pages**, **Netlify** (arrastar a pasta em app.netlify.com/drop) ou **Vercel**.
