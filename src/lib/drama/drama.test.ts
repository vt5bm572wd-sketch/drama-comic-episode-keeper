import { describe, expect, it } from "vitest";
import { createBackup, parseBackup } from "./backup";
import { buildDemoWorks } from "./demo";
import {
  clampEpisode,
  computeStats,
  makeSeason,
  mergeIntoSeries,
  searchWorks,
  setSeasonProgress,
  stepEpisode,
} from "./domain";
import { MemoryRepository } from "./repository";
import { createDramaStore } from "./store";
import type { Work } from "./types";

const NOW = "2026-10-22T00:00:00.000Z";

function work(partial: Partial<Work> & { id: string; title: string }): Work {
  const seasons = partial.seasons ?? [
    makeSeason({ id: `${partial.id}_s1`, number: 1, totalEpisodes: 10 }, NOW),
  ];
  return {
    aliases: [],
    cover: null,
    synopsis: "",
    actors: [],
    type: "short",
    categories: [],
    tags: [],
    collectStatus: "collected",
    watchStatus: "want",
    watchStatusMode: "auto",
    rating: 0,
    note: "",
    currentSeasonId: seasons[0]?.id ?? null,
    isDemo: false,
    createdAt: NOW,
    updatedAt: NOW,
    lastWatchedAt: null,
    ...partial,
    seasons,
  };
}

describe("集數限制", () => {
  it("集數不得小於 0", () => {
    expect(clampEpisode(-3, 10)).toBe(0);
  });
  it("集數不得超過該季總集數", () => {
    expect(clampEpisode(15, 10)).toBe(10);
  });
  it("在第 0 集按上一集仍為 0", () => {
    const w = work({ id: "a", title: "A" });
    expect(stepEpisode(w, "a_s1", -1).seasons[0]?.watchedEpisodes).toBe(0);
  });
  it("在最後一集按下一集不會超過總集數", () => {
    const w = setSeasonProgress(work({ id: "a", title: "A" }), "a_s1", 10, NOW);
    expect(stepEpisode(w, "a_s1", 1).seasons[0]?.watchedEpisodes).toBe(10);
  });
});

describe("觀看進度", () => {
  it("下一集會讓已看集數 +1 並記錄最近觀看", () => {
    const w = stepEpisode(work({ id: "a", title: "A" }), "a_s1", 1, NOW);
    expect(w.seasons[0]?.watchedEpisodes).toBe(1);
    expect(w.lastWatchedAt).toBe(NOW);
  });
  it("觀看進度會自動同步系列狀態", () => {
    const w = stepEpisode(work({ id: "a", title: "A" }), "a_s1", 1, NOW);
    expect(w.watchStatus).toBe("watching");
  });
  it("追上可靠總集數會自動標記完成", () => {
    const w = setSeasonProgress(work({ id: "a", title: "A" }), "a_s1", 10, NOW);
    expect(w.watchStatus).toBe("waiting");
    expect(w.seasons[0]?.status).toBe("completed");
  });
  it("更新某季進度時會設為目前觀看季", () => {
    const w = work({
      id: "a",
      title: "A",
      seasons: [
        makeSeason({ id: "s1", number: 1, totalEpisodes: 10 }, NOW),
        makeSeason({ id: "s2", number: 2, totalEpisodes: 12 }, NOW),
      ],
    });
    expect(stepEpisode(w, "s2", 1, NOW).currentSeasonId).toBe("s2");
  });
});

describe("多季合併", () => {
  it("合併後原作品的季數接在最後並保留觀看進度", () => {
    const target = work({ id: "t", title: "作品 A" });
    const source = work({
      id: "s",
      title: "作品 A 第二部",
      seasons: [
        makeSeason(
          { id: "x1", number: 1, totalEpisodes: 20, watchedEpisodes: 7, note: "看到第 7 集" },
          NOW,
        ),
      ],
    });
    const merged = mergeIntoSeries(target, source, NOW);
    expect(merged.seasons).toHaveLength(2);
    const moved = merged.seasons.find((s) => s.id === "x1");
    expect(moved?.number).toBe(2);
    expect(moved?.watchedEpisodes).toBe(7);
    expect(moved?.note).toBe("看到第 7 集");
    expect(merged.aliases).toContain("作品 A 第二部");
  });
});

