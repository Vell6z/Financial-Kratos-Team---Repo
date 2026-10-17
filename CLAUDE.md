@AGENTS.md

# Kratos — contexto del proyecto

MVP de hackathon (Interledger) del equipo **Financial Kratos**. Plataforma de inclusión financiera en Colombia:

- **Inversionistas** (nacionales o extranjeros) invierten por **Interledger / Open Payments** en "cajitas" tipo Nu que rentan con interés compuesto diario según un nivel de riesgo.
- Ese capital financia **microcréditos a personas no bancarizadas** ("acreditados"), aprobados con un estudio de crédito propio (reglas + Machine Learning).
- El dinero llega y se paga en pesos por **Bre-B** (llaves del sistema de pagos inmediatos de Colombia, vía Wompi).
- Todo corre en sandbox / red de prueba: **nunca se mueve dinero real**.

Idioma: la app, el código (comentarios, nombres de negocio) y la documentación están en **español**. Mantenerlo así.

## Stack y comandos

- Next.js **16** (App Router, `src/proxy.ts` en lugar de middleware, los `params` de rutas son Promises) + React 19 + Tailwind v4 (`@theme inline`) + TypeScript.
- `@interledger/open-payments` (Open Payments), `jsqr` (lector de QR, versión fija 1.4.0).
- Persistencia: un JSON en `data/db.json` (ignorado por git) con acceso serializado vía `withDB`. Borrar `data/` reinicia la demo; las cuentas demo se recrean solas.
- ML: Python (solo librería estándar) en `ml/`.

```bash
npm run dev            # servidor de desarrollo en :3000 (en .claude/launch.json como "kratos-dev")
npm run dev:https      # igual, con https y abierto a la red local: para probar la cámara desde el celular
npm run build          # compila y revisa tipos: debe pasar antes de cualquier commit
npx eslint .           # lint
npm run ml:dataset     # regenera ml/dataset/creditos_sinteticos.csv (usa computeStudy de la app)
python3 ml/train_baseline.py   # entrena el modelo base y escribe ml/modelo/regresion_logistica.json
```

## Mapa del código

**Reglas y dominio (`src/lib/`)**
- `config.ts` — reglas de negocio: niveles, tasas, techos, plazos, capital semilla, plazo y tope de retiros, llave Bre-B de la bóveda (`VAULT_BREB`). **Las reglas se cambian aquí.**
- `finance.ts` — tasa por periodo, interés compuesto, tabla de amortización francesa (una cuota cada 15 días), formato COP.
- `db.ts` — tipos de la base y `withDB` / `readDB` / `now(db)`. `now(db)` es el reloj de la demo (el operador lo puede adelantar).
- `services.ts` — lógica de negocio del servidor:
  - cajitas y aportes (`creditDeposit`, `withdrawable`, `debitWithdraw`, `refundWithdraw`);
  - estudio (`saveStudy`, `studyView`);
  - créditos (`requestLoan`, `fundWaitingLoans`, `completeDisbursement`, `rejectDisbursement`, `receiveBrebPayment`, `loanView`).
- `scoring.ts` — estudio de crédito en 6 pasos y modelo de riesgo por reglas (`computeStudy`, `CONFIG`, `creditLimit`, `DocReading`). Compartido cliente/servidor, pero **el puntaje solo se calcula en el servidor**. Explicación completa: `docs/modelo-de-riesgo.md`.
- `riesgo-ml.ts` — modelo de ML (regresión logística) que ajusta ±1 el nivel de reglas. Lee `ml/modelo/regresion_logistica.json`. **`mlFeatures()` debe calcular exactamente lo mismo que `features()` de `ml/train_baseline.py`.**

**Integraciones**
- `openpayments.ts` — Open Payments: inversión (inversionista → bóveda) y retiro (bóveda → inversionista):
  - grants interactivos con verificación del `hash` GNAP;
  - confirmación en la wallet que recibe (`confirmIncoming`): se abona o descuenta lo que llegó al *incoming payment*, que luego se cierra;
  - permiso de retiros automáticos de la bóveda (`startVaultGrant` / `sendFromVault`), con rotación de token.
