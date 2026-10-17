# Declaración de uso de IA

> Estado: declaración con la evidencia disponible al 17 de octubre de 2026. Lo marcado «pendiente de confirmar» no tiene evidencia todavía: el equipo debe completarlo o corregirlo antes de la entrega (ver «Información pendiente»).

Proyecto: La Bodeguita (MVP del hackatón de Interledger)
Equipo: Financial Kratos
Repositorio: https://github.com/Vell6z/Financial-Kratos-Team---Repo
Fecha de actualización: 17 de octubre de 2026

Referencia: [política de IA del hackatón](https://interledger.org/es/hackathon/ai-policy/), según el resumen fechado el 17 de octubre de 2026 de la guía usada para preparar este documento. Verificar la versión vigente antes de entregar.

## Herramientas y consumo

| Herramienta | Modelo o versión | Modalidad | Créditos consumidos | Evidencia o limitación |
| --- | --- | --- | --- | --- |
| Claude Code (Anthropic), app de escritorio, pestaña Code | Modelo `claude-opus-5-5` (Claude Opus 5.5); app 2.1.299 | Pagada: suscripción **Claude Pro** de la cuenta de Juan Velez. El uso adicional pagado está desactivado | Anthropic no mide esta suscripción en créditos, y al no haber uso adicional no hubo cobro por créditos. Consumo medido en tokens (registros locales, 1.172 respuestas del modelo): 1.229.687 de salida, 2.348 de entrada sin caché, 3.768.183 escritos en caché y 484.673.086 leídos de caché. Son tokens, no créditos del organizador | Configuración local de la cuenta en Claude Code (tipo de plan, uso adicional desactivado) y metadatos `usage` de los registros de sesión ([prompts/claude-code.md](prompts/claude-code.md)) |
| Codex (OpenAI) | No disponible | Pendiente de confirmar | Pendiente de confirmar | Uso declarado por el equipo. No hay registros de prompts en el repositorio ni en el computador revisado |
| Gemini 4 Argon (Google) | No disponible | Pendiente de confirmar | Pendiente de confirmar | Uso declarado por el equipo. No hay registros de prompts en el repositorio ni en el computador revisado |

**IA como parte del producto (no como asistente de programación):** la app usa la API de **Google Gemini** (`gemini-3.8-flash`) para leer los documentos del estudio de crédito ([src/lib/doc-reader.ts](src/lib/doc-reader.ts)), si hay `GEMINI_API_KEY`. Se declara por transparencia. Se usó una llave de Google AI Studio (entrada 58 del registro). Modalidad y consumo: pendiente de confirmar.

## Alcance de la asistencia

El código se escribió en su mayor parte con Claude Code, guiado por los prompts del equipo. Esos prompts dan los requisitos, las decisiones de negocio y las correcciones. Lo respaldan el registro de prompts y las 12 de 23 commits que llevan `Co-Authored-By: Claude`.

El equipo también usó **Codex** y **Gemini 4 Argon**. No está documentado en qué archivos ni para qué tareas: queda pendiente junto con sus prompts. Lo que el equipo declara hecho sin IA está en la sección siguiente.

| Componente | Herramienta | Ayuda recibida | Intervención humana confirmada | Registro |
| --- | --- | --- | --- | --- |
| Reglas y dominio: [src/lib/config.ts](src/lib/config.ts), [src/lib/finance.ts](src/lib/finance.ts), [src/lib/services.ts](src/lib/services.ts), [src/lib/scoring.ts](src/lib/scoring.ts), [src/lib/credit-history.ts](src/lib/credit-history.ts) | Claude Code | Código de cajitas, aportes, retiros, créditos, mora, cambio de nivel y estudio de crédito | El equipo definió las reglas: niveles, tasas, plazos, 50 % de retiro anticipado, tope de US$30.000 y decisiones del área financiera del 17-oct, como la rentabilidad esperada, el encaje y los 3 días para pagar. Los documentos de reglas los pegó el equipo en los prompts | [prompts/claude-code.md](prompts/claude-code.md) |
| Open Payments: [src/lib/openpayments.ts](src/lib/openpayments.ts), [src/lib/recurring.ts](src/lib/recurring.ts), rutas en [src/app/api/op](src/app/api/op) e [src/app/api/invest](src/app/api/invest) | Claude Code | Grants, cotizaciones, pagos, permiso de la bóveda, confirmación del cobro e inversión recurrente | Pidieron la bóveda, los retiros automáticos y la inversión recurrente. El manejo de las wallets lo hizo el equipo sin IA (ver la sección siguiente) | [prompts/claude-code.md](prompts/claude-code.md) |
| Bre-B: [src/lib/breb.ts](src/lib/breb.ts), [src/lib/breb-keys.ts](src/lib/breb-keys.ts), [src/lib/breb-qr.ts](src/lib/breb-qr.ts), [src/lib/payouts.ts](src/lib/payouts.ts), [src/components/breb-qr-scanner.tsx](src/components/breb-qr-scanner.tsx) | Claude Code | Consulta de llaves, lector EMVCo de QR y desembolso simulado | El equipo aportó la documentación de Wompi, el script de verificación y QR reales para probar. Validó el lector con esos QR | [prompts/claude-code.md](prompts/claude-code.md) |
| Modelo de ML: [ml/](ml/) y [src/lib/riesgo-ml.ts](src/lib/riesgo-ml.ts) | Claude Code | Dataset sintético, entrenamiento y puerto a TypeScript | El equipo ejecutó `python3 ml/train_baseline.py` y revisó las métricas (entradas 16 y 17 del registro) | [prompts/claude-code.md](prompts/claude-code.md) |
| Documentos y PDF: [src/lib/pdf.ts](src/lib/pdf.ts), [src/lib/pdf-doc.ts](src/lib/pdf-doc.ts), [src/lib/receipts.ts](src/lib/receipts.ts), [src/lib/credit-docs.ts](src/lib/credit-docs.ts), [src/lib/doc-reader.ts](src/lib/doc-reader.ts) | Claude Code | Comprobantes, plan de pagos, paz y salvo, certificado con velocímetro y lectura con Gemini | El equipo pidió los documentos y el diseño del velocímetro, con una imagen de referencia (entradas 97 y 98) | [prompts/claude-code.md](prompts/claude-code.md) |
| Verificación facial: [src/lib/faceverify.ts](src/lib/faceverify.ts), [src/lib/face-descriptor.ts](src/lib/face-descriptor.ts), [src/app/registro/face-capture.tsx](src/app/registro/face-capture.tsx), [docs/verificacion-facial.md](docs/verificacion-facial.md) | Pendiente de confirmar | El equipo hizo una primera versión por su cuenta (entrada 64 del registro; herramienta usada pendiente de confirmar). Claude Code la revisó y corrigió: captura de frente, sin rechazo automático, opción sin cámara | Revisión pedida por el equipo | [prompts/claude-code.md](prompts/claude-code.md) |
| Pantallas e interfaz: [src/app/](src/app/) y [src/components/](src/components/) | Claude Code | Páginas, panel del operador, formularios y diseño responsive | El equipo pidió cambios de diseño y de contenido en varias rondas | [prompts/claude-code.md](prompts/claude-code.md) |
| Auditoría y datos de demo: [src/lib/audit.ts](src/lib/audit.ts), [src/lib/demo-seed.ts](src/lib/demo-seed.ts), [src/lib/demo-day-seed.ts](src/lib/demo-day-seed.ts), [src/lib/demo-borrower-seed.ts](src/lib/demo-borrower-seed.ts) | Claude Code (`demo-borrower-seed.ts`: pendiente de confirmar) | Bitácora encadenada por hash y datos de demostración | Pedidos del equipo | [prompts/claude-code.md](prompts/claude-code.md) |
| Documentación: [README.md](README.md), [CLAUDE.md](CLAUDE.md), [docs/modelo-de-riesgo.md](docs/modelo-de-riesgo.md), [docs/reglas-cambio-de-nivel.md](docs/reglas-cambio-de-nivel.md) | Claude Code (en parte) | Redacción y actualización | El README ampliado (`d3f24d0`) no tiene co-autoría de IA: pendiente de confirmar. Las reglas de cambio de nivel las entregó el área financiera del equipo | [prompts/claude-code.md](prompts/claude-code.md) |

## Archivos con mínima o ninguna asistencia

Hechos **sin IA**, según lo declarado por el equipo:

| Ruta o componente | Nivel | Explicación |
| --- | --- | --- |
| Supabase: [src/lib/supabase.ts](src/lib/supabase.ts), [src/lib/uploads.ts](src/lib/uploads.ts), [supabase/schema.sql](supabase/schema.sql), [scripts/migrate-to-supabase.mjs](scripts/migrate-to-supabase.mjs) y los cambios de esa migración en [src/lib/db.ts](src/lib/db.ts) (commit `4426061`) | Ninguna | Migración del almacenamiento a Supabase, hecha por el equipo |
| Vercel: [.vercelignore](.vercelignore) y el ajuste de [next.config.ts](next.config.ts) (commit `ff533ee`) | Ninguna | Configuración del despliegue, hecha por el equipo |
| Wallets: [src/lib/investor-wallet.ts](src/lib/investor-wallet.ts) y el cambio de wallet del inversionista (commit `30b92b5`); llaves de la wallet en base64 en [src/lib/openpayments.ts](src/lib/openpayments.ts) (commit `297949d`) | Ninguna | Manejo de las wallets, hecho por el equipo |
| Archivos `.env` (configuración local; no se publican en el repositorio) | Ninguna | Variables de entorno configuradas por el equipo |

Algunos de estos archivos (por ejemplo `db.ts`, `openpayments.ts` y las rutas de inversión) recibieron después otros cambios con Claude Code, que están en el registro de prompts. Lo declarado sin IA es el trabajo de esas commits. La plantilla [.env.example](.env.example) sí tuvo cambios con Claude Code.

Origen pendiente de confirmar: las demás commits sin la línea de co-autoría de IA, que pudieron hacerse con Codex o Gemini 4 Argon. Son `85d1444` (`.gitignore`), `972d116` (script `dev:https`), `71a657c` (cuotas cada 15 días), `6579e55` (URLs de vuelta de la wallet), `b8bdf0e` (logo), `a3099f8` (demo del acreditado) y `d3f24d0` (README ampliado).

## Revisión realizada por el equipo

Respaldado por el registro de prompts:
- **Decisiones de negocio:** el equipo definió las reglas y las fue corrigiendo. Por ejemplo, los plazos según el riesgo, el retiro anticipado del 50 %, el tope por retiro en USD y las decisiones del área financiera.
- **Pruebas de integraciones reales:** con QR Bre-B reales, consultas al directorio de producción de Wompi (solo lectura) y una llave de Gemini.
- **Entrenamiento del modelo:** el equipo lo ejecutó y pidió revisar los resultados.
- **Revisión de código:** el equipo pidió revisar sus propios cambios antes de integrarlos (entrada 64).
- **Commits y push:** se pidieron de forma explícita, después de revisar.

Durante las sesiones, la propia IA ejecutó compilación (`npm run build`), lint (`npx eslint .`) y pruebas puntuales. Eso no reemplaza la revisión humana.

## Registros de prompts

- [prompts/claude-code.md](prompts/claude-code.md): 108 mensajes reales escritos a Claude Code entre el 16 y el 17 de octubre de 2026, de las 4 sesiones guardadas en el computador de Juan Velez. Tiene tres entradas con redacciones explícitas (una credencial de producción y QR Bre-B reales), así que es una copia para publicación, no el registro íntegro.
- **Codex y Gemini 4 Argon:** no hay registros de prompts. Falta agregarlos en `prompts/` (por ejemplo `prompts/codex.md` y `prompts/gemini.md`) con el texto original exportado de cada herramienta.
- **Cobertura no verificada** para:
  - otros integrantes o computadores;
  - las respuestas elegidas en los cuadros de opciones de Claude Code;
  - las conversaciones de las commits sin co-autoría.

## Información pendiente

- Si el organizador pide una cifra en créditos para la suscripción Claude Pro, confirmar con Anthropic o con el organizador cómo reportarla. Aquí se declara el consumo en tokens.
- Codex y Gemini 4 Argon: para qué tareas y archivos se usaron, modalidad (gratuita o pagada), créditos si fue pagada y los prompts originales exportados.
- Origen de las 7 commits sin co-autoría de IA listadas arriba.
- Modalidad y consumo de la API de Gemini que usa el producto.
- Aparte de esta declaración: que cada participante completó el curso o la guía de Open Payments que exige el reglamento.
