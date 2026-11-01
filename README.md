# 🔢 Buscador de Números Primos — Criba Segmentada

_Leeme.md actualizado._

Una aplicación web de alto rendimiento orientada a la búsqueda y cálculo de números primos gigantescos directamente desde el navegador. Utiliza algoritmos avanzados de teoría de números, soporte nativo para `BigInt` y un sistema de gestión de sesiones para procesos de larga duración.

## ✨ Características Principales

* **🚀 Cálculo Optimizado:** Implementa una **Criba Segmentada** para manejar la búsqueda por bloques, optimizando el uso de la memoria.
* **🛡️ Verificación Determinista:** Utiliza el test de primalidad de **Miller-Rabin** con 12 bases fijas, garantizando una verificación rigurosa para números masivos.
* **🔢 Soporte `BigInt`:** Capacidad para calcular y mostrar números que superan con creces los límites numéricos estándar de JavaScript.
* **🔀 Cuatro Modos de Búsqueda:**
  * Por **Índice decimal** (ej. encontrar el primo número 1,000,000).
  * Por **Índice en Base64**.
  * Por **Valor del primo en Decimal**.
  * Por **Valor del primo en Base64**.
* **📊 Resultados Completos:** Cada búsqueda muestra seis datos:
  * Primo número (índice) — decimal.
  * Primo número (índice) en Base64.
  * Valor del primo en Decimal.
  * Valor del primo en Base64.
  * Tiempo de cálculo.
  * Memoria estimada.
* **💾 Gestión de Sesiones y Autoguardado:**
  * Guardado automático en el navegador cada 60 segundos.
  * Capacidad de pausar, cancelar y reanudar búsquedas pesadas.
  * Exportación e importación de sesiones mediante archivos `.json`.
  * Si el navegador se cierra por accidente, la aplicación ofrece reanudar el trabajo justo donde se quedó.
* **🔔 Notificaciones No Bloqueantes:**
  * Sin `alert()` ni `confirm()` nativos.
  * **Toasts** apilables en la esquina superior derecha para mensajes informativos, de éxito, advertencia o error.
  * **Modal de confirmación** con soporte de teclado (`Enter` / `Escape`), botón de foco automático y cierre al hacer clic en el fondo.
* **🎨 Interfaz Compacta:**
  * Resultados organizados en un grid adaptable de seis celdas.
  * Tarjetas de sesión densas con barra de progreso, metadatos y acciones en línea.
  * Diseño responsive que colapsa a una columna en pantallas pequeñas.
* **📈 Monitorización en Tiempo Real:** Interfaz que muestra el progreso porcentual, ratio, estimación del siguiente primo, ETA, número de segmentos procesados, uso de memoria y estado de la aplicación.

## 🛠️ Tecnologías y Estructura

El proyecto está construido con tecnologías web estándar (Vanilla Web), sin dependencias de frameworks externos pesados, lo que garantiza una ejecución rápida y directa.

```
iprimo/
├── iprimo.html       ← estructura de la interfaz
├── styles.css        ← estilos (UI/UX, progreso, insignias, toasts, modal)
└── js/
    ├── config.js     ← CONST(), estado(), helpers de formato
    ├── notify.js     ← sistema de toasts y modal de confirmación
    ├── math.js       ← BigInt ↔ Base64, Miller-Rabin, criba segmentada
    ├── sessions.js   ← localStorage, importación / exportación JSON
    ├── ui.js         ← render de sesiones, progreso, resultados
    ├── search.js     ← findNthPrime, findIndexByPrime
    ├── app.js        ← startSearch, cancelSearch, resumeSession
    └── main.js       ← programa() + llamada de arranque
```

### Filosofía del código JS

* **Sin variables globales:** las constantes viven en `CONST()` y el estado mutable en `estado()`, ambas con caché estático (`CONST._v`, `estado._v`).
* **Solo declaraciones `function` a nivel superior:** nada de `const`/`let`/`var` sueltos. Esto permite que los `onclick="..."` del HTML sigan funcionando (las funciones declaradas en un script clásico son propiedades implícitas de `window`).
* **Sin IIFE:** únicamente funciones con nombre + `programa();` al final de `main.js`.
* **Orden de carga con `defer`:** los siete archivos se ejecutan en orden tras el parseo del HTML, garantizando que `programa()` encuentre el DOM listo y todas las funciones definidas.

