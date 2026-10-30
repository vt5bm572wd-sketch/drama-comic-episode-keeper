import type { OnlineWork } from "./hongguo-data";

export type HomeSectionId =
  | "stats"
  | "continue"
  | "newEpisodes"
  | "newSeason"
  | "upcoming"
  | "announced"
  | "recommendations"
  | "comicRanking"
  | "aiRanking"
  | "recent"
  | "categories";

export interface HomeSectionPreference {
  id: HomeSectionId;
  enabled: boolean;
  collapsed: boolean;
}

export const DEFAULT_HOME_SECTIONS: HomeSectionPreference[] = [
  { id: "stats", enabled: true, collapsed: false },
  { id: "continue", enabled: true, collapsed: false },
  { id: "newEpisodes", enabled: true, collapsed: false },
  { id: "newSeason", enabled: true, collapsed: false },
  { id: "upcoming", enabled: true, collapsed: false },
  { id: "announced", enabled: true, collapsed: false },
  { id: "recommendations", enabled: true, collapsed: false },
  { id: "comicRanking", enabled: true, collapsed: false },
  { id: "aiRanking", enabled: true, collapsed: false },
  { id: "recent", enabled: true, collapsed: false },
  { id: "categories", enabled: true, collapsed: false },
];

export function parseHeat(value: string | null): number | null {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/([0-9]+(?:\.[0-9]+)?)\s*(億|万|萬|千)?/);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const unit = match[2];
  return (
    amount *
    (unit === "億"
      ? 100_000_000
      : unit === "万" || unit === "萬"
        ? 10_000
        : unit === "千"
          ? 1_000
          : 1)
  );
}

/** 穩定排序：有可靠熱度者由高到低，無熱度者保留來源順序。 */
export function sortOnlineByHeat(items: OnlineWork[]): OnlineWork[] {
  return items
    .map((item, index) => ({ item, index, heat: parseHeat(item.heat) }))
    .sort((a, b) => {
      if (a.heat !== null && b.heat !== null) return b.heat - a.heat || a.index - b.index;
      if (a.heat !== null) return -1;
      if (b.heat !== null) return 1;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}

export interface RecommendationFeedback {
  hiddenSeriesIds: string[];
  downrankedTags: string[];
}

export const EMPTY_RECOMMENDATION_FEEDBACK: RecommendationFeedback = {
  hiddenSeriesIds: [],
  downrankedTags: [],
};

export function recommendationScore(
  tags: string[],
  preferences: Map<string, number>,
  feedback: RecommendationFeedback,
): number {
  const downranked = new Set(feedback.downrankedTags.map((tag) => tag.toLocaleLowerCase()));
  return tags.reduce((sum, tag) => {
    const normalized = tag.toLocaleLowerCase();
    return sum + (preferences.get(normalized) ?? 0) - (downranked.has(normalized) ? 100 : 0);
  }, 0);
}
