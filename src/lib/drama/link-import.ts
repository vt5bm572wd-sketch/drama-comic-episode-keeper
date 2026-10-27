import type { Work, WorkSource } from "./types";

/**
 * 作品網址／分享連結辨識（純前端、無網路請求）。
 *
 * 只接受已確認為紅果短劇官方的網域：
 * - hongguoduanju.com、www.hongguoduanju.com（官方網站）
 * - novelquickapp.com（官方分享網域，根網址會轉到 hongguoduanju.com）
 *
 * 辨識成功只代表取得 series_id 與來源網址，並未取得作品資料。
 */

export const HONGGUO_HOSTS = ["hongguoduanju.com", "www.hongguoduanju.com", "novelquickapp.com"] as const;

const SERIES_ID_RE = /^\d{6,25}$/;
const MAX_INPUT = 2000;
const MAX_TITLE = 100;

export type LinkErrorCode =
  | "empty"
  | "too_long"
  | "no_url"
  | "invalid_url"
  | "unsupported_site"
  | "missing_id"
  | "short_link"
  | "invalid_id";

export interface LinkSuccess {
  ok: true;
  platform: "hongguo";
  seriesId: string;
  /** 依 series_id 重建的官方作品頁網址（保存用） */
  sourceUrl: string;
  /** 從分享文字中取得的劇名；沒有則為 null */
  title: string | null;
}

export interface LinkFailure {
  ok: false;
  code: LinkErrorCode;
  message: string;
}

export type LinkParseResult = LinkSuccess | LinkFailure;

const fail = (code: LinkErrorCode, message: string): LinkFailure => ({ ok: false, code, message });

export function hongguoDetailUrl(seriesId: string): string {
  return `https://hongguoduanju.com/detail?series_id=${seriesId}`;
}

export function isValidSeriesId(id: string): boolean {
  return SERIES_ID_RE.test(id);
}

/** 網址結尾常黏到的中英文標點 */
const TRAILING_PUNCT = /[)\]}>.,;:!?'"，。、；：！？」』》）】…]+$/u;
const URL_STOP = `\\s<>"'，。、；！？「」『』《》（）【】`;
const HTTP_URL_RE = new RegExp(`https?:\\/\\/[^${URL_STOP}]+`, "giu");
const BARE_URL_RE = new RegExp(
  `(?:^|[^\\w.@/-])((?:[a-z0-9-]+\\.)+[a-z]{2,}(?::\\d+)?\\/[^${URL_STOP}]*)`,
  "giu",
);

function findUrlCandidates(text: string): string[] {
  const http = Array.from(text.matchAll(HTTP_URL_RE), (m) => m[0]);
  const list = http.length > 0 ? http : Array.from(text.matchAll(BARE_URL_RE), (m) => `https://${m[1] ?? ""}`);
  return list.map((u) => u.replace(TRAILING_PUNCT, "")).filter(Boolean);
}

/** 分享文字中的劇名：優先取《》，其次「」『』。 */
export function extractShareTitle(text: string): string | null {
  const patterns = [/《([^《》\n]{1,120})》/u, /「([^「」\n]{1,120})」/u, /『([^『』\n]{1,120})』/u];
  for (const re of patterns) {
    const m = text.match(re);
    const t = m?.[1]?.replace(/\s+/g, " ").trim();
    if (t) return t.slice(0, MAX_TITLE);
  }
  return null;
}

type UrlCheck =
  | { kind: "official"; url: URL }
  | { kind: "invalid" }
  | { kind: "other"; host: string };

function checkUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { kind: "invalid" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { kind: "invalid" };
  // 帶帳密的網址常用來偽裝網域（例如 https://hongguoduanju.com@evil.com）
  if (url.username || url.password) return { kind: "invalid" };
  if (url.port && url.port !== "80" && url.port !== "443") return { kind: "invalid" };
  const host = url.hostname.toLowerCase();
  if ((HONGGUO_HOSTS as readonly string[]).includes(host)) return { kind: "official", url };
  return { kind: "other", host };
}

function extractSeriesId(url: URL): { id: string | null; raw: string | null; shortLink: boolean } {
  const param = url.searchParams.get("series_id") ?? url.searchParams.get("video_series_id");
  if (param !== null) {
    const v = param.trim();
    return { id: SERIES_ID_RE.test(v) ? v : null, raw: v, shortLink: false };
  }
  const player = url.pathname.match(/^\/player\/([^/]+)/);
  if (player?.[1]) {
    const v = decodeURIComponent(player[1]);
    return { id: SERIES_ID_RE.test(v) ? v : null, raw: v, shortLink: false };
  }
  return { id: null, raw: null, shortLink: /^\/s\/[^/]+/.test(url.pathname) };
}

export function parseWorkLink(input: string): LinkParseResult {
  const text = (input ?? "").trim();
  if (!text) return fail("empty", "請先貼上作品網址或分享文字。");
  if (text.length > MAX_INPUT) return fail("too_long", `內容太長（上限 ${MAX_INPUT} 字），請只貼上網址或分享文字。`);

  const candidates = findUrlCandidates(text);
  if (candidates.length === 0) {
    return fail("no_url", "找不到網址。請貼上以 https:// 開頭的紅果短劇作品網址或分享連結。");
  }

  let sawInvalid = false;
  let otherHost: string | null = null;
  let official: URL | null = null;
  for (const c of candidates) {
    const r = checkUrl(c);
    if (r.kind === "official") {
      official = r.url;
      break;
    }
    if (r.kind === "invalid") sawInvalid = true;
    else otherHost ??= r.host;
  }

  if (!official) {
    if (otherHost) {
      return fail(
        "unsupported_site",
        `目前不支援「${otherHost}」。僅支援紅果短劇官方網址（hongguoduanju.com）與官方分享連結。`,
      );
    }
    return sawInvalid
      ? fail("invalid_url", "網址格式無效，請確認複製完整且沒有多餘字元。")
      : fail("no_url", "找不到網址。");
  }

  const { id, raw, shortLink } = extractSeriesId(official);
  if (shortLink) {
    return fail(
      "short_link",
      "這是紅果短劇官方短連結，連結本身不含作品 ID。請先在瀏覽器開啟，再複製跳轉後網址列中含 series_id 的完整網址貼上。",
    );
  }
  if (raw !== null && id === null) {
    return fail("invalid_id", "作品 ID 格式不正確（應為 6 至 25 位數字），請確認網址是否完整。");
  }
  if (id === null) {
    return fail("missing_id", "已辨識為紅果短劇網址，但缺少作品 ID（series_id）。請改貼作品頁的網址。");
  }

  return {
    ok: true,
    platform: "hongguo",
    seriesId: id,
    sourceUrl: hongguoDetailUrl(id),
    title: extractShareTitle(text),
  };
}

/** 找出已收藏且來源 ID 相同的作品 */
export function findWorkBySeriesId(works: Work[], seriesId: string): Work | undefined {
  return works.find((w) => w.source?.platform === "hongguo" && w.source.seriesId === seriesId);
}

export function makeSource(result: LinkSuccess, now = new Date().toISOString()): WorkSource {
  return { platform: "hongguo", seriesId: result.seriesId, url: result.sourceUrl, linkedAt: now };
}

