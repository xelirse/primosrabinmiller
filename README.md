# 🔢 Buscador de Números Primos — Criba Segmentada

_Leeme.md actualizado._

Una aplicación web de alto rendimiento orientada a la búsqueda, cálculo y visualización de números primos gigantescos directamente desde el navegador. Utiliza algoritmos avanzados de teoría de números, soporte nativo para `BigInt`, un motor de precisión decimal propio (`BigFloat`) y un sistema de gestión de sesiones para procesos de larga duración.

## ✨ Características Principales

* **🚀 Triple Motor de Búsqueda:** Adapta el cálculo según el tamaño del número:
  * **Criba Exacta:** Para rangos que caben en la memoria del navegador.
  * **Aprox. Riemann R:** Estimación analítica usando la función R de Riemann.
  * **Aprox. PNT:** Estimación rápida basada en el Teorema de los Números Primos.
* **🧮 Motor `BigFloat` de 46 Decimales:** Las aproximaciones PNT y Riemann R no usan los números flotantes nativos de JavaScript (limitados a 17 dígitos). En su lugar, implementan un motor de punto fijo en `BigInt` que calcula logaritmos y raíces con 46 decimales de precisión exacta, evitando errores de desbordamiento (como `-Infinity`).
* **🌳 Visualización de Árbol (Canvas):** Un botón en los resultados permite dibujar un árbol genealógico del primo encontrado. Muestra el Primo, su Índice, la factorización del índice, y recursivamente los índices de esos factores hasta llegar a 1. Usa el algoritmo **Pollard's Rho** para factorizar instantáneamente.
* **🛡️ Verificación Determinista:** Utiliza el test de primalidad de **Miller-Rabin** con 12 bases fijas, garantizando una verificación rigurosa para números masivos.
* **🧠 Límite de Memoria Seguro:** Si la Criba Exacta requiere más de **64 MB** de RAM para generar los primos base, el navegador no colapsa. La app intercepta el error y ofrece una estimación instantánea mediante PNT usando el motor `BigFloat`.
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
  * Exportación e importación de sesiones mediante archivos `.json`.
* **🔔 Notificaciones No Bloqueantes:** Toasts apilables y modales de confirmación propios, sin usar `alert()` ni `confirm()` nativos que congelen el hilo principal.

## 🛠️ Tecnologías y Estructura

El proyecto está construido con tecnologías web estándar (Vanilla Web), sin dependencias de frameworks externos pesados, lo que garantiza una ejecución rápida y directa.

```text
iprimo/
├── iprimo.html       ← estructura de la interfaz (controles, resultados, canvas)
├── styles.css        ← estilos (UI/UX, grid, toasts, modal, árbol)
└── js/
    ├── config.js     ← CONST(), estado(), helpers de formato
    ├── notify.js     ← sistema de toasts y modal de confirmación
    ├── bigfloat.js   ← NUEVO: Motor de punto fijo de 46 decimales
    ├── math.js       ← BigInt ↔ Base64, Miller-Rabin, Pollard's Rho, cribas, Riemann R
    ├── sessions.js   ← localStorage, importación / exportación JSON
    ├── ui.js         ← render de sesiones, progreso, resultados y dibujo del árbol en Canvas
    ├── search.js     ← findNthPrime, findIndexByPrime
    ├── app.js        ← startSearch, cancelSearch, ruteo de algoritmos y uso de BigFloat
    └── main.js       ← programa() + llamada de arranque
```

### Filosofía del código JS

* **Sin variables globales:** las constantes viven en `CONST()` y el estado mutable en `estado()`, ambas con caché estático (`CONST._v`, `estado._v`).
* **Solo declaraciones `function` a nivel superior:** nada de `const`/`let`/`var` sueltos. Esto permite que los `onclick="..."` del HTML sigan funcionando.
* **Sin IIFE:** únicamente funciones con nombre + `programa();` al final de `main.js`.
* **Orden de carga con `defer`:** los nueve archivos se ejecutan en orden tras el parseo del HTML, garantizando que `programa()` encuentre el DOM listo y todas las funciones definidas.

## 🚀 Cómo usar

1. Clona este repositorio en tu máquina local:

   ```bash
   git clone https://github.com/xelirse/primosrabinmiller.git
   ```

2. No requiere instalación de paquetes (Node.js, npm, etc.).
3. Simplemente abre el archivo `iprimo.html` en cualquier navegador web moderno (Chrome, Firefox, Edge, Safari).
4. Selecciona el modo de búsqueda, el algoritmo (Exacto, PNT o Riemann R), ingresa tu valor y presiona **🚀 Buscar**.
5. Una vez obtenido un resultado, presiona **🌳 Ver Árbol** para explorar su estructura interna.

### Modos de búsqueda

| Modo | Entrada | Devuelve |
|---|---|---|
| **Índice decimal** | `1000000` | el primo nº 1,000,000 |
| **Índice en Base64** | `F4240` | el primo cuyo índice es `1000000` |
| **Valor del primo en Decimal** | `15485863` | el índice de ese primo |
| **Valor del primo en Base64** | `7sTHe` | el índice de ese primo |

### Algoritmos Disponibles

* **Criba Exacta:** Busca el valor real usando segmentos en RAM. Si el número es demasiado grande (ej. \(10^{25}\)), arrojará un aviso de falta de memoria y aplicará un fallback automático a PNT.
* **Aprox. PNT:** Usa el Teorema de los Números Primos (\(p_n \approx n(\ln n + \ln \ln n - 1)\)). Gracias al motor `BigFloat`, es instantáneo y conserva una alta precisión incluso en números extremadamente grandes.
* **Aprox. Riemann R:** Usa la función R de Riemann y su inversa, implementada con el motor `BigFloat` y el método de Newton-Raphson para una convergencia rápida y precisa.

## 🧠 Sobre los Algoritmos

* **BigFloat (Punto Fijo):** Al intentar calcular `ln(x)` para números gigantescos, los flotantes de JS colapsan. `bigfloat.js` implementa una aritmética escalada a \(10^{46}\). Mediante series de Taylor para el logaritmo natural y el método de Newton para raíces cuadradas, garantiza que los últimos 46 dígitos decimales sean matemáticamente correctos.
* **Criba Segmentada:** Divide el rango de búsqueda en bloques que caben en la caché de la CPU. Cada segmento procesa `4,190,208` bytes = `33,521,664` números. Los primos base se almacenan en un `Uint32Array` para ahorrar hasta un 80% de memoria.
* **Miller-Rabin (12 bases):** Test de primalidad determinista usando las primeras 12 bases primas, evitando falsos positivos en los rangos soportados.
* **Pollard's Rho:** Utilizado exclusivamente para la generación del árbol genealógico. Encuentra los factores primos de índices compuestos de manera eficiente en tiempo \(O(n^{1/4})\).
* **Árbol de Factores:** Si el índice es menor a 5,000,000, cuenta los primos exactamente mediante fuerza bruta; si es mayor, usa la función R de Riemann para estimar el índice del factor y lo marca con un prefijo `~` en el canvas.

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
