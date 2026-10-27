import { useEffect, useState } from "react";
import { isCoverRef, loadCoverUrl, peekCoverUrl } from "@/lib/drama/cover-store";

/**
 * 把作品的 cover 值轉成可顯示的圖片網址。
 * 回傳 undefined = 讀取中；null = 沒有封面或圖片已遺失。
 */
export function useCoverSrc(cover: string | null): string | null | undefined {
  const isRef = isCoverRef(cover);
  const [resolved, setResolved] = useState<{ ref: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!isCoverRef(cover)) return;
    if (peekCoverUrl(cover) !== undefined) return;
    let alive = true;
    void loadCoverUrl(cover).then((url) => {
      if (alive) setResolved({ ref: cover, url });
    });
    return () => {
      alive = false;
    };
  }, [cover]);

  if (!isRef) return cover;
  const cached = peekCoverUrl(cover as string);
  if (cached !== undefined) return cached;
  return resolved?.ref === cover ? resolved.url : undefined;
}

