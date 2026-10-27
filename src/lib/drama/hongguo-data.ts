import { hongguoDetailUrl, isValidSeriesId } from "./link-import";
import { PRESET_CATEGORIES } from "./labels";
import type { WorkType } from "./types";

/**
 * 紅果短劇官方網站資料解析（純函式，前後端皆可用）。
 *
 * 資料來源是 hongguoduanju.com 公開網頁：
 * - 作品頁 /detail?series_id=… 的伺服器端輸出內含 `_ROUTER_DATA` JSON
 * - 網站搜尋使用的 /api/search/result?query=…
 * 兩者都不是公開文件化的 API，格式可能隨官方改版而變，解析失敗時要回到手動填寫。
 */

export const HONGGUO_ORIGIN = "https://hongguoduanju.com";

/** 封面圖只接受官方圖床（https） */
const IMAGE_HOST_SUFFIXES = [".byteimg.com", ".fqnovelpic.com"];

const MAX_TITLE = 100;
const MAX_SYNOPSIS = 2000;
const MAX_LIST = 30;

export interface OnlineWork {
  seriesId: string;
  title: string;
  coverUrl: string | null;
  synopsis: string;
  actors: string[];
  tags: string[];
  totalEpisodes: number | null;
  /** 例如「3726萬熱度」 */
  heat: string | null;
  /** 官方站內評分（10 分制） */
  rating: number | null;
  sourceUrl: string;
}

export type LookupErrorCode = "invalid_id" | "not_found" | "unavailable" | "parse";

export type LookupResult =
  | { ok: true; work: OnlineWork }
  | { ok: false; code: LookupErrorCode; message: string };

export type OnlineSearchResult =
  | { ok: true; items: OnlineWork[]; page: number; hasMore: boolean; total: number }
  | { ok: false; message: string };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");

function cleanText(v: unknown, max: number): string {
  return str(v).replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanList(values: unknown[], max = MAX_LIST): string[] {
  const out = new Set<string>();
  for (const v of values) {
    const s = cleanText(v, 40);
    if (s) out.add(s);
    if (out.size >= max) break;
  }
  return [...out];
}

function toPositiveInt(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(str(v));
  return Number.isInteger(n) && n > 0 && n < 100000 ? n : null;
}

export function isAllowedImageUrl(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length > 1000) return false;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
    const host = u.hostname.toLowerCase();
    return IMAGE_HOST_SUFFIXES.some((s) => host.endsWith(s));
  } catch {
    return false;
  }
}

