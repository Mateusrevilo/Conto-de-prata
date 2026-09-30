(function () {
  "use strict";

  const cfg = window.STORE_CONFIG;
  const products = (window.PRODUCTS || []).map((p) => ({ disponivel: true, ...p }));
  const CART_KEY = "catalogo_cart_" + cfg.whatsapp;
  const CUSTOMER_KEY = "catalogo_customer_" + cfg.whatsapp;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const money = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: cfg.moeda || "BRL" });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const byId = (id) => products.find((p) => p.id === id);
  const PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#eef0f3"/><text x="50" y="58" font-size="30" text-anchor="middle">🛍️</text></svg>');

  const state = {
    category: "Todos",
    query: "",
    sort: "relevancia",
    cart: load(CART_KEY, []).filter((i) => byId(i.id)),
    modal: null,
  };

  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage indisponível */ }
  }

  function waLink(text) {
    return "https://wa.me/" + cfg.whatsapp.replace(/\D/g, "") + (text ? "?text=" + encodeURIComponent(text) : "");
  }
  function openWhats(text) {
    window.open(waLink(text), "_blank", "noopener");
  }

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
    document.documentElement.style.setProperty("--primary", cfg.corPrimaria);
    document.documentElement.style.setProperty("--primary-dark", `color-mix(in srgb, ${cfg.corPrimaria} 80%, #000)`);
    $("#brandName").textContent = cfg.nome;
    if (cfg.logo) { $("#brandLogo").src = cfg.logo; $("#brandLogo").alt = cfg.nome; $("#brandLogo").hidden = false; }
    $("#heroTitle").textContent = cfg.banner?.titulo || cfg.nome;
    $("#heroText").textContent = cfg.banner?.texto || cfg.slogan;
    $("#footerName").textContent = cfg.nome;
    $("#footerSlogan").textContent = cfg.slogan;
    const info = [];
    if (cfg.endereco) info.push(`<span>📍 ${esc(cfg.endereco)}</span>`);
    if (cfg.horario) info.push(`<span>🕒 ${esc(cfg.horario)}</span>`);
    info.push(`<a href="${waLink(`Olá! Vim pelo catálogo da ${cfg.nome}.`)}" target="_blank" rel="noopener">💬 WhatsApp</a>`);
    if (cfg.instagram) info.push(`<a href="${esc(cfg.instagram)}" target="_blank" rel="noopener">📷 Instagram</a>`);
    $("#footerInfo").innerHTML = info.join("");
    $("#waFloat").href = waLink(`Olá! Vim pelo catálogo da ${cfg.nome} e gostaria de mais informações.`);

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
            <img src="${esc(p.imagem || PLACEHOLDER)}" alt="${esc(p.nome)}" loading="lazy" onerror="this.src='${PLACEHOLDER}'" />${badge}
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
    $("#pmImg").src = p.imagem || PLACEHOLDER;
    $("#pmImg").onerror = function () { this.src = PLACEHOLDER; };
    $("#pmImg").alt = p.nome;
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
    const m = location.hash.match(/^#produto\/(.+)$/);
    if (m) openProduct(decodeURIComponent(m[1]), false);
    else { $$(".overlay").forEach((o) => (o.hidden = true)); document.body.classList.remove("no-scroll"); }
  }

  /* ---------- Eventos ---------- */
  function bind() {
    $("#search").addEventListener("input", (e) => { state.query = e.target.value; renderGrid(); });
    $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; renderGrid(); });
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

  setupStore();
  renderCategories();
  renderGrid();
  renderCart();
  bind();
  handleRoute();
})();
