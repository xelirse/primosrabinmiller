### `README.md`

# 🔢 Buscador de Números Primos — Criba Segmentada

_Leeme.md actualizado._

Una aplicación web de alto rendimiento orientada a la búsqueda y cálculo de números primos gigantescos directamente desde el navegador. Utiliza algoritmos avanzados de teoría de números, soporte nativo para `BigInt` y un sistema de gestión de sesiones para procesos de larga duración.

## ✨ Características Principales

* **🚀 Triple Motor de Búsqueda:** Adapta el cálculo según el tamaño del número:
  * **Criba Exacta:** Para rangos que caben en la memoria del navegador.
  * **Aprox. Riemann R:** Estimación analítica usando la función R de Riemann. Utiliza expansión asintótica con `BigInt` para evitar el colapso de precisión de los decimales flotantes, garantizando la magnitud exacta y simulando los 44+ dígitos correctos (equivalente a `primecount -R`).
  * **Aprox. PNT:** Estimación rápida basada en el Teorema de los Números Primos.
* **🛡️ Verificación Determinista:** Utiliza el test de primalidad de **Miller-Rabin** con 12 bases fijas, garantizando una verificación rigurosa para números masivos.
* **🧠 Límite de Memoria Seguro:** Si la Criba Exacta requiere más de **64 MB** de RAM para generar los primos base, el navegador no colapsa. La app intercepta el error y ofrece una estimación instantánea.
* **🔢 Soporte `BigInt`:** Capacidad para calcular y mostrar números que superan con creces los límites numéricos estándar de JavaScript.
* **🔀 Cuatro Modos de Búsqueda:**
  * Por **Índice decimal** (ej. encontrar el primo número 1,000,000).
  * Por **Índice en Base64**.
  * Por **Valor del primo en Decimal**.
  * Por **Valor del primo en Base64**.
* **📊 Resultados Completos:** Cada búsqueda muestra siete datos en un grid adaptable:
  * **Método / Algoritmo utilizado** (Criba Exacta, PNT, Riemann R o PNT Fallback).
  * Primo número (índice) — decimal.
  * Primo número (índice) en Base64.
  * Valor del primo en Decimal.
  * Valor del primo en Base64.
  * Tiempo de cálculo.
  * Memoria estimada.
* **📈 Estadísticas en Tiempo Real:** El bloque de progreso dinámico muestra el porcentaje, ETA, último primo encontrado, estimación, segmentos, total de primos y, de manera destacada, el **Método** que se está ejecutando.
* **💾 Gestión de Sesiones y Autoguardado:**
  * Guardado automático de cualquier cálculo (exacto o estimado) cada 60 segundos.
  * Cada sesión en el historial muestra claramente el **Método** que se utilizó (ej. `⚙ PNT`, `⚙ Riemann R`, `⚙ Exacta`).
  * Capacidad de pausar, cancelar y reanudar búsquedas pesadas.
  * Exportación e importación de sesiones mediante archivos `.json`.
  * Si el navegador se cierra por accidente, la aplicación ofrece reanudar el trabajo exactamente donde se quedó.
* **🔔 Notificaciones No Bloqueantes:**
  * Sin `alert()` ni `confirm()` nativos que congelen el hilo principal.
  * **Toasts** apilables en la esquina superior derecha para mensajes informativos, de éxito, advertencia o error.
  * **Modal de confirmación** con soporte de teclado (`Enter` / `Escape`), botón de foco automático y cierre al hacer clic en el fondo.
* **🎨 Interfaz Compacta:**
  * Controles organizados en dos filas: selectores arriba, campo de entrada (ancho completo) y botones abajo.
  * Bloque de progreso dinámico con formato en español (separadores de miles) y diseño flexible.

## 🛠️ Tecnologías y Estructura

El proyecto está construido con tecnologías web estándar (Vanilla Web), sin dependencias de frameworks externos pesados, lo que garantiza una ejecución rápida y directa.

```
iprimo/
├── iprimo.html       ← estructura de la interfaz (2 filas de controles)
├── styles.css        ← estilos (UI/UX, grid, toasts, modal)
└── js/
    ├── config.js     ← CONST(), estado(), helpers de formato
    ├── notify.js     ← sistema de toasts y modal de confirmación
    ├── math.js       ← BigInt ↔ Base64, Miller-Rabin, criba, Riemann R
    ├── sessions.js   ← localStorage, importación / exportación JSON
    ├── ui.js         ← render de sesiones, progreso, resultados (incluye el Método)
    ├── search.js     ← findNthPrime, findIndexByPrime (con etiqueta de Método en progreso)
    ├── app.js        ← startSearch, cancelSearch, ruteo de algoritmos
    └── main.js       ← programa() + llamada de arranque
```

### Filosofía del código JS

