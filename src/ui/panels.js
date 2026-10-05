import * as THREE from 'three';
import { createPanel, fillRR, text, checkMark, rr, F } from './canvas.js';
import { C, BRAND, money, drawLogo, drawMark, drawContactless } from '../config/brand.js';

// Paneles de interfaz flotante (todo se dibuja en milímetros).

// ---------- Lista "COMPRAS DE LA SEMANA" ----------
export function createShoppingList() {
  return createPanel({
    width: 0.3, height: 0.47, ppm: 2200,
    data: { items: [], count: 0 },
    draw(ctx, W, H, d) {
      fillRR(ctx, 0, 0, W, H, 16, C.eggshell);
      rr(ctx, 0, 0, W, 64, 16); ctx.fillStyle = C.bottle; ctx.fill();
      ctx.fillRect(0, 40, W, 24);
      text(ctx, 'COMPRAS DE LA SEMANA', W / 2, 30, { weight: 800, size: 17, color: C.eggshell, align: 'center', maxWidth: W - 24 });
      text(ctx, 'Canasta básica · 14 productos', W / 2, 52, { weight: 500, size: 10, color: C.green, align: 'center' });
      d.items.forEach((it, i) => {
        const y = 84 + i * 24.5;
        const x = 18;
        if (it.checked) {
          fillRR(ctx, x, y - 6, 15, 15, 4, C.green);
          checkMark(ctx, x, y - 6, 15, '#fff', 2.4);
        } else {
          rr(ctx, x, y - 6, 15, 15, 4);
          ctx.strokeStyle = C.bottle; ctx.lineWidth = 2; ctx.stroke();
        }
        const col = it.checked ? '#8A9A92' : C.ink;
        const w = text(ctx, it.name, x + 24, y + 6, { weight: it.checked ? 500 : 600, size: 14, color: col, maxWidth: 170 });
        if (it.checked) {
          ctx.fillStyle = '#8A9A92'; ctx.fillRect(x + 24, y + 1, w, 1.6);
          text(ctx, money(it.price), W - 18, y + 6, { weight: 600, size: 12, color: C.bottle, align: 'right' });
        }
      });
      const n = d.items.filter((i) => i.checked).length;
      const by = H - 22;
      fillRR(ctx, 18, by - 6, W - 120, 10, 5, '#E0D6CA');
      if (n) fillRR(ctx, 18, by - 6, (W - 120) * (n / Math.max(1, d.items.length)), 10, 5, n === d.items.length ? C.green : C.orange);
      text(ctx, `${n} / ${d.items.length}`, W - 18, by + 3, { weight: 700, size: 13, color: C.bottle, align: 'right' });
    },
  });
}

// ---------- HUD del carrito (esquina de la visión) ----------
export function createHud() {
  return createPanel({
    width: 0.25, height: 0.105, ppm: 2400, depthTest: false, renderOrder: 50,
    data: { count: 0, total: 0, listDone: 0, flash: 0 },
    draw(ctx, W, H, d) {
      fillRR(ctx, 0, 0, W, H, 16, 'rgba(0,50,35,0.93)');
      if (d.flash > 0) {
        rr(ctx, 1.5, 1.5, W - 3, H - 3, 15);
        ctx.strokeStyle = `rgba(255,100,0,${d.flash})`; ctx.lineWidth = 3; ctx.stroke();
      }
      // icono de carrito
      ctx.save();
      ctx.translate(14, 14);
      ctx.strokeStyle = C.orange; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(6, 2); ctx.lineTo(11, 22); ctx.lineTo(30, 22); ctx.lineTo(34, 8); ctx.lineTo(8, 8); ctx.stroke();
      ctx.fillStyle = C.orange;
      ctx.beginPath(); ctx.arc(14, 29, 3, 0, 7); ctx.arc(28, 29, 3, 0, 7); ctx.fill();
      ctx.restore();
      text(ctx, 'Carrito', 58, 30, { weight: 700, size: 17, color: C.eggshell });
      text(ctx, `${d.count} ${d.count === 1 ? 'producto' : 'productos'}`, W - 14, 30, { weight: 600, size: 14, color: C.green, align: 'right' });
      text(ctx, 'Total acumulado:', 14, 66, { weight: 500, size: 13, color: C.eggshell });
      text(ctx, money(d.total), W - 14, 70, { weight: 800, size: 26, color: C.orange, align: 'right' });
      fillRR(ctx, 14, 84, W - 28, 7, 3.5, 'rgba(245,235,225,0.2)');
      if (d.listDone) fillRR(ctx, 14, 84, (W - 28) * Math.min(1, d.listDone / 14), 7, 3.5, d.listDone >= 14 ? C.green : C.orange);
    },
  });
}

