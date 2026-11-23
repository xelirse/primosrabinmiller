# 🔢 Buscador de Números Primos — Criba Segmentada

Aplicación web orientada a la búsqueda, cálculo y visualización de números primos desde el navegador. Utiliza algoritmos de teoría de números, soporte nativo para `BigInt`, un motor de precisión decimal propio (`BigFloat`) y un sistema de persistencia de sesiones para procesos de larga duración.

## ✨ Características Principales

* **🚀 Triple Motor de Búsqueda:** Adapta el cálculo según el tamaño del número y el método elegido:
  * **Criba Exacta:** Criba segmentada en bloques sobre `BigInt`.
  * **Aprox. Riemann R:** Estimación analítica usando la función R de Riemann y su inversa.
  * **Aprox. PNT:** Estimación basada en el Teorema de los Números Primos.
* **🧮 Motor `BigFloat` de 46 Decimales:** Las aproximaciones PNT y Riemann R implementan aritmética de punto fijo en `BigInt` escalada a $10^{46}$ para calcular logaritmos, raíces y series sin depender del límite de precisión de los números flotantes nativos de JavaScript.
* **🌳 Visualización de Árbol (Canvas):** Un botón en los resultados despliega un lienzo interactivo (con zoom y desplazamiento) que dibuja el árbol genealógico del primo encontrado. Muestra el primo, su índice, la factorización del índice y recursivamente los índices de sus factores hasta llegar a 1, alineando horizontalmente los valores iguales y separando conectores y filas.
* **🛡️ Verificación de Primalidad:** Utiliza el test de **Miller-Rabin** con 12 bases fijas en las búsquedas y verificaciones principales.
* **🧠 Límite de Memoria y Fallback:** Si la Criba Exacta supera el límite de memoria configurado para los primos base, intercepta el error y aplica un fallback mediante PNT ajustado al primo siguiente.
* **📊 Resultados Completos:** Cada búsqueda muestra siete datos en un grid adaptable:
  * **Método / Algoritmo** (Criba Exacta, PNT, Riemann R o PNT Fallback).
  * **Primo número (índice)** en decimal.
  * **Primo número (índice) en Base64**.
  * **Valor del primo en Decimal**.
  * **Valor del primo en Base64**.
  * **Tiempo de cálculo**.
  * **Memoria estimada**.
* **📈 Progreso en Tiempo Real:** Muestra porcentaje, razón de avance, ETA, último primo encontrado o estimado y segmentos procesados.
* **💾 Gestión de Sesiones y Autoguardado:**
  * Guardado automático periódico de la sesión activa.
  * Historial de sesiones con indicación del método empleado, carga directa de resultados completados, recálculo, reanudación y eliminación.
  * Exportación e importación de sesiones mediante archivos `.json`.
* **🔔 Notificaciones No Bloqueantes:** Toasts y modales de confirmación propios en la interfaz.

## 🛠️ Tecnologías y Estructura

El proyecto está construido con tecnologías web estándar (HTML, CSS y JavaScript), sin dependencias de frameworks externos.

```text
iprimo/
├── iprimo.html       ← estructura de la interfaz (controles, resultados, canvas)
├── styles.css        ← estilos (UI/UX, grid, toasts, modal, árbol)
└── js/
    ├── config.js     ← CONST(), estado(), helpers de formato
    ├── notify.js     ← sistema de toasts y modal de confirmación
    ├── bigfloat.js   ← motor de punto fijo de 46 decimales
    ├── math.js       ← BigInt ↔ Base64, Miller-Rabin, factorización, cribas, Riemann R
    ├── sessions.js   ← localStorage, importación / exportación JSON
    ├── ui.js         ← render de sesiones, progreso, resultados y carga de sesiones
    ├── tree.js       ← construcción del árbol, layout y dibujo en Canvas
    ├── search.js     ← findNthPrime, findIndexByPrime
    ├── app.js        ← startSearch, cancelSearch, ruteo de algoritmos y fallback
    └── main.js       ← programa() + llamada de arranque
```

### Organización del código JS

