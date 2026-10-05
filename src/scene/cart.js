import * as THREE from 'three';
import { canvasTexture, text } from '../ui/canvas.js';
import { C } from '../config/brand.js';
import { mat } from './productMeshes.js';
import { mergeChildrenByMaterial } from '../core/merge.js';

// Carrito de supermercado. Frente = -Z local, manija en +Z (lado del usuario).
const FLOOR_Y = 0.555;

function tube(group, a, b, r, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), material);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  group.add(m);
  return m;
}

export function buildCart() {
  const group = new THREE.Group();
  group.name = 'cart';
  const frame = new THREE.Group();
  group.add(frame);

  const chrome = mat('#C9CED1', { rough: 0.3, metal: 0.85 });
  const gridTex = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 9;
    ctx.strokeRect(0, 0, w, h);
  });
  gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
  const gridMat = (rx, ry) => {
    const t = gridTex.clone();
    t.repeat.set(rx, ry);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ color: '#C9CED1', map: t, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.8, roughness: 0.35 });
  };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const xw = 0.27, zf = -0.47, zb = 0.36, yb = FLOOR_Y - 0.005, yt = 0.97;
  const hgt = yt - yb, dep = zb - zf;

  const plane = (w, h, m, x, y, z, rx = 0, ry = 0) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(x, y, z);
    p.rotation.set(rx, ry, 0);
    frame.add(p);
  };
  plane(dep, hgt, gridMat(dep / 0.045, hgt / 0.045), -xw, yb + hgt / 2, (zf + zb) / 2, 0, Math.PI / 2);
  plane(dep, hgt, gridMat(dep / 0.045, hgt / 0.045), xw, yb + hgt / 2, (zf + zb) / 2, 0, Math.PI / 2);
  plane(xw * 2, hgt, gridMat(xw * 2 / 0.045, hgt / 0.045), 0, yb + hgt / 2, zf);
  plane(xw * 2, hgt, gridMat(xw * 2 / 0.045, hgt / 0.045), 0, yb + hgt / 2, zb);
  plane(xw * 2, dep, gridMat(xw * 2 / 0.045, dep / 0.045), 0, yb, (zf + zb) / 2, -Math.PI / 2);
  plane(0.4, 0.75, gridMat(0.4 / 0.05, 0.75 / 0.05), 0, 0.17, -0.07, -Math.PI / 2);

  const r = 0.008;
  const corners = [V(-xw, yt, zf), V(xw, yt, zf), V(xw, yt, zb), V(-xw, yt, zb)];
  for (let i = 0; i < 4; i++) tube(frame, corners[i], corners[(i + 1) % 4], r, chrome);
  const cornersB = [V(-xw, yb, zf), V(xw, yb, zf), V(xw, yb, zb), V(-xw, yb, zb)];
  for (let i = 0; i < 4; i++) tube(frame, cornersB[i], cornersB[(i + 1) % 4], r, chrome);
  for (let i = 0; i < 4; i++) tube(frame, cornersB[i], corners[i], r, chrome);
  for (const s of [-1, 1]) {
    tube(frame, V(s * 0.21, 0.13, -0.5), V(s * 0.21, 0.13, 0.36), 0.012, chrome);
    tube(frame, V(s * 0.25, yb, zb - 0.02), V(s * 0.21, 0.13, 0.34), 0.012, chrome);
    tube(frame, V(s * 0.2, yb, zf + 0.02), V(s * 0.21, 0.13, -0.48), 0.012, chrome);
    tube(frame, V(s * xw, yt, zb), V(s * xw, 1.04, 0.46), 0.011, chrome);
  }
  const wheelM = mat('#1E1E1E', { rough: 0.7 });
  const hubM = mat('#8A9194', { rough: 0.4, metal: 0.7 });
  for (const x of [-0.21, 0.21]) for (const z of [-0.48, 0.34]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 16), wheelM);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.055, z);
    frame.add(w);
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.03), hubM);
    f.position.set(x, 0.1, z);
    frame.add(f);
  }
  mergeChildrenByMaterial(frame);

  // Manija con agarre naranja (identidad Asentli)
  tube(group, V(-xw - 0.01, 1.04, 0.46), V(xw + 0.01, 1.04, 0.46), 0.012, chrome);
  const grip = tube(group, V(-0.2, 1.04, 0.46), V(0.2, 1.04, 0.46), 0.019, mat(C.orange, { rough: 0.45 }));

  // Borde iluminado (al acercar un producto)
  const glowM = new THREE.MeshBasicMaterial({ color: C.orange, transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
  const glow = new THREE.Group();
  for (let i = 0; i < 4; i++) tube(glow, corners[i], corners[(i + 1) % 4], 0.014, glowM);
  group.add(glow);

  // Sombra suave
  const shadowTex = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.38)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.003, -0.05);
  group.add(shadow);

  // Contenedor de productos dentro de la canasta
  const basket = new THREE.Group();
  group.add(basket);

  // Soporte para la lista sobre la manija
  const listMount = new THREE.Group();
  listMount.position.set(-0.0, 1.17, 0.5);
  listMount.rotation.x = -0.7;
  group.add(listMount);

  // Bolsas llenas (escena final)
  const bagTex = canvasTexture(256, 300, (ctx, w, h) => {
    ctx.fillStyle = '#E9DCC5'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = C.bottle; ctx.fillRect(0, h * 0.72, w, h * 0.28);
    text(ctx, 'La Canasta', w / 2, h * 0.45, { weight: 800, size: 40, color: C.bottle, align: 'center' });
  });
  const bagM = new THREE.MeshStandardMaterial({ map: bagTex, roughness: 0.9 });
  const bags = new THREE.Group();
  const produceCols = ['#F2D13A', '#D7261E', '#3B7A2A', '#F28C1C', '#FFFFFF', '#C98A43'];
  [[-0.12, -0.18, 0.15], [0.12, 0.05, -0.12]].forEach(([x, z, ry], bi) => {
    const b = new THREE.Group();
    b.position.set(x, FLOOR_Y, z);
    b.rotation.y = ry;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.16), bagM);
    body.position.y = 0.16;
    b.add(body);
    produceCols.forEach((c, i) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), mat(c, { rough: 0.5 }));
      s.position.set(-0.08 + (i % 3) * 0.08, 0.33 + (i > 2 ? 0.02 : 0), i > 2 ? 0.03 : -0.03);
      b.add(s);
    });
    const bread = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.14, 4, 8), mat('#C98A43', { rough: 0.8 }));
    bread.position.set(bi ? -0.05 : 0.05, 0.38, 0);
    bread.rotation.z = 1.2;
    b.add(bread);
    bags.add(b);
  });
  bags.visible = false;
  group.add(bags);

  // Proxy para seleccionar el carrito
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.1, 1.1), new THREE.MeshBasicMaterial({ visible: false }));
  proxy.position.set(0, 0.55, 0);
  group.add(proxy);

  const slots = [];
  const zs = [-0.36, -0.14, 0.08, 0.27];
  for (const z of zs) for (const x of [-0.15, 0, 0.15]) slots.push(new THREE.Vector3(x, FLOOR_Y + 0.004, z));
  slots.push(new THREE.Vector3(-0.08, FLOOR_Y + 0.13, -0.1), new THREE.Vector3(0.08, FLOOR_Y + 0.13, 0.12));
  for (let i = 0; i < 6; i++) slots.push(new THREE.Vector3((i % 3 - 1) * 0.14, FLOOR_Y + 0.22, (Math.floor(i / 3) - 0.5) * 0.3));

  return { group, basket, slots, glow, glowM, grip, listMount, bags, proxy };
}
