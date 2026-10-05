import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';
import { C } from '../config/brand.js';

// Controladores VR y hand tracking. Gatillo/pinch o botón de agarre = seleccionar.
export function setupXRPointers(game) {
  const { renderer, rig, scene } = game;
  const cmf = new XRControllerModelFactory();
  const hmf = new XRHandModelFactory();
  const pointers = [];

  for (let i = 0; i < 2; i++) {
    const ctrl = renderer.xr.getController(i);
    rig.add(ctrl);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
      new THREE.LineBasicMaterial({ color: C.eggshell, transparent: true, opacity: 0.6 }),
    );
    line.scale.z = 3;
    line.visible = false;
    ctrl.add(line);
    const anchor = new THREE.Object3D();
    anchor.position.set(0, -0.01, -0.07);
    ctrl.add(anchor);
    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.01, 0.017, 24),
      new THREE.MeshBasicMaterial({ color: C.orange, depthTest: false, transparent: true, toneMapped: false }),
    );
    reticle.renderOrder = 60;
    reticle.visible = false;
    scene.add(reticle);

    const grip = renderer.xr.getControllerGrip(i);
    grip.add(cmf.createControllerModel(grip));
    rig.add(grip);
    const hand = renderer.xr.getHand(i);
    hand.add(hmf.createHandModel(hand, 'mesh'));
    rig.add(hand);

    const p = {
      id: 'xr' + i, type: 'xr', active: false, sticky: false,
      ctrl, grip, hand, anchor, line, reticle,
      ray: new THREE.Raycaster(), held: null, hover: null, floor: null,
      presses: 0, handedness: '', isHand: false, inputSource: null, turnLatch: false,
    };
    ctrl.addEventListener('connected', (e) => {
      p.active = true;
      p.inputSource = e.data;
      p.handedness = e.data.handedness;
      p.isHand = !!e.data.hand;
      line.visible = true;
    });
    ctrl.addEventListener('disconnected', () => {
      p.active = false;
      p.inputSource = null;
      line.visible = false;
      reticle.visible = false;
      p.presses = 0;
      game.onSelectEnd(p, true);
    });
    const down = () => { p.presses++; if (p.presses === 1) game.onSelectStart(p); };
    const up = () => { p.presses = Math.max(0, p.presses - 1); if (p.presses === 0) game.onSelectEnd(p); };
    ctrl.addEventListener('selectstart', down);
    ctrl.addEventListener('selectend', up);
    ctrl.addEventListener('squeezestart', down);
    ctrl.addEventListener('squeezeend', up);
    pointers.push(p);
  }
  return pointers;
}

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
export function updateXRRay(p) {
  p.ctrl.updateWorldMatrix(true, false);
  _o.setFromMatrixPosition(p.ctrl.matrixWorld);
  _d.set(0, 0, -1).transformDirection(p.ctrl.matrixWorld);
  p.ray.set(_o, _d);
  p.ray.far = 8;
}

// Giro por pasos con el joystick (sin rotación continua para evitar mareos).
export function readSnapTurn(p) {
  const gp = p.inputSource && p.inputSource.gamepad;
  if (!gp || gp.axes.length < 4) return 0;
  const x = gp.axes[2];
  if (!p.turnLatch && Math.abs(x) > 0.7) {
    p.turnLatch = true;
    return Math.sign(x);
  }
  if (Math.abs(x) < 0.3) p.turnLatch = false;
  return 0;
}