* **Sin variables globales:** las constantes viven en `CONST()` y el estado mutable en `estado()`, ambas con caché estático.
* **Declaraciones `function` a nivel superior:** permite que los manejadores `onclick` y los eventos del HTML interactúen directamente con las funciones del módulo.
* **Sin IIFE:** funciones con nombre y llamada a `programa()` al iniciar.
* **Orden de carga con `defer`:** los scripts se cargan en secuencia tras el parseo del documento.

## 🚀 Cómo usar

1. Clona este repositorio en tu máquina local:

   ```bash
   git clone [https://github.com/xelirse/primosrabinmiller.git](https://github.com/xelirse/primosrabinmiller.git)
   ```

2. No requiere instalación de paquetes ni servidor de compilación.
3. Abre `iprimo.html` en un navegador web moderno.
4. Selecciona el modo de búsqueda, el algoritmo (`Criba Exacta`, `Aprox. PNT` o `Aprox. Riemann R`), ingresa un valor y presiona **🚀 Buscar**.
5. Cuando haya un resultado visible, presiona **🌳 Ver Árbol** para generar y visualizar su árbol.

### Modos de búsqueda

| Modo | Entrada | Devuelve |
|---|---|---|
| **Índice decimal** | `1000000` | el primo nº 1,000,000 |
| **Índice en Base64** | `F4240` | el primo cuyo índice es `1000000` |
| **Valor del primo en Decimal** | `15485863` | el índice de ese primo |
| **Valor del primo en Base64** | `7sTHe` | el índice de ese primo |

### Algoritmos Disponibles

* **Criba Exacta:** Calcula o ubica el primo o su índice mediante criba segmentada en bloques. Si el tamaño supera el límite de memoria permitido para los primos base, realiza un fallback a PNT.
* **Aprox. PNT:** Estima el valor o el índice usando el Teorema de los Números Primos con `BigFloat` y ajusta al siguiente primo con `nextPrime`.
* **Aprox. Riemann R:** Estima mediante la función R de Riemann o su inversa con iteraciones de Newton-Raphson sobre `BigFloat` y ajusta al siguiente primo.

## 🧠 Sobre los Algoritmos

* **BigFloat (Punto Fijo):** Implementa operaciones en `BigInt` a escala $10^{46}$ (logaritmo natural, raíces y aritmética decimal) para operar con números de gran magnitud sin pérdida de precisión en flotantes estándar.
* **Criba Segmentada:** Procesa rangos en bloques de `SEGMENT_SIZE_BYTES` (`SEGMENT_BITS` bits) usando un `Uint32Array` para los primos base y un `Uint8Array` por segmento.
* **Miller-Rabin (12 bases):** Verifica primalidad usando las bases configuradas en `CONST().MILLER_RABIN_BASES`.
* **Factorización en el Árbol:** Descompone índices compuestos combinando división por primos pequeños, Pollard's Rho (Brent), ECM y SIQS, y obtiene o estima los índices de los factores resultantes.

## 💾 Persistencia

| Clave en `localStorage` | Contenido |
|---|---|
| `iprimo_sessions_v1` | lista de sesiones guardadas |
| `iprimo_active_session` | id de la sesión activa al cerrar o cambiar de pestaña |

* El autoguardado persiste la sesión en curso cada `AUTOSAVE_INTERVAL_MS` (60 s).
* Los eventos `beforeunload`, `pagehide` y `visibilitychange` guardan el estado al ocultar o cerrar la página.
* Las sesiones que quedaron en `running` se marcan como `paused` al iniciar y pueden reanudarse o retomarse desde el historial.
* Cada sesión guarda el algoritmo utilizado, el progreso, los resultados y el árbol generado (si se abrió).

## 🤝 Contribución

Las contribuciones son bienvenidas:

1. Haz un *Fork* del proyecto.
2. Crea una rama para tu cambio (`git checkout -b feature/NuevaCaracteristica`).
3. Haz *Commit* de tus cambios (`git commit -m 'Añadida nueva característica'`).
4. Haz *Push* a la rama (`git push origin feature/NuevaCaracteristica`).
5. Abre un *Pull Request*.

## 📄 Licencia / Dominio Público

Este proyecto es de **Dominio Público**. Puedes utilizar, copiar, modificar, distribuir y comercializar este software sin restricciones ni necesidad de permiso o atribución.
