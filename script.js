// ===================== Scroll-reveal =====================
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

// ===================== Nav =====================
const nav = document.getElementById("navbar");
window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > 10);
}, { passive: true });

const toggle = document.querySelector(".nav-toggle");
const links = document.querySelector(".nav-links");
toggle.addEventListener("click", () => {
  const open = links.classList.toggle("open");
  toggle.classList.toggle("open", open);
  toggle.setAttribute("aria-expanded", open);
});
links.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    links.classList.remove("open");
    toggle.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  })
);

// ===================== Theme switcher =====================
const themeBtn = document.querySelector(".theme-btn");
const themeMenu = document.querySelector(".theme-menu");

function markActiveTheme() {
  const current = document.documentElement.dataset.theme || "midnight";
  themeMenu.querySelectorAll("button").forEach((b) =>
    b.classList.toggle("active", b.dataset.themeChoice === current)
  );
}
markActiveTheme();

themeBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const open = themeMenu.classList.toggle("open");
  themeBtn.setAttribute("aria-expanded", open);
});
document.addEventListener("click", () => {
  themeMenu.classList.remove("open");
  themeBtn.setAttribute("aria-expanded", "false");
});

themeMenu.querySelectorAll("button").forEach((btn) =>
  btn.addEventListener("click", () => {
    const theme = btn.dataset.themeChoice;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
    markActiveTheme();
    refreshGraphColors();
  })
);

// ===================== Knowledge-graph background =====================
// A drifting graph of nodes and edges; hub nodes carry labels from
// Visakh's actual stack, and "retrieval pulses" travel along edges.
const canvas = document.getElementById("bg-canvas");
const ctx = canvas.getContext("2d");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const LABELS = [
  "RAG", "LangGraph", "BM25", "pgvector", "Sentence-BERT",
  "Knowledge Graphs", "LLM-as-judge", "Hybrid Search", "Tool Calling",
  "Context Engineering", "Redis Streams", "LangChain"
];
const LINK_DIST = 150;

let nodes = [];
let pulses = [];
let mouse = { x: -9999, y: -9999 };
let particleColor = "#60a5fa";
let accent2Color = "#34d399";
let linkAlpha = 0.16;
let W = 0, H = 0, dpr = 1;
let rafId = null;

function refreshGraphColors() {
  const cs = getComputedStyle(document.documentElement);
  particleColor = cs.getPropertyValue("--particle").trim() || "#60a5fa";
  accent2Color = cs.getPropertyValue("--accent-2").trim() || "#34d399";
  linkAlpha = parseFloat(cs.getPropertyValue("--link-alpha")) || 0.16;
  if (reducedMotion) drawFrame(true);
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function buildNodes() {
  const count = Math.min(90, Math.floor((W * H) / 18000));
  nodes = [];
  for (let i = 0; i < count; i++) {
    const isHub = i < LABELS.length;
    nodes.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: isHub ? 2.6 + Math.random() : 1.2 + Math.random() * 1.2,
      label: isHub ? LABELS[i] : null,
    });
  }
  pulses = [];
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  buildNodes();
  if (reducedMotion) drawFrame(true);
}

function spawnPulse() {
  if (pulses.length >= 5) return;
  const a = nodes[Math.floor(Math.random() * nodes.length)];
  const neighbors = nodes.filter((b) => {
    if (b === a) return false;
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy < LINK_DIST * LINK_DIST;
  });
  if (!neighbors.length) return;
  const b = neighbors[Math.floor(Math.random() * neighbors.length)];
  pulses.push({ a, b, t: 0 });
}

function drawFrame(staticFrame) {
  ctx.clearRect(0, 0, W, H);

  if (!staticFrame) {
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
      if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20;
    }
  }

  // Edges
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < nodes.length; j++) {
      const b = nodes[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < LINK_DIST * LINK_DIST) {
        const d = Math.sqrt(d2);
        ctx.strokeStyle = rgba(particleColor, (1 - d / LINK_DIST) * linkAlpha);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    // Cursor links: the graph reaches toward the reader
    const mdx = a.x - mouse.x, mdy = a.y - mouse.y;
    const md2 = mdx * mdx + mdy * mdy;
    if (md2 < 180 * 180) {
      const md = Math.sqrt(md2);
      ctx.strokeStyle = rgba(particleColor, (1 - md / 180) * 0.3);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(mouse.x, mouse.y);
      ctx.stroke();
    }
  }

  // Nodes + labels
  ctx.font = "10.5px 'JetBrains Mono', monospace";
  for (const n of nodes) {
    ctx.fillStyle = rgba(particleColor, n.label ? 0.65 : 0.45);
    ctx.beginPath();
    ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fill();
    if (n.label) {
      ctx.fillStyle = rgba(particleColor, 0.34);
      ctx.fillText(n.label, n.x + 8, n.y - 7);
    }
  }

  // Retrieval pulses traveling along edges
  if (!staticFrame) {
    if (Math.random() < 0.02) spawnPulse();
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.t += 0.016;
      if (p.t >= 1) { pulses.splice(i, 1); continue; }
      const x = p.a.x + (p.b.x - p.a.x) * p.t;
      const y = p.a.y + (p.b.y - p.a.y) * p.t;
      const fade = Math.sin(p.t * Math.PI);
      ctx.fillStyle = rgba(accent2Color, 0.85 * fade);
      ctx.shadowColor = rgba(accent2Color, 0.9);
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}

function loop() {
  drawFrame(false);
  rafId = requestAnimationFrame(loop);
}

window.addEventListener("resize", resize);
window.addEventListener("mousemove", (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
window.addEventListener("mouseout", () => { mouse.x = -9999; mouse.y = -9999; });
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  } else if (!reducedMotion && !rafId) {
    loop();
  }
});

resize();
refreshGraphColors();
if (!reducedMotion) loop();
