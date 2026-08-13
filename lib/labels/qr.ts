import QRCode from "qrcode";

export async function qrSvg(value: string): Promise<string> {
  return QRCode.toString(value, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: {
      dark: "#0a0a0a",
      light: "#ffffff",
    },
  });
}

export async function qrDataUrl(value: string): Promise<string> {
  const svg = await qrSvg(value);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
