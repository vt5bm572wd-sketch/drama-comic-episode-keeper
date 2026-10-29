import { describe, expect, it } from "vitest";
import { makeSeason } from "./domain";
import { buildSourceUpdate } from "./source-update";
import type { OnlineWork } from "./hongguo-data";
import type { Work } from "./types";

describe("紅果資料差異更新", () => {
  it("更新來源欄位但保留進度、評分、備註與自訂分類", () => {
    const stamp = "2026-10-29T00:00:00.000Z";
    const source = {
      platform: "hongguo" as const,
      seriesId: "1234567890123456789",
      url: "https://hongguoduanju.com/detail?series_id=1234567890123456789",
      linkedAt: stamp,
    };
    const work: Work = {
      id: "work",
      title: "舊劇名",
      aliases: [],
      cover: null,
      synopsis: "舊簡介",
      actors: [],
      type: "short",
      categories: ["自訂題材"],
      customCategories: ["private"],
      tags: ["舊標籤"],
      collectStatus: "favorite",
      watchStatus: "watching",
      watchStatusMode: "auto",
      rating: 5,
      note: "私人備註",
      seasons: [
        {
          ...makeSeason(
            {
              id: "season",
              number: 1,
              totalEpisodes: 10,
              currentEpisodes: 10,
              watchedEpisodes: 7,
              note: "本季備註",
            },
            stamp,
          ),
          source,
        },
      ],
      currentSeasonId: "season",
      isDemo: false,
      createdAt: stamp,
      updatedAt: stamp,
      lastWatchedAt: stamp,
      source,
    };
    const online: OnlineWork = {
      seriesId: source.seriesId,
      title: "新劇名",
      originalTitle: "新剧名",
      coverUrl: "https://example.byteimg.com/cover.jpg",
      synopsis: "新簡介",
      originalSynopsis: "新简介",
      actors: ["演員"],
      tags: ["戀愛"],
      totalEpisodes: 12,
      heat: null,
      rating: null,
      sourceUrl: source.url,
    };
    const updated = buildSourceUpdate(work, online, stamp);
    expect(updated).toMatchObject({
      title: "新劇名",
      rating: 5,
      note: "私人備註",
      customCategories: ["private"],
      collectStatus: "favorite",
    });
    expect(updated.categories).toContain("自訂題材");
    expect(updated.seasons[0]).toMatchObject({
      currentEpisodes: 12,
      watchedEpisodes: 7,
      note: "本季備註",
    });
  });
});
