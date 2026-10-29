import { normalizeTitle } from "./domain";
import { toTaiwanTraditional } from "./traditional-chinese";
import type { Work } from "./types";

const CN_NUMBER: Record<string, number> = {
  一: 1,
  二: 2,
  兩: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function parseNumber(value: string): number | null {
  if (/^\d+$/.test(value)) return Number(value);
  if (value === "十") return 10;
  if (value.startsWith("十")) return 10 + (CN_NUMBER[value.slice(1)] ?? 0);
  if (value.endsWith("十")) return (CN_NUMBER[value.slice(0, -1)] ?? 0) * 10;
  if (value.includes("十")) {
    const [a, b] = value.split("十");
    return (CN_NUMBER[a ?? ""] ?? 0) * 10 + (CN_NUMBER[b ?? ""] ?? 0);
  }
  return CN_NUMBER[value] ?? null;
}

export interface SeriesIdentity {
  baseTitle: string;
  key: string;
  seasonNumber: number | null;
  explicitSeason: boolean;
  sequelOnly: boolean;
}

export function parseSeriesIdentity(title: string): SeriesIdentity {
  const cleaned = title
    .trim()
    .replace(/^《|》$/g, "")
    .trim();
  const patterns: RegExp[] = [
    /(?:[\s·:：\-—]|^)*第\s*([一二兩三四五六七八九十百\d]+)\s*[季部]\s*$/i,
    /(?:[\s·:：\-—]|^)S(?:eason)?\s*([\d]+)\s*$/i,
    /(?:[\s·:：\-—]|^)Season\s*([\d]+)\s*$/i,
    // 紅果常把續季直接寫在劇名尾端，例如《顏心未改2》、《遇棠方知涉3》。
    // 僅接受 2–20，且數字前不得還是數字，避免把年份或劇名數字誤當季數。
    /[\s·:：\-—]*(?<!\d)([2-9]|1\d|20)\s*$/,
  ];
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (!match || match.index == null) continue;
    const number = parseNumber(match[1] ?? "");
    if (!number || number < 1) continue;
    const baseTitle = cleaned
      .slice(0, match.index)
      .replace(/[（(\s·:：\-—]+$/g, "")
      .trim();
    if (baseTitle) {
      return {
        baseTitle,
        key: normalizeTitle(toTaiwanTraditional(baseTitle)),
        seasonNumber: number,
        explicitSeason: true,
        sequelOnly: false,
      };
    }
  }
  const sequel = cleaned.match(/(?:[\s·:：\-—]|^)[（(]?(續集|续集)[）)]?\s*$/);
  if (sequel?.index != null) {
    const baseTitle = cleaned
      .slice(0, sequel.index)
      .replace(/[（(\s·:：\-—]+$/g, "")
      .trim();
    if (baseTitle)
      return {
        baseTitle,
        key: normalizeTitle(toTaiwanTraditional(baseTitle)),
        seasonNumber: null,
        explicitSeason: true,
        sequelOnly: true,
      };
  }
  return {
    baseTitle: cleaned,
    key: normalizeTitle(toTaiwanTraditional(cleaned)),
    seasonNumber: 1,
    explicitSeason: false,
    sequelOnly: false,
  };
}

function bigrams(value: string): Set<string> {
  const s = normalizeTitle(value);
  if (s.length < 2) return new Set([s]);
  return new Set(Array.from({ length: s.length - 1 }, (_, i) => s.slice(i, i + 2)));
}

export function titleSimilarity(a: string, b: string): number {
  const aa = bigrams(a);
  const bb = bigrams(b);
  let overlap = 0;
  for (const token of aa) if (bb.has(token)) overlap++;
  return aa.size + bb.size ? (2 * overlap) / (aa.size + bb.size) : 0;
}

export type SeriesMatch =
  | { kind: "none"; identity: SeriesIdentity }
  | { kind: "confirmed"; identity: SeriesIdentity; target: Work }
  | { kind: "possible"; identity: SeriesIdentity; target: Work };

export function findSeriesMatch(works: Work[], incoming: Work): SeriesMatch {
  const season = incoming.seasons[0];
  // The form displays a base title but the imported season keeps the full sequel title.
  // Check all title fields so a missing season.title cannot silently discard "2".
  const candidates = [season?.title, season?.originTitle, season?.originalTitle,
    incoming.originalTitle, incoming.title].filter((value): value is string => !!value);
  const identity = candidates.map(parseSeriesIdentity).find((item) => item.explicitSeason)
    ?? parseSeriesIdentity(incoming.title);
  if (!identity.explicitSeason || !identity.seasonNumber) return { kind: "none", identity };
  const exact = works.find((work) =>
    [work.title, work.originalTitle, work.seriesKey, ...work.aliases].some(
      (title) => title && parseSeriesIdentity(title).key === identity.key,
    ),
  );
  if (exact) {
    return exact.seasons.some((s) => s.number === identity.seasonNumber)
      ? { kind: "possible", identity, target: exact }
      : { kind: "confirmed", identity, target: exact };
  }
  return { kind: "none", identity };
}