// ---------- Mensajes principales ----------
const TONES = {
  info: { bg: C.eggshell, bar: C.orange, title: C.bottle, sub: C.muted },
  success: { bg: C.bottle, bar: C.green, title: C.eggshell, sub: C.green },
  pay: { bg: C.bottle, bar: C.orange, title: C.eggshell, sub: C.eggshell },
  warn: { bg: C.eggshell, bar: '#C0392B', title: C.bottle, sub: C.muted },
};

export function createToast() {
  return createPanel({
    width: 0.92, height: 0.22, ppm: 1200, depthTest: false, renderOrder: 40,
    data: { title: '', sub: '', tone: 'info', icon: null },
    draw(ctx, W, H, d) {
      const t = TONES[d.tone] || TONES.info;
      fillRR(ctx, 0, 0, W, H, 34, t.bg);
      rr(ctx, 0, 0, 18, H, 9); ctx.fillStyle = t.bar; ctx.fill();
      let x = 46;
      if (d.icon) {
        const cy = H / 2;
        ctx.beginPath(); ctx.arc(x + 40, cy, 40, 0, Math.PI * 2); ctx.fillStyle = t.bar; ctx.fill();
        if (d.icon === 'check') checkMark(ctx, x + 10, cy - 30, 60, '#fff', 9);
        else if (d.icon === 'card') {
          fillRR(ctx, x + 12, cy - 19, 56, 38, 6, '#fff');
          drawContactless(ctx, x + 45, cy, 22, t.bar, 3.5);
        } else if (d.icon === 'cart') {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x + 14, cy - 20); ctx.lineTo(x + 24, cy - 20); ctx.lineTo(x + 32, cy + 12); ctx.lineTo(x + 62, cy + 12); ctx.lineTo(x + 68, cy - 10); ctx.lineTo(x + 28, cy - 10); ctx.stroke();
        } else if (d.icon === 'list') {
          ctx.fillStyle = '#fff';
          for (let i = 0; i < 3; i++) { ctx.fillRect(x + 20, cy - 22 + i * 18, 8, 8); ctx.fillRect(x + 34, cy - 20 + i * 18, 28, 5); }
        } else if (d.icon === 'arrow') {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(x + 14, cy); ctx.lineTo(x + 64, cy); ctx.moveTo(x + 44, cy - 20); ctx.lineTo(x + 64, cy); ctx.lineTo(x + 44, cy + 20); ctx.stroke();
        }
        x += 104;
      }
      if (d.sub) {
        text(ctx, d.title, x, H * 0.45, { weight: 800, size: 50, color: t.title, maxWidth: W - x - 34 });
        text(ctx, d.sub, x, H * 0.78, { weight: 500, size: 32, color: t.sub, maxWidth: W - x - 34 });
      } else {
        text(ctx, d.title, x, H * 0.62, { weight: 800, size: 54, color: t.title, maxWidth: W - x - 34 });
      }
    },
  });
}

// ---------- Etiqueta emergente al apuntar ----------
export function createTooltip() {
  return createPanel({
    width: 0.24, height: 0.075, ppm: 2400, depthTest: false, renderOrder: 45,
    data: { title: '', sub: '', price: null, status: 'list' },
    draw(ctx, W, H, d) {
      fillRR(ctx, 0, 0, W, H, 14, 'rgba(0,50,35,0.95)');
      const col = d.status === 'cart' ? C.green : d.status === 'list' ? C.orange : '#9FB3AA';
      fillRR(ctx, 0, 0, 10, H, 5, col);
      text(ctx, d.title, 20, 32, { weight: 700, size: 19, color: C.eggshell, maxWidth: d.price != null ? 140 : W - 34 });
      if (d.price != null) text(ctx, money(d.price), W - 14, 32, { weight: 800, size: 20, color: C.orange, align: 'right' });
      text(ctx, d.sub, 20, 60, { weight: 500, size: 13, color: col, maxWidth: W - 34 });
    },
  });
}

