# Modelo de perfil de riesgo

Explicación sencilla de cómo el estudio de crédito decide el nivel de riesgo de cada persona: para el equipo (pitch y jurado) y para cualquier persona o IA que trabaje en el código.

**Fuente de verdad:** [`src/lib/scoring.ts`](../src/lib/scoring.ts). Los parámetros están en `CONFIG`, al inicio del archivo. Si cambian la lógica, actualicen este documento y el README.

> Este modelo sigue el documento de lógica del equipo, con tres decisiones propias de esta app: **cuotas cada 15 días** (mínimo 2 cuotas, contadas desde el desembolso), el **techo del nivel 2 en $3.000.000** y el **plazo del nivel 3 de 30 a 60 días**.

---

## 1. Qué hace

Una persona **sin historial crediticio** llena el estudio en 6 pasos (`/estudio`). Es **obligatorio**: un acreditado sin estudio no puede usar ninguna otra pantalla. El **servidor** calcula un puntaje de 0 a 100 y la clasifica en:

| Nivel | Significado | ¿Recibe crédito? |
|---|---|---|
| **1** | Riesgo bajo | Sí, con las mejores condiciones |
| **2** | Riesgo medio | Sí |
| **3** | Riesgo alto | Sí, un crédito de prueba para construir historial |
| **4** | No apto por ahora | No. Recibe la razón, qué puede cambiar y la fecha para volver a solicitar |

**Principio:** un formulario no verifica nada, solo recoge lo que la persona dice. Por eso lo que dice vale según **cuánto lo respalda**, el formulario solo decide un **primer crédito** limitado por su capacidad de pago, y el historial real lo construyen los pagos: cada crédito pagado a tiempo sube un nivel.

## 2. Recorrido

1. **Antes de empezar:** confirma sus datos del registro, mayoría de edad y autorización de datos (Ley 1581 de 2012 y Ley 1266 de 2008). No suma puntos.
2. **Ingresos y gastos:** capacidad de pago (30 puntos).
3. **Pagos del hogar:** historial alternativo (30 puntos), con documentos opcionales.
4. **Estabilidad:** vivienda, trabajo y celular (10 puntos).
5. **Cómo manejas la plata:** prueba de personalidad (20 puntos).
6. **Referencias:** hasta dos personas que la conocen (10 puntos).
7. **Resultado:** nivel, puntaje, desglose, índice de respaldo, alertas, cómo mejorar y el botón para armar el crédito.

El estudio **no pregunta** sexo, edad exacta, etnia, estado civil, religión ni redes sociales, y **no pide wallet address**. El registro sí pide sexo y edad, pero ninguno de esos datos entra al puntaje.

## 3. Parámetros (`CONFIG`)

| Parámetro | Valor | Qué controla |
|---|---|---|
| Factor "declarado" / "documento" / "confirmado" | 0,5 / 0,8 / 1,0 | Cuánto vale una respuesta según su respaldo |
| Umbrales | 70 / 50 / 35 | Nivel 1 / 2 / 3; debajo de 35, nivel 4 |
| Cuota máxima | 50 % del disponible | Parte de la plata libre que puede irse en la cuota |
| Límite de carga de deuda | 60 % | Si las cuotas actuales superan el 60 % del ingreso, máximo nivel 3 |
| Reintento del nivel 4 | 60 días | Cuándo puede volver a hacer el estudio |
| Desfase de ingreso (X2) | 1,5 veces | Ingreso declarado vs. extracto |
| Presupuesto poco creíble (X4) | 30 % | Gastos + cuotas frente al ingreso |

**Condiciones del crédito por nivel** (`src/lib/config.ts`):

| | Nivel 1 | Nivel 2 | Nivel 3 |
|---|---|---|---|
| Techo del monto | $5.000.000 | $3.000.000 | $1.000.000 |
| Plazo (el cliente elige) | 30 a 120 días | 30 a 90 días | 30 a 60 días |
| Tasa efectiva anual | 24 % | 30 % | 36 % |
| Frecuencia | Cada 15 días (mín. 2 cuotas) | Cada 15 días (mín. 2 cuotas) | Cada 15 días (mín. 2 cuotas) |

