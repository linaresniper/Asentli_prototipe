import * as THREE from 'three';
import { SECTIONS, PRODUCTS } from '../config/products.js';
import { C, BRAND, money, drawLogo } from '../config/brand.js';
import { canvasTexture, createPanel, fillRR, text, rr, checkMark, F } from '../ui/canvas.js';
import { buildProduct, mat } from './productMeshes.js';
import { bakeStatic } from '../core/merge.js';

// Supermercado: piso, muros, iluminación, 6 secciones en 3 pasillos y productos.
export const STORE = {
  minX: -7.7, maxX: 7.7, minZ: -7.7, maxZ: 11.4,
  start: { x: 0, z: 10.2, yaw: 0 },
  cartStart: { x: 0, z: 9.2 },
};

const L = 6;          // largo de cada módulo de estante
const ZC = -2;        // centro de los pasillos en Z (de -5 a 1)

const FACES = [
  { section: 'granos', x: -6.0, dir: 1, depth: 0.48 },
  { section: 'pan', x: -2.5, dir: -1, depth: 0.48 },
  { section: 'lacteos', x: -1.5, dir: 1, depth: 0.48 },
  { section: 'bebidas', x: 1.5, dir: -1, depth: 0.48 },
  { section: 'carnes', x: 2.5, dir: 1, depth: 0.5 },
  { section: 'frutas', x: 6.0, dir: -1, depth: 0.9 },
];

const AISLES = [
  { n: 1, x: -4.25, a: 'Granos y cereales', b: 'Pan y alimentos básicos' },
  { n: 2, x: 0, a: 'Lácteos', b: 'Bebidas y productos esenciales' },
  { n: 3, x: 4.25, a: 'Carnes', b: 'Frutas y verduras' },
];

function bx(group, w, h, d, material, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  group.add(m);
  return m;
}

function tagDraw(ctx, W, H, d) {
  const p = d.p;
  const inCart = d.inCart;
  fillRR(ctx, 0, 0, W, H, 5, inCart ? '#EAF6DD' : C.eggshell);
  ctx.fillStyle = inCart ? C.green : p.list ? C.orange : C.bottle;
  ctx.fillRect(0, 0, 9, H);
  text(ctx, p.name, 15, 15, { weight: 700, size: 10.5, color: C.bottle, maxWidth: W - 22 });
  text(ctx, p.detail, 15, 26, { weight: 500, size: 7.5, color: C.muted, maxWidth: 52 });
  text(ctx, money(p.price), W - 6, H - 7, { weight: 800, size: 15, color: C.bottle, align: 'right' });
  if (inCart) {
    fillRR(ctx, 14, H - 16, 40, 11, 5.5, C.green);
    checkMark(ctx, 15, H - 16.5, 11, '#fff', 1.8);
    text(ctx, 'En carrito', 26, H - 7.6, { weight: 700, size: 6, color: '#fff' });
  } else if (p.list) {
    fillRR(ctx, 14, H - 16, 36, 11, 5.5, C.orange);
    text(ctx, 'EN TU LISTA', 32, H - 8, { weight: 700, size: 5.6, color: '#fff', align: 'center' });
  }
}

function floorTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    const s = w / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const v = 228 + ((i + j) % 2) * 6 + Math.random() * 3;
      ctx.fillStyle = `rgb(${v},${v - 2},${v - 6})`;
      ctx.fillRect(i * s, j * s, s, s);
      for (let k = 0; k < 140; k++) {
        ctx.fillStyle = `rgba(120,110,100,${Math.random() * 0.06})`;
        ctx.fillRect(i * s + Math.random() * s, j * s + Math.random() * s, 3, 3);
      }
    }
    ctx.strokeStyle = 'rgba(150,140,130,0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(w, i * s); ctx.stroke();
    }
  }, { repeat: [16 / 1.2, 20 / 1.2] });
}

