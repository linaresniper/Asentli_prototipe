// Pista de audio para el video 360°: reproduce offline los mismos efectos de
// src/core/audio.js en los tiempos registrados durante la captura, más una
// música ambiental suave. Salida: WAV estéreo 16 bits, 48 kHz.
import { writeFileSync } from 'node:fs';

const SR = 48000;

export function synthesize(events, duration, outPath) {
  const n = Math.ceil(duration * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const mix = (i, v, pan = 0) => {
    if (i < 0 || i >= n) return;
    L[i] += v * (1 - Math.max(0, pan));
    R[i] += v * (1 + Math.min(0, pan));
  };

  const osc = (type, ph) => {
    const x = ph - Math.floor(ph);
    if (type === 'square') return x < 0.5 ? 1 : -1;
    if (type === 'triangle') return 4 * Math.abs(x - 0.5) - 1;
    return Math.sin(2 * Math.PI * x);
  };

  function tone(t0, { freq = 880, type = 'sine', dur = 0.15, vol = 0.25, attack = 0.005, glideTo = null, delay = 0, pan = 0 }) {
    const s0 = Math.round((t0 + delay) * SR);
    const len = Math.round((dur + 0.05) * SR);
    let ph = 0;
    for (let k = 0; k < len; k++) {
      const t = k / SR;
      const f = glideTo ? freq * Math.pow(glideTo / freq, Math.min(1, t / dur)) : freq;
      ph += f / SR;
      const env = t < attack ? t / attack : Math.max(0, Math.pow(0.0001 / vol, (t - attack) / Math.max(1e-3, dur - attack)) * 1);
      mix(s0 + k, osc(type, ph) * vol * (t < attack ? t / attack : Math.min(1, env)), pan);
    }
  }

  // Biquad (RBJ) para ruido filtrado
  function biquad(type, f, q) {
    const w = 2 * Math.PI * f / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lowpass') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (type === 'highpass') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; }
    a0 = 1 + a; a1 = -2 * c; a2 = 1 - a;
    return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
  }

  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };

  function noise(t0, { dur = 0.2, vol = 0.2, freq = 800, q = 0.8, type = 'lowpass', delay = 0, sweepTo = null, pan = 0 }) {
    const s0 = Math.round((t0 + delay) * SR);
    const len = Math.round((dur + 0.05) * SR);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let k = 0; k < len; k++) {
      const t = k / SR;
      const f = sweepTo ? freq * Math.pow(sweepTo / freq, Math.min(1, t / dur)) : freq;
      const [b0, b1, b2, a1, a2] = biquad(type, Math.min(f, SR * 0.45), q);
      const x = rnd();
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      const env = t < 0.01 ? t / 0.01 : Math.pow(0.0001 / vol, (t - 0.01) / Math.max(1e-3, dur - 0.01));
      mix(s0 + k, y * vol * Math.min(1, env), pan);
    }
  }

  const SFX = {
    click: (t) => tone(t, { freq: 1400, dur: 0.05, vol: 0.08, type: 'triangle' }),
    grab: (t) => tone(t, { freq: 420, glideTo: 700, dur: 0.12, vol: 0.14 }),
    pop: (t) => { noise(t, { dur: 0.12, vol: 0.18, freq: 300 }); tone(t, { freq: 660, glideTo: 990, dur: 0.14, vol: 0.12, delay: 0.02 }); },
    deny: (t) => { tone(t, { freq: 330, dur: 0.12, vol: 0.06, type: 'square' }); tone(t, { freq: 262, dur: 0.16, vol: 0.06, type: 'square', delay: 0.12 }); },
    beep: (t) => { tone(t, { freq: 2400, type: 'square', dur: 0.09, vol: 0.05, pan: -0.3 }); tone(t, { freq: 2400, dur: 0.11, vol: 0.12, pan: -0.3 }); },
    whoosh: (t) => noise(t, { dur: 0.45, vol: 0.12, freq: 400, sweepTo: 2400, type: 'bandpass', q: 1.2 }),
    detect: (t) => { tone(t, { freq: 1046, dur: 0.12, vol: 0.14 }); tone(t, { freq: 1568, dur: 0.16, vol: 0.14, delay: 0.1 }); },
    approve: (t) => [1046.5, 1318.5, 1568, 2093].forEach((f, i) => tone(t, { freq: f, dur: 0.5 - i * 0.05, vol: 0.16, type: 'triangle', delay: i * 0.09 })),
    print: (t, secs = 2.4) => { for (let i = 0; i < Math.floor(secs / 0.06); i++) noise(t, { dur: 0.04, vol: 0.05, freq: 3000, type: 'highpass', delay: i * 0.06, pan: 0.3 }); },
    chime: (t) => [784, 1175, 1568].forEach((f, i) => tone(t, { freq: f, dur: 1.2, vol: 0.1, delay: i * 0.18 })),
  };
  for (const e of events) if (SFX[e.name]) SFX[e.name](e.t, ...(e.args || []));

  // Música ambiental: acordes suaves (Do – La m – Fa – Sol), 4 s cada uno
  const chords = [[261.63, 329.63, 392.0], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [196.0, 246.94, 293.66]];
  const bar = 4;
  for (let b = 0; b * bar < duration; b++) {
    const ch = chords[b % 4];
    const s0 = Math.round(b * bar * SR);
    const len = Math.round(bar * SR);
    ch.forEach((f, vi) => {
      for (let k = 0; k < len; k++) {
        const t = k / SR;
        const env = Math.min(1, t / 0.8) * Math.min(1, (bar - t) / 0.8);
        const v = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t)) * 0.018 * env;
        mix(s0 + k, v, (vi - 1) * 0.4);
      }
    });
    // bajo
    for (let k = 0; k < len; k++) {
      const t = k / SR;
      const env = Math.min(1, t / 0.05) * Math.exp(-t * 1.2);
      mix(s0 + k, Math.sin(2 * Math.PI * ch[0] / 2 * t) * 0.03 * env);
    }
  }

  // Fundidos de entrada/salida y limitador suave
  const fade = SR * 1.5;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const g = Math.min(1, i / fade, (n - i) / fade);
    L[i] = Math.tanh(L[i] * g * 1.4);
    R[i] = Math.tanh(R[i] * g * 1.4);
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const norm = peak > 0 ? 0.89 / peak : 1;

  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm)) * 32767), 46 + i * 4);
  }
  writeFileSync(outPath, buf);
}
