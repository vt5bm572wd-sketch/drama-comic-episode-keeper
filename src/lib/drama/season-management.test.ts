import { describe, expect, it } from "vitest";
import { makeSeason } from "./domain";
import { MemoryRepository } from "./repository";
import { findSeasonCandidates, sortWorksForSeasonCheck } from "./season-management";
import { createDramaStore } from "./store";
import type { OnlineWork } from "./hongguo-data";
import type { Work } from "./types";

const stamp = "2026-11-09T00:00:00.000Z";
function work(status: Work["watchStatus"] = "completed"): Work {
  const first = makeSeason(
    {
      id: "s1",
      number: 1,
      title: "顏心未改",
      totalEpisodes: 50,
      watchedEpisodes: 50,
      status,
      statusMode: "manual",
      rating: 5,
      note: "第一季筆記",
      watchMemory: { plot: "第一季結局" },
      source: {
        platform: "hongguo",
        seriesId: "1000000000000000001",
        url: "https://hongguoduanju.com/detail?series_id=1000000000000000001",
        linkedAt: stamp,
      },
    },
    stamp,
  );
  return {
    id: "work",
    title: "顏心未改",
    aliases: ["顏心未改第一季"],
    cover: null,
    synopsis: "",
    actors: [],
    type: "short",
    categories: [],
    tags: [],
    collectStatus: "favorite",
    watchStatus: status,
    watchStatusMode: "manual",
    rating: 5,
    note: "系列筆記",
    seasons: [first],
    currentSeasonId: "s1",
    isDemo: false,
    createdAt: stamp,
    updatedAt: stamp,
    lastWatchedAt: null,
  };
}
function online(
  title: string,
  seriesId = "1000000000000000002",
  totalEpisodes: number | null = 60,
): OnlineWork {
  return {
    seriesId,
    title,
    coverUrl: null,
    synopsis: "",
    actors: [],
    tags: [],
    totalEpisodes,
    heat: null,
    rating: null,
    sourceUrl: `https://hongguoduanju.com/detail?series_id=${seriesId}`,
  };
}

describe("新季候選辨識", () => {
  it("辨識劇名2、第二季、S2、第二部，並不把一般相似作品加入", () => {
    const found = findSeasonCandidates(work(), [
      online("顏心未改2"),
      online("顏心未改第二季", "1000000000000000003"),
      online("顏心未改 S2", "1000000000000000004"),
      online("顏心未改第二部", "1000000000000000005"),
      online("顏心未改2026", "1000000000000000006"),
      online("顏心未改番外", "1000000000000000007"),
    ]);
    expect(found.map((candidate) => candidate.seasonNumber)).toEqual([2, 2, 2, 2, null]);
    expect(found.some((candidate) => candidate.seriesId.endsWith("06"))).toBe(false);
  });
  it("同季不同 ID 不會當作可新增新季", () => {
    const found = findSeasonCandidates(work(), [online("顏心未改", "1000000000000000009")]);
    expect(found).toHaveLength(0);
    expect(
      findSeasonCandidates(work(), [online("顏心未改第一季", "1000000000000000009")])[0]
        ?.sameSeason,
    ).toBe(true);
  });
  it("依已看完、追劇中、想看、暫停排序，且沒有排除任何收藏", () => {
    expect(
      sortWorksForSeasonCheck([
        work("paused"),
        { ...work("unwatched"), id: "want" },
        { ...work("watching"), id: "watching" },
        { ...work("completed"), id: "done" },
      ]).map((item) => item.id),
    ).toEqual(["done", "watching", "want", "work"]);
  });
});

describe("確認加入的新季資料保護", () => {
  it("只新增第二季，保留第一季、currentSeasonId、記憶、評分與來源 ID", () => {
    const original = work();
    const store = createDramaStore(new MemoryRepository([original]));
    const result = store.addDiscoveredSeason("work", {
      number: 2,
      title: "顏心未改第二季",
      totalEpisodes: null,
      seriesId: "1000000000000000002",
    });
    expect(result.ok).toBe(true);
    const saved = store.get("work")!;
    expect(saved.currentSeasonId).toBe("s1");
    expect(saved.seasons[0]).toMatchObject({
      watchedEpisodes: 50,
      rating: 5,
      note: "第一季筆記",
      watchMemory: { plot: "第一季結局" },
    });
    expect(saved.seasons[0]?.source?.seriesId).toBe("1000000000000000001");
    expect(saved.seasons[1]).toMatchObject({
      number: 2,
      watchedEpisodes: 0,
      totalEpisodes: 0,
      episodeCountKnown: false,
      rating: 0,
      watchMemory: {},
    });
  });
  it("重複季或重複來源一律不寫入", () => {
    const store = createDramaStore(new MemoryRepository([work()]));
    expect(
      store.addDiscoveredSeason("work", {
        number: 1,
        title: "顏心未改",
        totalEpisodes: 50,
        seriesId: "9999999999999999999",
      }).ok,
    ).toBe(false);
    expect(
      store.addDiscoveredSeason("work", {
        number: 2,
        title: "顏心未改2",
        totalEpisodes: 50,
        seriesId: "1000000000000000001",
      }).ok,
    ).toBe(false);
    expect(store.get("work")!.seasons).toHaveLength(1);
  });
});
