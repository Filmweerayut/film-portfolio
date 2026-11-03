/* FILM portfolio — content is loaded from /content/*.json (edited via /admin) */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nl2br = (s) => esc(s).replace(/\n/g, "<br>");
  // "/uploads/x.jpg" -> "uploads/x.jpg" so the site also works from a sub-folder
  const src = (p) => (p ? String(p).replace(/^\/(?!\/)/, "") : "");
  const get = (o, path) => path.split(".").reduce((a, k) => (a == null ? a : a[k]), o);

  /* ---------- Mobile menu ---------- */
  const menuBtn = $(".menu-btn"), nav = $(".nav");
  menuBtn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", open);
  });
  document.querySelectorAll(".nav-links a").forEach((a) => a.addEventListener("click", () => nav.classList.remove("open")));

  /* ---------- Site text ---------- */
  function applySite(site) {
    document.querySelectorAll("[data-bind]").forEach((el) => {
      const v = get(site, el.dataset.bind);
      if (typeof v === "string" && v.trim()) el.innerHTML = nl2br(v);
    });
    document.querySelectorAll("[data-bind-src]").forEach((el) => {
      const v = get(site, el.dataset.bindSrc);
      if (v) el.src = src(v);
    });
    document.querySelectorAll("[data-bind-list]").forEach((el) => {
      const v = get(site, el.dataset.bindList);
      if (Array.isArray(v) && v.length) el.innerHTML = v.map((x) => `<li>${esc(x)}</li>`).join("");
    });
    document.querySelectorAll("[data-bind-lines]").forEach((el) => {
      const v = get(site, el.dataset.bindLines);
      if (v) el.innerHTML = String(v).split("\n").filter(Boolean).map((l) => `<span>${esc(l)}</span>`).join("");
    });
    document.querySelectorAll("[data-bind-paras]").forEach((el) => {
      const v = get(site, el.dataset.bindParas);
      if (v) el.innerHTML = String(v).split(/\n\s*\n/).map((p) => `<p>${nl2br(p)}</p>`).join("");
    });
    const c = site.contact || {};
    if (c.email) { const m = $("#mail"); m.textContent = c.email; m.href = "mailto:" + c.email; }
    if (Array.isArray(c.socials)) {
      $("#socials").innerHTML = c.socials.filter((s) => s && s.label)
        .map((s) => `<li><a href="${esc(s.url || "#")}" target="_blank" rel="noopener">${esc(s.label)} <span>↗</span></a></li>`).join("");
    }
  }

  /* ---------- Works ---------- */
  let works = [], visible = [], current = 0;
  const grid = $("#grid"), cats = $("#cats");

  function renderCats() {
    const list = [...new Set(works.map((w) => w.category).filter(Boolean))];
    cats.innerHTML =
      `<li><button class="active" data-cat="">ALL</button></li>` +
      list.map((c) => `<li><button data-cat="${esc(c)}">${esc(c.toUpperCase())}</button></li>`).join("") +
      `<li><span class="soon">MORE SOON</span></li>`;
  }
  function renderGrid(cat = "") {
    visible = works.filter((w) => !cat || w.category === cat);
    if (!visible.length) { grid.innerHTML = `<p class="grid-msg">ยังไม่มีผลงานในหมวดนี้</p>`; return; }
    grid.innerHTML = visible.map((w, i) => `
      <button class="card" data-i="${i}" aria-label="เปิดดู ${esc(w.title)}">
        <div class="card-media">${w.image ? `<img src="${esc(src(w.image))}" alt="${esc(w.title)}" loading="lazy" />` : ""}</div>
        <div class="card-info">
          <span class="card-no">${String(works.indexOf(w) + 1).padStart(2, "0")}</span>
          <h3>${esc(w.title)}</h3>
          <span class="card-cat">${esc(w.category || "")}${w.year ? " · " + esc(w.year) : ""}</span>
        </div>
      </button>`).join("");
  }
  function setCat(cat) {
    cats.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.cat === cat));
    renderGrid(cat);
  }
  cats.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setCat(b.dataset.cat); });
  $("#viewAll").addEventListener("click", () => { setCat(""); grid.scrollIntoView({ behavior: "smooth", block: "start" }); });

  /* ---------- Lightbox ---------- */
  const lb = $("#lightbox");
  function show(i) {
    current = (i + visible.length) % visible.length;
    const w = visible[current];
    $("#lb-img").src = src(w.image); $("#lb-img").alt = w.title || "";
    $("#lb-title").textContent = w.title || "";
    $("#lb-meta").textContent = [w.category, w.year].filter(Boolean).join(" · ");
    $("#lb-desc").innerHTML = nl2br(w.description || "");
    $("#lb-count").textContent = `${current + 1} / ${visible.length}`;
  }
  let lastFocus;
  function open(i) { lastFocus = document.activeElement; show(i); lb.hidden = false; requestAnimationFrame(() => lb.classList.add("open")); document.body.style.overflow = "hidden"; $(".lb-close").focus(); }
  function close() { lb.classList.remove("open"); document.body.style.overflow = ""; setTimeout(() => (lb.hidden = true), 250); lastFocus && lastFocus.focus(); }
  grid.addEventListener("click", (e) => { const c = e.target.closest(".card"); if (c) open(+c.dataset.i); });
  lb.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  $("#lb-prev").onclick = () => show(current - 1);
  $("#lb-next").onclick = () => show(current + 1);
  document.addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });

  /* ---------- Load content ---------- */
  const load = (u) => fetch(u, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(u); return r.json(); });
  load("content/site.json").then(applySite).catch((e) => console.warn("site.json not loaded", e));
  load("content/works.json")
    .then((d) => { works = (d.items || []).filter((w) => w && w.title); renderCats(); renderGrid(); })
    .catch(() => { grid.innerHTML = `<p class="grid-msg">โหลดผลงานไม่ได้ — เปิดผ่านเว็บเซิร์ฟเวอร์ (ไม่ใช่ file://)</p>`; });

  /* ---------- Reveal ---------- */
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: 0.1 });
    document.querySelectorAll(".work, .about, .contact").forEach((el) => { el.classList.add("reveal"); io.observe(el); });
  }
})();
