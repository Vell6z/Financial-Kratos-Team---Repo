# Declaración de uso de IA

> **Estado: borrador consolidado, no listo para entregar.** Reúne las declaraciones individuales de Juan Velez, Emmanuel, Juanse y Simón Usme disponibles al 17 de octubre de 2026. Lo marcado «pendiente de confirmar» no tiene evidencia todavía y el equipo debe completarlo o corregirlo antes de la entrega (ver «Información pendiente» y «Contradicciones por resolver»).

Proyecto: La Bodeguita (antes Kratos), MVP de microcréditos para personas no bancarizadas en Colombia: cajitas de inversionistas en Interledger Open Payments que financian créditos desembolsados por Bre-B.
Equipo: Financial Kratos Team
Evento: Hackatón de Open Payments, Medellín, 16 y 17 de octubre de 2026
Repositorio: https://github.com/Vell6z/Financial-Kratos-Team---Repo
Fecha de actualización: 17 de octubre de 2026

Referencia: [política de IA del hackatón](https://interledger.org/es/hackathon/ai-policy/), según el resumen fechado el 17 de octubre de 2026 de la guía usada para preparar este documento. Verificar la versión vigente antes de entregar.

## Integrantes y áreas

| Integrante | Área | Herramientas de IA | Declaración de origen |
| --- | --- | --- | --- |
| Juan Velez | Ingeniería: código de la aplicación | Claude Code; el equipo menciona también Codex y Gemini 4 Argon (ver «Contradicciones») | `AI_USAGE_Velez.md` |
| Emmanuel | Área financiera, modelo de riesgo, prototipo del formulario, logos | Claude (app de escritorio de Claude Code); Higgsfield sin generación | `AI_USAGE_Emmanuel.md` y `emmanuel-claude.md` |
| Juanse | Investigación de mercado sobre crédito informal | Gemini (Google) | PDF «Reporte de Investigación y Declaración IA» |
| Simón Usme | Documentación, contexto para agentes, pitch, diapositivas, nombre y marca | Claude (Claude Code en la nube), conector de Canva, Codex (OpenAI) | `AI_USAGE_Claude_SimonUsme.md` y `AI_USAGE_chatGPT_SimonUsme.md` |

## Herramientas y consumo

| Herramienta | Quién | Modelo o versión | Modalidad | Créditos consumidos | Evidencia o limitación |
| --- | --- | --- | --- | --- | --- |
| Claude Code (Anthropic), app de escritorio | Juan Velez | `claude-opus-5-5` (Claude Opus 5.5); app 2.1.299 | Pagada: suscripción Claude Pro. Uso adicional pagado desactivado | Anthropic no mide esta suscripción en créditos y, sin uso adicional, no hubo cobro por créditos. Consumo en tokens (1.172 respuestas): 1.229.687 de salida, 2.348 de entrada sin caché, 3.768.183 escritos en caché y 484.673.086 leídos de caché | Configuración local de la cuenta y metadatos `usage` de las sesiones. Son tokens, no créditos del organizador |
| Claude (Anthropic), app de escritorio de Claude Code | Emmanuel | Claude Sonnet 5.5 y, desde la tarde del 16 de octubre, Claude Opus 5.5 | Pendiente de confirmar | Pendiente de confirmar | Declaración de Emmanuel. Funciones usadas: búsqueda web, lectura del repositorio `interledger/open-payments`, navegador integrado y widgets interactivos |
| Claude Code en la nube (Anthropic), dentro de un proyecto de Claude | Simón Usme | Familia Claude; identificador exacto en los registros de cada sesión | Pendiente de confirmar (plan de la cuenta) | 4 sesiones cerradas: 113.320 tokens de entrada, 293.838 de salida, 62.617.693 leídos de caché y 1.285.956 escritos en caché. Costo estimado por la plataforma: 28,31 USD. No incluye la sesión que redactó su declaración | Datos de uso de cada sesión, leídos el 17 de octubre. La cifra en USD es una estimación de la plataforma, no un cobro facturado ni créditos |
| Codex (OpenAI), app de escritorio | Simón Usme | No disponible | Pendiente de confirmar | Pendiente de confirmar | Usado para adaptar la skill de declaración y redactar su declaración individual ([prompts/simon-codex.md](prompts/simon-codex.md)) |
| Gemini (Google) | Juanse | No disponible | Pendiente de confirmar | Pendiente de confirmar | Declarado en el PDF de Juanse ([prompts/juanse-gemini.md](prompts/juanse-gemini.md)) |
| Gemini 4 Argon (Google) | Pendiente de confirmar | Gemini 4 Argon | Pendiente de confirmar | Pendiente de confirmar | Mencionado en la declaración de Juan Velez como «uso declarado por el equipo». Sin registros de prompts |
| Conector de Canva usado por Claude | Simón Usme | No aplica | Cuenta de Canva del equipo | No aplica | Claude leyó la plantilla «Copia de Plantilla Consulting team» para tomar colores, tipografía y logos. Canva no generó contenido con IA |
| Higgsfield (conector en Claude) | Emmanuel | No aplica | Pendiente de confirmar | No se generó contenido | Solo se consultaron el saldo de créditos y los espacios de trabajo. No se generó ninguna imagen ni video |

**IA como parte del producto (no como asistente):** la app usa la API de Google Gemini (`gemini-3.8-flash`) para leer los documentos del estudio de crédito en [src/lib/doc-reader.ts](src/lib/doc-reader.ts), si existe `GEMINI_API_KEY`. Se usó una llave de Google AI Studio. Modalidad y consumo: pendiente de confirmar.

Detalle del costo estimado de las sesiones de Simón: coordinación del proyecto 8,61 USD; contexto y documentación del MVP 10,57 USD; guion del pitch 2,96 USD; nombres, logos y kit de marca 6,17 USD.

## Alcance de la asistencia

### Código de la aplicación (Juan Velez)

La mayor parte del código se escribió con Claude Code, guiado por los prompts del equipo, que aportan requisitos, decisiones de negocio y correcciones. Lo respaldan el registro de prompts y las 12 de 23 commits que llevan `Co-Authored-By: Claude`.

| Componente | Herramienta | Ayuda recibida | Intervención humana confirmada | Registro |
| --- | --- | --- | --- | --- |
| Reglas y dominio: [src/lib/config.ts](src/lib/config.ts), [src/lib/finance.ts](src/lib/finance.ts), [src/lib/services.ts](src/lib/services.ts), [src/lib/scoring.ts](src/lib/scoring.ts), [src/lib/credit-history.ts](src/lib/credit-history.ts) | Claude Code | Cajitas, aportes, retiros, créditos, mora, cambio de nivel y estudio de crédito | El equipo definió las reglas (niveles, tasas, plazos, retiro anticipado del 50 %, tope de US$30.000) y las decisiones del área financiera del 17 de octubre. `scoring.ts` integra el modelo diseñado por Emmanuel | [prompts/claude-code.md](prompts/claude-code.md) |
| Open Payments: [src/lib/openpayments.ts](src/lib/openpayments.ts), [src/lib/recurring.ts](src/lib/recurring.ts), [src/app/api/op](src/app/api/op), [src/app/api/invest](src/app/api/invest) | Claude Code | Grants, cotizaciones, pagos, permiso de la bóveda, confirmación del cobro e inversión recurrente | El equipo pidió la bóveda, los retiros automáticos y la inversión recurrente. El manejo de las wallets lo hizo el equipo sin IA | [prompts/claude-code.md](prompts/claude-code.md) |
| Bre-B: [src/lib/breb.ts](src/lib/breb.ts), [src/lib/breb-keys.ts](src/lib/breb-keys.ts), [src/lib/breb-qr.ts](src/lib/breb-qr.ts), [src/lib/payouts.ts](src/lib/payouts.ts), [src/components/breb-qr-scanner.tsx](src/components/breb-qr-scanner.tsx) | Claude Code | Consulta de llaves, lector EMVCo de QR y desembolso simulado | El equipo aportó la documentación de Wompi, el script de verificación y QR reales, y validó el lector con ellos | [prompts/claude-code.md](prompts/claude-code.md) |
| Modelo de ML: [ml/](ml/), [src/lib/riesgo-ml.ts](src/lib/riesgo-ml.ts) | Claude Code | Dataset sintético, entrenamiento y puerto a TypeScript | El equipo ejecutó `python3 ml/train_baseline.py` y revisó las métricas (entradas 16 y 17) | [prompts/claude-code.md](prompts/claude-code.md) |
| Documentos y PDF: [src/lib/pdf.ts](src/lib/pdf.ts), [src/lib/pdf-doc.ts](src/lib/pdf-doc.ts), [src/lib/receipts.ts](src/lib/receipts.ts), [src/lib/credit-docs.ts](src/lib/credit-docs.ts), [src/lib/doc-reader.ts](src/lib/doc-reader.ts) | Claude Code | Comprobantes, plan de pagos, paz y salvo, certificado con velocímetro y lectura con Gemini | El equipo pidió los documentos y el diseño del velocímetro con una imagen de referencia (entradas 97 y 98) | [prompts/claude-code.md](prompts/claude-code.md) |
| Verificación facial: [src/lib/faceverify.ts](src/lib/faceverify.ts), [src/lib/face-descriptor.ts](src/lib/face-descriptor.ts), [src/app/registro/face-capture.tsx](src/app/registro/face-capture.tsx), [docs/verificacion-facial.md](docs/verificacion-facial.md) | Primera versión: pendiente de confirmar. Revisión: Claude Code | El equipo hizo una primera versión (entrada 64). Claude Code la revisó y corrigió: captura de frente, sin rechazo automático, opción sin cámara | Revisión pedida por el equipo | [prompts/claude-code.md](prompts/claude-code.md) |
| Pantallas e interfaz: [src/app/](src/app/), [src/components/](src/components/) | Claude Code | Páginas, panel del operador, formularios y diseño responsive | Cambios de diseño y contenido pedidos en varias rondas | [prompts/claude-code.md](prompts/claude-code.md) |
| Auditoría y datos de demo: [src/lib/audit.ts](src/lib/audit.ts), [src/lib/demo-seed.ts](src/lib/demo-seed.ts), [src/lib/demo-day-seed.ts](src/lib/demo-day-seed.ts), [src/lib/demo-borrower-seed.ts](src/lib/demo-borrower-seed.ts) | Claude Code (`demo-borrower-seed.ts`: pendiente de confirmar) | Bitácora encadenada por hash y datos de demostración | Pedidos del equipo | [prompts/claude-code.md](prompts/claude-code.md) |
| Documentación del repositorio: [README.md](README.md), [CLAUDE.md](CLAUDE.md), [docs/modelo-de-riesgo.md](docs/modelo-de-riesgo.md), [docs/reglas-cambio-de-nivel.md](docs/reglas-cambio-de-nivel.md) | Claude Code (en parte) | Redacción y actualización | El README ampliado (`d3f24d0`) no tiene co-autoría de IA: pendiente de confirmar. Las reglas de cambio de nivel parten del documento del área financiera (Emmanuel, también hecho con Claude) | [prompts/claude-code.md](prompts/claude-code.md) |

### Área financiera, modelo de riesgo y prototipo del formulario (Emmanuel)

Antes del evento (hasta el 15 de octubre) Emmanuel usó Claude para investigar Open Payments e Interledger, revisar fuentes, elegir el problema y revisar el modelo de negocio. Declara que **no se escribió código del proyecto antes del evento**. La IA se usó en todo el trabajo de esta área, con revisión y decisiones del equipo.

| Archivo o componente | Herramienta | Ayuda recibida | Intervención humana confirmada | Registro |
| --- | --- | --- | --- | --- |
| `CLAUDE.md` y `AGENTS.md` de contexto compartido (ubicación: pendiente de confirmar) | Claude | Redactados a partir de la documentación oficial (openpayments.dev, `interledger/open-payments`, SDK de Node, interledger.org, rafiki.dev) y las reglas del hackatón | Emmanuel pidió quitar datos personales y el proyecto anterior | [prompts/emmanuel-claude.md](prompts/emmanuel-claude.md), entradas 1 a 8 |
| `Formulario_Perfil_Riesgo.md` (fuera del repositorio) | Claude | Preguntas del estudio, puntaje de 100 puntos, factor de confianza, cruces de coherencia, niveles 1 a 4 y condiciones; simuladores interactivos (widgets, no quedan como archivo) | El equipo decidió umbrales (70 / 50 / 35), nivel 4, techos, plazos, tasas y factores | Entradas 9 a 22 |
| Carpeta `formulario-riesgo/` (rama local `formulario-riesgo`, commit `2d5514f`, **no subida a GitHub**): `lib/riesgo.ts`, `lib/riesgo.test.mjs`, `components/FormularioRiesgo.tsx`, `components/ResultadoRiesgo.tsx`, `components/formulario.module.css`, `app/api/perfil/route.ts`, `app/perfil/page.tsx`, `README.md` | Claude | **Todo el código lo generó Claude.** Prototipo y referencia de diseño; la versión de la app es `src/lib/scoring.ts` | Emmanuel lo probó en local y pidió correcciones (cálculo de intereses, cuotas semanales o mensuales, quitar la wallet address) | Entradas 23 a 35 |
| `Reglas_cambio_de_nivel.md` y `Decisiones_area_financiera.md` (fuera del repositorio) | Claude | Redacción, cálculos y alternativas sobre pérdidas, mora, solicitud de pago con 3 días, reporte simulado a centrales, encaje, comisión y rentabilidad | Las decisiones las tomó el equipo; Emmanuel borró por su cuenta el apartado de usura | Entradas 36 a 56 |
| `logos/*.svg` (fuera del repositorio; ver «Contradicciones») | Claude | Símbolos SVG de caja fuerte minimalistas en código; sin generador de imágenes | Emmanuel eligió los símbolos | Entradas 57 a 60 |
| Referencias para el pitch | Claude (búsqueda web) | Tasa de usura de octubre de 2026, Decreto 1357 de 2018, tasas de CDT y de cajitas de Nu | Cifras marcadas «por verificar» en los documentos | Entradas 36 a 56 |

### Investigación de mercado (Juanse)

| Archivo o componente | Herramienta | Ayuda recibida | Intervención humana confirmada | Registro |
| --- | --- | --- | --- | --- |
| PDF «Reporte de Investigación y Declaración IA» (fuera del repositorio): contexto del crédito informal, comparativo de tasas gota a gota frente a la usura y estrategia de captura WhatsApp + OCR (caso «Doña Gladys») | Gemini | Investigación sobre recaudo informal, diseño de incentivos para un score alternativo y consulta de fuentes secundarias (ANIF, revistas de economía) | Juanse definió el caso de uso, el perfil «Doña Gladys», el alcance geográfico y los canales físicos (Gana, Efecty). Pendiente: si el texto del reporte lo redactó Gemini y si se verificaron las cifras (382,2 % y 666,5 % E.A.) en la fuente | [prompts/juanse-gemini.md](prompts/juanse-gemini.md) |

### Documentación, pitch y marca (Simón Usme)

Estos archivos están en la carpeta de preparación de Simón. Si están en el repositorio: pendiente de confirmar.

| Archivo o componente | Herramienta | Ayuda recibida | Intervención humana confirmada | Registro |
| --- | --- | --- | --- | --- |
| `AGENTS.md`, `CLAUDE.md`, `README.md` de la carpeta de preparación | Claude; actualizaciones posteriores con Codex | Redactados por la IA a partir del relato de Simón y del `CLAUDE.md` previo del código | Simón dio el relato del producto y respondió las dudas que llevaron a correcciones | [prompts/01-contexto-documentacion-y-diapositivas.md](prompts/01-contexto-documentacion-y-diapositivas.md) (por copiar) |
| `docs/architecture.md`, `docs/current-state.md`, `docs/regulacion-colombia.md`, `docs/para-el-programador.md` | Claude; `architecture.md` y `current-state.md` también con Codex | Redactados por la IA; la IA buscó y citó fuentes regulatorias (usura, bajo monto, mora, Bre-B) | Decisiones de negocio de Simón (cuotas quincenales, aporte anual, reserva 60/40). Sin constancia de revisión de las fuentes regulatorias | Ídem |
| `docs/decisions/000` a `004` | Claude (001 y 002 también tocadas con Codex) | Redactados por la IA | Contenido de la decisión 004 dado por Simón; la 003 (tasas) sigue sin decidir | Ídem |
| `CONTEXTO_INTERLEDGER.md`, `docs/lluvia-de-ideas.md` | IA no identificada (sesiones anteriores, prompts no disponibles); Codex en ediciones actuales | Síntesis de fuentes del evento y de las 18 clases de Platzi; exploración de ideas | Material del curso aportado por Simón | No disponible |
| `skills/kratos-proyecto/` | Claude | Skill de contexto escrita y actualizada por la IA | Simón la pidió y la guardó en su cuenta | Ídem |
| `scripts/sync-agent-docs.mjs`, `scripts/setup.mjs`, `scripts/git-hooks/pre-commit`, `config/claude-settings.json` | Claude | Código escrito por la IA: sincroniza `AGENTS.md` y `CLAUDE.md` e instala la skill y el hook | La IA dijo que probó el hook. Sin constancia de que el equipo los ejecutara | Ídem |
| `scripts/sync-agent-docs.ps1` | IA no identificada | Script PowerShell de sincronización | Codex ejecutó la comprobación `-Check`; prompt original no disponible | No disponible |
| `docs/pdf/*.pdf` | Claude | Generados por la IA a partir de los `.md` | Ninguna confirmada | Ídem |
| `pitch/guion-pitch-4m30.md` y `.pdf` | Claude | Guion redactado por la IA con cifras de un informe del equipo; la IA descartó dos cifras inconsistentes y calculó el ejemplo del crédito de 1 millón | Simón definió temas, orden y tiempos | [prompts/02-guion-del-pitch.md](prompts/02-guion-del-pitch.md) (por copiar) |
| Diapositivas del pitch (fuera del repositorio) | Claude + conector de Canva | Diapositivas con el estilo de la plantilla de Canva del equipo | Simón las editó a mano y eliminó varias; el boceto del flujo en pizarra es suyo | Entrada 01 |
| Logo y kit de marca (SVG, PNG, favicons, `LaBodeguitaLogo.tsx`, `la-bodeguita-logo.css`; fuera del repositorio) | Claude | Diseños, componente React y CSS generados por la IA | El nombre «La Bodeguita» y la paleta son del equipo; Simón eligió el concepto y la variante final | [prompts/03-nombre-y-logo.md](prompts/03-nombre-y-logo.md) (por copiar) |
| `output/skills/interledger-ai-usage/` | Codex | Extracción del ZIP aportado, metadatos para Codex, validación (`quick_validate.py`: «Skill is valid!») e instalación | Simón aportó el ZIP | [prompts/simon-codex.md](prompts/simon-codex.md) |
| Este `AI_USAGE.md` y la carpeta `prompts/` | Claude (Claude Code, app de escritorio, `claude-opus-5-5`), a partir de las seis declaraciones individuales; las declaraciones individuales las redactaron Claude y Codex | Consolidación, cruce de datos y redacción | Pendiente: revisión del equipo | [prompts/04-declaracion-de-uso-de-ia.md](prompts/04-declaracion-de-uso-de-ia.md) (por copiar) y [prompts/simon-codex.md](prompts/simon-codex.md) |

No se usó IA en todo el proyecto: el relato del producto, las decisiones de negocio, el nombre, las ediciones manuales de las diapositivas y los archivos de la sección siguiente son del equipo.

## Archivos con mínima o ninguna asistencia

Hechos **sin IA**, según lo declarado por Juan Velez:

| Ruta o componente | Nivel | Explicación |
| --- | --- | --- |
| Supabase: [src/lib/supabase.ts](src/lib/supabase.ts), [src/lib/uploads.ts](src/lib/uploads.ts), [supabase/schema.sql](supabase/schema.sql), [scripts/migrate-to-supabase.mjs](scripts/migrate-to-supabase.mjs) y los cambios de esa migración en [src/lib/db.ts](src/lib/db.ts) (commit `4426061`) | Ninguna | Migración del almacenamiento a Supabase, hecha por el equipo |
| Vercel: [.vercelignore](.vercelignore) y el ajuste de [next.config.ts](next.config.ts) (commit `ff533ee`) | Ninguna | Configuración del despliegue, hecha por el equipo |
| Wallets: [src/lib/investor-wallet.ts](src/lib/investor-wallet.ts) y el cambio de wallet del inversionista (commit `30b92b5`); llaves de la wallet en base64 en [src/lib/openpayments.ts](src/lib/openpayments.ts) (commit `297949d`) | Ninguna | Manejo de las wallets, hecho por el equipo |
| Archivos `.env` (locales, no publicados) | Ninguna | Variables de entorno configuradas por el equipo |

Algunos de estos archivos (`db.ts`, `openpayments.ts`, rutas de inversión) recibieron después cambios con Claude Code, registrados en el log de prompts. Lo declarado sin IA es el trabajo de esas commits. [.env.example](.env.example) sí tuvo cambios con Claude Code.

Origen pendiente de confirmar: commits sin co-autoría de IA que pudieron hacerse con otra herramienta: `85d1444` (`.gitignore`), `972d116` (script `dev:https`), `71a657c` (cuotas cada 15 días), `6579e55` (URLs de vuelta de la wallet), `b8bdf0e` (logo), `a3099f8` (demo del acreditado) y `d3f24d0` (README ampliado). Nota: los logos los hicieron Emmanuel y Simón con Claude, así que `b8bdf0e` probablemente contiene trabajo asistido aunque la commit no lleve co-autoría.

Emmanuel, Juanse y Simón no declaran archivos de su área escritos sin IA.

## Revisión realizada por el equipo

Respaldado por los registros:

- **Decisiones de negocio:** el equipo definió y corrigió las reglas: niveles y umbrales de riesgo, tasas y techos, plazos elegidos por el cliente, sin pago anticipado, encaje, solicitud de pago con 3 días antes de la mora, reporte simulado a centrales, retiro anticipado del 50 % y tope en USD.
- **Pruebas de integraciones reales (Juan Velez):** QR Bre-B reales, consultas de solo lectura al directorio de producción de Wompi y una llave de Gemini.
- **Modelo de ML:** el equipo ejecutó el entrenamiento y revisó las métricas.
- **Revisión de código:** el equipo pidió revisar sus propios cambios antes de integrarlos (entrada 64); los commits y el push se pidieron de forma explícita.
- **Formulario (Emmanuel):** lo probó en local y cuestionó los resultados; detectó que los intereses de un crédito de 90 días al 30 % E.A. no cuadraban, y Claude corrigió un error de redondeo del total.
- **Marco legal (Emmanuel):** el equipo encontró por su cuenta la norma sobre la tasa de usura y eliminó esa sección de los documentos generados.
- **Pitch y marca (Simón):** corrigió datos en las respuestas de la IA (frecuencia de cuotas, plazo del inversionista, significado del 60/40), editó las diapositivas a mano y eligió nombre y logo.

Verificaciones hechas por la propia IA, que no reemplazan la revisión humana: `npm run build`, `npx eslint .` y pruebas puntuales (Claude Code de Velez); validador de la skill, comprobación SHA-256 y `sync-agent-docs.ps1 -Check` (Codex de Simón).

No confirmado:
- Que alguien verificara las fuentes regulatorias, las cifras del pitch y las tasas del reporte de Juanse.
- Que el equipo ejecutara los scripts de sincronización de Simón.

## Registros de prompts

| Archivo | Herramienta | Integrante | Estado |
| --- | --- | --- | --- |
| [prompts/claude-code.md](prompts/claude-code.md) | Claude Code | Juan Velez | En el repositorio. 108 mensajes del 16 y 17 de octubre, de 4 sesiones. Copia para publicación con tres redacciones explícitas (una credencial de producción y QR Bre-B reales) |
| [prompts/emmanuel-claude.md](prompts/emmanuel-claude.md) | Claude | Emmanuel | Incluido. 61 mensajes del 16 y 17 de octubre, con las respuestas a preguntas de opción múltiple entre corchetes |
| [prompts/juanse-gemini.md](prompts/juanse-gemini.md) | Gemini | Juanse | Incluido. 3 prompts transcritos de su reporte PDF; no es una exportación de Gemini |
| [prompts/01-contexto-documentacion-y-diapositivas.md](prompts/01-contexto-documentacion-y-diapositivas.md), [02](prompts/02-guion-del-pitch.md), [03](prompts/03-nombre-y-logo.md), [04](prompts/04-declaracion-de-uso-de-ia.md) | Claude | Simón Usme | **Falta copiarlos** a `prompts/` desde la carpeta de Simón. Cobertura completa del proyecto «Financial Kratos Team» en Claude, salvo dos instrucciones internas entre sesiones no disponibles |
| [prompts/simon-codex.md](prompts/simon-codex.md) | Codex | Simón Usme | Incluido. Solo las solicitudes visibles de la conversación que redactó su declaración |

Sin registro: Codex y Gemini 4 Argon en el código (si se usaron), las sesiones de preparación previas de Simón (`CONTEXTO_INTERLEDGER.md`, `sync-agent-docs.ps1`) y la investigación previa al evento de Emmanuel. **Cobertura no verificada** para otros computadores y cuentas.

## Contradicciones por resolver

1. **Codex y Gemini 4 Argon en el código.** La declaración de Velez los lista como «uso declarado por el equipo» y sugiere que pudieron usarse en las commits sin co-autoría. Las demás declaraciones solo muestran Codex en documentación (Simón) y Gemini en investigación (Juanse). Confirmar si alguien los usó en código y, si no, dejar Codex y Gemini solo en sus filas de Simón y Juanse.
2. **«Gemini 4 Argon» y «Gemini».** Confirmar si es la misma herramienta que usó Juanse y en ese caso unificar las filas.
3. **Tres versiones de `CLAUDE.md` / `AGENTS.md`.** Emmanuel, Simón y Velez tienen cada uno uno propio. Confirmar cuál está en el repositorio y quién lo hizo.
4. **Dos juegos de logos.** Emmanuel (SVG) y Simón (kit de marca) hicieron logos con Claude. Confirmar cuál es el final y si es el de la commit `b8bdf0e`.
5. **Materiales fuera del repositorio.** El prototipo `formulario-riesgo/`, los documentos financieros, el reporte de Juanse y la carpeta de preparación de Simón no están en el repositorio. Decidir si se suben o si quedan solo declarados.

## Información pendiente

- Modalidad (gratuita o pagada) y créditos de Emmanuel en Claude, Simón en Claude y Codex, Juanse en Gemini y la API de Gemini del producto.
- Si el organizador pide créditos para las suscripciones de Claude, confirmar con el organizador cómo reportar el consumo en tokens.
- Origen de las 7 commits sin co-autoría de IA.
- Herramienta usada en la primera versión de la verificación facial y en `demo-borrower-seed.ts`.
- Copiar los prompts 01 a 04 de Simón a `prompts/`.
- Si el texto del reporte de Juanse lo redactó Gemini.
- Revisión de este documento por los cuatro integrantes antes de entregarlo.
- Aparte de esta declaración: que cada participante completó el curso o la Guía de Open Payments que exige el reglamento.