## 4. Puntaje (100 puntos)

### 4.1 Factor de confianza

| Respaldo | Cuándo | Factor |
|---|---|---|
| Declarado | Solo lo dijo la persona | × 0,5 |
| Documento | Subió un archivo que lo respalda | × 0,8 |
| Confirmado | Lo confirmó una referencia | × 1,0 |

| Dato | Documento | Referencia que lo confirma |
|---|---|---|
| Margen, carga de deuda, estabilidad del ingreso | Extracto | — |
| Antigüedad del negocio | — | Proveedor o cliente frecuente |
| Servicios públicos | Factura | — |
| Arriendo | Recibo de arriendo | Arrendador |
| Celular | Captura de recargas | — |
| Natillera | Foto de la libreta | Administradora de la natillera |
| Compras a crédito | Paz y salvo | — |
| Tiempo en la vivienda | Factura (trae la dirección) | — |
| Lugar de trabajo | — | Proveedor o cliente frecuente |
| Celular a su nombre | — | — (siempre declarado) |

- Las **respuestas neutras no se multiplican** ("No los pago yo", "Vivienda propia o familiar", "No participo", "Nunca he comprado a crédito").
- La **personalidad** y las **referencias** tampoco se multiplican.
- Solo declarando, el máximo es ≈ 60 puntos: **nadie llega al nivel 1 sin mostrar pruebas.**

### 4.2 Capacidad de pago (30)

Disponible = ingreso − gastos − cuotas de deudas. Margen = disponible ÷ ingreso. Carga de deuda = cuotas ÷ ingreso.

| Variable | Puntos (antes del factor) |
|---|---|
| Margen | ≥ 30 %: 12 · 15–29 %: 8 · 5–14 %: 4 · < 5 %: 0 |
| Carga de deuda | ≤ 20 %: 8 · 21–40 %: 5 · 41–60 %: 2 · > 60 %: 0 |
| Estabilidad del ingreso | Muy parecidos: 6 · Varían algo: 3 · Varían mucho: 0 |
| Antigüedad del negocio | 2 años o más: 4 · 1 a 2: 3 · 6 a 11 meses: 2 · < 6 meses: 0 |

"¿Alguna deuda es con un gota a gota?" solo informa: no suma ni resta.

### 4.3 Historial de pagos (30)

| Variable | Puntos (*neutros sin factor*) |
|---|---|
| Servicios públicos (6 meses) | A tiempo: 10 · 1–2 retrasos: 6 · 3 o más: 2 · Le cortaron: 0 · *No los paga: 4* |
| Arriendo | A tiempo: 6 · A veces tarde: 3 · Muchas veces tarde: 0 · *Propia o familiar: 4* |
| Celular | Plan al día: 4 · Recarga semanal: 3 · Ocasional: 1 |
| Natillera o cadena | Siempre cumple: 6 · A veces se atrasa: 3 · *No participa: 2* |
| Compras a crédito | Al día: 4 · Con atrasos: 2 · En mora: 0 · *Nunca: 2* |

### 4.4 Estabilidad (10)

Vivienda: > 2 años 4 · 1–2 años 3 · < 1 año 1. Trabajo: local fijo 3 · ruta fija 2 · cambia mucho 1. Celular a su nombre: sí 3 · no 1.

### 4.5 Personalidad (20)

Once afirmaciones de 1 a 5. Las 3, 5, 7, 9 y 11 están redactadas al revés y puntúan como 6 − respuesta.

- **Afirmaciones 1 a 10 (14 pts):** S = suma ajustada (10 a 50); puntos = (S − 10) ÷ 40 × 14.
- **Paciencia (3 pts):** $120.000 en un mes = 3; $100.000 hoy = 0.
- **Consistencia (3 pts):** afirmación 2 vs. 11 invertida. Si difieren en 3 o más: 0 puntos y alerta X5.

### 4.6 Referencias (10)

Hasta 2, cada una: confirmada 5 · registrada sin confirmar 2 · dice que no la conoce 0 + alerta X3 · dice que no cumple 0 + nivel 4. Relaciones: proveedor, cliente frecuente, administradora de natillera, arrendador, líder comunitario u otro (con cuadro para escribir cuál; suma igual pero no respalda ningún dato).