describe("統計", () => {
  it("依實際資料計算收藏總數、追劇中、已完結", () => {
    const list = [
      work({ id: "1", title: "1", watchStatus: "watching" }),
      work({ id: "2", title: "2", watchStatus: "completed" }),
      work({ id: "3", title: "3", watchStatus: "want" }),
    ];
    expect(computeStats(list)).toEqual({ total: 3, watching: 1, completed: 1 });
  });
});

describe("搜尋", () => {
  const list = [
    work({
      id: "1",
      title: "雪落長安",
      aliases: ["長安雪"],
      actors: ["王小明"],
      categories: ["古裝"],
      tags: ["宮廷"],
      synopsis: "郡主重返京城",
    }),
    work({ id: "2", title: "霓虹契約" }),
  ];
  it.each([
    ["劇名", "長安"],
    ["別名", "安雪"],
    ["分類", "古裝"],
    ["標籤", "宮廷"],
    ["簡介", "重返"],
  ])("可用%s部分文字找到作品", (_label, q) => {
    expect(searchWorks(list, q).map((w) => w.id)).toEqual(["1"]);
  });
  it("沒有結果時回傳空陣列", () => {
    expect(searchWorks(list, "不存在的劇")).toEqual([]);
  });
});

describe("JSON 匯入驗證", () => {
  it("不是 JSON 時拒絕匯入", () => {
    expect(parseBackup("not json", []).ok).toBe(false);
  });
  it("同 ID 或同劇名的作品標示為重複，不會列入新增", () => {
    const existing = [work({ id: "a", title: "雪落長安" })];
    const backup = createBackup([
      work({ id: "a", title: "改名了" }),
      work({ id: "b", title: "《雪落長安》" }),
      work({ id: "c", title: "全新作品" }),
    ]);
    const r = parseBackup(JSON.stringify(backup), existing);
    if (!r.ok) throw new Error(r.error);
    expect(r.preview.fresh.map((w) => w.id)).toEqual(["c"]);
    expect(r.preview.duplicates).toHaveLength(2);
  });
  it("缺少劇名或季數的資料列為格式錯誤", () => {
    const r = parseBackup(JSON.stringify({ works: [{ type: "short", seasons: [] }] }), []);
    if (!r.ok) throw new Error(r.error);
    expect(r.preview.invalid).toHaveLength(1);
    expect(r.preview.fresh).toHaveLength(0);
  });
});

describe("資料存取與示範資料", () => {
  it("首次開啟會載入 6 至 8 部標示為示範的作品", () => {
    const store = createDramaStore(new MemoryRepository(null));
    const list = store.getSnapshot();
    expect(list.length).toBeGreaterThanOrEqual(6);
    expect(list.length).toBeLessThanOrEqual(8);
    expect(list.every((w) => w.isDemo)).toBe(true);
  });
  it("示範資料包含單季、多季、漫劇、已完結與追劇中", () => {
    const demo = buildDemoWorks();
    expect(demo.some((w) => w.seasons.length === 1)).toBe(true);
    expect(demo.some((w) => w.seasons.length > 1)).toBe(true);
    expect(demo.some((w) => w.type === "comic")).toBe(true);
    expect(demo.some((w) => w.watchStatus === "completed")).toBe(true);
    expect(demo.some((w) => w.watchStatus === "watching")).toBe(true);
  });
  it("移除示範資料只刪除示範作品", () => {
    const repo = new MemoryRepository(null);
    const store = createDramaStore(repo);
    store.add(work({ id: "mine", title: "我的作品" }));
    store.removeDemo();
    expect(store.getSnapshot().map((w) => w.id)).toEqual(["mine"]);
  });
  it("資料寫入儲存層，重新載入後仍存在", () => {
    const repo = new MemoryRepository([]);
    createDramaStore(repo).add(work({ id: "mine", title: "我的作品" }));
    expect(
      createDramaStore(repo)
        .getSnapshot()
        .map((w) => w.id),
    ).toEqual(["mine"]);
  });
  it("清空後為空資料，且不會自動補回示範資料", () => {
    const repo = new MemoryRepository(null);
    createDramaStore(repo).clearAll();
    expect(createDramaStore(repo).getSnapshot()).toEqual([]);
  });
  it("匯入選擇略過時不覆蓋現有作品", () => {
    const repo = new MemoryRepository([work({ id: "a", title: "原本", note: "原備註" })]);
    const store = createDramaStore(repo);
    store.importWorks([], "skip", [work({ id: "a", title: "原本", note: "新備註" })]);
    expect(store.getSnapshot()).toHaveLength(1);
    expect(store.get("a")?.note).toBe("原備註");
  });
});
