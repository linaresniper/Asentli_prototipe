# AsentliCard en visores ClassVR

Los visores ClassVR (por ejemplo **CVR-255-64**) no tienen controles de mano ni soporte WebXR, así que el prototipo se entrega en los formatos que el **portal de ClassVR** sí reproduce:

| Archivo | Qué es | Cómo se ve en el visor |
|---|---|---|
| `AsentliCard-ClassVR-360-2880x1440.mp4` | Video 360° del recorrido completo (~3 min): lista, pasillos, carrito con total acumulado, caja, pago sin contacto, comprobante y escena final | El alumno gira la cabeza para mirar alrededor mientras avanza la compra |
| `AsentliCard-ClassVR-360-1920x960.mp4` | Mismo video, más liviano | Úsalo si el de 2880 se traba o tarda mucho en descargarse al visor |
| `AsentliCard.glb` | Modelo 3D de la AsentliCard (chip EMV, símbolo NFC, logotipo) | Se puede girar y observar la tarjeta de cerca |

Los tres archivos están en esta carpeta. Para volver a generar los videos después de cambiar la escena: `npm run build && npm run video:360` (requiere `ffmpeg` y Playwright).

## Subir y enviar a los visores

1. Entra a **portal.classvr.com** con tu cuenta.
2. Ve a **My Cloud** → **Upload** y sube el MP4 (y el `.glb` si quieres mostrar la tarjeta en 3D).
3. Haz clic derecho sobre el video → **Tags** y marca **360° Equirectangular** (monoscópico). No marques 180° ni estéreo.
4. Arrastra el contenido a una **Playlist** o envíalo directo a los visores desde el panel de la clase.
5. En el visor, el video empieza mirando hacia el frente del recorrido; los mensajes, el total del carrito y la lista de compras aparecen al frente y un poco abajo.

## Consejos para la exposición

- El video dura unos 3 minutos y se mueve despacio, con giros suaves, para evitar mareos. Pide a la persona que esté sentada o de pie sin caminar.
- Para mirar la **lista de compras** y el carrito, hay que bajar la vista.
- El audio (lector de código de barras, confirmación de pago, impresora) se escucha por la bocina del visor.
- Precios ficticios y datos de la tarjeta ficticios.
