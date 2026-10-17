# Dataset para el modelo de riesgo con Machine Learning

Hoy el estudio de `/estudio` califica con reglas fijas: cada respuesta suma unos puntos (ver [docs/modelo-de-riesgo.md](../docs/modelo-de-riesgo.md)).
Este dataset sirve para entrenar un modelo que **aprenda de cómo pagó la gente** qué respuestas, documentos y datos de verdad predicen el incumplimiento.

> **Son datos sintéticos.** No hay personas reales. Sirven para construir y probar el pipeline de ML antes de tener historial propio.
> Cuando la plataforma tenga créditos reales, se reemplaza el CSV por los datos reales con las mismas columnas.

## Archivos

| Archivo | Qué es |
|---|---|
| `dataset/creditos_sinteticos.csv` | 6.000 solicitudes, una por fila (ene-2025 a sep-2026) |
| `generate-dataset.ts` | Generador. Usa el mismo `computeStudy` de la app, así el puntaje de reglas es idéntico |
| `train_baseline.py` | Modelo base (regresión logística) sin librerías externas, compara ML vs. reglas |
| `modelo/regresion_logistica.json` | Pesos del modelo base. La app los lee directamente |

```bash
npm run ml:dataset
```

```bash
npm run ml:dataset -- 20000 7
```

```bash
python3 ml/train_baseline.py
```

El primer comando regenera el dataset (6.000 filas, semilla 42); el segundo cambia filas y semilla; el tercero entrena el modelo base (~40 s).

## Cómo se generan los datos

Cada persona tiene **rasgos ocultos** que el modelo no ve:

- **Disciplina** con la plata (cumplimiento, autocontrol).
- **Estabilidad** (tiempo en el negocio y la vivienda).
- **Ingreso real** según su oficio, ciudad y escolaridad.
- Si **exagera** sus respuestas (≈ 11 %): infla el ingreso, esconde deudas y el gota a gota, dice "siempre a tiempo" y se pinta mejor en las afirmaciones.

De esos rasgos salen, con ruido:

1. Las **respuestas** a los 6 pasos del estudio, con los mismos ids de opción que la app (`siempre`, `1a2`, `gt2`…).
2. Los **documentos** que sube. Quien exagera sube menos extractos; la factura muestra mora si en realidad se atrasa.
3. **Datos alternativos** que la app todavía no pide: antigüedad de la línea, recargas y uso de billetera.
4. Su **crédito** (con el cupo real de la app) y **cómo lo pagó cuota a cuota**. El pago depende de los rasgos reales, de qué tan pesada es la cuota frente a lo que de verdad le sobra, del gota a gota, del oficio, de la temporada y de choques de la vida (enfermedad, robo).

Por eso el dataset tiene trampas realistas que el modelo debe aprender. Un ingreso declarado muy alto sin extracto es sospechoso, y las referencias que confirman sí reducen la mora.

### Quién recibió crédito (`grupo`)

| Grupo | Filas | Qué pasó |
|---|---|---|
| `aprobado` | ≈ 4.960 | Nivel 1 a 3 por reglas. Crédito dentro del cupo y los plazos de su nivel |
| `piloto` | ≈ 225 | Nivel 4, pero recibió un crédito pequeño ($100k–$300k) para aprender de los no aptos sin sesgo de selección |
| `rechazado` | ≈ 810 | No se le prestó. Sin resultado (columnas de pago vacías) |

Para entrenar se usan solo las filas con `incumplio` lleno (≈ 5.190).

### Variable objetivo

`incumplio = 1` si alguna cuota llegó a **30 días o más de mora**. Es la definición de default que usan las entidades de microcrédito.

Tasas de incumplimiento resultantes:

| Grupo | Incumplimiento |
|---|---|
| Global | 18 % |
| Nivel 1 | 2 % |
| Nivel 2 | 10 % |
| Nivel 3 | 25 % |
| Piloto (nivel 4) | 52 % |

## Diccionario de datos

