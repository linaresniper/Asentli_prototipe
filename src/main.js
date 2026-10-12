import * as THREE from 'three';
import { Game } from './game.js';

async function loadFonts() {
  if (!document.fonts) return;
  const loads = ['400', '500', '600', '700', '800'].map((w) => document.fonts.load(`${w} 24px Poppins`));
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 2500))]).catch(() => {});
}

const params = new URLSearchParams(location.search);
const CAPTURE = params.get('capture');

// PRNG con semilla para que cada worker de captura genere exactamente la misma escena.
function seedRandom(seed) {
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function boot() {
  await loadFonts();
  if (CAPTURE) seedRandom(20261015);

  const renderer = new THREE.WebGLRenderer({ antialias: !CAPTURE, powerPreference: 'high-performance', preserveDrawingBuffer: !!CAPTURE });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.localClippingEnabled = true;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.xr.setFoveation(0.6);
  document.body.appendChild(renderer.domElement);

  const game = new Game(renderer);
  game.init();

  if (CAPTURE) {
    const { setupCapture } = await import('./capture/capture.js');
    document.getElementById('loading').remove();
    document.getElementById('overlay').classList.add('hidden');
    window.__cap = setupCapture(game, renderer, {
      width: Number(params.get('width')) || 2880,
      face: Number(params.get('face')) || 1024,
    });
    return;
  }

  // `?maxdt=` solo para pruebas automatizadas con GPU por software.
  const maxDt = Number(params.get('maxdt')) || 0.05;
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = Math.min(maxDt, (now - last) / 1000);
    last = now;
    game.update(dt);
    renderer.render(game.scene, game.camera);
  });

  document.getElementById('loading').remove();
  const overlay = document.getElementById('overlay');
  const btnVR = document.getElementById('btn-vr');
  const btnDesk = document.getElementById('btn-desktop');
  let started = false;
  const begin = () => {
    overlay.classList.add('hidden');
    if (!started) { started = true; game.start(); }
  };

  btnDesk.addEventListener('click', () => { game.sfx.unlock(); begin(); });

  let supported = false;
  try { supported = !!navigator.xr && await navigator.xr.isSessionSupported('immersive-vr'); } catch (_) { supported = false; }
  if (supported) {
    btnVR.disabled = false;
    btnVR.textContent = 'Entrar en VR';
    let session = null;
    btnVR.addEventListener('click', async () => {
      game.sfx.unlock();
      if (session) { session.end(); return; }
      try {
        session = await navigator.xr.requestSession('immersive-vr', {
          optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
        });
        session.addEventListener('end', () => {
          session = null;
          btnVR.textContent = 'Entrar en VR';
          overlay.classList.remove('hidden');
        });
        await renderer.xr.setSession(session);
        btnVR.textContent = 'Salir de VR';
        begin();
      } catch (err) {
        console.error(err);
        btnVR.textContent = 'No se pudo iniciar VR';
      }
    });
  } else {
    btnVR.textContent = window.isSecureContext ? 'VR no disponible en este dispositivo' : 'VR requiere HTTPS';
  }
}

boot();
