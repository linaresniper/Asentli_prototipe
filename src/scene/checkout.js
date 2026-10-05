import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { C, BRAND, money, drawLogo, drawContactless, drawMark } from '../config/brand.js';
import { createPanel, canvasTexture, fillRR, text, checkMark, rr } from '../ui/canvas.js';
import { mat } from './productMeshes.js';
import { bakeStatic } from '../core/merge.js';

// Área de caja: mostrador, banda, escáner, pantalla, terminal POS, impresora y cajero.
export const CHECKOUT = {
  playerSpot: { x: -3.45, z: 5.9, yaw: 0.12 },
  cartPark: { x: -5.55, z: 6.05, yaw: Math.PI / 2 },
  zone: new THREE.Box3(new THREE.Vector3(-6.8, 0, 5.3), new THREE.Vector3(-2.4, 2, 7.6)),
  beltStart: new THREE.Vector3(-6.35, 0.94, 5.0),
  scanner: new THREE.Vector3(-4.25, 0.94, 5.0),
  bagging: new THREE.Vector3(-3.8, 0.95, 4.9),
};

function bx(g, w, h, d, m, x, y, z) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z);
  g.add(o);
  return o;
}

function counter(g, x0, x1, withBelt) {
  const len = x1 - x0, cx = (x0 + x1) / 2;
  bx(g, len, 0.88, 0.6, mat(C.bottle, { rough: 0.6 }), cx, 0.44, 5.0);
  bx(g, len + 0.02, 0.03, 0.62, mat('#C7CCCB', { rough: 0.25, metal: 0.8 }), cx, 0.895, 5.0);
  bx(g, len, 0.06, 0.02, mat(C.orange, { rough: 0.5 }), cx, 0.8, 5.305);
  if (withBelt) {
    bx(g, 2.0, 0.04, 0.03, mat('#9AA3A1', { rough: 0.3, metal: 0.8 }), -5.52, 0.93, 4.76);
    bx(g, 2.0, 0.04, 0.03, mat('#9AA3A1', { rough: 0.3, metal: 0.8 }), -5.52, 0.93, 5.24);
  }
}

