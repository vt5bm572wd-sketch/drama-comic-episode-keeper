import { normalizeTitle } from "./domain";
import { guessWorkType, tagsToCategories, type OnlineWork } from "./hongguo-data";
import { PRESET_CATEGORIES } from "./labels";
import { extractStoryTags, makeHookedSynopsis, matchExistingCategories } from "./content-intelligence";
import { parseSeriesIdentity } from "./series-identity";
import { traditionalizeOnlineWork } from "./traditional-chinese";

/**
 * 將紅果作品資料轉成新增作品表單可直接使用的欄位。
 * 顯示與系列判斷一律使用台灣繁體；來源原文只保留在 original* 欄位。
 * 智能標籤與簡介全部在本機以規則處理，不呼叫付費 API。
 */
export function buildHongguoPrefill(work: OnlineWork, availableCategories: string[] = PRESET_CATEGORIES) {
  const normalized = traditionalizeOnlineWork(work);
  const identity = parseSeriesIdentity(normalized.title);
  const analysisInput = {
    title: normalized.title,
    synopsis: normalized.synopsis,
    sourceTags: normalized.tags,
  };
  const sourceCategories = tagsToCategories(normalized.tags);
  const matchedCategories = matchExistingCategories(analysisInput, availableCategories);
  const categories = [...new Set([...sourceCategories, ...matchedCategories])]
    .filter((category) => availableCategories.includes(category));
  const storyTags = extractStoryTags(analysisInput);
  const tags = [...new Set([...storyTags, ...normalized.tags])].slice(0, 10);

  return {
    title: identity.baseTitle,
    originalTitle: normalized.originalTitle ?? work.originalTitle ?? work.title,
    originalSynopsis: normalized.originalSynopsis ?? work.originalSynopsis ?? work.synopsis,
    seriesKey: identity.key || normalizeTitle(identity.baseTitle),
    seasonTitle: normalized.title,
    seasonNumber: identity.seasonNumber,
    cover: normalized.coverUrl,
    synopsis: makeHookedSynopsis(normalized.synopsis),
    actors: normalized.actors,
    tags,
    categories,
    type: guessWorkType(normalized),
    totalEpisodes: normalized.totalEpisodes,
  };
}
