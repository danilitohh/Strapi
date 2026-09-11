# Automatización de HrefLang para Strapi

Recorre todos los productos `es-MX` mediante la API paginada de Strapi, detecta los códigos HrefLang faltantes, valida sus páginas y agrega únicamente URLs que respondan con HTTP `200`.

## Seguridad y puesta en marcha

1. Instala Node.js 20 o superior.
2. Ejecuta `npm install`.
3. Copia `.env.example` como `.env`.
4. Abre `.env` y pega el JWT en esta línea:

   ```env
   STRAPI_API_TOKEN=tu_token_real_aqui
   ```

El archivo `.env` está ignorado por Git. No pegues el token en ningún archivo de `src/`, en capturas ni en el repositorio.

## Flujo recomendado

Primero inspecciona un producto, sin realizar cambios:

```powershell
npm run inspect
```

Comprueba en la salida la ruta real de `slug`, SEO y `MultipleHrefLangs`. Si difiere, ajusta en `.env:

```env
STRAPI_SLUG_PATH=slug
STRAPI_HREFLANGS_PATH=seo.MultipleHrefLangs
STRAPI_POPULATE_QUERY=populate[seo][populate]=*
```

Después ejecuta una simulación completa:

```powershell
npm run dry-run
```

La simulación recorre automáticamente todas las páginas y guarda el resultado en `reports/`, pero no modifica Strapi. Revisa el reporte antes de aplicar.

Para limitar una prueba a los primeros dos productos, configura en `.env`:

```env
MAX_PRODUCTS=2
```

`STRAPI_PAGE_SIZE` solo controla cuántos registros trae cada página y no limita el total. Para volver a procesar todo, deja `MAX_PRODUCTS=` vacío.

Solo cuando la inspección y la simulación sean correctas:

```powershell
npm run apply
```

## Reglas implementadas

- 14 entradas máximas: 13 países más `x-default`.
- Se revisan los códigos existentes para identificar exactamente cuáles faltan.
- Se usa el `slug` del producto con estas excepciones lingüísticas por país:
  - Chile: `maestria` se convierte en `magister`.
  - Chile, Bolivia, Colombia, Ecuador, Paraguay y Perú: `licenciatura` se convierte en `carrera`.
- Las sustituciones se realizan únicamente al inicio del slug; el resto permanece intacto.
- México y `x-default` usan `https://utel.edu.mx/{slug}`.
- Perú usa `https://utlenlinea.com/{slug}`.
- Los demás usan `https://utel.edu.mx/{pais}/{slug}`.
- Solo HTTP `200` se considera disponible. `404`, `500`, timeout y cualquier otro resultado se descartan sin reintento.
- Los registros existentes se conservan y no se crean códigos duplicados.
- Las entradas nuevas usan `locale: ""` y `rel: "alternate"`.

## Estructura

```text
src/
  automation.ts     lógica por producto
  cli.ts            comandos inspect, simulación y aplicación
  config.ts         lectura y validación de .env
  countries.ts      países, códigos y construcción de URLs
  http.ts           validación HTTP
  object-path.ts    acceso a campos anidados
  strapi-client.ts  paginación y actualización en Strapi
  types.ts          tipos compartidos
tests/
  countries.test.ts
reports/             reportes ignorados por Git
```

> Importante: el nombre visible en el panel puede no coincidir con la clave JSON. Por eso el primer paso obligatorio es `npm run inspect` antes de aplicar cambios.
