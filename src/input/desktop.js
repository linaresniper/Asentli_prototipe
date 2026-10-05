import * as THREE from 'three';

// Modo escritorio: arrastrar para mirar, clic para seleccionar, WASD/flechas para caminar.
export function setupDesktop(game) {
  const el = game.renderer.domElement;
  const p = {
    id: 'mouse', type: 'mouse', active: true, sticky: true,
    anchor: new THREE.Object3D(), ray: new THREE.Raycaster(), ndc: new THREE.Vector2(0, 0),
    held: null, hover: null, floor: null,
  };
  p.anchor.position.set(0.17, -0.19, -0.5);
  game.camera.add(p.anchor);

  const keys = new Set();
  let down = null;
  let dragged = false;

  const setNdc = (e) => {
    const r = el.getBoundingClientRect();
    p.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };

  el.addEventListener('pointerdown', (e) => {
    if (game.isXR) return;
    game.sfx.unlock();
    down = { x: e.clientX, y: e.clientY };
    dragged = false;
    setNdc(e);
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (game.isXR) return;
    setNdc(e);
    if (down) {
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!dragged && Math.hypot(dx, dy) > 5) dragged = true;
      if (dragged) {
        game.look(-e.movementX * 0.0042, -e.movementY * 0.0042);
      }
    }
  });
  el.addEventListener('pointerup', (e) => {
    if (game.isXR || !down) return;
    setNdc(e);
    if (!dragged) {
      game.updatePointer(p);
      game.onSelectStart(p);
    }
    down = null;
  });
  window.addEventListener('keydown', (e) => {
    if (game.isXR) return;
    keys.add(e.code);
    if (e.code === 'KeyL') game.toggleDesktopList();
    if (e.code === 'KeyR' && e.shiftKey) game.restart();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  return {
    pointer: p,
    updateRay() {
      p.ray.setFromCamera(p.ndc, game.camera);
      p.ray.far = 8;
    },
    moveInput() {
      let f = 0, s = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
      if (keys.has('KeyD')) s += 1;
      if (keys.has('KeyA')) s -= 1;
      let turn = 0;
      if (keys.has('ArrowLeft')) turn += 1;
      if (keys.has('ArrowRight')) turn -= 1;
      return { f, s, turn };
    },
    setCursor(c) { el.style.cursor = c; },
  };
}
