/* ============================================================
   SPACIO AM — GUEST APP · configuración pública
   ------------------------------------------------------------
   Este archivo SÍ se sube a GitHub. NO contiene secretos.
   El token de Hospitable y los permisos de Sheets/Drive viven
   SOLO en el backend de Google Apps Script (nunca en el navegador).

   PASO ÚNICO DE CONFIGURACIÓN:
   1. Publica el Apps Script de /backend como "Aplicación web"
      (ver backend/INSTRUCCIONES.md).
   2. Copia la URL que termina en /exec y pégala abajo entre comillas.
   ============================================================ */
window.SPACIO_CONFIG = {
  // URL del Web App de Google Apps Script (termina en /exec). Ej:
  // "https://script.google.com/macros/s/AKfy.../exec"
  backendUrl: "https://script.google.com/macros/s/AKfycbwnaUyShyZHDD--rLd7XouPY4mBpgEYPYVxG2bL86nswVg89XZ9jLMFkh2ktL2IG1VRUg/exec",

  // IDs de referencia (informativos — el backend los usa del lado servidor).
  sheetId: "12TF-FO6vld2VkzDr9YlUnHlNjh4d1u9Ss6qWz3F3KeQ",
  driveFolderId: "133Ijv9_bPfSXXwlV3zHK5LDB6KQ6d0GS",
};
