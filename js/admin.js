(function () {
  "use strict";

  const DEFAULT_REPO = { owner: "Mateusrevilo", repo: "Conto-de-prata" };
  const LEGACY_AUTH_KEY = "painel_auth";
  const SESSION_KEY = "painel_sessao";
  const VAULT_KEY = "painel_cofre";
  const LOGIN = { user: "contodeprataadmin", salt: "oviOUokwvukoIgTv0+/F3A==", hash: "YHhCtToOw8n54DfSPQ2NYXGl3wg9g9FZg2z466BrWxY=", iterations: 210000 };
  const VAULT_ITERATIONS = 310000;
  const API = "https://api.github.com";
  const PRODUCTS_PATH = "data/products.json";
  const CONFIG_PATH = "data/config.json";
  const IMG_DIR = "img/produtos/";
  const MAX_IMG = 1200;
  const SITE_IMG_DIR = "img/site/";
  const FONTS = [
    ["Playfair Display", "Playfair Display (elegante)"],
    ["Cormorant Garamond", "Cormorant Garamond (clássica)"],
    ["Montserrat", "Montserrat (moderna)"],
    ["Poppins", "Poppins (arredondada)"],
    ["Inter", "Inter (simples)"],
  ];
  const THEMES = [
    { nome: "Prata clássica", primaria: "#1c1917", fundo: "#f7f5f2", texto: "#111827", destaque: "#d6d3d1", promo: "#dc2626", banner: "#1c1917", fonteTitulos: "Playfair Display" },
    { nome: "Rosé", primaria: "#9f4f5f", fundo: "#fdf6f5", texto: "#3b2a2d", destaque: "#f5c6cb", promo: "#be123c", banner: "#7a3b48", fonteTitulos: "Cormorant Garamond" },
    { nome: "Dourado", primaria: "#7c5a1e", fundo: "#fbf8f1", texto: "#292218", destaque: "#e9c46a", promo: "#b91c1c", banner: "#3d2e14", fonteTitulos: "Playfair Display" },
    { nome: "Minimalista", primaria: "#111111", fundo: "#ffffff", texto: "#111111", destaque: "#bdbdbd", promo: "#111111", banner: "#2b2b2b", fonteTitulos: "Montserrat" },
    { nome: "Azul noite", primaria: "#1e3a5f", fundo: "#f4f7fb", texto: "#0f1c2e", destaque: "#b7c9e2", promo: "#dc2626", banner: "#0f2340", fonteTitulos: "Poppins" },
    { nome: "Esmeralda", primaria: "#065f46", fundo: "#f3faf7", texto: "#0b2b22", destaque: "#a7f3d0", promo: "#dc2626", banner: "#064e3b", fonteTitulos: "Playfair Display" },
  ];

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const slugify = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "produto";
  const norm = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f5f5f4"/><circle cx="50" cy="54" r="18" fill="none" stroke="#a8a29e" stroke-width="5"/><path d="M44 30l6-8 6 8z" fill="#d6d3d1"/></svg>');

  const st = {
    auth: null,
    branch: "main",
    products: [],
    original: [],
    config: {},
    originalConfig: {},
    pendingImages: {},   // path -> base64 (sem prefixo), ainda não enviadas
    localPreviews: {},   // imagens já enviadas, exibidas localmente até o site atualizar
    deletedImages: new Set(),
    editingId: null,
    editImage: null,     // { path, dataUrl, base64 } | null
  };

  /* ---------- Utils ---------- */
  function toast(msg, isError) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.toggle("error", !!isError);
    t.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.remove("show"), isError ? 5000 : 2600);
  }
  const b64encode = (str) => { const bytes = new TextEncoder().encode(str); let bin = ""; bytes.forEach((b) => (bin += String.fromCharCode(b))); return btoa(bin); };
  const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

  function detectRepo() {
    const m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (m) {
      const seg = location.pathname.split("/").filter(Boolean)[0];
      const repo = seg && !seg.includes(".") ? seg : `${m[1]}.github.io`;
      return { owner: m[1], repo };
    }
    return DEFAULT_REPO;
  }

  function imgSrc(path) {
    if (!path) return PLACEHOLDER;
    const b64 = st.pendingImages[path] || st.localPreviews[path];
    if (b64) return `data:${/\.png$/i.test(path) ? "image/png" : "image/jpeg"};base64,` + b64;
    return path;
  }
  function rawUrl(path) {
    return `https://raw.githubusercontent.com/${st.auth.owner}/${st.auth.repo}/${st.branch}/${path}`;
  }
  window.__imgFallback = function (img) {
    const p = img.dataset.path;
    if (p && !/^(https?:|data:)/.test(p) && !img.dataset.triedRaw) { img.dataset.triedRaw = "1"; img.src = rawUrl(p); }
    else img.src = PLACEHOLDER;
  };

  /* ---------- GitHub API ---------- */
  async function gh(path, opts = {}) {
    const res = await fetch(API + path, {
      ...opts,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: "Bearer " + st.auth.token,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    if (!res.ok) {
      let msg = res.status + "";
      try { msg = (await res.json()).message || msg; } catch { /* ignore */ }
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }
  const repoPath = () => `/repos/${encodeURIComponent(st.auth.owner)}/${encodeURIComponent(st.auth.repo)}`;
  const contentsPath = (p) => `${repoPath()}/contents/${p.split("/").map(encodeURIComponent).join("/")}`;

  async function getFile(path) {
    try {
      return await gh(`${contentsPath(path)}?ref=${encodeURIComponent(st.branch)}&t=${Date.now()}`);
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }
  async function putFile(path, base64, message) {
    const cur = await getFile(path);
    return gh(contentsPath(path), {
      method: "PUT",
      body: JSON.stringify({ message, content: base64, branch: st.branch, ...(cur ? { sha: cur.sha } : {}) }),
    });
  }
  async function deleteFile(path, message) {
    const cur = await getFile(path);
    if (!cur) return;
    await gh(contentsPath(path), { method: "DELETE", body: JSON.stringify({ message, sha: cur.sha, branch: st.branch }) });
  }

  /* ---------- Auth ---------- */
  const bytesToB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  async function pbkdf2(secret, salt, iterations) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "PBKDF2", false, ["deriveBits", "deriveKey"]);
    return { base, params: { name: "PBKDF2", hash: "SHA-256", salt, iterations } };
  }
  async function checkLogin(user, password) {
    if (user !== LOGIN.user) return false;
    const { base, params } = await pbkdf2(user + "\n" + password, b64ToBytes(LOGIN.salt), LOGIN.iterations);
    const bits = await crypto.subtle.deriveBits(params, base, 256);
    return bytesToB64(bits) === LOGIN.hash;
  }
  async function vaultKey(password, salt) {
    const { base, params } = await pbkdf2(password, salt, VAULT_ITERATIONS);
    return crypto.subtle.deriveKey(params, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  function loadVault() {
    try { return JSON.parse(localStorage.getItem(VAULT_KEY)); } catch { return null; }
  }
  async function saveVault(auth, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await vaultKey(password, salt);
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(auth)));
    localStorage.setItem(VAULT_KEY, JSON.stringify({ salt: bytesToB64(salt), iv: bytesToB64(iv), ct: bytesToB64(ct) }));
  }
  async function openVault(password) {
    const v = loadVault();
    if (!v) return null;
    try {
      const key = await vaultKey(password, b64ToBytes(v.salt));
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(v.iv) }, key, b64ToBytes(v.ct));
      return JSON.parse(new TextDecoder().decode(pt));
    } catch { return null; }
  }
  function loadSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
  }
  function saveSession(auth) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(auth)); }
  function clearSession() { sessionStorage.removeItem(SESSION_KEY); }

  async function connect(auth) {
    st.auth = auth;
    const repo = await gh(repoPath());
    if (repo.permissions && !repo.permissions.push) throw Object.assign(new Error("Este token não tem permissão de escrita no repositório."), { status: 403 });
    st.branch = repo.default_branch || "main";
    await loadData();
  }

  async function loadData() {
    const [pf, cf] = await Promise.all([getFile(PRODUCTS_PATH), getFile(CONFIG_PATH)]);
    st.products = pf ? JSON.parse(b64decode(pf.content)) : [];
    st.config = normalizeConfig(cf ? JSON.parse(b64decode(cf.content)) : {});
    st.original = clone(st.products);
    st.originalConfig = clone(st.config);
    st.pendingImages = {};
    st.deletedImages = new Set();
    renderAll();
  }

  function showApp() {
    $("#loginView").hidden = true;
    $("#appView").hidden = false;
  }
  function showLogin(err) {
    $("#appView").hidden = true;
    $("#loginView").hidden = false;
    const d = st.auth || detectRepo();
    const f = $("#loginForm");
    f.owner.value = d.owner; f.repo.value = d.repo;
    f.password.value = "";
    showTokenSetup(!loadVault());
    $("#loginError").hidden = true;
    if (err) { $("#loginError").textContent = err; $("#loginError").hidden = false; }
  }

  function showTokenSetup(show, info) {
    $("#tokenSetup").hidden = !show;
    $("#loginForm").token.required = show;
    $("#changeToken").hidden = show || !loadVault();
    if (info) $("#setupInfo").textContent = info;
  }

  function authErrorMessage(e) {
    if (e.status === 401) return "Token inválido ou expirado.";
    if (e.status === 404) return "Repositório não encontrado ou o token não tem acesso a ele.";
    if (e.status === 403) return e.message.includes("permissão") ? e.message : "Sem permissão. Verifique se o token tem acesso de escrita (Contents: Read and write).";
    return "Erro ao conectar: " + e.message;
  }

  /* ---------- Render ---------- */
  function renderAll() {
    $("#storeName").textContent = st.config.nome || "Painel";
    document.title = "Painel | " + (st.config.nome || "Loja");
    renderFilters();
    renderList();
    fillSettings();
    renderAppearance();
    renderPending();
  }

  function categories() {
    return [...new Set(st.products.map((p) => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  function renderFilters() {
    const cur = $("#catFilter").value;
    const cats = categories();
    $("#catFilter").innerHTML = `<option value="">Todas as categorias</option>` + cats.map((c) => `<option ${c === cur ? "selected" : ""}>${esc(c)}</option>`).join("");
    $("#catList").innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join("");
  }

  function isChanged(p) {
    const o = st.original.find((x) => x.id === p.id);
    return !o || JSON.stringify(o) !== JSON.stringify(p);
  }

  function renderList() {
    const q = norm($("#search").value);
    const cat = $("#catFilter").value;
    const list = st.products.filter((p) => (!cat || p.categoria === cat) && (!q || norm(p.nome + " " + (p.categoria || "")).includes(q)));
    $("#countInfo").textContent = `${st.products.length} produto(s) cadastrado(s)` + (list.length !== st.products.length ? ` · ${list.length} exibido(s)` : "");
    $("#emptyList").hidden = list.length > 0;
    $("#productList").innerHTML = list.map((p) => `
      <div class="item ${isChanged(p) ? "changed" : ""}" data-id="${esc(p.id)}">
        <img src="${esc(imgSrc(p.imagem))}" data-path="${esc(p.imagem || "")}" alt="" onerror="__imgFallback(this)" />
        <div>
          <p class="item__name">${esc(p.nome)}</p>
          <p class="item__meta">
            <span>${esc(p.categoria || "Sem categoria")}</span>
            ${p.precoAntigo ? `<span>de <s>${money(p.precoAntigo)}</s></span>` : ""}
            ${p.disponivel === false ? `<span class="pill pill--out">Esgotado</span>` : ""}
            ${p.destaque ? `<span class="pill pill--star">★ Destaque</span>` : ""}
          </p>
        </div>
        <div class="item__controls">
          <label class="price-input" title="Preço"><span>R$</span><input type="number" step="0.01" min="0" value="${Number(p.preco).toFixed(2)}" data-price aria-label="Preço de ${esc(p.nome)}" /></label>
          <label class="switch" title="Disponível"><input type="checkbox" data-avail ${p.disponivel === false ? "" : "checked"} aria-label="Disponível" /><span></span></label>
          <button class="btn btn--ghost btn--sm" data-edit>Editar</button>
          <button class="btn btn--danger btn--sm" data-del aria-label="Remover">Remover</button>
        </div>
      </div>`).join("");
  }

  function pendingCount() {
    const ids = new Set([...st.products.map((p) => p.id), ...st.original.map((p) => p.id)]);
    let n = 0;
    ids.forEach((id) => {
      const a = st.products.find((p) => p.id === id), b = st.original.find((p) => p.id === id);
      if (JSON.stringify(a) !== JSON.stringify(b)) n++;
    });
    const orderChanged = n === 0 && st.products.map((p) => p.id).join() !== st.original.map((p) => p.id).join();
    const cfgChanged = JSON.stringify(st.config) !== JSON.stringify(st.originalConfig);
    return { products: n + (orderChanged ? 1 : 0), config: cfgChanged };
  }

  function renderPending() {
    const p = pendingCount();
    const parts = [];
    if (p.products) parts.push(`${p.products} produto(s) alterado(s)`);
    if (p.config) parts.push("configurações alteradas");
    $("#publishBar").hidden = parts.length === 0;
    $("#pendingInfo").textContent = parts.join(" · ") + " — ainda não publicado";
  }

  /* ---------- Editor ---------- */
  function openEditor(id) {
    const p = id ? st.products.find((x) => x.id === id) : null;
    st.editingId = id || null;
    st.editImage = null;
    const f = $("#productForm");
    f.reset();
    $("#editorTitle").textContent = p ? "Editar produto" : "Novo produto";
    f.nome.value = p?.nome || "";
    f.categoria.value = p?.categoria || $("#catFilter").value || "";
    f.preco.value = p ? Number(p.preco).toFixed(2) : "";
    f.precoAntigo.value = p?.precoAntigo ? Number(p.precoAntigo).toFixed(2) : "";
    f.descricao.value = p?.descricao || "";
    f.variacoes.value = (p?.variacoes || []).map((v) => `${v.nome}: ${v.opcoes.join(", ")}`).join("\n");
    f.disponivel.checked = p ? p.disponivel !== false : true;
    f.destaque.checked = !!p?.destaque;
    f.imagem.value = p?.imagem && !st.pendingImages[p.imagem] ? p.imagem : "";
    setPreview(p?.imagem);
    $("#formError").hidden = true;
    $$(".field", f).forEach((x) => x.classList.remove("invalid"));
    $("#editor").hidden = false;
    setTimeout(() => f.nome.focus(), 50);
  }
  function setPreview(path) {
    const img = $("#imgPreview");
    img.dataset.path = path || "";
    delete img.dataset.triedRaw;
    img.onerror = () => __imgFallback(img);
    img.src = imgSrc(path);
  }
  function closeEditor() { $("#editor").hidden = true; }

  function resizeImage(file, max = MAX_IMG, type = "image/jpeg") {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext("2d");
        if (type === "image/jpeg") {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, c.width, c.height);
        }
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL(type, 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Imagem inválida")); };
      img.src = url;
    });
  }

  function parseVariations(text) {
    return text.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const i = l.indexOf(":");
      if (i < 1) return null;
      const opcoes = l.slice(i + 1).split(",").map((o) => o.trim()).filter(Boolean);
      return opcoes.length ? { nome: l.slice(0, i).trim(), opcoes } : null;
    });
  }

  function saveProduct(e) {
    e.preventDefault();
    const f = $("#productForm");
    const errs = [];
    $$(".field", f).forEach((x) => x.classList.remove("invalid"));
    const bad = (el, m) => { el.closest(".field").classList.add("invalid"); errs.push(m); };
    const nome = f.nome.value.trim();
    const categoria = f.categoria.value.trim();
    const preco = parseFloat(f.preco.value);
    const precoAntigo = f.precoAntigo.value ? parseFloat(f.precoAntigo.value) : null;
    const variacoes = parseVariations(f.variacoes.value);
    if (!nome) bad(f.nome, "nome");
    if (!categoria) bad(f.categoria, "categoria");
    if (!(preco >= 0) || f.preco.value === "") bad(f.preco, "preço");
    if (precoAntigo != null && !(precoAntigo > preco)) bad(f.precoAntigo, "preço antigo deve ser maior que o preço atual");
    if (variacoes.includes(null)) bad(f.variacoes, "variações no formato Nome: opção1, opção2");
    if (errs.length) { $("#formError").textContent = "Verifique: " + errs.join(", ") + "."; $("#formError").hidden = false; return; }

    const existing = st.editingId ? st.products.find((p) => p.id === st.editingId) : null;
    let id = existing?.id;
    if (!id) {
      const base = slugify(nome);
      id = base;
      for (let i = 2; st.products.some((p) => p.id === id); i++) id = `${base}-${i}`;
    }
    let imagem = f.imagem.value.trim() || existing?.imagem || "";
    if (st.editImage) {
      imagem = `${IMG_DIR}${id}-${Date.now().toString(36)}.jpg`;
      st.pendingImages[imagem] = st.editImage.base64;
    }
    if (existing?.imagem && existing.imagem !== imagem) {
      if (st.pendingImages[existing.imagem]) delete st.pendingImages[existing.imagem];
      else if (existing.imagem.startsWith(IMG_DIR)) st.deletedImages.add(existing.imagem);
    }
    const product = { id, nome, categoria, preco: Math.round(preco * 100) / 100 };
    if (precoAntigo) product.precoAntigo = Math.round(precoAntigo * 100) / 100;
    product.imagem = imagem;
    product.descricao = f.descricao.value.trim();
    if (variacoes.length) product.variacoes = variacoes;
    if (f.destaque.checked) product.destaque = true;
    product.disponivel = f.disponivel.checked;

    if (existing) st.products[st.products.indexOf(existing)] = product;
    else st.products.unshift(product);
    closeEditor();
    renderFilters(); renderList(); renderPending();
    toast(existing ? "Produto atualizado. Clique em \"Publicar no site\"." : "Produto adicionado. Clique em \"Publicar no site\".");
  }

  function removeProduct(id) {
    const p = st.products.find((x) => x.id === id);
    if (!p || !confirm(`Remover "${p.nome}" do catálogo?`)) return;
    st.products = st.products.filter((x) => x.id !== id);
    if (p.imagem) {
      if (st.pendingImages[p.imagem]) delete st.pendingImages[p.imagem];
      else if (p.imagem.startsWith(IMG_DIR)) st.deletedImages.add(p.imagem);
    }
    renderFilters(); renderList(); renderPending();
    toast("Produto removido. Clique em \"Publicar no site\".");
  }

  /* ---------- Settings ---------- */
  const getPath = (o, path) => path.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  function setPath(o, path, v) {
    const keys = path.split(".");
    const last = keys.pop();
    const target = keys.reduce((a, k) => (a[k] ??= {}), o);
    target[last] = v;
  }
  function fillSettings() {
    const f = $("#settingsForm");
    $$("input, textarea", f).forEach((el) => {
      const v = getPath(st.config, el.name);
      if (el.type === "checkbox") el.checked = !!v;
      else if (el.name === "pagamentos") el.value = (v || []).join(", ");
      else el.value = v ?? "";
    });
  }
  function applySettings(e) {
    e.preventDefault();
    const f = $("#settingsForm");
    if (!f.reportValidity()) return;
    const cfg = clone(st.config);
    $$("input, textarea", f).forEach((el) => {
      let v;
      if (el.type === "checkbox") v = el.checked;
      else if (el.type === "number") v = el.value === "" ? (el.name === "entrega.freteGratisAcimaDe" ? null : 0) : parseFloat(el.value);
      else if (el.name === "pagamentos") v = el.value.split(",").map((x) => x.trim()).filter(Boolean);
      else if (el.name === "whatsapp") v = el.value.replace(/\D/g, "");
      else v = el.value.trim();
      setPath(cfg, el.name, v);
    });
    st.config = cfg;
    renderPending();
    toast("Configurações aplicadas. Clique em \"Publicar no site\".");
  }

  /* ---------- Aparência ---------- */
  const newId = () => Math.random().toString(36).slice(2, 8);
  const cssUrl = (s) => String(s).replace(/'/g, "%27");
  const loadedFonts = [];
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

  function normalizeConfig(c) {
    const { nome, ...defaults } = THEMES[0];
    c.tema = { ...defaults, ...(c.corPrimaria ? { primaria: c.corPrimaria, banner: c.corPrimaria } : {}), ...(c.tema || {}) };
    if (!Array.isArray(c.banners)) {
      c.banners = c.banner ? [{ id: newId(), ativo: true, titulo: "", texto: "", imagem: "", botaoTexto: "", botaoLink: "", ...c.banner }] : [];
    }
    c.aviso = { ativo: false, texto: "", link: "", ...(c.aviso || {}) };
    c.secoes = { instagram: true, ...(c.secoes || {}) };
    if (c.logo === undefined) c.logo = "";
    if (c.mostrarNome === undefined) c.mostrarNome = true;
    delete c.corPrimaria;
    delete c.banner;
    return c;
  }

  function dropSiteImage(path) {
    if (!path) return;
    if (st.pendingImages[path]) delete st.pendingImages[path];
    else if (path.startsWith(SITE_IMG_DIR)) st.deletedImages.add(path);
  }

  function themeMatches(t) {
    return Object.keys(t).every((k) => k === "nome" || String(st.config.tema[k]).toLowerCase() === t[k].toLowerCase());
  }
  function renderThemes() {
    $("#themes").innerHTML = THEMES.map((t, i) => `
      <button type="button" class="theme ${themeMatches(t) ? "active" : ""}" data-theme="${i}">
        <span class="theme__sw">${[t.primaria, t.banner, t.destaque, t.fundo].map((x) => `<i style="background:${x}"></i>`).join("")}</span>
        ${esc(t.nome)}
      </button>`).join("");
  }

  function renderAppearance() {
    renderThemes();
    $$("[data-cfg]", $("#tab-appearance")).forEach((el) => {
      const v = getPath(st.config, el.dataset.cfg);
      if (el.type === "checkbox") el.checked = !!v;
      else el.value = v ?? "";
    });
    setLogoPreview();
    renderBanners();
    renderLinkList();
    renderPreview();
  }

  function setLogoPreview() {
    const img = $("#logoPreview");
    img.dataset.path = st.config.logo || "";
    delete img.dataset.triedRaw;
    img.onerror = () => __imgFallback(img);
    img.src = imgSrc(st.config.logo);
    $("#logoRemove").hidden = !st.config.logo;
  }

  function renderLinkList() {
    const cats = [...new Set(st.products.map((p) => p.categoria).filter(Boolean))];
    $("#linkList").innerHTML = [
      `<option value="#produtos">Lista de produtos</option>`,
      ...cats.map((c) => `<option value="#categoria/${esc(c)}">Categoria: ${esc(c)}</option>`),
      ...st.products.map((p) => `<option value="#produto/${esc(p.id)}">Produto: ${esc(p.nome)}</option>`),
      st.config.whatsapp ? `<option value="https://wa.me/${esc(st.config.whatsapp)}">WhatsApp da loja</option>` : "",
    ].join("");
  }

  function renderBanners() {
    const list = st.config.banners;
    const hb = st.config.tema.banner;
    $("#bannerList").innerHTML = list.length ? list.map((b, i) => `
      <div class="bn ${b.ativo === false ? "off" : ""}" data-i="${i}">
        <div class="bn__img" style="${esc(b.imagem ? `background-image:url('${cssUrl(imgSrc(b.imagem))}')` : `background-image:linear-gradient(135deg, ${hb}, color-mix(in srgb, ${hb} 70%, #fff))`)}">
          <label class="btn btn--ghost btn--sm">${b.imagem ? "Trocar foto" : "Adicionar foto"}<input type="file" accept="image/*" data-bn-file hidden /></label>
          ${b.imagem ? `<button type="button" class="btn btn--ghost btn--sm" data-bn-act="noimg">Tirar foto</button>` : ""}
        </div>
        <div class="bn__body">
          <label class="field"><span>Título</span><input data-bn="titulo" value="${esc(b.titulo || "")}" /></label>
          <label class="field"><span>Texto</span><input data-bn="texto" value="${esc(b.texto || "")}" /></label>
          <div class="row">
            <label class="field"><span>Texto do botão</span><input data-bn="botaoTexto" value="${esc(b.botaoTexto || "")}" placeholder="Ex.: Ver anéis" /></label>
            <label class="field"><span>Link do botão</span><input data-bn="botaoLink" list="linkList" value="${esc(b.botaoLink || "")}" placeholder="Escolha ou cole um link" /></label>
          </div>
        </div>
        <div class="bn__foot">
          <label class="check"><input type="checkbox" data-bn="ativo" ${b.ativo === false ? "" : "checked"} /> Ativo</label>
          <button type="button" class="btn btn--ghost btn--sm" data-bn-act="up" ${i === 0 ? "disabled" : ""} aria-label="Subir">↑</button>
          <button type="button" class="btn btn--ghost btn--sm" data-bn-act="down" ${i === list.length - 1 ? "disabled" : ""} aria-label="Descer">↓</button>
          <button type="button" class="btn btn--danger btn--sm" data-bn-act="del">Remover</button>
        </div>
      </div>`).join("") : `<p class="muted small">Nenhum banner. O site mostra o nome e o slogan da loja.</p>`;
  }

  function renderPreview() {
    const c = st.config, t = c.tema;
    ensureFont(t.fonteTitulos);
    const pv = $("#preview");
    const vars = {
      "--pv-p": t.primaria, "--pv-onp": isLight(t.primaria) ? "#111" : "#fff",
      "--pv-bg": t.fundo, "--pv-tx": t.texto, "--pv-promo": t.promo,
      "--pv-hb": t.banner, "--pv-onh": isLight(t.banner) ? "#1c1917" : "#fff",
      "--pv-ac": isLight(t.banner) ? t.texto : t.destaque,
      "--pv-ft": `"${t.fonteTitulos}", Georgia, serif`,
    };
    Object.entries(vars).forEach(([k, v]) => pv.style.setProperty(k, v));
    const banners = c.banners.filter((b) => b.ativo !== false && (b.titulo || b.texto || b.imagem));
    const b = banners[0] || { titulo: c.nome, texto: c.slogan };
    const heroBg = b.imagem ? `background-image:linear-gradient(90deg,rgba(0,0,0,.62),rgba(0,0,0,.15)),url('${cssUrl(imgSrc(b.imagem))}')` : "";
    const prods = [...st.products].sort((x, y) => !!y.precoAntigo - !!x.precoAntigo).slice(0, 2);
    const cats = [...new Set(st.products.map((p) => p.categoria).filter(Boolean))].slice(0, 3);
    const showName = !c.logo || c.mostrarNome !== false;
    pv.innerHTML = `
      ${c.aviso.ativo && c.aviso.texto ? `<div class="pv__announce">${esc(c.aviso.texto)}</div>` : ""}
      <div class="pv__header">
        <span class="pv__brand">${c.logo ? `<img src="${esc(imgSrc(c.logo))}" alt="" />` : ""}${showName ? esc(c.nome || "") : ""}</span>
        <span class="pv__search"></span><span class="pv__cart"></span>
      </div>
      <div class="pv__hero ${b.imagem ? "has-img" : ""}" style="${esc(heroBg)}">
        ${b.titulo ? `<strong>${esc(b.titulo)}</strong>` : ""}
        ${b.texto ? `<small>${esc(b.texto)}</small>` : ""}
        ${b.botaoTexto && b.botaoLink ? `<span class="pv__btn">${esc(b.botaoTexto)}</span>` : ""}
        ${banners.length > 1 ? `<span class="pv__dots">${banners.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</span>` : ""}
      </div>
      <div class="pv__chips"><span class="on">Todos</span>${cats.map((x) => `<span>${esc(x)}</span>`).join("")}</div>
      <div class="pv__grid">${prods.map((p) => `
        <div class="pv__card">
          ${p.precoAntigo > p.preco ? `<span class="pv__badge">-${Math.round((1 - p.preco / p.precoAntigo) * 100)}%</span>` : ""}
          <img src="${esc(imgSrc(p.imagem))}" alt="" />
          <div><b>${esc(p.nome)}</b><span class="pv__price">${money(p.preco)}</span><div class="pv__add">+ Adicionar</div></div>
        </div>`).join("")}</div>`;
  }

  function appearanceChanged() {
    renderPending();
    renderPreview();
  }

  function bindAppearance() {
    $("#fontSelect").innerHTML = FONTS.map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join("");
    const tab = $("#tab-appearance");

    tab.addEventListener("input", (e) => {
      const el = e.target.closest("[data-cfg]");
      if (el) {
        setPath(st.config, el.dataset.cfg, el.type === "checkbox" ? el.checked : el.value);
        if (el.dataset.cfg.startsWith("tema.")) { renderThemes(); if (el.dataset.cfg === "tema.banner") renderBanners(); }
        return appearanceChanged();
      }
      const field = e.target.closest("[data-bn]");
      if (field) {
        const card = field.closest(".bn");
        const b = st.config.banners[+card.dataset.i];
        b[field.dataset.bn] = field.type === "checkbox" ? field.checked : field.value;
        card.classList.toggle("off", b.ativo === false);
        appearanceChanged();
      }
    });

    $("#themes").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-theme]");
      if (!btn) return;
      const { nome, ...t } = THEMES[+btn.dataset.theme];
      st.config.tema = { ...st.config.tema, ...t };
      renderAppearance();
      renderPending();
    });

    $("#logoFile").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      try {
        const dataUrl = await resizeImage(file, 500, "image/png");
        dropSiteImage(st.config.logo);
        st.config.logo = `${SITE_IMG_DIR}logo-${Date.now().toString(36)}.png`;
        st.pendingImages[st.config.logo] = dataUrl.split(",")[1];
        setLogoPreview();
        appearanceChanged();
      } catch (err) { toast(err.message, true); }
    });
    $("#logoRemove").addEventListener("click", () => {
      dropSiteImage(st.config.logo);
      st.config.logo = "";
      setLogoPreview();
      appearanceChanged();
    });

    $("#addBanner").addEventListener("click", () => {
      st.config.banners.push({ id: newId(), ativo: true, titulo: "Novo banner", texto: "", imagem: "", botaoTexto: "", botaoLink: "" });
      renderBanners();
      appearanceChanged();
      const input = $("#bannerList .bn:last-child [data-bn=titulo]");
      input.focus();
      input.select();
    });

    $("#bannerList").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-bn-act]");
      if (!btn) return;
      const list = st.config.banners;
      const i = +btn.closest(".bn").dataset.i;
      const act = btn.dataset.bnAct;
      if (act === "up" || act === "down") {
        const j = act === "up" ? i - 1 : i + 1;
        [list[i], list[j]] = [list[j], list[i]];
      } else if (act === "del") {
        if (!confirm("Remover este banner?")) return;
        dropSiteImage(list[i].imagem);
        list.splice(i, 1);
      } else if (act === "noimg") {
        dropSiteImage(list[i].imagem);
        list[i].imagem = "";
      }
      renderBanners();
      appearanceChanged();
    });

    $("#bannerList").addEventListener("change", async (e) => {
      if (!e.target.matches("[data-bn-file]")) return;
      const file = e.target.files[0];
      if (!file) return;
      const b = st.config.banners[+e.target.closest(".bn").dataset.i];
      try {
        const dataUrl = await resizeImage(file, 1600);
        dropSiteImage(b.imagem);
        b.imagem = `${SITE_IMG_DIR}banner-${b.id}-${Date.now().toString(36)}.jpg`;
        st.pendingImages[b.imagem] = dataUrl.split(",")[1];
        renderBanners();
        appearanceChanged();
      } catch (err) { toast(err.message, true); }
    });
  }

  /* ---------- Publish ---------- */
  async function publish() {
    const btn = $("#publishBtn");
    btn.disabled = true;
    btn.textContent = "Publicando...";
    try {
      const used = new Set([...st.products.map((p) => p.imagem), st.config.logo, ...(st.config.banners || []).map((b) => b.imagem)].filter(Boolean));
      for (const [path, b64] of Object.entries(st.pendingImages)) {
        if (used.has(path)) await putFile(path, b64, `Adiciona imagem ${path.split("/").pop()}`);
      }
      const p = pendingCount();
      if (p.products) {
        await putFile(PRODUCTS_PATH, b64encode(JSON.stringify(st.products, null, 2) + "\n"), "Atualiza produtos pelo painel");
      }
      if (p.config) {
        await putFile(CONFIG_PATH, b64encode(JSON.stringify(st.config, null, 2) + "\n"), "Atualiza configurações pelo painel");
      }
      for (const path of st.deletedImages) {
        if (!used.has(path)) await deleteFile(path, `Remove imagem ${path.split("/").pop()}`).catch(() => {});
      }
      Object.assign(st.localPreviews, st.pendingImages);
      st.pendingImages = {};
      st.original = clone(st.products);
      st.originalConfig = clone(st.config);
      st.deletedImages = new Set();
      renderAll();
      toast("Publicado! O site atualiza em 1 a 2 minutos.");
    } catch (e) {
      console.error(e);
      toast("Erro ao publicar: " + (e.status === 409 ? "conflito, recarregue a página e tente de novo." : e.message), true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Publicar no site";
    }
  }

  /* ---------- Events ---------- */
  function bind() {
    $("#loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.target;
      const btn = $("#loginBtn");
      const fail = (msg) => { $("#loginError").textContent = msg; $("#loginError").hidden = false; };
      $("#loginError").hidden = true;
      btn.disabled = true;
      btn.textContent = "Entrando...";
      try {
        const user = f.user.value.trim(), password = f.password.value;
        if (!(await checkLogin(user, password))) return fail("Usuário ou senha incorretos.");
        const token = f.token.value.trim();
        let auth;
        if (token) {
          auth = { token, owner: f.owner.value.trim() || detectRepo().owner, repo: f.repo.value.trim() || detectRepo().repo };
        } else {
          auth = await openVault(password);
          if (!auth) {
            showTokenSetup(true, "Não foi possível abrir o acesso salvo neste aparelho. Cole o token do GitHub novamente.");
            return fail("Informe o token do GitHub.");
          }
        }
        btn.textContent = "Conectando...";
        try {
          await connect(auth);
        } catch (err) {
          st.auth = null;
          if (!token) showTokenSetup(true, "O token salvo neste aparelho não funciona mais (pode ter expirado). Cole um novo token.");
          if (err.status === 404) $("#repoDetails").open = true;
          return fail(authErrorMessage(err));
        }
        if (token) await saveVault(auth, password);
        saveSession(auth);
        f.token.value = ""; f.password.value = "";
        showApp();
      } finally {
        btn.disabled = false;
        btn.textContent = "Entrar";
      }
    });
    $("#changeToken").addEventListener("click", () => showTokenSetup(true, "Cole o novo token do GitHub. Ele vai substituir o que está salvo neste aparelho."));
    $("#logoutBtn").addEventListener("click", () => {
      if (hasPending() && !confirm("Há alterações não publicadas. Sair mesmo assim?")) return;
      clearSession();
      st.auth = null;
      showLogin();
    });

    $$(".tab").forEach((t) => t.addEventListener("click", () => {
      $$(".tab").forEach((x) => x.classList.toggle("active", x === t));
      $$("section[id^=tab-]").forEach((s) => (s.hidden = s.id !== "tab-" + t.dataset.tab));
    }));

    $("#search").addEventListener("input", renderList);
    bindAppearance();
    $("#catFilter").addEventListener("change", renderList);
    $("#newProduct").addEventListener("click", () => openEditor(null));

    $("#productList").addEventListener("click", (e) => {
      const id = e.target.closest(".item")?.dataset.id;
      if (!id) return;
      if (e.target.closest("[data-edit]")) openEditor(id);
      else if (e.target.closest("[data-del]")) removeProduct(id);
    });
    $("#productList").addEventListener("change", (e) => {
      const item = e.target.closest(".item");
      if (!item) return;
      const p = st.products.find((x) => x.id === item.dataset.id);
      if (e.target.matches("[data-price]")) {
        const v = parseFloat(e.target.value);
        if (!(v >= 0)) { e.target.value = Number(p.preco).toFixed(2); return toast("Preço inválido", true); }
        p.preco = Math.round(v * 100) / 100;
        if (p.precoAntigo && p.precoAntigo <= p.preco) delete p.precoAntigo;
      } else if (e.target.matches("[data-avail]")) {
        p.disponivel = e.target.checked;
      } else return;
      item.classList.toggle("changed", isChanged(p));
      renderPending();
    });

    $("#imgFile").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await resizeImage(file);
        st.editImage = { dataUrl, base64: dataUrl.split(",")[1] };
        $("#imgPreview").src = dataUrl;
        $("#imgUrl").value = "";
      } catch (err) {
        toast(err.message, true);
      }
      e.target.value = "";
    });
    $("#imgUrl").addEventListener("change", (e) => { st.editImage = null; setPreview(e.target.value.trim()); });

    $("#productForm").addEventListener("submit", saveProduct);
    $("#editor").addEventListener("click", (e) => { if (e.target.id === "editor" || e.target.closest("[data-close]")) closeEditor(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#editor").hidden) closeEditor(); });

    $("#settingsForm").addEventListener("submit", applySettings);
    $("#publishBtn").addEventListener("click", publish);
    $("#discardBtn").addEventListener("click", () => {
      if (!confirm("Descartar todas as alterações não publicadas?")) return;
      st.products = clone(st.original);
      st.config = clone(st.originalConfig);
      st.pendingImages = {};
      st.deletedImages = new Set();
      renderAll();
    });
    window.addEventListener("beforeunload", (e) => { if (hasPending()) { e.preventDefault(); e.returnValue = ""; } });
  }
  function hasPending() {
    if (!st.auth) return false;
    const p = pendingCount();
    return p.products > 0 || p.config;
  }

  async function init() {
    bind();
    localStorage.removeItem(LEGACY_AUTH_KEY);
    sessionStorage.removeItem(LEGACY_AUTH_KEY);
    const saved = loadSession();
    if (!saved) return showLogin();
    try {
      await connect(saved);
      showApp();
    } catch (e) {
      clearSession();
      st.auth = null;
      showLogin();
    }
  }
  init();
})();
