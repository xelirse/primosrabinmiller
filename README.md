# 🔢 Buscador de Números Primos — Criba Segmentada

Aplicación web orientada a la búsqueda, cálculo y visualización de números primos desde el navegador[cite: 5]. Utiliza algoritmos de teoría de números, soporte nativo para `BigInt`, un motor de precisión decimal propio (`BigFloat`) y un sistema de persistencia de sesiones para procesos de larga duración[cite: 5].

## ✨ Características Principales

* **🚀 Triple Motor de Búsqueda:** Adapta el cálculo según el tamaño del número y el método elegido[cite: 5, 15]:
  * **Criba Exacta:** Criba segmentada en bloques sobre `BigInt`[cite: 5, 20].
  * **Aprox. Riemann R:** Estimación analítica usando la función R de Riemann y su inversa[cite: 5, 18].
  * **Aprox. PNT:** Estimación basada en el Teorema de los Números Primos[cite: 5, 17].
* **🧮 Motor `BigFloat` de 46 Decimales:** Las aproximaciones PNT y Riemann R implementan aritmética de punto fijo en `BigInt` escalada a $10^{46}$ para calcular logaritmos, raíces y series sin depender del límite de precisión de los números flotantes nativos de JavaScript[cite: 5, 18].
* **🌳 Visualización de Árbol (Canvas):** Un botón en los resultados despliega un lienzo interactivo (con zoom y desplazamiento) que dibuja el árbol genealógico del primo encontrado[cite: 5, 6, 15]. Muestra el primo, su índice, la factorización del índice y recursivamente los índices de sus factores hasta llegar a 1, alineando horizontalmente los valores iguales y separando conectores y filas[cite: 5, 6].
* **🛡️ Verificación de Primalidad:** Utiliza el test de **Miller-Rabin** con 12 bases fijas en las búsquedas y verificaciones principales[cite: 5, 15, 17].
* **🧠 Límite de Memoria y Fallback:** Si la Criba Exacta supera el límite de memoria configurado para los primos base, intercepta el error y aplica un fallback mediante PNT ajustado al primo siguiente[cite: 5, 17, 18].
* **📊 Resultados Completos:** Cada búsqueda muestra siete datos en un grid adaptable[cite: 4, 5, 15]:
  * **Método / Algoritmo** (Criba Exacta, PNT, Riemann R o PNT Fallback)[cite: 5, 15, 17].
  * **Primo número (índice)** en decimal[cite: 5, 15].
  * **Primo número (índice) en Base64**[cite: 5, 15].
  * **Valor del primo en Decimal**[cite: 5, 15].
  * **Valor del primo en Base64**[cite: 5, 15].
  * **Tiempo de cálculo**[cite: 5, 15].
  * **Memoria estimada**[cite: 5, 15].
* **📈 Progreso en Tiempo Real:** Muestra porcentaje, razón de avance, ETA, último primo encontrado o estimado y segmentos procesados[cite: 4, 20].
* **💾 Gestión de Sesiones y Autoguardado:**
  * Guardado automático periódico de la sesión activa[cite: 7, 15].
  * Historial de sesiones con indicación del método empleado, carga directa de resultados completados, recálculo, reanudación y eliminación[cite: 5, 7, 17].
  * Exportación e importación de sesiones mediante archivos `.json`[cite: 5, 10, 15].
* **🔔 Notificaciones No Bloqueantes:** Toasts y modales de confirmación propios en la interfaz[cite: 4, 5, 8].

## 🛠️ Tecnologías y Estructura

El proyecto está construido con tecnologías web estándar (HTML, CSS y JavaScript), sin dependencias de frameworks externos[cite: 3, 4, 5].

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

* **Sin variables globales:** las constantes viven en `CONST()` y el estado mutable en `estado()`, ambas con caché estático[cite: 5].
* **Declaraciones `function` a nivel superior:** permite que los manejadores `onclick` y los eventos del HTML interactúen directamente con las funciones del módulo[cite: 5, 15].
* **Sin IIFE:** funciones con nombre y llamada a `programa()` al iniciar[cite: 5].
* **Orden de carga con `defer`:** los scripts se cargan en secuencia tras el parseo del documento[cite: 5, 15].

## 🚀 Cómo usar

1. Clona este repositorio en tu máquina local[cite: 5]:

   ```bash
   git clone [https://github.com/xelirse/primosrabinmiller.git](https://github.com/xelirse/primosrabinmiller.git)
   ```