export function buildStore() {
  const root = new THREE.Group();
  root.name = 'store';
  const statics = new THREE.Group();
  root.add(statics);
  const dynamic = new THREE.Group();
  root.add(dynamic);
  const units = [];
  const tags = new Map();
  const obstacles = [];

  // ---------- Envolvente ----------
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 20),
    new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.32, metalness: 0.0 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 2);
  root.add(floor);

  const H = 3.4;
  const wallM = mat('#EFE7DD', { rough: 0.9 });
  const bandM = mat(C.bottle, { rough: 0.7 });
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(16, 20), mat('#F4F2EE', { rough: 0.95 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, H, 2);
  statics.add(ceil);
  bx(statics, 16, H, 0.1, wallM, 0, H / 2, -8.05);
  bx(statics, 0.1, H, 20, wallM, -8.05, H / 2, 2);
  bx(statics, 0.1, H, 20, wallM, 8.05, H / 2, 2);
  bx(statics, 6, H, 0.1, wallM, -5, H / 2, 12.05);
  bx(statics, 6, H, 0.1, wallM, 5, H / 2, 12.05);
  bx(statics, 4, H - 2.6, 0.1, wallM, 0, 2.6 + (H - 2.6) / 2, 12.05);
  // Zócalo y franja de marca
  bx(statics, 16, 0.12, 0.02, bandM, 0, 0.06, -7.99);
  bx(statics, 0.02, 0.12, 20, bandM, -7.99, 0.06, 2);
  bx(statics, 0.02, 0.12, 20, bandM, 7.99, 0.06, 2);
  bx(statics, 16, 0.35, 0.02, bandM, 0, 2.7, -7.99);
  bx(statics, 0.02, 0.35, 20, bandM, -7.99, 2.7, 2);
  bx(statics, 0.02, 0.35, 20, bandM, 7.99, 2.7, 2);

  // Luminarias de techo (emisivas)
  const lightM = new THREE.MeshBasicMaterial({ color: '#FFFFFF', toneMapped: false });
  for (const x of [-4.25, 0, 4.25]) for (let z = -7; z <= 10.5; z += 2.2) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 1.4), lightM);
    pl.rotation.x = Math.PI / 2;
    pl.position.set(x, H - 0.01, z);
    statics.add(pl);
  }

  // Entrada: exterior luminoso y puertas de vidrio
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.2), new THREE.MeshBasicMaterial({ color: '#E3F1F6', toneMapped: false }));
  outside.position.set(0, 1.5, 12.6);
  outside.rotation.y = Math.PI;
  root.add(outside);
  const glass = mat('#BFD9E0', { rough: 0.05, opacity: 0.22, key: 'glass' });
  for (const x of [-1, 1]) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 2.56), glass);
    g.position.set(x, 1.28, 12.02);
    g.rotation.y = Math.PI;
    root.add(g);
  }
  const frameM = mat('#9AA4A2', { rough: 0.3, metal: 0.8 });
  for (const x of [-2, 0, 2]) bx(statics, 0.06, 2.6, 0.08, frameM, x, 1.3, 12.0);
  bx(statics, 4.06, 0.08, 0.08, frameM, 0, 2.6, 12.0);
  // Tapete de entrada
  const mattex = canvasTexture(1024, 384, (ctx, w, h) => {
    ctx.fillStyle = '#2A332F'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = C.orange; ctx.lineWidth = 10; ctx.strokeRect(24, 24, w - 48, h - 48);
    text(ctx, 'BIENVENIDO', w / 2, h / 2 + 30, { weight: 800, size: 110, color: C.eggshell, align: 'center' });
  });
  const mat3 = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.97), new THREE.MeshStandardMaterial({ map: mattex, roughness: 1 }));
  mat3.rotation.x = -Math.PI / 2;
  mat3.position.set(0, 0.004, 11.2);
  root.add(mat3);

  // Letrero principal sobre la pared del fondo
  const backSign = createPanel({
    width: 5.2, height: 0.9, ppm: 300, transparent: false,
    draw(ctx, W, Hh) {
      fillRR(ctx, 0, 0, W, Hh, 60, C.bottle);
      text(ctx, BRAND.store, W / 2, Hh * 0.55, { weight: 800, size: 380, color: C.eggshell, align: 'center', baseline: 'middle' });
      ctx.fillStyle = C.orange; ctx.fillRect(W * 0.3, Hh * 0.82, W * 0.4, 30);
    },
  });
  backSign.position.set(0, 2.55, -7.97);
  root.add(backSign);

  // Aviso de precios demostrativos junto a la entrada
  const notice = createPanel({
    width: 1.1, height: 0.72, ppm: 700, transparent: true,
    draw(ctx, W, Hh) {
      fillRR(ctx, 0, 0, W, Hh, 40, C.eggshell);
      ctx.fillStyle = C.bottle; rr(ctx, 0, 0, W, 170, 40); ctx.fill(); ctx.fillRect(0, 120, W, 50);
      text(ctx, BRAND.store, W / 2, 105, { weight: 800, size: 72, color: C.eggshell, align: 'center' });
      text(ctx, 'Demostración AsentliCard', W / 2, 270, { weight: 700, size: 62, color: C.orange, align: 'center' });
      text(ctx, 'Precios demostrativos —', W / 2, 400, { weight: 600, size: 56, color: C.bottle, align: 'center' });
      text(ctx, 'no son precios reales', W / 2, 470, { weight: 600, size: 56, color: C.bottle, align: 'center' });
      drawLogo(ctx, W / 2, 560, 100, { align: 'center' });
    },
  });
  notice.position.set(2.2, 1.55, 9.4);
  notice.rotation.y = -0.55;
  root.add(notice);
  bx(statics, 0.04, 1.2, 0.04, frameM, 2.2, 0.6, 9.38);

  // ---------- Pasillos ----------
  const sectionById = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));
  const metal = mat('#DCD6CD', { rough: 0.45, metal: 0.3 });
  const sideM = mat('#CBC3B8', { rough: 0.5, metal: 0.3 });
  const backM = mat('#ECE6DD', { rough: 0.8 });
  const darkM = mat('#26302C', { rough: 0.6 });
  const ledM = new THREE.MeshBasicMaterial({ color: '#F2FAFF', toneMapped: false });
  const woodM = mat('#B07A45', { rough: 0.85 });

  for (const face of FACES) {
    const section = sectionById[face.section];
    const D = face.depth;
    const fg = new THREE.Group();
    fg.position.set(face.x, 0, ZC);
    fg.rotation.y = face.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    root.add(fg);
    const fs = new THREE.Group(); // parte estática
    fg.add(fs);

    let levels, interactiveLevel;
    if (section.style === 'shelf') {
      levels = [0.12, 0.54, 0.96, 1.38];
      interactiveLevel = 2;
      bx(fs, L, 1.9, 0.02, backM, 0, 0.95, -D);
      for (const lv of levels) {
        bx(fs, L - 0.04, 0.025, D, metal, 0, lv, -D / 2);
        bx(fs, L - 0.04, 0.035, 0.012, bandM, 0, lv - 0.005, 0.006);
      }
      for (const s of [-1, 1]) bx(fs, 0.035, 1.95, D + 0.02, sideM, s * L / 2, 0.975, -D / 2);
      bx(fs, L, 0.1, 0.02, bandM, 0, 0.05, 0);
      bx(fs, L, 0.34, 0.05, bandM, 0, 2.08, -D + 0.04);
    } else if (section.style === 'fridge') {
      levels = [0.36, 0.76, 1.14, 1.52];
      interactiveLevel = 2;
      bx(fs, L, 1.65, 0.02, darkM, 0, 1.15, -D);
      bx(fs, L, 0.36, D, bandM, 0, 0.18, -D / 2);
      for (const lv of levels.slice(1)) {
        bx(fs, L - 0.06, 0.02, D - 0.03, mat('#F4F6F6', { rough: 0.25, metal: 0.2 }), 0, lv, -D / 2 - 0.015);
        bx(fs, L - 0.06, 0.035, 0.012, bandM, 0, lv - 0.005, 0.0);
        bx(fs, L - 0.08, 0.006, 0.012, ledM, 0, lv - 0.028, -0.02);
      }
      bx(fs, L - 0.08, 0.006, 0.012, ledM, 0, 1.86, -0.04);
      for (const s of [-1, 1]) bx(fs, 0.05, 1.98, D + 0.04, darkM, s * L / 2, 0.99, -D / 2);
      bx(fs, L, 0.14, D + 0.06, bandM, 0, 1.97, -D / 2 + 0.02);
      bx(fs, L, 0.34, 0.05, bandM, 0, 2.2, -D + 0.04);
    } else {
      levels = [0.68, 1.0];
      interactiveLevel = 0;
      bx(fs, L, 0.62, D, bandM, 0, 0.31, -D / 2);
      bx(fs, L, 1.6, 0.03, mat('#3C6B3F', { rough: 0.9 }), 0, 1.4, -D);
      bx(fs, L, 0.34, 0.05, bandM, 0, 2.08, -D + 0.04);
    }

    // Cabecera con nombre de la sección
    const header = createPanel({
      width: L * 0.62, height: 0.3, ppm: 400, transparent: false,
      draw(ctx, W, Hh) {
        ctx.fillStyle = C.bottle; ctx.fillRect(0, 0, W, Hh);
        ctx.fillStyle = C.orange; ctx.fillRect(0, Hh - 22, W, 22);
        text(ctx, section.name.toUpperCase(), W / 2, Hh * 0.6, { weight: 800, size: 150, color: C.eggshell, align: 'center', baseline: 'middle', maxWidth: W * 0.92 });
      },
    });
    header.position.set(0, section.style === 'fridge' ? 2.2 : 2.08, -D + 0.068);
    fg.add(header);

    // Productos
    const prods = PRODUCTS.filter((p) => p.section === face.section);
    const bayL = L / prods.length;
    prods.forEach((p, i) => {
      const bxc = -L / 2 + bayL * (i + 0.5);
      const template = buildProduct(p);
      const size = template.userData.size;

      if (section.style === 'crates') {
        // Cajón frontal inclinado (interactivo) y cajón trasero (relleno)
        const mkCrate = (y, z, tilt, depthC) => {
          const cg = new THREE.Group();
          cg.position.set(bxc, y, z);
          cg.rotation.x = tilt;
          const w = bayL - 0.06;
          bx(cg, w, 0.015, depthC, woodM, 0, 0, 0);
          bx(cg, w, 0.1, 0.015, woodM, 0, 0.05, depthC / 2);
          bx(cg, w, 0.14, 0.015, woodM, 0, 0.07, -depthC / 2);
          for (const s of [-1, 1]) bx(cg, 0.015, 0.12, depthC, woodM, s * w / 2, 0.06, 0);
          return cg;
        };
        const front = mkCrate(levels[0], -0.2, 0.2, 0.36);
        const back = mkCrate(levels[1], -0.62, 0.32, 0.4);
        fs.add(front.clone()); // estructura estática
        fs.add(back);
        const holder = new THREE.Group();
        holder.position.copy(front.position);
        holder.rotation.copy(front.rotation);
        fg.add(holder);
        const n = Math.max(1, Math.min(3, Math.floor((bayL - 0.1) / (size.x + 0.03))));
        for (let k = 0; k < n; k++) {
          const x = (k - (n - 1) / 2) * (size.x + 0.03);
          units.push(makeUnit(p, holder, new THREE.Vector3(x, 0.008, 0.02 - (k % 2) * 0.04), (k - 1) * 0.15));
        }
        const m = Math.max(1, Math.floor((bayL - 0.1) / (size.x + 0.01)));
        for (let k = 0; k < m; k++) for (const z of [-0.09, 0.08]) {
          const c = template.clone();
          c.position.set((k - (m - 1) / 2) * (size.x + 0.01), 0.008 + (z > 0 ? 0 : 0.01), z);
          c.rotation.y = (k * 1.7) % 0.6 - 0.3;
          back.add(c);
        }
        const tag = makeTag(p);
        tag.position.set(bxc, levels[0] + 0.02, 0.012);
        tag.rotation.x = -0.15;
        fg.add(tag);
        tags.set(p.id, tag);
        return;
      }

      const lvI = levels[interactiveLevel];
      const zFront = -0.06 - size.z / 2;
      const gap = 0.035;
      const n = Math.max(1, Math.min(3, Math.floor((bayL - 0.12) / (size.x + gap))));
      for (let k = 0; k < n; k++) {
        const x = bxc + (k - (n - 1) / 2) * (size.x + gap);
        units.push(makeUnit(p, fg, new THREE.Vector3(x, lvI + 0.0125, zFront), 0));
      }
      // Relleno estático en los demás niveles
      levels.forEach((lv, li) => {
        if (li === interactiveLevel) return;
        if (section.style === 'fridge' && li === 0) return;
        const m = Math.max(1, Math.floor((bayL - 0.08) / (size.x + 0.012)));
        const rows = (D - 0.08) > size.z * 2 + 0.05 ? 2 : 1;
        for (let r = 0; r < rows; r++) for (let k = 0; k < m; k++) {
          const c = template.clone();
          c.position.set(bxc + (k - (m - 1) / 2) * (size.x + 0.012), lv + 0.0125, zFront - r * (size.z + 0.015));
          fs.add(c);
        }
      });
      // Detrás de los productos interactivos, fila de relleno para que el estante se vea lleno
      const m2 = Math.max(1, Math.floor((bayL - 0.08) / (size.x + 0.012)));
      if ((D - 0.08) > size.z * 2 + 0.05) {
        for (let k = 0; k < m2; k++) {
          const c = template.clone();
          c.position.set(bxc + (k - (m2 - 1) / 2) * (size.x + 0.012), lvI + 0.0125, zFront - size.z - 0.03);
          fs.add(c);
        }
      }
      const tag = makeTag(p);
      tag.position.set(bxc, lvI - 0.005, section.style === 'fridge' ? 0.008 : 0.014);
      fg.add(tag);
      tags.set(p.id, tag);
    });

    bakeStatic(fs);
  }

  // Divisores entre estantes dobles
  bx(statics, 0.06, 1.9, L, sideM, -2.0, 0.95, ZC);
  bx(statics, 0.06, 1.9, L, sideM, 2.0, 0.95, ZC);

  // Letreros colgantes de pasillo
  const cableM = mat('#777', { rough: 0.5, metal: 0.6 });
  for (const a of AISLES) {
    const draw = (ctx, W, Hh) => {
      fillRR(ctx, 0, 0, W, Hh, 40, C.bottle);
      fillRR(ctx, 30, 30, 300, Hh - 60, 30, C.orange);
      text(ctx, 'PASILLO', 180, 150, { weight: 700, size: 58, color: C.eggshell, align: 'center' });
      text(ctx, String(a.n), 180, 330, { weight: 800, size: 190, color: '#fff', align: 'center' });
      text(ctx, a.a, 380, 165, { weight: 700, size: 92, color: C.eggshell, maxWidth: W - 420 });
      text(ctx, a.b, 380, 300, { weight: 700, size: 92, color: C.eggshell, maxWidth: W - 420 });
      ctx.fillStyle = C.green; ctx.fillRect(380, 195, 120, 10);
    };
    for (const side of [1, -1]) {
      const s = createPanel({ width: 1.9, height: 0.42, ppm: 520, transparent: false, draw });
      s.position.set(a.x, 2.75, 1.3 + side * 0.012);
      if (side < 0) s.rotation.y = Math.PI;
      root.add(s);
    }
    for (const dx of [-0.8, 0.8]) bx(statics, 0.01, 0.45, 0.01, cableM, a.x + dx, 3.17, 1.3);
  }

  bakeStatic(statics);

  // Obstáculos (AABB en mundo) para caminar y teletransportarse
  const ob = (x0, x1, z0, z1) => obstacles.push(new THREE.Box3(new THREE.Vector3(x0, 0, z0), new THREE.Vector3(x1, 2.2, z1)));
  ob(-6.55, -5.92, -5.1, 1.1);
  ob(-2.58, -1.42, -5.1, 1.1);
  ob(1.42, 2.58, -5.1, 1.1);
  ob(5.08, 6.95, -5.1, 1.1);
  ob(1.95, 2.45, 9.1, 9.7); // aviso de precios

  return { root, units, tags, obstacles, floor };
}

// ---------- Unidades interactivas ----------
const proxyMat = new THREE.MeshBasicMaterial({ visible: false });

function makeUnit(p, parent, pos, yaw) {
  const mesh = buildProduct(p);
  mesh.position.copy(pos);
  mesh.rotation.y = yaw;
  parent.add(mesh);
  const s = mesh.userData.size;
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(s.x * 1.15 + 0.03, s.y * 1.1 + 0.03, s.z * 1.15 + 0.03), proxyMat);
  proxy.position.y = s.y / 2;
  proxy.userData.noBake = true;
  mesh.add(proxy);
  const unit = {
    kind: 'product',
    product: p,
    mesh,
    proxy,
    home: { parent, position: mesh.position.clone(), quaternion: mesh.quaternion.clone(), scale: mesh.scale.clone() },
    state: 'shelf', // shelf | held | moving | cart | gone
    hover: 0,
  };
  proxy.userData.target = unit;
  return unit;
}

function makeTag(p) {
  return createPanel({ width: 0.105, height: 0.05, ppm: 2600, transparent: false, draw: tagDraw, data: { p, inCart: false } });
}

