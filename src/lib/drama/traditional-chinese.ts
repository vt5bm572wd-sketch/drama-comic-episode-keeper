import { Converter } from "opencc-js";
import type { OnlineWork } from "./hongguo-data";
import type { Season, Work } from "./types";

const s2twp = Converter({ from: "cn", to: "twp" });
const twp2s = Converter({ from: "twp", to: "cn" });

export function toTaiwanTraditional(value: string): string {
  return value ? s2twp(value) : value;
}

export function toSimplifiedChinese(value: string): string {
  return value ? twp2s(value) : value;
}

export function traditionalizeOnlineWork(work: OnlineWork): OnlineWork {
  const originalTitle = work.originalTitle ?? work.title;
  const originalSynopsis = work.originalSynopsis ?? work.synopsis;
  const originalActors = work.originalActors ?? work.actors;
  const originalTags = work.originalTags ?? work.tags;
  const originalHeat = work.originalHeat ?? work.heat;
  return {
    ...work,
    originalTitle,
    originalSynopsis,
    originalActors,
    originalTags,
    originalHeat,
    title: toTaiwanTraditional(originalTitle),
    synopsis: toTaiwanTraditional(originalSynopsis),
    actors: originalActors.map(toTaiwanTraditional),
    tags: originalTags.map(toTaiwanTraditional),
    heat: originalHeat ? toTaiwanTraditional(originalHeat) : originalHeat,
  };
}

function hasHongguoSeasonSource(season: Season): boolean {
  return !!season.source || (season.sources?.length ?? 0) > 0;
}

function traditionalizeSeason(season: Season): Season {
  if (!hasHongguoSeasonSource(season)) return season;
  const originalTitle = season.originalTitle ?? season.originTitle ?? season.title;
  const originalSynopsis = season.originalSynopsis ?? season.synopsis;
  return {
    ...season,
    ...(originalTitle
      ? {
          originalTitle,
          title: toTaiwanTraditional(originalTitle),
          originTitle: toTaiwanTraditional(originalTitle),
        }
      : {}),
    ...(originalSynopsis
      ? { originalSynopsis, synopsis: toTaiwanTraditional(originalSynopsis) }
      : {}),
  };
}

/**
 * 只轉換可確認來自紅果的來源欄位；個人備註與本季備註永不轉換。
 * originalTitle / originalSynopsis 永遠保留來源原文，顯示欄位則由原文重建為台灣繁體，
 * 因此重複執行是冪等的，不會反覆污染資料。
 */
export function traditionalizeHongguoWork(work: Work): Work {
  const hasHongguo = !!work.source || work.seasons.some(hasHongguoSeasonSource);
  if (!hasHongguo) return work;
  const originalTitle = work.originalTitle ?? work.title;
  const originalSynopsis = work.originalSynopsis ?? work.synopsis;
  return {
    ...work,
    originalTitle,
    originalSynopsis,
    title: toTaiwanTraditional(originalTitle),
    synopsis: toTaiwanTraditional(originalSynopsis),
    aliases: Array.from(new Set(work.aliases.map(toTaiwanTraditional))),
    actors: Array.from(new Set(work.actors.map(toTaiwanTraditional))),
    categories: Array.from(new Set(work.categories.map(toTaiwanTraditional))),
    tags: Array.from(new Set(work.tags.map(toTaiwanTraditional))),
    seasons: work.seasons.map(traditionalizeSeason),
  };
}