2. No requiere instalación de paquetes ni servidor de compilación[cite: 5].
3. Abre `iprimo.html` en un navegador web moderno[cite: 5, 15].
4. Selecciona el modo de búsqueda, el algoritmo (`Criba Exacta`, `Aprox. PNT` o `Aprox. Riemann R`), ingresa un valor y presiona **🚀 Buscar**[cite: 5, 15].
5. Cuando haya un resultado visible, presiona **🌳 Ver Árbol** para generar y visualizar su árbol[cite: 5, 6, 15].

### Modos de búsqueda

| Modo | Entrada | Devuelve |
|---|---|---|
| **Índice decimal** | `1000000`[cite: 5] | el primo nº 1,000,000[cite: 5] |
| **Índice en Base64** | `F4240`[cite: 5] | el primo cuyo índice es `1000000`[cite: 5] |
| **Valor del primo en Decimal** | `15485863`[cite: 5] | el índice de ese primo[cite: 5] |
| **Valor del primo en Base64** | `7sTHe`[cite: 5] | el índice de ese primo[cite: 5] |

### Algoritmos Disponibles

* **Criba Exacta:** Calcula o ubica el primo o su índice mediante criba segmentada en bloques[cite: 5, 20]. Si el tamaño supera el límite de memoria permitido para los primos base, realiza un fallback a PNT[cite: 5, 17, 18].
* **Aprox. PNT:** Estima el valor o el índice usando el Teorema de los Números Primos con `BigFloat` y ajusta al siguiente primo con `nextPrime`[cite: 5, 17, 18].
* **Aprox. Riemann R:** Estima mediante la función R de Riemann o su inversa con iteraciones de Newton-Raphson sobre `BigFloat` y ajusta al siguiente primo[cite: 5, 17, 18].

## 🧠 Sobre los Algoritmos

* **BigFloat (Punto Fijo):** Implementa operaciones en `BigInt` a escala $10^{46}$ (logaritmo natural, raíces y aritmética decimal) para operar con números de gran magnitud sin pérdida de precisión en flotantes estándar[cite: 5, 18].
* **Criba Segmentada:** Procesa rangos en bloques de `SEGMENT_SIZE_BYTES` (`SEGMENT_BITS` bits) usando un `Uint32Array` para los primos base y un `Uint8Array` por segmento[cite: 18, 20].
* **Miller-Rabin (12 bases):** Verifica primalidad usando las bases configuradas en `CONST().MILLER_RABIN_BASES`[cite: 5, 18].
* **Factorización en el Árbol:** Descompone índices compuestos combinando división por primos pequeños, Pollard's Rho (Brent), ECM y SIQS, y obtiene o estima los índices de los factores resultantes[cite: 6, 18].

## 💾 Persistencia

| Clave en `localStorage` | Contenido |
|---|---|
| `iprimo_sessions_v1`[cite: 5] | lista de sesiones guardadas[cite: 5] |
| `iprimo_active_session`[cite: 5] | id de la sesión activa al cerrar o cambiar de pestaña[cite: 5, 8] |

* El autoguardado persiste la sesión en curso cada `AUTOSAVE_INTERVAL_MS` (60 s)[cite: 5, 7].
* Los eventos `beforeunload`, `pagehide` y `visibilitychange` guardan el estado al ocultar o cerrar la página[cite: 5, 17].
* Las sesiones que quedaron en `running` se marcan como `paused` al iniciar y pueden reanudarse o retomarse desde el historial[cite: 5, 7, 8].
* Cada sesión guarda el algoritmo utilizado, el progreso, los resultados y el árbol generado (si se abrió)[cite: 5, 6, 7, 17].

## 🤝 Contribución

Las contribuciones son bienvenidas[cite: 5]:

1. Haz un *Fork* del proyecto[cite: 5].
2. Crea una rama para tu cambio (`git checkout -b feature/NuevaCaracteristica`)[cite: 5].
3. Haz *Commit* de tus cambios (`git commit -m 'Añadida nueva característica'`)[cite: 5].
4. Haz *Push* a la rama (`git push origin feature/NuevaCaracteristica`)[cite: 5].
5. Abre un *Pull Request*[cite: 5].

## 📄 Licencia / Dominio Público

Este proyecto es de **Dominio Público**[cite: 5]. Puedes utilizar, copiar, modificar, distribuir y comercializar este software sin restricciones ni necesidad de permiso o atribución[cite: 5].
