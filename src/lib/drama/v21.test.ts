import { describe, expect, it } from "vitest";
import {
  currentSeason,
  newlyAddedSeason,
  newlyAvailableSeasons,
  setSeasonProgress,
} from "./domain";
import type { OnlineWork } from "./hongguo-data";
import type { Season, Work } from "./types";
import { parseHeat, recommendationScore, sortOnlineByHeat } from "./v21";

const season = (patch: Partial<Season> & Pick<Season, "id" | "number">): Season => ({
  totalEpisodes: 20,
  currentEpisodes: 20,
  watchedEpisodes: 0,
  status: "unwatched",
  note: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...patch,
});

const work = (seasons: Season[], patch: Partial<Work> = {}): Work => ({
  id: "w1",
  title: "測試劇",
  aliases: [],
  cover: null,
  synopsis: "",
  actors: [],
  type: "comic",
  categories: [],
  tags: [],
  collectStatus: "collected",
  watchStatus: "unwatched",
  rating: 0,
  note: "系列備註",
  seasons,
  currentSeasonId: seasons[0]?.id ?? null,
  isDemo: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  lastWatchedAt: null,
  seriesStatus: "ongoing",
  ...patch,
});

const online = (seriesId: string, heat: string | null): OnlineWork => ({
  seriesId,
  heat,
  title: seriesId,
  coverUrl: null,
  synopsis: "",
  actors: [],
  tags: [],
  totalEpisodes: 1,
  rating: null,
  sourceUrl: `https://hongguoduanju.com/detail?series_id=${seriesId}`,
});

describe("V2.1 tracking rules", () => {
  it("defaults to the actively watching season", () => {
    const w = work([
      season({ id: "s1", number: 1, watchedEpisodes: 20, status: "waiting" }),
      season({ id: "s2", number: 2, watchedEpisodes: 3, status: "watching" }),
    ]);
    expect(currentSeason(w)?.id).toBe("s2");
  });

  it("records the latest episode count after catching up", () => {
    const next = setSeasonProgress(work([season({ id: "s1", number: 1 })]), "s1", 20);
    expect(next.seasons[0]?.caughtUpEpisodes).toBe(20);
  });

  it("only flags episodes added after the user previously caught up", () => {
    const caughtUp = season({
      id: "s1",
      number: 1,
      watchedEpisodes: 20,
      currentEpisodes: 24,
      caughtUpEpisodes: 20,
      status: "waiting",
    });
    const neverCaughtUp = season({
      id: "s2",
      number: 2,
      watchedEpisodes: 5,
      currentEpisodes: 24,
      status: "watching",
    });
    expect(newlyAvailableSeasons(work([caughtUp, neverCaughtUp])).map((x) => x.id)).toEqual(["s1"]);
  });

  it("finds a pending higher season without resetting older seasons", () => {
    const oldSeason = season({
      id: "s1",
      number: 1,
      watchedEpisodes: 20,
      status: "completed",
      note: "保留",
    });
    const nextSeason = season({ id: "s2", number: 2, status: "pending" });
    const w = work([oldSeason, nextSeason]);
    expect(newlyAddedSeason(w)?.id).toBe("s2");
    expect(w.seasons[0]?.note).toBe("保留");
  });

  it("keeps a manual paused/dropped state locked when progress changes", () => {
    const paused = work([season({ id: "s1", number: 1 })], {
      watchStatus: "dropped",
      watchStatusMode: "manual",
    });
    expect(setSeasonProgress(paused, "s1", 1).watchStatus).toBe("dropped");
  });
});

describe("V2.1 online ordering and recommendation feedback", () => {
  it("parses Chinese heat units", () => {
    expect(parseHeat("3726萬熱度")).toBe(37_260_000);
    expect(parseHeat("1.2億")).toBe(120_000_000);
  });

  it("sorts reliable heat high to low and puts missing heat last", () => {
    expect(
      sortOnlineByHeat([online("a", null), online("b", "12萬"), online("c", "3萬")]).map(
        (x) => x.seriesId,
      ),
    ).toEqual(["b", "c", "a"]);
  });

  it("preserves source order when heat is missing or tied", () => {
    expect(sortOnlineByHeat([online("a", null), online("b", null)]).map((x) => x.seriesId)).toEqual(
      ["a", "b"],
    );
    expect(
      sortOnlineByHeat([online("c", "3萬"), online("d", "3萬")]).map((x) => x.seriesId),
    ).toEqual(["c", "d"]);
  });

  it("strongly downranks unwanted tags", () => {
    const prefs = new Map([
      ["霸總", 8],
      ["甜寵", 5],
    ]);
    expect(
      recommendationScore(["霸總"], prefs, { hiddenSeriesIds: [], downrankedTags: ["霸總"] }),
    ).toBeLessThan(
      recommendationScore(["甜寵"], prefs, { hiddenSeriesIds: [], downrankedTags: ["霸總"] }),
    );
  });
});
