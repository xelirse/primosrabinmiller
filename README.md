# 🔢 Buscador de Números Primos — Criba Segmentada

_Leeme.md generado por Gemini, gracias por leer._

Una aplicación web de alto rendimiento orientada a la búsqueda y cálculo de números primos gigantescos directamente desde el navegador. Utiliza algoritmos avanzados de teoría de números, soporte nativo para `BigInt` y un sistema de gestión de sesiones para procesos de larga duración.

## ✨ Características Principales

* **🚀 Cálculo Optimizado:** Implementa una **Criba Segmentada** para manejar la búsqueda por bloques, optimizando el uso de la memoria.
* **🛡️ Verificación Determinista:** Utiliza el test de primalidad de **Miller-Rabin** con 12 bases fijas, garantizando una verificación rigurosa para números masivos.
* **🔢 Soporte `BigInt`:** Capacidad para calcular y mostrar números que superan con creces los límites numéricos estándar de JavaScript.
* **🔀 Múltiples Modos de Búsqueda:**
  * Por **Índice decimal** (ej. encontrar el primo número 1,000,000).
  * Por **Índice en Base64**.
  * Por **Valor del primo en Base64**.
* **💾 Gestión de Sesiones y Autoguardado:**
  * Guardado automático en el navegador.
  * Capacidad de pausar, cancelar y reanudar búsquedas pesadas.
  * Exportación e importación de sesiones mediante archivos `.json`.
  * Si el navegador se cierra por accidente, la aplicación ofrece reanudar el trabajo justo donde se quedó.
* **📊 Monitorización en Tiempo Real:** Interfaz rica que muestra el progreso, uso de memoria estimado, tiempo de cálculo y estado de la aplicación.

## 🛠️ Tecnologías y Estructura

El proyecto está construido con tecnologías web estándar (Vanilla Web), sin dependencias de frameworks externos pesados, lo que garantiza una ejecución rápida y directa:

* `iprimo.html`: Estructura de la interfaz de usuario.
* `styles.css`: Estilos de la aplicación (UI/UX, barra de progreso, insignias de estado).
* `script.js`: Lógica core, algoritmos matemáticos, Web Workers (si aplica) y manejo del LocalStorage.

## 🚀 Cómo usar

1. Clona este repositorio en tu máquina local:

   ```bash
   git clone https://github.com/xelirse/primosrabinmiller.git
   ```

2. No requiere instalación de paquetes (Node.js, npm, etc.).
3. Simplemente abre el archivo `iprimo.html` en cualquier navegador web moderno (Chrome, Firefox, Edge, Safari).
4. Selecciona el modo de búsqueda, ingresa tu valor y presiona **🚀 Buscar**.

## 🧠 Sobre los Algoritmos

* **Criba Segmentada:** A diferencia de la Criba de Eratóstenes tradicional que requiere una enorme cantidad de memoria contigua, la versión segmentada divide el rango de búsqueda en bloques (segmentos) más pequeños que caben en la caché de la CPU, procesando el infinito paso a paso.
* **Miller-Rabin (12 bases):** Para asegurar que un número es primo de forma determinista (y no solo probabilística) en rangos altísimos, se aplica el test de Miller-Rabin utilizando un conjunto específico de 12 bases primas, una técnica demostrada matemáticamente para evitar falsos positivos (números pseudoprimos).

## 🤝 Contribución

Las contribuciones son bienvenidas. Si deseas mejorar el algoritmo de búsqueda, optimizar el uso de memoria o mejorar la interfaz:

1. Haz un *Fork* del proyecto.
2. Crea una rama para tu característica (`git checkout -b feature/NuevaCaracteristica`).
3. Haz *Commit* de tus cambios (`git commit -m 'Añadida nueva característica'`).
4. Haz *Push* a la rama (`git push origin feature/NuevaCaracteristica`).
5. Abre un *Pull Request*.

## 📄 Licencia / Dominio Público

Este proyecto es de **Dominio Público**. Eres completamente libre de utilizar, copiar, modificar, fusionar, publicar, distribuir, sublicenciar y/o vender copias de este software, sin ninguna restricción. No se requiere dar crédito ni solicitar permiso.
