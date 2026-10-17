# Registro de prompts — Claude Code

Herramienta: Claude Code (Anthropic), app de escritorio, pestaña Code, versión 2.1.299 según el registro local.
Modelo: `claude-opus-5-5`, según los metadatos de las respuestas en el registro local.

Cobertura: mensajes escritos por el equipo en las 4 sesiones de Claude Code de este proyecto guardadas en el computador de Juan Velez
(`~/.claude/projects/-home-vell6z-Documents-Proyectos-Financial-Kratos-Team---Repo/`, sesiones `347dd228`, `589ceaf0`, `67d2ac3d` y `86d13a8d`),
entre el 16 de octubre de 2026 a las 21:26 UTC y el 17 de octubre de 2026 a las 13:07 UTC. Tres de esas sesiones comparten el inicio
(son continuaciones de la misma conversación): los mensajes repetidos aparecen una sola vez, con las sesiones donde están.

**Cobertura no verificada fuera de este computador.** No incluye: conversaciones de otros integrantes o de otros computadores, otras
herramientas de IA, ni las respuestas elegidas en los cuadros de opciones de Claude Code (quedan como resultado de herramienta, no como
mensaje escrito). Las imágenes adjuntas no se copian. Las respuestas de la IA no se incluyen: solo lo que escribió el equipo.

Origen: registro local en formato JSONL de Claude Code. Se extrajo el texto tal cual; solo se quitaron los recordatorios automáticos
del sistema que Claude Code agrega dentro de los mensajes. Fechas en UTC (Colombia es UTC−5).

Total: 108 entradas.

## Entrada 1

Fecha: 2026-10-16 21:26:09 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`

```text
<pasted_content id="fa50">
Hola, te cuento que yo en estos momentos estoy en una hackathon de Interledger. Mi objetivo en ese momento, mi prototipo, mi MVP para la hackathon, es conectar Interledger acá en Colombia. O bueno, te voy a contar todo el prototipo cómo es. Mira, el prototipo está construido de la siguiente forma y es lo que queremos lograr. Quiero que tengas todo el contexto para que me puedas ayudar. Mira, lo que queremos hacer es a partir de un llamado fondo de inversión de alto riesgo ubicado aquí en Colombia, queremos, por así decirlo, captar inversión extranjera, inversión nacional. ¿Cómo lo vamos a hacer? Ahí es donde entra el protocolo de Interledger para conectar a Colombia con el exterior. Todos los extranjeros que quieran invertir aquí en Colombia tienen que crearse una cuenta en Interledger y a partir de eso conectarse con nosotros, como hacer un tipo de startup o bueno, o aplicación, algo así. Todavía no tenemos el nombre, que va a captar todos esos recursos a través de una wallet de Interledger, ¿cierto? Nosotros vamos a recibir todos esos recursos de los extranjeros, que son los inversionistas. Nosotros con estos recursos son los que usamos para prestarle a las personas que quieran acceder a créditos. ¿A qué personas le vamos a prestar? A las personas que no están dentro del sistema financiero o están no bancarizadas en Colombia, porque este startup o proyecto queremos lograr y bancarizar a estas personas. Lo vamos a lograr de la siguiente forma: con estos fondos que recolectemos de inversionistas vamos, por así decirlo, a generar como un sistema de riesgo financiero, el cual vamos a construir o no está construido. Tenemos por ahí ideas como de psicológicos que hemos escuchado que bancos ya están implementando esta tecnología a nivel mundial, a través que nos monten, no sé, qué actividad financiera han tenido, no sé, por ejemplo, si han pagado servicios públicos adecuadamente, el internet, bueno, todo esto y que nos los junten. Nuestro objetivo es crear un formulario que nos ayude como en sí a decidir si podemos prestarle a esa persona o no, o qué tanto riesgo conlleva prestarle y qué tan óptimo es soltarle, pues, el dinero de los inversionistas y a través de este categorizarle su categoría, su... obviamente todos los perfiles van a ser de riesgo, pero como categorizarlo, no sé, del 1 al 3 o tú ya me des una nomenclatura para categorizarlos y dependiendo de su categoría pagarían, pues, como el nivel de riesgo, por así decirlo. Entre más riesgo tengan los inversionistas pueden obtener más ganancias o más revenue. Todo esto obviamente con que los inversionistas, pues, tengan el riesgo, por así decirlo, así trayendo, pues, como capital extranjero. Y al final nosotros lo que queremos hacer es que Interledger se vuelva como fundamental aquí en Colombia. Lo más importante es Interledger, ya que queremos como que estas personas ya pasen a, como por así decirlo, que ya digan: esta gente ya hace parte del sistema financiero, no sé, tienen un puntaje crediticio, por así decirlo y ya posteriormente a largo plazo puedan acceder a un crédito y cosas por el estilo. Entonces, así más o menos mi proyecto, dime si tienes alguna duda en alguna parte, cuál más o menos es como la parte que ya hemos logrado luego de la ideación y es como el proyecto que tenemos en mente. Quiero también que me hagas como mini flujo de lo que tenemos para, pues, tenerlo plasmado en la mente, también si tienes dudas y en general alguna observación.
Quiero que tengas en cuenta esto: al final nosotros desembolsamos los creditos o el dinero a las personas a traves de Breb, y para que estos paguen ellos solo lo hacen a traves de su banco colombiano, a traves de breb a la cuenta de nuestra startup
</pasted_content id="fa50">
```

## Entrada 2

Fecha: 2026-10-16 21:28:13 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`
Adjuntos: 1 imagen(es), no incluidas en este registro.

```text
[mensaje sin texto: solo imagen]
```

## Entrada 3

Fecha: 2026-10-16 21:34:33 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`

```text
esto es masomenos la explicacion del flujo

<pasted_content id="fa50">
El extranjero quiere invertir dinero. Entonces mediante Interledger envía plata a nuestra bóveda. Nuestra bóveda realmente es una wallet de Interledger. Entonces sucede lo siguiente: hay una persona neutra que realiza un estudio de crédito. Si sale que no, entonces no se le puede dar ningún crédito. Puede seguir utilizando la aplicación, pero no puede acceder a los créditos. Si sale que sí, toca saber en qué nivel quedó. Si quedó en el nivel 1, queda con altas tasas. Si quedó en el nivel 2, quedó con tasas medias, y si quedó en el 3, queda con tasas bajas. Entonces sucede lo siguiente: cuando ya se le asignaron las tasas, entonces sucede lo siguiente: el dinero que la persona solicita se le pasa a su cuenta de Breve. Entonces listo, ya. Pero cuando el pelado quiere realizar el pago de la deuda, lo tiene que hacer mediante nuestro aplicativo. Nuestro aplicativo sale un apartado llamado pagar deuda, que lo que realmente hace es, digamos que simular el pago, que ese pago iría a nuestra wallet y ya.
</pasted_content id="fa50">

tienes alguna pregunta al respecto?
```

## Entrada 4

Fecha: 2026-10-16 22:00:15 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`

```text
1 si recibe capital + rendimiento al final del crédito, o
2. Mira, el retorno de inversión va a depender del nivel, evidentemente, porque si, por ejemplo, alguien es nivel 1 va a pagar una tasa de interés más baja. Si es nivel 2, una tasa intermedia y nivel 3 más alta. Entonces, según el nivel de riesgo que quiera asumir el inversionista, va a depender el revenue que va a tener. Entonces entre más riesgo asuma, evidentemente más tasa de interés o más revenue va a poder obtener de su inversión. Pero obviamente eso siempre va a conllevar un riesgo.
3 desde interledger
la tasa lo define interledger la verdad, la wallet es la que dice la tasa

4 realmente la persona neutra puede ser cualquier persona, ya que la persona puede o invertir o pedir un credito

5 el nivel 1 solo puede pedir maximo 5 millones, el nivel 2 3 millones, y el nivel 3 1 millon,

la tasa del nivel 1 es del 24%
la tasa del nivel 2 es del 30%
la tasa del nivel 3 es del 36%

ps si paga bien obvio si puede salir

pero por ejemplo si no se le acepta el credito se le da un mensaje y se le dan recomendaciones

7 es en cuotas, el cliente puede elegir las cuotas, y el tema del plazo depende de lo que salga en el formulario, nivel 1 ps rango entre 30 y 120 dias, nivel 2 rango entre 30 y 90 dias, y rango nivel 3 entre 15 y 60 dias

si no paga (mora) el inversor es el que asume eso,  o que el inversor pueda pagar un seguro
este tema aun esta en discucion

8 epa, el pago de la deuda va a nuestra "wallet" o boveda,  podriamos hacer un tipo simulacion y ahi simular el envio tipo de breb a nuestra "wallet"

9 epa asi tal cual es

que mas preguntas tienes al respecto?
```

## Entrada 5

Fecha: 2026-10-16 22:20:44 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`

```text
1 en este momento estamos definiendo el tema de si vamos a tener una comision para costos operativos y ver el tema de seguros contra inpagos y de reservas

2  Sip

3 vamos a utilizar la ley de creditos productivos (no abunde tanto en esto, ya lo tenemos realizado)

4 entonces, las inverciones funcionan como las cajas de nu, es decir, el invercionista selecciona un perfil de riesgo y este comenzara a rentar segun su tasa con interes compuesto y cuando el inversionista quiera retirar su ganancia se le consignara el saldo que tenga actualmente en la cuenta

5 lo idea es tener un capital semilla para poder suplir la demanda, en caso de no haber suficiente dinero que no niege el credito pero que diga que queda en espera, mas tarde te digo cuanto seria el minimo de inversion, pero por el momento realizalo con supuestos de 50 Millones de pesos, 

6 quincenal

7 y 8 son preguntas nada que ver

9 sip
10 tenemos 24 horas
```

## Entrada 6

Fecha: 2026-10-16 22:35:49 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`

```text
Falta lo siguiente

1 el landing page que explique lo que hacemos
La pantalla para login y registro


en el tema de los colores tipo, como interledger
```

## Entrada 7

Fecha: 2026-10-16 23:09:19 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`

```text
1 para el registro debe de pedir lo siguiente

1 nombre, apellido, correo, cedula, celular, nacionalidad, edad, sexo, direccion es inversor o Acreditado

si es inversor lo lleva a este otro formulario el cual le pide lo siguiente

1 que asigne su cuenta de interledger
2 promedio de ingresos al mes
3 de donde vienen sus ingresos?
4 es independiente o asalariado

si es Acreditado lo lleva a este otro formulario

1 fuente de ingresos
2 promedio mensual de ingresos
3  Si se le facilita que se le hagan pagos en breb ( si no, no lo deja enviar el formulario y que se cree una llave para continuar)
4 llave de breb

despues de eso otro formulario

