# Kratos (nombre provisional) — MVP hackathon Interledger

Plataforma colombiana que capta inversión extranjera por **Interledger (Open Payments)** para prestarle a personas no
bancarizadas. El dinero se desembolsa y se recauda en pesos por **Bre-B**, y cada crédito pagado a tiempo construye historial.

```
Inversionista ──Interledger──▶ Bóveda (cajita por nivel) ──Bre-B──▶ Crédito al solicitante
      ▲                                                                   │
      └──── retiro capital + rendimiento (Interledger) ◀── cuotas cada 15 días por Bre-B
```

## Qué es real y qué es simulado

| Parte | Estado |
|---|---|
| Inversión y retiro del inversionista | **Real** con Open Payments en la red de prueba (simulado si no hay llaves) |
| Tasa de cambio moneda del inversionista → bóveda | **Real**: la define la cotización de Interledger |
| Conversión pesos → moneda de la bóveda | **Tasa de mercado** (open.er-api.com, `src/lib/fx.ts`); `OP_COP_PER_UNIT` la fija a mano |
| Verificación de la llave Bre-B (titular y banco) | **Real** con el directorio Bre-B de Wompi (sandbox; simulado si no hay llaves) |
| Desembolso (payout) por Bre-B | **Simulado con datos reales**: justo antes de pagar, la llave se re-verifica en el directorio Bre-B de producción (solo lectura) y se arma el payout exacto para Wompi (referencia e idempotency key = id del crédito, monto en centavos), pero **no se envía**. Ver `src/lib/payouts.ts` |
| Lectura de documentos del estudio | **IA (Gemini)** con `GEMINI_API_KEY`: tipo de documento, ingreso del extracto, mora en la factura y señales de alteración (`src/lib/doc-reader.ts`). Sin llave, trucos en el nombre del archivo |
| Pago de cuotas por Bre-B | **Simulador de banco** en `/mi-credito`: el acreditado transfiere (completo o abono parcial) a la llave `@kratosboveda`, vinculada a la bóveda; el dinero entra al pool del nivel (`VAULT_BREB` en `src/lib/config.ts`) |
| Estudio de crédito, niveles, cuotas, fondeo | Funcional |

## Reglas de negocio (`src/lib/config.ts`)

| Nivel | Riesgo | Tasa EA | Monto máx. | Plazo |
|---|---|---|---|---|
| 1 | Bajo | 24% | $5.000.000 | 30–365 días |
| 2 | Medio | 30% | $3.000.000 | 30–150 días |
| 3 | Alto | 36% | $1.000.000 | 30–90 días |

- **Inversión tipo "cajita"**: el inversionista elige un nivel y su saldo crece con interés compuesto a la tasa del nivel.
- **Retiros**: cada aporte dura **un año** desde que se hace, en cualquier nivel.
  Puede sacar todo lo de los aportes que cumplieron su plazo y hasta el **50 %** de cada aporte que sigue en plazo (sumando lo
  que ya sacó de él). Los retiros salen primero de los aportes vencidos, del más antiguo al más nuevo.
  Máximo **US$30.000 por retiro**, pasado a pesos con la tasa de mercado del dólar. Siempre sujeto a la liquidez del pool.
- **Capital semilla**: 50 M COP repartidos 20 / 17 / 13 M entre los pools (supuesto).
- **Créditos**: mínimo 2 cuotas, una cada 15 días contados desde el desembolso, con cuota fija (sistema francés). Si el pool no tiene fondos el crédito queda **en espera de fondeo** y se desembolsa cuando entra dinero.
- **Estudio de crédito** (`/estudio`): obligatorio para el acreditado antes de usar la app. 6 pasos; el servidor calcula un puntaje 0–100 con factor de confianza (declarado ×0,5, documento ×0,8, confirmado ×1), cruces de coherencia y exclusiones, y asigna nivel 1, 2, 3 o 4 (no apto, reintento en 60 días). Explicación completa en [`docs/modelo-de-riesgo.md`](docs/modelo-de-riesgo.md).
- **Machine Learning** (`ml/`): dataset sintético de 6.000 solicitudes con su historial de pago y un modelo base que compara ML vs. el cuestionario. Ver [`ml/README.md`](ml/README.md).
- **Cupo**: el menor entre el techo del nivel y lo que alcanza a pagar con una cuota cada 15 días de máximo el 50 % de su dinero libre.
- **Subir de nivel**: cada crédito pagado completo y sin atrasos sube un nivel.
- **Pendiente de definir**: comisión operativa, seguro contra impago y reserva (`FEES`, hoy en 0).

