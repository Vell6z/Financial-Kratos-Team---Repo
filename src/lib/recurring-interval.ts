// Intervalos de las inversiones recurrentes, en formato ISO 8601 (el que usa Open Payments en los límites del grant).
// Compartido entre el navegador y el servidor.

/** Por defecto, un cobro al mes. En el servidor se puede cambiar con OP_RECURRING_INTERVAL (por ejemplo PT5M para la demo) */
export const DEFAULT_RECURRING_INTERVAL = "P1M";

interface Duration {
  years: number;
  months: number;
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const ISO_DURATION = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

/** "P1M" → { months: 1, … }. null si no es una duración válida o es cero */
export function parseDuration(iso: string): Duration | null {
  const m = ISO_DURATION.exec(iso.trim());
  if (!m || iso.trim() === "P" || iso.trim().endsWith("T")) return null;
  const [years, months, weeks, days, hours, minutes, seconds] = m.slice(1).map((v) => Number(v ?? 0));
  const d = { years, months, weeks, days, hours, minutes, seconds };
  return Object.values(d).some((v) => v > 0) ? d : null;
}

/** Suma `times` veces la duración a una fecha (en ms). Los meses se suman por calendario, sin acumular desfases */
export function addDuration(ms: number, iso: string, times = 1) {
  const d = parseDuration(iso);
  if (!d) throw new Error(`Intervalo inválido: ${iso}`);
  const date = new Date(ms);
  const day = date.getUTCDate();
  // Del 31 de enero + 1 mes pasa al 28 o 29 de febrero, no al 3 de marzo
  date.setUTCFullYear(date.getUTCFullYear() + d.years * times, date.getUTCMonth() + d.months * times, 1);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return (
    date.getTime() +
    times * (((d.weeks * 7 + d.days) * 24 + d.hours) * 3_600_000 + d.minutes * 60_000 + d.seconds * 1000)
  );
}

/** "P1M" → "cada mes"; "PT5M" → "cada 5 minutos" */
export function intervalLabel(iso: string) {
  const d = parseDuration(iso);
  if (!d) return iso;
  const parts: [number, string, string][] = [
    [d.years, "año", "años"],
    [d.months, "mes", "meses"],
    [d.weeks, "semana", "semanas"],
    [d.days, "día", "días"],
    [d.hours, "hora", "horas"],
    [d.minutes, "minuto", "minutos"],
    [d.seconds, "segundo", "segundos"],
  ];
  const used = parts.filter(([n]) => n > 0);
  if (used.length === 1 && used[0][0] === 1) return `cada ${used[0][1]}`;
  return `cada ${used.map(([n, one, many]) => `${n} ${n === 1 ? one : many}`).join(" y ")}`;
}
