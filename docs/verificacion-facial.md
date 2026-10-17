# Verificación facial en el registro

> Documento de diseño. Define **qué** se construye y **por qué**, antes de escribir código.
> Sigue los patrones que ya existen en el repo (`src/lib/breb.ts`, `src/lib/openpayments.ts`):
> adaptador con un modo gratuito (`local`) por defecto y un IDV de pago detrás de variables de entorno.

## 1. Problema

En el registro ya pedimos los dos lados del documento (`idFront`, `idBack`) y los guardamos
fuera de `/public` en `data/uploads/<id>` (ver `src/app/api/auth/register/route.ts`).
El tipo `User` en `src/lib/db.ts` ya reserva el campo:

```ts
/** La verificación facial aún no está implementada */
faceVerification: "pendiente" | "aprobada";
```

Falta la pieza que llena ese campo. El objetivo del producto es evitar que una persona
abra **varias cuentas** y que alguien use **identidad ajena**. Para eso se necesitan tres
comprobaciones, en este orden:

1. **Prueba de vida (liveness) — girar la cabeza.** Confirma que frente a la cámara hay una
   persona real y presente, no una foto ni un video.
2. **Coincidencia 1:1 (selfie vs documento).** Confirma que la cara es la misma del documento
   que subió (`idFront`).
3. **Deduplicación 1:N (selfie vs base).** Confirma que esa cara no está ya registrada con
   otra cédula.

Si falla cualquiera, el registro no se completa.

## 2. Alcance

| Dentro | Fuera (por ahora) |
| --- | --- |
| Captura de selfie con reto de giro de cabeza en el navegador | Liveness pasivo anti-spoofing de grado producción |
| Comparación 1:1 y deduplicación 1:N con un adaptador | Entrenar modelos propios de reconocimiento facial |
| Modo gratuito `local` (face-api) por defecto; IDV de pago detrás de env | Integración firmada y pagada con un IDV concreto |
| Almacenar el **descriptor** (vector), nunca la selfie cruda | Guardar imágenes faciales en el servidor |
| Auditoría del resultado (sin imágenes) | — |

### Límite honesto

El liveness en el navegador **no** es anti-fraude de grado producción: un atacante decidido
puede engañarlo con un video. Sirve para el MVP/demo y para dejar el flujo armado. En
producción, el proveedor IDV hace el liveness serio del lado del servidor. El código debe
dejar esa frontera explícita, igual que `breb.ts` distingue `simulado` de `production`.
El modo `local` deja claro en la UI que es verificación local gratuita, no de grado banco.

## 3. Amenaza → defensa

| Amenaza | Defensa primaria | Defensa de refuerzo |
| --- | --- | --- |
| Suben una foto/video en vez de estar presentes | Liveness activo (giro de cabeza) | — |
| Usan el documento de otra persona | Coincidencia 1:1 selfie vs `idFront` | — |
| Una persona abre varias cuentas | Deduplicación 1:N | Unicidad de cédula (ya existe en `checkRegistration`) |

La deduplicación facial y la unicidad de cédula se combinan: ninguna sola cierra el hueco,
las dos juntas sí. La unicidad de cédula ya está implementada en
`checkRegistration` (`src/lib/auth.ts`).

## 4. El adaptador `FaceVerifier`

Mismo molde que `resolveBrebKey` en `breb.ts`: una función `config()` decide el modo según
variables de entorno, el verificador **nunca lanza** (devuelve resultados tipados) y hay un
camino `local` (gratuito, con face-api) cuando no hay credenciales de un IDV de pago.

Archivo propuesto: `src/lib/faceverify.ts` (con `import "server-only"`).

