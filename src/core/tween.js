// Sistema mínimo de tweens basado en promesas, avanzado por el loop de render
// (funciona igual dentro y fuera de la sesión WebXR).

export const Ease = {
  linear: (t) => t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

export class Tweens {
  constructor() {
    this.items = new Set();
    this.time = 0;
  }

  tween(duration, onUpdate, ease = Ease.inOutCubic) {
    return new Promise((resolve) => {
      const it = { t: 0, duration: Math.max(1e-4, duration), onUpdate, ease, resolve };
      this.items.add(it);
      onUpdate(0);
    });
  }

  wait(seconds) {
    return this.tween(seconds, () => {}, Ease.linear);
  }

  update(dt) {
    this.time += dt;
    for (const it of this.items) {
      it.t += dt;
      const k = Math.min(1, it.t / it.duration);
      it.onUpdate(it.ease(k));
      if (k >= 1) {
        this.items.delete(it);
        it.resolve();
      }
    }
  }

  // Cancela todo: las secuencias async pendientes quedan sin resolver y se descartan.
  clear() {
    this.items.clear();
  }
}
