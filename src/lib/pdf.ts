import "server-only";

// Generador mínimo de PDF (sin dependencias) para los comprobantes.
// Usa las fuentes estándar Helvetica y Helvetica-Bold con codificación WinAnsi (tildes y ñ incluidas).
// Coordenadas en puntos, con el origen ARRIBA a la izquierda (se convierten al sistema del PDF al dibujar).

export const A4 = { width: 595, height: 842 };

type Rgb = [number, number, number];

/** Color "#80409d" → componentes de 0 a 1 */
export const hex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb;

// Anchos de Helvetica y Helvetica-Bold (1/1000 del tamaño) para los caracteres 32 a 126
const REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584,
  556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278,
  469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260,
  334, 584,
];
const BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584,
  611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333,
  584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280,
  389, 584,
];

/** Caracteres fuera de Latin-1 que sí existen en WinAnsi, y reemplazos para los que no */
const WIN_ANSI: Record<string, string> = { "€": "\x80", "•": "\x95", "–": "\x96", "—": "\x97", "“": "\x93", "”": "\x94", "‘": "\x91", "’": "\x92", "…": "\x85" };
const FALLBACK: Record<string, string> = { "→": "->", "≈": "~", "✓": "", " ": " " };

/** Texto → bytes WinAnsi (como cadena latin1) */
function encode(text: string) {
  let out = "";
  for (const ch of text) {
    if (WIN_ANSI[ch]) out += WIN_ANSI[ch];
    else if (ch in FALLBACK) out += FALLBACK[ch];
    else if (ch.charCodeAt(0) <= 0xff) out += ch;
    else out += ch.normalize("NFD")[0].charCodeAt(0) <= 0xff ? ch.normalize("NFD")[0] : "?";
  }
  return out;
}

/** Ancho del texto en puntos */
export function textWidth(text: string, size: number, bold = false) {
  const table = bold ? BOLD : REGULAR;
  let w = 0;
  for (const ch of encode(text)) {
    const code = ch.charCodeAt(0);
    // Letras con tilde: el ancho de la letra base (aproximado)
    const base = code > 126 ? (ch.normalize("NFD")[0] ?? "a").charCodeAt(0) : code;
    w += table[base - 32] ?? 556;
  }
  return (w * size) / 1000;
}

/** Parte un texto en líneas que caben en `width` */
export function wrap(text: string, width: number, size: number, bold = false) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size, bold) <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
    // Palabras más largas que el ancho (URLs): se cortan por caracteres
    while (textWidth(line, size, bold) > width && line.length > 1) {
      let cut = line.length - 1;
      while (cut > 1 && textWidth(line.slice(0, cut), size, bold) > width) cut--;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line) lines.push(line);
  return lines;
}

const n = (v: number) => (Math.round(v * 100) / 100).toString();
const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

export class PdfPage {
  ops: string[] = [];
  constructor(readonly height = A4.height) {}

  text(x: number, y: number, text: string, opts: { size?: number; bold?: boolean; color?: Rgb; align?: "left" | "right" | "center" } = {}) {
    const size = opts.size ?? 10;
    const w = textWidth(text, size, opts.bold);
    const left = opts.align === "right" ? x - w : opts.align === "center" ? x - w / 2 : x;
    const [r, g, b] = opts.color ?? [0.1, 0.1, 0.12];
    // y es la línea base, medida desde arriba
    this.ops.push(`BT /${opts.bold ? "F2" : "F1"} ${n(size)} Tf ${n(r)} ${n(g)} ${n(b)} rg ${n(left)} ${n(this.height - y)} Td (${escape(encode(text))}) Tj ET`);
    return w;
  }

  rect(x: number, y: number, w: number, h: number, color: Rgb) {
    this.ops.push(`${n(color[0])} ${n(color[1])} ${n(color[2])} rg ${n(x)} ${n(this.height - y - h)} ${n(w)} ${n(h)} re f`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: Rgb, width = 0.5) {
    this.ops.push(`${n(color[0])} ${n(color[1])} ${n(color[2])} RG ${n(width)} w ${n(x1)} ${n(this.height - y1)} m ${n(x2)} ${n(this.height - y2)} l S`);
  }
}

/** Arma el archivo PDF con las páginas dibujadas */
export function buildPdf(pages: PdfPage[], info: { title: string }) {
  const objects: string[] = [];
  const add = (body: string) => objects.push(body); // devuelve el número de objeto (desde 1)
  const catalog = add(""); // se completa al final
  const pagesObj = add("");
  const fontRegular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontBold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const kids: number[] = [];
  for (const page of pages) {
    const content = page.ops.join("\n");
    const stream = add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    kids.push(
      add(
        `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${A4.width} ${page.height}] /Contents ${stream} 0 R /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> >>`,
      ),
    );
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  const infoObj = add(`<< /Title (${escape(encode(info.title))}) /Producer (Kratos) >>`);

  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R /Info ${infoObj} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Cada carácter es un byte (latin1): las posiciones del xref coinciden
  return Buffer.from(out, "latin1");
}