- `fx.ts` — tasa de mercado COP ↔ moneda de la bóveda (open.er-api.com, caché 1 h) y máximo por retiro en USD → COP.
- `breb.ts` — resolver llaves Bre-B en el directorio de Wompi (**solo GET**). `breb-keys.ts`: tipos y formato de llaves (compartido).
- `breb-qr.ts` — lector EMVCo de QR Bre-B, estricto (CRC, plantilla `CO.COM.RBM.LLA`, una sola llave).
- `payouts.ts` — desembolso: re-verifica la llave en el directorio justo antes de pagar y arma el payout de Wompi **sin enviarlo**.
- `doc-reader.ts` — lectura de documentos del estudio con **Gemini**; sin `GEMINI_API_KEY` usa trucos en el nombre del archivo.

**Soporte**
- `auth.ts` (sesión por cookie `kratos_session`, `requireUser` / `requireRole` / `requireAdmin` / `requirePageRole`), `password.ts` (scrypt).
- `validators.ts` (validaciones compartidas navegador/servidor), `registration.ts`, `notifications.ts`, `dashboard.ts`, `nav.ts`, `api.ts` (`handle()` convierte errores en JSON).
- Documentos PDF, sin dependencias:
  - `pdf.ts` genera el archivo y `pdf-doc.ts` da el diseño común (encabezado, secciones, tablas, pie);
  - `receipts.ts`: comprobante de cada movimiento (inversión, retiro, desembolso, pago) en `/api/receipts/[id]`;
  - `credit-docs.ts`: plan de pagos (`/api/loans/[id]/plan`) y paz y salvo (`/api/loans/[id]/paz-y-salvo`, solo con el crédito pagado);
  - `pdf-response.ts`: responde el PDF (con `?descargar` lo baja como archivo).
- `demo-seed.ts` — inversiones precargadas de la cuenta demo de inversionista (una sola vez, `db.demoSeeded`).
- `demo-accounts.ts` — cuentas demo (inversionista, acreditado, operador). **Sus credenciales viven solo ahí: no repetirlas en chats, docs ni commits nuevos.**

**Pantallas (`src/app/`)** — cada ruta protegida tiene un `layout.tsx` con guardas de rol.
- Públicas: `/` (landing), `/login`, `/registro` (asistente en 4 pasos).
- `/inicio` (home por rol) y `/movimientos`.
- Acreditado: `/estudio` (obligatorio antes de pedir crédito), `/credito` (oferta, llave Bre-B, escáner QR), `/mi-credito` (cuotas, simulador de pago Bre-B, comprobante de desembolso).
- Inversionista: `/invertir` (cotización Interledger, cajitas con aportes).
- Operador: `/boveda` (pools, cartera, permiso de retiros automáticos, recaudo Bre-B, reloj de la demo).
- APIs en `src/app/api/*`.

**Otros**
- `ml/` — generador del dataset sintético, entrenamiento y README con el diccionario de datos.
- `docs/modelo-de-riesgo.md` — modelo de riesgo detallado (pitch).
- `README.md` — guía para correr y conectar las integraciones.

## Reglas de negocio clave

| Nivel | Tasa EA | Techo | Plazo del crédito |
|---|---|---|---|
| 1 (riesgo bajo) | 24 % | $5.000.000 | 30–365 días |
| 2 (riesgo medio) | 30 % | $3.000.000 | 30–150 días |
| 3 (riesgo alto) | 36 % | $1.000.000 | 30–90 días |

**Crédito**
- Mínimo **2 cuotas**, una **cada 15 días** contados desde el desembolso (no por quincenas del calendario), sistema francés. `MIN_INSTALLMENTS` en `config.ts`.
- Cupo = el menor entre el techo del nivel y el valor presente de la cuota máxima (50 % de lo que le sobra cada 15 días).
- Si el pool no tiene capital, el crédito queda **en espera de fondeo**.

