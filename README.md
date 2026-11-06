# Orion

Desktop church presentation control — **Electron + Vite + React**, styled with **Libadwaita-inspired** tokens (not native GTK).

## Preserved assets

| Folder | Purpose |
|--------|---------|
| `order-images/` | Service-order slide folders (one subfolder per block) |
| `images/` | Branding and static art |

## Develop (live preview)

From `C:\Development\orion`:

```bash
npm install
npm run dev
```

Opens the Electron window with hot reload. Use this while building UI.

## Production build (see the packaged UI locally)

```bash
npm run build
npm run preview
```

`build` compiles main, preload, and renderer into `out/`. `preview` runs that build in Electron (no dev server).

## Fonts

**Cantarell** is bundled via `@fontsource/cantarell` (same family GNOME uses for Adwaita). It ships inside the app build — no system install required on Windows.

**Icons:** [Coolicons](https://coolicons.cool/) (`*-fill-round` style) via `@iconify/react` — MIT, bundled offline. Map: `src/renderer/src/components/icons.ts`. Browse variants at [icon-sets.iconify.design/coolicons](https://icon-sets.iconify.design/coolicons/).

## Preserved assets

```
src/main/       Electron main process (windows, IPC, filesystem)
src/preload/    contextBridge API exposed as window.orion
src/renderer/   React operator UI
```

## Installers

Two editions, each with a Windows setup and a Linux AppImage:

| Edition | What is inside |
|---------|----------------|
| **Orion** | Empty libraries. Add order images, hymnals, and Bibles yourself. |
| **Orion Panorama** | This church's order images, Afrikaans and English hymnals, King James, and Afrikaans 1953. |

Panorama and the standard app install side by side. Bundled libraries are copied into the app's data folder on first launch, so later edits are kept.

```bash
npm run dist:win
npm run dist:linux
```

```bash
npm run dist:panorama:win
npm run dist:panorama:linux
```

Installers are written to `dist/standard` and `dist/panorama`.