```ts
export type FaceMode = "local" | "provider";

export interface LivenessResult {
  ok: boolean;
  /** Reto que se pidió y se detectó, para la auditoría */
  challenge: "turn_head";
  reason?: "no_face" | "no_movement" | "spoof_suspected" | "low_quality";
}

export interface MatchResult {
  /** Distancia euclídea entre descriptores (menor = más parecidos) */
  distance: number;
  /** distance <= THRESHOLD_MATCH */
  isMatch: boolean;
}

export interface DuplicateResult {
  userId: string;
  cedula: string;
  distance: number;
}

export interface FaceVerifier {
  /** Verifica el reto de giro de cabeza con los frames capturados en el cliente */
  checkLiveness(capture: LivenessCapture): Promise<LivenessResult>;
  /** 1:1 — selfie contra la foto del documento (idFront) */
  matchToDocument(selfie: FaceImage, idPhoto: FaceImage): Promise<MatchResult>;
  /** Extrae el descriptor que se compara y se almacena (NUNCA la imagen) */
  extractDescriptor(selfie: FaceImage): Promise<number[]>;
  /** 1:N — descriptor nuevo contra los ya registrados; null si no hay duplicado */
  findDuplicate(descriptor: number[], known: KnownFace[]): Promise<DuplicateResult | null>;
}

export interface KnownFace {
  userId: string;
  cedula: string;
  descriptor: number[];
}
```

### Modo y configuración (como `breb.ts`)

```ts
function config() {
  const key = process.env.FACE_PROVIDER_API_KEY;
  const url = process.env.FACE_PROVIDER_URL;
  // Sin credenciales de un IDV de pago, se usa el modo local gratuito (face-api).
  const mode: FaceMode = key && url ? "provider" : "local";
  return { key, url, mode };
}

export const faceMode = () => config().mode;
```

- **`local`** (por defecto, gratis): liveness por giro de cabeza en el cliente; `@vladmandic/face-api`
  extrae descriptores **reales** y compara 1:1 y 1:N en el servidor. No es simulación: calcula
  descriptores de verdad. Los datos no salen de la máquina. Se indica en la UI que es verificación
  local.
- **`provider`** (opcional, con `FACE_PROVIDER_*`): se delega a un IDV de pago (Truora como
  primera opción para Colombia). El resto del sistema no cambia: cumple la misma interfaz.

Umbrales como constantes (ajustables sin tocar lógica):

```ts
const THRESHOLD_MATCH = 0.6;   // 1:1: por debajo = misma persona
const THRESHOLD_DEDUP = 0.5;   // 1:N: por debajo = probable duplicado (más estricto)
```

## 5. Flujo de registro con verificación

El registro sigue siendo `POST /api/auth/register` (multipart). Se añaden campos de la cara.

```
Cliente (navegador)
  1. Captura selfie + reto "gira la cabeza" (MediaPipe / face-api en el navegador)
  2. Extrae frames clave (frente + girado) y, si se hace en cliente, el descriptor
  3. Envía en el multipart: selfieFrames + idFront (ya existente)

Servidor (register/route.ts)  — todo dentro de withDB, antes de crear el usuario
  4. checkLiveness(frames)              -> si !ok  => rechaza (no es persona real)
  5. matchToDocument(selfie, idFront)   -> si !isMatch => rechaza (no coincide con el documento)
  6. extractDescriptor(selfie)
  7. findDuplicate(descriptor, known)   -> si != null => cuenta en revisión del operador (no se rechaza sola)
  8. register(...)  y  guarda SOLO el descriptor cifrado en el User
  9. faceVerification = "aprobada"
 10. AuditLog: liveness, distancias, modo, timestamp (NUNCA la imagen)
```

Orden deliberado: liveness primero (lo más barato de rechazar), luego 1:1, luego 1:N.
No se compara contra la base si antes no se probó que es un humano real y el dueño del
documento.

### Punto de inserción en el código

- `checkRegistration(db, data)` (en `auth.ts`) ya valida unicidad de correo y cédula. La
  verificación facial se ejecuta en `register/route.ts` **después** de `checkRegistration`
  y **antes** de `register(...)`, igual que hoy se validan los archivos del documento.
- Si la verificación falla, se responde con `BusinessError` (mismo manejo que el resto) y se
  borra el directorio de `uploads` (ya se hace en el `catch` actual).

## 6. Modelo de datos

### En `User` (completar lo que ya existe en `db.ts`)

