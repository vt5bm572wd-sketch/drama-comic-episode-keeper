import type { OnlineWork } from "./hongguo-data";

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
