# Spacio AM — Guest App

Web app de registro de huéspedes y "Mi espacio", con panel de administrador.
Front-end estático (HTML + JSX vía Babel en el navegador). El backend es un
Google Apps Script que conecta con Hospitable, Google Sheets y Drive.

## Estructura

```
index.html          ← página principal (abre esta)
config.js           ← URL del backend (Apps Script) + IDs de Sheet/Drive
app/                ← lógica de la app (JSX)
assets/             ← fuentes Valky, logos, fotos, PDF de normas
```

> El código del backend (`Code.gs`) NO va aquí — vive en tu proyecto de
> Google Apps Script. Solo pega en `config.js` la URL `/exec` del Web App.

## Publicar en GitHub Pages

1. Sube esta carpeta a un repositorio de GitHub.
2. Repo → **Settings → Pages** → Source: **Deploy from a branch** →
   Branch: `main` / carpeta `/root` (o `/docs` si la mueves ahí).
3. En 1–2 min tu app estará en `https://<usuario>.github.io/<repo>/`.

Como hay un `.nojekyll`, GitHub sirve las carpetas `app/` y `assets/` tal cual.

## Configuración

- **`config.js`** → `backendUrl`: pega la URL del Web App de Apps Script
  (termina en `/exec`). Sin esto, la app corre con datos de demostración.
- Los secretos (token de Hospitable, correos) viven SOLO en el Apps Script,
  nunca en este repositorio.

## Requiere conexión

La app carga React, ReactDOM y Babel desde unpkg.com (CDN). Necesita internet
para funcionar; no es un bundle offline.