```ts
faceVerification: "pendiente" | "aprobada";
/** Vector facial para deduplicar. Cifrado en reposo. NUNCA se guarda la imagen. */
faceDescriptor?: number[];
/** Rastro del resultado, sin imágenes */
faceCheck?: {
  mode: FaceMode;
  liveness: boolean;
  documentDistance: number;   // 1:1
  dedupDistance: number | null; // menor distancia encontrada en 1:N (null si base vacía)
  challenge: "turn_head";
  at: number;
};
```

`toPublic()` en `auth.ts` debe **excluir** `faceDescriptor` (como ya excluye
`passwordHash`, `salt` y `documents`).

### Fuente para `findDuplicate`

Los `KnownFace` salen de `db.users` filtrando los que tienen `faceDescriptor`. Para el MVP
la comparación lineal contra todos los usuarios es suficiente (volumen bajo). Si crece, se
mueve a un índice del proveedor (colección de rostros 1:N del lado del IDV).

## 7. Privacidad y cumplimiento

Dato biométrico = dato **sensible** con protección reforzada (Ley 1581 de 2012). Reglas:

1. **No se guarda la selfie cruda.** Solo el descriptor (vector irreversible), cifrado en
   reposo. En modo `provider`, idealmente las imágenes viven en el IDV, no en nuestra base.
2. **Consentimiento biométrico explícito.** El formulario de estudio ya pide autorización de
   datos (Ley 1581/1266). Hay que añadir una línea específica para el **dato biométrico
   facial** en el registro, registrada con fecha.
3. **Auditoría sin imágenes.** `faceCheck` guarda distancias y resultado, no frames.
4. **Camino de revisión manual.** Siempre hay casos borde (gemelos, cambios físicos, mala
   cámara). Si la dedup cae en zona gris, se marca `faceVerification: "pendiente"` y pasa a
   revisión del operador en vez de rechazar en seco.

## 8. Umbrales y zonas

```
documentDistance (1:1):
  <= 0.6   -> coincide
  >  0.6   -> no coincide -> rechazo

dedupDistance (1:N), la menor contra la base:
  <  0.5   -> duplicado probable        -> revisión manual (pendiente, reviewReason "duplicado_probable")
  0.5–0.6  -> zona gris                 -> revisión manual (pendiente, reviewReason "parecido")
  >  0.6   -> persona nueva             -> aprobada
```

Un umbral muy estricto bloquea gente legítima; muy laxo deja pasar duplicados. **Mientras los
umbrales del descriptor geométrico local no estén calibrados con personas reales, ningún
parecido rechaza en automático**: todo va a la cola del operador. Los valores 0,5 / 0,6 vienen de
embeddings tipo face-api (128 dimensiones) y no tienen por qué servir para las 15 proporciones
del descriptor local: hay que medir distancias de la misma persona (varias capturas) y entre
personas distintas antes de fijarlos.

### Estado implementado

- **Descriptor de frente:** solo se toma de frames con la cabeza girada ≤ 8°, y se usa la
  mediana de al menos 5 de ellos (girada, la proyección deforma las proporciones).
- **Sin cámara:** el registro permite "No tengo cámara". La cuenta queda `pendiente` con
  `reviewReason: "sin_camara"` y el operador verifica la identidad por otro medio.
- **Qué implica cada estado:**
  - `aprobada`: todo habilitado.
  - `pendiente`: puede usar la app y retirar su dinero, pero **no pedir crédito, verificar la
    llave Bre-B para el crédito ni invertir** (`requireVerifiedIdentity` en `src/lib/auth.ts`).
  - `rechazada`: no puede iniciar sesión y sus sesiones abiertas se cierran.
- **Límite conocido:** el liveness y el descriptor los calcula el navegador. Alguien que
  manipule la petición puede saltárselos; para grado producción se necesita un IDV (Truora).

## 9. Tecnología sugerida (MVP en el navegador)

- **Liveness / landmarks:** MediaPipe Face Landmarker (corre en el navegador con WASM). El
  reto de giro se valida midiendo el cambio de *yaw* entre frames.
- **Descriptores 1:1 y 1:N (en el servidor):** `@vladmandic/face-api` (fork mantenido de
  face-api.js, compatible con TF.js moderno). Descriptores de 128 dimensiones, distancia
  euclídea. El cliente solo envía los frames; el descriptor se extrae y compara en el servidor.
