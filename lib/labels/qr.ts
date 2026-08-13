import * as qrCore from "qrcode/lib/core/qrcode.js";

const QR_OPTS = { errorCorrectionLevel: "M" as const };
const PRINT_MARGIN = 1;

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

/** Filled-rect SVG for print sheets. Ink is real paths, not an image URL. */
export function qrPrintSvg(value: string): string {
  const { size, dark } = qrMatrix(value);
  const dim = size + PRINT_MARGIN * 2;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="96" height="96" shape-rendering="crispEdges">`,
    `<rect width="${dim}" height="${dim}" fill="#ffffff"/>`,
  ];

  for (let row = 0; row < size; row++) {
    let run = 0;
    for (let col = 0; col <= size; col++) {
      const on = col < size && dark[row]?.[col];
      if (on) {
        run += 1;
        continue;
      }
      if (run > 0) {
        const x = col - run + PRINT_MARGIN;
        const y = row + PRINT_MARGIN;
        parts.push(
          `<rect x="${x}" y="${y}" width="${run}" height="1" fill="#000000"/>`,
        );
        run = 0;
      }
    }
  }

  parts.push("</svg>");
  return parts.join("");
}
