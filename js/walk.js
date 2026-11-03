/* Hero character walk — one static cutout animated with transforms only.
   Travels across the lane, pauses and turns at each end, bobs/sways per step,
   alternates small "leg" lifts, and squashes a ground shadow. Pauses on hover,
   stays still for prefers-reduced-motion, and sleeps when the hero is off-screen. */
(() => {
  const lane = document.querySelector(".hero-character");
  const walker = document.getElementById("walker");
  if (!lane || !walker) return;
  const flip = walker.querySelector(".walker-flip");
  const body = walker.querySelector(".walker-body");
  const legL = walker.querySelector(".w-leg-l");
  const legR = walker.querySelector(".w-leg-r");
  const shadow = walker.querySelector(".walker-shadow");
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const wide = window.matchMedia("(min-width: 861px)");
  const script = document.querySelector(".hero .script");
  const scriptHome = script && script.nextElementSibling;
  const title = document.querySelector(".hero-title");
  const side = document.querySelector(".hero-side");
  let sSide = "R", sOp = 0, sMin = -1e9, sMax = 1e9, sW = 0;
  // Desktop: the handwritten line travels with the character (beside the head)
  // and fades out whenever it would cross the big type or the right column.
  const placeScript = () => {
    if (!script) return;
    if (wide.matches && script.parentElement !== walker) walker.appendChild(script);
    if (!wide.matches && script.parentElement === walker) { scriptHome.before(script); script.style.opacity = ""; }
  };

  const PAUSE = 900, TURN = 300; // ms at each end
  let laneW = 0, cw = 0, ch = 0, maxX = 0;
  let x = 0, dir = 1, face = 1, mode = "walk", modeT = 0, dist = 0, idle = 0;
  let hovered = false, visible = true, raf = 0, last = 0, settle = 0;

  const measure = () => {
    laneW = lane.clientWidth; ch = walker.offsetHeight; cw = walker.offsetWidth;
    maxX = Math.max(0, laneW - cw);
    x = Math.min(Math.max(x, 0), maxX);
    if (script && script.parentElement === walker) {
      const L = lane.getBoundingClientRect().left;
      sW = script.getBoundingClientRect().width;
      sMin = title.getBoundingClientRect().right - L + 16;
      sMax = side.getBoundingClientRect().left - L - 40;
    }
  };
  const ease = (p) => 0.5 - 0.5 * Math.cos(Math.PI * p);

  const render = (amp) => {
    const stride = ch * 0.085;               // distance per step
    const ph = (dist / stride) * Math.PI;    // one step per half cycle
    const s = Math.sin(ph), a = Math.abs(s);
    const bob = -a * ch * 0.011 * amp;
    const sway = s * 1.4 * amp;
    const breathe = 1 + Math.sin(idle / 520) * 0.006 * (1 - amp);
    walker.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    flip.style.transform = `scaleX(${face.toFixed(3)})`;
    body.style.transform = `translate3d(0,${bob.toFixed(2)}px,0) rotate(${sway.toFixed(2)}deg) scaleY(${breathe.toFixed(4)})`;
    const lift = ch * 0.012 * amp;
    legL.style.transform = `translate3d(0,${(-Math.max(0, s) * lift).toFixed(2)}px,0) rotate(${(s * 2.2 * amp).toFixed(2)}deg)`;
    legR.style.transform = `translate3d(0,${(-Math.max(0, -s) * lift).toFixed(2)}px,0) rotate(${(-s * 2.2 * amp).toFixed(2)}deg)`;
    shadow.style.transform = `translate3d(0,0,0) scale(${(1 - 0.1 * a * amp).toFixed(3)},${(1 - 0.18 * a * amp).toFixed(3)})`;
    if (script && script.parentElement === walker) {
      // Prefer the right of the head; when that would hit the side column, use
      // the left of the head; hide if neither fits. Swap sides only while hidden.
      const offR = cw * 0.9, offL = cw * 0.06 - sW;
      const fits = (o) => x + o > sMin && x + o + sW < sMax;
      const pick = fits(offR) ? "R" : fits(offL) ? "L" : "";
      let want = pick && pick === sSide ? 1 : 0;
      if (pick && pick !== sSide && sOp < 0.04) { sSide = pick; }
      script.style.left = (sSide === "L" ? offL : offR).toFixed(1) + "px";
      sOp += (want - sOp) * (mode === "still" ? 1 : 0.1);
      script.style.opacity = sOp.toFixed(3);
    }
    shadow.style.opacity = (0.95 - 0.3 * a * amp).toFixed(3);
  };

  const tick = (now) => {
    raf = 0;
    const dt = Math.min(50, now - (last || now)); last = now;
    idle += dt;
    const speed = ch * 0.16; // px per second
    if (hovered) {
      settle = Math.max(0, settle - dt / 250);
    } else if (mode === "walk") {
      settle = Math.min(1, settle + dt / 250);
      const step = speed * dt / 1000 * settle;
      x += dir * step; dist += step;
      if ((dir > 0 && x >= maxX) || (dir < 0 && x <= 0)) {
        x = dir > 0 ? maxX : 0; mode = "pause"; modeT = 0;
      }
    } else if (mode === "pause") {
      settle = Math.max(0, settle - dt / 200);
      modeT += dt; if (modeT >= PAUSE) { mode = "turn"; modeT = 0; }
    } else if (mode === "turn") {
      modeT += dt; const p = Math.min(1, modeT / TURN);
      face = dir * Math.cos(Math.PI * ease(p)); // 1 → -1 (or -1 → 1)
      if (Math.abs(face) < 0.04) face = face < 0 ? -0.04 : 0.04;
      if (p >= 1) { dir = -dir; face = dir; mode = "walk"; dist = 0; }
    }
    render(settle);
    if (visible && !mq.matches) raf = requestAnimationFrame(tick);
  };

  const start = () => { if (!raf && visible && !mq.matches) { last = 0; raf = requestAnimationFrame(tick); } };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
  const still = () => { stop(); placeScript(); measure(); mode = "still"; sOp = 0; x = maxX * 0.42; face = 1; dir = 1; settle = 0; dist = 0; render(0); render(0); };

  walker.addEventListener("mouseenter", () => (hovered = true));
  walker.addEventListener("mouseleave", () => (hovered = false));
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; visible ? start() : stop(); }).observe(lane);
  const refresh = () => { placeScript(); measure(); if (mq.matches) still(); else render(settle); };
  window.addEventListener("resize", refresh);
  window.addEventListener("load", refresh);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  const onPref = () => { if (mq.matches) still(); else { mode = "walk"; start(); } };
  mq.addEventListener ? mq.addEventListener("change", onPref) : mq.addListener(onPref);

  placeScript();
  measure();
  x = maxX * 0.42;
  if (mq.matches) still(); else { render(0); start(); }
})();