**Inversión y retiros**
- Capital semilla de $50 M (supuesto).
- Cada inversión es un **aporte que dura un año** (en cualquier nivel, `INVESTMENT_TERM_DAYS`): antes del año se puede sacar como máximo el 50 % de ese aporte. Los retiros salen primero de los aportes vencidos.
- Máximo **US$30.000 por retiro**, pasado a COP con la tasa del día.
- El pago vale por lo que confirma **la wallet que recibe**. Si llega solo una parte, se abona esa parte (o, en un retiro, el resto vuelve a la cajita).

**Estudio y modelo de riesgo**
- Factores de confianza: declarado ×0,5, documento ×0,8, confirmado ×1.
- Cruces X1–X5, exclusiones, nivel 4 = no apto con reintento en 60 días.
- El ML sube un nivel si la probabilidad de atraso es < 4 % y lo baja si es > 30 %. Nunca sube a quien las reglas dejaron en nivel 4.

**Bre-B**
- La llave se verifica en el directorio antes de pedir el crédito. La verificación vale 5 minutos, es solo del usuario y se usa una vez.
- El crédito usa la llave **guardada en el servidor**, nunca la del formulario.
- Estados del desembolso: `CREDIT_APPROVED → BREB_KEY_VERIFIED → USER_CONFIRMED_BENEFICIARY → TREASURY_DEBITED → PAYOUT_SUBMITTED → DISBURSED`, o `BREB_KEY_REJECTED`, que devuelve el capital y deja el crédito cancelado.
- Pagos del acreditado: transferencia simulada a la llave `@kratosboveda` (vinculada a la bóveda), con abonos parciales aplicados a la cuota más antigua.

## Real vs. simulado

| Parte | Estado |
|---|---|
| Inversión y retiro por Open Payments | **Real** en la red de prueba (wallet.interledger-test.dev) |
| Tasa COP → moneda de la bóveda | **Real** (tasa de mercado). Interledger define la tasa entre monedas de wallets |
| Verificación de llaves Bre-B | **Real** contra el directorio de producción de Wompi, solo lectura (`WOMPI_RESOLVE_ENV=production`) |
| Lector de QR Bre-B | **Real**, probado con QR de Bancolombia y Nequi |
| Lectura de documentos | **Gemini** (`gemini-3.8-flash`, una sola llamada por estudio, `thinkingLevel: low`, ~10 s) si hay `GEMINI_API_KEY`; si no, trucos en el nombre (`factura_mora`, `extracto_1000000`, "alterad"). El plan gratuito permite ~5 llamadas por minuto |
| Comprobantes, plan de pagos y paz y salvo | PDF generado en el servidor. Los de inversión y retiro llevan la cotización y la confirmación del cobro |
| Inversiones de la cuenta demo | Precargadas (marcadas como demostración, sin Interledger) |
| Desembolso (payout) | Simulado: payout armado, no enviado |
| Pago de cuotas | Simulador de banco en `/mi-credito` |
| Referencias | Simuladas |
| Verificación facial | Local en el navegador: suficiente para la demo (umbrales sin calibrar con personas reales) |

Wallets de prueba (en `.env`, no en el código):
- Plataforma, firma las peticiones: `8c5cd013`.
- Bóveda, EUR: `f62cd2c0`.
- Inversionista demo, USD: `usdtroly`.

## Variables de entorno (`.env`, plantilla en `.env.example`)

- **Open Payments:**
  - `OP_PLATFORM_WALLET_ADDRESS`, `OP_KEY_ID`, `OP_PRIVATE_KEY_PATH` (`./secrets/private.key`);
  - `OP_VAULT_WALLET_ADDRESS`, `OP_DEMO_INVESTOR_WALLET`;
  - `OP_VAULT_GRANT_LIMIT_USD` (tope del permiso de la bóveda) y, opcional, `OP_COP_PER_UNIT` (fija la tasa a mano).
- **Wompi:**
  - `WOMPI_RESOLVE_ENV` (o `WOMPI_ENV`) = `sandbox` o `production` para la consulta de llaves;
  - credenciales `WOMPI_PAYOUT_*` / `WOMPI_SANDBOX_*` (sandbox) y `WOMPI_PROD_*` (producción, **solo para resolver llaves**).
- **IA:** `GEMINI_API_KEY`, `GEMINI_MODEL` (por defecto `gemini-3.8-flash`; `gemini-2.5-flash` ya no está disponible para llaves nuevas).
- Sin variables de Open Payments, la app corre en modo simulado.

