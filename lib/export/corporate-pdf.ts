/** Shared corporate print-to-PDF sheet used by admin exports. */

export function escapePdfHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

export type CorporatePdfStat = {
  value: string | number
  label: string
  warn?: boolean
}

export type CorporatePdfCell = {
  text: string
  sub?: string
  flag?: string
  tone?: "default" | "strong" | "muted" | "num"
}

export type CorporatePdfColumn = {
  label: string
  width: string
}

export type CorporatePdfRow = {
  cells: CorporatePdfCell[]
  warn?: boolean
}

export type OpenCorporatePdfResult = "opened" | "blocked"

export function openCorporatePdf(input: {
  documentTitle: string
  heading: string
  dateLabel: string
  generatedAt: string
  stats: CorporatePdfStat[]
  columns: CorporatePdfColumn[]
  rows: CorporatePdfRow[]
  emptyMessage: string
}): OpenCorporatePdfResult {
  const {
    documentTitle,
    heading,
    dateLabel,
    generatedAt,
    stats,
    columns,
    rows,
    emptyMessage,
  } = input

  const statsHtml = stats
    .map((stat) => {
      const warn = stat.warn ? " warn" : ""
      return `<li class="${warn.trim()}"><span class="n${warn}">${escapePdfHtml(String(stat.value))}</span> ${escapePdfHtml(stat.label)}</li>`
    })
    .join("")

  const colgroup = columns
    .map((col) => `<col style="width:${escapePdfHtml(col.width)}" />`)
    .join("")

  const headRow = columns
    .map((col) => `<th>${escapePdfHtml(col.label)}</th>`)
    .join("")

  const bodyRows =
    rows.length === 0
      ? `<tr class="empty"><td colspan="${columns.length}">${escapePdfHtml(emptyMessage)}</td></tr>`
      : rows
          .map((row) => {
            const cells = row.cells
              .map((cell) => {
                const tone = cell.tone ?? "default"
                const flag = cell.flag
                  ? `<span class="flag">${escapePdfHtml(cell.flag)}</span>`
                  : ""
                const sub = cell.sub
                  ? `<span class="sub">${escapePdfHtml(cell.sub)}</span>`
                  : ""
                return `<td class="${tone}"><span class="primary">${escapePdfHtml(cell.text)}</span>${flag}${sub}</td>`
              })
              .join("")
            return `<tr class="${row.warn ? "conflict" : ""}">${cells}</tr>`
          })
          .join("")

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapePdfHtml(documentTitle)}</title>
  <style>
    @page {
      size: letter portrait;
      margin: 0.6in 0.65in 0.7in;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #fff;
      color: #0a0a0a;
      -webkit-font-smoothing: antialiased;
      font-family: "Segoe UI", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
    }
    .sheet {
      width: 100%;
      max-width: 8.5in;
      margin: 0 auto;
    }
    .top {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 24px;
      padding-bottom: 18px;
      border-bottom: 1.5px solid #0a0a0a;
    }
    .brand {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .wordmark {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #0a0a0a;
    }
    .title {
      margin: 0;
      font-size: 22px;
      font-weight: 500;
      letter-spacing: -0.035em;
      line-height: 1.15;
      color: #0a0a0a;
    }
    .meta-block {
      text-align: right;
      font-size: 11.5px;
      line-height: 1.45;
      color: #737373;
    }
    .meta-block strong {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #171717;
      letter-spacing: -0.01em;
    }
    .stats {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 20px;
      margin: 16px 0 22px;
      padding: 0;
      list-style: none;
      font-size: 11.5px;
      color: #525252;
    }
    .stats li {
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
    }
    .stats .n {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: #0a0a0a;
      letter-spacing: -0.02em;
    }
    .stats .warn,
    .stats li.warn { color: #b91c1c; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    thead th {
      padding: 0 10px 10px 0;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #a3a3a3;
      text-align: left;
      border-bottom: 1px solid #e5e5e5;
    }
    thead th:last-child { padding-right: 0; }
    tbody td {
      padding: 11px 10px 11px 0;
      font-size: 12px;
      line-height: 1.35;
      vertical-align: middle;
      border-bottom: 1px solid #f0f0f0;
      color: #171717;
      overflow-wrap: anywhere;
    }
    tbody td:last-child { padding-right: 0; }
    tbody tr:last-child td { border-bottom: none; }
    td .primary {
      letter-spacing: -0.01em;
    }
    td.strong .primary {
      font-weight: 600;
      letter-spacing: -0.015em;
    }
    td.num .primary {
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
      color: #404040;
    }
    td.muted,
    td.muted .primary {
      color: #737373;
      font-weight: 400;
    }
    td .flag {
      display: inline-block;
      margin-left: 6px;
      padding: 1px 5px;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #b91c1c;
      background: #fef2f2;
      vertical-align: middle;
    }
    td .sub {
      display: block;
      margin-top: 3px;
      font-size: 11px;
      line-height: 1.35;
      color: #a3a3a3;
      font-weight: 400;
    }
    tr.conflict td { background: #fffafa; }
    tr.empty td {
      padding: 36px 0;
      text-align: center;
      color: #a3a3a3;
      font-size: 12.5px;
      border-bottom: none;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      margin-top: 28px;
      padding-top: 14px;
      border-top: 1px solid #e5e5e5;
      font-size: 10px;
      letter-spacing: 0.02em;
      color: #a3a3a3;
    }
    .footer .confidential {
      font-weight: 500;
      color: #737373;
    }
    @media print {
      html, body { background: #fff; }
      .sheet { max-width: none; }
      thead { display: table-header-group; }
      tr { break-inside: avoid; }
      .no-print { display: none !important; }
    }
    @media screen {
      body {
        background: #f4f4f5;
        padding: 32px 16px 48px;
      }
      .sheet {
        background: #fff;
        padding: 40px 44px 36px;
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
      .toolbar button:hover { border-color: #d4d4d4; }
      .toolbar button.primary:hover { background: #262626; }
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
      <div class="brand">
        <div class="wordmark">Cubicle</div>
        <h1 class="title">${escapePdfHtml(heading)}</h1>
      </div>
      <div class="meta-block">
        <strong>${escapePdfHtml(dateLabel)}</strong>
        Generated ${escapePdfHtml(generatedAt)}
      </div>
    </header>
    <ul class="stats">${statsHtml}</ul>
    <table>
      <colgroup>${colgroup}</colgroup>
      <thead>
        <tr>${headRow}</tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
    <footer class="footer">
      <span class="confidential">Internal use · authorized staff only</span>
      <span>Cubicle operations</span>
    </footer>
  </div>
  <script>
    window.onload = function () {
      setTimeout(function () { window.print(); }, 250);
    };
  </script>
</body>
</html>`

  const popup = window.open("", "_blank")
  if (!popup) return "blocked"
  popup.document.write(html)
  popup.document.close()
  return "opened"
}