1 copia de su identificacion en lado principal
2 copia de su identificacion en lado secundario
3 verificacion facial (aun no funcional)

y Contrasena y verificar contrasena
```

## Entrada 8

Fecha: 2026-10-16 23:16:17 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`

```text
deja unas credenciales de login xfa
```

## Entrada 9

Fecha: 2026-10-16 23:21:08 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`

```text
ahora lo siguiente

1 que al realizar login los lleve como a una pantalla de inicio, y les salga las opciones o un apartado o un circulo en la izq derecha que al darle click se le desplaze las opciones que tenga
```

## Entrada 10

Fecha: 2026-10-16 23:23:46 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`

```text
mejorar el tema de los detalles minimos tipo warnings de alerta o notificaciones
```

## Entrada 11

Fecha: 2026-10-16 23:38:16 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`

```text
ahora verifica que si sea responsive y el diseno si se vea bien correcto y bien posicionado en las vistas mobile
```

## Entrada 12

Fecha: 2026-10-17 00:09:53 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`

```text
cambiar el diseno de boveda, esos datos son cosas que el usuario  no debe de saber
```

## Entrada 13

Fecha: 2026-10-17 00:15:41 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`
Adjuntos: 6 imagen(es), no incluidas en este registro.

```text
ahora cuando el usuario acreedor haga login y no haya realizado el estudio entonces que si o si lo obligue a realizar la cosa, el diseno del estudio es masomenos el siguiente, ten en cuenta las preguntas, tu realizas el disenio
```

## Entrada 14

Fecha: 2026-10-17 00:25:38 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`

```text
<pasted_content id="fa50">
# Formulario de perfil de riesgo: lógica completa

Este archivo explica, en lenguaje sencillo, cómo funciona el formulario y cómo decide el nivel de riesgo de cada persona. Sirve para el equipo (para explicarlo en el pitch y ante el jurado) y para Claude u otra IA que trabaje en este código. La fuente de verdad es el código: `lib/riesgo.ts`. Si cambian algo allí, actualicen este archivo.

---

## 1. Qué hace

Una persona **sin historial crediticio** (informal, sin cuenta bancaria, que hoy recurre al gota a gota) llena un formulario de 6 pasos. Al enviarlo, el **servidor** calcula un puntaje de 0 a 100 y la clasifica en uno de cuatro niveles:

| Nivel | Significado | ¿Recibe crédito? |
|---|---|---|
| **1** | Riesgo bajo | Sí, con las mejores condiciones |
| **2** | Riesgo medio | Sí |
| **3** | Riesgo alto | Sí, un crédito de prueba para construir historial |
| **4** | No apto por ahora | No. Recibe la explicación y la fecha para volver a solicitar |

En los niveles 1 a 3 la persona **arma su crédito**: elige los días, el monto y si paga cada semana o cada mes. Ve la cuota, el total, los intereses y la tabla de pagos.

**Principio del modelo:** un formulario no puede verificar nada, solo recoge lo que la persona dice. Por eso:
1. Lo que dice vale según **cuánto lo respalda** (sección 4).
2. El formulario solo decide un **primer crédito**, con monto limitado por su capacidad de pago.
3. El historial verificable lo construye **Open Payments**: cada cuota pagada queda registrada y en el siguiente crédito cuenta como evidencia confirmada.

---

## 2. Recorrido

1. **Paso 1. Antes de empezar:** nombre, documento, celular, confirmación de mayoría de edad y autorización de datos (Ley 1581 de 2012 y Ley 1266 de 2008). No suma puntos.
2. **Paso 2. Ingresos y gastos:** capacidad de pago (30 puntos).
3. **Paso 3. Pagos del hogar:** historial alternativo (30 puntos), con opción de subir documentos.
4. **Paso 4. Estabilidad:** vivienda, trabajo y celular (10 puntos).
5. **Paso 5. Cómo manejas la plata:** prueba de personalidad (20 puntos).
6. **Paso 6. Referencias:** hasta dos personas que la conocen (10 puntos).
7. **Resultado:** nivel, puntaje, desglose, alertas, cómo mejorar y el simulador del crédito.

**No se pregunta** sexo, edad exacta, etnia, estado civil, religión ni redes sociales. Ninguno de esos datos suma ni resta: así se evita discriminar.

---

## 3. Parámetros fijados por el equipo

Están en `CONFIG`, al inicio de `lib/riesgo.ts`. Es el único lugar donde se cambian.

| Parámetro | Valor | Qué controla |
|---|---|---|
| Factor "declarado" | **0,5** | Cuánto vale una respuesta sin prueba |
| Factor "documento" | **0,8** | Cuánto vale una respuesta con un documento subido |
| Factor "confirmado" | **1,0** | Cuánto vale una respuesta que confirmó un tercero |
| Umbral nivel 1 | **70** | Puntaje mínimo para el nivel 1 |
| Umbral nivel 2 | **50** | Puntaje mínimo para el nivel 2 |
| Umbral nivel 3 | **35** | Puntaje mínimo para el nivel 3 (debajo, nivel 4) |
| Cuota máxima | **50 % del disponible** | Parte de la plata libre que puede irse en la cuota |
| Límite de carga de deuda | **60 %** | Si las cuotas actuales pasan del 60 % del ingreso, máximo nivel 3 |
| Reintento del nivel 4 | **60 días** | Cuándo puede volver a solicitar |

**Condiciones del crédito por nivel:**

| | Nivel 1 | Nivel 2 | Nivel 3 |
|---|---|---|---|
| Techo del monto | $5.000.000 | $2.000.000 | $1.000.000 |
| Plazo (el cliente elige) | 30 a 120 días | 30 a 90 días | 15 a 60 días |
| Tasa efectiva anual | 24 % | 30 % | 36 % |

---

## 4. Cómo se calcula el puntaje (100 puntos)

### 4.1 El factor de confianza

Cada respuesta favorable se multiplica por un factor según su respaldo:

| Respaldo | Cuándo | Factor |
|---|---|---|
| **Declarado** | Solo lo dijo la persona | × 0,5 |
| **Documento** | Subió un archivo que lo respalda | × 0,8 |
| **Confirmado** | Lo confirmó una referencia | × 1,0 |

Qué respalda cada cosa:

| Dato | Documento que lo respalda | Referencia que lo confirma |
|---|---|---|
| Ingresos, margen, carga de deuda, estabilidad del ingreso | Extracto | — |
| Antigüedad del negocio | — | Proveedor o cliente |
| Servicios públicos | Factura | — |
| Arriendo | Recibo de arriendo | Arrendador |
| Celular | Captura de recargas | — |
| Natillera | Foto de la libreta | Administradora de la natillera |
| Compras a crédito | Paz y salvo | — |
| Tiempo en la vivienda | Factura (trae la dirección) | — |
| Lugar de trabajo | — | Proveedor o cliente |
| Celular a su nombre | — | — (siempre declarado) |

Reglas del factor:
- **Las respuestas neutras no se multiplican** ("No los pago yo", "Vivienda propia o familiar", "No participo" en natillera y "Nunca he comprado a crédito"). Así no se castiga a quien no tiene esa obligación.
- **La prueba de personalidad no se multiplica**, porque es una prueba, no una afirmación.
- **Las referencias tampoco**, porque cada una ya distingue confirmada de sin confirmar.
- **Consecuencia clave:** solo declarando, el máximo posible es ≈ 60 puntos. **Nadie llega al nivel 1 sin mostrar pruebas.**

### 4.2 Capacidad de pago (30 puntos)

Primero se calcula:
- **Disponible** = ingreso − gastos del hogar − cuotas de deudas (al mes)
- **Margen** = disponible ÷ ingreso
- **Carga de deuda** = cuotas de deudas ÷ ingreso

| Variable | Puntos (antes del factor) |
|---|---|
| Margen | ≥ 30 %: 12 · 15–29 %: 8 · 5–14 %: 4 · menos de 5 %: 0 |
| Carga de deuda | ≤ 20 %: 8 · 21–40 %: 5 · 41–60 %: 2 · más de 60 %: 0 |
| Estabilidad del ingreso | Muy parecidos: 6 · Varían algo: 3 · Varían mucho: 0 |
| Antigüedad del negocio | 2 años o más: 4 · 1 a 2 años: 3 · 6 a 11 meses: 2 · menos de 6 meses: 0 |

La pregunta "¿Alguna deuda es con un gota a gota?" solo informa: no suma ni resta.

### 4.3 Historial de pagos (30 puntos)

| Variable | Puntos (los neutros, en cursiva, sin factor) |
|---|---|
| Servicios públicos (últimos 6 meses) | Siempre a tiempo: 10 · 1 o 2 retrasos: 6 · 3 o más: 2 · Le cortaron: 0 · *No los paga él/ella: 4* |
| Arriendo | Siempre a tiempo: 6 · A veces tarde: 3 · Muchas veces tarde: 0 · *Propia o familiar: 4* |
| Celular | Plan al día: 4 · Recarga semanal: 3 · Recarga ocasional: 1 |
| Natillera o cadena | Siempre cumple: 6 · A veces se atrasa: 3 · *No participa: 2* |
| Compras a crédito | Al día o pagadas: 4 · Pagadas con atrasos: 2 · En mora: 0 · *Nunca: 2* |

### 4.4 Estabilidad (10 puntos)

| Variable | Puntos |
|---|---|
| Tiempo en la vivienda | Más de 2 años: 4 · 1 a 2 años: 3 · Menos de 1 año: 1 |
| Lugar de trabajo | Local o puesto fijo: 3 · Ruta o zona fija: 2 · Cambia mucho: 1 |
| Celular a su nombre | Sí: 3 · No: 1 |

### 4.5 Prueba de personalidad (20 puntos)

Once afirmaciones con escala de 1 (nada de acuerdo) a 5 (totalmente de acuerdo). Las afirmaciones 3, 5, 7, 9 y 11 están redactadas al revés ("Muchas veces compro cosas que no tenía planeadas"), así que puntúan como **6 − respuesta**.

- **Afirmaciones 1 a 10 (14 puntos):** se suman ya ajustadas (S va de 10 a 50). Puntos = (S − 10) ÷ 40 × 14.
- **Paciencia (3 puntos):** "¿$100.000 hoy o $120.000 en un mes?". Esperar da 3; hoy da 0. Mide si prioriza el corto plazo.
- **Consistencia (3 puntos):** la afirmación 2 ("cumplo lo que prometo pagar") se compara con la 11 invertida ("a veces dejo pasar fechas sin avisar"). Si difieren en 3 o más, la respuesta es contradictoria: 0 puntos y una alerta. Si no, 3 puntos.

Pesa solo el 20 % porque la gente tiende a responder lo que "suena bien".

### 4.6 Referencias (10 puntos)

Hasta 2 referencias, cada una de 0 a 5 puntos:

| Estado | Puntos |
|---|---|
| Confirmada | 5 |
| Registrada sin confirmar | 2 |
| Dice que no la conoce | 0 (y genera alerta) |
| Dice que no cumple | 0 (y manda al nivel 4) |

Relaciones posibles: proveedor, cliente frecuente, administradora de natillera, arrendador, líder comunitario u **otro** (con un cuadro para escribir cuál). "Otro" suma puntos igual, pero no respalda ningún dato específico.

### 4.7 Puntaje final

Puntaje = capacidad + historial + estabilidad + personalidad + referencias, **redondeado** a entero.

**Índice de respaldo:** qué porcentaje de los puntos de afirmaciones (sin contar personalidad, referencias ni neutros) está respaldado por un documento o un tercero. Se muestra a la persona ("tu perfil está respaldado al 45 %").

---

## 5. Cruces de coherencia (alertas)

Comparan lo que dijo la persona con la evidencia:

| Cruce | Cuándo salta | Qué pasa con el dato |
|---|---|---|
| **X1** Factura vs. respuesta | Dijo "siempre a tiempo" en servicios, pero la factura muestra mora | Se califica como "1 o 2 retrasos" |
| **X2** Extracto vs. ingreso | El ingreso declarado es más de 1,5 veces el del extracto | Se usa el ingreso del extracto para todo el cálculo |
| **X3** Referencia | Una referencia dice que no conoce a la persona | Esa referencia vale 0 |
| **X4** Presupuesto imposible | Gastos + cuotas menores al 30 % del ingreso, y sin extracto | Solo alerta |
| **X5** Personalidad | Afirmaciones 2 y 11 contradictorias | Pierde los 3 puntos de consistencia |

---

## 6. Del puntaje al nivel (en este orden)

1. **Por puntaje:** 70 o más → nivel 1; 50 a 69 → nivel 2; 35 a 49 → nivel 3; menos de 35 → nivel 4.
2. **Alertas:** 1 alerta → se marca "para revisión", sin cambiar el nivel. **2 alertas → baja un nivel.**
3. **Carga de deuda > 60 %:** si quedó en nivel 1 o 2, baja a nivel 3.
4. **Exclusiones: van directo al nivel 4, sin importar el puntaje:**
   - No le sobra plata (disponible ≤ 0): prestarle empeoraría su situación.
   - Un documento parece alterado.
   - Una referencia dice que no cumple sus pagos.
   - 3 o más alertas.
   - Tiene un crédito anterior con la plataforma sin pagar (hoy siempre "no": pendiente de conectar a la base de datos).

El nivel 4 recibe la razón concreta, qué puede cambiar y la fecha de reintento (hoy + 60 días). No ve recomendaciones de mejora ni crédito.

**Recomendaciones de mejora** (niveles 1 a 3): subir la factura si no la subió; subir la libreta o pedir confirmación de la natillera; pedir a las referencias que confirmen; y en niveles 2 y 3, "paga 30 días seguidos a tiempo y subes un nivel".

---

## 7. Cuánto se presta y cómo se paga

### 7.1 Cuota máxima
- **Disponible diario** = disponible mensual ÷ 30.
- **Cuota máxima por día** = 50 % del disponible diario.
- **Cuota máxima semanal** = cuota diaria × 7. **Mensual** = cuota diaria × 30.

### 7.2 Número de cuotas
El cliente elige los días dentro del rango de su nivel y la frecuencia (**semanal o mensual**; la diaria se quitó de la pantalla).
- Número de cuotas = días ÷ 7 (semanal) o días ÷ 30 (mensual), redondeado, con mínimo 1 y sin pasar el máximo de días del nivel.
- Ejemplo: 90 días son **12 cuotas semanales** (13 serían 91 días) o **3 mensuales**.

### 7.3 Tasa del periodo
La tasa efectiva anual se convierte al periodo: **i = (1 + E.A.)^(días del periodo ÷ 365) − 1**.
Ejemplo: 30 % E.A. semanal = 0,50 %; mensual = 2,18 %.

### 7.4 Cupo (monto máximo)
**Cupo = el menor entre el techo del nivel y lo que alcanza a pagar**, redondeado hacia abajo a miles:

Valor presente = cuota máxima × (1 − (1 + i)^(−n)) ÷ i

**Casi siempre manda la capacidad de pago, no el techo.** Para alcanzar los $5.000.000 del nivel 1 a 120 días, a la persona le tendrían que sobrar ≈ $2,6 millones al mes.

### 7.5 Cuota y plan de pagos (sistema francés)
- **Cuota fija** = monto × i ÷ (1 − (1 + i)^(−n)), redondeada hacia arriba a pesos enteros.
- En cada cuota: **interés** = saldo × i; **abono a capital** = cuota − interés; el saldo baja.
- La **última cuota se ajusta** para que el saldo quede exactamente en cero (por eso puede ser unos pesos menor).
- **Intereses totales** = suma de cuotas − monto.
- Pagar cada mes cuesta más intereses que cada semana, porque la deuda baja más despacio.

**Ejemplo verificado:** $2.000.000 a 90 días al 30 % E.A. con cuota diaria da ≈ $66.000 de intereses, no $133.700. Como paga cada día, la deuda promedio es la mitad del préstamo.

### 7.6 Conexión con Open Payments
El botón "Solicitar crédito" entrega `{ nivel, monto, frecuencia, numeroCuotas, dias, cuota, tasaEA }` (pendiente de conectar). `limitesDelGrant(cuota, numeroCuotas, assetScale, inicio, frecuencia)` arma los límites del permiso de cobro automático:
- `debitAmount` = la cuota en unidades mínimas (el `assetScale` se lee de la wallet address).
- `interval` = `R{número de cuotas}/{fecha de inicio}/P1W` (semanal) o `/P1M` (mensual).

---

## 8. Perfiles de prueba (resultados reales del modelo)

| Perfil | Solo declarado | Con documentos | Documentos + referencias confirmadas |
|---|---|---|---|
| **Vendedora de arepas**: gana $2,4 M, gasta $1,4 M, cuotas $0,2 M, todo al día, natillera, 2 referencias | 57 → nivel 2 | 75 → **nivel 1** | 86 → nivel 1 |
| **Ambulante con gota a gota**: gana $1,5 M, gasta $1,0 M, cuotas $0,3 M, 1–2 retrasos, sin natillera, 1 referencia | 37 → nivel 3 | 45 → nivel 3 | 50 → **nivel 2** |
| **Joven sin historial**: gana $1,2 M, gasta $0,9 M, sin deudas, vive con la familia, 1 referencia | 46 → nivel 3 | 53 → **nivel 2** | 56 → nivel 2 |
| **Sobreendeudada**: gana $1,0 M, gasta $0,8 M, cuotas $0,45 M | **Nivel 4** (no le sobra plata) | Nivel 4 | Nivel 4 |

**La evidencia mueve el nivel:** ese es el incentivo para que la persona respalde lo que dice.

---

## 9. Qué es real y qué es simulado

| Parte | Estado |
|---|---|
| Puntaje, nivel, cupo, cuotas y plan de pagos | **Real** (calculado en el servidor) |
| Lectura de documentos | **Simulada**: subir el archivo cuenta como documento; no se lee su contenido |
| Confirmación de referencias | **Simulada**: si la persona marca "enviarle un mensaje", se da por confirmada |
| Mora con la plataforma | Pendiente (siempre "no") |
| Guardar el perfil | Pendiente |

**Trucos para la demo** (con el nombre del archivo):
- `factura_mora.pdf`: la factura "muestra" mora → alerta X1.
- `factura_alterada.pdf` (cualquier archivo con "alterad"): documento alterado → nivel 4.
- `extracto_1000000.pdf`: el extracto "dice" que el ingreso es $1.000.000 → cruce X2.

---
</pasted_content id="fa50">

## 10. Reglas para quien modifique este código (personas o IA)

- **Los parámetros se cambian solo en `CONFIG`** (`lib/riesgo.ts`). Después, correr las pruebas: `node --test formulario-riesgo/lib/riesgo.test.mjs` (Node 22.18 o superior).
- El puntaje se calcula **en el servidor** (`app/api/perfil/route.ts`), nunca en el navegador.
- No preguntar datos sensibles (sexo, etnia, religión, estado civil, redes sociales) ni hacer que sumen o resten.
- No recomendar billeteras o bancos específicos (se quitó la recomendación de Nequi y Daviplata).
- El formulario **no pide wallet address**.
- En la pantalla, la frecuencia de pago es **solo semanal o mensual**.
- Todo lo simulado se rotula como simulado en la interfaz.
- Si cambian la lógica, actualicen este archivo y el README.

**Pendientes conocidos:**
- El mínimo de 15 días del nivel 3 no cuadra con cuotas mensuales (el mínimo real es 30). Propuesta: subirlo a 30.
- Las tasas de los niveles 2 y 3 superan la usura de consumo (28,59 % E.A., octubre de 2026, verificar en la Superfinanciera). El crédito debe presentarse como **productivo** (tope 57,39 % E.A.).
- Conectar "Solicitar crédito" con el flujo de Open Payments, guardar el perfil y consultar la mora real.
```

