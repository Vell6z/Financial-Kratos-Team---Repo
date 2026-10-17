import "server-only";
import { APP_NAME } from "./config";
import { A4, buildPdf, hex, PdfPage, textWidth, wrap } from "./pdf";

// Diseño común de los documentos PDF de la plataforma (comprobantes, plan de pagos, paz y salvo):
// encabezado de marca, secciones con filas etiqueta → valor, tablas y pie de sandbox.

export const COLORS = {
  brand: hex("#80409d"),
  mint: hex("#1e9c80"),
  amber: hex("#b7791f"),
  red: hex("#c53030"),
  muted: hex("#6b6478"),
  line: hex("#e4dcea"),
  soft: hex("#f6f0fa"),
  white: hex("#ffffff"),
  text: hex("#1a1a1f"),
};

/** Fecha en hora de Colombia: "17 de octubre de 2026 a las 2:12 p. m." */
export const longDate = (ms: number, withTime = true) =>
  new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(ms);

/** "17 oct 2026", o "17 oct" sin el año */
export function shortDate(ms: number, withYear = true) {
  const parts = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "numeric" }).formatToParts(ms);
  const get = (type: string) => parts.find((p) => p.type === type)?.value.replace(".", "") ?? "";
  return [get("day"), get("month"), withYear ? get("year") : ""].filter(Boolean).join(" ");
}

const M = 48;
const W = A4.width - 2 * M;
/** Hasta dónde se escribe antes de pasar a otra página (deja espacio al pie) */
const BOTTOM = A4.height - 90;

type Color = (typeof COLORS)[keyof typeof COLORS];
export interface Column {
  label: string;
  /** Ancho relativo */
  width: number;
  align?: "left" | "right";
}

export class PdfDoc {
  private pages: PdfPage[] = [];
  private page!: PdfPage;
  y = 0;

  constructor(
    private readonly head: { title: string; number: string; date: number },
    private readonly now: number,
  ) {
    this.newPage();
  }

  private newPage() {
    this.page = new PdfPage();
    this.pages.push(this.page);
    const first = this.pages.length === 1;
    const h = first ? 96 : 56;
    this.page.rect(0, 0, A4.width, h, COLORS.brand);
    this.page.text(M, first ? 44 : 34, APP_NAME, { size: first ? 22 : 15, bold: true, color: COLORS.white });
    if (first) this.page.text(M, 66, this.head.title, { size: 12, color: COLORS.white });
    else this.page.text(M + textWidth(APP_NAME, 15, true) + 12, 34, this.head.title, { size: 10, color: COLORS.white });
    this.page.text(A4.width - M, first ? 44 : 34, this.head.number, { size: 10, bold: true, color: COLORS.white, align: "right" });
    if (first) this.page.text(A4.width - M, 62, longDate(this.head.date), { size: 9, color: COLORS.white, align: "right" });
    this.y = first ? 140 : 90;
  }

  /** Pasa de página si no caben `space` puntos más */
  ensure(space: number) {
    if (this.y + space > BOTTOM) this.newPage();
  }

  /** Monto grande con su etiqueta y un estado a la derecha */
  hero(label: string, value: string, status?: { label: string; color: Color }) {
    this.page.text(M, this.y, label, { size: 10, color: COLORS.muted });
    this.y += 30;
    this.page.text(M, this.y, value, { size: 26, bold: true });
    if (status) this.page.text(A4.width - M, this.y - 8, status.label, { size: 10, bold: true, color: status.color, align: "right" });
    this.y += 14;
  }

