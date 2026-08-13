import { format } from "date-fns";
import { escapePdfHtml, type OpenCorporatePdfResult } from "@/lib/export/corporate-pdf";
import { cartQrPayload, laptopQrPayload } from "@/lib/labels/codes";
import { qrDataUrl } from "@/lib/labels/qr";
import { laptopBrandLabel, type Cart } from "@/lib/types";

export type QrLabelKind = "cart" | "laptop";

export type QrLabel = {
  kind: QrLabelKind;
  title: string;
  subtitle: string;
  payload: string;
  src: string;
};

export function collectQrLabelSpecs(
  carts: Cart[],
  kind: "all" | "carts" | "laptops" = "all",
): Array<Omit<QrLabel, "src">> {
  const specs: Array<Omit<QrLabel, "src">> = [];
  for (const cart of carts) {
    const brand = cart.laptopBrand ? laptopBrandLabel(cart.laptopBrand) : "";
    const place = [cart.location, brand].filter(Boolean).join(" · ");
    if (kind !== "laptops") {
      specs.push({
        kind: "cart",
        title: cart.name,
        subtitle: place || "Laptop cart",
        payload: cartQrPayload(cart.id),
      });
    }
    if (kind !== "carts") {
      for (const code of cart.laptopCodes ?? []) {
        specs.push({
          kind: "laptop",
          title: code,
          subtitle: place ? `${cart.name} · ${place}` : cart.name,
          payload: laptopQrPayload(code),
        });
      }
    }
  }
  return specs;
}

export async function buildQrLabels(
  carts: Cart[],
  kind: "all" | "carts" | "laptops" = "all",
): Promise<QrLabel[]> {
  const specs = collectQrLabelSpecs(carts, kind);
  return Promise.all(
    specs.map(async (spec) => ({
      ...spec,
      src: await qrDataUrl(spec.payload),
    })),
  );
}

export function openQrLabelsPdf(input: {
  heading: string;
  labels: QrLabel[];
}): OpenCorporatePdfResult {
  const generatedAt = format(new Date(), "MMM d, yyyy · HH:mm");
  const cartCount = input.labels.filter((label) => label.kind === "cart").length;
  const laptopCount = input.labels.filter((label) => label.kind === "laptop").length;

  const cards = input.labels
    .map((label) => {
      return `<article class="label">
        <img src="${escapePdfHtml(label.src)}" alt="" />
        <p class="kind">${label.kind === "cart" ? "Cart" : "Laptop"}</p>
        <p class="title">${escapePdfHtml(label.title)}</p>
        <p class="sub">${escapePdfHtml(label.subtitle)}</p>
      </article>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapePdfHtml(input.heading)}</title>
  <style>
    @page { size: letter portrait; margin: 0.45in 0.5in 0.5in; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #0a0a0a;
      font-family: "Segoe UI", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .sheet { width: 100%; max-width: 8.5in; margin: 0 auto; }
    .top {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 24px;
      padding-bottom: 14px;
      margin-bottom: 16px;
      border-bottom: 1.5px solid #0a0a0a;
    }
    .wordmark {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }
    .heading {
      margin: 4px 0 0;
      font-size: 22px;
      font-weight: 500;
      letter-spacing: -0.035em;
    }
    .meta {
      text-align: right;
      font-size: 11.5px;
      line-height: 1.45;
      color: #737373;
    }
    .meta strong {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #171717;
    }
    .stats {
      display: flex;
      gap: 18px;
      margin: 0 0 16px;
      font-size: 11.5px;
      color: #525252;
    }
    .stats b {
      font-weight: 600;
      color: #0a0a0a;
      font-variant-numeric: tabular-nums;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .label {
      border: 1px solid #e7e7e7;
      border-radius: 8px;
      padding: 14px 10px 12px;
      text-align: center;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .label img {
      display: block;
      width: 92px;
      height: 92px;
      margin: 0 auto 8px;
    }
    .kind {
      margin: 0;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #a3a3a3;
    }
    .title {
      margin: 3px 0 0;
      font-size: 13px;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .sub {
      margin: 3px 0 0;
      font-size: 10.5px;
      color: #737373;
      letter-spacing: -0.01em;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      margin-top: 22px;
      padding-top: 12px;
      border-top: 1px solid #e5e5e5;
      font-size: 10px;
      color: #a3a3a3;
    }
    @media print {
      .no-print { display: none !important; }
      .sheet { max-width: none; }
    }
    @media screen {
      body { background: #f4f4f5; padding: 28px 16px 48px; }
      .sheet {
        background: #fff;
        padding: 36px 40px 32px;
        border-radius: 4px;
        box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 12px 40px rgba(0,0,0,0.06);
      }
      .toolbar {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        max-width: 8.5in;
        margin: 0 auto 14px;
      }
      .toolbar button {
        height: 32px;
        padding: 0 12px;
        border-radius: 6px;
        border: 1px solid #e5e5e5;
        background: #fff;
        font-size: 12.5px;
        font-weight: 500;
        color: #404040;
        cursor: pointer;
        font-family: inherit;
      }
      .toolbar button.primary {
        background: #0a0a0a;
        border-color: #0a0a0a;
        color: #fff;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar no-print">
    <button type="button" onclick="window.close()">Close</button>
    <button type="button" class="primary" onclick="window.print()">Save as PDF / Print</button>
  </div>
  <div class="sheet">
    <header class="top">
      <div>
        <div class="wordmark">Cubicle</div>
        <h1 class="heading">${escapePdfHtml(input.heading)}</h1>
      </div>
      <div class="meta">
        <strong>Label sheet</strong>
        Generated ${escapePdfHtml(generatedAt)}
      </div>
    </header>
    <div class="stats">
      <span><b>${cartCount}</b> cart${cartCount === 1 ? "" : "s"}</span>
      <span><b>${laptopCount}</b> laptop${laptopCount === 1 ? "" : "s"}</span>
      <span><b>${input.labels.length}</b> label${input.labels.length === 1 ? "" : "s"}</span>
    </div>
    <div class="grid">${cards}</div>
    <footer class="footer">
      <span>Internal use · authorized staff only</span>
      <span>Cubicle operations</span>
    </footer>
  </div>
  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 280);
    };
  </script>
</body>
</html>`;

  const popup = window.open("", "_blank");
  if (!popup) return "blocked";
  popup.document.write(html);
  popup.document.close();
  return "opened";
}
