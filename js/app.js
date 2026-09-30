(function () {
  "use strict";

  let cfg = {};
  let products = [];
  const CART_KEY = "catalogo_cart";
  const CUSTOMER_KEY = "catalogo_customer";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const money = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: cfg.moeda || "BRL" });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const byId = (id) => products.find((p) => p.id === id);
  const PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f5f5f4"/><circle cx="50" cy="54" r="18" fill="none" stroke="#a8a29e" stroke-width="5"/><path d="M44 30l6-8 6 8z" fill="#d6d3d1"/></svg>');

  const state = {
    category: "Todos",
    query: "",
    sort: "relevancia",
    cart: [],
    modal: null,
  };

  async function fetchJSON(path) {
    const res = await fetch(path + "?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error(path + ": " + res.status);
    return res.json();
  }

  function instagramUrl() {
    const ig = (cfg.instagram || "").trim();
    if (!ig) return "";
    return /^https?:/i.test(ig) ? ig : "https://www.instagram.com/" + ig.replace(/^@/, "") + "/";
  }
  function instagramHandle() {
    const ig = (cfg.instagram || "").trim().split("?")[0].replace(/\/+$/, "");
    return "@" + ig.split("/").pop().replace(/^@/, "");
  }

  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage indisponível */ }
  }

  function waLink(text) {
    return "https://wa.me/" + cfg.whatsapp.replace(/\D/g, "") + (text ? "?text=" + encodeURIComponent(text) : "");
  }
  // Navegadores internos (Instagram, Facebook, WhatsApp...) e celulares costumam bloquear
  // abas novas; nesses casos o link abre na mesma aba, o que também aciona o app.
  const sameTabLinks = /Instagram|FBAN|FBAV|FB_IAB|WhatsApp|Line\/|MicroMessenger|; wv\)/i.test(navigator.userAgent) ||
    matchMedia("(pointer: coarse)").matches;
  function openExternal(url) {
    if (sameTabLinks) { location.href = url; return; }
    const w = window.open(url, "_blank");
    if (w) w.opener = null;
    else location.href = url;
  }
  function openWhats(text) {
    openExternal(waLink(text));
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[target="_blank"]');
    if (!a || !sameTabLinks || e.defaultPrevented) return;
    e.preventDefault();
    location.href = a.href;
  });

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove("show"), 2200);
  }

  /* ---------- Setup da loja ---------- */
  function setupStore() {
    document.title = cfg.nome + " | Catálogo";
    applyTheme();
    $("#brandName").textContent = cfg.nome;
    if (cfg.logo) { $("#brandLogo").src = cfg.logo; $("#brandLogo").alt = cfg.nome; $("#brandLogo").hidden = false; }
    $("#brandName").hidden = !!cfg.logo && cfg.mostrarNome === false;
    renderAnnounce();
    renderHero();
    try { $("#adminLink").hidden = !localStorage.getItem("painel_cofre"); } catch { /* storage indisponível */ }
    $("#footerName").textContent = cfg.nome;
    $("#footerSlogan").textContent = cfg.slogan;
    const info = [];
    if (cfg.endereco) info.push(`<span>📍 ${esc(cfg.endereco)}</span>`);
    if (cfg.horario) info.push(`<span>🕒 ${esc(cfg.horario)}</span>`);
    info.push(`<a href="${waLink(`Olá! Vim pelo catálogo da ${cfg.nome}.`)}" target="_blank" rel="noopener">💬 WhatsApp</a>`);
    if (cfg.instagram) info.push(`<a href="${esc(instagramUrl())}" target="_blank" rel="noopener">📷 ${esc(instagramHandle())}</a>`);
    $("#footerInfo").innerHTML = info.join("");
    $("#waFloat").href = waLink(`Olá! Vim pelo catálogo da ${cfg.nome} e gostaria de mais informações.`);

    renderInstagram();

    const del = cfg.entrega || {};
    const opts = [];
    if (del.retirada !== false) opts.push({ v: "retirada", label: "Retirar na loja", sub: "Grátis" });
    if (del.entrega) {
      const sub = del.taxaEntrega > 0 ? money(del.taxaEntrega) + (del.freteGratisAcimaDe ? ` · grátis acima de ${money(del.freteGratisAcimaDe)}` : "") : "Grátis";
      opts.push({ v: "entrega", label: "Entrega", sub });
    }
    $("#deliveryOptions").innerHTML = opts.map((o, i) =>
      `<label class="radio"><input type="radio" name="recebimento" value="${o.v}" ${i === 0 ? "checked" : ""}/><span>${o.label}<small>${o.sub}</small></span></label>`
    ).join("");
    $("#paymentSelect").innerHTML = `<option value="">Selecione...</option>` + cfg.pagamentos.map((p) => `<option>${esc(p)}</option>`).join("");

    const saved = load(CUSTOMER_KEY, {});
    const form = $("#checkoutForm");
    ["nome", "endereco"].forEach((k) => { if (saved[k]) form.elements[k].value = saved[k]; });
    if (saved.recebimento) { const r = form.querySelector(`input[value="${saved.recebimento}"]`); if (r) r.checked = true; }
  }

  const loadedFonts = ["Playfair Display", "Inter"];
  function ensureFont(name) {
    if (!name || loadedFonts.includes(name)) return;
    loadedFonts.push(name);
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=" + name.replace(/ /g, "+") + ":wght@500;600;700&display=swap";
    document.head.appendChild(l);
  }
  function isLight(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return false;
    const n = parseInt(m[1], 16);
    return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.62;
  }
  function applyTheme() {
    const t = cfg.tema || {};
    const primary = t.primaria || cfg.corPrimaria || "#1c1917";
    const heroBg = t.banner || primary;
    const vars = {
      "--primary": primary,
      "--primary-dark": `color-mix(in srgb, ${primary} 80%, #000)`,
      "--on-primary": isLight(primary) ? "#111" : "#fff",
      "--hero-bg": heroBg,
      "--on-hero": isLight(heroBg) ? "#1c1917" : "#fff",
      "--hero-accent": isLight(heroBg) ? t.texto || "#1c1917" : t.destaque || "#d6d3d1",
    };
    if (t.fundo) vars["--bg"] = t.fundo;
    if (t.texto) vars["--text"] = t.texto;
    if (t.destaque) vars["--silver"] = t.destaque;
    if (t.promo) vars["--promo"] = t.promo;
    if (t.fonteTitulos) { ensureFont(t.fonteTitulos); vars["--font-title"] = `"${t.fonteTitulos}", Georgia, serif`; }
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  }
  function linkAttrs(link) {
    return `href="${esc(link)}"` + (/^https?:/i.test(link) ? ' target="_blank" rel="noopener"' : "");
  }
  function renderAnnounce() {
    const a = cfg.aviso || {};
    const el = $("#announce");
    el.hidden = !(a.ativo && a.texto);
    if (!el.hidden) el.innerHTML = a.link ? `<a ${linkAttrs(a.link)}>${esc(a.texto)}</a>` : esc(a.texto);
  }
  function heroSlides() {
    const list = cfg.banners || (cfg.banner ? [cfg.banner] : []);
    const active = list.filter((b) => b.ativo !== false && (b.titulo || b.texto || b.imagem));
    return active.length ? active : [{ titulo: cfg.nome, texto: cfg.slogan }];
  }
  function renderHero() {
    const slides = heroSlides();
    const track = $("#heroTrack"), dots = $("#heroDots");
    track.innerHTML = slides.map((b, i) => {
      const bg = b.imagem ? ` style="background-image:linear-gradient(90deg,rgba(0,0,0,.62),rgba(0,0,0,.15)),url('${esc(encodeURI(b.imagem).replace(/'/g, "%27"))}')"` : "";
      const h = i === 0 ? "h1" : "h2";
      return `<div class="hero__slide${b.imagem ? " has-img" : ""}"${bg}>
        <div class="container">
          ${b.titulo ? `<${h}>${esc(b.titulo)}</${h}>` : ""}
          ${b.texto ? `<p>${esc(b.texto)}</p>` : ""}
          ${b.botaoTexto && b.botaoLink ? `<a class="hero__btn" ${linkAttrs(b.botaoLink)}>${esc(b.botaoTexto)}</a>` : ""}
        </div>
      </div>`;
    }).join("");
    dots.innerHTML = slides.length > 1 ? slides.map((_, i) => `<button type="button" data-i="${i}" aria-label="Banner ${i + 1}"></button>`).join("") : "";
    if (slides.length < 2) return;
    const current = () => Math.round(track.scrollLeft / (track.clientWidth || 1));
    const mark = () => $$("button", dots).forEach((d, j) => d.classList.toggle("active", j === current()));
    const go = (i) => track.scrollTo({ left: i * track.clientWidth });
    let timer;
    const play = () => { clearInterval(timer); timer = setInterval(() => go((current() + 1) % slides.length), 6000); };
    track.addEventListener("scroll", mark, { passive: true });
    track.addEventListener("pointerdown", play);
    dots.addEventListener("click", (e) => { const d = e.target.closest("[data-i]"); if (d) { go(+d.dataset.i); play(); } });
    mark();
    play();
  }

  function renderInstagram() {
    const url = instagramUrl();
    $("#instagram").hidden = !url || cfg.secoes?.instagram === false;
    $("#igHeader").hidden = !url;
    if (!url) return;
    $("#igHeader").href = url;
    $("#igHandle").textContent = instagramHandle();
    $("#igFollow").href = url;
    const pics = [...products].sort((a, b) => !!b.destaque - !!a.destaque).filter((p) => p.imagem).slice(0, 6);
    $("#igGrid").innerHTML = pics.map((p) =>
      `<a href="${esc(url)}" target="_blank" rel="noopener" class="insta__item" aria-label="Ver no Instagram"><img src="${esc(p.imagem)}" alt="${esc(p.nome)}" loading="lazy" onerror="this.src='${PLACEHOLDER}'" /></a>`
    ).join("");
  }

  /* ---------- Catálogo ---------- */
  function renderCategories() {
    const cats = ["Todos", ...new Set(products.map((p) => p.categoria).filter(Boolean))];
    $("#categories").innerHTML = cats.map((c) =>
      `<button class="chip ${c === state.category ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`
    ).join("");
  }

  function filtered() {
    const q = norm(state.query.trim());
    let list = products.filter((p) =>
      (state.category === "Todos" || p.categoria === state.category) &&
      (!q || norm(p.nome + " " + (p.descricao || "") + " " + (p.categoria || "")).includes(q))
    );
    const sorters = {
      relevancia: (a, b) => (b.disponivel - a.disponivel) || (!!b.destaque - !!a.destaque),
      menor: (a, b) => a.preco - b.preco,
      maior: (a, b) => b.preco - a.preco,
      az: (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
    };
    return list.sort(sorters[state.sort]);
  }

  function priceHtml(p) {
    return `<div class="price"><span class="price__now">${money(p.preco)}</span>${p.precoAntigo ? `<span class="price__old">${money(p.precoAntigo)}</span>` : ""}</div>`;
  }

  function renderGrid() {
    const list = filtered();
    $("#resultCount").textContent = `${list.length} produto${list.length === 1 ? "" : "s"}`;
    $("#empty").hidden = list.length > 0;
    $("#grid").innerHTML = list.map((p) => {
      const off = p.precoAntigo ? Math.round((1 - p.preco / p.precoAntigo) * 100) : 0;
      const badge = !p.disponivel ? `<span class="badge badge--out">Esgotado</span>` : off > 0 ? `<span class="badge">-${off}%</span>` : "";
      return `
        <article class="card ${p.disponivel ? "" : "out"}" data-id="${esc(p.id)}">
          <button class="card__img" data-open aria-label="Ver ${esc(p.nome)}">
            <img src="${esc(p.imagem || PLACEHOLDER)}" alt="${esc(p.nome)}" loading="lazy" onerror="this.src='${PLACEHOLDER}'" />${badge}${photosOf(p).length > 1 ? `<span class="card__photos">${photosOf(p).length} fotos</span>` : ""}
          </button>
          <div class="card__body">
            <span class="card__cat">${esc(p.categoria || "")}</span>
            <h3 class="card__name" data-open>${esc(p.nome)}</h3>
            ${priceHtml(p)}
            <div class="card__actions">
              <button class="btn btn--primary" data-add ${p.disponivel ? "" : "disabled"}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
                <span>Adicionar</span>
              </button>
              <button class="btn btn--whats btn--icon" data-buy aria-label="Pedir pelo WhatsApp" title="${p.disponivel ? "Pedir pelo WhatsApp" : "Avise-me quando chegar"}">
                <svg viewBox="0 0 32 32" aria-hidden="true"><use href="#wa-icon"/></svg>
              </button>
            </div>
          </div>
        </article>`;
    }).join("");
  }

  /* ---------- Modal de produto ---------- */
  function openProduct(id, push = true) {
    const p = byId(id);
    if (!p) return;
    state.modal = { p, qty: 1, sel: {} };
    renderGallery(p);
    $("#pmCat").textContent = p.categoria || "";
    $("#pmName").textContent = p.nome;
    $("#pmPrice").innerHTML = priceHtml(p).replace(/^<div class="price">|<\/div>$/g, "");
    $("#pmDesc").textContent = p.descricao || "";
    $("#pmNote").value = "";
    $("#pmQty").textContent = "1";
    $("#pmError").hidden = true;
    $("#pmVariations").innerHTML = (p.variacoes || []).map((v, gi) => `
      <div class="var-group" data-group="${gi}">
        <span class="var-group__label">${esc(v.nome)}</span>
        <div class="var-options">${v.opcoes.map((o) => `<button type="button" class="var-opt" data-opt="${esc(o)}">${esc(o)}</button>`).join("")}</div>
      </div>`).join("");
    $("#pmAdd").disabled = !p.disponivel;
    $("#pmAdd").textContent = p.disponivel ? "Adicionar ao carrinho" : "Esgotado";
    $("#pmBuyNow").lastChild.textContent = p.disponivel ? " Pedir só este pelo WhatsApp" : " Avise-me quando chegar";
    show("#productOverlay");
    if (push) history.pushState({ product: id }, "", "#produto/" + encodeURIComponent(id));
  }

  const photosOf = (p) => (p.imagens?.length ? p.imagens : [p.imagem]).filter(Boolean);
  function renderGallery(p) {
    const pics = photosOf(p);
    const g = $("#pmGallery"), dots = $("#pmDots");
    g.innerHTML = (pics.length ? pics : [PLACEHOLDER]).map((src, i) =>
      `<img src="${esc(src)}" alt="${esc(p.nome)}${pics.length > 1 ? ` - foto ${i + 1}` : ""}" onerror="this.src='${PLACEHOLDER}'" />`).join("");
    g.style.scrollBehavior = "auto";
    g.scrollLeft = 0;
    g.style.scrollBehavior = "";
    const many = pics.length > 1;
    $("#pmPrev").hidden = $("#pmNext").hidden = !many;
    dots.innerHTML = many ? pics.map((_, i) => `<button type="button" data-i="${i}" aria-label="Foto ${i + 1}"${i ? "" : ' class="active"'}></button>`).join("") : "";
  }
  function setupGallery() {
    const g = $("#pmGallery");
    const current = () => Math.round(g.scrollLeft / (g.clientWidth || 1));
    const count = () => g.children.length;
    const go = (i) => g.scrollTo({ left: ((i + count()) % count()) * g.clientWidth });
    g.addEventListener("scroll", () => $$("#pmDots button").forEach((d, j) => d.classList.toggle("active", j === current())), { passive: true });
    $("#pmPrev").addEventListener("click", () => go(current() - 1));
    $("#pmNext").addEventListener("click", () => go(current() + 1));
    $("#pmDots").addEventListener("click", (e) => { const d = e.target.closest("[data-i]"); if (d) go(+d.dataset.i); });
  }

  function validateSelection() {
    const { p, sel } = state.modal;
    const missing = (p.variacoes || []).filter((v, i) => !sel[i]);
    if (missing.length) {
      $("#pmError").textContent = "Selecione: " + missing.map((v) => v.nome).join(", ");
      $("#pmError").hidden = false;
      return false;
    }
    return true;
  }

  function currentSelection() {
    const { p, sel, qty } = state.modal;
    const variacoes = (p.variacoes || []).map((v, i) => ({ nome: v.nome, valor: sel[i] }));
    return { id: p.id, qty, variacoes, obs: $("#pmNote").value.trim() };
  }

  /* ---------- Carrinho ---------- */
  const itemKey = (i) => i.id + "|" + i.variacoes.map((v) => v.valor).join("/") + "|" + (i.obs || "");

  function addToCart(item) {
    const existing = state.cart.find((c) => itemKey(c) === itemKey(item));
    if (existing) existing.qty += item.qty;
    else state.cart.push(item);
    persistCart();
    const btn = $("#openCart");
    btn.classList.remove("bump"); void btn.offsetWidth; btn.classList.add("bump");
    toast("Adicionado ao carrinho ✓");
  }

  function persistCart() {
    save(CART_KEY, state.cart);
    renderCart();
  }

  function totals() {
    const subtotal = state.cart.reduce((s, i) => s + byId(i.id).preco * i.qty, 0);
    const del = cfg.entrega || {};
    const mode = $("#checkoutForm").querySelector('input[name="recebimento"]:checked')?.value;
    let frete = 0;
    if (mode === "entrega") {
      frete = del.taxaEntrega || 0;
      if (del.freteGratisAcimaDe != null && subtotal >= del.freteGratisAcimaDe) frete = 0;
    }
    return { subtotal, frete, total: subtotal + frete, mode };
  }

  function variantText(i) {
    return i.variacoes.map((v) => `${v.nome}: ${v.valor}`).join(" · ");
  }

  function renderCart() {
    const count = state.cart.reduce((s, i) => s + i.qty, 0);
    $("#cartCount").textContent = count;
    const empty = state.cart.length === 0;
    $("#cartEmpty").hidden = !empty;
    $("#checkoutForm").hidden = empty;
    $("#cartFoot").hidden = empty;
    $("#cartList").innerHTML = state.cart.map((i, idx) => {
      const p = byId(i.id);
      const meta = [variantText(i), i.obs ? "Obs: " + i.obs : ""].filter(Boolean).join(" · ");
      return `
        <li class="cart-item" data-idx="${idx}">
          <img src="${esc(p.imagem || PLACEHOLDER)}" alt="" onerror="this.src='${PLACEHOLDER}'" />
          <div>
            <p class="cart-item__name">${esc(p.nome)}</p>
            ${meta ? `<p class="cart-item__meta">${esc(meta)}</p>` : ""}
            <div class="qty qty--sm">
              <button type="button" data-cqty="-1" aria-label="Diminuir">−</button>
              <span>${i.qty}</span>
              <button type="button" data-cqty="1" aria-label="Aumentar">+</button>
            </div>
          </div>
          <div class="cart-item__right">
            <strong>${money(p.preco * i.qty)}</strong>
            <button class="link-btn" data-remove>Remover</button>
          </div>
        </li>`;
    }).join("");
    renderSummary();
  }

  function renderSummary() {
    const t = totals();
    $("#sumSubtotal").textContent = money(t.subtotal);
    $("#sumDeliveryRow").hidden = t.mode !== "entrega";
    $("#sumDelivery").textContent = t.frete > 0 ? money(t.frete) : "Grátis";
    $("#sumTotal").textContent = money(t.total);
    const form = $("#checkoutForm");
    $("#addressField").hidden = t.mode !== "entrega";
    $("#changeField").hidden = !/dinheiro/i.test(form.elements.pagamento.value);
  }

  function buildOrderMessage(data) {
    const t = totals();
    const lines = [`*Novo pedido - ${cfg.nome}*`, ""];
    state.cart.forEach((i) => {
      const p = byId(i.id);
      lines.push(`• ${i.qty}x *${p.nome}* - ${money(p.preco * i.qty)}`);
      if (i.variacoes.length) lines.push(`   ${variantText(i)}`);
      if (i.obs) lines.push(`   Obs: ${i.obs}`);
    });
    lines.push("", `Subtotal: ${money(t.subtotal)}`);
    if (t.mode === "entrega") lines.push(`Entrega: ${t.frete > 0 ? money(t.frete) : "Grátis"}`);
    lines.push(`*Total: ${money(t.total)}*`, "");
    lines.push(`*Nome:* ${data.nome}`);
    lines.push(`*Recebimento:* ${t.mode === "entrega" ? "Entrega" : "Retirada na loja"}`);
    if (t.mode === "entrega") lines.push(`*Endereço:* ${data.endereco}`);
    lines.push(`*Pagamento:* ${data.pagamento}${data.troco ? ` (troco para ${data.troco})` : ""}`);
    if (data.obs) lines.push(`*Observações:* ${data.obs}`);
    return lines.join("\n");
  }

  function sendOrder() {
    const form = $("#checkoutForm");
    const data = Object.fromEntries(new FormData(form));
    const t = totals();
    const errors = [];
    $$(".field", form).forEach((f) => f.classList.remove("invalid"));
    const mark = (name, msg) => { form.elements[name].closest(".field").classList.add("invalid"); errors.push(msg); };
    if (!data.nome?.trim()) mark("nome", "informe seu nome");
    if (t.mode === "entrega" && !data.endereco?.trim()) mark("endereco", "informe o endereço");
    if (!data.pagamento) mark("pagamento", "escolha a forma de pagamento");
    if (cfg.pedidoMinimo && t.subtotal < cfg.pedidoMinimo) errors.push(`pedido mínimo de ${money(cfg.pedidoMinimo)}`);
    if (errors.length) {
      $("#cartError").textContent = "Por favor, " + errors.join(", ") + ".";
      $("#cartError").hidden = false;
      form.querySelector(".invalid input, .invalid select, .invalid textarea")?.focus();
      return;
    }
    $("#cartError").hidden = true;
    save(CUSTOMER_KEY, { nome: data.nome, endereco: data.endereco, recebimento: t.mode });
    openWhats(buildOrderMessage(data));
    state.cart = [];
    persistCart();
    form.elements.obs.value = "";
    form.elements.troco.value = "";
    closeAll();
    toast("Pedido enviado! Finalize a conversa no WhatsApp.");
  }

  function singleProductMessage(p, item) {
    if (!p.disponivel) return `Olá! Tenho interesse no produto *${p.nome}*, que está esgotado. Pode me avisar quando chegar?`;
    const lines = [`Olá! Tenho interesse neste produto do catálogo da ${cfg.nome}:`, "", `*${p.nome}*`];
    if (item) {
      lines.push(`Quantidade: ${item.qty}`);
      if (item.variacoes.length) lines.push(variantText(item));
      if (item.obs) lines.push(`Obs: ${item.obs}`);
      lines.push(`Valor: ${money(p.preco * item.qty)}`);
    } else {
      lines.push(`Valor: ${money(p.preco)}`);
    }
    lines.push("", location.origin + location.pathname + "#produto/" + encodeURIComponent(p.id));
    return lines.join("\n");
  }

  /* ---------- Overlays ---------- */
  function show(sel) {
    $(sel).hidden = false;
    document.body.classList.add("no-scroll");
  }
  function closeAll() {
    const wasProduct = !$("#productOverlay").hidden;
    $$(".overlay").forEach((o) => (o.hidden = true));
    document.body.classList.remove("no-scroll");
    if (wasProduct && location.hash.startsWith("#produto/")) history.pushState({}, "", location.pathname + location.search);
  }

  function handleRoute() {
    const c = location.hash.match(/^#categoria\/(.+)$/);
    if (c) {
      const cat = decodeURIComponent(c[1]);
      state.category = products.some((p) => p.categoria === cat) ? cat : "Todos";
      renderCategories(); renderGrid();
      history.replaceState(null, "", location.pathname + location.search);
      $("#produtos").scrollIntoView({ behavior: "smooth" });
      return;
    }
    const m = location.hash.match(/^#produto\/(.+)$/);
    if (m) openProduct(decodeURIComponent(m[1]), false);
    else { $$(".overlay").forEach((o) => (o.hidden = true)); document.body.classList.remove("no-scroll"); }
  }

  /* ---------- Eventos ---------- */
  function bind() {
    $("#search").addEventListener("input", (e) => { state.query = e.target.value; renderGrid(); });
    $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; renderGrid(); });
    setupGallery();
    $("#categories").addEventListener("click", (e) => {
      const b = e.target.closest("[data-cat]");
      if (!b) return;
      state.category = b.dataset.cat;
      renderCategories(); renderGrid();
    });
    $("#brand").addEventListener("click", (e) => {
      e.preventDefault();
      state.category = "Todos"; state.query = ""; $("#search").value = "";
      renderCategories(); renderGrid(); window.scrollTo({ top: 0 });
    });

    $("#grid").addEventListener("click", (e) => {
      const card = e.target.closest(".card");
      if (!card) return;
      const p = byId(card.dataset.id);
      if (e.target.closest("[data-open]")) openProduct(p.id);
      else if (e.target.closest("[data-add]")) {
        if (p.variacoes?.length) openProduct(p.id);
        else addToCart({ id: p.id, qty: 1, variacoes: [], obs: "" });
      } else if (e.target.closest("[data-buy]")) {
        if (p.disponivel && p.variacoes?.length) openProduct(p.id);
        else openWhats(singleProductMessage(p));
      }
    });

    $("#pmVariations").addEventListener("click", (e) => {
      const opt = e.target.closest("[data-opt]");
      if (!opt) return;
      const group = opt.closest("[data-group]");
      $$(".var-opt", group).forEach((b) => b.classList.toggle("selected", b === opt));
      state.modal.sel[group.dataset.group] = opt.dataset.opt;
      $("#pmError").hidden = true;
    });
    $$("[data-qty]").forEach((b) => b.addEventListener("click", () => {
      state.modal.qty = Math.max(1, state.modal.qty + Number(b.dataset.qty));
      $("#pmQty").textContent = state.modal.qty;
    }));
    $("#pmAdd").addEventListener("click", () => {
      if (!validateSelection()) return;
      addToCart(currentSelection());
      closeAll();
    });
    $("#pmBuyNow").addEventListener("click", () => {
      const { p } = state.modal;
      if (!p.disponivel) return openWhats(singleProductMessage(p));
      if (!validateSelection()) return;
      openWhats(singleProductMessage(p, currentSelection()));
    });

    $("#openCart").addEventListener("click", () => { renderCart(); show("#cartOverlay"); });
    $("#cartList").addEventListener("click", (e) => {
      const li = e.target.closest(".cart-item");
      if (!li) return;
      const idx = Number(li.dataset.idx);
      if (e.target.closest("[data-remove]")) state.cart.splice(idx, 1);
      else if (e.target.closest("[data-cqty]")) {
        state.cart[idx].qty += Number(e.target.closest("[data-cqty]").dataset.cqty);
        if (state.cart[idx].qty < 1) state.cart.splice(idx, 1);
      } else return;
      persistCart();
    });
    $("#checkoutForm").addEventListener("change", renderSummary);
    $("#checkoutForm").addEventListener("input", (e) => { e.target.closest(".field")?.classList.remove("invalid"); $("#cartError").hidden = true; });
    $("#checkoutForm").addEventListener("submit", (e) => { e.preventDefault(); sendOrder(); });
    $("#sendOrder").addEventListener("click", sendOrder);

    $$(".overlay").forEach((o) => o.addEventListener("click", (e) => {
      if (e.target === o || e.target.closest("[data-close]")) closeAll();
    }));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });
    window.addEventListener("popstate", handleRoute);
  }

  async function boot() {
    try {
      const [c, p] = await Promise.all([fetchJSON("data/config.json"), fetchJSON("data/products.json")]);
      cfg = c;
      products = p.map((x) => ({ disponivel: true, ...x }));
    } catch (err) {
      console.error(err);
      $("#empty").textContent = "Não foi possível carregar o catálogo. Recarregue a página.";
      $("#empty").hidden = false;
      return;
    }
    state.cart = load(CART_KEY, []).filter((i) => byId(i.id));
    setupStore();
    renderCategories();
    renderGrid();
    renderCart();
    bind();
    handleRoute();
  }

  boot();
})();
