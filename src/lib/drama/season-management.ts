import { parseSeriesIdentity, titleSimilarity } from "./series-identity";
import type { OnlineWork } from "./hongguo-data";
import type { WatchStatus, Work } from "./types";

export type SeasonConfidence = "high" | "medium" | "low";
export interface SeasonCandidate {
  id: string;
  workId: string;
  title: string;
  seriesId: string;
  totalEpisodes: number | null;
  seasonNumber: number | null;
  confidence: SeasonConfidence;
  missingSeasons: number[];
  sameSeason: boolean;
}

const existingIds = (work: Work) =>
  new Set(
    work.seasons
      .flatMap((season) => [
        season.source?.seriesId,
        ...(season.sources ?? []).map((source) => source.seriesId),
      ])
      .filter(Boolean),
  );
const candidateId = (workId: string, seriesId: string) => `${workId}:${seriesId}`;

/** Pure, conservative matcher. It only proposes; it never writes a collection. */
export function findSeasonCandidates(work: Work, results: OnlineWork[]): SeasonCandidate[] {
  const titles = [work.title, work.originalTitle, ...work.aliases].filter(
    (value): value is string => !!value,
  );
  const keys = new Set(titles.map((title) => parseSeriesIdentity(title).key));
  const ids = existingIds(work);
  const found: SeasonCandidate[] = [];
  for (const online of results) {
    if (ids.has(online.seriesId)) continue;
    const identity = parseSeriesIdentity(online.originalTitle ?? online.title);
    const similarity = Math.max(
      ...titles.map((title) =>
        titleSimilarity(identity.baseTitle, parseSeriesIdentity(title).baseTitle),
      ),
    );
    const related = keys.has(identity.key) || similarity >= 0.72;
    if (!related) continue;
    // A plain title with no sequel clue is the original work, not a new-season lead.
    if (!identity.explicitSeason) continue;
    const sameSeason =
      identity.seasonNumber != null && work.seasons.some((s) => s.number === identity.seasonNumber);
    const missingSeasons =
      identity.seasonNumber == null
        ? []
        : Array.from(
            { length: Math.max(0, identity.seasonNumber - 2) },
            (_, index) => index + 2,
          ).filter((number) => !work.seasons.some((s) => s.number === number));
    const confidence: SeasonConfidence =
      keys.has(identity.key) && identity.seasonNumber != null
        ? "high"
        : similarity >= 0.85
          ? "medium"
          : "low";
    found.push({
      id: candidateId(work.id, online.seriesId),
      workId: work.id,
      title: online.title,
      seriesId: online.seriesId,
      totalEpisodes: online.totalEpisodes,
      seasonNumber: identity.seasonNumber,
      confidence,
      missingSeasons,
      sameSeason,
    });
  }
  return found.sort((a, b) =>
    a.sameSeason === b.sameSeason
      ? (b.totalEpisodes ?? 0) - (a.totalEpisodes ?? 0)
      : Number(a.sameSeason) - Number(b.sameSeason),
  );
}

export function sortWorksForSeasonCheck(works: Work[]): Work[] {
  const rank: Partial<Record<WatchStatus, number>> = {
    completed: 0,
    watching: 1,
    waiting: 1,
    unwatched: 2,
    want: 2,
    pending: 2,
    paused: 3,
    dropped: 3,
  };
  return [...works].sort(
    (a, b) =>
      (rank[a.watchStatus] ?? 4) - (rank[b.watchStatus] ?? 4) ||
      a.title.localeCompare(b.title, "zh-Hant"),
  );
}

export function seasonSearchTerms(work: Work): string[] {
  return Array.from(
    new Set(
      [work.title, work.originalTitle, ...work.aliases]
        .filter((value): value is string => !!value)
        .map((value) => parseSeriesIdentity(value).baseTitle),
    ),
  ).slice(0, 3);
}

/** Bounded retry helper. The caller owns persistence and decides whether an error is retryable. */
export async function retryWithBackoff<T>(
  task: () => Promise<T>,
  options: {
    attempts?: number;
    baseDelayMs?: number;
    wait?: (milliseconds: number) => Promise<void>;
  } = {},
): Promise<T> {
  const attempts = Math.max(1, Math.min(options.attempts ?? 3, 3));
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 600);
  const wait =
    options.wait ??
    ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let failure: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await task();
    } catch (error) {
      failure = error;
      if (attempt < attempts - 1) await wait(baseDelayMs * 2 ** attempt);
    }
  }
  throw failure;
}