// ---------- Texto flotante "+$2.40" ----------
export function createFloatText() {
  return createPanel({
    width: 0.2, height: 0.07, ppm: 1600, depthTest: false, renderOrder: 46,
    data: { text: '' },
    draw(ctx, W, H, d) {
      fillRR(ctx, 20, 5, W - 40, H - 10, (H - 10) / 2, C.orange);
      text(ctx, d.text, W / 2, H / 2 + 10, { weight: 800, size: 32, color: '#fff', align: 'center' });
    },
  });
}

// ---------- Comprobante ----------
export function createReceipt() {
  return createPanel({
    width: 0.12, height: 0.33, ppm: 3200, transparent: false, doubleSide: true,
    data: { lines: [], count: 0, total: 0, date: '' },
    draw(ctx, W, H, d) {
      ctx.fillStyle = '#FCFBF7'; ctx.fillRect(0, 0, W, H);
      // borde dentado inferior
      ctx.fillStyle = '#E6E1D8';
      for (let x = 0; x < W; x += 6) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + 3, H - 3); ctx.lineTo(x + 6, H); ctx.fill(); }
      drawMark(ctx, W / 2 - 34, 10, 16);
      text(ctx, 'ASENTLI', W / 2 + 10, 23.5, { weight: 800, size: 13, color: C.bottle, align: 'center' });
      text(ctx, 'Compra semanal', W / 2, 40, { weight: 700, size: 8.5, color: C.orange, align: 'center' });
      text(ctx, BRAND.store + ' · Caja 1', W / 2, 50, { weight: 500, size: 5.6, color: C.muted, align: 'center' });
      text(ctx, d.date, W / 2, 58, { weight: 500, size: 5.2, color: C.muted, align: 'center' });
      const dash = (y) => {
        ctx.strokeStyle = '#B9B2A6'; ctx.setLineDash([2.5, 2]); ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(W - 8, y); ctx.stroke(); ctx.setLineDash([]);
      };
      dash(64);
      d.lines.forEach((l, i) => {
        const y = 73 + i * 9.4;
        text(ctx, l.name, 9, y, { weight: 500, size: 6, color: '#333', maxWidth: 70 });
        text(ctx, money(l.price), W - 9, y, { weight: 500, size: 6, color: '#333', align: 'right' });
      });
      let y = 73 + d.lines.length * 9.4 + 2;
      dash(y - 4);
      const row = (a, b, opts = {}) => {
        y += opts.gap ?? 12;
        text(ctx, a, 9, y, { weight: opts.w ?? 600, size: opts.s ?? 7.4, color: opts.c ?? C.bottle });
        text(ctx, b, W - 9, y, { weight: opts.w ?? 700, size: opts.s ?? 7.4, color: opts.c ?? C.bottle, align: 'right' });
      };
      row('Productos:', String(d.count), { gap: 8 });
      row('Total:', money(d.total), { s: 11, w: 800, gap: 15 });
      row('Pago:', 'AsentliCard', {});
      row('Tarjeta:', '•••• 0000 · Contactless', { s: 5.6, w: 500, c: C.muted, gap: 10 });
      y += 9;
      fillRR(ctx, 8, y, W - 16, 17, 8.5, C.green);
      text(ctx, 'Estado: APROBADO ✓', W / 2, y + 12, { weight: 800, size: 8, color: '#fff', align: 'center' });
      y += 30;
      text(ctx, '¡Gracias por su compra!', W / 2, y, { weight: 600, size: 6.5, color: C.bottle, align: 'center' });
      text(ctx, 'Precios demostrativos — no reales', W / 2, y + 9, { weight: 500, size: 4.8, color: C.muted, align: 'center' });
    },
  });
}