**Identificación y partición**

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | texto | Id de la solicitud |
| `fecha_solicitud`, `mes_solicitud` | fecha | Cuándo se pidió |
| `particion` | `train` / `valid` / `test` | Partición por tiempo: train hasta mar-2026, valid abr-jun 2026, test jul-sep 2026. Así se prueba como en la vida real: con meses que el modelo no vio |

**Perfil**

| Columna | Tipo | Descripción |
|---|---|---|
| `ciudad`, `estrato` | categórica | Ciudad y estrato (1 a 4) |
| `edad`, `personas_a_cargo` | número | |
| `escolaridad` | categórica | primaria, bachillerato, tecnico, universitario |
| `sexo` | F / M | **No usar para entrenar.** Solo para revisar que el modelo no discrimine |
| `sector` | categórica | tienda_barrio, comidas_rapidas, venta_ambulante, confeccion, belleza, transporte_moto, reciclaje, servicio_domestico, plaza_mercado, artesanias |

**Paso 2: ingresos y gastos**

| Columna | Tipo | Descripción |
|---|---|---|
| `ingreso_declarado`, `gastos_declarados`, `deudas_declaradas` | COP / mes | Lo que dijo la persona |
| `disponible_declarado` | COP / mes | Ingreso − gastos − deudas declarados |
| `gota_a_gota` | si / no | Si admitió tener préstamo gota a gota |
| `variabilidad`, `antiguedad_actividad` | categórica | Ids de `VARIABILITY` y `ACTIVITY_AGE` en `src/lib/scoring.ts` |

**Paso 3: pagos del hogar.** Columnas categóricas con los ids de la app:

- `servicios` (`UTILITIES`)
- `arriendo` (`RENT`)
- `plan_celular` (`PHONE_PLAN`)
- `natillera` (`SAVINGS_GROUP`)
- `compras_credito` (`CREDIT_PURCHASES`)

**Paso 4: estabilidad.** Columnas categóricas:

- `antiguedad_vivienda`
- `lugar_trabajo`
- `celular_propio`

**Paso 5: cómo maneja la plata**

| Columna | Tipo | Descripción |
|---|---|---|
| `likert_1` … `likert_11` | 1 a 5 | Respuesta cruda, sin invertir. Las afirmaciones 3, 5, 7, 9 y 11 están redactadas al revés |
| `preferencia_tiempo` | hoy / mes | $100.000 hoy o $120.000 en un mes |

**Paso 6: referencias**

| Columna | Tipo | Descripción |
|---|---|---|
| `referencias`, `referencias_confirmadas` | número | Cuántas dio y cuántas confirmaron |
| `referencias_relaciones` | texto | Relaciones separadas por `\|` |

**Documentos**

| Columna | Tipo | Descripción |
|---|---|---|
| `doc_extracto`, `doc_factura`, `doc_arriendo`, `doc_recargas`, `doc_libreta`, `doc_pazysalvo` | 0 / 1 | Qué documentos subió |
| `ingreso_extracto` | COP / mes | Ingreso leído del extracto (vacío si no subió) |
| `factura_con_mora` | 0 / 1 | La factura muestra mora |
| `doc_alterado` | 0 / 1 | Algún documento parece alterado |

**Datos alternativos** (todavía no se piden en la app)

| Columna | Tipo | Descripción |
|---|---|---|
| `antiguedad_linea_meses` | número | Antigüedad del número celular |
| `recargas_mes` | COP | Recargas promedio al mes |
| `transacciones_billetera_mes` | número | Movimientos en Nequi, Daviplata u otra billetera |

**Salida del cuestionario actual** (para comparar)

| Columna | Tipo | Descripción |
|---|---|---|
| `puntaje_reglas` | 0 a 100 | Puntaje de `computeStudy` |
| `nivel_reglas` | 1 a 4 | Nivel por reglas |
| `respaldo_pct`, `alertas`, `en_revision` | número | Índice de respaldo, n.º de alertas, revisión |
| `cuota_max_quincenal` | COP | Cuota máxima según reglas |