## Entrada 15

Fecha: 2026-10-17 00:36:46 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
ahora realiza un dataset con datos variados pero validos que nos ayuden a la construccion de un modelo de machine learning que nos ayude a calificar los creditos y no simplemente sea un cuestionario
```

## Entrada 16

Fecha: 2026-10-17 00:44:37 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`
Tipo: comando que el usuario ejecutó dentro de la sesión (no es una instrucción a la IA), con su salida.

```text
<bash-input>python3 ml/train_baseline.py</bash-input><bash-stdout>pypython3 ml/train_baseline.py
  L2=0.3   AUC validación 0.890
  L2=3     AUC validación 0.889
  L2=30    AUC validación 0.888
  L2=300   AUC validación 0.881

Prueba: 717 créditos de jul-sep 2026, incumplimiento real 13.2%
                            AUC   Gini     KS
Cuestionario (reglas)     0.739  0.479  0.392
Regresión logística       0.872  0.744  0.599

Si aprobamos solo al 70 % de menor riesgo:
  Cuestionario (reglas)  incumplimiento de los aprobados 7.4%
  Regresión logística    incumplimiento de los aprobados 4.0%

Incumplimiento real por quintil de riesgo del modelo (1 = menor riesgo):
  Q1: prob. media 0.4% · real 0.7%
  Q2: prob. media 1.7% · real 3.5%
  Q3: prob. media 4.8% · real 4.2%
  Q4: prob. media 13.4% · real 12.6%
  Q5: prob. media 54.6% · real 44.8%

Revisión de equidad (el sexo NO entra al modelo):
  F: 421 créditos · riesgo medio predicho 14.5% · real 13.3%
  M: 296 créditos · riesgo medio predicho 16.0% · real 13.2%

Lo que más pesa (coeficientes estandarizados):
  ↑ riesgo  +0.724  personas_a_cargo
  ↓ riesgo  -0.537  gastos_sobre_ingreso
  ↓ riesgo  -0.423  referencias_confirmadas
  ↑ riesgo  +0.389  cuotas
  ↑ riesgo  +0.308  margen_declarado
  ↑ riesgo  +0.295  cuota_sobre_disponible
  ↑ riesgo  +0.279  antiguedad_actividad=lt6
  ↑ riesgo  +0.277  deudas_sobre_ingreso
  ↑ riesgo  +0.257  log_ingreso_declarado
  ↓ riesgo  -0.246  likert_8
  ↑ riesgo  +0.245  sector=venta_ambulante
  ↑ riesgo  +0.240  likert_11
  ↓ riesgo  -0.239  sector=tienda_barrio
  ↑ riesgo  +0.223  likert_9
  ↑ riesgo  +0.219  cuota_sobre_ingreso

Pesos guardados en ml/modelo/regresion_logistica.json

~/Documents/Proyectos/Financial-Kratos-Team---Repo main* 38s
❯</bash-stdout><bash-stderr></bash-stderr>
```

