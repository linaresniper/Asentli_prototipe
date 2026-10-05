// Recorrido completo en modo escritorio con Chromium headless.
// Uso: npm run build && npm run test:e2e   (capturas en tests/screens/)
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const PORT = 4179;
const OUT = new URL('./screens/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const server = spawn(process.execPath, [new URL('../node_modules/vite/bin/vite.js', import.meta.url).pathname, 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res, rej) => {
  server.stdout.on('data', (d) => { if (String(d).includes(String(PORT))) res(); });
  server.on('exit', () => rej(new Error('vite preview terminó')));
  setTimeout(res, 6000);
});

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });

const shot = (n) => page.screenshot({ path: OUT + n + '.png' });
const sleep = (ms) => page.waitForTimeout(ms);
const state = () => page.evaluate(() => window.__demo.state);
const waitState = async (s, timeout = 120000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if ((await state()) === s) return;
    await sleep(200);
  }
  throw new Error(`Timeout esperando estado ${s} (actual: ${await state()})`);
};
const waitPos = (mode) => page.waitForFunction((m) => window.__demo.pos === m, mode, { timeout: 60000, polling: 50 });
const clickObj = async (expr) => {
  const p = await page.evaluate(`window.__demo.screenOf(${expr})`);
  await page.mouse.click(p.x, p.y);
  return p;
};
const check = (cond, msg) => { if (!cond) throw new Error('Falla: ' + msg); console.log('✓', msg); };

try {
  await page.goto(`http://localhost:${PORT}/?maxdt=0.6&auto=0`);
  await page.waitForSelector('#btn-desktop');
  await sleep(800);
  await shot('00-portada');
  await page.click('#btn-desktop');
  await sleep(1500);
  await shot('01-intro');
  check((await state()) === 'intro', 'inicia en la entrada con carrito vacío');

  await page.mouse.click(640, 640); // el carrito está al frente, en la parte baja de la vista
  await sleep(1200);
  check((await state()) === 'shopping', 'tomar el carrito con clic');
  await shot('02-carrito-tomado');

  // Producto real: arroz
  await page.evaluate(() => { const u = window.__demo.unitsOf('arroz')[0]; window.__demo.standNear(u.mesh, 1.0); });
  await sleep(500);
  await shot('03-pasillo-granos');
  await clickObj("window.__demo.unitsOf('arroz')[0].proxy");
  await sleep(600);
  await shot('04-arroz-en-mano');
  await page.mouse.click(900, 200);
  await sleep(1200);
  const l1 = await page.evaluate(() => window.__demo.list);
  check(l1.includes('☑ Arroz'), 'arroz marcado en la lista');
  check((await page.evaluate(() => window.__demo.hud)).includes('$2.40'), 'HUD muestra total acumulado $2.40');

  // Producto fuera de la lista
  await page.evaluate(() => { const u = window.__demo.unitsOf('harina')[0]; window.__demo.standNear(u.mesh, 1.0); });
  await sleep(300);
  await clickObj("window.__demo.unitsOf('harina')[0].proxy");
  await sleep(400);
  check((await page.evaluate(() => window.__demo.toast)).includes('no está en tu lista'), 'producto fuera de lista se rechaza');
  await shot('05-fuera-de-lista');

  // Lácteos y frutas (capturas de pasillos)
  await page.evaluate(() => { const u = window.__demo.unitsOf('leche')[0]; window.__demo.standNear(u.mesh, 1.4); });
  await sleep(400);
  await shot('06-pasillo-lacteos');
  await page.evaluate(() => { const u = window.__demo.unitsOf('tomate')[0]; window.__demo.standNear(u.mesh, 1.3); });
  await sleep(400);
  await shot('07-frutas-verduras');

  await page.evaluate(() => window.__demo.autoShop());
  await waitState('listDone');
  await sleep(600);
  check((await page.evaluate(() => window.__demo.total)) === 35.2, 'total de 14 productos = $35.20');
  check((await page.evaluate(() => window.__demo.hud)).includes('14 productos'), 'HUD: 14 productos');
  await shot('08-lista-completa');

  // Caminar a la caja (clic en el piso no alcanza la zona desde lejos; se mueve el rig)
  await page.evaluate(() => { const g = window.__demo.game; g.rig.position.set(-1.5, 0, 6.2); g.rig.rotation.y = Math.PI / 2; });
  await sleep(400);
  await shot('09-hacia-caja');
  await page.evaluate(() => { const g = window.__demo.game; g.rig.position.set(-3.6, 0, 6.6); });
  await waitState('checkout');
  await sleep(4000);
  await shot('10-registrando');
  await waitState('payPrompt');
  await sleep(1200);
  await shot('11-total-y-tarjeta');
  check((await page.evaluate(() => window.__demo.game.checkout.display.userData.panel.data.count)) === 14, 'pantalla: Productos: 14');

  await clickObj('window.__demo.game.card.proxy');
  await waitState('cardOut');
  await sleep(800);
  check(true, 'sacar la AsentliCard');
  await shot('12-tarjeta-en-mano');
  await page.evaluate(() => {
    const ps = window.__demo.game.checkout.posScreen;
    const orig = ps.redraw;
    window.__posModes = [];
    ps.redraw = (patch) => { if (patch && patch.mode) window.__posModes.push(patch.mode); return orig(patch); };
  });
  await clickObj('window.__demo.game.checkout.posProxy');
  await waitPos('detected');
  check(true, 'POS: Tarjeta detectada');
  await shot('13-tarjeta-detectada');
  await page.waitForFunction(() => window.__posModes.includes('processing'), null, { timeout: 60000 });
  await shot('14-procesando');
  check(true, 'POS: Procesando pago');
  await page.waitForFunction(() => window.__posModes.includes('approved'), null, { timeout: 60000 });
  await sleep(300);
  check((await page.evaluate(() => window.__demo.pos)) === 'approved', 'POS: PAGO APROBADO');
  await shot('15-aprobado');
  await waitState('receipt');
  await sleep(1500);
  await shot('16-imprimiendo');
  await page.waitForFunction(() => window.__demo.game.receiptReady, null, { timeout: 60000 });
  const r = await page.evaluate(() => window.__demo.receipt);
  check(r.count === 14 && Math.abs(r.total - 35.2) < 1e-9, 'comprobante: 14 productos, $35.20');
  await shot('17-recibo-impreso');
  await clickObj('window.__demo.game.receipt');
  await waitState('summary');
  await sleep(1600);
  await shot('18-resumen');
  await sleep(3200);
  await shot('19-gracias');
  await clickObj('window.__demo.game.btnFinal');
  await waitState('outro');
  await sleep(5500);
  await shot('20-escena-final');
  await clickObj('window.__demo.game.btnRestart');
  await sleep(2000);
  check((await state()) === 'intro', 'reiniciar demo');

  check(errors.length === 0, 'sin errores de consola: ' + errors.join(' | '));
  console.log('\nRecorrido completo OK. Capturas en', OUT);
} catch (e) {
  await shot('zz-error').catch(() => {});
  console.error(e.message, '\nErrores de consola:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
  process.exit(process.exitCode ?? 0);
}
