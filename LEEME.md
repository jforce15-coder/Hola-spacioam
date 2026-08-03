# Arreglo del error "No se pudo iniciar el app"

## Qué pasaba

El `index.html` que está en el servidor es **de una generación anterior** a los
archivos `app/*.jsx` que subiste. El shell viejo carga código nuevo y revienta.
Además su mensaje de error decía solo "Script error." — Safari en iPad oculta el
detalle, así que no había forma de saber qué falló.

También estaba cacheando: el iPad se quedaba con la mezcla de archivos viejos y
nuevos aunque recargaras.

## Qué hacer

1. Sube **`index.html`** (está en esta carpeta) a la raíz del sitio,
   reemplazando el que hay.
2. Sube la carpeta **`app/`** completa de esta entrega.
3. Recarga.

Es importante subir los dos: el `index.html` nuevo y los `.jsx` van juntos.

## Qué trae el index.html nuevo

- **Anti-caché.** Cada archivo se pide con `?v=20260730a`. El navegador no puede
  servirte una versión vieja mezclada con una nueva. En futuras entregas te
  cambio ese número.
- **Errores con nombre y apellido.** Si algo falla ahora dice el archivo y la
  línea exacta, no "Script error.". Si vuelve a pasar, mándame esa captura y lo
  arreglo directo.
- **Botón "Recargar sin caché"** dentro del propio mensaje de error.
- **Aviso a los 12 segundos** si la app quedó colgada sin pintar nada.
- Las animaciones nuevas (respiración del bloque de check-in, aviso discreto de
  cuenta) que faltaban en el `index.html` viejo.

## Si vuelve a fallar

Toca **Recargar sin caché**. Si el error persiste, la captura ahora te dirá algo
como `screens-bento.jsx · línea 412` — con eso lo ubico de inmediato.