## Entrada 17

Fecha: 2026-10-17 00:45:43 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
<pasted_content id="fa50">
pypython3 ml/train_baseline.py
  L2=0.3   AUC validación 0.890
  L2=3     AUC validación 0.889
  L2=30    AUC validación 0.888
  L2=300   AUC validación 0.881

Prueba: 717 créditos de jul-sep 2026, incumplimiento real 13.2%
                            AUC   Gini     KS
Cuestionario (reglas)     0.739  0.479  0.392
Regresión logística       0.872  0.744  0.599

Si aprobamos solo al 70 % de menor riesgo:
  Cuestionario (reglas)  incumplimiento de los aprobados 7.4%
  Regresión logística    incumplimiento de los aprobados 4.0%

Incumplimiento real por quintil de riesgo del modelo (1 = menor riesgo):
  Q1: prob. media 0.4% · real 0.7%
  Q2: prob. media 1.7% · real 3.5%
  Q3: prob. media 4.8% · real 4.2%
  Q4: prob. media 13.4% · real 12.6%
  Q5: prob. media 54.6% · real 44.8%

Revisión de equidad (el sexo NO entra al modelo):
  F: 421 créditos · riesgo medio predicho 14.5% · real 13.3%
  M: 296 créditos · riesgo medio predicho 16.0% · real 13.2%

Lo que más pesa (coeficientes estandarizados):
  ↑ riesgo  +0.724  personas_a_cargo
  ↓ riesgo  -0.537  gastos_sobre_ingreso
  ↓ riesgo  -0.423  referencias_confirmadas
  ↑ riesgo  +0.389  cuotas
  ↑ riesgo  +0.308  margen_declarado
  ↑ riesgo  +0.295  cuota_sobre_disponible
  ↑ riesgo  +0.279  antiguedad_actividad=lt6
  ↑ riesgo  +0.277  deudas_sobre_ingreso
  ↑ riesgo  +0.257  log_ingreso_declarado
  ↓ riesgo  -0.246  likert_8
  ↑ riesgo  +0.245  sector=venta_ambulante
  ↑ riesgo  +0.240  likert_11
  ↓ riesgo  -0.239  sector=tienda_barrio
  ↑ riesgo  +0.223  likert_9
  ↑ riesgo  +0.219  cuota_sobre_ingreso

Pesos guardados en ml/modelo/regresion_logistica.json

~/Documents/Proyectos/Financial-Kratos-Team---Repo main* 38s
</pasted_content id="fa50">

como quedo el modelo?
```

## Entrada 18

Fecha: 2026-10-17 00:46:09 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
conecta el modelo a la app
```

## Entrada 19

Fecha: 2026-10-17 00:55:31 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
ahora realiza lo siguiente

Realiza funcional ahora el apartado de que envie el video a la "boveda" nuestra boveda es la siguiente wallet

OP_PAYER_WALLET_ADDRESS=https://ilp.interledger-test.dev/f62cd2c0   # 2a cuenta: pagador 
lo puedes agregar al .env
```

## Entrada 20

Fecha: 2026-10-17 01:06:38 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`
**Copia para publicación con redacciones explícitas** (ver nota al final): no es el texto íntegro.

```text
entonces ahora lo siguiente

<pasted_content id="fa50">
# ---- Wompi PRODUCCIÓN — SOLO para VERIFICAR llaves reales (resolve) ----
# ⚠️⚠️ ESTAS CREDENCIALES SON DE PRODUCCIÓN.
# USO EXCLUSIVO: GET /breb/keys/resolve  (solo lectura, NO mueve dinero).
# NUNCA usar estas credenciales para POST /payouts (eso movería dinero REAL).
# Las dispersiones (payout real) van SIEMPRE por el sandbox de arriba.
WOMPI_PROD_API_URL=https://api.payouts.wompi.co/v2
WOMPI_PROD_API_KEY=[REDACTADO: credencial de producción de Wompi]
WOMPI_PROD_USER_PRINCIPAL_ID=[REDACTADO: credencial de producción de Wompi]
</pasted_content id="fa50">
```

## Entrada 21

Fecha: 2026-10-17 01:08:04 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
entonces ya veririca la cuenta breb real y no la de sandbox?
```

## Entrada 22

Fecha: 2026-10-17 01:55:38 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
organizar bien la estructura de la pagina de /invertir ya que no tiene logica que el boton de aprobar en la wallet salga mas arriba
```

## Entrada 23

Fecha: 2026-10-17 02:00:34 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
Pero que se muestre la cotizacion y el cambio de moneda que hace interledger
```

## Entrada 24

Fecha: 2026-10-17 02:04:31 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
pero aqui esta la cosa, en la pagina pusimos que vamos a invertir 1 millon de pesos entonces lo debe de convertir a euro o a dolar
```

## Entrada 25

Fecha: 2026-10-17 02:07:50 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
y si se actualiza la taza? no esta hardcodeado
```

## Entrada 26

Fecha: 2026-10-17 02:08:33 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
Listo ahora la logica de regresar la inversion, comenzemosla a realizar, que la plata se pase de la  cuenta "boveda" que tenemos
```

## Entrada 27

Fecha: 2026-10-17 02:14:02 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
como asi? me toca aprobar el retiro de la boveda de nuestro aplicativo?
```

## Entrada 28

Fecha: 2026-10-17 02:14:48 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
cuanto es el tope maximo?
```

## Entrada 29

Fecha: 2026-10-17 02:16:55 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
sucede lo siguiente

si el cliente se retira antes solo puede sacar el 50%, 

el maximo para retirar pongamoslo que sea 30k
```

## Entrada 30

Fecha: 2026-10-17 02:18:17 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
pero el plazo es segun el nivel del riesgo bro, no te habia dicho?
```

## Entrada 31

Fecha: 2026-10-17 02:25:39 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
en el apartado del acreditado que cosas nos falta?
```

## Entrada 32

Fecha: 2026-10-17 02:28:20 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
hay que tener en cuenta que aun esto es un sandbox o simulacion o desarollo, seria realizar el apartado que le permita simular como si estuviera abonando a una cuota y que ese dinero se acredite a nuestra "boveda", como un simulador de enviar plata de breb desde ahi y que salga la opcion de enviar el dinero a nuestra "llave" la cual esa llave esta vinculada simultaneamente a nuestra boveda
```

## Entrada 33

Fecha: 2026-10-17 02:33:48 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
dale, entonces realiza lo de Desembolso "real" que sea simulado con los datos que podemos sacar de produccion, pero obviamente no le enviariamos dinero real
```

## Entrada 34

Fecha: 2026-10-17 02:54:09 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
ahora falta lo siguiente
en el apartado de mi estudio hay que arreglar varios erorres

1 la barra no se puede llenar por completo, se queda una parte sin llenar,
2 cuando pregunta si tiene deudas con gota gotas no deja poner el 0
```

## Entrada 35

Fecha: 2026-10-17 02:56:57 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
a lo que me refiero es a la barra de cuanto dinero va a pedir la persona
```

## Entrada 36

Fecha: 2026-10-17 03:01:29 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
entonces para inversor y para acreditado que cosas faltan?
```

## Entrada 37

Fecha: 2026-10-17 03:08:31 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
1. Para ver un cambio de moneda real: una wallet de inversionista en USD. Las dos actuales están en EUR y no se ve ninguna conversión.

como arreglariamos eso?
```

## Entrada 38

Fecha: 2026-10-17 03:09:32 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
cual es nuestra wallet "boveda"?
```

## Entrada 39

Fecha: 2026-10-17 03:11:14 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
$ilp.interledger-test.dev/usdtroly

esa cuenta recibe USD
```

## Entrada 40

Fecha: 2026-10-17 03:13:47 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
1. Tope del permiso de la bóveda: son 1.000 EUR en total y un retiro grande lo supera. Si van a mostrar retiros grandes, suban `OP_VAULT_GRANT_LIMIT`.

realiza el cambio tu y pong 100k USD
```

## Entrada 41

Fecha: 2026-10-17 03:15:02 UTC · Sesiones: `347dd228`, `589ceaf0`, `67d2ac3d`, `86d13a8d`

```text
nosotros cubrimos lo siguiente?

payment request
authorization
payment execution
succcessful completion?
```

## Entrada 42

Fecha: 2026-10-17 03:17:19 UTC · Sesiones: `347dd228`, `589ceaf0`, `86d13a8d`

```text
1. Cada inversión reinicia el plazo de la cajita. Lo más justo sería que cada aporte tenga su propio plazo.

ahora como se fixea esto? que recomiendas
```

## Entrada 43

Fecha: 2026-10-17 03:18:12 UTC · Sesiones: `347dd228`, `589ceaf0`, `86d13a8d`

```text
okay realizalo
```

## Entrada 44

Fecha: 2026-10-17 03:22:42 UTC · Sesiones: `347dd228`, `589ceaf0`, `86d13a8d`

```text
entonces para inversor y para acreditado que cosas faltan?
```

## Entrada 45

Fecha: 2026-10-17 04:33:26 UTC · Sesiones: `347dd228`, `589ceaf0`, `86d13a8d`