### 4.7 Puntaje final e índice de respaldo

Puntaje = capacidad + historial + estabilidad + personalidad + referencias, redondeado.
**Índice de respaldo** = % de los puntos de afirmaciones (sin personalidad, referencias ni neutros) respaldados por documento o tercero. Se muestra: "tu perfil está respaldado al 45 %".

## 5. Cruces de coherencia (alertas)

| Cruce | Cuándo salta | Qué pasa |
|---|---|---|
| X1 Factura vs. respuesta | Dijo "siempre a tiempo" y la factura muestra mora | Se califica como "1 o 2 retrasos" |
| X2 Extracto vs. ingreso | Ingreso declarado > 1,5 × el del extracto | Se usa el del extracto en todo el cálculo |
| X3 Referencia | Una referencia dice que no la conoce | Esa referencia vale 0 |
| X4 Presupuesto imposible | Gastos + cuotas < 30 % del ingreso, sin extracto | Solo alerta |
| X5 Personalidad | Afirmaciones 2 y 11 contradictorias | Pierde los 3 puntos de consistencia |

## 6. Del puntaje al nivel (en orden)

1. Por puntaje: ≥ 70 nivel 1 · 50–69 nivel 2 · 35–49 nivel 3 · < 35 nivel 4.
2. Alertas: 1 → "en revisión" sin cambiar el nivel · 2 → baja un nivel.
3. Carga de deuda > 60 %: si quedó en 1 o 2, baja a 3.
4. Exclusiones (directo a nivel 4): no le sobra plata · documento alterado · referencia dice que no cumple · 3 o más alertas · **crédito con la plataforma con cuotas vencidas** (consulta real a la base de datos) · lo que le queda libre no alcanza ni para el crédito más pequeño.
5. **Ajuste con Machine Learning** (solo si quedó en nivel 1 a 3): ver abajo.

El nivel 4 recibe la razón, qué puede cambiar y la fecha de reintento (hoy + 60 días, según el reloj de la demo). No ve recomendaciones ni crédito, y el botón "Repetir el estudio" queda bloqueado hasta esa fecha.

### 6.1 Ajuste con Machine Learning (`src/lib/riesgo-ml.ts`)

Una regresión logística entrenada con el dataset de `ml/` estima la **probabilidad de mora de 30 días o más**. Los umbrales están en `ML_POLICY`:

| Probabilidad de atraso | Qué pasa |
|---|---|
| Menor a 4 % | Sube un nivel (solo niveles 2 y 3) |
| De 4 % a 30 % | Mantiene el nivel de reglas |
| Mayor a 30 % | Baja un nivel. De nivel 3 pasa a no apto, con la probabilidad, lo que pesó en contra y qué puede cambiar |

Reglas del ajuste:
- **Nunca sube a quien las reglas dejaron en nivel 4.** Las exclusiones y el "no le sobra plata" se respetan siempre.
- Se evalúa con un crédito de referencia del nivel (plazo más largo, 70 % del cupo).
- Para que el modelo tenga lo que más le sirve, el paso 2 pregunta **a qué se dedica** y **cuántas personas dependen de sus ingresos**. Ninguna de las dos suma puntos en las reglas.
- Lo que la app todavía no pide (ciudad, estrato, escolaridad, datos de celular y billetera) se reemplaza por el promedio.
- El sexo nunca entra al modelo.

La pantalla de resultado muestra la probabilidad, si el modelo subió, bajó o confirmó el nivel, y qué pesó a favor y en contra en palabras simples. En el dataset completo, con los mismos créditos:

| | Aprobados | Mora de los aprobados |
|---|---|---|
| Solo reglas | 4.779 | 13,2 % |
| Reglas + ML | 4.211 | 7,9 % |

Con el ajuste, el nivel 1 pasa de 111 a 1.574 personas con 1,3 % de mora: las reglas eran demasiado estrictas con quien solo declara.

**Recomendaciones (niveles 1 a 3):** subir la factura · subir la libreta o pedir confirmación de la natillera · pedir a las referencias que confirmen · en niveles 2 y 3, "paga tu crédito a tiempo y subes un nivel".

