import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Tweens, Ease } from './core/tween.js';
import { Sfx, say } from './core/audio.js';
import { C, BRAND, money } from './config/brand.js';
import { LIST, productById } from './config/products.js';
import { buildStore, STORE } from './scene/store.js';
import { buildCheckout, CHECKOUT } from './scene/checkout.js';
import { buildCart } from './scene/cart.js';
import { buildCard } from './scene/card.js';
import {
  createShoppingList, createHud, createToast, createTooltip, createFloatText,
  createReceipt, createSummary, createOutroTitle, createButton, createBeacon,
} from './ui/panels.js';
import { setupXRPointers, updateXRRay, readSnapTurn } from './input/xr.js';
import { setupDesktop } from './input/desktop.js';

const params = new URLSearchParams(location.search);
const EXPO = params.get('expo') === '1';
const GUIDE = params.get('guia') !== '0';
const AUTO = params.get('auto') !== '0';

const OUTRO_STAGE = { x: 3.6, z: 8.2 };
const EYE = 1.6;

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _dir = new THREE.Vector3();

const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
};
const angleDiff = (a, b) => ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

// Estados: intro → shopping → listDone → checkout → payPrompt → cardOut → tapping
//          → receipt → summary → outro
export class Game {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.03, 60);
    this.camera.rotation.order = 'YXZ';
    this.rig = new THREE.Group();
    this.rig.add(this.camera);
    this.camera.position.set(0, EYE, 0);
    this.scene.add(this.rig);
    this.tweens = new Tweens();
    this.sfx = new Sfx();
    this.state = 'boot';
    this.isXR = false;
    this.pitch = -0.12;
    this.lockMove = false;
    this.cartItems = [];
    this.cartFollow = false;
    this.cartHeading = 0;
    this.cartHeadingTarget = 0;
    this.desktopListOn = true;
    this.hintsShown = new Set();
    this.time = 0;
  }

  // ---------------------------------------------------------------- setup
  init() {
    const { scene, renderer } = this;
    scene.background = new THREE.Color('#E9E2D8');
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    this.hemi = new THREE.HemisphereLight('#FFFFFF', '#B9AFA3', 1.5);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#FFF6EA', 1.5);
    this.sun.position.set(3, 8, 4);
    scene.add(this.sun);
    this.lightDefaults = { hemi: 1.5, sun: 1.5, env: 0.55, bg: new THREE.Color('#E9E2D8') };

    // Mundo
    this.store = buildStore();
    scene.add(this.store.root);
    this.checkout = buildCheckout();
    scene.add(this.checkout.root);
    this.obstacles = [...this.store.obstacles, ...this.checkout.obstacles];
    this.cart = buildCart();
    scene.add(this.cart.group);
    this.cart.proxy.userData.target = { kind: 'cart' };
    this.card = buildCard();
    this.card.proxy.userData.target = { kind: 'card' };
    this.checkout.posProxy.userData.target = { kind: 'pos' };

    // UI
    this.list = createShoppingList();
    this.listItems = LIST.map((id) => ({ id, name: productById[id].listName || productById[id].name, price: productById[id].price, checked: false }));
    this.list.redraw({ items: this.listItems });
    this.scene.add(this.list);
    this.desktopList = new THREE.Mesh(this.list.geometry, this.list.material.clone());
    this.desktopList.material.depthTest = false;
    this.desktopList.renderOrder = 48;
    this.camera.add(this.desktopList);
    this.wristList = new THREE.Mesh(this.list.geometry, this.list.material);
    this.wristList.scale.setScalar(0.7);
    this.wristList.visible = false;

    this.hud = createHud();
    this.camera.add(this.hud);
    this.hud.visible = false;
    this.toast = createToast();
    this.toast.visible = false;
    this.toast.material.opacity = 0;
    scene.add(this.toast);
    this.toastFollow = { pos: new THREE.Vector3(), yaw: 0, init: false };
    this.tooltip = createTooltip();
    this.tooltip.visible = false;
    scene.add(this.tooltip);
    this.floats = [createFloatText(), createFloatText(), createFloatText()];
    this.floats.forEach((f) => { f.visible = false; scene.add(f); });
    this.floatIdx = 0;
    this.receipt = createReceipt();
    this.receipt.visible = false;
    this.receipt.userData.target = { kind: 'receipt' };
    this.summary = createSummary();
    this.summary.visible = false;
    scene.add(this.summary);
    this.outroTitle = createOutroTitle();
    this.outroTitle.visible = false;
    scene.add(this.outroTitle);
    this.btnFinal = createButton('Ver escena final', () => this.goOutro());
    this.btnFinal.visible = false;
    scene.add(this.btnFinal);
    this.btnRestart = createButton('Reiniciar demo', () => this.restart(), { tone: 'secondary' });
    this.btnRestart.visible = false;
    scene.add(this.btnRestart);

    this.cartBeacon = createBeacon('Toma el carrito');
    scene.add(this.cartBeacon);
    this.checkoutBeacon = createBeacon('CAJA 1');
    this.checkoutBeacon.position.set(CHECKOUT.playerSpot.x, 0.01, CHECKOUT.playerSpot.z);
    scene.add(this.checkoutBeacon);
    this.productHint = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 4),
      new THREE.MeshBasicMaterial({ color: C.orange, toneMapped: false }));
    this.productHint.rotation.x = Math.PI;
    this.productHint.visible = false;
    scene.add(this.productHint);
    this.arrows = this.buildFloorArrows();
    scene.add(this.arrows);
    this.posRing = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.058, 40),
      new THREE.MeshBasicMaterial({ color: C.orange, transparent: true, opacity: 0, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
    this.checkout.tapZone.add(this.posRing);
    this.nfc = this.buildNfcWaves();

    // Luces de la escena final
    this.outroSpot = new THREE.SpotLight('#FFFFFF', 0, 9, 0.45, 0.6, 1.2);
    this.outroSpot.position.set(OUTRO_STAGE.x, 3.3, OUTRO_STAGE.z + 0.6);
    this.outroSpot.target.position.set(OUTRO_STAGE.x, 0.8, OUTRO_STAGE.z);
    scene.add(this.outroSpot, this.outroSpot.target);
    this.cardLight = new THREE.PointLight(C.orange, 0, 2.5, 1.5);
    scene.add(this.cardLight);

    // Fundido a negro (cámara)
    this.fade = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#000', side: THREE.BackSide, transparent: true, opacity: 1, depthTest: false, depthWrite: false }));
    this.fade.renderOrder = 9999;
    this.camera.add(this.fade);

    // Entrada
    this.desktop = setupDesktop(this);
    this.xrPointers = setupXRPointers(this);
    this.pointers = [this.desktop.pointer, ...this.xrPointers];
    const left = this.xrPointers.find((p) => p.handedness === 'left') || this.xrPointers[0];
    left.grip.add(this.wristList);
    this.wristList.position.set(0, 0.11, 0.03);
    this.wristList.rotation.x = -0.65;
    this.xrPointers.forEach((p) => p.ctrl.addEventListener('connected', () => this.attachWristList()));

    renderer.xr.addEventListener('sessionstart', () => this.onXRStart());
    renderer.xr.addEventListener('sessionend', () => this.onXREnd());

    this.layoutHud();
    addEventListener('resize', () => this.onResize());
    this.reset();
    this.debugApi();
  }

  attachWristList() {
    const left = this.xrPointers.find((p) => p.active && p.handedness === 'left');
    if (left && this.wristList.parent !== left.grip) left.grip.add(this.wristList);
  }

  buildFloorArrows() {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(-0.14, -0.1); shape.lineTo(0, 0.08); shape.lineTo(0.14, -0.1);
    shape.lineTo(0.14, -0.02); shape.lineTo(0, 0.16); shape.lineTo(-0.14, -0.02); shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    const m = new THREE.MeshBasicMaterial({ color: C.orange, transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false });
    const path = [[0, 1.6], [-1.4, 5.95], [-2.8, 5.95]];
    for (let s = 0; s < path.length - 1; s++) {
      const [x0, z0] = path[s], [x1, z1] = path[s + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const yaw = Math.atan2(x1 - x0, z1 - z0);
      for (let d = 0.3; d < len; d += 0.65) {
        const a = new THREE.Mesh(geo, m);
        a.rotation.order = 'YXZ';
        a.rotation.set(-Math.PI / 2, yaw + Math.PI, 0);
        a.position.set(x0 + (x1 - x0) * d / len, 0.006, z0 + (z1 - z0) * d / len);
        g.add(a);
      }
    }
    g.visible = false;
    return g;
  }

  buildNfcWaves() {
    const rings = [];
    for (let i = 0; i < 6; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.018, 0.024, 40),
        new THREE.MeshBasicMaterial({ color: C.orange, transparent: true, opacity: 0, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      r.visible = false;
      this.scene.add(r);
      rings.push({ mesh: r, t: 1 });
    }
    return { rings, active: false, timer: 0, next: 0 };
  }

  // ---------------------------------------------------------------- player helpers
  headPos(out = new THREE.Vector3()) {
    this.camera.updateWorldMatrix(true, false);
    return out.setFromMatrixPosition(this.camera.matrixWorld);
  }

  headYaw() {
    this.camera.updateWorldMatrix(true, false);
    _dir.set(0, 0, -1).transformDirection(this.camera.matrixWorld);
    return Math.atan2(-_dir.x, -_dir.z);
  }

  forward(yaw, out = new THREE.Vector3()) {
    return out.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  }

  placePlayer(x, z, yaw) {
    if (!this.isXR) {
      this.rig.position.set(x, 0, z);
      this.rig.rotation.set(0, yaw, 0);
      this.camera.rotation.set(this.pitch, 0, 0);
      return;
    }
    const current = this.headYaw();
    this.rig.rotation.y += angleDiff(current, yaw);
    this.rig.updateMatrixWorld(true);
    const h = this.headPos(_v);
    this.rig.position.x += x - h.x;
    this.rig.position.z += z - h.z;
    this.rig.updateMatrixWorld(true);
  }

  look(dyaw, dpitch) {
    if (this.isXR) return;
    this.rig.rotation.y += dyaw;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dpitch, -1.2, 1.1);
    this.camera.rotation.x = this.pitch;
  }

  blocked(x, z, pad = 0.22) {
    if (x < STORE.minX || x > STORE.maxX || z < STORE.minZ || z > STORE.maxZ) return true;
    for (const b of this.obstacles) {
      if (x > b.min.x - pad && x < b.max.x + pad && z > b.min.z - pad && z < b.max.z + pad) return true;
    }
    return false;
  }

  async fadeTo(v, dur = 0.35) {
    const m = this.fade.material;
    const from = m.opacity;
    this.fade.visible = true;
    await this.tweens.tween(dur, (k) => { m.opacity = from + (v - from) * k; }, Ease.inOutSine);
    if (v === 0) this.fade.visible = false;
  }

  async teleport(x, z) {
    if (this.teleporting) return;
    this.teleporting = true;
    const prevYaw = this.headYaw();
    const h = this.headPos(_v2).clone();
    const moveYaw = Math.atan2(-(x - h.x), -(z - h.z));
    await this.fadeTo(1, 0.14);
    this.rig.position.x += x - h.x;
    this.rig.position.z += z - h.z;
    if (this.cartFollow) {
      this.cartHeading = this.cartHeadingTarget = Math.abs(angleDiff(prevYaw, moveYaw)) < 1.2 ? moveYaw : prevYaw;
      this.snapCart();
    }
    await this.fadeTo(0, 0.18);
    this.teleporting = false;
  }

  async walkTo(x, z) {
    if (this.walking) return;
    const sx = this.rig.position.x, sz = this.rig.position.z;
    let tx = x, tz = z;
    const dist = Math.hypot(tx - sx, tz - sz);
    const steps = Math.ceil(dist / 0.1);
    for (let i = 1; i <= steps; i++) {
      const px = sx + (x - sx) * i / steps, pz = sz + (z - sz) * i / steps;
      if (this.blocked(px, pz)) { tx = sx + (x - sx) * (i - 1) / steps; tz = sz + (z - sz) * (i - 1) / steps; break; }
    }
    const d = Math.hypot(tx - sx, tz - sz);
    if (d < 0.05) return;
    this.walking = true;
    this.movedRecently = 0.5;
    await this.tweens.tween(Math.max(0.35, d / 2.4), (k) => {
      this.rig.position.x = sx + (tx - sx) * k;
      this.rig.position.z = sz + (tz - sz) * k;
      this.movedRecently = 0.3;
    }, Ease.inOutSine);
    this.walking = false;
  }

  // ---------------------------------------------------------------- XR
  onXRStart() {
    this.isXR = true;
    this.sfx.unlock();
    this.camera.rotation.set(0, 0, 0);
    this.layoutHud();
    this.desktopList.visible = false;
    this.tooltip.visible = false;
    const spot = this.currentSpot();
    this.pendingPlace = spot;
    this.placeFrames = 0;
  }

  onXREnd() {
    this.isXR = false;
    this.camera.position.set(0, EYE, 0);
    this.camera.rotation.set(this.pitch, 0, 0);
    const spot = this.currentSpot();
    this.rig.rotation.set(0, spot.yaw, 0);
    this.rig.position.set(spot.x, 0, spot.z);
    this.layoutHud();
    this.onResize();
  }

  currentSpot() {
    if (this.state === 'outro') return { x: OUTRO_STAGE.x, z: OUTRO_STAGE.z + 1.55, yaw: 0 };
    if (['checkout', 'payPrompt', 'cardOut', 'tapping', 'approved', 'receipt', 'summary'].includes(this.state)) return CHECKOUT.playerSpot;
    if (this.state === 'intro') return STORE.start;
    const h = this.headPos(_v);
    return { x: h.x, z: h.z, yaw: this.headYaw() };
  }

  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
    this.layoutHud();
  }

  layoutHud() {
    if (this.isXR) {
      this.hud.position.set(0.2, -0.2, -0.72);
      this.hud.rotation.set(0.1, -0.22, 0);
      this.hud.scale.setScalar(0.85);
      return;
    }
    const d = 1;
    const halfH = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * d;
    const halfW = halfH * this.camera.aspect;
    const s = Math.min(1, halfW / 0.75);
    this.hud.scale.setScalar(s);
    this.hud.rotation.set(0, 0, 0);
    this.hud.position.set(halfW - 0.13 * s - 0.03, -halfH + 0.06 * s + 0.03, -d);
    this.desktopList.scale.setScalar(s * 0.92);
    this.desktopList.position.set(-halfW + 0.15 * s * 0.92 + 0.03, halfH - 0.235 * s * 0.92 - 0.03, -d);
  }

  toggleDesktopList() {
    this.desktopListOn = !this.desktopListOn;
  }

  // ---------------------------------------------------------------- UI helpers
  showToast(title, sub = '', { tone = 'info', icon = null, duration = 0 } = {}) {
    const id = (this.toastId = (this.toastId || 0) + 1);
    this.toast.redraw({ title, sub, tone, icon });
    this.toast.visible = true;
    this.toastFollow.init = false;
    const m = this.toast.material;
    const from = m.opacity;
    this.tweens.tween(0.25, (k) => { m.opacity = from + (1 - from) * k; });
    this.toastText = title + (sub ? ' — ' + sub : '');
    if (duration > 0) {
      this.tweens.wait(duration).then(() => { if (this.toastId === id) this.hideToast(); });
    }
  }

  hideToast() {
    const m = this.toast.material;
    const from = m.opacity;
    const id = this.toastId;
    this.tweens.tween(0.3, (k) => { m.opacity = from * (1 - k); }).then(() => {
      if (this.toastId === id) this.toast.visible = false;
    });
    this.toastText = '';
  }

  floatText(str, worldPos) {
    const f = this.floats[this.floatIdx++ % this.floats.length];
    f.redraw({ text: str });
    f.visible = true;
    f.position.copy(worldPos);
    const y0 = worldPos.y;
    this.tweens.tween(1.3, (k) => {
      f.position.y = y0 + k * 0.3;
      f.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      f.quaternion.copy(this.camera.getWorldQuaternion(_q));
    }, Ease.outCubic).then(() => { f.visible = false; });
  }

  refreshHud(flash = 0) {
    const total = this.cartTotal();
    this.hud.redraw({ count: this.cartItems.length, total, listDone: this.listItems.filter((i) => i.checked).length, flash });
    this.hudFlash = flash;
    this.hudText = `Carrito · ${this.cartItems.length} productos · Total acumulado: ${money(total)}`;
  }

  cartTotal() {
    return Math.round(this.cartItems.reduce((s, u) => s + u.product.price, 0) * 100) / 100;
  }

  // ---------------------------------------------------------------- flujo
  reset() {
    this.tweens.clear();
    this.state = 'intro';
    this.lockMove = false;
    this.teleporting = this.walking = false;
    this.cartItems = [];
    this.listItems.forEach((i) => { i.checked = false; });
    this.list.redraw({ items: this.listItems });
    for (const u of this.store.units) {
      u.home.parent.add(u.mesh);
      u.mesh.position.copy(u.home.position);
      u.mesh.quaternion.copy(u.home.quaternion);
      u.mesh.scale.copy(u.home.scale);
      u.mesh.visible = true;
      u.state = 'shelf';
      u.hover = 0;
    }
    for (const [, tag] of this.store.tags) tag.redraw({ inCart: false });
    for (const p of this.pointers) { p.held = null; p.hover = null; }

    // carrito
    const cg = this.cart.group;
    cg.position.set(STORE.cartStart.x, 0, STORE.cartStart.z);
    cg.rotation.set(0, 0, 0);
    this.cart.bags.visible = false;
    this.cart.basket.clear();
    this.cartFollow = false;
    this.cart.glowM.opacity = 0;

    // lista flotante inicial
    this.scene.add(this.list);
    this.list.position.set(-0.75, 1.45, 9.35);
    this.list.rotation.set(0, 0.45, 0);
    this.list.scale.setScalar(1.25);
    this.list.visible = true;

    // caja
    const ck = this.checkout;
    ck.display.redraw({ mode: 'idle', lines: [], count: 0, total: 0 });
    ck.posScreen.redraw({ mode: 'idle', total: 0, spin: 0 });
    ck.led.material.color.set('#333');
    ck.bags.forEach((b) => { b.fill.scale.y = 0.01; b.fill.position.y = 0; b.tops.visible = false; });
    ck.bubble.visible = false;
    ck.cashier.state.scanK = 0;
    ck.laser.material.opacity = 0.25;
    this.beltOn = false;
    this.posRing.material.opacity = 0;

    // tarjeta, recibo, resumen, escena final
    this.card.group.removeFromParent();
    this.card.group.scale.setScalar(1);
    this.card.halo.material.opacity = 0;
    this.cardPointer = null;
    this.receipt.removeFromParent();
    this.receipt.visible = false;
    this.receipt.material.clippingPlanes = null;
    this.receipt.material.needsUpdate = true;
    this.receiptReady = false;
    this.summary.visible = false;
    this.summary.redraw({ thanks: false });
    this.btnFinal.visible = false;
    this.btnRestart.visible = false;
    this.outroTitle.visible = false;
    this.outroSpot.intensity = 0;
    this.cardLight.intensity = 0;
    this.setStoreLights(1);
    this.nfc.active = false;
    this.nfc.rings.forEach((r) => { r.mesh.visible = false; r.t = 1; });

    this.cartBeacon.visible = true;
    this.checkoutBeacon.visible = false;
    this.arrows.visible = false;
    this.productHint.visible = false;
    this.hud.visible = false;
    this.wristList.visible = false;
    this.tooltip.visible = false;
    this.refreshHud();

    if (this.isXR) { this.pendingPlace = STORE.start; this.placeFrames = 0; }
    else { this.pitch = -0.12; this.placePlayer(STORE.start.x, STORE.start.z, STORE.start.yaw); }
  }

  start() {
    this.sfx.unlock();
    this.fadeTo(0, 0.8);
    this.showToast(`Bienvenido a ${BRAND.store}`, 'Toma el carrito para comenzar tus compras de la semana.', { icon: 'cart' });
  }

  async restart() {
    await this.fadeTo(1, 0.6);
    this.reset();
    this.fade.material.opacity = 1;
    this.fade.visible = true;
    this.start();
  }

  takeCart() {
    if (this.state !== 'intro') return;
    this.state = 'shopping';
    this.sfx.grab();
    this.cartBeacon.visible = false;
    this.cartFollow = true;
    this.cartHeading = this.cartHeadingTarget = this.headYaw();
    this.hud.visible = true;
    this.refreshHud();
    // la lista pasa al soporte del carrito
    const L = this.list;
    this.cart.listMount.attach(L);
    const p0 = L.position.clone(), q0 = L.quaternion.clone(), s0 = L.scale.x;
    this.tweens.tween(0.9, (k) => {
      L.position.lerpVectors(p0, _v.set(0, 0, 0), k);
      L.quaternion.slerpQuaternions(q0, _q.identity(), k);
      L.scale.setScalar(s0 + (0.9 - s0) * k);
    });
    const how = this.capture
      ? 'Cada producto que tomas se marca en tu lista y suma al total.'
      : this.isXR
      ? 'Apunta a un producto y mantén el gatillo (o pellizca) para tomarlo; suéltalo sobre el carrito.'
      : 'Haz clic en un producto para tomarlo y vuelve a hacer clic para ponerlo en el carrito.';
    this.showToast('Busca los productos de tu lista', how, { icon: 'list', duration: 8 });
  }

  // ---------------------------------------------------------------- selección
  onSelectStart(p) {
    this.sfx.unlock();
    const t = p.hover;

    if (p.held && p.held !== 'card' && p.sticky) {
      this.placeOrReturn(p);
      return;
    }
    if (t) {
      if (t.kind === 'button') { this.sfx.click(); t.onSelect(); return; }
      if (t.kind === 'cart' && this.state === 'intro') { this.takeCart(); return; }
      if (t.kind === 'product') { this.trySelectProduct(p, t); return; }
      if (t.kind === 'card' && this.state === 'payPrompt') { this.takeCard(p); return; }
      if (t.kind === 'pos' && this.state === 'cardOut' && this.cardPointer) { this.moveCardToPos(); return; }
      if (t.kind === 'receipt' && this.receiptReady) { this.takeReceipt(); return; }
      return;
    }
    if (p.floor && !this.lockMove) {
      if (p.type === 'xr') this.teleport(p.floor.x, p.floor.z);
      else this.walkTo(p.floor.x, p.floor.z);
    }
  }

  onSelectEnd(p, force = false) {
    if (p.sticky && !force) return;
    if (p.held && p.held !== 'card') this.placeOrReturn(p);
  }

  trySelectProduct(p, unit) {
    if (unit.state !== 'shelf') return;
    if (this.state === 'intro') {
      this.sfx.deny();
      this.showToast('Primero toma el carrito', 'Está junto a la entrada.', { tone: 'warn', icon: 'cart', duration: 3 });
      return;
    }
    if (this.state !== 'shopping') return;
    if (p.held) return;
    const prod = unit.product;
    if (!prod.list) {
      this.sfx.deny();
      this.wiggle(unit);
      this.showToast(`${prod.name} no está en tu lista`, 'Compra solo lo planeado y controla tu gasto.', { tone: 'warn', icon: 'list', duration: 3 });
      return;
    }
    if (this.cartItems.some((u) => u.product.id === prod.id)) {
      this.sfx.deny();
      this.wiggle(unit);
      this.showToast(`Ya tienes ${prod.name.toLowerCase()} en tu carrito`, 'Revisa tu lista de compras.', { tone: 'warn', icon: 'list', duration: 3 });
      return;
    }
    this.grab(p, unit);
  }

  wiggle(unit) {
    const m = unit.mesh;
    const r0 = m.rotation.z;
    this.tweens.tween(0.45, (k) => { m.rotation.z = r0 + Math.sin(k * Math.PI * 4) * 0.12 * (1 - k); }, Ease.linear);
  }

  grab(p, unit) {
    unit.state = 'held';
    p.held = unit;
    this.sfx.grab();
    const m = unit.mesh;
    p.anchor.attach(m);
    const p0 = m.position.clone(), q0 = m.quaternion.clone();
    const size = m.userData.size;
    const target = new THREE.Vector3(0, -size.y / 2, 0);
    const qT = p.type === 'xr' ? new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, 0, 0)) : new THREE.Quaternion().setFromEuler(new THREE.Euler(0.15, -0.25, 0));
    this.tweens.tween(0.38, (k) => {
      if (unit.state !== 'held') return;
      m.position.lerpVectors(p0, target, k);
      m.quaternion.slerpQuaternions(q0, qT, k);
    }, Ease.outCubic);
    if (p.type === 'mouse' && !this.hintsShown.has('place')) {
      this.hintsShown.add('place');
      this.showToast(`Tomaste: ${unit.product.name}`, 'Haz clic otra vez para colocarlo en el carrito.', { icon: 'cart', duration: 4 });
    }
  }

  basketWorld(out = new THREE.Vector3()) {
    return this.cart.group.localToWorld(out.set(0, 0.75, -0.05));
  }

  placeOrReturn(p) {
    const unit = p.held;
    p.held = null;
    if (!unit) return;
    const a = p.anchor.getWorldPosition(_v);
    const near = a.distanceTo(this.basketWorld(_v2)) < (p.type === 'xr' ? 1.5 : 4);
    if (this.cartFollow && near) this.placeInCart(unit);
    else this.returnToShelf(unit);
  }

  async placeInCart(unit) {
    unit.state = 'moving';
    const idx = this.cartItems.length;
    this.cartItems.push(unit);
    const m = unit.mesh;
    this.cart.basket.attach(m);
    const p0 = m.position.clone(), q0 = m.quaternion.clone(), s0 = m.scale.x;
    const slot = this.cart.slots[Math.min(idx, this.cart.slots.length - 1)];
    const big = Math.max(m.userData.size.x, m.userData.size.z);
    const sT = big > 0.2 ? 0.62 : 0.8;
    const qT = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (idx * 1.37) % 0.9 - 0.45, 0));
    this.sfx.whoosh();
    await this.tweens.tween(0.6, (k) => {
      m.position.lerpVectors(p0, slot, k);
      m.position.y += Math.sin(Math.PI * k) * 0.18;
      m.quaternion.slerpQuaternions(q0, qT, k);
      m.scale.setScalar(s0 + (sT - s0) * k);
    }, Ease.inOutCubic);
    unit.state = 'cart';
    unit.proxy.visible = false;
    this.sfx.pop();
    const li = this.listItems.find((i) => i.id === unit.product.id);
    if (li) li.checked = true;
    this.list.redraw({ items: this.listItems });
    this.store.tags.get(unit.product.id)?.redraw({ inCart: true });
    this.refreshHud(1);
    this.floatText('+' + money(unit.product.price), this.basketWorld(_v).add(_v2.set(0, 0.25, 0)));
    if (this.listItems.every((i) => i.checked) && this.state === 'shopping') this.onListComplete();
  }

  returnToShelf(unit) {
    const m = unit.mesh;
    unit.state = 'moving';
    unit.home.parent.attach(m);
    const p0 = m.position.clone(), q0 = m.quaternion.clone();
    this.tweens.tween(0.5, (k) => {
      m.position.lerpVectors(p0, unit.home.position, k);
      m.quaternion.slerpQuaternions(q0, unit.home.quaternion, k);
    }).then(() => { unit.state = 'shelf'; });
    this.showToast('Suelta el producto sobre el carrito', 'Acércalo a la canasta antes de soltarlo.', { tone: 'warn', icon: 'cart', duration: 3 });
  }

  onListComplete() {
    this.state = 'listDone';
    this.sfx.chime();
    this.productHint.visible = false;
    this.checkoutBeacon.visible = true;
    this.arrows.visible = true;
    this.showToast('Lista completada ✓', 'Dirígete a la caja para pagar.', { tone: 'success', icon: 'check' });
  }

  // ---------------------------------------------------------------- caja
  async runCheckout() {
    this.state = 'checkout';
    this.lockMove = true;
    this.checkoutBeacon.visible = false;
    this.arrows.visible = false;
    this.wristList.visible = false;
    await this.fadeTo(1, 0.35);
    this.cartFollow = false;
    const cg = this.cart.group;
    cg.position.set(CHECKOUT.cartPark.x, 0, CHECKOUT.cartPark.z);
    cg.rotation.set(0, CHECKOUT.cartPark.yaw, 0);
    this.list.visible = false;
    const s = CHECKOUT.playerSpot;
    if (!this.isXR) this.pitch = -0.32;
    this.placePlayer(s.x, s.z, s.yaw);
    await this.fadeTo(0, 0.45);

    const ck = this.checkout;
    ck.display.redraw({ mode: 'scanning', lines: [], count: 0, total: 0 });
    this.showToast('Registrando productos...', 'El cajero pasa cada producto por el lector.', { icon: 'cart' });
    ck.cashier.state.scanK = 1;
    this.beltOn = true;
    this.scanLines = [];
    const items = [...this.cartItems];
    const jobs = [];
    for (let i = 0; i < items.length; i++) {
      jobs.push(this.scanItem(items[i], i));
      await this.tweens.wait(0.62);
    }
    await Promise.all(jobs);
    this.beltOn = false;
    ck.cashier.state.scanK = 0;
    const total = this.cartTotal();
    ck.display.redraw({ mode: 'total', count: items.length, total });
    await this.tweens.wait(0.6);
    this.cashierSay(`Su total es ${money(total)}.`);
    ck.posScreen.redraw({ mode: 'amount', total });
    this.showToast(`Productos: ${items.length} · Total: ${money(total)}`, 'Revisa tu total en la pantalla de la caja.', { tone: 'pay', icon: 'cart' });
    await this.tweens.wait(2.4);
    this.offerCard();
  }

  async scanItem(unit, i) {
    const ck = this.checkout;
    const m = unit.mesh;
    this.scene.attach(m);
    const p0 = m.position.clone(), q0 = m.quaternion.clone(), s0 = m.scale.x;
    const a = CHECKOUT.beltStart.clone().add(_v.set(0, -0.012, ((i % 3) - 1) * 0.06));
    const qT = new THREE.Quaternion();
    const sT = Math.max(m.userData.size.x, m.userData.size.z) > 0.2 ? 0.7 : 0.85;
    await this.tweens.tween(0.5, (k) => {
      m.position.lerpVectors(p0, a, k);
      m.position.y += Math.sin(Math.PI * k) * 0.25;
      m.quaternion.slerpQuaternions(q0, qT, k);
      m.scale.setScalar(s0 + (sT - s0) * k);
    });
    const xS = CHECKOUT.scanner.x - 0.02;
    await this.tweens.tween(0.85, (k) => { m.position.x = a.x + (xS - a.x) * k; m.position.z = a.z + (5.0 - a.z) * k; }, Ease.inOutSine);
    this.sfx.beep();
    ck.laser.material.opacity = 1;
    ck.laserGlass.material.opacity = 1;
    this.scanLines.push({ name: unit.product.name + ' ' + unit.product.detail, price: unit.product.price });
    const subtotal = this.scanLines.reduce((s, l) => s + l.price, 0);
    ck.display.redraw({ mode: 'scanning', lines: this.scanLines, count: this.scanLines.length, total: subtotal });
    const bag = ck.bags[i % 2];
    const b = bag.g.getWorldPosition(_v2).clone().add(_v.set(0, 0.32, 0));
    const p1 = m.position.clone();
    await this.tweens.tween(0.32, (k) => { m.position.x = p1.x + 0.32 * k; }, Ease.linear);
    const p2 = m.position.clone();
    await this.tweens.tween(0.45, (k) => {
      m.position.lerpVectors(p2, b, k);
      m.position.y += Math.sin(Math.PI * k) * 0.12;
      m.scale.setScalar(sT * (1 - k * 0.85));
    });
    m.visible = false;
    unit.state = 'gone';
    const n = Math.ceil((i + 1) / 2);
    bag.fill.scale.y = Math.min(1, n / 7) * 0.95;
    bag.fill.position.y = bag.fill.scale.y * 0.15;
    if (n >= 4) bag.tops.visible = true;
  }

  cashierSay(textStr) {
    const b = this.checkout.bubble;
    b.redraw({ text: textStr });
    b.visible = true;
    b.scale.setScalar(0.01);
    this.tweens.tween(0.35, (k) => b.scale.setScalar(Math.max(0.01, k)), Ease.outBack);
    say(textStr);
  }

  offerCard() {
    this.state = 'payPrompt';
    const g = this.card.group;
    this.scene.add(g);
    const h = this.headPos(new THREE.Vector3());
    const yaw = this.headYaw();
    const f = this.forward(yaw, new THREE.Vector3());
    const right = new THREE.Vector3(-f.z, 0, f.x);
    const target = h.clone().addScaledVector(f, 0.42).addScaledVector(right, 0.08).add(_v.set(0, -0.22, 0));
    this.cardOfferPos = target.clone();
    g.position.copy(target).add(_v.set(0, -0.3, 0));
    g.lookAt(h);
    const q = g.quaternion.clone();
    g.scale.setScalar(0.01);
    this.card.halo.material.opacity = 0.8;
    this.sfx.whoosh();
    this.tweens.tween(1.0, (k) => {
      g.position.copy(target).add(_v.set(0, -0.3 * (1 - k), 0));
      g.quaternion.copy(q).multiply(_q.setFromAxisAngle(_v2.set(0, 1, 0), (1 - k) * Math.PI * 2));
      g.scale.setScalar(Math.max(0.01, k));
    }, Ease.outCubic);
    const how = this.capture ? 'Saca tu tarjeta para pagar sin contacto.'
      : this.isXR ? 'Toma tu tarjeta con el gatillo o pellizcando.' : 'Haz clic en la tarjeta para sacarla.';
    this.showToast('Utiliza tu AsentliCard para realizar el pago.', how, { tone: 'pay', icon: 'card' });
  }

  takeCard(p) {
    this.state = 'cardOut';
    this.cardPointer = p;
    p.held = 'card';
    const g = this.card.group;
    p.anchor.attach(g);
    const p0 = g.position.clone(), q0 = g.quaternion.clone();
    const posT = p.type === 'xr' ? new THREE.Vector3(0, 0.0, -0.02) : new THREE.Vector3(-0.07, 0.07, 0.08);
    const qT = new THREE.Quaternion().setFromEuler(p.type === 'xr' ? new THREE.Euler(-1.15, 0, 0) : new THREE.Euler(-0.25, 0.25, 0.05));
    this.sfx.grab();
    this.tweens.tween(0.45, (k) => {
      g.position.lerpVectors(p0, posT, k);
      g.quaternion.slerpQuaternions(q0, qT, k);
      this.card.halo.material.opacity = 0.8 * (1 - k);
    }, Ease.outCubic);
    this.posRingOn = true;
    const how = this.capture ? 'Acércala a la pantalla de la terminal POS.'
      : this.isXR ? 'Acerca la tarjeta a la pantalla de la terminal.' : 'Haz clic en la terminal POS para acercar la tarjeta.';
    this.showToast('Acerca tu AsentliCard a la terminal', how, { tone: 'pay', icon: 'card' });
  }

  async moveCardToPos() {
    if (this.state !== 'cardOut') return;
    this.state = 'tapping';
    const g = this.card.group;
    this.scene.attach(g);
    const p0 = g.position.clone(), q0 = g.quaternion.clone();
    const tz = this.checkout.tapZone;
    tz.updateWorldMatrix(true, false);
    const pT = tz.getWorldPosition(new THREE.Vector3());
    const qT = tz.getWorldQuaternion(new THREE.Quaternion());
    await this.tweens.tween(0.7, (k) => {
      g.position.lerpVectors(p0, pT, k);
      g.position.y += Math.sin(Math.PI * k) * 0.05;
      g.quaternion.slerpQuaternions(q0, qT, k);
    });
    this.cardAtPos = true;
    this.startTap();
  }

  async startTap() {
    this.state = 'tapping';
    this.posRingOn = false;
    const ck = this.checkout;
    const total = this.cartTotal();
    ck.posScreen.redraw({ mode: 'detected', total });
    this.sfx.detect();
    this.showToast('Tarjeta detectada', 'Mantén la tarjeta cerca de la terminal.', { tone: 'pay', icon: 'card' });
    this.nfc.active = true;
    await this.tweens.wait(1.0);
    ck.posScreen.redraw({ mode: 'processing', total, spin: 0 });
    this.processing = true;
    this.showToast('Procesando pago...', 'Comunicación segura sin contacto (NFC).', { tone: 'pay', icon: 'card' });
    await this.tweens.wait(2.6);
    this.processing = false;
    this.nfc.active = false;
    ck.posScreen.redraw({ mode: 'approved', total });
    ck.led.material.color.set(C.green);
    ck.display.redraw({ mode: 'approved', count: this.cartItems.length, total });
    this.sfx.approve();
    this.state = 'approved';
    this.showToast('PAGO APROBADO ✓', `${money(total)} pagados con AsentliCard`, { tone: 'success', icon: 'check' });
    this.cashierSay('¡Pago aprobado! Gracias por su compra.');
    await this.tweens.wait(1.8);
    this.showToast('Retira tu tarjeta', 'Tu comprobante se está imprimiendo.', { tone: 'pay', icon: 'card' });
    const g = this.card.group;
    const p = this.cardPointer;
    if (this.cardAtPos || !p || !p.active) {
      const anchor = p && p.active ? p.anchor : null;
      if (anchor) {
        anchor.attach(g);
        const p0 = g.position.clone(), q0 = g.quaternion.clone();
        const posT = p.type === 'xr' ? new THREE.Vector3(0, 0, -0.02) : new THREE.Vector3(-0.07, 0.07, 0.08);
        const qT = new THREE.Quaternion().setFromEuler(p.type === 'xr' ? new THREE.Euler(-1.15, 0, 0) : new THREE.Euler(-0.25, 0.25, 0.05));
        await this.tweens.tween(0.6, (k) => {
          g.position.lerpVectors(p0, posT, k);
          g.quaternion.slerpQuaternions(q0, qT, k);
        });
      }
      await this.tweens.wait(0.5);
    } else {
      // En VR: esperar a que el usuario aleje la tarjeta (máx. 4 s)
      let t = 0;
      while (t < 4) {
        await this.tweens.wait(0.1);
        t += 0.1;
        if (this.cardDistanceToPos() > 0.2) break;
      }
    }
    const s0 = g.scale.x;
    await this.tweens.tween(0.4, (k) => g.scale.setScalar(Math.max(0.001, s0 * (1 - k))), Ease.inCubic);
    g.removeFromParent();
    g.scale.setScalar(1);
    if (p) p.held = null;
    this.cardAtPos = false;
    this.printReceipt();
  }

  cardDistanceToPos() {
    const a = this.card.group.getWorldPosition(_v);
    const b = this.checkout.tapZone.getWorldPosition(_v2);
    return a.distanceTo(b);
  }

  async printReceipt() {
    this.state = 'receipt';
    const ck = this.checkout;
    const r = this.receipt;
    const now = this.fixedDate || new Date();
    r.redraw({
      lines: this.cartItems.map((u) => ({ name: u.product.listName || u.product.name, price: u.product.price })),
      count: this.cartItems.length,
      total: this.cartTotal(),
      date: now.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) + ' · ' + now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
    });
    ck.printer.add(r);
    r.visible = true;
    r.position.set(0, 0.121 - 0.33 / 2, 0.05);
    r.rotation.set(0, 0, 0);
    r.scale.setScalar(1);
    ck.printer.updateWorldMatrix(true, true);
    const slotY = ck.printer.localToWorld(_v.set(0, 0.121, 0.05)).y;
    r.material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -slotY)];
    r.material.needsUpdate = true;
    this.sfx.print(2.6);
    this.showToast('Imprimiendo comprobante...', '', { tone: 'pay', icon: 'list' });
    await this.tweens.tween(2.6, (k) => { r.position.y = 0.121 - 0.165 + k * 0.335; }, Ease.linear);
    r.material.clippingPlanes = null;
    r.material.needsUpdate = true;
    this.receiptReady = true;
    const how = this.capture ? 'Tu ticket salió de la impresora del POS.'
      : this.isXR ? 'Apunta al ticket y presiona el gatillo.' : 'Haz clic en el ticket que salió de la impresora.';
    this.showToast('Toma tu comprobante', how, { tone: 'pay', icon: 'list' });
    const token = this.receiptToken = {};
    await this.tweens.wait(8);
    if (AUTO && this.receiptReady && this.receiptToken === token) this.takeReceipt();
  }

  async takeReceipt() {
    if (!this.receiptReady) return;
    this.receiptReady = false;
    this.state = 'summary';
    this.hideToast();
    const r = this.receipt;
    this.scene.attach(r);
    const h = this.headPos(new THREE.Vector3());
    const yaw = this.headYaw();
    const f = this.forward(yaw, new THREE.Vector3());
    const right = new THREE.Vector3(-f.z, 0, f.x);
    const pT = h.clone().addScaledVector(f, 0.5).addScaledVector(right, -0.2).add(_v.set(0, -0.08, 0));
    const dummy = new THREE.Object3D();
    dummy.position.copy(pT);
    dummy.lookAt(h);
    const p0 = r.position.clone(), q0 = r.quaternion.clone();
    this.sfx.grab();
    await this.tweens.tween(0.8, (k) => {
      r.position.lerpVectors(p0, pT, k);
      r.quaternion.slerpQuaternions(q0, dummy.quaternion, k);
    });
    // Resumen
    const s = this.summary;
    s.redraw({ count: this.cartItems.length, total: this.cartTotal(), thanks: false });
    const sp = h.clone().addScaledVector(f, 0.9).addScaledVector(right, 0.22).add(_v.set(0, 0.0, 0));
    s.position.copy(sp);
    s.lookAt(h);
    s.visible = true;
    s.scale.setScalar(0.01);
    this.sfx.chime();
    await this.tweens.tween(0.5, (k) => s.scale.setScalar(Math.max(0.01, k)), Ease.outBack);
    await this.tweens.wait(3);
    s.redraw({ thanks: true });
    say(BRAND.thanks);
    const b = this.btnFinal;
    b.position.copy(sp).add(_v.set(0, -0.32, 0));
    b.quaternion.copy(s.quaternion);
    b.visible = !this.capture;
    const token = this.summaryToken = {};
    await this.tweens.wait(9);
    if (AUTO && this.state === 'summary' && this.summaryToken === token) this.goOutro();
  }

  setStoreLights(k) {
    const d = this.lightDefaults;
    this.hemi.intensity = d.hemi * (0.18 + 0.82 * k);
    this.sun.intensity = d.sun * (0.1 + 0.9 * k);
    this.scene.environmentIntensity = d.env * (0.3 + 0.7 * k);
    this.scene.background.copy(d.bg).lerp(new THREE.Color('#0B1F18'), 1 - k);
  }

  async goOutro() {
    if (this.state === 'outro') return;
    this.state = 'outro';
    this.btnFinal.visible = false;
    await this.fadeTo(1, 0.8);
    this.hideToast();
    this.receipt.visible = false;
    this.summary.visible = false;
    this.hud.visible = false;
    this.list.visible = false;
    this.checkout.bubble.visible = false;
    this.cartBeacon.visible = this.checkoutBeacon.visible = this.arrows.visible = false;
    this.productHint.visible = false;
    this.setStoreLights(0);
    const cg = this.cart.group;
    cg.position.set(OUTRO_STAGE.x, 0, OUTRO_STAGE.z);
    cg.rotation.set(0, 0, 0);
    this.cart.bags.visible = true;
    const g = this.card.group;
    this.scene.add(g);
    g.position.set(OUTRO_STAGE.x, 1.4, OUTRO_STAGE.z + 0.15);
    g.rotation.set(0, 0, 0);
    g.scale.setScalar(4.2);
    this.card.halo.material.opacity = 1;
    this.cardLight.position.set(OUTRO_STAGE.x, 1.5, OUTRO_STAGE.z + 0.45);
    this.cardLight.intensity = 2.2;
    this.outroSpot.intensity = 28;
    const t = this.outroTitle;
    t.redraw({ a: 0, b: 0 });
    t.position.set(OUTRO_STAGE.x, 2.3, OUTRO_STAGE.z - 0.9);
    t.rotation.set(0, 0, 0);
    t.visible = true;
    if (!this.isXR) this.pitch = 0.1;
    this.placePlayer(OUTRO_STAGE.x, OUTRO_STAGE.z + 1.55, 0);
    await this.fadeTo(0, 1.0);
    this.sfx.chime();
    await this.tweens.tween(1.2, (k) => t.redraw({ a: k }));
    say(BRAND.tagline);
    await this.tweens.wait(0.4);
    await this.tweens.tween(1.0, (k) => t.redraw({ b: k }));
    await this.tweens.wait(2.0);
    const b = this.btnRestart;
    b.position.set(OUTRO_STAGE.x + 0.85, 1.15, OUTRO_STAGE.z + 0.55);
    b.rotation.set(0, -0.45, 0);
    b.visible = !this.capture;
    if (EXPO) {
      await this.tweens.wait(25);
      if (this.state === 'outro') this.restart();
    }
  }

  // ---------------------------------------------------------------- frame
  targets() {
    const list = [];
    const s = this.state;
    if (s === 'intro' || s === 'shopping') {
      for (const u of this.store.units) if (u.state === 'shelf') list.push(u.proxy);
    }
    if (s === 'intro') list.push(this.cart.proxy);
    if (s === 'payPrompt') list.push(this.card.proxy);
    if (s === 'cardOut') list.push(this.checkout.posProxy);
    if (this.receiptReady) list.push(this.receipt);
    for (const b of [this.btnFinal, this.btnRestart]) if (b.visible) list.push(b);
    return list;
  }

  updatePointer(p) {
    if (p.type === 'mouse') this.desktop.updateRay();
    else updateXRRay(p);
    const hits = p.ray.intersectObjects(this.targets(), false);
    let hover = null, dist = Infinity;
    if (hits.length) { hover = hits[0].object.userData.target; dist = hits[0].distance; p.hitPoint = hits[0].point; }
    // Piso (caminar / teletransporte)
    p.floor = null;
    if (!hover && !this.lockMove && !p.held) {
      const r = p.ray.ray;
      if (r.direction.y < -0.05) {
        const t = -r.origin.y / r.direction.y;
        if (t > 0 && t < 9) {
          const pt = r.at(t, new THREE.Vector3());
          let occluded = false;
          for (const b of this.obstacles) {
            const hit = r.intersectBox(b, _v);
            if (hit && r.origin.distanceTo(hit) < t) { occluded = true; break; }
          }
          if (!occluded && !this.blocked(pt.x, pt.z, 0.25)) { p.floor = pt; dist = t; }
        }
      }
    }
    p.hover = hover;
    p.hoverDist = dist;
  }

  update(dt) {
    this.time += dt;
    const t = this.time;
    // En VR la pose de la cabeza llega tras el primer render: recolocar unos cuadros después.
    if (this.pendingPlace && this.isXR && ++this.placeFrames > 2) {
      const s = this.pendingPlace;
      this.pendingPlace = null;
      this.placePlayer(s.x, s.z, s.yaw);
      if (this.cartFollow) { this.cartHeading = this.cartHeadingTarget = this.headYaw(); this.snapCart(); }
    }
    this.tweens.update(dt);

    // Movimiento de escritorio
    this.movedRecently = Math.max(0, (this.movedRecently || 0) - dt);
    if (!this.isXR) {
      const { f, s, turn } = this.desktop.moveInput();
      if (turn) this.look(turn * dt * 1.6, 0);
      if ((f || s) && !this.lockMove) {
        const yaw = this.rig.rotation.y;
        const fw = this.forward(yaw, _v);
        const rt = _v2.set(-fw.z, 0, fw.x);
        const sp = 2.0 * dt;
        const dx = (fw.x * f + rt.x * s) * sp, dz = (fw.z * f + rt.z * s) * sp;
        const x = this.rig.position.x, z = this.rig.position.z;
        if (!this.blocked(x + dx, z)) this.rig.position.x += dx;
        if (!this.blocked(this.rig.position.x, z + dz)) this.rig.position.z += dz;
        if (f > 0) this.movedRecently = 0.3;
      }
    } else {
      for (const p of this.xrPointers) {
        if (!p.active) continue;
        const dir = readSnapTurn(p);
        if (dir && !this.teleporting) {
          const h = this.headPos(_v).clone();
          this.rig.rotation.y -= dir * Math.PI / 6;
          this.rig.updateMatrixWorld(true);
          const h2 = this.headPos(_v2);
          this.rig.position.x += h.x - h2.x;
          this.rig.position.z += h.z - h2.z;
        }
      }
    }

    // Punteros
    const hovered = new Set();
    for (const p of this.pointers) {
      if (!p.active || (p.type === 'mouse' && this.isXR) || (p.type === 'xr' && !this.isXR)) {
        p.hover = null; p.floor = null;
        if (p.reticle) p.reticle.visible = false;
        continue;
      }
      this.updatePointer(p);
      if (p.hover) hovered.add(p.hover);
      if (p.type === 'xr') {
        const len = Math.min(p.hoverDist, 3);
        p.line.scale.z = len;
        p.line.material.color.set(p.hover || p.floor ? C.orange : C.eggshell);
        p.line.material.opacity = p.hover || p.floor ? 0.95 : 0.4;
        p.reticle.visible = !!p.floor || !!p.hover;
        if (p.floor) {
          p.reticle.position.copy(p.floor).setY(0.01);
          p.reticle.rotation.set(-Math.PI / 2, 0, 0);
          p.reticle.scale.setScalar(12);
        } else if (p.hover) {
          p.reticle.position.copy(p.hitPoint);
          p.reticle.quaternion.copy(this.camera.getWorldQuaternion(_q));
          p.reticle.scale.setScalar(1);
        }
      }
    }
    if (!this.isXR) this.desktop.setCursor(hovered.size ? 'pointer' : (this.desktop.pointer.floor ? 'crosshair' : 'grab'));

    // Resaltado de productos
    let tipUnit = null;
    for (const u of this.store.units) {
      const want = hovered.has(u) ? 1 : 0;
      if (want) tipUnit = u;
      if (u.hover !== want || (u.hover > 0 && u.hover < 1)) {
        u.hover += (want - u.hover) * Math.min(1, dt * 14);
        if (Math.abs(u.hover - want) < 0.01) u.hover = want;
        if (u.state === 'shelf') u.mesh.scale.setScalar(u.home.scale.x * (1 + 0.08 * u.hover));
      }
    }
    for (const b of [this.btnFinal, this.btnRestart]) b.userData.target.setHover(hovered.has(b.userData.target));
    this.updateTooltip(tipUnit);

    // Carrito
    this.updateCart(dt, hovered);

    // HUD
    if (this.hudFlash > 0) {
      this.hudFlash = Math.max(0, this.hudFlash - dt * 1.6);
      if (Math.floor(t * 20) !== this.hudFrame) {
        this.hudFrame = Math.floor(t * 20);
        this.hud.redraw({ flash: this.hudFlash });
      }
    }
    this.desktopList.visible = !this.isXR && this.desktopListOn && ['shopping', 'listDone'].includes(this.state);
    const showWrist = this.isXR && ['shopping', 'listDone'].includes(this.state);
    // En escritorio la lista del carrito queda demasiado cerca de la cámara: se usa la del HUD.
    if (this.list.parent === this.cart.listMount) this.list.visible = this.isXR && showWrist;
    this.wristList.visible = showWrist && !!this.wristList.parent;

    this.updateToast(dt);

    // Indicadores
    if (this.cartBeacon.visible) this.bobBeacon(this.cartBeacon, this.cart.group.position, 1.45, t);
    if (this.checkoutBeacon.visible) this.bobBeacon(this.checkoutBeacon, this.checkoutBeacon.position, 1.9, t);
    if (this.arrows.visible) this.arrows.children.forEach((a, i) => { a.material.opacity = 0.45 + 0.45 * Math.max(0, Math.sin(t * 4 - i * 0.6)); });
    this.updateProductHint(t);

    // Caja
    const ck = this.checkout;
    if (this.beltOn) ck.beltTex.offset.y -= dt * 0.9;
    ck.laser.material.opacity += (0.25 - ck.laser.material.opacity) * Math.min(1, dt * 8);
    ck.laserGlass.material.opacity = ck.laser.material.opacity;
    ck.cashier.update(dt, t, this.headPos(_v).clone());
    this.posRing.material.opacity = this.posRingOn ? 0.45 + 0.4 * Math.sin(t * 5) : 0;
    this.posRing.scale.setScalar(1 + 0.15 * Math.sin(t * 5));
    if (this.processing && Math.floor(t * 30) !== this.spinFrame) {
      this.spinFrame = Math.floor(t * 30);
      ck.posScreen.redraw({ spin: t * 7 });
    }

    // Tarjeta
    if (this.state === 'payPrompt' && this.cardOfferPos) {
      const g = this.card.group;
      if (g.parent === this.scene && g.scale.x > 0.99) g.position.y = this.cardOfferPos.y + Math.sin(t * 2.2) * 0.012;
      this.card.halo.material.opacity = hovered.has(this.card.proxy.userData.target) ? 1 : 0.65 + 0.15 * Math.sin(t * 3);
    }
    if (this.state === 'cardOut' && this.isXR && this.cardPointer && this.cardPointer.type === 'xr') {
      if (this.cardDistanceToPos() < 0.1) this.startTap();
    }
    this.updateNfc(dt);
    if (this.state === 'outro') {
      const g = this.card.group;
      g.position.y = 1.4 + Math.sin(t * 1.4) * 0.04;
      g.rotation.y = Math.sin(t * 0.6) * 0.5;
      g.rotation.x = -0.12;
      this.card.halo.material.opacity = 0.75 + 0.25 * Math.sin(t * 2);
    }

    // Llegada a la caja
    if (this.state === 'listDone') {
      const h = this.headPos(_v);
      if (CHECKOUT.zone.containsPoint(_v2.set(h.x, 1, h.z))) this.runCheckout();
    }
  }

  bobBeacon(b, pos, height, t) {
    const { cone, ring, tag } = b.userData;
    b.position.set(pos.x, 0.01, pos.z);
    cone.position.y = height + Math.sin(t * 3) * 0.05;
    cone.rotation.y = t * 1.5;
    ring.scale.setScalar(1 + 0.08 * Math.sin(t * 3));
    if (tag) {
      tag.position.y = height + 0.2;
      const h = this.headPos(_v);
      tag.rotation.set(0, Math.atan2(h.x - pos.x, h.z - pos.z), 0);
    }
  }

  updateProductHint(t) {
    const m = this.productHint;
    if (!GUIDE || this.state !== 'shopping') { m.visible = false; return; }
    const h = this.headPos(_v);
    let best = null, bd = Infinity;
    for (const u of this.store.units) {
      if (u.state !== 'shelf' || !u.product.list) continue;
      if (this.cartItems.some((c) => c.product.id === u.product.id)) continue;
      const w = u.mesh.getWorldPosition(_v2);
      const d = w.distanceTo(h);
      if (d < bd) { bd = d; best = u; }
    }
    if (!best) { m.visible = false; return; }
    const w = best.mesh.getWorldPosition(_v2);
    m.visible = true;
    m.position.set(w.x, w.y + best.mesh.userData.size.y + 0.1 + Math.sin(t * 4) * 0.02, w.z);
    m.rotation.y = t * 2;
  }

  updateTooltip(unit) {
    const tip = this.tooltip;
    if (!unit || unit.state !== 'shelf') { tip.visible = false; this.tipUnit = null; return; }
    if (this.tipUnit !== unit) {
      this.tipUnit = unit;
      const p = unit.product;
      const inCart = this.cartItems.some((u) => u.product.id === p.id);
      tip.redraw({
        title: p.name, price: p.price,
        sub: inCart ? 'Ya está en tu carrito ✓' : p.list ? `${p.detail} · En tu lista` : `${p.detail} · No está en tu lista`,
        status: inCart ? 'cart' : p.list ? 'list' : 'other',
      });
    }
    const w = unit.mesh.getWorldPosition(_v);
    const h = this.headPos(_v2);
    const toHead = h.clone().sub(w).normalize();
    tip.position.copy(w).add(_v2.set(0, unit.mesh.userData.size.y + 0.07, 0)).addScaledVector(toHead, 0.08);
    tip.quaternion.copy(this.camera.getWorldQuaternion(_q));
    tip.visible = true;
  }

  updateCart(dt, hovered) {
    const cg = this.cart.group;
    if (this.cartFollow) {
      const h = this.headPos(_v);
      const yaw = this.headYaw();
      if (this.movedRecently > 0 || Math.abs(angleDiff(this.cartHeadingTarget, yaw)) > 0.95) this.cartHeadingTarget = yaw;
      this.cartHeading = lerpAngle(this.cartHeading, this.cartHeadingTarget, 1 - Math.exp(-dt * 2.5));
      const f = this.forward(this.cartHeading, _v2);
      const dist = this.capture ? 0.85 : this.isXR ? 0.62 : 0.95;
      let x = h.x + f.x * dist, z = h.z + f.z * dist;
      for (const b of this.obstacles) {
        const pad = 0.3;
        if (x > b.min.x - pad && x < b.max.x + pad && z > b.min.z - pad && z < b.max.z + pad) {
          const dl = x - (b.min.x - pad), dr = (b.max.x + pad) - x, db = z - (b.min.z - pad), df = (b.max.z + pad) - z;
          const m = Math.min(dl, dr, db, df);
          if (m === dl) x = b.min.x - pad; else if (m === dr) x = b.max.x + pad; else if (m === db) z = b.min.z - pad; else z = b.max.z + pad;
        }
      }
      const k = 1 - Math.exp(-dt * 5);
      cg.position.x += (x - cg.position.x) * k;
      cg.position.z += (z - cg.position.z) * k;
      cg.rotation.y = lerpAngle(cg.rotation.y, this.cartHeading, k);
    }
    // Resaltar canasta cuando se sostiene un producto cerca
    let glow = 0;
    for (const p of this.pointers) {
      if (p.held && p.held !== 'card' && p.held.state === 'held') {
        const d = p.anchor.getWorldPosition(_v).distanceTo(this.basketWorld(_v2));
        glow = Math.max(glow, p.type === 'xr' ? THREE.MathUtils.clamp(1.6 - d, 0, 1) : 0.7);
      }
    }
    if (this.state === 'intro' && hovered.has(this.cart.proxy.userData.target)) glow = 1;
    this.cart.glowM.opacity += (glow * 0.85 - this.cart.glowM.opacity) * Math.min(1, dt * 10);
  }

  snapCart() {
    const h = this.headPos(_v);
    const f = this.forward(this.cartHeading, _v2);
    const dist = this.capture ? 0.85 : this.isXR ? 0.62 : 0.95;
    this.cart.group.position.set(h.x + f.x * dist, 0, h.z + f.z * dist);
    this.cart.group.rotation.y = this.cartHeading;
  }

  updateToast(dt) {
    if (!this.toast.visible) return;
    const h = this.headPos(_v);
    const yaw = this.headYaw();
    const tf = this.toastFollow;
    if (!tf.init || Math.abs(angleDiff(tf.yaw, yaw)) > 0.45) { tf.yaw = yaw; }
    const f = this.forward(tf.yaw, _v2);
    const d = this.isXR ? 1.5 : 1.55;
    const target = new THREE.Vector3(h.x + f.x * d, h.y + (this.isXR ? 0.22 : 0.27 + this.pitch * 1.4), h.z + f.z * d);
    if (!tf.init) { tf.pos.copy(target); tf.init = true; }
    tf.pos.lerp(target, 1 - Math.exp(-dt * 4));
    this.toast.position.copy(tf.pos);
    this.toast.lookAt(h);
  }

  updateNfc(dt) {
    const n = this.nfc;
    const tz = this.checkout.tapZone;
    if (n.active) {
      n.next -= dt;
      if (n.next <= 0) {
        n.next = 0.28;
        const r = n.rings.find((x) => x.t >= 1);
        if (r) { r.t = 0; r.dir = (r.dir || 1) * -1; }
      }
    }
    if (!n.rings.some((r) => r.t < 1)) return;
    tz.updateWorldMatrix(true, false);
    const base = tz.getWorldPosition(new THREE.Vector3());
    const q = tz.getWorldQuaternion(new THREE.Quaternion());
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    for (const r of n.rings) {
      if (r.t >= 1) { r.mesh.visible = false; continue; }
      r.t = Math.min(1, r.t + dt / 0.9);
      const k = r.t;
      r.mesh.visible = true;
      r.mesh.quaternion.copy(q);
      const off = r.dir > 0 ? -0.04 + k * 0.1 : 0.03 - k * 0.07;
      r.mesh.position.copy(base).addScaledVector(normal, off);
      r.mesh.scale.setScalar(1 + k * 2.6);
      r.mesh.material.opacity = (1 - k) * 0.95;
    }
  }

  // ---------------------------------------------------------------- pruebas / depuración
  debugApi() {
    const game = this;
    window.__demo = {
      game,
      get state() { return game.state; },
      get hud() { return game.hudText; },
      get toast() { return game.toastText; },
      get list() { return game.listItems.map((i) => (i.checked ? '☑ ' : '☐ ') + i.name); },
      get total() { return game.cartTotal(); },
      get receipt() { return game.receipt.userData.panel.data; },
      get pos() { return game.checkout.posScreen.userData.panel.data.mode; },
      // Coordenadas de pantalla de un objeto (para pruebas con clics reales)
      screenOf(obj) {
        const p = obj.getWorldPosition(new THREE.Vector3()).project(game.camera);
        return { x: (p.x + 1) / 2 * innerWidth, y: (1 - p.y) / 2 * innerHeight, visible: p.z < 1 };
      },
      unitsOf(id) { return game.store.units.filter((u) => u.product.id === id); },
      lookAtObj(obj) {
        const w = obj.getWorldPosition(new THREE.Vector3());
        const h = game.headPos(new THREE.Vector3());
        game.rig.rotation.y = Math.atan2(-(w.x - h.x), -(w.z - h.z));
        game.pitch = Math.atan2(w.y - h.y, Math.hypot(w.x - h.x, w.z - h.z));
        game.camera.rotation.x = game.pitch;
        game.rig.updateMatrixWorld(true);
      },
      standNear(obj, dist = 0.9) {
        const w = obj.getWorldPosition(new THREE.Vector3());
        const n = new THREE.Vector3(0, 0, 1).transformDirection(obj.parent.matrixWorld);
        game.rig.position.set(w.x + n.x * dist, 0, w.z + n.z * dist);
        game.rig.updateMatrixWorld(true);
        this.lookAtObj(obj);
      },
      async autoShop(delay = 0.05) {
        if (game.state === 'intro') game.takeCart();
        for (const id of LIST) {
          if (game.cartItems.some((u) => u.product.id === id)) continue;
          const u = game.store.units.find((x) => x.product.id === id && x.state === 'shelf');
          const p = game.desktop.pointer;
          game.grab(p, u);
          await game.tweens.wait(delay);
          game.placeOrReturn(p);
          await game.tweens.wait(0.7);
        }
      },
      goCheckout() { if (game.state === 'listDone') game.runCheckout(); },
      takeCard() { if (game.state === 'payPrompt') game.takeCard(game.desktop.pointer); },
      tap() { if (game.state === 'cardOut') game.moveCardToPos(); },
      takeReceipt() { game.takeReceipt(); },
      outro() { game.goOutro(); },
      restart() { game.restart(); },
    };
  }
}