/** 從 `start` 起取出第一個完整 JSON 物件字串（處理字串內的大括號與跳脫字元）。 */
export function extractJsonObject(src: string, from: number): string | null {
  const start = src.indexOf("{", from);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

export function extractRouterData(html: string): Obj | null {
  const marker = html.indexOf("_ROUTER_DATA = ");
  if (marker < 0) return null;
  const json = extractJsonObject(html, marker);
  if (!json) return null;
  try {
    const data: unknown = JSON.parse(json);
    return isObj(data) ? data : null;
  } catch {
    return null;
  }
}

/** 解析作品頁 HTML；找不到作品回傳 "not_found"，格式不符回傳 "parse"。 */
export function parseDetailHtml(html: string, seriesId: string): OnlineWork | "not_found" | "parse" {
  const data = extractRouterData(html);
  if (!data) return "parse";
  const loader = data["loaderData"];
  if (!isObj(loader)) return "parse";
  const page = loader["detail_page"];
  if (!isObj(page)) return "not_found";
  const detail = page["seriesDetail"];
  if (!isObj(detail) || str(detail["series_id"]) !== seriesId) return "not_found";
  const social = isObj(page["seriesSocialInfo"]) ? page["seriesSocialInfo"] : {};
  const heat = isObj(social["hot_score_data"]) ? cleanText(social["hot_score_data"]["text"], 30) : "";
  const episodeInfo = isObj(detail["series_episode_info"]) ? detail["series_episode_info"] : {};
  const rating = typeof social["rating"] === "number" && social["rating"] > 0 ? social["rating"] : null;
  return buildWork(seriesId, {
    title: detail["series_name"],
    cover: detail["series_cover"],
    synopsis: detail["series_intro"],
    actors: Array.isArray(detail["celebrities"]) ? detail["celebrities"] : [],
    tags: Array.isArray(detail["tags"]) ? detail["tags"] : [],
    episodes: episodeInfo["episode_total_cnt"] ?? detail["episode_cnt"],
    heat,
    rating,
  });
}

function buildWork(
  seriesId: string,
  raw: { title: unknown; cover: unknown; synopsis: unknown; actors: unknown[]; tags: unknown[]; episodes: unknown; heat: string; rating: number | null },
): OnlineWork | "parse" {
  const title = cleanText(raw.title, MAX_TITLE);
  if (!title) return "parse";
  return {
    seriesId,
    title,
    coverUrl: isAllowedImageUrl(raw.cover) ? raw.cover : null,
    synopsis: str(raw.synopsis).trim().slice(0, MAX_SYNOPSIS),
    actors: cleanList(raw.actors.map((a) => (isObj(a) ? a["nickname"] : a))),
    tags: cleanList(raw.tags.map((t) => (isObj(t) ? t["name"] : t))),
    totalEpisodes: toPositiveInt(raw.episodes),
    heat: raw.heat || null,
    rating: raw.rating,
    sourceUrl: hongguoDetailUrl(seriesId),
  };
}

/** 解析官方網站搜尋回應 */
export function parseSearchJson(json: unknown, page: number): OnlineSearchResult {
  if (!isObj(json) || !Array.isArray(json["searchList"])) {
    return { ok: false, message: "紅果短劇搜尋回應格式不符，可能是官方網站改版。" };
  }
  const items: OnlineWork[] = [];
  const seen = new Set<string>();
  for (const entry of json["searchList"]) {
    if (!isObj(entry) || !isObj(entry["video_data"])) continue;
    const v = entry["video_data"];
    const id = str(v["series_id"]);
    if (!isValidSeriesId(id) || seen.has(id)) continue;
    const heatObj = isObj(v["hot_score_data"]) ? v["hot_score_data"] : {};
    const work = buildWork(id, {
      title: v["series_title"] ?? entry["name"],
      cover: v["series_cover"],
      synopsis: v["series_intro"],
      actors: Array.isArray(v["celebrities"]) ? v["celebrities"] : [],
      tags: Array.isArray(v["category_list"]) ? v["category_list"] : [],
      episodes: v["episode_cnt"],
      heat: cleanText(heatObj["text"], 30),
      rating: null,
    });
    if (work === "parse") continue;
    seen.add(id);
    items.push(work);
  }
  const total = toPositiveInt(json["totalCount"]) ?? items.length;
  return { ok: true, items, page, hasMore: json["hasMore"] === true, total };
}

/* ---------- 轉成表單可用的資料 ---------- */

/** 官方標籤（簡體）對應到本機預設分類（繁體） */
const TAG_TO_CATEGORY: Record<string, string> = {
  甜宠: "甜寵",
  霸总: "霸總",
  总裁: "霸總",
  复仇: "復仇",
  古装: "古裝",
  古代: "古裝",
  穿越: "穿越",
  重生: "重生",
  悬疑: "懸疑",
  都市: "都市",
  民国: "民國",
  奇幻: "奇幻",
  玄幻: "奇幻",
  科幻: "科幻",
  喜剧: "喜劇",
  搞笑: "喜劇",
};

export function tagsToCategories(tags: string[]): string[] {
  const presets = new Set(PRESET_CATEGORIES);
  const out = new Set<string>();
  for (const t of tags) {
    const c = TAG_TO_CATEGORY[t] ?? (presets.has(t) ? t : undefined);
    if (c) out.add(c);
  }
  return [...out];
}

/** 官方資料沒有明確標示漫劇；沒有列出真人演員時推測為漫劇。 */
export function guessWorkType(work: Pick<OnlineWork, "actors">): WorkType {
  return work.actors.length === 0 ? "comic" : "short";
}

