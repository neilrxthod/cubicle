/**
 * Compress an image file to a small data URL for demo localStorage avatars.
 */
export function fileToAvatarDataUrl(
  file: File,
  options?: { maxSize?: number; quality?: number },
): Promise<string> {
  const maxSize = options?.maxSize ?? 256;
  const quality = options?.quality ?? 0.82;

  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error("Image must be under 8MB."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not load that image."));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not available."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          reject(new Error("Could not process that image."));
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
