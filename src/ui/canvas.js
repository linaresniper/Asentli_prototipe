import * as THREE from 'three';

export const FONT = 'Poppins, "Segoe UI", system-ui, -apple-system, sans-serif';
export const F = (weight, size) => `${weight} ${size}px ${FONT}`;

export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function fillRR(ctx, x, y, w, h, r, color) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

// Texto con reducción automática para no exceder maxWidth.
export function text(ctx, str, x, y, { weight = 600, size = 20, color = '#000', align = 'left', baseline = 'alphabetic', maxWidth = Infinity } = {}) {
  let s = size;
  ctx.font = F(weight, s);
  while (ctx.measureText(str).width > maxWidth && s > 4) {
    s *= 0.94;
    ctx.font = F(weight, s);
  }
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
  return ctx.measureText(str).width;
}

export function checkMark(ctx, x, y, s, color, lw) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw ?? s * 0.16;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x + s * 0.2, y + s * 0.52);
  ctx.lineTo(x + s * 0.42, y + s * 0.74);
  ctx.lineTo(x + s * 0.82, y + s * 0.28);
  ctx.stroke();
  ctx.restore();
}

// Panel plano con textura de canvas. Se dibuja en milímetros: 1 unidad = 1 mm del mundo.
export function createPanel({ width, height, ppm = 1400, draw, data = {}, transparent = true, depthTest = true, doubleSide = false, renderOrder = 0 }) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(2048, Math.round(width * ppm));
  canvas.height = Math.min(2048, Math.round(height * ppm));
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  const mat = new THREE.MeshBasicMaterial({
    map: tex, transparent, depthTest, depthWrite: !transparent, toneMapped: false,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.renderOrder = renderOrder;
  const W = width * 1000, H = height * 1000;
  mesh.userData.panel = { data, W, H };
  mesh.redraw = (patch) => {
    if (patch) Object.assign(mesh.userData.panel.data, patch);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    draw(ctx, W, H, mesh.userData.panel.data);
    tex.needsUpdate = true;
    return mesh;
  };
  mesh.redraw();
  return mesh;
}

// Textura de canvas genérica (etiquetas de productos, tarjeta, pisos).
export function canvasTexture(wPx, hPx, draw, { repeat = null, srgb = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = wPx;
  canvas.height = hPx;
  const ctx = canvas.getContext('2d');
  draw(ctx, wPx, hPx);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}
