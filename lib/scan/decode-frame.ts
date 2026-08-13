type DetectedBarcode = { rawValue?: string };

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: ImageBitmapSource) => Promise<DetectedBarcode[]>;
};

let detector: InstanceType<BarcodeDetectorCtor> | null | undefined;
let canvas: HTMLCanvasElement | null = null;

function getBarcodeDetector(): InstanceType<BarcodeDetectorCtor> | null {
  if (detector !== undefined) return detector;
  const Ctor = (
    globalThis as typeof globalThis & {
      BarcodeDetector?: BarcodeDetectorCtor;
    }
  ).BarcodeDetector;
  if (typeof Ctor !== "function") {
    detector = null;
    return null;
  }
  try {
    detector = new Ctor({ formats: ["qr_code"] });
  } catch {
    detector = null;
  }
  return detector;
}

function getCanvas(): HTMLCanvasElement {
  if (!canvas) canvas = document.createElement("canvas");
  return canvas;
}

async function decodeWithJsQr(
  video: HTMLVideoElement,
): Promise<string | null> {
  if (!video.videoWidth || !video.videoHeight) return null;
  const width = 400;
  const height = Math.max(
    1,
    Math.round((video.videoHeight / video.videoWidth) * width),
  );
  const el = getCanvas();
  el.width = width;
  el.height = height;
  const ctx = el.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  const jsQR = (await import("jsqr")).default;
  const code = jsQR(image.data, image.width, image.height, {
    inversionAttempts: "dontInvert",
  });
  const text = code?.data?.trim();
  return text || null;
}

/** Read a QR string from a live video frame. Prefers native BarcodeDetector. */
export async function decodeVideoFrame(
  video: HTMLVideoElement,
): Promise<string | null> {
  const native = getBarcodeDetector();
  if (native) {
    try {
      const codes = await native.detect(video);
      const text = codes[0]?.rawValue?.trim();
      if (text) return text;
    } catch {
      // Fall through to jsQR — Safari and some WebViews throw here.
    }
  }
  try {
    return await decodeWithJsQr(video);
  } catch {
    return null;
  }
}
