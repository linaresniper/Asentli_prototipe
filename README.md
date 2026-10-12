# AsentliCard · Compra semanal en VR

Prototipo **WebXR (Three.js)** que simula una compra semanal de canasta básica en un supermercado virtual y su pago **sin contacto** con la tarjeta física **AsentliCard**. Pensado como demo de producto fintech para exposiciones: dura ~2–4 minutos y funciona en el navegador del visor (Meta Quest) o en una computadora (modo escritorio).

> Precios **ficticios / demostrativos**, no son precios reales del mercado. La tarjeta y todos sus datos son ficticios.

## Recorrido

```
LISTA → SUPERMERCADO → CANASTA BÁSICA → CARRITO → REVISAR GASTO → CAJA → REGISTRO
→ TOTAL SEMANAL → ASENTLICARD → PAGO CONTACTLESS → PAGO APROBADO → COMPROBANTE → COMPRA COMPLETADA
```

1. Entrada del supermercado con carrito vacío y lista flotante **“COMPRAS DE LA SEMANA”** (14 productos).
2. Tomar el carrito: la lista se monta en la manija (en VR también aparece en la mano izquierda).
3. Pasillos: *Granos y cereales · Pan y alimentos básicos · Lácteos · Bebidas y productos esenciales · Carnes · Frutas y verduras*. Cada producto tiene etiqueta de precio; los de la lista llevan la marca “EN TU LISTA”.
4. Tomar productos y soltarlos en el carrito (animación suave). La lista se marca sola y el HUD en la esquina muestra **Carrito · N productos · Total acumulado**. Productos fuera de la lista se rechazan con un aviso (control de gasto).
5. **“Lista completada ✓ — Dirígete a la caja para pagar.”** Flechas en el piso guían a la Caja 1.
6. Caja: cajero, banda transportadora, lector con sonido *beep*, pantalla “Registrando productos…” → “Productos: 14 · Total: $35.20”. El cajero dice “Su total es $35.20.”
7. “Utiliza tu AsentliCard para realizar el pago.” Se toma la tarjeta 3D (85.6 × 54 × 0.76 mm, chip EMV, símbolo NFC, logotipo).
8. Al acercarla al POS: **Tarjeta detectada → Procesando pago… (ondas NFC) → PAGO APROBADO ✓** con sonido de confirmación.
9. El ticket sale de la impresora (ASENTLI · Compra semanal · Productos: 14 · Total · Pago: AsentliCard · Estado: APROBADO ✓).
10. Resumen “Compra semanal completada” → “Gracias por utilizar AsentliCard.”
11. Escena final: la tarjeta flota iluminada sobre el carrito con bolsas — *“Tus compras de la semana, de forma fácil y segura.” · AsentliCard*.

## Controles

| | VR (controladores o hand tracking) | Escritorio |
|---|---|---|
| Tomar / soltar | Apuntar + gatillo, botón de agarre o pellizco; soltar sobre el carrito | Clic para tomar, clic otra vez para colocar |
| Moverse | Apuntar al piso y seleccionar (teletransporte con fundido) o caminar físicamente | WASD/flechas, o clic en el piso |
| Girar | Joystick derecho: giro por pasos de 30° | Arrastrar con el mouse / flechas ← → |
| Lista | Mirar la mano izquierda o la manija del carrito | Siempre visible; tecla `L` para ocultar |

Sin rotaciones continuas ni movimientos forzados de cámara (todas las transiciones son fundidos) para evitar mareos.

## Ejecutar

```bash
npm install
npm run dev          # escritorio: http://localhost:5173
npm run dev:quest    # HTTPS en la red local para abrir desde el visor
npm run build        # genera dist/ (sitio estático, desplegable en GitHub Pages / Netlify)
npm run test:e2e     # recorrido completo automatizado (requiere build previo); capturas en tests/screens/
```

**En Meta Quest:** ejecuta `npm run dev:quest`, abre en el navegador del visor la URL `https://<ip-de-tu-pc>:5173`, acepta el certificado de desarrollo y pulsa **Entrar en VR**. Para exposición, publica `dist/` en un hosting HTTPS.

Parámetros de URL opcionales:
- `?expo=1` — reinicia la demo automáticamente 25 s después de la escena final.
- `?guia=0` — oculta el indicador que señala el siguiente producto pendiente.

## Visores ClassVR (sin WebXR)

Para visores como ClassVR CVR-255-64 el prototipo se exporta como **video 360° MP4** y la tarjeta como **modelo GLB**, que se suben al portal de ClassVR. Ver [`classvr/LEEME.md`](classvr/LEEME.md).

```bash
npm run build
npm run video:360          # opciones: --width 2880 --face 1024 --workers 4 --lite 1920
```

## Personalización

- **Identidad visual:** `src/config/brand.js` (paleta Pumpkin Orange `#FF6400`, Eggshell White `#F5EBE1`, Salad Green `#8CC850`, Bottle Green `#003223`, logotipo y textos).
- **Productos y precios:** `src/config/products.js` (lista semanal, secciones y precios ficticios).
- **Diseño de la tarjeta:** `src/scene/card.js`.

## Estructura

```
src/
  main.js               renderer, sesión WebXR, loop
  game.js               máquina de estados de la experiencia e interacción
  config/               marca y catálogo
  scene/                supermercado, productos procedurales, caja/POS/cajero, carrito, tarjeta
  ui/                   paneles (lista, HUD, mensajes, ticket, resumen) dibujados en canvas
  input/                controladores/manos VR y modo escritorio
  core/                 tweens, audio sintetizado (WebAudio) y fusión de geometrías
```

Todo es procedural (sin modelos ni audios externos), por lo que la demo pesa ~200 KB comprimida y carga rápido en el visor.