## Registro (`/registro`)

Formulario por pasos:
1. **Datos personales**: nombre, apellido, correo, cédula/documento, celular, nacionalidad, edad (18+), sexo, dirección y rol (**inversionista** o **acreditado**).
2. **Perfil**
   - Inversionista: wallet address de Interledger, ingreso mensual promedio y moneda, origen de ingresos, independiente/asalariado.
   - Acreditado: fuente de ingresos, ingreso mensual (COP), ¿acepta pagos por Bre-B? (si responde que no, no puede continuar hasta crear una llave) y llave Bre-B.
3. **Documentos**: copia del documento por ambos lados (JPG/PNG/WEBP/PDF, máx. 5 MB) y verificación facial (*próximamente*).
4. **Contraseña** y confirmación.

Las copias del documento se guardan en `data/uploads/<id>/` (fuera de `public/`, no quedan expuestas) y las contraseñas con scrypt.
Cada rol ve solo sus pantallas y las API validan el rol.

## Correr en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000. Sin `.env.local` todo funciona en **modo simulado**.

### Cuentas demo

Se crean tres cuentas de prueba: un **inversionista**, un **acreditado** y un **operador**.
Los usuarios solo ven sus propios datos (inicio, inversiones o crédito, y *Movimientos*); la **bóveda** (liquidez de los pools,
cartera y movimientos de todos) y los controles de demo son exclusivos del operador.
Los correos y contraseñas están en [`src/lib/demo-accounts.ts`](src/lib/demo-accounts.ts). Para recrearlas, borra la carpeta `data/`
(el botón *Reiniciar demo* de la bóveda conserva las cuentas).

### Conectar Open Payments (red de prueba)

1. Crea una cuenta en https://wallet.interledger-test.dev y una wallet address para la **bóveda**.
2. En *Settings → Developer Keys* genera llaves: copia el **Key ID** y descarga `private.key` a la raíz del proyecto.
3. `cp .env.example .env` y completa `OP_PLATFORM_WALLET_ADDRESS`, `OP_KEY_ID`, `OP_PRIVATE_KEY_PATH` y `OP_VAULT_WALLET_ADDRESS` (la bóveda que recibe las inversiones).
4. Crea otra cuenta (o wallet address) para el **inversionista** y fóndeala con dinero de prueba. Para usarla con la cuenta demo, ponla en `OP_DEMO_INVESTOR_WALLET` y borra `data/`.
5. Reinicia `npm run dev`. En `/boveda` debe aparecer "Open Payments conectado".

Flujo de inversión: incoming payment en la bóveda → quote en la wallet del inversionista → grant interactivo → el
inversionista aprueba en su wallet → callback `/api/op/finish/[id]` → outgoing payment → se acredita la cajita.
**Retiros (la plata sale de la bóveda):** en `/boveda` el operador pulsa *Autorizar retiros automáticos* y aprueba UNA vez,
en la wallet de la bóveda, un permiso de pagos salientes con tope total (`OP_VAULT_GRANT_LIMIT_USD` en dólares, o `OP_VAULT_GRANT_LIMIT`, por defecto 1000 en la moneda
de la bóveda). Desde ahí cada retiro sale solo: se reserva el saldo de la cajita → incoming payment en la wallet del
inversionista → quote en la bóveda → outgoing payment con el token guardado (se rota si vence). Si el envío falla, el saldo
vuelve a la cajita; si el permiso ya no sirve, se borra y el panel pide renovarlo. Sin permiso, cada retiro lo aprueba el
operador en la wallet de la bóveda.
Al volver de la wallet se verifica el `hash` de la interacción (GNAP) y se espera a que el pago saliente se liquide antes de acreditar.

