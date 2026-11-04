# Red Main — Ojo Rojo Games

Juego de terror para celular (Android). Demo 0.3: **intro del estudio**, **menú principal** y la pantalla de **JUGAR** con tres modos (Historia, 1 Jugador y Online).

| Intro "Ojo Rojo Games" | Menú (JUGAR resaltado) |
|---|---|
| ![intro](docs/intro.jpg) | ![menú](docs/menu.jpg) |

## Qué hay

- **Intro del estudio**: latidos en la oscuridad, un ojo de pupila rasgada que se abre, golpe de sonido, glitch y una lágrima de sangre. Se saltea tocando la pantalla.
- **Menú con tormenta**:
  - Bosque de pinos lejano, árboles muertos que se mecen con el viento y dos árboles grandes que enmarcan la pantalla.
  - Lluvia en tres capas de profundidad. Las gotas de adelante **chocan contra el letrero y los botones** (colisión por píxel): salpican, algunas **escurren por las letras** y caen desde los bordes.
  - Rayos con ramificaciones, iluminan nubes, lluvia y título; el **trueno llega con retraso según la distancia**, sacude la cámara y hace vibrar el celu.
  - Sangre que gotea del título, brasas que suben, niebla rasante, charcos con ondas, ciudad con reflejo en el agua.
  - Paralaje con el giroscopio (inclinando el celu) o el mouse.
- **Botones JUGAR / SALIR** con el "mouse over" de la referencia, adaptado al tacto: al apoyar el dedo se encienden en fuego. Se activan al soltar sobre el mismo botón.
- **Engranaje "Demo"** → Ajustes: música, efectos, intensidad de lluvia, rayos sí/no, vibración, calidad gráfica (baja/media/alta). Se guardan.
- **Audio 100% sintetizado** (WebAudio, sin archivos): lluvia, viento, truenos, drone oscuro y una melodía generativa de caja de música.
- Botón **atrás** de Android: cierra paneles, vuelve al menú o pide confirmación para salir.

## Pantalla de JUGAR (demo 0.2)

| Selección de modo | Cargador propio |
|---|---|
| ![modos](docs/modes.jpg) | ![cargando](docs/loading.jpg) |
| **Historia — 3 ranuras** | **1 Jugador — 4 niveles** |
| ![historia](docs/historia.jpg) | ![niveles](docs/niveles.jpg) |
| **Online — servidores activos** | **Online — sala con chat** |
| ![online](docs/online.jpg) | ![lobby](docs/lobby.jpg) |

- **Cargador en el lugar**: al tocar JUGAR la escena no cambia. Los botones se desvanecen y en la esquina gira un ojo rojo con un anillo de gotas de sangre mientras se pre-renderizan de verdad las tarjetas y las miniaturas, repartidas entre frames para que no se trabe. Recién después aparecen los modos.
- **Selección de modo** (basada en el boceto): tarjetas ilustradas de HISTORIA, 1 JUGADOR (con la fogata animada) y ONLINE. La lluvia también choca contra ellas.
- **Modo Historia**: 3 ranuras de guardado (en el dispositivo). Cada partida nueva pide nombre y dificultad (Normal/Pesadilla). Cada ranura muestra capítulo, progreso, tiempo jugado y fecha, se puede continuar y se puede borrar (con confirmación). El progreso avanza solo mientras jugás la demo.
- **1 Jugador**: 4 niveles (El Claro, Pantano de Ceniza, La Ciudad Ahogada, Ojo de la Tormenta), cada uno con miniatura, dificultad en calaveras, descripción y récord.
- **Online (beta, funciona de verdad)**: buscador de salas activas con jugadores y ping, crear sala, entrar, lista de jugadores, chat, botón "Estoy listo" y el anfitrión inicia la partida para todos. Usa **PeerJS**: los celulares se conectan directo (P2P) y el servidor público de PeerJS solo los presenta, así que no hace falta montar un servidor propio. Hasta 8 salas a la vez, 4 jugadores por sala.
  - Para usar un servidor PeerJS propio: abrí el juego con `?peer=https://tu-servidor:443/` o guardá `{"url":"https://tu-servidor/"}` en `localStorage["redmain.peer"]`.

