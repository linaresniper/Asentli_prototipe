// Identidad visual de Asentli — ÚNICO punto para ajustar colores, nombres y logotipo.
import { rr, F } from '../ui/canvas.js';

export const C = {
  orange: '#FF6400',      // Pumpkin Orange
  eggshell: '#F5EBE1',    // Eggshell White
  green: '#8CC850',       // Salad Green
  bottle: '#003223',      // Bottle Green
  bottle2: '#0A4A36',
  bottleDeep: '#00241A',
  orangeDark: '#D95300',
  ink: '#0E2A20',
  muted: '#5E7369',
  white: '#FFFFFF',
};

export const BRAND = {
  name: 'Asentli',
  card: 'AsentliCard',
  store: 'Súper La Canasta',
  tagline: 'Tus compras de la semana, de forma fácil y segura.',
  thanks: 'Gracias por utilizar AsentliCard.',
  disclaimer: 'Precios demostrativos — no son precios reales del mercado',
};

export const money = (v) => '$' + v.toFixed(2);

// Isotipo: cuadro redondeado naranja con chevron ascendente y punto verde.
export function drawMark(ctx, x, y, s, { bg = C.orange, fg = C.eggshell, dot = C.green } = {}) {
  rr(ctx, x, y, s, s, s * 0.28);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = fg;
  ctx.lineWidth = s * 0.13;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + s * 0.26, y + s * 0.68);
  ctx.lineTo(x + s * 0.5, y + s * 0.28);
  ctx.lineTo(x + s * 0.74, y + s * 0.68);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + s * 0.5, y + s * 0.7, s * 0.075, 0, Math.PI * 2);
  ctx.fillStyle = dot;
  ctx.fill();
  ctx.restore();
}

// Logotipo completo (isotipo + "asentli"). `x` es el borde izquierdo, o el centro si align='center'.
export function drawLogo(ctx, x, y, h, { word = C.bottle, align = 'left', ...mark } = {}) {
  ctx.font = F(700, h * 0.8);
  const ww = ctx.measureText('asentli').width;
  const total = h * 1.25 + ww;
  const x0 = align === 'center' ? x - total / 2 : x;
  drawMark(ctx, x0, y, h, mark);
  ctx.fillStyle = word;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('asentli', x0 + h * 1.25, y + h * 0.78);
  return total;
}

// Símbolo contactless (ondas).
export function drawContactless(ctx, cx, cy, s, color, lw = s * 0.09) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const r = s * (0.16 + i * 0.2);
    ctx.beginPath();
    ctx.arc(cx - s * 0.45, cy, r, -0.78, 0.78);
    ctx.stroke();
  }
  ctx.restore();
}
