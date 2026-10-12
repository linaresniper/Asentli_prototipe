// Renderiza el recorrido completo como video 360° equirectangular (MP4 H.264 + AAC)
// para visores sin WebXR, como ClassVR. También exporta la AsentliCard en GLB.
//
// Uso:  npm run build && npm run video:360 -- [--width 2880] [--face 1024] [--workers 4] [--lite 1920]
// Requiere: ffmpeg en el PATH y Playwright (npm i -D playwright o global).
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { synthesize } from './audio-synth.mjs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : def;
};
const WIDTH = Number(arg('width', 2880));
const FACE = Number(arg('face', 1024));
const WORKERS = Number(arg('workers', 4));
const LITE = Number(arg('lite', 1920));
const LIMIT = Number(arg('seconds', 0)); // >0: renderiza solo los primeros N segundos (prueba)
const OUT = path.resolve(ROOT, arg('out', 'classvr'));
const TMP = path.join(OUT, '.tmp');
const PORT = 4300 + Math.floor(Math.random() * 500);
const BROWSER_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

mkdirSync(TMP, { recursive: true });
if (!existsSync(path.join(ROOT, 'dist/index.html'))) throw new Error('Primero ejecuta: npm run build');

const server = spawn(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'pipe' });
await new Promise((res) => { server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) res(); }); setTimeout(res, 8000); });
const url = (w, f) => `http://localhost:${PORT}/?capture=360&width=${w}&face=${f}`;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function openCapture(w, f) {
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  const page = await browser.newPage({ viewport: { width: 960, height: 480 } });
  page.on('pageerror', (e) => log('pageerror', e.message));
  await page.goto(url(w, f));
  await page.waitForFunction(() => window.__cap, null, { timeout: 120000 });
  return { browser, page };
}

try {
  // 1. Pasada rápida sin dibujar: duración total, eventos de audio y modelo GLB
  log('Simulando guion…');
  const sim = await openCapture(256, 64);
  let done = false;
  while (!done) done = await sim.page.evaluate(() => window.__cap.step(300));
  const { time, events, fps } = await sim.page.evaluate(() => ({ time: window.__cap.time, events: window.__cap.events, fps: window.__cap.fps }));
  const glb = await sim.page.evaluate(async () => {
    const u = await window.__cap.exportCardGlb(10);
    let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s);
  });
  writeFileSync(path.join(OUT, 'AsentliCard.glb'), Buffer.from(glb, 'base64'));
  await sim.browser.close();
  const duration = LIMIT > 0 ? Math.min(LIMIT, time) : time;
  const total = Math.round(duration * fps);
  log(`Duración ${duration.toFixed(1)} s → ${total} cuadros a ${fps} fps, ${WIDTH}×${WIDTH / 2}`);

  // 2. Render en paralelo por tramos
  const chunk = Math.ceil(total / WORKERS);
  let rendered = 0;
  const t0 = Date.now();
  const jobs = [];
  for (let w = 0; w < WORKERS; w++) {
    const start = w * chunk;
    const end = Math.min(total, start + chunk);
    if (start >= end) break;
    const file = path.join(TMP, `chunk${w}.mp4`);
    jobs.push((async () => {
      const { browser, page } = await openCapture(WIDTH, FACE);
      for (let f = 0; f < start; f += 300) await page.evaluate((n) => window.__cap.step(n), Math.min(300, start - f));
      const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-g', String(fps * 2), file], { stdio: ['pipe', 'inherit', 'inherit'] });
      for (let f = start; f < end; f++) {
        const b64 = await page.evaluate(async () => { window.__cap.render(); const s = await window.__cap.frameBase64(0.94); await window.__cap.step(1); return s; });
        if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
        rendered++;
        if (rendered % 60 === 0) {
          const el = (Date.now() - t0) / 1000;
          log(`cuadros ${rendered}/${total} · ${(rendered / el).toFixed(2)} fps · faltan ~${Math.round((total - rendered) / (rendered / el) / 60)} min`);
        }
      }
      ff.stdin.end();
      await new Promise((r) => ff.on('close', r));
      await browser.close();
      return file;
    })());
  }
  const files = await Promise.all(jobs);

  // 3. Unir tramos, audio y versiones finales
  writeFileSync(path.join(TMP, 'list.txt'), files.map((f) => `file '${f}'`).join('\n'));
  const run = (args) => { const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' }); if (r.status) throw new Error('ffmpeg falló: ' + args.join(' ')); };
  run(['-f', 'concat', '-safe', '0', '-i', path.join(TMP, 'list.txt'), '-c', 'copy', path.join(TMP, 'video.mp4')]);
  synthesize(events.filter((e) => e.t <= duration), duration, path.join(TMP, 'audio.wav'));
  const main = path.join(OUT, `AsentliCard-ClassVR-360-${WIDTH}x${WIDTH / 2}.mp4`);
  run(['-i', path.join(TMP, 'video.mp4'), '-i', path.join(TMP, 'audio.wav'), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-shortest', '-movflags', '+faststart', main]);
  if (LITE && LITE < WIDTH) {
    const lite = path.join(OUT, `AsentliCard-ClassVR-360-${LITE}x${LITE / 2}.mp4`);
    run(['-i', main, '-vf', `scale=${LITE}:${LITE / 2}:flags=lanczos`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', lite]);
  }
  rmSync(TMP, { recursive: true, force: true });
  log('Listo:', OUT);
} finally {
  server.kill();
}
process.exit(0);