```text
sucede lo siguiente

Mora: no se cobran intereses de mora, no hay recordatorios antes del vencimiento ni cobranza, y el atraso no le baja el nivel. Va junto con el punto 1 del inversionista.
Pago anticipado: con “Todo el saldo” paga todos los intereses programados. Al pagar antes debería pagar solo el capital más los intereses hasta ese día.
Contrato o pagaré al pedir el crédito, y presentarlo como crédito productivo por el tema de la usura.

Los impagos no afectan a nadie. Si un crédito cae en mora, las cajitas siguen rentando igual aunque la pantalla diga que el riesgo lo asume el inversionista. Hay que decidir cómo se reparte la pérdida: entre el pool del nivel, con un seguro o con una reserva. Es lo más importante que falta para que el modelo de negocio cuadre.

dependen de la decision del departamento financiero, estoy esperando a ver que me dicen,

teniendo en cuenta las otras cosas puedo realizar commit?
```

## Entrada 46

Fecha: 2026-10-17 04:34:39 UTC · Sesiones: `347dd228`, `589ceaf0`, `86d13a8d`

```text
y el gitignore si esta bien configurado
```

## Entrada 47

Fecha: 2026-10-17 04:35:15 UTC · Sesiones: `347dd228`, `589ceaf0`, `86d13a8d`

```text
Sí, haz el commit en main con todo lo revisado.
```

## Entrada 48

Fecha: 2026-10-17 04:36:17 UTC · Sesiones: `347dd228`, `589ceaf0`, `86d13a8d`

```text
Sí, haz push de main al remoto.
```

## Entrada 49

Fecha: 2026-10-17 04:37:26 UTC · Sesiones: `347dd228`, `589ceaf0`, `86d13a8d`

```text
entoncs que cosas quedan pendientes en inversor y en acreditado?
```

## Entrada 50

Fecha: 2026-10-17 04:41:48 UTC · Sesiones: `347dd228`, `589ceaf0`, `86d13a8d`

````text
aqui hay un contexto de otro proyecto de masomenos como funciona el QR de breb

<pasted_content id="fa50">
Voy a confirmar si el proyecto ya tiene un parser QR o si solo está documentado, para explicarte la lógica real y qué falta implementar.La lógica del escaneo tiene dos validaciones diferentes:

1. Validación local del QR: estructura, namespace, llave y checksum CRC.
2. Validación remota de la llave: consultar Wompi para confirmar que existe, está activa y conocer el titular.

Un QR bien formado no garantiza que la llave siga activa. Por eso ambas validaciones son necesarias.
Estado actual del proyecto
Busqué la implementación y actualmente no existe código de parser QR en `scripts/`. El `README.md` dice que fue verificado, pero solo documenta el formato:

* Formato EMVCo TLV.
* Namespace `CO.COM.RBM`.
* Información Bre-B dentro del tag `26`.
* Subtags:
   * `01`: documento.
   * `02`: celular.
   * `03`: correo.
   * `04`: alias.
* Checksum CRC-16/CCITT en el tag `63`.

El archivo `verify-breb-key.mjs` únicamente recibe una llave escrita manualmente y la consulta en Wompi.
Flujo completo del escaneo

```text
Usuario abre cámara
        ↓
Librería QR obtiene texto crudo
        ↓
Parser EMVCo TLV
        ↓
Validar CRC
        ↓
Buscar template 26
        ↓
Validar namespace CO.COM.RBM
        ↓
Extraer llave y tipo
        ↓
Consultar Wompi
        ↓
Mostrar titular enmascarado y banco
        ↓
Usuario confirma
        ↓
Bloquear llave verificada
        ↓
Crear payout

```

1. La cámara solamente obtiene texto
Una librería como `html5-qrcode` no interpreta Bre-B. Solo devuelve el contenido crudo:

```js
function onScanSuccess(decodedText) {
  console.log(decodedText);
}

```

Ese contenido es una cadena EMVCo TLV sin separadores.
2. Cómo funciona TLV
TLV significa:

```text
Tag + Length + Value

```

Ejemplo conceptual:

```text
00 02 01

```

Significa:

```text
Tag:    00
Length: 02
Value:  01

```

Cada elemento utiliza:

* 2 caracteres para el tag.
* 2 caracteres para la longitud.
* `length` caracteres para el valor.

El contenido Bre-B se encuentra dentro del tag `26`, que a su vez contiene otro conjunto TLV.
Representación conceptual:

```text
Tag 26
  ├── 00 = CO.COM.RBM
  └── 04 = @alias-del-beneficiario

```

En el QR real aparece concatenado:

```text
0010CO.COM.RBM04...@alias

```

3. Parser TLV básico

```js
function parseTlv(payload) {
  const fields = [];
  let offset = 0;

  while (offset < payload.length) {
    if (offset + 4 > payload.length) {
      throw new Error("TLV incompleto");
    }

    const start = offset;
    const tag = payload.slice(offset, offset + 2);
    const lengthText = payload.slice(offset + 2, offset + 4);

    if (!/^\d{2}$/.test(tag)) {
      throw new Error(`Tag TLV inválido: ${tag}`);
    }

    if (!/^\d{2}$/.test(lengthText)) {
      throw new Error(`Longitud TLV inválida en tag ${tag}`);
    }

    const length = Number(lengthText);
    const valueStart = offset + 4;
    const end = valueStart + length;

    if (end > payload.length) {
      throw new Error(`Valor incompleto en tag ${tag}`);
    }

    fields.push({
      tag,
      length,
      value: payload.slice(valueStart, end),
      start,
      valueStart,
      end,
    });

    offset = end;
  }

  return fields;
}

```

Para producción, el parser debería manejar longitudes en bytes UTF-8. Los identificadores Bre-B normalmente son ASCII, pero no conviene asumirlo para todos los campos de un QR.
4. Validar el CRC
El último campo debe ser:

```text
Tag:    63
Length: 04
Value:  cuatro caracteres hexadecimales

```

Ejemplo conceptual:

```text
6304ABCD

```

El CRC se calcula sobre todo el contenido hasta incluir `6304`, pero sin incluir los cuatro caracteres del resultado.
Implementación:

```js
function crc16Ccitt(value) {
  let crc = 0xffff;
  const bytes = new TextEncoder().encode(value);

  for (const byte of bytes) {
    crc ^= byte << 8;

    for (let bit = 0; bit < 8; bit++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

```

Validación:

```js
function validateCrc(payload, fields) {
  const crcField = fields.at(-1);

  if (!crcField || crcField.tag !== "63") {
    throw new Error("El QR no termina con el tag CRC 63");
  }

  if (crcField.length !== 4) {
    throw new Error("El CRC debe tener longitud 04");
  }

  if (!/^[0-9A-Fa-f]{4}$/.test(crcField.value)) {
    throw new Error("El CRC no es hexadecimal");
  }

  // Incluye tag 63 y longitud 04, excluye su valor.
  const crcInput = payload.slice(0, crcField.valueStart);
  const calculated = crc16Ccitt(crcInput);

  if (calculated !== crcField.value.toUpperCase()) {
    throw new Error(
      `CRC inválido: recibido ${crcField.value}, calculado ${calculated}`,
    );
  }

  return true;
}

```

Si falla el CRC, debes rechazar el QR. Podría estar incompleto, alterado o mal leído.
5. Encontrar el template Bre-B
Después de parsear el nivel principal:

```js
const fields = parseTlv(decodedText);
validateCrc(decodedText, fields);

const brebTemplate = fields.find((field) => field.tag === "26");

if (!brebTemplate) {
  throw new Error("El QR no contiene el template Bre-B 26");
}

```

Luego parseas nuevamente su contenido:

```js
const brebFields = parseTlv(brebTemplate.value);

```

6. Validar el namespace
Dentro del template `26`, el subtag `00` identifica el esquema:

```js
const namespace = brebFields.find((field) => field.tag === "00");

if (!namespace || namespace.value !== "CO.COM.RBM") {
  throw new Error("El QR no pertenece al esquema Bre-B");
}

```

Esto evita aceptar cualquier QR EMV como si fuera Bre-B.
7. Extraer la llave y el tipo
Según la documentación del proyecto:

```js
const BREB_KEY_TYPES = {
  "01": "IDENTIFICATION",
  "02": "PHONE",
  "03": "MAIL",
  "04": "ALPHANUMERIC",
};

```

Extracción:

```js
function extractBrebKey(brebFields) {
  const candidates = brebFields.filter(
    (field) => BREB_KEY_TYPES[field.tag],
  );

  if (candidates.length === 0) {
    throw new Error("El QR no contiene una llave Bre-B");
  }

  if (candidates.length > 1) {
    throw new Error("El QR contiene más de una llave Bre-B");
  }

  const field = candidates[0];

  return {
    key: field.value.trim(),
    keyType: BREB_KEY_TYPES[field.tag],
  };
}

```

Resultados posibles:

```json
{
  "key": "1020304050",
  "keyType": "IDENTIFICATION"
}

```


```json
{
  "key": "3001234567",
  "keyType": "PHONE"
}

```


```json
{
  "key": "@elias123",
  "keyType": "ALPHANUMERIC"
}

```

8. Función completa del parser

```js
const BREB_KEY_TYPES = {
  "01": "IDENTIFICATION",
  "02": "PHONE",
  "03": "MAIL",
  "04": "ALPHANUMERIC",
};

function parseBrebQr(payload) {
  const raw = payload.trim();

  if (!raw) {
    throw new Error("El QR está vacío");
  }

  const fields = parseTlv(raw);
  validateCrc(raw, fields);

  const template = fields.find((field) => field.tag === "26");

  if (!template) {
    throw new Error("Template Bre-B 26 no encontrado");
  }

  const brebFields = parseTlv(template.value);
  const namespace = brebFields.find((field) => field.tag === "00");

  if (namespace?.value !== "CO.COM.RBM") {
    throw new Error("Namespace Bre-B inválido");
  }

  const candidates = brebFields.filter(
    (field) => BREB_KEY_TYPES[field.tag],
  );

  if (candidates.length !== 1) {
    throw new Error(
      candidates.length === 0
        ? "No se encontró una llave Bre-B"
        : "Se encontraron múltiples llaves Bre-B",
    );
  }

  const keyField = candidates[0];

  return {
    raw,
    namespace: namespace.value,
    key: keyField.value.trim(),
    keyType: BREB_KEY_TYPES[keyField.tag],
  };
}

```

9. Conectarlo con `verify-breb-key.mjs`
El resultado del escaneo:

```js
const result = parseBrebQr(decodedText);

```

Entrega:

```json
{
  "namespace": "CO.COM.RBM",
  "key": "@elias123",
  "keyType": "ALPHANUMERIC"
}

```

Después reutilizas la lógica actual de Wompi:

```js
const verification = await resolveBrebKey({
  key: result.key,
  keyType: result.keyType,
});

```

Por tanto:

```text
parseBrebQr()
      ↓
{ key, keyType }
      ↓
resolveBrebKey()
      ↓
{ holderName, financialEntity, active }

```

10. El QR no es la verificación final
Aunque el QR tenga:

* TLV correcto.
* Namespace correcto.
* CRC correcto.
* Llave con formato válido.

Todavía podría contener una llave:

* Eliminada.
* Inactiva.
* Reasignada.
* Que no corresponde al solicitante.
* No disponible temporalmente.

Por eso debes consultar Wompi después del escaneo:

```text
QR válido ≠ llave válida

```

La validación completa es:

```text
QR estructuralmente válido
+ CRC válido
+ namespace Bre-B válido
+ llave encontrada
+ Wompi confirma llave activa
+ usuario confirma titular
= destino autorizado

```

11. Estados de la interfaz

```text
IDLE
  ↓
CAMERA_OPEN
  ↓
QR_DETECTED
  ↓
QR_VALIDATING
  ↓
KEY_RESOLVING
  ↓
KEY_VERIFIED
  ↓
USER_CONFIRMED

```

Errores posibles:

```text
CAMERA_PERMISSION_DENIED
QR_UNREADABLE
INVALID_TLV
INVALID_CRC
UNSUPPORTED_NAMESPACE
MISSING_BREB_KEY
MULTIPLE_BREB_KEYS
KEY_NOT_FOUND
KEY_INACTIVE
RESOLVE_TIMEOUT

```

La interfaz debería mostrar:

```text
Escaneando QR...
       ↓
Verificando llave Bre-B...
       ↓
Titular: Eli*** Can*** Mor***
Banco: Davivienda
Llave: @elias123

[Confirmar beneficiario]

```

12. Controles de seguridad
No debes crear automáticamente el desembolso apenas se escanee el QR. El proceso correcto es:

```text
Escanear
→ validar
→ resolver titular
→ mostrar titular
→ pedir confirmación
→ crear payout

```

Además:

* No registres el QR completo en logs.
* No confíes en nombres incluidos en el QR.
* Usa el titular devuelto por Wompi.
* La verificación debe expirar después de unos minutos.
* Si cambia la llave, verifica nuevamente.
* Bloquea múltiples lecturas mientras procesas un QR.
* Usa idempotencia para evitar payouts duplicados.
* No confíes en un monto incluido en el QR para desembolsar un crédito: usa el monto aprobado por tu motor de crédito.

Para tu caso de crédito

```text
Solicitante pide 15.000 COP
        ↓
Crédito aprobado
        ↓
Solicitante escanea su QR Bre-B
        ↓
Extraes llave
        ↓
Wompi devuelve titular y banco
        ↓
Solicitante confirma
        ↓
MockGateHub debita 15.000 COP equivalentes
        ↓
Wompi Sandbox crea payout de 1.500.000 centavos
        ↓
Crédito cambia a DISBURSED

```

Para la demo en Wompi Sandbox, el QR debe contener una llave reconocida por el sandbox, como `@elias123` o `1020304050`. Un QR real puede parsearse correctamente, pero su llave no será encontrada por el directorio simulado.
</pasted_content id="fa50">

ten en cuenta que es algo de otro proyecto
````

## Entrada 51

Fecha: 2026-10-17 04:46:52 UTC · Sesiones: `347dd228`, `589ceaf0`, `86d13a8d`

```text
* Cámara + foto del QR + QR real de breb para ver como lo escanea y si lo logra identificar bien: es lo más vistoso para la demo. Instala dos librerías de npm, `jsqr` para leer
```

## Entrada 52

Fecha: 2026-10-17 04:53:02 UTC · Sesiones: `347dd228`, `589ceaf0`, `86d13a8d`
**Copia para publicación con redacciones explícitas** (ver nota al final): no es el texto íntegro.

```text
la cosa esq con el qr podemos sacar la llave y con la llave ya la validamos como siempre lo validamos

Por ejemplo, este es el contenido de un qr real de breb

[REDACTADO: contenido completo de un QR Bre-B real; incluye la llave Bre-B (celular, correo o alias) de una persona]

O

[REDACTADO: contenido completo de un QR Bre-B real; incluye la llave Bre-B (celular, correo o alias) de una persona]

o

[REDACTADO: contenido completo de un QR Bre-B real; incluye la llave Bre-B (celular, correo o alias) de una persona]

o

[REDACTADO: contenido completo de un QR Bre-B real; incluye la llave Bre-B (celular, correo o alias) de una persona]
```

## Entrada 53

Fecha: 2026-10-17 04:55:47 UTC · Sesiones: `347dd228`, `589ceaf0`, `86d13a8d`
**Copia para publicación con redacciones explícitas** (ver nota al final): no es el texto íntegro.

```text
este es otro contenido de otro qr

[REDACTADO: contenido completo de un QR Bre-B real; incluye la llave Bre-B (celular, correo o alias) de una persona]

o

[REDACTADO: contenido completo de un QR Bre-B real; incluye la llave Bre-B (celular, correo o alias) de una persona]

o

[REDACTADO: contenido completo de un QR Bre-B real; incluye la llave Bre-B (celular, correo o alias) de una persona]
```

## Entrada 54

Fecha: 2026-10-17 04:57:36 UTC · Sesiones: `347dd228`, `589ceaf0`, `86d13a8d`

```text
entonces que cosas faltan? en inversor y en acreditado
```

## Entrada 55

Fecha: 2026-10-17 04:58:16 UTC · Sesiones: `347dd228`, `589ceaf0`, `86d13a8d`

```text
* el cobro y el envío reales por Wompi.

no tiene sentido esta ya que estamos hablando de un sandbox entonces doesn make sense hacer esto
```

## Entrada 56

Fecha: 2026-10-17 05:00:22 UTC · Sesiones: `347dd228`, `86d13a8d`

```text
ok sigamos con

* lectura de documentos (hoy son trucos en el nombre del archivo);
```

## Entrada 57

Fecha: 2026-10-17 05:09:18 UTC · Sesiones: `347dd228`, `86d13a8d`

```text
creame un archivo claude.md con todo el contexto del proyecto
```

## Entrada 58

Fecha: 2026-10-17 05:11:47 UTC · Sesiones: `347dd228`, `86d13a8d`

```text
ya puse la gemini api key
```

## Entrada 59

Fecha: 2026-10-17 05:12:59 UTC · Sesiones: `347dd228`, `86d13a8d`

```text
Ya puse una GEMINI_API_KEY nueva en el .env, prueba de nuevo.
```

## Entrada 60

Fecha: 2026-10-17 05:23:58 UTC · Sesiones: `347dd228`, `86d13a8d`

```text
Sí, haz el commit en main del lector de QR, la lectura con Gemini y el CLAUDE.md.
```

## Entrada 61

Fecha: 2026-10-17 05:24:26 UTC · Sesiones: `347dd228`, `86d13a8d`

```text
Sí, haz push de main al remoto.
```

## Entrada 62

Fecha: 2026-10-17 05:27:45 UTC · Sesiones: `347dd228`

```text
ahora lo siguiente

minimo el  acreditado debe de tomar 2 cuotas y se paga cada 30 dias en vez de cada quincena
```

## Entrada 63

Fecha: 2026-10-17 05:29:15 UTC · Sesiones: `86d13a8d`

```text
ahora lo siguiente

minimo el  acreditado debe de tomar 2 cuotas y se paga cada 15 dias en vez de cada quincena
```

## Entrada 64

Fecha: 2026-10-17 06:50:07 UTC · Sesiones: `86d13a8d`

```text
mientras estabas recuperandote de tokens estaba terminando algunas cosas, analiza los cambios que he hecho y dime si estan bien o nao
```

## Entrada 65

Fecha: 2026-10-17 06:52:52 UTC · Sesiones: `86d13a8d`

```text
Corrige los problemas que encontraste: separa el plazo del inversionista, reentrena el ML con los nuevos plazos y arregla la verificación facial (bloqueo real, captura de frente, sin rechazo automático hasta calibrar y alternativa sin cámara).
```

## Entrada 66

Fecha: 2026-10-17 07:02:29 UTC · Sesiones: `86d13a8d`

```text
Sí, haz el commit en main de la verificación facial, los nuevos plazos y las correcciones.
```

## Entrada 67

Fecha: 2026-10-17 07:02:53 UTC · Sesiones: `86d13a8d`

```text
Sí, haz push de main al remoto.
```

## Entrada 68

Fecha: 2026-10-17 07:05:03 UTC · Sesiones: `86d13a8d`

```text
entonces que cosas faltan? en inversor y en acreditado
```

## Entrada 69

Fecha: 2026-10-17 07:05:42 UTC · Sesiones: `86d13a8d`

```text
* Confirmar que llegó la plata completa. Hoy la inversión y el retiro se dan por buenos cuando el pago queda completado. Falta revisar el cobro del lado de quien recibe (el incoming payment) para confirmar que llegó el monto entero, y cerrarlo en los retiros.
* Comprobantes en PDF de cada aporte y cada retiro, con la cotización usada.
* Datos de demo precargados: cajitas con aportes de distintas fechas, para que en el pitch se vea el interés acumulado y los aportes ya vencidos.


realiza entonces esos
```

## Entrada 70

Fecha: 2026-10-17 07:16:13 UTC · Sesiones: `86d13a8d`

```text
1 la inversion dura un anio, y si el inversionista se quiere retirar lo maximo que puede sacar es el 50%
```

## Entrada 71

Fecha: 2026-10-17 07:18:22 UTC · Sesiones: `86d13a8d`

```text
Sí, haz el commit en main: confirmación del cobro, comprobantes PDF, demo precargada y plazo de un año.
```

## Entrada 72

Fecha: 2026-10-17 07:19:03 UTC · Sesiones: `86d13a8d`

```text
Sí, haz push de main al remoto.
```

## Entrada 73

Fecha: 2026-10-17 07:19:31 UTC · Sesiones: `86d13a8d`

```text
entonces que cosas faltan? en inversor y en acreditado
```

## Entrada 74

Fecha: 2026-10-17 07:21:22 UTC · Sesiones: `86d13a8d`

```text
Plan de pagos y comprobantes en PDF: desembolso, cada abono y paz y salvo. El generador de PDF ya existe, así que es rápido.
```

## Entrada 75

Fecha: 2026-10-17 07:29:38 UTC · Sesiones: `86d13a8d`

```text
Sí, haz el commit en main del plan de pagos, los comprobantes del acreditado y el paz y salvo.
```

## Entrada 76

Fecha: 2026-10-17 07:29:49 UTC · Sesiones: `86d13a8d`

```text
Sí, haz push de main al remoto.
```

## Entrada 77

Fecha: 2026-10-17 07:33:27 UTC · Sesiones: `86d13a8d`

```text
entonces que cosas faltan? en inversor y en acreditado
```

## Entrada 78

Fecha: 2026-10-17 07:34:17 UTC · Sesiones: `86d13a8d`