**Crédito** (conocido al aprobar)

| Columna | Tipo | Descripción |
|---|---|---|
| `grupo` | aprobado / piloto / rechazado | |
| `nivel_credito`, `tasa_ea` | | Nivel y tasa con que se prestó |
| `monto`, `cuotas`, `plazo_dias`, `valor_cuota` | | Cuotas cada 15 días, sistema francés |
| `total_a_pagar` | COP | Cuota × número de cuotas |
| `cuota_sobre_disponible` | número | Cuota (cada 15 días) ÷ la mitad del disponible declarado |

**Resultado: no usar como variable de entrada** (se conoce después de prestar)

| Columna | Tipo | Descripción |
|---|---|---|
| `incumplio` | 0 / 1 | **Objetivo**: mora de 30 días o más |
| `cuotas_a_tiempo`, `cuotas_tarde` | número | |
| `dias_mora_max` | número | Peor atraso |
| `total_pagado`, `perdida` | COP | Lo recuperado y la pérdida sobre el capital |

## Resultado del modelo base

En el conjunto de prueba (jul-sep 2026, 780 créditos, 16 % de incumplimiento):

| | AUC | Gini | KS | Mora si se aprueba el 70 % de menor riesgo |
|---|---|---|---|---|
| Cuestionario (reglas) | 0,72 | 0,44 | 0,35 | 10,1 % |
| Regresión logística | **0,84** | **0,69** | **0,56** | **6,2 %** |

Con la misma cantidad de aprobados, el modelo baja la mora cerca de un 40 % (de 10,1 % a 6,2 %). Los créditos van de 2 a 24 cuotas según el nivel (plazos de 30 a 365, 150 y 90 días). Además:

- **Calibración:** la probabilidad predicha coincide con la mora real por quintil.
- **Equidad:** el riesgo medio predicho es similar para mujeres y hombres, sin usar el sexo.

**Hallazgo interesante:** el modelo aprende que un **ingreso declarado alto con gastos muy bajos sube el riesgo**, al revés de lo que premia el cuestionario. Es la huella de quien exagera.

### Cuidado al leer estos números

- El AUC sobre datos sintéticos es optimista. En datos reales de microcrédito un buen modelo está entre 0,70 y 0,80.
- Lo importante aquí es el **pipeline**, no el número exacto.

## Cómo lo usa la app

`src/lib/riesgo-ml.ts` lee `modelo/regresion_logistica.json` y, al guardar el estudio, **ajusta** el nivel de reglas:

- Si la probabilidad de atraso es menor a 4 %, sube un nivel.
- Si es mayor a 30 %, baja un nivel.
- Nunca sube a quien las reglas dejaron en nivel 4.

La reglamentación exige poder explicar el rechazo, por eso el modelo ajusta las reglas y no las reemplaza. Los detalles están en [docs/modelo-de-riesgo.md](../docs/modelo-de-riesgo.md#61-ajuste-con-machine-learning-srclibriesgo-mlts).

Para cambiar el modelo:

1. Reentrenen con `python3 ml/train_baseline.py`. El JSON nuevo entra a la app en el siguiente arranque, sin tocar código.
2. Si agregan o cambian una variable, háganlo igual en `features()` (Python) y en `mlFeatures()` (TypeScript). Hoy las dos dan la misma probabilidad (diferencia < 10⁻¹⁵ en las 5.054 filas).

## Siguientes pasos sugeridos

1. Probar modelos de árboles (LightGBM / XGBoost) y explicar cada decisión con SHAP: "te afectó tu nivel de deudas".
2. Cuando haya créditos reales, reentrenar con ellos y vigilar el desempeño mes a mes.
3. Mantener el grupo `piloto` (créditos pequeños a parte de los no aptos). Sin él, el modelo solo aprende de quienes ya aprobó.
4. Pedir en la app los datos que hoy se rellenan con el promedio (ciudad, escolaridad, datos de celular y billetera, con autorización).