  /** Párrafo con salto de línea automático */
  paragraph(text: string, opts: { size?: number; color?: Color; bold?: boolean; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const lines = wrap(text, W, size, opts.bold);
    this.ensure(lines.length * (size + 4) + 6);
    this.y += opts.gap ?? 12;
    lines.forEach((l, i) => this.page.text(M, this.y + i * (size + 4), l, { size, color: opts.color, bold: opts.bold }));
    this.y += (lines.length - 1) * (size + 4);
  }

  section(title: string) {
    this.ensure(60);
    this.y += 30;
    this.page.text(M, this.y, title.toUpperCase(), { size: 8, bold: true, color: COLORS.brand });
    this.y += 8;
    this.page.line(M, this.y, M + W, this.y, COLORS.line);
    this.y += 4;
  }

  /** Fila etiqueta → valor (el valor a la derecha, en varias líneas si no cabe) */
  row(label: string, value: string, opts: { small?: boolean; bold?: boolean; color?: Color } = {}) {
    const size = opts.small ? 7.5 : 10;
    const lines = wrap(value, W * 0.62, size, opts.bold);
    this.ensure(16 + (lines.length - 1) * (size + 3));
    this.y += 16;
    this.page.text(M, this.y, label, { size: 9, color: COLORS.muted });
    lines.forEach((l, i) => this.page.text(M + W, this.y + i * (size + 3), l, { size, align: "right", bold: opts.bold, color: opts.color }));
    this.y += (lines.length - 1) * (size + 3);
  }

  /** Tabla con encabezado; repite el encabezado si pasa de página */
  table(columns: Column[], rows: { cells: string[]; color?: (Color | undefined)[]; bold?: boolean }[]) {
    const total = columns.reduce((s, c) => s + c.width, 0);
    const xs: number[] = [];
    let x = M;
    for (const c of columns) {
      xs.push(x);
      x += (c.width / total) * W;
    }
    const cellX = (i: number) => (columns[i].align === "right" ? xs[i] + (columns[i].width / total) * W - 4 : xs[i] + 4);
    const header = () => {
      this.y += 12;
      this.page.rect(M, this.y - 11, W, 16, COLORS.soft);
      columns.forEach((c, i) => this.page.text(cellX(i), this.y, c.label, { size: 8, bold: true, color: COLORS.muted, align: c.align }));
      this.y += 6;
    };
    this.ensure(40);
    header();
    for (const r of rows) {
      if (this.y + 16 > BOTTOM) {
        this.newPage();
        header();
      }
      this.y += 15;
      r.cells.forEach((cell, i) => this.page.text(cellX(i), this.y, cell, { size: 9, align: columns[i].align, color: r.color?.[i], bold: r.bold }));
      this.y += 4;
      this.page.line(M, this.y, M + W, this.y, COLORS.line, 0.3);
    }
  }

  /** Dibujo libre de `height` puntos de alto: recibe la página y la posición de arriba (pasa de página si no cabe) */
  draw(height: number, fn: (page: PdfPage, top: number, left: number, width: number) => void) {
    this.ensure(height);
    fn(this.page, this.y, M, W);
    this.y += height;
  }

  /** Firma o sello de texto al final (por ejemplo, del paz y salvo) */
  signature(name: string, role: string) {
    this.ensure(80);
    this.y += 60;
    this.page.line(M, this.y, M + 200, this.y, COLORS.text, 0.6);
    this.page.text(M, this.y + 14, name, { size: 10, bold: true });
    this.page.text(M, this.y + 27, role, { size: 9, color: COLORS.muted });
    this.y += 27;
  }

  build(fileTitle: string) {
    const total = this.pages.length;
    this.pages.forEach((page, i) => {
      const foot = A4.height - 60;
      page.line(M, foot, M + W, foot, COLORS.line);
      wrap(
        `${APP_NAME} es un MVP de hackathon: todo corre en entornos de prueba (Interledger y Bre-B simulados) y no representa dinero real. Documento generado el ${longDate(this.now)}`,
        W - 50,
        8,
      ).forEach((l, j) => page.text(M, foot + 16 + j * 11, l, { size: 8, color: COLORS.muted }));
      if (total > 1) page.text(M + W, foot + 16, `Página ${i + 1} de ${total}`, { size: 8, color: COLORS.muted, align: "right" });
    });
    return buildPdf(this.pages, { title: fileTitle });
  }
}
