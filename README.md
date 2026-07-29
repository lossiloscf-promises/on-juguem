# Cancha Libre

Marketplace de disponibilidad para amistosos de fútbol base. Los coordinadores publican qué equipos y fechas tienen libres; otros clubes reservan directamente, sin grupos de WhatsApp.

## Qué es esto ahora mismo

Una app real con backend (Firebase: autenticación + base de datos en tiempo real), lista para:
1. Desplegarse gratis en GitHub Pages.
2. Instalarse como app en el móvil (PWA) desde el navegador, sin pasar por App Store/Play Store.
3. Más adelante, envolverse con Capacitor para publicarla en las tiendas oficiales sin reescribir nada.

## Paso 1 — Crear el proyecto de Firebase (tú, 5 minutos)

Esto es lo único que tienes que hacer fuera de aquí, porque necesita tu propia cuenta:

1. Ve a [console.firebase.google.com](https://console.firebase.google.com) y crea un proyecto nuevo (ej. "cancha-libre").
2. En el menú lateral, entra en **Build → Authentication → Get started**, pestaña "Sign-in method", activa **Email/Password**.
3. Entra en **Build → Firestore Database → Create database**. Elige modo producción y la región más cercana (europe-west, por ejemplo).
4. Ve a **Project settings** (el engranaje) → baja hasta "Your apps" → clic en el icono `</>` (Web) → regístrala con cualquier nombre.
5. Firebase te dará un bloque `firebaseConfig` con 6 valores (`apiKey`, `authDomain`, `projectId`, etc.). Los necesitas para el paso 2.

## Paso 2 — Configurar las claves localmente

```bash
cp .env.example .env.local
```

Rellena `.env.local` con los 6 valores que te dio Firebase. Este archivo **no se sube a GitHub** (ya está en `.gitignore`).

## Paso 3 — Probarlo en tu ordenador

```bash
npm install
npm run dev
```

Abre la URL que te muestre la terminal (normalmente `http://localhost:5173`). Crea tu club de prueba con el formulario de registro.

## Paso 4 — Subir las reglas de seguridad a Firebase

Necesitas la CLI de Firebase una vez:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # elige tu proyecto, acepta los nombres por defecto
firebase deploy --only firestore:rules
```

Esto sube el archivo `firestore.rules` que ya está preparado (evita que cualquiera pueda leer/escribir lo que no debe).

## Paso 5 — Subir el proyecto a GitHub

```bash
git init
git add .
git commit -m "Primera versión de Cancha Libre"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/cancha-libre.git
git push -u origin main
```

Si tu repositorio no se llama exactamente `cancha-libre`, cambia el valor de `REPO_NAME` en `vite.config.js` antes de subirlo.

## Paso 6 — Activar GitHub Pages

1. En GitHub, ve a **Settings → Pages** del repo → en "Build and deployment" elige **GitHub Actions** como source.
2. Ve a **Settings → Secrets and variables → Actions** → añade estos 6 secrets con los mismos valores de tu `.env.local`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
3. Haz cualquier commit a `main` (o entra en la pestaña **Actions** del repo y lanza el workflow "Deploy a GitHub Pages" manualmente).
4. En unos 2 minutos tu app estará en `https://TU-USUARIO.github.io/cancha-libre/`.

## Paso 7 — Instalarla como app en el móvil

Abre esa URL desde el navegador del móvil (Chrome en Android, Safari en iOS) y usa "Añadir a pantalla de inicio". Se abrirá como una app normal, con icono propio y sin barra de navegador.

## Qué falta (roadmap)

- [ ] Notificación por email cuando llega una solicitud (Firebase Functions + servicio de email)
- [ ] Filtro por zona/distancia real (geolocalización o campo "provincia")
- [ ] Historial de partidos jugados y valoraciones entre clubes (para generar confianza)
- [ ] Panel de monetización: suscripción o límite de equipos gratis
- [ ] Empaquetado con Capacitor para publicar en App Store / Google Play
