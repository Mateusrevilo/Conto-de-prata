/*
 * CONFIGURAÇÃO DA LOJA
 * Edite este arquivo para personalizar o catálogo. Não é preciso mexer em mais nada.
 */
window.STORE_CONFIG = {
  nome: "Minha Loja",
  slogan: "Qualidade e bom preço, direto no seu WhatsApp",
  // Número com DDI + DDD + número, só dígitos. Ex.: 55 11 91234-5678 -> "5511912345678"
  whatsapp: "5511999999999",
  moeda: "BRL",
  instagram: "https://instagram.com/minhaloja",
  endereco: "Rua Exemplo, 123 - Centro, São Paulo/SP",
  horario: "Seg a Sáb, 9h às 18h",
  corPrimaria: "#16a34a",
  logo: "", // caminho/URL da logo (opcional). Ex.: "img/logo.png"
  banner: {
    titulo: "Novidades da semana",
    texto: "Escolha seus produtos, monte o pedido e finalize em segundos pelo WhatsApp.",
  },
  entrega: {
    retirada: true,
    entrega: true,
    taxaEntrega: 8.0, // 0 para grátis
    freteGratisAcimaDe: 150.0, // null para desativar
  },
  pagamentos: ["Pix", "Cartão de crédito", "Cartão de débito", "Dinheiro"],
  pedidoMinimo: 0,
};

/*
 * PRODUTOS
 * id: único (usado no link do produto)
 * precoAntigo: opcional, mostra selo de promoção
 * variacoes: opcional, ex.: { nome: "Tamanho", opcoes: ["P", "M", "G"] }
 * destaque: opcional, aparece primeiro
 * disponivel: false para mostrar como esgotado
 */
window.PRODUCTS = [
  {
    id: "camiseta-basica",
    nome: "Camiseta Básica Algodão",
    categoria: "Roupas",
    preco: 49.9,
    precoAntigo: 69.9,
    imagem: "https://picsum.photos/seed/camiseta/600/600",
    descricao: "Camiseta 100% algodão, toque macio e caimento confortável. Ideal para o dia a dia.",
    variacoes: [
      { nome: "Tamanho", opcoes: ["P", "M", "G", "GG"] },
      { nome: "Cor", opcoes: ["Branca", "Preta", "Cinza"] },
    ],
    destaque: true,
  },
  {
    id: "moletom-capuz",
    nome: "Moletom com Capuz",
    categoria: "Roupas",
    preco: 139.9,
    imagem: "https://picsum.photos/seed/moletom/600/600",
    descricao: "Moletom flanelado por dentro, com capuz e bolso canguru.",
    variacoes: [{ nome: "Tamanho", opcoes: ["P", "M", "G", "GG"] }],
  },
  {
    id: "tenis-casual",
    nome: "Tênis Casual",
    categoria: "Calçados",
    preco: 199.9,
    precoAntigo: 249.9,
    imagem: "https://picsum.photos/seed/tenis/600/600",
    descricao: "Tênis leve e confortável, solado emborrachado antiderrapante.",
    variacoes: [{ nome: "Numeração", opcoes: ["37", "38", "39", "40", "41", "42", "43"] }],
    destaque: true,
  },
  {
    id: "chinelo-slide",
    nome: "Chinelo Slide",
    categoria: "Calçados",
    preco: 59.9,
    imagem: "https://picsum.photos/seed/chinelo/600/600",
    descricao: "Slide anatômico, super confortável para usar em casa ou na praia.",
    variacoes: [{ nome: "Numeração", opcoes: ["35/36", "37/38", "39/40", "41/42"] }],
    disponivel: false,
  },
  {
    id: "bone-aba-curva",
    nome: "Boné Aba Curva",
    categoria: "Acessórios",
    preco: 79.9,
    imagem: "https://picsum.photos/seed/bone/600/600",
    descricao: "Boné ajustável com fecho de metal e bordado frontal.",
  },
  {
    id: "mochila-urbana",
    nome: "Mochila Urbana",
    categoria: "Acessórios",
    preco: 169.9,
    imagem: "https://picsum.photos/seed/mochila/600/600",
    descricao: "Mochila resistente à água com compartimento para notebook até 15,6\".",
    destaque: true,
  },
  {
    id: "relogio-digital",
    nome: "Relógio Digital",
    categoria: "Acessórios",
    preco: 119.9,
    precoAntigo: 149.9,
    imagem: "https://picsum.photos/seed/relogio/600/600",
    descricao: "Relógio digital à prova d'água, com cronômetro e alarme.",
  },
  {
    id: "garrafa-termica",
    nome: "Garrafa Térmica 500ml",
    categoria: "Casa",
    preco: 89.9,
    imagem: "https://picsum.photos/seed/garrafa/600/600",
    descricao: "Mantém bebidas geladas por 24h e quentes por 12h. Aço inox.",
    variacoes: [{ nome: "Cor", opcoes: ["Preta", "Branca", "Verde"] }],
  },
  {
    id: "caneca-ceramica",
    nome: "Caneca de Cerâmica",
    categoria: "Casa",
    preco: 34.9,
    imagem: "https://picsum.photos/seed/caneca/600/600",
    descricao: "Caneca de cerâmica 350ml, pode ir ao micro-ondas e à lava-louças.",
  },
];