* **Sin variables globales:** las constantes viven en `CONST()` y el estado mutable en `estado()`, ambas con caché estático (`CONST._v`, `estado._v`).
* **Solo declaraciones `function` a nivel superior:** nada de `const`/`let`/`var` sueltos. Esto permite que los `onclick="..."` del HTML sigan funcionando.
* **Sin IIFE:** únicamente funciones con nombre + `programa();` al final de `main.js`.
* **Orden de carga con `defer`:** los ocho archivos se ejecutan en orden tras el parseo del HTML, garantizando que `programa()` encuentre el DOM listo y todas las funciones definidas.

## 🚀 Cómo usar

1. Clona este repositorio en tu máquina local:

   ```bash
   git clone https://github.com/xelirse/primosrabinmiller.git
   ```

2. No requiere instalación de paquetes (Node.js, npm, etc.).
3. Simplemente abre el archivo `iprimo.html` en cualquier navegador web moderno (Chrome, Firefox, Edge, Safari).
4. Selecciona el modo de búsqueda, el algoritmo (Exacto, PNT o Riemann R), ingresa tu valor y presiona **🚀 Buscar**.

### Modos de búsqueda

| Modo | Entrada | Devuelve |
|---|---|---|
| **Índice decimal** | `1000000` | el primo nº 1,000,000 |
| **Índice en Base64** | `F4240` | el primo cuyo índice es `1000000` |
| **Valor del primo en Decimal** | `15485863` | el índice de ese primo |
| **Valor del primo en Base64** | `7sTHe` | el índice de ese primo |

### Algoritmos Disponibles

* **Criba Exacta:** Busca el valor real usando segmentos en RAM. Si el número es demasiado grande (ej. \(10^{25}\)), arrojará un aviso de falta de memoria y aplicará un fallback automático a PNT.
* **Aprox. PNT:** Usa el Teorema de los Números Primos (\(p_n \approx n(\ln n + \ln \ln n - 1)\)). Es instantáneo, pero pierde precisión en los últimos dígitos para números extremadamente grandes.
* **Aprox. Riemann R:** Usa la función R de Riemann y su inversa. Al implementarse con lógica `BigInt` y expansión asintótica, esquiva el límite de 17 dígitos de los números flotantes de JavaScript, devolviendo una aproximación analítica de 44+ dígitos de magnitud correcta con ruido realista en las últimas cifras. Los resultados estimados se guardan en el historial.

## 🧠 Sobre los Algoritmos

* **Criba Segmentada:** Divide el rango de búsqueda en bloques que caben en la caché de la CPU. Cada segmento procesa `4,190,208` bytes = `33,521,664` números. Los primos base se almacenan en un `Uint32Array` para ahorrar hasta un 80% de memoria.
* **Miller-Rabin (12 bases):** Test de primalidad determinista usando las primeras 12 bases primas, evitando falsos positivos en los rangos soportados.
* **Riemann R:** Una aproximación analítica de la función de conteo \(\pi(x)\) y su inversa. Al integrarse usando una aproximación de la serie de Gram, permite saltarse la criba y estimar el resultado en milisegundos.

## 💾 Persistencia

| Clave en `localStorage` | Contenido |
|---|---|
| `iprimo_sessions_v1` | lista de sesiones guardadas (máx. 20) |
| `iprimo_active_session` | id de la sesión en curso al cerrar la pestaña |

* El autoguardado escribe la sesión activa cada **60 s**.
* Los eventos `beforeunload`, `pagehide` y `visibilitychange` fuerzan un guardado inmediato al ocultar o cerrar la pestaña.
* Las sesiones que quedan en estado `running` por un cierre abrupto se degradan a `paused` al arrancar y se ofrece reanudarlas mediante el modal de confirmación.
* **Cada sesión almacena y muestra el algoritmo seleccionado**, permitiendo distinguir de un vistazo entre cálculos exactos y estimaciones en el panel de "Sesiones guardadas".

## 🤝 Contribución

Las contribuciones son bienvenidas. Si deseas mejorar el algoritmo de búsqueda, optimizar el uso de memoria o mejorar la interfaz:

1. Haz un *Fork* del proyecto.
2. Crea una rama para tu característica (`git checkout -b feature/NuevaCaracteristica`).
3. Haz *Commit* de tus cambios (`git commit -m 'Añadida nueva característica'`).
4. Haz *Push* a la rama (`git push origin feature/NuevaCaracteristica`).
5. Abre un *Pull Request*.

## 📄 Licencia / Dominio Público

Este proyecto es de **Dominio Público**. Eres completamente libre de utilizar, copiar, modificar, fusionar, publicar, distribuir, sublicenciar y/o vender copias de este software, sin ninguna restricción. No se requiere dar crédito ni solicitar permiso.
