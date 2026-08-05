/**
 * Encode a profile photo as a crisp data URL for storage on `profiles.avatar_url`.
 * Outputs a square crop (center) at retina-friendly resolution so small UI faces
 * and larger settings avatars stay sharp.
 */
export function fileToAvatarDataUrl(
  file: File,
  options?: { maxSize?: number; quality?: number },
): Promise<string> {
  // 1024px square is enough for 4K screens at typical avatar sizes (2–4× CSS).
  const maxSize = options?.maxSize ?? 1024;
  const quality = options?.quality ?? 0.92;

  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error("Image must be under 12MB."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load that image."));
      img.onload = () => {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        if (!srcW || !srcH) {
          reject(new Error("Could not read image dimensions."));
          return;
        }

        // Center square crop — consistent face crop in header / board / settings.
        const side = Math.min(srcW, srcH);
        const sx = Math.floor((srcW - side) / 2);
        const sy = Math.floor((srcH - side) / 2);
        const out = Math.min(maxSize, side);

        const canvas = document.createElement("canvas");
        canvas.width = out;
        canvas.height = out;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not available."));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);

        try {
          // Prefer WebP when the browser can encode it (smaller + sharper at same size).
          const webp = canvas.toDataURL("image/webp", quality);
          if (webp.startsWith("data:image/webp")) {
            resolve(webp);
            return;
          }
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          reject(new Error("Could not process that image."));
        }
      };
      // Help decode large phone photos cleanly.
      img.decoding = "async";
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
