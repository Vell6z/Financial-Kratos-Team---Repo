# Reglas de cambio de nivel (historial de pagos)

Definido por el área financiera el 17 de octubre de 2026. Es el "score crediticio" de Kratos: con cada crédito pagado, la persona construye historial y su nivel sube, se mantiene o baja para el **siguiente** crédito.

## 1. La idea en una frase

El estudio de crédito decide el nivel del **primer** crédito. Desde el segundo crédito manda **cómo pagó**: el historial reemplaza las declaraciones.

## 2. Conceptos

- **Atraso de una cuota:** días entre la fecha de vencimiento de la cuota y la fecha en que quedó **pagada completa**. Si hay abonos parciales, la cuota cuenta como pagada el día en que se completó.
- **Días de gracia:** 3. Una cuota pagada con 3 días de atraso o menos cuenta como **a tiempo**.
- **Peor atraso:** el mayor atraso entre todas las cuotas del crédito. Es lo único que mide la regla: **una sola cuota muy atrasada pesa más que varias poco atrasadas**.
- **Fecha de referencia:** la del reloj de la demo, `now(db)`, para poder mostrarlo adelantando el tiempo.

## 3. La regla

Se aplica **cuando el crédito termina de pagarse** (sube, se mantiene o baja). Las dos reglas de mora (más de 30 y 90 días) se aplican **en el momento** en que se cumplen, aunque el crédito siga abierto.

| Peor atraso del crédito | Resultado para el siguiente crédito | Ejemplo (estaba en nivel 2) |
|---|---|---|
| **0 a 3 días** (todo a tiempo) | **Sube un nivel** | Pasa a nivel 1 |
| **4 a 15 días** | **Se mantiene en el mismo nivel** | Sigue en nivel 2 |
| **16 a 30 días** | **Baja un nivel** | Pasa a nivel 3 |
| **31 a 89 días** | **Nivel 4: bloqueado** mientras deba. Cuando se pone al día, el siguiente crédito empieza en **nivel 3** | Bloqueado; al pagar todo, nivel 3 |
| **90 días o más** (impago) | **Nivel 4 y no puede volver a pedir en 12 meses**, aunque pague | Bloqueado 12 meses |

### Casos de borde

- **Ya está en nivel 1 y pagó todo a tiempo:** se mantiene en nivel 1. No hay un nivel mejor.
- **Está en nivel 3 y tuvo un atraso de 16 a 30 días:** se mantiene en nivel 3. No baja a nivel 4, porque el nivel 4 se reserva para la mora de más de 30 días. *(Decisión simple para el MVP; se puede revisar.)*
- **Varios créditos anteriores:** cuenta solo el **último** crédito cerrado. Así la regla es simple y la persona siempre puede recuperarse.

## 4. Qué ve la persona

En `/mi-credito`, y al terminar de pagar:

- **Va a subir:** "Vas pagando todo a tiempo. Si sigues así, tu próximo crédito será nivel X: más cupo y mejor tasa."
- **Se mantiene:** "Tuviste un atraso de N días. Tu próximo crédito sigue en nivel X. Paga todo a tiempo para subir."
- **Va a bajar:** "Tuviste un atraso de N días. Tu próximo crédito será nivel X."
- **Bloqueado (más de 30 días):** "Tienes cuotas con más de 30 días de atraso. Ponte al día para volver a pedir crédito."
- **Bloqueado 12 meses (90 días o más):** "Podrás volver a solicitar desde el DD/MM/AAAA."

Mensajes en español, claros y sin culpar.

## 5. Para el ingeniero

```ts
// Nivel del siguiente crédito según cómo pagó el último crédito.
// nivelActual: 1 | 2 | 3   ·   peorAtraso: días (0 si todo a tiempo)
function nivelSiguiente(nivelActual: 1 | 2 | 3, peorAtraso: number): { nivel: 1 | 2 | 3 | 4; bloqueoMeses: number } {
  if (peorAtraso >= 90) return { nivel: 4, bloqueoMeses: 12 }
  if (peorAtraso > 30) return { nivel: 4, bloqueoMeses: 0 } // hasta ponerse al día; luego nivel 3
  if (peorAtraso > 15) return { nivel: Math.min(nivelActual + 1, 3) as 1 | 2 | 3, bloqueoMeses: 0 } // baja (nivel 3 se queda en 3)
  if (peorAtraso > 3) return { nivel: nivelActual, bloqueoMeses: 0 } // se mantiene
  return { nivel: Math.max(nivelActual - 1, 1) as 1 | 2 | 3, bloqueoMeses: 0 } // sube (nivel 1 se queda en 1)
}
```

Notas:
- **Recordar:** número más bajo = mejor nivel. "Subir de nivel" es **restar 1**.
- Los umbrales (3, 15, 30, 90 días y 12 meses) van en `config.ts`, para cambiarlos sin tocar la lógica.
- Guardar en la base, por persona: el nivel actual, el peor atraso del último crédito cerrado y, si aplica, la fecha hasta la que está bloqueada.
- Para un cliente con historial, el nivel sale de esta regla y **no** del estudio. El cupo se sigue calculando con su capacidad de pago actual.
- **No implementar** en el MVP: interés de mora, acuerdos de pago ni pago anticipado (decisión del equipo).

### Casos de prueba

| Nivel actual | Peor atraso | Resultado esperado |
|---|---|---|
| 2 | 0 | Nivel 1 |
| 1 | 2 | Nivel 1 (ya es el mejor) |
| 3 | 3 | Nivel 2 (3 días es gracia: a tiempo) |
| 2 | 10 | Nivel 2 (se mantiene) |
| 1 | 15 | Nivel 1 (se mantiene) |
| 1 | 20 | Nivel 2 |
| 3 | 25 | Nivel 3 (no baja a 4) |
| 2 | 45 | Nivel 4, sin bloqueo de meses (al ponerse al día, nivel 3) |
| 1 | 120 | Nivel 4, bloqueado 12 meses |
