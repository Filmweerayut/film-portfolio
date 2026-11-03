/* Hero character: head follows the cursor (desktop), touch / tilt / gentle look-around (mobile).
   15 pre-rendered head frames: 5 yaw columns x 3 pitch rows, cross-faded over a static body. */
(() => {
  const fig = document.getElementById("headRig");
  if (!fig) return;
  const head = fig.querySelector(".rig-head");
  const custom = fig.querySelector(".rig-custom");
  const COLS = ["l2", "l1", "c", "r1", "r2"];   // image-left ... image-right
  const ROWS = ["u", "m", "d"];                 // up, level, down
  const DIR = "images/head/";

  // If the hero image was replaced in the CMS, show that image instead of the rig.
  const isDefault = () => /images\/character\.webp(\?.*)?$/.test(custom.getAttribute("src") || "");
  const checkCustom = () => fig.classList.toggle("is-custom", !isDefault());
  new MutationObserver(checkCustom).observe(custom, { attributes: true, attributeFilter: ["src"] });
  checkCustom();

  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  if (reduce.matches) return;                   // centre frame only

  // Build + preload every frame.
  const imgs = {};
  imgs["c-m"] = head.querySelector('[data-f="c-m"]');
  COLS.forEach((c) => ROWS.forEach((r) => {
    const k = c + "-" + r;
    if (imgs[k]) return;
    const im = new Image();
    im.className = "hf"; im.alt = ""; im.decoding = "async"; im.dataset.f = k;
    im.src = DIR + k + ".webp";
    head.appendChild(im); imgs[k] = im;
  }));

  // Pivot = roughly the face centre in the 615x1432 artwork.
  const PIVOT_X = 0.62, PIVOT_Y = 0.23;
  let tx = 0, ty = 0;          // target  (-1..1)
  let x = 0, y = 0, vx = 0, vy = 0;
  let col = 2, row = 1, cur = "c-m", prev = null, prevTimer = 0;
  let lastInput = 0, mode = "idle", tiltOK = false;
  const coarse = matchMedia("(pointer: coarse)").matches;

  const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));
  function aimAt(cx, cy) {
    const r = fig.getBoundingClientRect();
    const px = r.left + r.width * PIVOT_X, py = r.top + r.height * PIVOT_Y;
    // asymmetric reach: full turn at ~65% of the distance to each viewport edge
    const dx = cx - px, dy = cy - py;
    const sx = dx < 0 ? Math.max(160, px * 0.65) : Math.max(160, (innerWidth - px) * 0.65);
    const sy = dy < 0 ? Math.max(90, py * 0.7) : Math.max(160, (innerHeight - py) * 0.6);
    tx = clamp(dx / sx);
    ty = clamp(dy / sy);
    lastInput = performance.now();
  }

  addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || e.pointerType === "pen") { mode = "pointer"; aimAt(e.clientX, e.clientY); } }, { passive: true });
  document.documentElement.addEventListener("mouseleave", () => { tx = 0; ty = 0; mode = "idle"; });
  addEventListener("blur", () => { tx = 0; ty = 0; mode = "idle"; });
  const onTouch = (e) => { const t = e.touches && e.touches[0]; if (t) { mode = "touch"; aimAt(t.clientX, t.clientY); } };
  addEventListener("touchstart", onTouch, { passive: true });
  addEventListener("touchmove", onTouch, { passive: true });

  // Device tilt where the browser allows it without a permission prompt (not iOS 13+).
  if (coarse && "DeviceOrientationEvent" in window && typeof DeviceOrientationEvent.requestPermission !== "function") {
    let base = null;
    addEventListener("deviceorientation", (e) => {
      if (e.gamma == null || e.beta == null) return;
      if (!base) base = { g: e.gamma, b: e.beta };
      base.g += (e.gamma - base.g) * 0.004; base.b += (e.beta - base.b) * 0.004;   // slowly re-centre
      tiltOK = true;
      if (performance.now() - lastInput < 2500 && mode === "touch") return;      // touch wins
      mode = "tilt";
      tx = clamp((e.gamma - base.g) / 18); ty = clamp((e.beta - base.b) / 16);
    }, { passive: true });
  }

  function show(k) {
    if (k === cur) return;
    const n = imgs[k];
    if (!n || !n.complete || !n.naturalWidth) return;  // not loaded yet: keep current
    if (prev) prev.classList.remove("prev");
    clearTimeout(prevTimer);
    prev = imgs[cur]; prev.classList.remove("on"); prev.classList.add("prev");
    n.classList.add("on"); cur = k;
    const p = prev;
    prevTimer = setTimeout(() => { p.classList.remove("prev"); if (prev === p) prev = null; }, 190);
  }

  let visible = true;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(fig);

  let t0 = performance.now(), last = t0;
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const idleFor = now - lastInput;
    if (mode === "pointer" && idleFor > 5000) { tx = 0; ty = 0; }                // idle -> look back at viewer
    if ((mode === "touch" && idleFor > 3500) || (mode === "idle" && coarse && !tiltOK)) {
      mode = "idle";
      if (coarse && !tiltOK) {                                                   // gentle look-around loop
        const s = Math.max(0, now - t0) / 1000;
        const step = Math.floor(s / 1.6) % 8;
        const path = [[0, 0], [-0.75, -0.2], [-1, 0.3], [0, 0.1], [0.6, -0.55], [1, 0], [0.5, 0.6], [0, 0]];
        tx = path[step][0]; ty = path[step][1];
      }
    }
    // critically-damped spring towards the target (soft, slightly lagging)
    const k = 38, d = 2 * Math.sqrt(k);
    vx += (k * (tx - x) - d * vx) * dt; vy += (k * (ty - y) - d * vy) * dt;
    x += vx * dt; y += vy * dt;
    if (visible) {
      // map to grid with a little hysteresis so it doesn't flicker on boundaries
      const fc = (x + 1) * 2, fr = (y + 1);          // 0..4, 0..2
      if (Math.abs(fc - col) > 0.62) col = Math.round(clamp(fc, 0, 4));
      if (Math.abs(fr - row) > 0.62) row = Math.round(clamp(fr, 0, 2));
      show(COLS[col] + "-" + ROWS[row]);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
