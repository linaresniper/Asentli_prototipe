// Efectos de sonido sintetizados con WebAudio (no requiere archivos de audio).

export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone({ freq = 880, type = 'sine', dur = 0.15, vol = 0.25, attack = 0.005, glideTo = null, delay = 0 }) {
    const c = this.ctx;
    if (!c) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  noise({ dur = 0.2, vol = 0.2, freq = 800, q = 0.8, type = 'lowpass', delay = 0, sweepTo = null }) {
    const c = this.ctx;
    if (!c) return;
    const t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  click() { this.tone({ freq: 1400, dur: 0.05, vol: 0.08, type: 'triangle' }); }
  grab() { this.tone({ freq: 420, glideTo: 700, dur: 0.12, vol: 0.14 }); }
  pop() {
    this.noise({ dur: 0.12, vol: 0.18, freq: 300 });
    this.tone({ freq: 660, glideTo: 990, dur: 0.14, vol: 0.12, delay: 0.02 });
  }
  deny() {
    this.tone({ freq: 330, dur: 0.12, vol: 0.06, type: 'square' });
    this.tone({ freq: 262, dur: 0.16, vol: 0.06, type: 'square', delay: 0.12 });
  }
  beep() {
    this.tone({ freq: 2400, type: 'square', dur: 0.09, vol: 0.05 });
    this.tone({ freq: 2400, type: 'sine', dur: 0.11, vol: 0.12 });
  }
  whoosh() { this.noise({ dur: 0.45, vol: 0.12, freq: 400, sweepTo: 2400, type: 'bandpass', q: 1.2 }); }
  detect() {
    this.tone({ freq: 1046, dur: 0.12, vol: 0.14 });
    this.tone({ freq: 1568, dur: 0.16, vol: 0.14, delay: 0.1 });
  }
  approve() {
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) =>
      this.tone({ freq: f, dur: 0.5 - i * 0.05, vol: 0.16, type: 'triangle', delay: i * 0.09 }));
  }
  print(seconds = 2.4) {
    const n = Math.floor(seconds / 0.06);
    for (let i = 0; i < n; i++) this.noise({ dur: 0.04, vol: 0.05, freq: 3000, type: 'highpass', delay: i * 0.06 });
  }
  chime() {
    [784, 1175, 1568].forEach((f, i) => this.tone({ freq: f, dur: 1.2, vol: 0.1, delay: i * 0.18 }));
  }
}

// Voz del cajero (si el navegador la soporta). Silenciosa si no existe.
export function say(text) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const v = voices.find((x) => /es[-_](MX|US|419)/i.test(x.lang)) || voices.find((x) => /^es/i.test(x.lang));
    if (v) u.voice = v;
    u.lang = v ? v.lang : 'es-MX';
    u.rate = 1.0;
    synth.speak(u);
  } catch (_) { /* sin voz */ }
}