## Reglas para trabajar en este repo

**Seguridad**
- **Nunca** subir a git `.env`, `secrets/`, `data/` ni llaves. El `.gitignore` ya los cubre; revisar antes de cada commit.
- Las credenciales `WOMPI_PROD_*` son de **producción**. Solo se usan para `GET /breb/keys/resolve`. **Jamás** usarlas para `POST /payouts` ni para nada que mueva dinero.
- No imprimir secretos ni tokens en consola, logs o respuestas. No registrar el contenido completo de un QR.

**Lógica de negocio**
- Puntajes, cupos, plazos y montos se validan **en el servidor**. El navegador solo muestra y pre-valida.
- Mensajes al usuario: en español, claros, sin exponer datos internos (por ejemplo, la liquidez de los pools).
- Montos en COP como enteros. Moneda de wallets: `value` en la unidad mínima según `assetScale`.

**Cambios con efectos en cadena**
- Si cambian reglas de riesgo, actualizar `docs/modelo-de-riesgo.md`.
- Si cambian variables del ML, actualizar los dos lados (TypeScript y Python) y reentrenar.
- Si cambian `computeStudy` o `readingsFromNames`, regenerar el dataset (`npm run ml:dataset`) y comprobar si cambió (con `cmp` contra una copia).

**Git**
- Commits solo cuando el equipo lo pida. Siempre `npm run build` y `npx eslint .` antes.

## Cómo probar (trucos útiles)

- **Servidor con módulos viejos:** el servidor de desarrollo a veces conserva versiones viejas de los módulos de `src/lib` después de editarlos (síntoma: "X is not a function" o una lógica que no cambia). Reiniciar el servidor.
- **Base de demo:** `rm -rf data` deja la demo limpia. No escribir `data/db.json` a mano mientras el servidor atiende peticiones: si lo lee a medio escribir, arranca con la base vacía.
- **Probar lógica del servidor sin Next:**
  - `node_modules/.bin/jiti archivo.ts` ejecuta TypeScript.
  - Para módulos que importan `server-only`:
    ```bash
    JITI_ALIAS='{"server-only":"<repo>/node_modules/next/dist/compiled/server-only/empty.js"}' node_modules/.bin/jiti archivo.ts
    ```
- **Pruebas por API:** registrar un acreditado con `POST /api/auth/register` (multipart) y luego enviar el estudio con `POST /api/study`. Los perfiles de prueba del modelo están en `docs/modelo-de-riesgo.md`.
- **Cámara:** en el navegador integrado de la app de Claude la cámara está bloqueada. Para probar el escáner QR en vivo, usar Chrome normal en `http://localhost:3000`; "Subir foto" funciona en cualquier lado.
- **Celular:** `npm run dev:https` y abrir `https://<IP del computador>:3000` (misma red wifi). El certificado de mkcert no es de confianza en el celular: aceptar la advertencia ("Avanzado → Continuar"). Los certificados quedan en `certificates/` (ignorado por git).
- **Llaves del sandbox de Wompi:** `@elias123`, `1020304050`, `3001234567`, `ecolon@wompi.com`, `B00012345`. En producción, esas llaves pueden ser de personas reales.
- **Shell:** la del equipo es `fish`. Para comandos con heredocs o bucles, usar scripts de bash.

## Pendientes

**En espera del área financiera (no implementar sin decisión)**
- Reparto de pérdidas por impagos entre los inversionistas (pool, seguro o reserva).
- Intereses de mora, recordatorios, cobranza y bajada de nivel por atrasos.
- Pago anticipado con descuento de intereses.
- Contrato o pagaré y encuadre como crédito productivo (usura).

**Se pueden hacer ya**
- Prueba de punta a punta de una inversión y un retiro reales: aprobar en la wallet `usdtroly` y autorizar la bóveda en `/boveda`.
- Robustez de `db.json` (no arrancar vacía si el archivo no se puede leer).
- Referencias reales (hoy la confirmación es simulada).
- Datos de demo del acreditado (estudio hecho, un crédito activo y uno pagado).
