import { createServerFn } from "@tanstack/react-start";
import {
  HONGGUO_ORIGIN,
  parseDetailHtml,
  parseRankingHtml,
  parseSearchHtml,
  parseSearchJson,
  type LookupResult,
  type OnlineSearchResult,
  type RankingKind,
  type RankingResult,
} from "./hongguo-data";
import { hongguoDetailUrl, isValidSeriesId } from "./link-import";
import { toSimplifiedChinese, traditionalizeOnlineWork } from "./traditional-chinese";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Accept-Language": "zh-CN,zh;q=0.9",
};
const TIMEOUT_MS = 12000;
const RANKING_TTL_MS = 10 * 60_000;
const rankingCache = new Map<RankingKind, { expiresAt: number; result: RankingResult }>();

export const getHongguoRanking = createServerFn({ method: "POST" })
  .inputValidator((input: { kind: RankingKind; refresh?: boolean }) => ({
    kind: input?.kind === "ai" ? ("ai" as const) : ("comic" as const),
    refresh: input?.refresh === true,
  }))
  .handler(async ({ data }): Promise<RankingResult> => {
    const cached = rankingCache.get(data.kind);
    if (!data.refresh && cached && cached.expiresAt > Date.now()) return cached.result;
    const path = data.kind === "comic" ? "/rank/hot-comic-drama" : "/rank/hot-ai-drama";
    try {
      const res = await fetch(new URL(path, HONGGUO_ORIGIN), {
        headers: { ...BROWSER_HEADERS, Accept: "text/html", Referer: `${HONGGUO_ORIGIN}/` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const items = parseRankingHtml(await res.text(), data.kind);
      if (!items.length) throw new Error("ranking page did not contain a parseable list");
      const result: RankingResult = {
        ok: true,
        kind: data.kind,
        items: items.map(traditionalizeOnlineWork),
        updatedAt: new Date().toISOString(),
      };
      rankingCache.set(data.kind, { expiresAt: Date.now() + RANKING_TTL_MS, result });
      return result;
    } catch (error) {
      console.error(`hongguo ${data.kind} ranking fetch failed`, error);
      if (cached?.result.ok) return cached.result;
      return { ok: false, kind: data.kind, message: "暫時無法取得榜單，請稍後重試。" };
    }
  });

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
        return {
          ok: false,
          code: "not_found",
          message: "紅果短劇官方網站找不到這個作品 ID，可能已下架或 ID 有誤。",
        };
      }
      if (!res.ok) {
        console.error("hongguo detail status", res.status);
        return {
          ok: false,
          code: "unavailable",
          message: `紅果短劇官方網站暫時無法回應（${res.status}），請稍後再試或手動填寫。`,
        };
      }
      html = await res.text();
    } catch (e) {
      console.error("hongguo detail fetch failed", e);
      return {
        ok: false,
        code: "unavailable",
        message: "連不上紅果短劇官方網站，請稍後再試或手動填寫。",
      };
    }

    const parsed = parseDetailHtml(html, seriesId);
    if (parsed === "not_found") {
      return {
        ok: false,
        code: "not_found",
        message: "紅果短劇官方網站找不到這個作品 ID，可能已下架或 ID 有誤。",
      };
    }
    if (parsed === "parse") {
      return {
        ok: false,
        code: "parse",
        message: "已連到官方網站，但無法讀出作品資料（可能是網站改版），請手動填寫。",
      };
    }
    return { ok: true, work: traditionalizeOnlineWork(parsed) };
  });

export const searchHongguo = createServerFn({ method: "POST" })
  .inputValidator((input: { query: string; page?: number }) => {
    const query = typeof input?.query === "string" ? input.query.trim().slice(0, 50) : "";
    const page =
      Number.isInteger(input?.page) && (input.page as number) > 0
        ? Math.min(input.page as number, 50)
        : 1;
    return { query, page };
  })
  .handler(async ({ data }): Promise<OnlineSearchResult> => {
    if (!data.query) return { ok: true, items: [], page: 1, hasMore: false, total: 0 };

    // 目前官網搜尋走 /search/{keyword}，搜尋資料放在頁面的 _ROUTER_DATA。
    // 紅果以簡體索引為主；繁體搜尋詞先轉簡體，回傳結果再轉回台灣繁體。
    const sourceQuery = toSimplifiedChinese(data.query);
    const pageUrl = new URL(`/search/${encodeURIComponent(sourceQuery)}`, HONGGUO_ORIGIN);
    if (data.page > 1) pageUrl.searchParams.set("page", String(data.page));

    try {
      const res = await fetch(pageUrl, {
        headers: { ...BROWSER_HEADERS, Accept: "text/html" },
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) {
        const parsed = parseSearchHtml(await res.text(), data.page);
        if (parsed.ok && parsed.items.length > 0)
          return { ...parsed, items: parsed.items.map(traditionalizeOnlineWork) };
      }
    } catch (e) {
      console.error("hongguo search page failed", e);
    }

    // 舊 endpoint 作為備援，避免官網暫時切換格式時完全失效。
    const legacyUrl = new URL("/api/search/result", HONGGUO_ORIGIN);
    legacyUrl.searchParams.set("query", sourceQuery);
    if (data.page > 1) legacyUrl.searchParams.set("page", String(data.page));
    try {
      const res = await fetch(legacyUrl, {
        headers: {
          ...BROWSER_HEADERS,
          Accept: "application/json",
          Referer: `${HONGGUO_ORIGIN}/search`,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.ok) {
        const text = await res.text();
        if (text.trim()) {
          const parsed = parseSearchJson(JSON.parse(text), data.page);
          return parsed.ok
            ? { ...parsed, items: parsed.items.map(traditionalizeOnlineWork) }
            : parsed;
        }
      }
    } catch (e) {
      console.error("hongguo legacy search failed", e);
    }

    return { ok: false, message: "紅果線上搜尋目前無法取得結果，請稍後再試。" };
  });
