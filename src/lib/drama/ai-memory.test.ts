import { describe, expect, it } from "vitest";
import { generateAiMemory, mergeRegeneratedMemory, sanitizeAiMemory } from "./ai-memory";
import { makeSeason } from "./domain";
import { MemoryRepository } from "./repository";
import { createDramaStore } from "./store";
import type { AiMemory, Work } from "./types";

const NOW = "2026-10-30T00:00:00.000Z";

function memory(seasonNumber = 1): AiMemory {
  return {
    summary: "本季記憶",
    keyPlots: [
      {
        id: "high",
        text: "已驗證劇情",
        confidence: "high",
        seasonVerified: true,
        sourceCount: 2,
        sourceSeason: seasonNumber,
      },
      {
        id: "low",
        text: "低可信劇情",
        confidence: "low",
        seasonVerified: true,
        sourceCount: 1,
        sourceSeason: seasonNumber,
      },
    ],
    famousScenes: [],
    suggestedTags: ["久別重逢"],
    excludedItems: [],
    generatedAt: NOW,
    model: "test",
    identity: {
      workTitle: "冰冷重遇",
      seasonNumber,
      seriesId: String(1000 + seasonNumber),
      officialSynopsis: "官方簡介",
      mainCharacters: [],
    },
  };
}

function work(): Work {
  return {
    id: "ice",
    title: "冰冷重遇",
    aliases: [],
    cover: null,
    synopsis: "顧景琛與蘇沐妍三年後重逢。",
    actors: [],
    type: "comic",
    categories: [],
    tags: ["豪門"],
    collectStatus: "favorite",
    watchStatus: "watching",
    rating: 5,
    note: "舊系列備註",
    seasons: [
      makeSeason({ id: "s1", number: 1, totalEpisodes: 80, note: "第一季嘴硬" }, NOW),
      makeSeason({ id: "s2", number: 2, totalEpisodes: 60, note: "第二季備註" }, NOW),
    ],
    currentSeasonId: "s1",
    isDemo: false,
    createdAt: NOW,
    updatedAt: NOW,
    lastWatchedAt: null,
  };
}

describe("AI 觀看記憶", () => {
  it("低可信或未通過規則的正式內容會被過濾", () => {
    expect(sanitizeAiMemory(memory()).keyPlots.map((item) => item.id)).toEqual(["high"]);
  });

  it("《冰冷重遇》假資料只寫入第一季身份", async () => {
    const target = work();
    const generated = await generateAiMemory(target, target.seasons[0]!);
    expect(generated.identity.seasonNumber).toBe(1);
    expect(generated.keyPlots).toHaveLength(4);
    expect(generated.excludedItems.some((item) => item.suspectedSeason === 2)).toBe(true);
  });

  it("不同季分開保存，重新載入後仍存在", () => {
    const repo = new MemoryRepository([work()]);
    const store = createDramaStore(repo);
    store.setAiMemory("ice", "s1", memory(1));
    store.setAiMemory("ice", "s2", { ...memory(2), summary: "第二季記憶" });
    const reloaded = createDramaStore(repo).get("ice")!;
    expect(reloaded.seasons[0]?.aiMemory?.identity.seasonNumber).toBe(1);
    expect(reloaded.seasons[1]?.aiMemory?.summary).toBe("第二季記憶");
  });

  it("建議標籤不會自動加入，點擊動作才加入且不重複", () => {
    const store = createDramaStore(new MemoryRepository([work()]));
    store.setAiMemory("ice", "s1", memory(1));
    expect(store.get("ice")?.tags).toEqual(["豪門"]);
    store.addSuggestedTag("ice", "久別重逢");
    store.addSuggestedTag("ice", "久別重逢");
    expect(store.get("ice")?.tags).toEqual(["豪門", "久別重逢"]);
  });

  it("重新生成會保留使用者已收藏的同名名場面", () => {
    const previous = memory();
    previous.famousScenes = [
      {
        id: "old",
        text: "機場重逢",
        title: "機場重逢",
        confidence: "high",
        seasonVerified: true,
        sourceCount: 2,
        favorited: true,
      },
    ];
    const next = memory();
    next.famousScenes = [
      {
        id: "new",
        text: "機場重逢",
        title: "機場重逢",
        confidence: "high",
        seasonVerified: true,
        sourceCount: 3,
      },
    ];
    expect(mergeRegeneratedMemory(previous, next).famousScenes[0]?.favorited).toBe(true);
  });
});
