import { recalculateWorkStatus } from "./domain";
import { guessWorkType, tagsToCategories, type OnlineWork } from "./hongguo-data";
import type { Season, Work } from "./types";

/** 建立紅果更新草稿；個人欄位一律沿用收藏中的值。 */
export function buildSourceUpdate(work: Work, online: OnlineWork, stamp: string): Work {
  const seasons = work.seasons.map((season) => {
    const matches =
      season.source?.seriesId === online.seriesId ||
      season.sources?.some((source) => source.seriesId === online.seriesId);
    if (!matches || online.totalEpisodes == null) return season;
    const total = Math.max(online.totalEpisodes, season.watchedEpisodes);
    return {
      ...season,
      title: online.title,
      originalTitle: online.originalTitle ?? online.title,
      synopsis: online.synopsis,
      originalSynopsis: online.originalSynopsis ?? online.synopsis,
      cover: online.coverUrl ?? season.cover,
      totalEpisodes: total,
      currentEpisodes: total,
      updatedAt: stamp,
    } satisfies Season;
  });

  return recalculateWorkStatus({
    ...work,
    title: online.title || work.title,
    originalTitle: online.originalTitle ?? online.title,
    synopsis: online.synopsis || work.synopsis,
    originalSynopsis: online.originalSynopsis ?? online.synopsis,
    cover: online.coverUrl ?? work.cover,
    actors: online.actors.length ? online.actors : work.actors,
    tags: online.tags.length ? online.tags : work.tags,
    categories: online.tags.length
      ? Array.from(new Set([...work.categories, ...tagsToCategories(online.tags)]))
      : work.categories,
    type: guessWorkType(online),
    seasons,
    updatedAt: stamp,
  });
}
