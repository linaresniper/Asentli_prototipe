import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { LIST } from '../config/products.js';
import { Ease } from '../core/tween.js';
import { buildCard } from '../scene/card.js';

// Modo captura (?capture=360): renderiza el recorrido guionado como video 360°
// equirectangular para visores sin WebXR (p. ej. ClassVR). El script
// tools/render-360.mjs avanza la simulación cuadro a cuadro con dt fijo.

const FPS = 30;
const DT = 1 / FPS;
const WALK = 1.15;                      // m/s
const TURN = THREE.MathUtils.degToRad(50); // rad/s

const angleDiff = (a, b) => ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

// ---------------------------------------------------------------- cubemap → equirect
class Equirect {
  constructor(renderer, width, faceSize) {
    this.renderer = renderer;
    this.width = width;
    this.height = width / 2;
    this.target = new THREE.WebGLCubeRenderTarget(faceSize, { type: THREE.HalfFloatType, generateMipmaps: false });
    this.cubeCam = new THREE.CubeCamera(0.03, 80, this.target);
    this.material = new THREE.ShaderMaterial({
      uniforms: { tCube: { value: this.target.texture } },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform samplerCube tCube;
        varying vec2 vUv;
        #define PI 3.141592653589793
        void main() {
          float lon = (vUv.x - 0.5) * 2.0 * PI;
          float lat = (vUv.y - 0.5) * PI;
          vec3 dir = vec3(sin(lon) * cos(lat), sin(lat), -cos(lon) * cos(lat));
          gl_FragColor = textureCube(tCube, dir);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthTest: false,
      depthWrite: false,
      toneMapped: true,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  render(scene, position, yaw) {
    const r = this.renderer;
    const cc = this.cubeCam;
    cc.position.copy(position);
    cc.rotation.set(0, yaw, 0);
    cc.updateMatrixWorld(true);
    // Las caras del cubemap se renderizan en lineal; el shader aplica tone mapping y sRGB.
    cc.update(r, scene);
    r.setRenderTarget(null);
    r.render(this.scene, this.cam);
  }
}

// ---------------------------------------------------------------- guion
async function director(game, log) {
  const tw = game.tweens;
  const rig = game.rig;
  const p = game.desktop.pointer;
  game.hintsShown.add('place');

  const mark = (name) => log.push({ t: game.time, name });

  const turnTo = async (yaw) => {
    const y0 = rig.rotation.y;
    const d = angleDiff(y0, yaw);
    if (Math.abs(d) < 0.01) return;
    await tw.tween(Math.max(0.45, Math.abs(d) / TURN), (k) => { rig.rotation.y = y0 + d * k; }, Ease.inOutSine);
  };

  const walkTo = async (x, z) => {
    const x0 = rig.position.x, z0 = rig.position.z;
    const dist = Math.hypot(x - x0, z - z0);
    if (dist < 0.05) return;
    await turnTo(Math.atan2(-(x - x0), -(z - z0)));
    await tw.tween(Math.max(0.7, dist / WALK + 0.4), (k) => {
      rig.position.x = x0 + (x - x0) * k;
      rig.position.z = z0 + (z - z0) * k;
      game.movedRecently = 0.3;
    }, Ease.inOutSine);
  };

  const unitOf = (id) => game.store.units.find((u) => u.product.id === id && u.state === 'shelf');

  // Se detiene frente al producto (a ~1.05 m del estante) y lo pone en el carrito.
  const pick = async (id, standX) => {
    const u = unitOf(id);
    const w = u.mesh.getWorldPosition(new THREE.Vector3());
    await walkTo(standX, w.z);
    await turnTo(Math.atan2(-(w.x - standX), 0));
    await tw.wait(0.2);
    game.grab(p, u);
    await tw.wait(0.75);
    game.placeOrReturn(p);
    await tw.wait(0.8);
  };

  // 1. Entrada y lista
  await tw.wait(5.5);
  game.takeCart();
  await tw.wait(3.5);

  // 2. Pasillo 1: granos (x=-6, mira +x) y pan (x=-2.5, mira -x)
  await walkTo(-4.25, 2.2);
  await pick('arroz', -4.95);
  await pick('frijoles', -4.95);
  await pick('azucar', -3.55);
  await pick('pan', -3.55);

  // 3. Por el fondo al pasillo 2: aceite (bebidas) y lácteos
  await walkTo(-4.25, -6.0);
  await walkTo(0, -6.0);
  await pick('aceite', 0.4);
  await pick('queso', -0.4);
  await pick('huevos', -0.4);
  await pick('leche', -0.4);

  // 4. Por el frente al pasillo 3: carnes y frutas y verduras
  await walkTo(0, 2.2);
  await walkTo(4.25, 2.2);
  await pick('frutas', 4.95);
  await pick('pollo', 3.6);
  await pick('platano', 4.95);
  await pick('papa', 4.95);
  await pick('cebolla', 4.95);
  await pick('tomate', 4.95);
  await tw.wait(2.5);

  // 5. A la caja: transición con fundido (evita una caminata larga en 360°)
  await tw.wait(2.0);
  game.runCheckout();
  while (game.state !== 'payPrompt') await tw.wait(0.1);
  await tw.wait(2.2);
  game.takeCard(p);
  await tw.wait(2.4);
  game.moveCardToPos();
  while (!game.receiptReady) await tw.wait(0.1);
  await tw.wait(2.0);
  game.takeReceipt();
  while (game.state !== 'summary' || !game.summary.userData.panel.data.thanks) await tw.wait(0.1);
  await tw.wait(4.0);
  await game.goOutro();
  await tw.wait(6.0);
  mark('end');
}

// ---------------------------------------------------------------- API para el script de render
export function setupCapture(game, renderer, { width = 2880, face = 1024 } = {}) {
  game.capture = true;
  game.isXR = true; // disposición de paneles como en VR (sin cabeceo de cámara de escritorio)
  game.fixedDate = new Date(2026, 9, 15, 11, 30);
  game.wristList.removeFromParent();
  game.camera.rotation.set(0, 0, 0);
  game.layoutHud();
  game.hud.position.set(0.24, -0.26, -0.8);
  game.hud.rotation.set(-0.15, -0.25, 0);
  // Sin mapa de entorno (reduce a la mitad el costo con GPU por software); se compensa con luz.
  game.scene.environment = null;
  game.lightDefaults.hemi = 2.3;
  game.hemi.groundColor.set('#E2DCD3');
  game.lightDefaults.sun = 1.9;
  game.reset();
  game.pendingPlace = null;
  game.placePlayer(0, 10.2, 0);

  const events = [];
  for (const name of ['click', 'grab', 'pop', 'deny', 'beep', 'whoosh', 'detect', 'approve', 'print', 'chime']) {
    const orig = game.sfx[name].bind(game.sfx);
    game.sfx[name] = (...args) => { events.push({ t: game.time, name, args }); orig(...args); };
  }

  renderer.setPixelRatio(1);
  renderer.setSize(width, width / 2, false);
  renderer.domElement.style.cssText = 'position:fixed;inset:0;width:100%;height:auto';
  const eq = new Equirect(renderer, width, face);
  const head = new THREE.Vector3();

  let done = false;
  game.start();
  director(game, events).then(() => { done = true; });

  return {
    fps: FPS,
    get done() { return done; },
    get time() { return game.time; },
    get state() { return game.state; },
    events,
    // Tras cada cuadro se vacía la cola de promesas, para que el guion avance igual
    // si se simula cuadro por cuadro o en bloque (determinismo entre workers).
    async step(n = 1) {
      for (let i = 0; i < n && !done; i++) {
        game.update(DT);
        await new Promise((r) => setTimeout(r, 0));
      }
      return done;
    },
    render() {
      game.camera.updateWorldMatrix(true, false);
      head.setFromMatrixPosition(game.camera.matrixWorld);
      eq.render(game.scene, head, game.rig.rotation.y);
    },
    async frameBase64(quality = 0.93) {
      const blob = await new Promise((r) => renderer.domElement.toBlob(r, 'image/jpeg', quality));
      const url = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      return url.slice(url.indexOf(',') + 1);
    },
    async frameJpeg(quality = 0.93) {
      const blob = await new Promise((r) => renderer.domElement.toBlob(r, 'image/jpeg', quality));
      return new Uint8Array(await blob.arrayBuffer());
    },
    async exportCardGlb(scale = 10) {
      const card = buildCard();
      card.group.remove(card.proxy);
      card.group.remove(card.halo);
      card.group.scale.setScalar(scale);
      const root = new THREE.Scene();
      root.add(card.group);
      const glb = await new GLTFExporter().parseAsync(root, { binary: true });
      return new Uint8Array(glb);
    },
  };
}

export { LIST };