- **Producción:** adaptador `provider` contra **Truora** (primera opción para Colombia).
  Respaldo regional Metamap; AWS Rekognition si se busca control total en AWS. No construir
  reconocimiento facial propio.

## 10. Casos de uso y qué infraestructura toca cada uno

| Caso de uso | Infra en modo `local` (gratis) | Infra en modo `provider` (IDV de pago) |
| --- | --- | --- |
| Capturar selfie + giro de cabeza | Cámara del navegador + MediaPipe (cliente) | SDK del IDV (cliente) |
| Validar giro de cabeza (liveness) | En el **cliente** (cambio de yaw entre frames) | Liveness del IDV |
| Extraer descriptor | En el **servidor** (face-api) | API del IDV (servidor) |
| 1:1 selfie vs documento | En el **servidor** (face-api) | API del IDV |
| 1:N deduplicación | En el **servidor**: comparación lineal sobre `db.users` | Colección de rostros del IDV |
| Guardar resultado | `faceDescriptor` + `faceCheck` en `db.json` | Mismo, referenciando ids del IDV |
| Auditar | `faceCheck` (sin imágenes) | `faceCheck` + id de la transacción del IDV |

## 11. Variables de entorno (añadir a `.env.example`)

```
# Verificación facial. Sin estas variables, modo local gratuito (face-api).
FACE_PROVIDER_URL=
FACE_PROVIDER_API_KEY=
# Clave para cifrar los descriptores faciales en reposo
FACE_DESCRIPTOR_SECRET=
```

## 12. Criterios de aceptación

- [ ] Con env vacío, el registro funciona en modo `local` gratuito (face-api) y lo indica en la UI.
- [ ] No se completa el registro si el liveness (giro de cabeza) no pasa.
- [ ] No se completa el registro si la selfie no coincide con `idFront`.
- [ ] No se completa el registro si la cara ya existe en la base (dedup 1:N).
- [ ] La cédula sigue siendo única (defensa de refuerzo intacta).
- [ ] Nunca se guarda la selfie cruda; solo el descriptor cifrado.
- [ ] `toPublic()` no expone `faceDescriptor`.
- [ ] `faceCheck` registra el resultado sin imágenes.
- [ ] La zona gris de dedup va a revisión manual (cola en el panel del `admin`), no a rechazo.
- [ ] El descriptor y las comparaciones se calculan en el servidor, no en el cliente.
- [ ] El consentimiento biométrico queda registrado con fecha.

## 13. Decisiones tomadas

1. **Reto de liveness: solo giro de cabeza.** Es el único reto. El navegador valida el
   cambio de *yaw* (ángulo horizontal) entre frames. Límite conocido: un video pregrabado
   podría pasarlo; es aceptable en el MVP y lo cubre el liveness del IDV en producción.

2. **Revisión de la zona gris: la hace el rol `admin` existente.** No se crea rol nuevo.
   Cuando la dedup cae en zona gris (0.5–0.6), el usuario queda `faceVerification: "pendiente"`
   y el operador (`admin`) decide aprobar o rechazar desde su panel. El rol `admin` ya existe
   (`AccountRole` en `registration.ts`, `requireAdmin` en `auth.ts`).

3. **El descriptor se calcula en el SERVIDOR.** El proyecto corre local y toda la lógica de
   confianza ya es `server-only` (`auth.ts`, `breb.ts`, `openpayments.ts`, `db.ts`). La cara
   va al mismo nivel. Reparto:
   - **Cliente:** solo captura de cámara y validación del giro de cabeza (necesita la cámara).
   - **Servidor:** extracción del descriptor + comparación 1:1 y 1:N. No se confía en un
     descriptor enviado por el cliente (un atacante podría falsificarlo).

