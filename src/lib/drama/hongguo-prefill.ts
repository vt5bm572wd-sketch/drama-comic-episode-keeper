import { normalizeTitle } from "./domain";
import { guessWorkType, tagsToCategories, type OnlineWork } from "./hongguo-data";
import { parseSeriesIdentity } from "./series-identity";
import { traditionalizeOnlineWork } from "./traditional-chinese";

/**
 * 將紅果作品資料轉成新增作品表單可直接使用的欄位。
 * 顯示與系列判斷一律使用台灣繁體；來源原文只保留在 original* 欄位。
 */
export function buildHongguoPrefill(work: OnlineWork) {
  const normalized = traditionalizeOnlineWork(work);
  const identity = parseSeriesIdentity(normalized.title);

  return {
    title: identity.baseTitle,
    originalTitle: normalized.originalTitle ?? work.originalTitle ?? work.title,
    originalSynopsis: normalized.originalSynopsis ?? work.originalSynopsis ?? work.synopsis,
    seriesKey: identity.key || normalizeTitle(identity.baseTitle),
    seasonTitle: normalized.title,
    seasonNumber: identity.seasonNumber,
    cover: normalized.coverUrl,
    synopsis: normalized.synopsis,
    actors: normalized.actors,
    tags: normalized.tags,
    categories: tagsToCategories(normalized.tags),
    type: guessWorkType(normalized),
    totalEpisodes: normalized.totalEpisodes,
  };
}
