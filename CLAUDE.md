# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"On Juguem" (Cancha Libre) — a marketplace for Spanish grassroots football (fútbol base) clubs to publish which teams/dates they have free for friendlies, and for other clubs to book directly, replacing coordination over WhatsApp groups. Spanish-language app (UI text, comments, commit messages, and variable/function names are all in Spanish — follow that convention). Domain is specific to the Comunitat Valenciana football federation (FFCV) structure.

React 19 + Vite frontend, deployed as a static PWA to GitHub Pages. Firebase (Auth + Firestore + Storage + Cloud Functions + Cloud Messaging) is the entire backend — there is no custom server.

## Frontend design work

Always invoke the `frontend-design` skill (installed at `.agents/skills/frontend-design`) before designing or reshaping any UI in this repo — new components under `src/components/`, changes to `src/styles.css`, the PWA manifest/icons in `vite.config.js`, or any visual/layout/typography decision. Use it by default for this kind of work, not just when explicitly asked for a "design" pass; it steers away from templated AI-default looks and toward choices deliberately grounded in this app's own subject matter (grassroots football, coordinators, matchday scheduling), not generic SaaS visuals.

## App video / motion graphics work

Always invoke the `remotion-motion-graphics` skill (installed at `.agents/skills/remotion-motion-graphics`) by default whenever asked to design, create, or edit a video for the app — promo/launch videos, intros/outros, feature demos, animated captions, or any Remotion-based motion graphics. Read it before writing any Remotion code; it exists specifically to avoid generic/amateur-looking output.

## Commands

```bash
npm run dev       # vite dev server
npm run build     # production build to dist/
npm run lint      # oxlint
npm run preview   # preview a production build
```

There is no test suite configured in this repo.

Cloud Functions live in `functions/` as a separate npm package (CommonJS, Node 20):
```bash
cd functions
npm run serve     # firebase emulators:start --only functions
npm run deploy    # firebase deploy --only functions
npm run logs      # firebase functions:log
```

