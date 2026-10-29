import { migrateWork } from "./domain";
import { traditionalizeHongguoWork } from "./traditional-chinese";
import type { Season, WatchStatus, Work } from "./types";

export function normalizeLegacyWatchStatus(status: WatchStatus | undefined): WatchStatus {
  return !status || status === "want" ? "unwatched" : status;
}

function normalizeSeason(season: Season): Season {
  const status = normalizeLegacyWatchStatus(season.status);
  return status === season.status ? season : { ...season, status };
}

/**
 * Runtime/storage normalization for V3.
 * - converts legacy `want` into the single canonical `unwatched` state
 * - traditionalizes only Hongguo-sourced display metadata
 * - preserves private notes, ratings, progress, source IDs/URLs and timestamps
 */
export function normalizeDramaWork(work: Work): Work {
  const migrated = migrateWork(work);
  const normalized: Work = {
    ...migrated,
    watchStatus: normalizeLegacyWatchStatus(migrated.watchStatus),
    seasons: migrated.seasons.map(normalizeSeason),
  };
  return traditionalizeHongguoWork(normalized);
}

export function normalizeDramaWorks(works: Work[]): Work[] {
  return works.map(normalizeDramaWork);
}
