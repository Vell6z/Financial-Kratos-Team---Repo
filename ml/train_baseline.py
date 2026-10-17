"""Modelo base de riesgo de crédito entrenado con el dataset sintético.

Solo usa la librería estándar de Python (no hay que instalar nada) para que cualquiera del equipo
pueda correrlo. Es una regresión logística: sirve de punto de partida y de vara para comparar.
Con pandas + scikit-learn / LightGBM deberían poder superarla.

Uso:  python3 ml/train_baseline.py
Sale: métricas en pantalla y ml/modelo/regresion_logistica.json (pesos para usarlos luego en la app).
"""

import csv
import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).parent
DATA = ROOT / "dataset" / "creditos_sinteticos.csv"
OUT = ROOT / "modelo" / "regresion_logistica.json"

# Columnas que NO pueden entrar al modelo
LEAKS = {  # se conocen después de prestar: son el resultado
    "cuotas_a_tiempo", "cuotas_tarde", "dias_mora_max", "total_pagado", "perdida", "incumplio",
}
IDS = {"id", "fecha_solicitud", "mes_solicitud", "particion", "grupo"}
PROTECTED = {"sexo"}  # no se usa para decidir; solo para revisar que el modelo no discrimine
RULES = {"puntaje_reglas", "nivel_reglas", "respaldo_pct", "alertas", "en_revision"}  # salida del cuestionario actual

CATEGORICAL = [
    "ciudad", "escolaridad", "sector", "gota_a_gota", "variabilidad", "antiguedad_actividad", "servicios",
    "arriendo", "plan_celular", "natillera", "compras_credito", "antiguedad_vivienda", "lugar_trabajo",
    "celular_propio", "preferencia_tiempo",
]
RELATIONS = ["Proveedor", "Cliente frecuente", "Administradora de la natillera", "Arrendador", "Líder comunitario", "Otro"]


def number(v, default=0.0):
    return float(v) if v not in ("", None) else default


def features(r):
    """Convierte una fila en un diccionario de variables numéricas (lo mismo que se haría en producción)."""
    f = {}
    income = number(r["ingreso_declarado"])
    extract = number(r["ingreso_extracto"])
    f["log_ingreso_declarado"] = math.log1p(income)
    f["gastos_sobre_ingreso"] = number(r["gastos_declarados"]) / income
    f["deudas_sobre_ingreso"] = number(r["deudas_declaradas"]) / income
    f["margen_declarado"] = number(r["disponible_declarado"]) / income
    f["tiene_extracto"] = 1.0 if extract else 0.0
    # Cuánto infló el ingreso frente al extracto (0 si no hay extracto)
    f["ingreso_vs_extracto"] = math.log(income / extract) if extract else 0.0
    for col in ["edad", "estrato", "personas_a_cargo", "referencias", "referencias_confirmadas",
                "doc_extracto", "doc_factura", "doc_arriendo", "doc_recargas", "doc_libreta", "doc_pazysalvo",
                "factura_con_mora", "doc_alterado"]:
        f[col] = number(r[col])
    for i in range(1, 12):
        f[f"likert_{i}"] = number(r[f"likert_{i}"])
    f["log_antiguedad_linea"] = math.log1p(number(r["antiguedad_linea_meses"]))
    f["log_recargas_mes"] = math.log1p(number(r["recargas_mes"]))
    f["log_transacciones_billetera"] = math.log1p(number(r["transacciones_billetera_mes"]))
    # Condiciones del crédito (se conocen al aprobar)
    f["log_monto"] = math.log1p(number(r["monto"]))
    f["cuotas"] = number(r["cuotas"])
    f["tasa_ea"] = number(r["tasa_ea"])
    f["cuota_sobre_disponible"] = min(3.0, number(r["cuota_sobre_disponible"], 3.0))
    f["cuota_sobre_ingreso"] = number(r["valor_cuota"]) * 2 / income
    for col in CATEGORICAL:
        f[f"{col}={r[col]}"] = 1.0
    relations = r["referencias_relaciones"].split("|") if r["referencias_relaciones"] else []
    for rel in RELATIONS:
        f[f"ref_{rel}"] = float(relations.count(rel))
    return f


def auc(y, p):
    """Área bajo la curva ROC (probabilidad de que un incumplido tenga más riesgo que un cumplido)."""
    pairs = sorted(zip(p, y))
    ranks, i = [0.0] * len(pairs), 0
    while i < len(pairs):
        j = i
        while j + 1 < len(pairs) and pairs[j + 1][0] == pairs[i][0]:
            j += 1
        for k in range(i, j + 1):
            ranks[k] = (i + j) / 2 + 1
        i = j + 1
    pos = sum(y)
    neg = len(y) - pos
    rank_sum = sum(rk for rk, (_, yy) in zip(ranks, pairs) if yy == 1)
    return (rank_sum - pos * (pos + 1) / 2) / (pos * neg)


def ks(y, p):
    """Máxima separación entre la distribución de buenos y malos (métrica clásica de scoring)."""
    pos = sum(y)
    neg = len(y) - pos
    tp = fp = best = 0
    for _, yy in sorted(zip(p, y), reverse=True):
        tp += yy
        fp += 1 - yy
        best = max(best, abs(tp / pos - fp / neg))
    return best