export function buildCheckout() {
  const root = new THREE.Group();
  root.name = 'checkout';
  const statics = new THREE.Group();
  root.add(statics);

  counter(statics, -6.6, -2.9, true);
  counter(statics, 0.6, 3.6, false);

  // Banda transportadora con textura animada
  const beltTex = canvasTexture(64, 256, (ctx, w, h) => {
    ctx.fillStyle = '#1C211F'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2B3330';
    for (let y = 0; y < h; y += 32) ctx.fillRect(0, y, w, 6);
  }, { repeat: [1, 6] });
  beltTex.rotation = Math.PI / 2;
  beltTex.center.set(0.5, 0.5);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.02, 0.44), new THREE.MeshStandardMaterial({ map: beltTex, roughness: 0.85 }));
  belt.position.set(-5.52, 0.92, 5.0);
  root.add(belt);

  // Escáner (vidrio + torre)
  bx(statics, 0.34, 0.012, 0.34, mat('#151A18', { rough: 0.1, metal: 0.5 }), -4.25, 0.916, 5.0);
  bx(statics, 0.36, 0.26, 0.06, mat('#2A3230', { rough: 0.4 }), -4.25, 1.04, 4.79);
  const laserM = new THREE.MeshBasicMaterial({ color: '#FF2A1A', transparent: true, opacity: 0.25, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false });
  const laser = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.2), laserM);
  laser.position.set(-4.25, 1.04, 4.822);
  root.add(laser);
  const laserGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), laserM.clone());
  laserGlass.rotation.x = -Math.PI / 2;
  laserGlass.position.set(-4.25, 0.923, 5.0);
  root.add(laserGlass);

  // Bolsas de la tienda (se llenan durante el registro)
  const bagTex = canvasTexture(256, 300, (ctx, w, h) => {
    ctx.fillStyle = '#E9DCC5'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = C.bottle; ctx.fillRect(0, h * 0.7, w, h * 0.3);
    text(ctx, 'La Canasta', w / 2, h * 0.45, { weight: 800, size: 40, color: C.bottle, align: 'center' });
  });
  const bagM = new THREE.MeshStandardMaterial({ map: bagTex, roughness: 0.9 });
  const fillM = mat('#E7B021', { rough: 0.6 });
  const bags = [];
  for (const x of [-3.95, -3.62]) {
    const g = new THREE.Group();
    g.position.set(x, 0.91, 4.92);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.3, 0.16, 1, 1, 1), [bagM, bagM, new THREE.MeshBasicMaterial({ visible: false }), bagM, bagM, bagM]);
    body.position.y = 0.15;
    g.add(body);
    const fill = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.3, 0.14), new THREE.MeshStandardMaterial({ color: '#C9A46B', roughness: 0.8 }));
    fill.position.y = 0.0;
    fill.scale.y = 0.01;
    g.add(fill);
    const tops = new THREE.Group();
    const cols = ['#F2D13A', '#D7261E', '#FFFFFF', '#3B7A2A', '#E7B021'];
    cols.forEach((c, i) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), mat(c, { rough: 0.5 }));
      s.position.set(-0.08 + i * 0.04, 0.29, (i % 2) * 0.04 - 0.02);
      tops.add(s);
    });
    tops.visible = false;
    g.add(tops);
    root.add(g);
    bags.push({ g, fill, tops });
  }

  // Pantalla para el cliente
  const display = createPanel({ width: 0.42, height: 0.28, ppm: 1800, transparent: false, draw: drawDisplay, data: { mode: 'idle', lines: [], count: 0, total: 0 } });
  const dispG = new THREE.Group();
  dispG.position.set(-4.75, 1.36, 4.82);
  dispG.rotation.y = 0.75;
  bx(dispG, 0.45, 0.31, 0.03, mat('#1A1F1D', { rough: 0.4 }), 0, 0, -0.018);
  dispG.add(display);
  root.add(dispG);
  bx(statics, 0.04, 0.32, 0.04, mat('#3A403E', { metal: 0.6, rough: 0.4 }), -4.75, 1.06, 4.8);

  // Terminal POS
  const pos = new THREE.Group();
  pos.position.set(-3.35, 1.05, 5.2);
  pos.rotation.set(-0.62, -0.18, 0);
  const posBody = new THREE.Mesh(new RoundedBoxGeometry(0.088, 0.17, 0.024, 3, 0.008), mat('#1E2622', { rough: 0.35 }));
  pos.add(posBody);
  const posScreen = createPanel({ width: 0.072, height: 0.078, ppm: 5600, transparent: false, draw: drawTerminal, data: { mode: 'idle', total: 0, spin: 0 } });
  posScreen.position.set(0, 0.034, 0.0125);
  pos.add(posScreen);
  const keypad = createPanel({
    width: 0.072, height: 0.058, ppm: 4000, transparent: false,
    draw(ctx, W, H) {
      ctx.fillStyle = '#1E2622'; ctx.fillRect(0, 0, W, H);
      const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'X', '0', 'OK'];
      keys.forEach((k, i) => {
        const cx = 4 + (i % 3) * 22.6, cy = 3 + Math.floor(i / 3) * 13.6;
        const col = k === 'X' ? '#C0392B' : k === 'OK' ? C.green : '#3A4541';
        fillRR(ctx, cx, cy, 19, 11, 3, col);
        text(ctx, k, cx + 9.5, cy + 8.2, { weight: 700, size: 6.5, color: '#fff', align: 'center' });
      });
    },
  });
  keypad.position.set(0, -0.043, 0.0125);
  pos.add(keypad);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.004), new THREE.MeshBasicMaterial({ color: '#333', toneMapped: false }));
  led.position.set(0, 0.079, 0.012);
  pos.add(led);
  root.add(pos);
  bx(statics, 0.05, 0.02, 0.07, mat('#2A3230', { rough: 0.4 }), -3.35, 0.92, 5.17);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.1, 12), mat('#2A3230', { rough: 0.4 }));
  stem.position.set(-3.35, 0.97, 5.18);
  statics.add(stem);
  const tapZone = new THREE.Object3D();
  tapZone.position.set(0, 0.034, 0.045);
  pos.add(tapZone);
  // Proxy de selección del POS
  const posProxy = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.1), new THREE.MeshBasicMaterial({ visible: false }));
  posProxy.position.set(0, 0, 0.03);
  pos.add(posProxy);

  // Impresora de tickets
  const printer = new THREE.Group();
  printer.position.set(-3.08, 0.91, 5.08);
  printer.rotation.y = -0.25;
  const pb = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.12, 0.2, 3, 0.015), mat('#E9E4DC', { rough: 0.5 }));
  pb.position.y = 0.06;
  printer.add(pb);
  bx(printer, 0.13, 0.004, 0.012, mat('#111', { rough: 0.6 }), 0, 0.121, 0.05);
  bx(printer, 0.17, 0.02, 0.005, mat(C.orange, { rough: 0.5 }), 0, 0.04, 0.1);
  root.add(printer);

  // Letrero "CAJA 1"
  const laneSign = createPanel({
    width: 1.3, height: 0.42, ppm: 500, transparent: false,
    draw(ctx, W, H) {
      fillRR(ctx, 0, 0, W, H, 40, C.bottle);
      fillRR(ctx, 24, 24, 260, H - 48, 30, C.orange);
      text(ctx, 'CAJA', 154, 170, { weight: 700, size: 70, color: '#fff', align: 'center' });
      text(ctx, '1', 154, 340, { weight: 800, size: 170, color: '#fff', align: 'center' });
      text(ctx, 'Abierta', 320, 180, { weight: 700, size: 100, color: C.eggshell });
      drawContactless(ctx, 380, 290, 70, C.green, 9);
      text(ctx, 'Pago sin contacto', 450, 312, { weight: 600, size: 66, color: C.eggshell, maxWidth: W - 480 });
    },
  });
  for (const s of [1, -1]) {
    const p = laneSign.clone();
    p.position.set(-4.75, 2.7, 5.0 + s * 0.012);
    if (s < 0) p.rotation.y = Math.PI;
    root.add(p);
  }
  const closedSign = createPanel({
    width: 1.3, height: 0.42, ppm: 500, transparent: false,
    draw(ctx, W, H) {
      fillRR(ctx, 0, 0, W, H, 40, '#6E7A75');
      fillRR(ctx, 24, 24, 260, H - 48, 30, '#4F5955');
      text(ctx, 'CAJA', 154, 170, { weight: 700, size: 70, color: '#ddd', align: 'center' });
      text(ctx, '2', 154, 340, { weight: 800, size: 170, color: '#ddd', align: 'center' });
      text(ctx, 'Cerrada', 330, 250, { weight: 700, size: 110, color: '#eee' });
    },
  });
  for (const s of [1, -1]) {
    const p = closedSign.clone();
    p.position.set(2.1, 2.7, 5.0 + s * 0.012);
    if (s < 0) p.rotation.y = Math.PI;
    root.add(p);
  }

  // Póster promocional de AsentliCard
  const poster = createPanel({
    width: 1.2, height: 1.6, ppm: 600, transparent: false,
    draw(ctx, W, H) {
      ctx.fillStyle = C.bottle; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = C.orange;
      ctx.beginPath(); ctx.arc(W * 1.0, H * 0.95, W * 0.75, 0, Math.PI * 2); ctx.fill();
      drawLogo(ctx, 90, 90, 110, { word: C.eggshell });
      text(ctx, 'Paga sin contacto', 90, 420, { weight: 800, size: 104, color: C.eggshell, maxWidth: W - 180 });
      text(ctx, 'con AsentliCard', 90, 540, { weight: 800, size: 104, color: C.green, maxWidth: W - 180 });
      text(ctx, 'Acerca tu tarjeta a la terminal.', 90, 650, { weight: 500, size: 52, color: C.eggshell, maxWidth: W - 180 });
      ctx.save();
      ctx.translate(W * 0.5, H * 0.66);
      ctx.rotate(-0.18);
      fillRR(ctx, -320, -200, 640, 400, 40, C.bottleDeep);
      rr(ctx, -320, -200, 640, 400, 40); ctx.strokeStyle = C.orange; ctx.lineWidth = 6; ctx.stroke();
      drawMark(ctx, -270, -160, 90);
      fillRR(ctx, -270, -20, 100, 78, 14, '#D8B45A');
      drawContactless(ctx, -80, 18, 90, C.eggshell, 10);
      text(ctx, 'AsentliCard', 270, 160, { weight: 700, size: 46, color: C.eggshell, align: 'right' });
      ctx.restore();
    },
  });
  poster.position.set(-7.98, 1.55, 6.6);
  poster.rotation.y = Math.PI / 2;
  root.add(poster);

  // Mostrador detrás del cajero (decorativo)
  bx(statics, 1.0, 0.95, 0.4, mat('#E9E4DC', { rough: 0.6 }), -5.6, 0.475, 3.85);

  bakeStatic(statics);

  const cashier = buildCashier();
  cashier.group.position.set(-4.3, 0, 4.2);
  root.add(cashier.group);

  const bubble = createPanel({
    width: 0.9, height: 0.26, ppm: 900, draw: drawBubble, data: { text: '' },
  });
  bubble.position.set(-4.3, 2.08, 4.3);
  bubble.rotation.y = 0.45;
  bubble.visible = false;
  root.add(bubble);

  const obstacles = [
    new THREE.Box3(new THREE.Vector3(-6.7, 0, 4.6), new THREE.Vector3(-2.8, 2, 5.4)),
    new THREE.Box3(new THREE.Vector3(0.5, 0, 4.6), new THREE.Vector3(3.7, 2, 5.4)),
    new THREE.Box3(new THREE.Vector3(-6.2, 0, 3.5), new THREE.Vector3(-2.8, 2, 4.6)),
  ];

  return {
    root, belt, beltTex, laser, laserGlass, bags, display, pos, posScreen, posProxy, led, tapZone,
    printer, cashier, bubble, obstacles,
  };
}