## Nivel 1 jugable — El Castillo del Terror (demo 0.3)

| Inicio en el vestíbulo | Forjando en la herrería |
|---|---|
| ![inicio](docs/nivel1-inicio.jpg) | ![forja](docs/nivel1-forja.jpg) |

**Mapa completo** (9 salas: Biblioteca, Salón del Trono, Capilla, Cocina, Patio Interior, Alcoba de la Dama, Herrería, Vestíbulo y Cripta):

![mapa](docs/mapa-castillo.png)

- **Vista 2D desde arriba** al estilo de los survival horror 2D de celular: pixel art, oscuridad total con farol propio, antorchas, velas y chimeneas que titilan, y lluvia con relámpagos en el patio (adentro se oye la tormenta apagada).
- **Protagonista** (pixel art generado por código): hombre grande con barba, lentes, pelo corto y remera. Tiene animaciones de **caminar, correr y agacharse** en 4 direcciones ([hoja de sprites](docs/protagonista.png)).
- **Controles de celu**: joystick a la izquierda (aparece donde apoyás el dedo), botones **ACCIÓN** (cambia a AGARRAR / LEER / FORJAR / ABRIR según lo que tengas cerca), **CORRER** y **AGACHAR**, y pausa. Correr gasta estamina; agachado vas lento y tus pasos casi no se oyen.
- **Teclado** (navegador): flechas o WASD, R correr, C agacharse, E o espacio acción, Esc pausa.
- **Objetivo**: juntar los 5 materiales (2 lingotes de hierro, carbón, clavos y el martillo del herrero), **forjar la herradura** en el yunque de la Herrería y usarla en el **portón** del Vestíbulo para escapar. Se guarda el mejor tiempo.
- **Colisiones** contra muros y muebles. Hay 4 notas para leer con la historia de la Dama Blanca, y la Dama aparece en dos momentos con guion fijo (un susto al juntar el segundo material y otro en el espejo de la alcoba). **Todavía no te persigue**: eso viene después.
- El nivel se carga con el cargador propio (mapa, muebles, sprites y luces) antes de entrar, así no se traba.

## Estructura

```
./
  web/        el juego (HTML5 Canvas); se puede abrir index.html en el navegador
    lib/      PeerJS 1.5.5 (MIT) para el online
    js/game/  nivel jugable: sprites.js (personaje), castle.js (mapa), level.js (motor)
  android/    proyecto Android nativo (WebView a pantalla completa, horizontal, inmersivo)
  tools/      make-icons.cjs: genera los íconos de la app
  docs/       capturas
```

## APK

Cada push a `main` dispara el workflow **Red Main APK** (`.github/workflows/apk.yml`), que compila el APK y lo publica en **Releases** del repo (`build-N`). Desde el celu: entrá a Releases, descargá `RedMain.apk` e instalalo (Android va a pedir permiso para "orígenes desconocidos").

Compilar a mano (con Android SDK instalado):

```bash
cd android
./gradlew assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```

### Firma

El APK se firma con una clave **demo** incluida en `android/keystore/redmain-demo.jks` (contraseña `redmain-demo`), así cada versión nueva se instala encima de la anterior. Antes de publicar en Google Play hay que generar una clave propia y pasarla por variables de entorno / secrets: `RM_KEYSTORE`, `RM_KEYSTORE_PASSWORD`, `RM_KEY_ALIAS`, `RM_KEY_PASSWORD`.

## Créditos

PeerJS (MIT, ver `web/lib/PEERJS-LICENSE.txt`). Fuentes Cinzel, Cinzel Decorative y Metal Mania bajo SIL Open Font License (ver `web/fonts/OFL.txt`).
