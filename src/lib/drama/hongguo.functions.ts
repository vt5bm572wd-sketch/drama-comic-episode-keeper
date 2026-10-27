import { createServerFn } from "@tanstack/react-start";
import {
  HONGGUO_ORIGIN,
  parseDetailHtml,
  parseSearchJson,
  type LookupResult,
  type OnlineSearchResult,
} from "./hongguo-data";
import { hongguoDetailUrl, isValidSeriesId } from "./link-import";

/**
 * 向紅果短劇官方網站取得公開作品資料。
 * 只會連到固定網域 hongguoduanju.com；網址一律由驗證過的數字 ID 或搜尋字串組成，
 * 不接受使用者提供的網址，避免被拿來連到任意站台。
 */

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Accept-Language": "zh-CN,zh;q=0.9",
};
const TIMEOUT_MS = 12000;

export const lookupHongguoWork = createServerFn({ method: "POST" })
  .inputValidator((input: { seriesId: string }) => {
    const id = typeof input?.seriesId === "string" ? input.seriesId.trim() : "";
    return { seriesId: id };
  })
  .handler(async ({ data }): Promise<LookupResult> => {
    const { seriesId } = data;
    if (!isValidSeriesId(seriesId)) {
      return { ok: false, code: "invalid_id", message: "作品 ID 格式不正確。" };
    }
    let html: string;
    try {
      const res = await fetch(hongguoDetailUrl(seriesId), {
        headers: { ...BROWSER_HEADERS, Accept: "text/html" },
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 404) {
        return { ok: false, code: "not_found", message: "紅果短劇官方網站找不到這個作品 ID，可能已下架或 ID 有誤。" };
      }
      if (!res.ok) {
        console.error("hongguo detail status", res.status);
        return { ok: false, code: "unavailable", message: `紅果短劇官方網站暫時無法回應（${res.status}），請稍後再試或手動填寫。` };
      }
      html = await res.text();
    } catch (e) {
      console.error("hongguo detail fetch failed", e);
      return { ok: false, code: "unavailable", message: "連不上紅果短劇官方網站，請稍後再試或手動填寫。" };
    }

    const parsed = parseDetailHtml(html, seriesId);
    if (parsed === "not_found") {
      return { ok: false, code: "not_found", message: "紅果短劇官方網站找不到這個作品 ID，可能已下架或 ID 有誤。" };
    }
    if (parsed === "parse") {
      return { ok: false, code: "parse", message: "已連到官方網站，但無法讀出作品資料（可能是網站改版），請手動填寫。" };
    }

    // 封面只回傳官方圖片網址，由瀏覽器直接載入，不再轉成 Base64
    return { ok: true, work: parsed };
  });

export const searchHongguo = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string; page?: number }) => {
    const query = typeof input?.query === "string" ? input.query.trim().slice(0, 50) : "";
    const page = Number.isInteger(input?.page) && (input.page as number) > 0 ? Math.min(input.page as number, 50) : 1;
    return { query, page };
  })
  .handler(async ({ data }): Promise<OnlineSearchResult> => {
    if (!data.query) return { ok: true, items: [], page: 1, hasMore: false, total: 0 };
    const url = new URL("/api/search/result", HONGGUO_ORIGIN);
    url.searchParams.set("query", data.query);
    if (data.page > 1) url.searchParams.set("page", String(data.page));

    // 官方網站偶爾回傳空內容，重試一次
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { ...BROWSER_HEADERS, Accept: "application/json", Referer: `${HONGGUO_ORIGIN}/search` },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!res.ok) {
          console.error("hongguo search status", res.status);
          if (attempt === 1) return { ok: false, message: `紅果短劇搜尋暫時無法使用（${res.status}），請稍後再試。` };
          continue;
        }
        const text = await res.text();
        if (!text.trim()) continue;
        return parseSearchJson(JSON.parse(text), data.page);
      } catch (e) {
        console.error("hongguo search failed", e);
      }
    }
    return { ok: false, message: "連不上紅果短劇搜尋，請稍後再試。" };
  });