def train_logistic(X, y, l2=1.0, epochs=60, lr=0.05, seed=7):
    """Regresión logística con descenso de gradiente por mini-lotes y regularización L2."""
    rng = random.Random(seed)
    n, d = len(X), len(X[0])
    w, b = [0.0] * d, math.log(sum(y) / (n - sum(y)))
    idx = list(range(n))
    for epoch in range(epochs):
        rng.shuffle(idx)
        step = lr / (1 + epoch * 0.05)
        for start in range(0, n, 64):
            batch = idx[start:start + 64]
            gw, gb = [0.0] * d, 0.0
            for i in batch:
                xi = X[i]
                z = b + sum(wj * xj for wj, xj in zip(w, xi))
                err = 1 / (1 + math.exp(-max(-30, min(30, z)))) - y[i]
                gb += err
                for j, xj in enumerate(xi):
                    if xj:
                        gw[j] += err * xj
            m = len(batch)
            b -= step * gb / m
            for j in range(d):
                w[j] -= step * (gw[j] / m + l2 * w[j] / n)
    return w, b


def main():
    with DATA.open(encoding="utf-8") as fh:
        rows = [r for r in csv.DictReader(fh) if r["incumplio"] != ""]  # solo los que recibieron crédito
    for r in rows:
        r["_f"] = features(r)
    names = sorted({k for r in rows for k in r["_f"]})
    train = [r for r in rows if r["particion"] == "train"]
    valid = [r for r in rows if r["particion"] == "valid"]
    test = [r for r in rows if r["particion"] == "test"]

    # Estandarizar con media y desviación del entrenamiento
    mean = {k: sum(r["_f"].get(k, 0) for r in train) / len(train) for k in names}
    std = {k: math.sqrt(sum((r["_f"].get(k, 0) - mean[k]) ** 2 for r in train) / len(train)) or 1 for k in names}
    matrix = lambda part: [[(r["_f"].get(k, 0) - mean[k]) / std[k] for k in names] for r in part]
    label = lambda part: [int(r["incumplio"]) for r in part]

    Xtr, ytr = matrix(train), label(train)
    Xva, yva = matrix(valid), label(valid)
    predict = lambda X, w, b: [1 / (1 + math.exp(-max(-30, min(30, b + sum(a * c for a, c in zip(w, x)))))) for x in X]

    # Elegir la regularización con el conjunto de validación
    best = None
    for l2 in [0.3, 3, 30, 300]:
        w, b = train_logistic(Xtr, ytr, l2=l2)
        score = auc(yva, predict(Xva, w, b))
        print(f"  L2={l2:<5} AUC validación {score:.3f}")
        if not best or score > best[0]:
            best = (score, l2, w, b)
    _, l2, w, b = best

    # Reentrenar con train + valid y medir una sola vez en test (meses más recientes)
    w, b = train_logistic(Xtr + Xva, ytr + yva, l2=l2)
    Xte, yte = matrix(test), label(test)
    p_ml = predict(Xte, w, b)
    p_rules = [-float(r["puntaje_reglas"]) for r in test]  # menos puntaje = más riesgo

    print(f"\nPrueba: {len(test)} créditos de jul-sep 2026, incumplimiento real {sum(yte) / len(yte):.1%}")
    print(f"{'':24}{'AUC':>7}{'Gini':>7}{'KS':>7}")
    for name, p in [("Cuestionario (reglas)", p_rules), ("Regresión logística", p_ml)]:
        a = auc(yte, p)
        print(f"{name:24}{a:7.3f}{2 * a - 1:7.3f}{ks(yte, p):7.3f}")

    # ¿Cuánta mora se evita aprobando el mismo número de personas?
    print("\nSi aprobamos solo al 70 % de menor riesgo:")
    for name, p in [("Cuestionario (reglas)", p_rules), ("Regresión logística", p_ml)]:
        keep = sorted(zip(p, yte))[: int(len(yte) * 0.7)]
        print(f"  {name:22} incumplimiento de los aprobados {sum(y for _, y in keep) / len(keep):.1%}")

    print("\nIncumplimiento real por quintil de riesgo del modelo (1 = menor riesgo):")
    ranked = sorted(zip(p_ml, yte))
    size = len(ranked) // 5
    for q in range(5):
        chunk = ranked[q * size:(q + 1) * size if q < 4 else None]
        print(f"  Q{q + 1}: prob. media {sum(p for p, _ in chunk) / len(chunk):.1%} · real {sum(y for _, y in chunk) / len(chunk):.1%}")

    print("\nRevisión de equidad (el sexo NO entra al modelo):")
    for sex in ["F", "M"]:
        group = [(p, y) for p, y, r in zip(p_ml, yte, test) if r["sexo"] == sex]
        print(f"  {sex}: {len(group)} créditos · riesgo medio predicho {sum(p for p, _ in group) / len(group):.1%} · real {sum(y for _, y in group) / len(group):.1%}")

    print("\nLo que más pesa (coeficientes estandarizados):")
    for k, v in sorted(zip(names, w), key=lambda t: -abs(t[1]))[:15]:
        print(f"  {'↑ riesgo' if v > 0 else '↓ riesgo'}  {v:+.3f}  {k}")

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps({
        "tipo": "regresion_logistica",
        "objetivo": "incumplio (mora de 30 días o más)",
        "l2": l2,
        "intercepto": b,
        "variables": [{"nombre": k, "media": mean[k], "desviacion": std[k], "peso": wk} for k, wk in zip(names, w)],
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nPesos guardados en {OUT.relative_to(ROOT.parent)}")


if __name__ == "__main__":
    main()
