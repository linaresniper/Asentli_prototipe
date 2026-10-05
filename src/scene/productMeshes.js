import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { canvasTexture, F, rr, text } from '../ui/canvas.js';
import { C } from '../config/brand.js';
import { mergeChildrenByMaterial } from '../core/merge.js';

// Modelos procedurales de productos (en metros). Frente del producto = +Z local.

const matCache = new Map();
export function mat(color, { rough = 0.6, metal = 0, opacity = 1, map = null, key = '', emissive = null, side = THREE.FrontSide } = {}) {
  const k = `${color}|${rough}|${metal}|${opacity}|${key}|${emissive}|${side}`;
  if (matCache.has(k)) return matCache.get(k);
  const m = new THREE.MeshStandardMaterial({
    color, roughness: rough, metalness: metal, map,
    transparent: opacity < 1, opacity, depthWrite: opacity >= 0.6, side,
  });
  if (emissive) { m.emissive = new THREE.Color(emissive); m.emissiveIntensity = 1; }
  matCache.set(k, m);
  return m;
}

const texCache = new Map();
function cachedTex(key, make) {
  if (!texCache.has(key)) texCache.set(key, make());
  return texCache.get(key);
}

function storeBrand(ctx, x, y, size, color) {
  ctx.font = F(700, size);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('La Canasta', x, y);
}

// Etiqueta vertical (frente de bolsas y cajas).
function portraitLabel(p) {
  return cachedTex('portrait:' + p.id, () => canvasTexture(400, 640, (ctx, w, h) => {
    ctx.fillStyle = p.color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = p.accent;
    ctx.fillRect(0, 0, w, h * 0.2);
    ctx.fillRect(0, h * 0.94, w, h * 0.06);
    storeBrand(ctx, w / 2, h * 0.1, 46, C.eggshell);
    // Ilustración simple
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.7, w * 0.3, h * 0.13, 0, 0, Math.PI * 2);
    ctx.fillStyle = p.accent;
    ctx.globalAlpha = 0.18;
    ctx.fill();
    ctx.globalAlpha = 1;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2, r = (i % 3) * 0.3 + 0.35;
      ctx.beginPath();
      ctx.ellipse(w / 2 + Math.cos(a) * w * 0.2 * r, h * 0.7 + Math.sin(a) * h * 0.08 * r, 14, 9, a, 0, Math.PI * 2);
      ctx.fillStyle = p.accent;
      ctx.fill();
    }
    text(ctx, p.name.toUpperCase(), w / 2, h * 0.38, { weight: 800, size: 84, color: p.ink, align: 'center', baseline: 'middle', maxWidth: w * 0.88 });
    text(ctx, p.detail, w / 2, h * 0.49, { weight: 600, size: 40, color: p.ink, align: 'center', baseline: 'middle', maxWidth: w * 0.85 });
  }));
}

// Etiqueta envolvente para cilindros (frente centrado en u = 0.5).
function wideLabel(p) {
  return cachedTex('wide:' + p.id, () => canvasTexture(1024, 320, (ctx, w, h) => {
    ctx.fillStyle = p.liquid ? '#FFFFFF' : p.color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = p.accent;
    ctx.fillRect(0, 0, w, h * 0.16);
    ctx.fillRect(0, h * 0.84, w, h * 0.16);
    const ink = p.liquid ? p.accent : p.ink;
    storeBrand(ctx, w / 2, h * 0.08, 30, p.liquid ? '#FFFFFF' : C.eggshell);
    text(ctx, p.name.toUpperCase(), w / 2, h * 0.47, { weight: 800, size: 96, color: ink, align: 'center', baseline: 'middle', maxWidth: w * 0.42 });
    text(ctx, p.detail, w / 2, h * 0.71, { weight: 600, size: 44, color: ink, align: 'center', baseline: 'middle', maxWidth: w * 0.4 });
  }));
}

// Etiqueta horizontal tipo sticker (bandejas, quesos, pan).
function stickerLabel(p) {
  return cachedTex('sticker:' + p.id, () => canvasTexture(512, 220, (ctx, w, h) => {
    rr(ctx, 4, 4, w - 8, h - 8, 26);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    rr(ctx, 4, 4, w * 0.12, h - 8, 26);
    ctx.fillStyle = p.accent;
    ctx.fill();
    ctx.fillRect(w * 0.08, 4, w * 0.05, h - 8);
    text(ctx, p.name.toUpperCase(), w * 0.57, h * 0.42, { weight: 800, size: 74, color: p.ink, align: 'center', baseline: 'middle', maxWidth: w * 0.78 });
    text(ctx, p.detail + ' · La Canasta', w * 0.57, h * 0.74, { weight: 600, size: 34, color: '#555', align: 'center', baseline: 'middle', maxWidth: w * 0.78 });
  }));
}

