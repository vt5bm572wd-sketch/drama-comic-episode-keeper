async function drawScaled(file: File, maxSide: number): Promise<HTMLCanvasElement> {
  // iOS 從「檔案」選取時 type 可能是空字串；空的就交給瀏覽器解碼判斷
  if (file.type && !file.type.startsWith("image/")) throw new Error("請選擇圖片檔案");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("無法讀取這張圖片"));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("瀏覽器不支援圖片處理");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 將上傳圖片縮小並壓縮成 JPEG 檔（存進 IndexedDB，不放 localStorage）。 */
export async function compressImageBlob(file: File, maxSide = 600, quality = 0.82): Promise<Blob> {
  const canvas = await drawScaled(file, maxSide);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("圖片壓縮失敗"))), "image/jpeg", quality),
  );
}

/** 降級用：瀏覽器無法使用 IndexedDB 時，產生小尺寸 JPEG data URL。 */
export async function compressImage(file: File, maxSide = 320, quality = 0.7): Promise<string> {
  const canvas = await drawScaled(file, maxSide);
  return canvas.toDataURL("image/jpeg", quality);
}