// ---------- Dibujos de pantallas ----------
function drawDisplay(ctx, W, H, d) {
  ctx.fillStyle = '#F7F4EF';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.bottle;
  ctx.fillRect(0, 0, W, 42);
  text(ctx, BRAND.store + ' · Caja 1', 14, 28, { weight: 700, size: 17, color: C.eggshell, maxWidth: W - 28 });
  if (d.mode === 'idle') {
    text(ctx, 'Bienvenido', W / 2, 140, { weight: 800, size: 40, color: C.bottle, align: 'center' });
    text(ctx, 'Coloca tus productos en la banda', W / 2, 180, { weight: 500, size: 16, color: C.muted, align: 'center' });
    return;
  }
  if (d.mode === 'scanning') {
    text(ctx, 'Registrando productos...', 14, 72, { weight: 700, size: 20, color: C.orange });
    const rows = d.lines.slice(-6);
    rows.forEach((l, i) => {
      const y = 104 + i * 24;
      if (i % 2 === 0) { ctx.fillStyle = '#EFE8DE'; ctx.fillRect(10, y - 17, W - 20, 23); }
      text(ctx, l.name, 18, y, { weight: 500, size: 15, color: C.ink, maxWidth: 260 });
      text(ctx, money(l.price), W - 18, y, { weight: 600, size: 15, color: C.ink, align: 'right' });
    });
  }
  if (d.mode === 'total' || d.mode === 'approved') {
    text(ctx, `Productos: ${d.count}`, W / 2, 104, { weight: 700, size: 30, color: C.bottle, align: 'center' });
    text(ctx, `Total: ${money(d.total)}`, W / 2, 160, { weight: 800, size: 44, color: C.orange, align: 'center' });
    if (d.mode === 'approved') {
      fillRR(ctx, 40, 184, W - 80, 46, 23, C.green);
      text(ctx, 'PAGO APROBADO ✓', W / 2, 216, { weight: 800, size: 24, color: '#fff', align: 'center' });
    } else {
      text(ctx, 'Pago: tarjeta sin contacto', W / 2, 212, { weight: 500, size: 16, color: C.muted, align: 'center' });
    }
    return;
  }
  ctx.fillStyle = C.bottle;
  ctx.fillRect(0, H - 44, W, 44);
  text(ctx, `Productos: ${d.count}`, 14, H - 15, { weight: 700, size: 18, color: C.eggshell });
  text(ctx, `Total: ${money(d.total)}`, W - 14, H - 15, { weight: 800, size: 20, color: C.orange, align: 'right' });
}