const box = (w, h, d, r = 0.008, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, r);

function add(group, geo, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.scale.set(sx, sy, sz);
  group.add(m);
  return m;
}

function sticker(group, p, w, h, x, y, z, rx = 0) {
  return add(group, new THREE.PlaneGeometry(w, h), mat('#fff', { map: stickerLabel(p), key: 'stk' + p.id, rough: 0.5 }), x, y, z, rx);
}

const SHAPES = {
  bag(p, g) {
    const [w, h, d] = p.dims;
    const side = mat(p.color, { rough: 0.55 });
    const front = mat('#fff', { map: portraitLabel(p), key: 'pl' + p.id, rough: 0.5 });
    add(g, box(w, h, d, 0.012, 3), [side, side, side, side, front, side], 0, h / 2, 0);
    add(g, new THREE.BoxGeometry(w * 0.97, 0.016, d * 0.35), mat(p.accent, { rough: 0.5 }), 0, h + 0.006, 0);
  },

  carton(p, g) {
    const w = 0.075, h = 0.19, d = 0.075;
    const side = mat(p.color, { rough: 0.45 });
    const front = mat('#fff', { map: portraitLabel(p), key: 'pl' + p.id, rough: 0.45 });
    add(g, new THREE.BoxGeometry(w, h, d), [side, side, side, side, front, front], 0, h / 2, 0);
    add(g, new THREE.BoxGeometry(0.053, 0.053, d * 0.995), side, 0, h, 0, 0, 0, Math.PI / 4);
    add(g, new THREE.CylinderGeometry(0.011, 0.011, 0.012, 16), mat(p.accent, { rough: 0.4 }), 0.016, h + 0.021, 0, 0, 0, -Math.PI / 4);
  },

  bottle(p, g) {
    const r = p.id === 'agua' ? 0.046 : 0.04, hb = p.id === 'agua' ? 0.24 : 0.2;
    const liquid = mat(p.color, { rough: 0.08, opacity: p.id === 'agua' ? 0.45 : 0.85, key: 'liq' });
    add(g, new THREE.CylinderGeometry(r, r, hb, 28), liquid, 0, hb / 2, 0);
    add(g, new THREE.CylinderGeometry(0.018, r, 0.045, 28), liquid, 0, hb + 0.0225, 0);
    add(g, new THREE.CylinderGeometry(0.016, 0.016, 0.02, 16), liquid, 0, hb + 0.055, 0);
    add(g, new THREE.CylinderGeometry(0.019, 0.019, 0.022, 20), mat(p.accent, { rough: 0.35 }), 0, hb + 0.075, 0);
    add(g, new THREE.CylinderGeometry(r + 0.0012, r + 0.0012, hb * 0.45, 40, 1, true, -Math.PI, Math.PI * 2),
      mat('#fff', { map: wideLabel(p), key: 'wl' + p.id, rough: 0.4 }), 0, hb * 0.5, 0);
  },

  canister(p, g) {
    const lbl = mat('#fff', { map: wideLabel(p), key: 'wl' + p.id, rough: 0.45 });
    const white = mat('#F4F4F4', { rough: 0.4 });
    add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.14, 32, 1, false, -Math.PI, Math.PI * 2), [lbl, white, white], 0, 0.07, 0);
    add(g, new THREE.BoxGeometry(0.025, 0.008, 0.03), mat(C.eggshell, { rough: 0.4 }), 0.015, 0.144, 0);
  },

  eggs(p, g) {
    const pulp = mat('#D9CDBA', { rough: 0.95 });
    const egg = mat('#E9C9A2', { rough: 0.55 });
    add(g, box(0.27, 0.055, 0.11, 0.008), pulp, 0, 0.0275, 0);
    const sph = new THREE.SphereGeometry(0.021, 14, 10);
    for (let i = 0; i < 6; i++) for (const z of [-0.026, 0.026]) add(g, sph, egg, -0.11 + i * 0.044, 0.068, z, 0, 0, 0, 1, 1.28, 1);
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.058, -0.055);
    pivot.rotation.x = 1.2;
    g.add(pivot);
    add(pivot, new THREE.BoxGeometry(0.27, 0.01, 0.11), pulp, 0, 0, -0.055);
    add(pivot, new THREE.PlaneGeometry(0.24, 0.09), mat('#fff', { map: stickerLabel(p), key: 'stk' + p.id }), 0, 0.0055, -0.055, -Math.PI / 2);
  },

  loaf(p, g) {
    const crust = mat('#C98A43', { rough: 0.85 });
    add(g, box(0.25, 0.11, 0.12, 0.045, 4), crust, 0, 0.055, 0);
    const slash = new THREE.BoxGeometry(0.012, 0.01, 0.1);
    for (let i = -1; i <= 1; i++) add(g, slash, mat('#8C5523', { rough: 0.9 }), i * 0.06, 0.108, 0, 0, 0.5);
    add(g, box(0.27, 0.13, 0.136, 0.03), mat('#FFFFFF', { rough: 0.15, opacity: 0.18, key: 'bag' }), 0, 0.065, 0).userData.keep = true;
    add(g, new THREE.BoxGeometry(0.02, 0.03, 0.03), mat(C.orange, { rough: 0.5 }), 0.145, 0.065, 0);
    sticker(g, p, 0.12, 0.052, 0, 0.07, 0.0695);
  },

  tortillas(p, g) {
    add(g, new THREE.CylinderGeometry(0.085, 0.085, 0.045, 36), mat('#E9D7A8', { rough: 0.9 }), 0, 0.0225, 0);
    add(g, new THREE.CylinderGeometry(0.0865, 0.0865, 0.032, 40, 1, true, -Math.PI, Math.PI * 2),
      mat('#fff', { map: wideLabel(p), key: 'wl' + p.id, rough: 0.8 }), 0, 0.0225, 0);
  },

  cheese(p, g) {
    add(g, box(0.13, 0.065, 0.09, 0.014, 3), mat(p.color, { rough: 0.55 }), 0, 0.0325, 0);
    sticker(g, p, 0.1, 0.043, 0, 0.033, 0.0455);
  },

  yogurt(p, g) {
    const lbl = mat('#fff', { map: wideLabel(p), key: 'wl' + p.id, rough: 0.4 });
    add(g, new THREE.CylinderGeometry(0.05, 0.042, 0.11, 32, 1, false, -Math.PI, Math.PI * 2),
      [lbl, mat(p.accent, { rough: 0.3, metal: 0.4 }), mat('#fff')], 0, 0.055, 0);
  },

  soap(p, g) {
    const c = mat(p.color, { rough: 0.5 });
    add(g, box(0.09, 0.055, 0.06, 0.008), [c, c, c, c, mat('#fff', { map: stickerLabel(p), key: 'stk' + p.id }), c], 0, 0.0275, 0);
  },

  paper(p, g) {
    const roll = new THREE.CylinderGeometry(0.055, 0.055, 0.11, 24);
    const white = mat('#FBFBFB', { rough: 0.95 });
    for (const x of [-0.056, 0.056]) for (const z of [-0.056, 0.056]) add(g, roll, white, x, 0.055, z);
    add(g, new THREE.BoxGeometry(0.226, 0.112, 0.226), mat('#FFFFFF', { rough: 0.15, opacity: 0.16, key: 'wrap' }), 0, 0.056, 0).userData.keep = true;
    sticker(g, p, 0.12, 0.05, 0, 0.06, 0.1145);
  },

  tray(p, g) {
    const trayC = p.meat === 'res' ? '#1F2421' : '#F5F5F0';
    add(g, box(0.22, 0.028, 0.16, 0.008), mat(trayC, { rough: 0.5 }), 0, 0.014, 0);
    if (p.meat === 'pollo') {
      const m = mat(p.color, { rough: 0.45 });
      const s = new THREE.SphereGeometry(0.05, 18, 12);
      add(g, s, m, -0.045, 0.036, 0, 0, 0.3, 0, 1.3, 0.5, 0.85);
      add(g, s, m, 0.05, 0.036, 0.012, 0, -0.4, 0, 1.2, 0.48, 0.8);
      add(g, s, mat('#E9B78F', { rough: 0.45 }), 0.0, 0.05, -0.03, 0, 0.1, 0, 0.9, 0.38, 0.6);
    } else {
      add(g, box(0.17, 0.028, 0.12, 0.012), mat(p.color, { rough: 0.5 }), 0, 0.038, 0);
      add(g, new THREE.BoxGeometry(0.15, 0.003, 0.012), mat('#F1E3DA', { rough: 0.6 }), 0, 0.0525, 0.02, 0, 0.3);
    }
    add(g, box(0.222, 0.05, 0.162, 0.008), mat('#FFFFFF', { rough: 0.05, opacity: 0.14, key: 'film' }), 0, 0.03, 0).userData.keep = true;
    sticker(g, p, 0.11, 0.04, 0, 0.03, 0.0825);
  },

  produce(p, g) {
    add(g, box(0.2, 0.035, 0.14, 0.006), mat('#C9A46B', { rough: 0.95 }), 0, 0.0175, 0);
    const spots = [[-0.055, -0.03], [0, -0.035], [0.055, -0.03], [-0.03, 0.035], [0.035, 0.035], [0.0, 0.0, 1]];
    spots.forEach(([x, z, top], i) => {
      const y0 = top ? 0.085 : 0.035;
      const kind = p.kind === 'frutas' ? ['manzana', 'naranja', 'mango'][i % 3] : p.kind;
      const r = 0.034;
      if (kind === 'tomate') {
        add(g, new THREE.SphereGeometry(r, 18, 14), mat('#D7261E', { rough: 0.3 }), x, y0 + r * 0.82, z, 0, 0, 0, 1, 0.82, 1);
        add(g, new THREE.CylinderGeometry(0.013, 0.006, 0.006, 5), mat('#3E7D25', { rough: 0.7 }), x, y0 + r * 1.64, z);
      } else if (kind === 'cebolla') {
        add(g, new THREE.SphereGeometry(r, 18, 14), mat('#C99A5B', { rough: 0.7 }), x, y0 + r * 1.02, z, 0, 0, 0, 1, 1.05, 1);
        add(g, new THREE.ConeGeometry(0.008, 0.02, 6), mat('#8A6232', { rough: 0.8 }), x, y0 + r * 2.1 + 0.006, z);
      } else if (kind === 'papa') {
        add(g, new THREE.SphereGeometry(r, 16, 12), mat('#B08550', { rough: 0.95 }), x, y0 + r * 0.78, z, 0, i * 1.3, 0.1 * i, 1.35, 0.78, 0.95);
      } else if (kind === 'manzana') {
        add(g, new THREE.SphereGeometry(r, 18, 14), mat('#C8202E', { rough: 0.35 }), x, y0 + r * 0.95, z, 0, 0, 0, 1, 0.95, 1);
        add(g, new THREE.CylinderGeometry(0.002, 0.002, 0.016, 5), mat('#4A2E14'), x, y0 + r * 1.95, z);
      } else if (kind === 'naranja') {
        add(g, new THREE.SphereGeometry(r * 1.05, 18, 14), mat('#F28C1C', { rough: 0.65 }), x, y0 + r * 1.05, z);
      } else {
        add(g, new THREE.SphereGeometry(r, 18, 14), mat('#F5B335', { rough: 0.45 }), x, y0 + r * 0.85, z, 0, i, 0, 1.25, 0.85, 0.9);
      }
    });
  },

  banana(p, g) {
    const R = 0.1;
    const geo = new THREE.TorusGeometry(R, 0.017, 8, 20, 1.15);
    geo.translate(-R, 0, 0);
    geo.rotateX(-Math.PI / 2);
    const yellow = mat('#F2D13A', { rough: 0.5 });
    [-0.36, -0.12, 0.12, 0.36].forEach((a, i) => {
      add(g, geo, yellow, 0, 0.02 + (i % 2) * 0.012, 0, 0, a + Math.PI * 0.62, 0.18);
    });
    add(g, new THREE.CylinderGeometry(0.012, 0.016, 0.04, 8), mat('#6C7A2A', { rough: 0.8 }), 0, 0.025, 0, 0, 0, Math.PI / 2);
  },
};

// Construye un producto con su base en y=0 y centrado en X/Z.
export function buildProduct(p) {
  const inner = new THREE.Group();
  (SHAPES[p.shape] || SHAPES.bag)(p, inner);
  mergeChildrenByMaterial(inner);
  const bb = new THREE.Box3().setFromObject(inner);
  const c = bb.getCenter(new THREE.Vector3());
  inner.position.set(-c.x, -bb.min.y, -c.z);
  const g = new THREE.Group();
  g.add(inner);
  const size = bb.getSize(new THREE.Vector3());
  g.userData.size = size;
  g.name = 'product:' + p.id;
  return g;
}
