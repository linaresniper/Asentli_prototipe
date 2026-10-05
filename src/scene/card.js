import * as THREE from 'three';
import { C, drawLogo, drawContactless } from '../config/brand.js';
import { canvasTexture, rr, text, fillRR } from '../ui/canvas.js';

// AsentliCard: 85.60 × 53.98 × 0.76 mm (ISO/IEC 7810 ID-1). Datos completamente ficticios.
export const CARD = { W: 0.0856, H: 0.05398, T: 0.00076, R: 0.00318 };
const PX = 20; // px por mm

function cardShape() {
  const { W, H, R } = CARD;
  const s = new THREE.Shape();
  const x = -W / 2, y = -H / 2;
  s.moveTo(x + R, y);
  s.lineTo(x + W - R, y);
  s.quadraticCurveTo(x + W, y, x + W, y + R);
  s.lineTo(x + W, y + H - R);
  s.quadraticCurveTo(x + W, y + H, x + W - R, y + H);
  s.lineTo(x + R, y + H);
  s.quadraticCurveTo(x, y + H, x, y + H - R);
  s.lineTo(x, y + R);
  s.quadraticCurveTo(x, y, x + R, y);
  return s;
}

function drawChip(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#F3D98B');
  g.addColorStop(0.5, '#C9A040');
  g.addColorStop(1, '#EED07A');
  fillRR(ctx, x, y, w, h, h * 0.14, g);
  ctx.strokeStyle = 'rgba(90,60,10,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.33, y); ctx.lineTo(x + w * 0.33, y + h);
  ctx.moveTo(x + w * 0.67, y); ctx.lineTo(x + w * 0.67, y + h);
  ctx.moveTo(x, y + h * 0.5); ctx.lineTo(x + w * 0.33, y + h * 0.5);
  ctx.moveTo(x + w * 0.67, y + h * 0.5); ctx.lineTo(x + w, y + h * 0.5);
  ctx.moveTo(x + w * 0.33, y + h * 0.3); ctx.lineTo(x + w * 0.67, y + h * 0.3);
  ctx.moveTo(x + w * 0.33, y + h * 0.7); ctx.lineTo(x + w * 0.67, y + h * 0.7);
  ctx.stroke();
}

function frontTexture() {
  const W = 85.6 * PX, H = 53.98 * PX;
  return canvasTexture(W, H, (ctx) => {
    rr(ctx, 0, 0, W, H, 3.18 * PX);
    ctx.save();
    ctx.clip();
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#003223');
    g.addColorStop(1, '#0B4D37');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.orange;
    ctx.beginPath(); ctx.arc(W * 0.98, H * 1.1, H * 0.62, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.green; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.arc(W * 0.98, H * 1.1, H * 0.74, Math.PI, Math.PI * 1.5); ctx.stroke();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(-W * 0.1, H * 0.2, 160 + i * 110, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); }
    ctx.globalAlpha = 1;
    drawLogo(ctx, 6 * PX, 6 * PX, 7.5 * PX, { word: C.eggshell });
    fillRR(ctx, W - 27 * PX, 6.5 * PX, 21 * PX, 6 * PX, 3 * PX, 'rgba(245,235,225,0.14)');
    text(ctx, 'PROTOTIPO', W - 16.5 * PX, 10.9 * PX, { weight: 700, size: 3.2 * PX, color: C.eggshell, align: 'center' });
    drawChip(ctx, 8 * PX, 21 * PX, 11.5 * PX, 8.8 * PX);
    drawContactless(ctx, 28 * PX, 25.4 * PX, 6.5 * PX, C.eggshell, 0.75 * PX);
    text(ctx, '••••  ••••  ••••  0000', 8 * PX, 39 * PX, { weight: 600, size: 4.4 * PX, color: C.eggshell });
    text(ctx, 'CLIENTE DEMO', 8 * PX, 47.5 * PX, { weight: 600, size: 3.2 * PX, color: C.eggshell });
    text(ctx, 'VENCE 12/30', 40 * PX, 47.5 * PX, { weight: 500, size: 3 * PX, color: 'rgba(245,235,225,0.8)' });
    text(ctx, 'AsentliCard', W - 6 * PX, H - 5.5 * PX, { weight: 800, size: 4.2 * PX, color: '#fff', align: 'right' });
    ctx.restore();
  });
}

function backTexture() {
  const W = 85.6 * PX, H = 53.98 * PX;
  return canvasTexture(W, H, (ctx) => {
    rr(ctx, 0, 0, W, H, 3.18 * PX);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = C.bottle;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.orange;
    ctx.fillRect(0, H - 4 * PX, W, 4 * PX);
    drawLogo(ctx, W / 2, 14 * PX, 9 * PX, { word: C.eggshell, align: 'center' });
    text(ctx, 'Tarjeta de demostración · Sin valor monetario', W / 2, 33 * PX, { weight: 500, size: 3 * PX, color: C.eggshell, align: 'center' });
    text(ctx, 'Toda la información es ficticia.', W / 2, 38.5 * PX, { weight: 500, size: 3 * PX, color: 'rgba(245,235,225,0.75)', align: 'center' });
    drawContactless(ctx, W / 2 + 2 * PX, 44.5 * PX, 4 * PX, C.green, 0.5 * PX);
    ctx.restore();
  });
}

export function buildCard() {
  const { W, H, T } = CARD;
  const group = new THREE.Group();
  group.name = 'asentliCard';
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(cardShape(), { depth: T, bevelEnabled: false, curveSegments: 6 }),
    new THREE.MeshStandardMaterial({ color: C.bottle, roughness: 0.4, metalness: 0.1 }),
  );
  body.geometry.translate(0, 0, -T / 2);
  group.add(body);
  const faceGeo = new THREE.PlaneGeometry(W, H);
  const front = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ map: frontTexture(), transparent: true, alphaTest: 0.5, roughness: 0.35, metalness: 0.15 }));
  front.position.z = T / 2 + 0.00004;
  group.add(front);
  const back = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ map: backTexture(), transparent: true, alphaTest: 0.5, roughness: 0.4 }));
  back.position.z = -T / 2 - 0.00004;
  back.rotation.y = Math.PI;
  group.add(back);
  // Chip EMV en relieve (coincide con el dibujo de la textura)
  const chip = new THREE.Mesh(new THREE.BoxGeometry(0.0115, 0.0088, 0.0002),
    new THREE.MeshStandardMaterial({ color: '#D8B45A', metalness: 0.9, roughness: 0.25, transparent: true, opacity: 0.35 }));
  chip.position.set(-W / 2 + 0.008 + 0.00575, H / 2 - 0.021 - 0.0044, T / 2 + 0.0001);
  group.add(chip);

  // Halo luminoso (oferta de tarjeta y escena final)
  const haloTex = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,140,60,0.9)');
    g.addColorStop(0.35, 'rgba(255,100,0,0.35)');
    g.addColorStop(1, 'rgba(255,100,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  halo.scale.set(0.22, 0.22, 1);
  halo.position.z = -0.004;
  group.add(halo);

  const proxy = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.06), new THREE.MeshBasicMaterial({ visible: false }));
  group.add(proxy);
  return { group, halo, proxy };
}