function drawTerminal(ctx, W, H, d) {
  const bg = d.mode === 'approved' ? '#E9F6DD' : '#F7F4EF';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.bottle;
  ctx.fillRect(0, 0, W, 11);
  text(ctx, 'POS · La Canasta', W / 2, 8, { weight: 600, size: 5.2, color: C.eggshell, align: 'center' });
  const cx = W / 2;
  if (d.mode === 'idle') {
    drawContactless(ctx, cx + 4, 42, 18, '#9AA', 2.4);
    return;
  }
  if (d.mode === 'amount') {
    text(ctx, 'Total a pagar', cx, 24, { weight: 500, size: 6, color: C.muted, align: 'center' });
    text(ctx, money(d.total), cx, 37, { weight: 800, size: 11.5, color: C.bottle, align: 'center' });
    drawContactless(ctx, cx + 5, 55, 14, C.orange, 2.2);
    text(ctx, 'Acerque su tarjeta', cx, 73, { weight: 600, size: 5.6, color: C.bottle, align: 'center' });
    return;
  }
  if (d.mode === 'detected') {
    drawContactless(ctx, cx + 5, 36, 16, C.orange, 2.6);
    text(ctx, 'Tarjeta detectada', cx, 62, { weight: 700, size: 7, color: C.bottle, align: 'center' });
    return;
  }
  if (d.mode === 'processing') {
    ctx.strokeStyle = '#E2DAD0'; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.arc(cx, 36, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = C.orange; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(cx, 36, 11, d.spin, d.spin + 1.8); ctx.stroke();
    text(ctx, 'Procesando pago...', cx, 62, { weight: 700, size: 6.4, color: C.bottle, align: 'center' });
    text(ctx, money(d.total), cx, 71, { weight: 600, size: 5.4, color: C.muted, align: 'center' });
    return;
  }
  if (d.mode === 'approved') {
    ctx.beginPath(); ctx.arc(cx, 33, 13, 0, Math.PI * 2); ctx.fillStyle = C.green; ctx.fill();
    checkMark(ctx, cx - 10, 23, 20, '#fff', 3.4);
    text(ctx, 'PAGO APROBADO ✓', cx, 59, { weight: 800, size: 6.6, color: '#2F6B12', align: 'center' });
    text(ctx, money(d.total) + ' · AsentliCard', cx, 69, { weight: 600, size: 4.8, color: C.muted, align: 'center' });
  }
}

function drawBubble(ctx, W, H, d) {
  fillRR(ctx, 0, 0, W, H - 40, 50, '#FFFFFF');
  ctx.beginPath();
  ctx.moveTo(W * 0.42, H - 42); ctx.lineTo(W * 0.5, H); ctx.lineTo(W * 0.56, H - 42); ctx.closePath();
  ctx.fillStyle = '#FFFFFF'; ctx.fill();
  ctx.fillStyle = C.orange; ctx.fillRect(40, 30, 10, H - 100);
  text(ctx, 'Cajero', 72, 72, { weight: 600, size: 34, color: C.muted });
  text(ctx, d.text, 72, 150, { weight: 700, size: 58, color: C.bottle, maxWidth: W - 110 });
}

// ---------- Cajero estilizado ----------
function buildCashier() {
  const g = new THREE.Group();
  const skin = mat('#C68A62', { rough: 0.6 });
  const shirt = mat(C.eggshell, { rough: 0.8 });
  const apron = mat(C.bottle, { rough: 0.8 });
  const pants = mat('#2E3436', { rough: 0.8 });
  const hair = mat('#2B1D14', { rough: 0.9 });
  const add = (parent, geo, m, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    parent.add(o);
    return o;
  };
  for (const x of [-0.09, 0.09]) add(g, new THREE.CylinderGeometry(0.065, 0.06, 0.85, 12), pants, x, 0.425, 0);
  const torso = new THREE.Group();
  torso.position.y = 0.85;
  g.add(torso);
  add(torso, new THREE.CapsuleGeometry(0.19, 0.38, 6, 16), shirt, 0, 0.3, 0, 1, 1, 0.72);
  add(torso, new THREE.CapsuleGeometry(0.192, 0.32, 6, 16), apron, 0, 0.24, 0.012, 1.0, 1, 0.72);
  const tagTex = canvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = C.orange; ctx.fillRect(0, 0, w, 14);
    text(ctx, 'Luis', w / 2, 48, { weight: 700, size: 28, color: C.bottle, align: 'center' });
  });
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.035), new THREE.MeshStandardMaterial({ map: tagTex }));
  tag.position.set(0.08, 0.42, 0.142);
  torso.add(tag);
  const head = new THREE.Group();
  head.position.y = 0.78;
  torso.add(head);
  add(head, new THREE.CylinderGeometry(0.05, 0.055, 0.08, 12), skin, 0, -0.07, 0);
  add(head, new THREE.SphereGeometry(0.11, 24, 18), skin, 0, 0.04, 0, 1, 1.12, 1);
  add(head, new THREE.SphereGeometry(0.115, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.45), hair, 0, 0.06, -0.008, 1, 1.1, 1.02);
  for (const x of [-0.038, 0.038]) add(head, new THREE.SphereGeometry(0.012, 10, 8), mat('#1A1A1A', { rough: 0.3 }), x, 0.05, 0.1);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 6, 16, Math.PI * 0.8), mat('#7A3B2E'));
  smile.position.set(0, 0.0, 0.103);
  smile.rotation.z = Math.PI + Math.PI * 0.1;
  head.add(smile);
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group();
    sh.position.set(s * 0.24, 0.52, 0);
    torso.add(sh);
    add(sh, new THREE.CapsuleGeometry(0.05, 0.28, 4, 10), shirt, 0, -0.17, 0);
    const fore = new THREE.Group();
    fore.position.y = -0.34;
    sh.add(fore);
    add(fore, new THREE.CapsuleGeometry(0.042, 0.22, 4, 10), skin, 0, -0.13, 0);
    add(fore, new THREE.SphereGeometry(0.045, 10, 8), skin, 0, -0.28, 0);
    sh.rotation.z = s * 0.08;
    fore.rotation.x = -0.9;
    arms.push({ sh, fore, side: s });
  }
  const state = { scanK: 0, t: 0 };
  return {
    group: g,
    head,
    torso,
    arms,
    state,
    update(dt, t, lookTarget) {
      torso.scale.y = 1 + Math.sin(t * 1.6) * 0.008;
      if (lookTarget) {
        const local = g.worldToLocal(lookTarget.clone());
        const yaw = Math.atan2(local.x, local.z);
        head.rotation.y += (THREE.MathUtils.clamp(yaw, -0.9, 0.9) - head.rotation.y) * Math.min(1, dt * 3);
      }
      const k = state.scanK;
      const sw = Math.sin(t * 7) * k;
      arms[0].sh.rotation.x = -0.5 * k - 0.1 + sw * 0.25;
      arms[0].sh.rotation.y = -0.4 * k * (1 + sw * 0.5);
      arms[1].sh.rotation.x = -0.35 * k - 0.1;
      arms[0].fore.rotation.x = -0.9 - 0.4 * k;
    },
  };
}
