import * as qrCore from "qrcode/lib/core/qrcode.js";

/** High ECC so the circular Cubicle seal still reads in the PWA scanner. */
const QR_OPTS = { errorCorrectionLevel: "H" as const };
const PRINT_MARGIN = 1.25;

export type QrMatrix = {
  size: number;
  dark: boolean[][];
};

function createQr(value: string) {
  const text = value.trim();
  if (!text) throw new Error("No QR payload");
  const mod = qrCore as {
    create?: typeof qrCore.create;
    default?: { create?: typeof qrCore.create };
  };
  const create = mod.create ?? mod.default?.create;
  if (typeof create !== "function") {
    throw new Error("QR generator unavailable");
  }
  return create(text, QR_OPTS);
}

export function qrMatrix(value: string): QrMatrix {
  const qr = createQr(value);
  const size = qr.modules.size;
  const dark: boolean[][] = [];
  for (let row = 0; row < size; row++) {
    const line: boolean[] = [];
    for (let col = 0; col < size; col++) {
      line.push(qr.modules.get(row, col) === 1);
    }
    dark.push(line);
  }
  return { size, dark };
}

function inFinderBand(row: number, col: number, size: number): boolean {
  const inTop = row < 8;
  const inLeft = col < 8;
  const inBottom = row >= size - 8;
  const inRight = col >= size - 8;
  return (inTop && inLeft) || (inTop && inRight) || (inBottom && inLeft);
}

function finderOrigins(size: number): Array<{ x: number; y: number }> {
  return [
    { x: 0, y: 0 },
    { x: size - 7, y: 0 },
    { x: 0, y: size - 7 },
  ];
}

/**
 * Cubicle seal — constellation of dots + bullseye finders.
 * Standard QR bits underneath so our PWA scanner can still read them;
 * the signed payload is useless in Camera / third-party QR apps.
 */
export function cubicleMarkSvg(
  value: string,
  sizeAttr: string = "100%",
  margin: number = PRINT_MARGIN,
): string {
  const { size, dark } = qrMatrix(value);
  const dim = size + margin * 2;
  const ink = "#141414";
  const paper = "#ffffff";

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${sizeAttr}" height="${sizeAttr}" shape-rendering="geometricPrecision">`,
    `<rect width="${dim}" height="${dim}" fill="${paper}"/>`,
  ];

  for (const origin of finderOrigins(size)) {
    const x = origin.x + margin;
    const y = origin.y + margin;
    parts.push(
      `<rect x="${x}" y="${y}" width="7" height="7" rx="2.05" fill="${ink}"/>`,
      `<rect x="${x + 1.05}" y="${y + 1.05}" width="4.9" height="4.9" rx="1.45" fill="${paper}"/>`,
      `<circle cx="${x + 3.5}" cy="${y + 3.5}" r="1.52" fill="${ink}"/>`,
    );
  }

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!dark[row]?.[col]) continue;
      if (inFinderBand(row, col, size)) continue;
      const cx = col + margin + 0.5;
      const cy = row + margin + 0.5;
      parts.push(`<circle cx="${cx}" cy="${cy}" r="0.38" fill="${ink}"/>`);
    }
  }

  parts.push("</svg>");
  return parts.join("");
}

/** Same Cubicle seal as the QR tab, sized for the label sheet. */
export function qrPrintSvg(value: string): string {
  return cubicleMarkSvg(value, "128", 2);
}
