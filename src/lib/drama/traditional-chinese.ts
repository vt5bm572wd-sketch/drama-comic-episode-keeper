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
  const originalTags = work.originalTags ?? work.tags;
  return {
    ...work,
    originalTitle,
    originalSynopsis,
    originalTags,
    title: toTaiwanTraditional(originalTitle),
    synopsis: toTaiwanTraditional(originalSynopsis),
    tags: originalTags.map(toTaiwanTraditional),
  };
}

function traditionalizeSeason(season: Season): Season {
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
 * 批次工具只處理有紅果來源、且仍可追溯原文的欄位；個人備註永不轉換。
 * 已經保存 originalTitle/originalSynopsis 的資料會從原文重建，不反覆轉換。
 */
export function traditionalizeHongguoWork(work: Work): Work {
  const hasHongguo = !!work.source || work.seasons.some((s) => !!s.source);
  if (!hasHongguo) return work;
  const originalTitle = work.originalTitle ?? work.title;
  const originalSynopsis = work.originalSynopsis ?? work.synopsis;
  return {
    ...work,
    originalTitle,
    originalSynopsis,
    title: toTaiwanTraditional(originalTitle),
    synopsis: toTaiwanTraditional(originalSynopsis),
    aliases: Array.from(
      new Set([...work.aliases, originalTitle, toTaiwanTraditional(originalTitle)]),
    ),
    categories: work.categories.map(toTaiwanTraditional),
    tags: work.tags.map(toTaiwanTraditional),
    seasons: work.seasons.map(traditionalizeSeason),
  };
}