4. **Camino elegido: 100% gratis y local con open source. Sin proveedor de pago.**
   - Los IDV comerciales (Truora, Metamap, Jumio) cobran por verificación; no hay plan gratis
     real para operar. Para este proyecto no hacen falta.
   - El reto (giro de cabeza + 1:1 + dedup 1:N) se cubre con librerías open source que corren
     en el propio servidor, sin enviar datos a terceros:
     - **MediaPipe Face Landmarker** (Google, gratis) → giro de cabeza en el navegador.
     - **@vladmandic/face-api** (gratis) → descriptores reales de 128 dimensiones y comparación
       1:1 y 1:N en el servidor.
   - Con esto, el modo antes llamado "simulado" pasa a ser un **modo real gratuito** (`local`):
     face-api calcula descriptores de verdad, no simula. Privado (los datos no salen de la
     máquina) y sin costo.
   - **Límite honesto:** no es grado bancario anti-fraude (un video podría pasar el liveness,
     y no valida la cédula contra fuentes oficiales). Es suficiente para el MVP/piloto local.
   - **Puerta abierta a futuro:** si algún día se necesita grado producción con validación de
     cédula real, se enchufa un IDV de pago (Truora como primera opción para Colombia) detrás
     de la **misma interfaz `FaceVerifier`**, sin reescribir el resto.

### Implicaciones de estas decisiones en el diseño

- El `FaceVerifier` solo necesita un reto (`challenge: "turn_head"`), ya reflejado en los tipos.
- `extractDescriptor`, `matchToDocument` y `findDuplicate` se ejecutan en el servidor dentro
  de `register/route.ts`. El cliente solo envía los frames de la cámara, no descriptores.
- Se añade al panel de `admin` una cola de "verificaciones faciales en revisión" para la zona gris.
- El adaptador `provider` se nombra pensando en Truora (`TruoraFaceVerifier`), cumpliendo la
  misma interfaz `FaceVerifier`.
```

## 14. Estado de implementación

Implementado (modo `local`, gratis), con dos ajustes respecto al diseño inicial:

Archivos:
- `src/lib/faceverify.ts` — interfaz `FaceVerifier`, verificador `local` (liveness por giro de
  cabeza, dedup 1:N por distancia euclídea), cifrado del descriptor (AES-256-GCM) y
  `getFaceVerifier()` / `faceMode()`.
- `src/lib/face-descriptor.ts` — compartido cliente/servidor: `landmarksToDescriptor()` (15
  proporciones faciales normalizadas) y `estimateYaw()`, a partir de los 468 landmarks de
  MediaPipe.
- `src/app/registro/face-capture.tsx` — captura de cámara con MediaPipe (CDN) y el reto de
  giro de cabeza; consentimiento biométrico; no guarda imagen.
- `src/app/api/auth/register/route.ts` — orquesta liveness → dedup 1:N antes de `register()`.
- Panel `admin` (`/boveda` + `/api/state` + `/api/admin`) — cola de revisión de la zona gris
  con acciones aprobar / rechazar.
- `db.ts` (`User.faceVerification` + `faceDescriptor` cifrado + `faceCheck`), `auth.ts`
  (`toPublic` excluye el descriptor; `register` recibe el resultado facial).

Ajustes respecto al diseño:

1. **El 1:1 contra el documento no se ejecuta en modo `local`.** Extraer un descriptor fiable
   de una foto de cédula en el navegador no es viable (calidad, hologramas, tamaño). En local
   los controles reales son **liveness + deduplicación 1:N**; `documentDistance` se guarda como
   `-1` (no disponible). El 1:1 con el documento queda para el modo `provider` (IDV), que sí
   valida cédula. Esto es más honesto que fingir un match poco fiable.

2. **El descriptor geométrico es propio, sin TensorFlow.** Se evitó `@vladmandic/face-api` /
   `@tensorflow/tfjs-node` (binario nativo que rompe el build de Next 16 con Turbopack). El
   descriptor son proporciones faciales derivadas de los landmarks de MediaPipe: determinista,
   gratuito y sin dependencias nativas. La interfaz `FaceVerifier` permite cambiarlo por
   face-api o un IDV sin tocar el resto.

Verificado: `npm run lint` y `npm run build` pasan (TypeScript ok, 30 páginas generadas).
No verificado automáticamente: el flujo de cámara en vivo (requiere navegador con webcam y
permisos); conviene una prueba manual del reto de giro de cabeza y de la cola de revisión.