```text
hay que tener en cuenta que esto es una demo

<pasted_content id="3e15">
Verificación facial:

* Ajustar los umbrales probando con personas reales.
* Pasar la prueba de vida al servidor o a un proveedor. Hoy se calcula en el navegador y el servidor confía en lo que este le envía.
</pasted_content id="3e15">

se puede descartar

* https en desarrollo, para que la cámara en vivo funcione en el celular.

ya realize eso, si puedes revisa si quedo bien
```

## Entrada 79

Fecha: 2026-10-17 07:36:44 UTC · Sesiones: `86d13a8d`

```text
Ya reinicié npm run dev:https, comprueba que ya no bloquee la IP.
```

## Entrada 80

Fecha: 2026-10-17 07:39:35 UTC · Sesiones: `86d13a8d`

```text
Sí, haz el commit en main de allowedDevOrigins y la documentación.
```

## Entrada 81

Fecha: 2026-10-17 07:40:07 UTC · Sesiones: `86d13a8d`

```text
Sí, haz push de main al remoto.
```

## Entrada 82

Fecha: 2026-10-17 07:41:38 UTC · Sesiones: `86d13a8d`

```text
el inversor antes de realizar una inversion puede agregar una  opcion de Recurring Grant, para que cada mes se le descuente esa misma cantidad cada mes
```

## Entrada 83

Fecha: 2026-10-17 07:51:00 UTC · Sesiones: `86d13a8d`

```text
Sí, haz el commit en main de la inversión recurrente.
```

## Entrada 84

Fecha: 2026-10-17 07:51:13 UTC · Sesiones: `86d13a8d`

```text
Sí, haz push de main al remoto.
```

## Entrada 85

Fecha: 2026-10-17 07:51:44 UTC · Sesiones: `86d13a8d`

```text
entonces que cosas faltan? en inversor y en acreditado
```

## Entrada 86

Fecha: 2026-10-17 08:01:33 UTC · Sesiones: `86d13a8d`

```text
ya le conseguimos nombre al proyecto "La Bodeguita"
```

## Entrada 87

Fecha: 2026-10-17 08:06:57 UTC · Sesiones: `86d13a8d`

```text
Sí, haz el commit en main del cambio de nombre a La Bodeguita.
```

## Entrada 88

Fecha: 2026-10-17 08:07:30 UTC · Sesiones: `86d13a8d`

```text
Sí, haz push de main al remoto.
```

## Entrada 89

Fecha: 2026-10-17 08:07:44 UTC · Sesiones: `86d13a8d`

````text
<pasted_content id="3e15">
# Decisiones del área financiera (para el ingeniero)

17 de octubre de 2026. Responde los pendientes de `CLAUDE.md` marcados como "Espera al área financiera" y agrega las tasas de los inversionistas.

**Principio del equipo: mantenerlo simple.** El código cierra hoy a las 11:00. Cada punto dice si **se implementa** o si **solo va en el pitch**.

| # | Tema | Qué hacer en el código |
|---|---|---|
| 1 | Pérdidas por impagos | Cambiar textos a "rentabilidad esperada". Lo demás, solo pitch |
| 2 | Mora, cobranza y nivel | **Implementar el cambio de nivel** (ver `Reglas_cambio_de_nivel.md`). Sin interés de mora |
| 3 | Pago anticipado | **No se permite** en el MVP. Nada que implementar |
| 4 | Usura y contrato | Agregar la pregunta "destino del crédito" y una pantalla "Acepto" simulada |
| 5 | Tasas de inversionistas, encaje y comisión | **Actualizar `config.ts`** |
| 6 | Reporte a centrales de riesgo a los 90 días | **Implementar como simulación**: aviso previo y pantalla de reporte, sin enviar nada |

---

## 1. Quién asume las pérdidas cuando un acreditado no paga

**Decisión:**
- **Cada nivel tiene su propio pool.** Un impago del nivel 3 nunca afecta a los inversionistas del nivel 1 o 2.
- **Reserva para impagos por nivel.** De la tasa que paga el acreditado, una parte se guarda como reserva: **3 puntos en el nivel 1, 6 en el nivel 2 y 10 en el nivel 3** (es la pérdida esperada; supuesto para recalibrar con datos reales).
- **Orden en que se cubre una pérdida:**
  1. la reserva del nivel;
  2. si no alcanza, los inversionistas del pool de ese nivel, **a prorrata** de su saldo.
- **Un crédito se da por perdido (castigo) a los 90 días de mora.**

**Hoy la cajita rinde siempre, aunque haya créditos en mora.** Para el MVP se acepta así, pero con un cambio obligatorio de texto:
- En toda la app, **"rentabilidad esperada"**, nunca "garantizada" ni "fija". Por ejemplo: "Rentabilidad esperada 17,9 % E.A. Puede ser menor si los impagos superan la reserva del nivel."
- Motivo: prometerle al público un rendimiento garantizado sin licencia puede considerarse captación ilegal.

**Implementar hoy:** solo el cambio de textos. La reserva y el reparto de pérdidas quedan para después del hackatón; en el pitch se explican.

---

## 2. Intereses de mora, recordatorios, cobranza y bajada de nivel

**Decisión:**
- **Interés de mora: no en el MVP.**
- **Solicitud de pago con 3 días para pagar: sí** (ver 2.1).
- **Bajada y subida de nivel: sí.** Las reglas completas, la función de referencia y los casos de prueba están en **`Reglas_cambio_de_nivel.md`**. Resumen, según el peor atraso del último crédito (3 días de gracia):

| Peor atraso | Siguiente crédito |
|---|---|
| 0 a 3 días | Sube un nivel |
| 4 a 15 días | Se mantiene |
| 16 a 30 días | Baja un nivel |
| 31 a 89 días | Nivel 4 hasta ponerse al día; luego nivel 3 |
| 90 días o más | Nivel 4 y bloqueado 12 meses |

- **Cobranza:** solo recordatorios a la persona. **Nunca** contactar a las referencias ni a la familia para presionar (es lo que hace el gota a gota; además, la Ley 2300 de 2023 limita la cobranza). Solo pitch.

### 2.1 Solicitud de pago de cada cuota (3 días para pagar)

**La idea:** el día en que vence una cuota, la app le envía al acreditado una **solicitud de pago** (un cobro) por el valor de la cuota. Tiene **3 días** para pagarla. Si paga dentro de esos 3 días, la cuota cuenta como **pagada a tiempo**. Si al terminar el día 3 no la ha pagado completa, la cuota pasa a **mora**.

**Estados de cada cuota:**

| Estado | Cuándo | Qué ve el acreditado |
|---|---|---|
| `PENDIENTE` | Antes de la fecha de vencimiento | La cuota en su plan de pagos |
| `POR_PAGAR` | Desde el día del vencimiento hasta el final del día 3 | La solicitud de pago activa: valor, llave `@kratosboveda` y "Tienes hasta el DD/MM para pagar" |
| `PAGADA` | Se completó el pago dentro de los 3 días | "Cuota pagada a tiempo" |
| `EN_MORA` | Desde el día 4 sin haber pagado completo | "Tu cuota está en mora desde el DD/MM" |
| `PAGADA_CON_MORA` | Se completó el pago estando en mora | "Cuota pagada con N días de atraso" |

**En el MVP la solicitud de pago es SIMULADA:** vive dentro de la app y del simulador de pagos Bre-B de `/mi-credito`. No se crea nada en la Test Wallet ni en Open Payments. Rotularla en pantalla como "Pago simulado" igual que el resto de los pagos del acreditado.

**Reglas para el código:**
- La solicitud se crea en el **servidor** el día del vencimiento, según el reloj de la demo (`now(db)`), y **vence a los 3 días**.
- **Los días de mora se cuentan desde la fecha de vencimiento de la cuota**, no desde que terminan los 3 días. Si paga el día 10, son 10 días de atraso. Es la misma cuenta que usa `Reglas_cambio_de_nivel.md`, donde de 0 a 3 días se considera "a tiempo".
- **Abono parcial dentro de los 3 días:** se aplica a la cuota (como ya hace la app). Si al terminar el día 3 falta plata, la cuota pasa a `EN_MORA` por el saldo que falta.
- Cuando la cuota pasa a `EN_MORA`, la solicitud de pago **sigue activa** con el saldo pendiente. Solo cambia el estado.
- El plazo de 3 días va en `config.ts` (por ejemplo `DIAS_PARA_PAGAR_CUOTA: 3`).

**Mensajes (con `notifications.ts`):**

| Momento | Mensaje |
|---|---|
| 2 días antes del vencimiento | "Tu cuota de $X vence el DD/MM." |
| Día del vencimiento | "Ya puedes pagar tu cuota de $X. Tienes hasta el DD/MM." (se crea la solicitud) |
| Día 2 | "Mañana es el último día para pagar tu cuota sin entrar en mora." |
| Día 4 | "Tu cuota está en mora. Págala lo antes posible para no bajar de nivel." |
| Días 7 y 15 | Recordatorio del saldo en mora |
| Día 70 | Aviso previo de reporte a centrales de riesgo (sección 5) |

**Para el pitch:** en producción, si el acreditado tiene una billetera con Open Payments, esta solicitud sería un **pago entrante** (`incoming-payment`) en la wallet de la bóveda, con `incomingAmount` igual a la cuota y `expiresAt` a los 3 días. Es exactamente el patrón de "cobro con vencimiento" de Open Payments. En el MVP la solicitud vive dentro del simulador de pagos Bre-B.

---

## 3. Pago anticipado con descuento de intereses

**Decisión: no se permite en el MVP.** No implementar nada.

Si el jurado pregunta: "En producción se permitirá sin multa, como exige la ley; con el sistema francés solo se cobran los intereses causados hasta ese día."

---


---

## 4. Tasas de los inversionistas, encaje y comisión de la plataforma

**Decisión (aprobada por el equipo):**

- **Encaje (reserva de liquidez) del 15 %.** El 85 % de cada pool se presta y el 15 % queda disponible para los retiros de los inversionistas. No se invierte en nada.
- **Las tasas del acreditado no cambian:** 24 %, 30 % y 36 % E.A.
- **Comisión de la plataforma: 3 puntos** de la tasa del acreditado, sobre la plata prestada. Sale de los intereses, nunca se cobra aparte.
- **Tasa al inversionista = 85 % × (tasa del acreditado − reserva para impagos − comisión).**

| Nivel | Tasa del acreditado | Reserva impagos | Comisión plataforma | Queda sobre lo prestado | × 85 % prestado | **Rentabilidad esperada del inversionista** |
|---|---|---|---|---|---|---|
| 1 | 24 % | 3 | 3 | 18 % | 15,3 % | **15,3 % E.A.** |
| 2 | 30 % | 6 | 3 | 21 % | 17,85 % | **17,9 % E.A.** |
| 3 | 36 % | 10 | 3 | 23 % | 19,55 % | **19,6 % E.A.** |