| Archivo | Depende de | Contiene |
|---|---|---|
| `config.js`   | —                       | `CONST`, `estado`, `formatBytes`, `describeSegment`, `estimateMemory` |
| `notify.js`   | —                       | `notificar`, `confirmar` |
| `math.js`     | config                  | BigInt ↔ Base64, `millerRabin`, `nextPrime`, `generateBasePrimes`, `sieveSegment` |
| `sessions.js` | config, notify, ui      | `loadSessions`, `upsertSession`, importar / exportar |
| `ui.js`       | config, math, sessions  | `renderSessions`, autosave, `showResults`, `updateProgress` |
| `search.js`   | config, math, ui        | `findNthPrime`, `findIndexByPrime` |
| `app.js`      | todo lo anterior        | `startSearch`, `cancelSearch`, `resumeSession`, recuperación |
| `main.js`     | todo                    | `programa()` + `programa();` |

## 🚀 Cómo usar

1. Clona este repositorio en tu máquina local:

   ```bash
   git clone https://github.com/xelirse/primosrabinmiller.git
   ```

2. No requiere instalación de paquetes (Node.js, npm, etc.).
3. Simplemente abre el archivo `iprimo.html` en cualquier navegador web moderno (Chrome, Firefox, Edge, Safari).
4. Selecciona el modo de búsqueda, ingresa tu valor y presiona **🚀 Buscar**.

### Modos de búsqueda

| Modo | Entrada | Devuelve |
|---|---|---|
| **Índice decimal** | `1000000` | el primo nº 1,000,000 |
| **Índice en Base64** | `F4240` | el primo cuyo índice es `1000000` |
| **Valor del primo en Decimal** | `15485863` | el índice de ese primo |
| **Valor del primo en Base64** | `7sTHe` | el índice de ese primo |

### Cargar sesiones ya completadas

En la tarjeta de una sesión completada, el botón **📋 Cargar** rellena la sección de resultados con los valores guardados **sin recalcular nada**. El botón **🔁 Recalcular** vuelve a ejecutar la búsqueda desde cero.

## 🧠 Sobre los Algoritmos

* **Criba Segmentada:** A diferencia de la Criba de Eratóstenes tradicional que requiere una enorme cantidad de memoria contigua, la versión segmentada divide el rango de búsqueda en bloques (segmentos) más pequeños que caben en la caché de la CPU, procesando el infinito paso a paso. Cada segmento cubre `4,190,208` bytes = `33,521,664` números.
* **Miller-Rabin (12 bases):** Para asegurar que un número es primo de forma determinista (y no solo probabilística) en rangos altísimos, se aplica el test de Miller-Rabin utilizando un conjunto específico de 12 bases primas, una técnica demostrada matemáticamente para evitar falsos positivos (números pseudoprimos).
* **Teorema de los Números Primos (PNT):** se usa para estimar el valor del siguiente primo, el índice esperado y el tiempo restante (ETA) mientras la criba avanza.

## 🔔 Notificaciones y confirmaciones

El proyecto evita deliberadamente los diálogos nativos del navegador (`alert`, `confirm`) por dos motivos:

1. **No bloquean el hilo principal**, por lo que la búsqueda en curso no se congela mientras el usuario lee el mensaje.
2. **Son personalizables** y coherentes con el tema oscuro de la aplicación.

* **`notificar(mensaje, tipo, duración)`** → toast no bloqueante. Tipos: `'info'`, `'success'`, `'warn'`, `'error'`. Se apilan verticalmente y se cierran al hacer clic o automáticamente.
* **`await confirmar(mensaje, { okText, cancelText })`** → modal bloqueante basado en `Promise`. Devuelve `true` / `false`. Admite `Enter` (aceptar), `Escape` (cancelar) y clic en el fondo (cancelar).

## 💾 Persistencia

| Clave en `localStorage` | Contenido |
|---|---|
| `iprimo_sessions_v1` | lista de sesiones guardadas (máx. 20) |
| `iprimo_active_session` | id de la sesión en curso al cerrar la pestaña |

* El autoguardado escribe la sesión activa cada **60 s**.
* Los eventos `beforeunload`, `pagehide` y `visibilitychange` fuerzan un guardado inmediato al ocultar o cerrar la pestaña.
* Las sesiones que quedan en estado `running` por un cierre abrupto se degradan a `paused` al arrancar y se ofrece reanudarlas mediante el modal de confirmación.

## 🤝 Contribución

Las contribuciones son bienvenidas. Si deseas mejorar el algoritmo de búsqueda, optimizar el uso de memoria o mejorar la interfaz:

1. Haz un *Fork* del proyecto.
2. Crea una rama para tu característica (`git checkout -b feature/NuevaCaracteristica`).
3. Haz *Commit* de tus cambios (`git commit -m 'Añadida nueva característica'`).
4. Haz *Push* a la rama (`git push origin feature/NuevaCaracteristica`).
5. Abre un *Pull Request*.

## 📄 Licencia / Dominio Público

Este proyecto es de **Dominio Público**. Eres completamente libre de utilizar, copiar, modificar, fusionar, publicar, distribuir, sublicenciar y/o vender copias de este software, sin ninguna restricción. No se requiere dar crédito ni solicitar permiso.