// ---------- Resumen final ----------
export function createSummary() {
  return createPanel({
    width: 0.64, height: 0.46, ppm: 1500,
    data: { count: 0, total: 0, thanks: false },
    draw(ctx, W, H, d) {
      fillRR(ctx, 0, 0, W, H, 30, C.eggshell);
      rr(ctx, 0, 0, W, 120, 30); ctx.fillStyle = C.bottle; ctx.fill(); ctx.fillRect(0, 90, W, 30);
      ctx.beginPath(); ctx.arc(70, 60, 34, 0, Math.PI * 2); ctx.fillStyle = C.green; ctx.fill();
      checkMark(ctx, 44, 34, 52, '#fff', 8);
      text(ctx, 'Compra semanal completada', 122, 74, { weight: 800, size: 38, color: C.eggshell, maxWidth: W - 150 });
      const row = (y, a, b, col = C.bottle) => {
        text(ctx, a, 44, y, { weight: 500, size: 28, color: C.muted });
        text(ctx, b, W - 44, y, { weight: 800, size: 32, color: col, align: 'right' });
        ctx.fillStyle = '#E3D8CB'; ctx.fillRect(44, y + 16, W - 88, 2);
      };
      row(178, 'Productos básicos:', String(d.count));
      row(234, 'Total de la compra:', money(d.total), C.orange);
      text(ctx, 'Pago realizado con AsentliCard ✓', 44, 290, { weight: 700, size: 28, color: '#3F7A1A' });
      if (d.thanks) {
        fillRR(ctx, 30, 320, W - 60, 110, 22, C.bottle);
        drawLogo(ctx, 60, 344, 36, { word: C.eggshell });
        text(ctx, BRAND.thanks, 60, 414, { weight: 700, size: 26, color: C.eggshell, maxWidth: W - 120 });
      }
    },
  });
}

// ---------- Títulos de la escena final ----------
export function createOutroTitle() {
  return createPanel({
    width: 3.0, height: 1.3, ppm: 600,
    data: { a: 0, b: 0 },
    draw(ctx, W, H, d) {
      fillRR(ctx, 0, 0, W, H, 120, 'rgba(0,36,26,0.94)');
      rr(ctx, 6, 6, W - 12, H - 12, 114);
      ctx.strokeStyle = 'rgba(255,100,0,0.55)'; ctx.lineWidth = 10; ctx.stroke();
      drawLogo(ctx, W / 2, 110, 300, { word: C.eggshell, align: 'center' });
      ctx.globalAlpha = d.a;
      text(ctx, BRAND.tagline, W / 2, 680, { weight: 700, size: 128, color: C.eggshell, align: 'center', maxWidth: W - 200 });
      ctx.globalAlpha = d.b;
      text(ctx, BRAND.card, W / 2, 950, { weight: 800, size: 230, color: C.orange, align: 'center' });
      ctx.fillStyle = C.green; ctx.fillRect(W / 2 - 220, 1010, 440, 16);
      ctx.globalAlpha = 1;
    },
  });
}

// ---------- Botón 3D ----------
export function createButton(label, onSelect, { width = 0.46, height = 0.11, tone = 'primary' } = {}) {
  const panel = createPanel({
    width, height, ppm: 1500, depthTest: true,
    data: { label, hover: false },
    draw(ctx, W, H, d) {
      const bg = tone === 'primary' ? (d.hover ? C.orangeDark : C.orange) : (d.hover ? C.bottle2 : C.bottle);
      fillRR(ctx, 0, 0, W, H, H / 2, bg);
      if (d.hover) { rr(ctx, 3, 3, W - 6, H - 6, H / 2 - 3); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke(); }
      text(ctx, d.label, W / 2, H / 2 + 14, { weight: 700, size: 40, color: '#fff', align: 'center', maxWidth: W - 40 });
    },
  });
  const target = {
    kind: 'button',
    onSelect,
    setHover(h) { if (panel.userData.panel.data.hover !== h) panel.redraw({ hover: h }); },
  };
  panel.userData.target = target;
  target.mesh = panel;
  return panel;
}

// ---------- Indicador flotante (chevron + anillo) ----------
export function createBeacon(label) {
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color: C.orange, toneMapped: false, transparent: true, opacity: 0.95 });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 4), m);
  cone.rotation.x = Math.PI;
  cone.position.y = 0.0;
  g.add(cone);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.46, 48), new THREE.MeshBasicMaterial({ color: C.orange, transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  g.add(ring);
  let tag = null;
  if (label) {
    tag = createPanel({
      width: 0.5, height: 0.14, ppm: 1200,
      draw(ctx, W, H) {
        fillRR(ctx, 0, 0, W, H, H / 2, C.orange);
        text(ctx, label, W / 2, H / 2 + 17, { weight: 800, size: 50, color: '#fff', align: 'center' });
      },
    });
    g.add(tag);
  }
  g.userData = { cone, ring, tag };
  g.visible = false;
  return g;
}
