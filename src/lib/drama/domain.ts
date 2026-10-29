import type { CollectStatus, Season, WatchStatus, Work, WorkType } from "./types";
import type { SortKey } from "./labels";
import { parseWorkLink } from "./link-import";

export function uid(prefix = "w"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rand}`;
}

/* ---------- 集數與進度 ---------- */

export function clampEpisode(value: number, total: number): number {
  const safeTotal = Math.max(0, Math.floor(Number.isFinite(total) ? total : 0));
  const v = Math.floor(Number.isFinite(value) ? value : 0);
  return Math.min(Math.max(0, v), safeTotal);
}

export function availableEpisodes(
  season: Pick<Season, "currentEpisodes" | "totalEpisodes">,
): number {
  return season.currentEpisodes ?? season.totalEpisodes;
}

export function seasonPercent(
  season: Pick<Season, "watchedEpisodes" | "totalEpisodes" | "currentEpisodes">,
): number {
  const total = availableEpisodes(season);
  return total > 0 ? Math.round((season.watchedEpisodes / total) * 100) : 0;
}

export function workTotals(work: Work): { watched: number; total: number; percent: number } {
  const watched = work.seasons.reduce((s, x) => s + x.watchedEpisodes, 0);
  const total = work.seasons.reduce((s, x) => s + availableEpisodes(x), 0);
  return { watched, total, percent: total > 0 ? Math.round((watched / total) * 100) : 0 };
}

export function sortSeasons(seasons: Season[]): Season[] {
  return [...seasons].sort((a, b) => a.number - b.number);
}

export function currentSeason(work: Work): Season | undefined {
  return work.seasons.find((s) => s.id === work.currentSeasonId) ?? sortSeasons(work.seasons)[0];
}

const SPECIAL_MANUAL_STATUSES = new Set<WatchStatus>(["want", "paused", "dropped", "waiting"]);

export function deriveSeasonStatus(season: Season, newSeason = false): WatchStatus {
  if (season.statusMode === "manual" && SPECIAL_MANUAL_STATUSES.has(season.status)) {
    return season.status;
  }
  if (season.watchedEpisodes <= 0) return newSeason ? "pending" : "unwatched";
  const total = season.totalEpisodes;
  if (total > 0 && season.watchedEpisodes >= total) return "completed";
  return "watching";
}

/** 依各季進度推導系列狀態；暫停、棄劇、想看等手動覆寫仍保留。 */
export function recalculateWorkStatus(work: Work): Work {
  if (
    work.watchStatusMode === "manual" &&
    (work.watchStatus === "paused" || work.watchStatus === "dropped")
  ) {
    return work;
  }
  const statuses = work.seasons.map((s) => s.status);
  let watchStatus: WatchStatus;
  if (statuses.includes("pending")) watchStatus = "pending";
  else if (statuses.includes("watching")) watchStatus = "watching";
  else if (statuses.every((s) => s === "unwatched" || s === "want")) watchStatus = "unwatched";
  else if (statuses.length > 0 && statuses.every((s) => s === "completed")) {
    watchStatus = work.seriesStatus === "completed" ? "completed" : "waiting";
  } else if (statuses.includes("paused")) watchStatus = "paused";
  else if (statuses.includes("dropped")) watchStatus = "dropped";
  else watchStatus = "unwatched";
  return { ...work, watchStatus, watchStatusMode: "auto" };
}

/** 設定某季已觀看集數（自動限制在 0 ～ 總集數）。 */
export function setSeasonProgress(
  work: Work,
  seasonId: string,
  watched: number,
  now = new Date().toISOString(),
): Work {
  const target = work.seasons.find((s) => s.id === seasonId);
  if (!target) return work;
  const value = clampEpisode(watched, availableEpisodes(target));
  if (value === target.watchedEpisodes) return work;
  const seasons = work.seasons.map((s) => {
    if (s.id !== seasonId) return s;
    const changed = { ...s, watchedEpisodes: value, updatedAt: now, statusMode: "auto" as const };
    return { ...changed, status: deriveSeasonStatus(changed) };
  });
  return recalculateWorkStatus({
    ...work,
    watchStatusMode:
      work.watchStatusMode === "manual" &&
      (work.watchStatus === "paused" || work.watchStatus === "dropped")
        ? "manual"
        : "auto",
    seasons,
    currentSeasonId: seasonId,
    lastWatchedAt: now,
    updatedAt: now,
  });
}

export function stepEpisode(
  work: Work,
  seasonId: string,
  delta: number,
  now = new Date().toISOString(),
): Work {
  const target = work.seasons.find((s) => s.id === seasonId);
  if (!target) return work;
  return setSeasonProgress(work, seasonId, target.watchedEpisodes + delta, now);
}

/* ---------- 季數管理 ---------- */

export type SeasonInput = { [K in keyof Season]?: Season[K] | undefined } & { number: number };

export function makeSeason(partial: SeasonInput, now: string): Season {
  const total = Math.max(0, Math.floor(partial.totalEpisodes ?? 0));
  const season: Season = {
    id: partial.id ?? uid("s"),
    number: partial.number,
    originTitle: partial.originTitle,
    title: partial.title,
    originalTitle: partial.originalTitle,
    synopsis: partial.synopsis,
    originalSynopsis: partial.originalSynopsis,
    cover: partial.cover,
    source: partial.source,
    rating: partial.rating,
    updateDate: partial.updateDate ?? null,
    totalEpisodes: total,
    currentEpisodes: partial.currentEpisodes ?? total,
    watchedEpisodes: clampEpisode(partial.watchedEpisodes ?? 0, partial.currentEpisodes ?? total),
    status: partial.status ?? "unwatched",
    statusMode: partial.statusMode ?? "auto",
    note: partial.note ?? "",
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
  return { ...season, status: deriveSeasonStatus(season, partial.status === "pending") };
}

export function nextSeasonNumber(work: Pick<Work, "seasons">): number {
  return work.seasons.reduce((m, s) => Math.max(m, s.number), 0) + 1;
}

/**
 * 把 source 作品的所有季數移到 target 系列底下。
 * 季數接在 target 最大季數之後，觀看進度、狀態、備註全部保留。
 */
export function mergeIntoSeries(target: Work, source: Work, now = new Date().toISOString()): Work {
  if (target.id === source.id) return target;
  let next = nextSeasonNumber(target);
  const used = new Set(target.seasons.map((s) => s.number));
  const moved = sortSeasons(source.seasons).map((s) => {
    const number = used.has(s.number) ? next++ : s.number;
    used.add(number);
    const movedSeason = {
      ...s,
      number,
      originTitle: s.originTitle ?? source.title,
      statusMode: "auto" as const,
      updatedAt: now,
    };
    return { ...movedSeason, status: deriveSeasonStatus(movedSeason, s.watchedEpisodes === 0) };
  });
  const aliases = Array.from(
    new Set(
      [...target.aliases, source.title, ...source.aliases].filter((a) => a && a !== target.title),
    ),
  );
  const lastWatchedAt =
    [target.lastWatchedAt, source.lastWatchedAt].filter(Boolean).sort().at(-1) ?? null;
  return recalculateWorkStatus({
    ...target,
    aliases,
    seasons: [...target.seasons, ...moved],
    currentSeasonId: target.currentSeasonId ?? moved[0]?.id ?? null,
    actors: Array.from(new Set([...target.actors, ...source.actors])),
    categories: Array.from(new Set([...target.categories, ...source.categories])),
    tags: Array.from(new Set([...target.tags, ...source.tags])),
    customCategories: Array.from(
      new Set([...(target.customCategories ?? []), ...(source.customCategories ?? [])]),
    ),
    updateDate: [target.updateDate, source.updateDate].filter(Boolean).sort().at(-1) ?? null,
    lastWatchedAt,
    updatedAt: now,
    watchStatus: moved.some((s) => s.watchedEpisodes === 0) ? "pending" : target.watchStatus,
    watchStatusMode: "auto",
  });
}

/* ---------- 統計 ---------- */

export interface Stats {
  total: number;
  watching: number;
  completed: number;
}

export function computeStats(works: Work[]): Stats {
  return {
    total: works.length,
    watching: works.filter((w) => w.watchStatus === "watching").length,
    completed: works.filter((w) => w.watchStatus === "completed").length,
  };
}

export function topCategories(works: Work[], limit = 8): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const w of works) for (const c of w.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh-Hant"))
    .slice(0, limit);
}

/* ---------- 搜尋、篩選、排序 ---------- */

function norm(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

export function matchesQuery(work: Work, query: string): boolean {
  const q = norm(query);
  if (!q) return true;
  const haystack = [
    work.title,
    work.originalTitle ?? "",
    ...work.aliases,
    ...work.categories,
    ...work.tags,
    work.synopsis,
    work.originalSynopsis ?? "",
    work.source?.seriesId ?? "",
    ...work.seasons.flatMap((season) => [
      season.title ?? "",
      season.originalTitle ?? "",
      season.originTitle ?? "",
      season.source?.seriesId ?? "",
    ]),
  ];
  return haystack.some((field) => norm(field).includes(q));
}

/** 關鍵字搜尋；貼上作品網址或分享文字時改用作品 ID 精確比對。 */
export function searchWorks(works: Work[], query: string): Work[] {
  if (!norm(query)) return [];
  const link = parseWorkLink(query);
  if (link.ok) return works.filter((w) => w.source?.seriesId === link.seriesId);
  return works.filter((w) => matchesQuery(w, query));
}

export interface FilterOptions {
  type?: WorkType | undefined;
  watch?: WatchStatus | undefined;
  collect?: CollectStatus | undefined;
  category?: string | undefined;
  customCategory?: string | undefined;
  sort?: SortKey | undefined;
}

export function filterAndSort(works: Work[], opts: FilterOptions): Work[] {
  const list = works.filter(
    (w) =>
      (!opts.type || w.type === opts.type) &&
      (!opts.watch || w.watchStatus === opts.watch) &&
      (!opts.collect || w.collectStatus === opts.collect) &&
      (!opts.category || w.categories.includes(opts.category)) &&
      (!opts.customCategory || (w.customCategories ?? []).includes(opts.customCategory)),
  );
  const sort = opts.sort ?? "updated";
  const by: Record<SortKey, (a: Work, b: Work) => number> = {
    updateDate: (a, b) =>
      (b.updateDate ?? "").localeCompare(a.updateDate ?? "") ||
      a.title.localeCompare(b.title, "zh-Hant"),
    updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    created: (a, b) => b.createdAt.localeCompare(a.createdAt),
    watched: (a, b) => (b.lastWatchedAt ?? "").localeCompare(a.lastWatchedAt ?? ""),
    title: (a, b) => a.title.localeCompare(b.title, "zh-Hant"),
    rating: (a, b) => b.rating - a.rating || b.updatedAt.localeCompare(a.updatedAt),
  };
  return [...list].sort(by[sort]);
}

export function recentlyWatched(works: Work[], limit = 10): Work[] {
  return works
    .filter((w) => w.lastWatchedAt)
    .sort((a, b) => (b.lastWatchedAt ?? "").localeCompare(a.lastWatchedAt ?? ""))
    .slice(0, limit);
}

export function recentlyAdded(works: Work[], limit = 10): Work[] {
  return [...works].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

/* ---------- 文字欄位工具 ---------- */

export function splitList(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[,，、\n;；]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

export function normalizeTitle(title: string): string {
  return norm(title)
    .replace(/[《》「」『』"'（）()【】]/g, "")
    .replaceAll("[", "")
    .replaceAll("]", "");
}

/** 純衍生提示，絕不寫回個人手動追劇狀態。 */
export function progressHint(work: Work): string {
  const { watched, total } = workTotals(work);
  const unread = Math.max(total - watched, 0);
  if (unread > 0) return `有 ${unread} 集未看`;
  if (work.seriesStatus === "ongoing") return "等更新";
  if (work.seriesStatus === "completed" && total > 0) return "已完成";
  return "";
}

export function migrateWork(work: Work): Work {
  const migrated: Work = {
    ...work,
    updateDate: work.updateDate ?? null,
    seriesStatus: work.seriesStatus ?? "pending",
    watchStatus: work.watchStatus ?? "want",
    watchStatusMode: work.watchStatusMode ?? "manual",
    originalTitle: work.originalTitle,
    originalSynopsis: work.originalSynopsis,
    seriesKey: work.seriesKey,
    customCategories: work.customCategories ?? [],
    seasons: work.seasons.map((s, index) => ({
      ...s,
      currentEpisodes: s.currentEpisodes ?? s.totalEpisodes,
      watchedEpisodes: s.watchedEpisodes ?? 0,
      statusMode: s.statusMode ?? "manual",
      ...(s.source || !work.source || index !== 0 ? {} : { source: work.source }),
    })),
  };
  return migrated;
}

export function validUpdateDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