## 7. Cuánto se presta (cuotas cada 15 días)

- **Cuota máxima cada 15 días** = disponible mensual ÷ 30 × 50 % × 15 días.
- **Tasa del periodo:** i = (1 + E.A.)^(15 ÷ 365) − 1.
- **Cupo** = el menor entre el techo del nivel y el valor presente de la cuota máxima en el número de cuotas elegido, redondeado hacia abajo a miles: cuota máx × (1 − (1 + i)^(−n)) ÷ i.
- **Cuota fija** (sistema francés); la última cuota se ajusta para dejar el saldo en cero.
- La pantalla "Pedir crédito" muestra el cupo para el plazo elegido y no deja solicitar si la cuota supera la capacidad. El servidor valida lo mismo.

## 8. Perfiles de prueba (resultados del modelo en esta app)

Puntaje → nivel de reglas → nivel final con ML (probabilidad de atraso).

| Perfil | Solo declarado | Con documentos | Documentos + referencias confirmadas |
|---|---|---|---|
| Vendedora de arepas | 56 → N2 → **N1** (2,1 %) | 74 → N1 (3,2 %) | 84 → N1 (1,0 %) |
| Ambulante con gota a gota | 34 → N4 | 44 → N3 → **N4** (45,8 %) | 49 → N3 → **N4** (31,9 %) |
| Joven sin historial | 48 → N3 → **N2** (0,6 %) | 55 → N2 → **N1** (0,9 %) | 58 → N2 → **N1** (0,5 %) |
| Sobreendeudada | N4 | N4 | N4 (no le sobra plata) |

Las diferencias de 1 a 3 puntos frente al documento del equipo vienen de las respuestas de personalidad usadas en la prueba. **La evidencia mueve el nivel:** ese es el incentivo para respaldar lo que se dice.

## 9. Qué es real y qué es simulado

| Parte | Estado |
|---|---|
| Puntaje, nivel, cupo, cuotas y plan de pagos | **Real** (servidor) |
| Mora con la plataforma | **Real** (créditos con cuotas vencidas en la base) |
| Guardar el perfil | **Real** (`data/db.json`, documentos en `data/uploads/`) |
| Lectura de documentos | **Con IA (Gemini)** si hay `GEMINI_API_KEY`: valida el tipo, lee el ingreso del extracto (cruce X2) y la mora de la factura (cruce X1), y detecta alteraciones (alterado con confianza ≥ 0,8 → exclusión; con duda o PDF editado con iLovePDF, Word, etc. → el documento no cuenta). Sin llave: trucos en el nombre |
| Confirmación de referencias | **Simulada**: si marca "enviarle un mensaje", se da por confirmada |

**Trucos para la demo** (en el nombre del archivo):
- `factura_mora.pdf` → la factura "muestra" mora → alerta X1.
- Cualquier archivo con "alterad" (ej. `factura_alterada.pdf`) → documento alterado → nivel 4.
- `extracto_1000000.pdf` → el extracto "dice" $1.000.000 de ingreso → cruce X2.

## 10. Reglas para quien modifique el código

- Los parámetros se cambian solo en `CONFIG` (`src/lib/scoring.ts`); las condiciones por nivel en `src/lib/config.ts`.
- El puntaje se calcula **en el servidor** (`src/app/api/study/route.ts` → `saveStudy`), nunca en el navegador.
- No preguntar datos sensibles en el estudio ni hacer que sumen o resten.
- Si cambian una variable del modelo de ML, cámbienla igual en `features()` de `ml/train_baseline.py` y en `mlFeatures()` de `src/lib/riesgo-ml.ts`, y reentrenen.
- No recomendar billeteras o bancos específicos.
- Todo lo simulado se rotula como simulado en la interfaz.

**Pendientes conocidos:**
- Las tasas de los niveles 2 y 3 superan la usura de consumo: el crédito debe presentarse como **productivo** (verificar el tope vigente en la Superfinanciera).
- Conectar el desembolso y el cobro de cuotas con Open Payments (hoy Bre-B simulado).
- Confirmación real de referencias: los casos "no la conoce" (X3) y "no cumple" están descritos pero aún no se disparan; hay un gancho marcado en `computeStudy`.