### Verificar llaves Bre-B (Wompi)

Antes de desembolsar, `/credito` consulta la llave en el directorio Bre-B (`src/lib/breb.ts`, solo lectura) y muestra titular
enmascarado y banco para que el acreditado confirme. El crédito usa la llave **guardada en el servidor** al verificar
(vale 5 minutos, solo para quien la verificó y una sola vez): no se puede cambiar después.
Estados del desembolso: `CREDIT_APPROVED → BREB_KEY_VERIFIED → USER_CONFIRMED_BENEFICIARY → TREASURY_DEBITED → PAYOUT_SUBMITTED → DISBURSED`.
Al reservar el capital (`TREASURY_DEBITED`) la llave se vuelve a consultar: si ya no existe, está inactiva o cambió de titular o
banco, pasa a `BREB_KEY_REJECTED`, el capital vuelve al pool y el crédito queda `cancelado` (el acreditado puede pedirlo de nuevo).
Si el directorio no responde, el crédito queda reservado y se reintenta; nunca se paga con un resultado incierto.
El sandbox solo reconoce `@elias123`, `1020304050`, `3001234567`, `ecolon@wompi.com` y `B00012345`.

**QR Bre-B** (`src/lib/breb-qr.ts` + `src/components/breb-qr-scanner.tsx`): en `/credito`, *Escanear QR Bre-B* lee el QR de cobro
del banco con la cámara (necesita https o localhost) o desde una foto (`jsqr`). El lector EMVCo falla cerrado: exige el CRC
(CRC-16/CCITT-FALSE) como último campo, una sola plantilla de llave con namespace `CO.COM.RBM.LLA` (tags 26–51; también
acepta `CO.COM.RBM` a secas) y una sola llave (.01 documento, .02 celular, .03 correo, .04 alias). Las demás plantillas
`CO.COM.RBM.*` de los QR reales (RED, CU, CA, CANAL, IVA, TRXID, SEC…) no traen la llave y se ignoran. Probado con QR reales. Un QR válido no prueba que la llave exista: después se consulta el
directorio Bre-B y el usuario confirma el titular, que sale del directorio y no del QR. El monto del QR se ignora.

## Guion de demo (≈3 min)

1. **Invertir** con la wallet del inversionista en Nivel 3 → aprobar en la wallet de prueba → la cajita aparece.
2. **Pedir crédito**: llenar el estudio → aprobado con nivel → elegir monto y cuotas → llave Bre-B → desembolso.
3. **Bóveda**: ver el movimiento de inversión (Interledger) y el desembolso (Bre-B).
4. **Mi crédito** → *Pagar deuda* → confirmar la transferencia Bre-B simulada.
5. **Bóveda** → *+1 año* → volver a **Invertir** y ver el rendimiento → **retirar** a la wallet por Interledger.

## Estructura

```
src/lib/config.ts        reglas de negocio (niveles, tasas, semilla, comisiones)
src/lib/scoring.ts       estudio de crédito: preguntas, validación y puntaje
src/lib/registration.ts  pasos y validaciones del registro
src/lib/auth.ts          cuentas, contraseñas y sesiones
src/lib/finance.ts       interés compuesto y tabla de amortización
src/lib/services.ts      cajitas, créditos, fondeo, pagos
src/lib/openpayments.ts  integración Open Payments
src/lib/db.ts            persistencia en data/db.json (solo demo)
src/app/api/*            endpoints
src/app/{registro,login,inicio,estudio,invertir,credito,mi-credito,movimientos,boveda}  pantallas
```