**Referencia para el pitch:** un CDT a 90 días rinde ≈ 10,4 % E.A. (promedio del sistema, septiembre de 2026) y las cajitas de Nu ≈ 12 % (verificar). El inversionista gana de 4,9 a 9,2 puntos más, como premio por el riesgo.

**Retiros cuando no alcanza el encaje:** si los retiros anticipados superan el 15 % disponible, se pagan **en orden de llegada** a medida que entran las cuotas. El sistema ya saca primero los retiros de los aportes vencidos, lo que ayuda.

**Valores para `config.ts`:**

```ts
// Área financiera, 17-oct-2026
ENCAJE: 0.15,                       // 15 % del pool no se presta
COMISION_PLATAFORMA_PUNTOS: 0.03,   // 3 puntos de la tasa del acreditado
RESERVA_IMPAGOS: { 1: 0.03, 2: 0.06, 3: 0.10 },
TASA_INVERSIONISTA_EA: { 1: 0.153, 2: 0.179, 3: 0.196 }, // "rentabilidad esperada", no garantizada
// Tasas del acreditado sin cambios: 24 %, 30 %, 36 % E.A.
```

*(Los nombres son sugeridos: usar los que ya tenga `config.ts`.)*

---

## 5. Reporte a centrales de riesgo (simulado)

**Decisión:** si una persona llega a **90 días de mora**, la app muestra una **simulación del reporte negativo** a una central de riesgo (como Datacrédito o TransUnion). **No se envía nada a ninguna central:** Kratos no tiene convenio con ellas y todo es demo.

**Por qué suma en el pitch:** cierra el ciclo del historial. Quien paga bien construye historial positivo (sube de nivel); quien no paga tiene una consecuencia formal, como en el sistema financiero, y no la "cobranza" del gota a gota.

### Línea de tiempo (con el reloj de la demo, `now(db)`)

| Día de mora | Qué pasa en la app |
|---|---|
| **70** | **Aviso previo** al acreditado (notificación y mensaje en `/mi-credito`): "Tienes una cuota con 70 días de atraso. Si no te pones al día en los próximos 20 días, tu deuda será reportada a las centrales de riesgo." |
| **90** | **Reporte simulado:** el crédito pasa a **castigado**, la persona queda en **nivel 4 con bloqueo de 12 meses** (ver `Reglas_cambio_de_nivel.md`) y se genera el registro del reporte. El operador lo ve en `/boveda` y el acreditado en `/mi-credito` |
| **Paga después del reporte** | El reporte se **actualiza a "obligación pagada"** (simulado). El bloqueo de 12 meses se mantiene |

**Por qué el aviso es el día 70:** la Ley 1266 de 2008 (habeas data financiero) exige avisarle al titular **20 días calendario antes** de un reporte negativo. Verificar el artículo exacto antes del pitch.

### Qué contiene el reporte (solo lo necesario)

| Campo | Ejemplo |
|---|---|
| Nombre del titular | (de la cuenta demo) |
| Tipo y número de documento | (de la cuenta demo) |
| Número de la obligación | ID del crédito en Kratos |
| Tipo de obligación | Microcrédito productivo |
| Fecha de desembolso | 2026-10-17 |
| Monto desembolsado | $1.000.000 |
| Saldo en mora | Capital pendiente de las cuotas vencidas |
| Días de mora | 90 |
| Fecha del aviso previo | Día 70 de mora |
| Fecha del reporte | Día 90 de mora |
| Estado | "En mora" o "Pagada después de mora" |

**No incluir:** las referencias, los documentos del estudio, la llave Bre-B ni las respuestas de la prueba de personalidad. Solo datos de la obligación (principio de minimización de la Ley 1581).

### Reglas para el código

- **Rótulo obligatorio y visible:** "SIMULACIÓN: este reporte no se envía a ninguna central de riesgo."
- Generarlo en el **servidor** cuando el crédito cumple 90 días de mora según `now(db)`; guardarlo en `db.json` junto al crédito, con fecha del aviso y fecha del reporte.
- En `/boveda` (operador): lista de reportes simulados con el estado de cada uno.
- En `/mi-credito` (acreditado): el aviso del día 70 y, si aplica, el reporte con su estado.
- **Solo con datos de las cuentas demo.** No usar datos de personas reales.
- **Autorización:** el texto de autorización del registro o del estudio debe decir que, si no paga, sus datos de la obligación pueden reportarse a centrales de riesgo (Ley 1266 de 2008). Revisar que ya lo diga y, si no, agregarlo.

### Para el pitch
- En producción, Kratos firmaría convenio con una central de riesgo como **fuente de información**, y también reportaría el **historial positivo** de quien paga bien. Así el acreditado no solo construye nivel dentro de Kratos, sino historial en todo el sistema financiero, que es la verdadera inclusión.
- Mencionar que la permanencia del dato negativo tiene límites legales (Ley 2157 de 2021, "borrón y cuenta nueva"; verificar los plazos exactos).

---

## Para el pitch (resumen)

1. **Pérdidas:** cada nivel tiene su propio pool, y una reserva con parte de los intereses cubre los primeros impagos.
2. **Mora:** sin cobranza agresiva; quien se atrasa baja de nivel y quien paga bien sube, y así construye su historial crediticio.
3. **Legal:** es crédito productivo; todas las tasas están por debajo del tope de usura y no hay comisiones ocultas.
4. **Inversionista:** rentabilidad esperada de 15,3 % a 19,6 % E.A., frente a ≈ 10,4 % de un CDT, con el 15 % del pool como reserva de liquidez.
5. **Consecuencia formal:** a los 90 días de mora, con aviso previo, la deuda se reporta a las centrales de riesgo (simulado en la demo). En producción también se reportaría el historial positivo.
</pasted_content id="3e15">

esto me dijo el area financiera
````

## Entrada 90

Fecha: 2026-10-17 08:25:12 UTC · Sesiones: `86d13a8d`

```text
Sí, haz el commit en main con las decisiones del área financiera.
```

## Entrada 91

Fecha: 2026-10-17 08:25:38 UTC · Sesiones: `86d13a8d`

```text
Sí, haz push de main al remoto.
```

## Entrada 92

Fecha: 2026-10-17 08:26:06 UTC · Sesiones: `86d13a8d`

```text
entonces que cosas faltan? en inversor y en acreditado
```

## Entrada 93

Fecha: 2026-10-17 08:30:36 UTC · Sesiones: `86d13a8d`

```text
que recomiendas para esto?

* Que la base no arranque vacía. Si data/db.json existe pero no se puede leer, la app arranca con una base vacía y la siguiente escritura borra todo. Además, el archivo se escribe directo, sin archivo temporal. Es el único riesgo técnico que queda para la demo en vivo.



que lo conectemos a una base de datos de vercel? o docker? o que recomendas?
```

## Entrada 94

Fecha: 2026-10-17 08:31:35 UTC · Sesiones: `86d13a8d`

```text
como tal no me piden desplegarla, pero si tenia pensado el tema de la base de datos, pero como tal solo nos faltaria eso, migrar la base de datos y probar la aplicacion
```

## Entrada 95

Fecha: 2026-10-17 08:36:26 UTC · Sesiones: `86d13a8d`

```text
tengo 2 dudas

1 si se implemento una opcion o algo de que la persona solicite su puntaje crediticio?
2 si se implemento lo del request de los 3 dias y si no paga queda en mora?
```

## Entrada 96

Fecha: 2026-10-17 08:38:05 UTC · Sesiones: `86d13a8d`

```text
1 bueno entonces implementar una opcion para solicitar un certificado de historial crediticio en PDF
```

## Entrada 97

Fecha: 2026-10-17 08:42:17 UTC · Sesiones: `86d13a8d`
Adjuntos: 1 imagen(es), no incluidas en este registro.

```text
pero algo mas asi, y que obviamente tenga sus explicaciones y aja
```

## Entrada 98

Fecha: 2026-10-17 08:43:26 UTC · Sesiones: `86d13a8d`
Adjuntos: 1 imagen(es), no incluidas en este registro.

```text
pero me refiero para el diseno del pdf del historial crediticio
```

## Entrada 99

Fecha: 2026-10-17 08:47:35 UTC · Sesiones: `86d13a8d`

```text
Sí, haz el commit en main solo con los archivos del certificado y el velocímetro.
```

## Entrada 100

Fecha: 2026-10-17 08:48:14 UTC · Sesiones: `86d13a8d`

```text
Sí, haz push de main al remoto.
```

## Entrada 101

Fecha: 2026-10-17 08:52:44 UTC · Sesiones: `86d13a8d`

```text
que cosas falta?
```

## Entrada 102

Fecha: 2026-10-17 12:22:09 UTC · Sesiones: `86d13a8d`

```text
ahora realiza lo siguiente

como tal mientras descansabas actualize bastante el proyecto, ahora toca mejorar la vista del admin, seguir con las cosas que tenemos, pero tambien mejorar temas de trazabilidad y las demas cosas que debe de gestionar el admin
```

## Entrada 103

Fecha: 2026-10-17 12:49:10 UTC · Sesiones: `86d13a8d`

```text
en la categoria de /credito agregar tamnbien tipo, gastos del hogar o algo no solamente para negocios si no q tambien para las personas del diario comun
```

## Entrada 104

Fecha: 2026-10-17 12:53:24 UTC · Sesiones: `86d13a8d`

```text
Sí, haz el commit en main del panel del operador, la bitácora y los destinos del crédito.
```

## Entrada 105

Fecha: 2026-10-17 12:53:56 UTC · Sesiones: `86d13a8d`

```text
Sí, haz push de main al remoto.
```

## Entrada 106

Fecha: 2026-10-17 12:58:01 UTC · Sesiones: `86d13a8d`

```text
agrega nuevos prestamos y nuevos inversores, realizar un flujo que se encuentre bien estructurado y como si fuera un dia promedio
```

## Entrada 107

Fecha: 2026-10-17 13:07:08 UTC · Sesiones: `86d13a8d`

```text
Sí, haz el commit en main del día de demo.
```

## Entrada 108

Fecha: 2026-10-17 13:07:22 UTC · Sesiones: `86d13a8d`

```text
Sí, haz push de main al remoto.
```

## Nota sobre redacciones

Para publicar el registro se reemplazaron, con marcas `[REDACTADO: …]`:
- la llave y el identificador de la API de producción de Wompi que el equipo pegó en una conversación (deben rotarse si el chat se compartió);
- el contenido completo de QR Bre-B reales pegados para probar el lector, porque incluyen llaves (celular, correo o alias) de personas.

Entradas con redacción: 20, 52, 53. Los originales quedan solo en el registro local privado.