Deploying Firestore/Storage security rules:
```bash
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

Deployment to GitHub Pages happens via `.github/workflows/` on push to `main` (builds with `VITE_FIREBASE_*` secrets, then publishes `dist/`). `vite.config.js` hardcodes `REPO_NAME = 'on-juguem'` as the base path — it must match the actual GitHub repo name.

Local Firebase config goes in `.env.local` (six `VITE_FIREBASE_*` keys, see `.env.example`), not committed.

## Architecture

### Everything is Firestore, real-time, no server logic in the client for permissions

`src/firebase.js` initializes the Firebase app singleton (`auth`, `db`, `functions` — region `europe-west1` — and `storage`). All data access is direct Firestore SDK calls from React hooks, secured by `firestore.rules` (and `storage.rules`), not by anything in the client. When changing what a role can read/write, the authoritative source of truth is `firestore.rules`, and the client-side checks in hooks/components are UX only — never assume a client-side guard is a security boundary.

Key collections: `users` (one per club/coordinator account, holds contact info + `verificado`/`esAdmin` flags), `teams` (a club's teams by category), `jornadas` (calendar matchdays owned by a coordinator), `slots` (the actual booking unit — one doc per `teamId__jornadaId` combination, see below), `historial` (audit trail per slot), `clubesOficiales` (public directory of official clubs, used for onboarding autocomplete), `solicitudesClub`, `config/estado` (global maintenance-mode flag, read even when logged out).

### `slots` is the core state machine

A slot represents one team's availability for one matchday, keyed as `slots/{teamId}__{jornadaId}` (see `slotDocId` in `src/hooks/useClubData.js`). Its `status` field moves through: `libre` (free) → `pendiente` (another club requested it) → `pactado` (owner accepted, venue not yet fixed) → `confirmado` (day/time/venue locked in), or `no_disponible` (owner marked unavailable). Side-channel fields on the same doc track in-flight proposals without changing `status` yet: `cancelacionPropuestaPor` (cancel proposal), `sedePropuestaPor`/`sedePropuesta`/`sedePropuestaDetalles` (venue proposal), `cambioPropuestoPor`/`cambioPropuesto` (reschedule proposal). Every mutation function in `src/hooks/useClubData.js` (`requestBooking`, `aceptarPartido`, `proponerSede`, `aceptarSede`, `proponerCancelacion`, `aceptarCancelacion`, etc.) is a small, named transition — read that file's function names before writing a new one; there is likely already a matching transition. All of them also call `registrarHistorial` to append to `historial` (best-effort, swallows its own errors — the audit log is informational, never blocking).

Closing a match (`cerrarComoLocal`/`cerrarComoVisitante` → `cerrarPartidoAtomico`) is the one operation that runs inside a Firestore transaction, because it must re-check for scheduling conflicts (same field/day/time, or the same team double-booked same day) against fresh server data at commit time — client-side conflict checks (`hayConflictoDeHorario`, `hayOtroPartidoMismoDia` in the same file) are only used to pick candidate docs to re-verify inside the transaction, never trusted directly. `hayConflictoDeAforo` in `src/constants.js` encodes the actual capacity rule: Fútbol 11 matches need an exclusive time slot on a field; Fútbol 8 matches can share a field two-at-a-time, but never mixed with an F11 match.

### Real-time hooks pattern

Data hooks in `src/hooks/` (`useMyTeams`, `useMySlots`, `useAllTeams`, `useAllSlots`, `useJornadas`, etc.) wrap `onSnapshot` and return live-updating arrays; there's no client-side cache/store layer beyond React state. Hooks that need to run before/without a logged-in user (`useAllTeams`, `useAllSlots`) explicitly wait for `auth.onAuthStateChanged` before attaching a Firestore listener, to avoid a permission-denied query firing on page load before login — replicate this pattern for any new collection-wide listener.

### Role-based single-page view switching

`src/App.jsx` is the root component. It has no router — `role` state picks which top-level view renders (`CoordinadorView`, `ClubView`, `CuadranteView`, `TemporadaView`, `TorneosView`, `AjustesView`, `AdminView`). Before reaching the main app it gates through a sequence of full-screen states: maintenance mode (`useEstadoApp`) → not logged in → just signed up (`OnboardingWizard`) → no push-notification device registered yet → multiple coordinador contacts configured but no "who are you" identity picked yet (`identidad.js`, session-only, used purely to attribute historial entries when several people share one login) → email not verified (non-blocking banner) → main app.

`?publico=<uid>` query param bypasses everything and renders `CuadrantePublico`, a read-only public view of one club's schedule (backed by the `cuadrantePublico` HTTP Cloud Function, which strips contact info server-side before responding).

### Cloud Functions (`functions/index.js`)

Four callable functions wrap Anthropic's Claude API for natural-language features (free-text availability parsing, recommendation explanations, calendar error review, WhatsApp message drafting) — the API key is a Firebase secret, never touches the client. `avisosDeHuecos` is a Firestore trigger on `slots/{slotId}` writes that diffs before/after state to decide which push notifications to send (new request, acceptance, venue/cancellation/reschedule proposals, match confirmed, slot freed back up) — when adding a new slot-transition function in the client, check whether `avisosDeHuecos` also needs a new branch so the right party gets notified. Geocoding functions (`geocodificarClubNuevo` trigger, `geocodificarLoteClubes`, `autocompletarDireccion`, `detalleDireccion`) wrap Google's Geocoding/Places APIs, also server-side only.

### Domain model (`src/constants.js`)

Category structure is specific to FFCV grassroots football: `GENEROS` × `FORMATOS` (Fútbol 11 / Fútbol 8) × age group (`AGE_GROUPS_BY_FORMATO`) × `CATEGORIAS` (league division) × `NIVELES` (competitive level). Some age groups additionally split by birth year (`AGE_GROUPS_WITH_ANYO`). `ORDEN_EDAD` defines the canonical display order used throughout the UI — don't re-derive ordering ad hoc elsewhere. Per-category contact routing (`contactoParaCategoria`/`claveCoordinador`) lets a club assign a different coordinator per format/gender combo, falling back to a general coordinator, then to the club's default contact.

### i18n

`src/i18n.js` provides `t(key)` for UI strings with a small set of supported languages (`IDIOMAS`); language choice is stored client-side and switching triggers a full page reload (see `Header`'s `cambiarIdioma` in `App.jsx`). Not everything is run through `t()` — plenty of Spanish strings are still inlined directly in components.
