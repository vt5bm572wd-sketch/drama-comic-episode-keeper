import { beforeEach, describe, expect, it } from "vitest";
import { createBackup, parseBackup } from "./backup";
import {
  filterAndSort,
  makeSeason,
  migrateWork,
  progressHint,
  setSeasonProgress,
  validUpdateDate,
  workTotals,
} from "./domain";
import { LocalStorageRepository, MemoryRepository } from "./repository";
import { createDramaStore } from "./store";
import type { Work } from "./types";

const stamp = "2026-10-27T12:00:00.000Z";
function work(): Work {
  return {
    id: "a",
    title: "驗收作品",
    aliases: [],
    cover: null,
    synopsis: "",
    actors: [],
    type: "short",
    categories: ["古裝"],
    tags: ["重生"],
    collectStatus: "favorite",
    watchStatus: "paused",
    watchStatusMode: "manual",
    rating: 4,
    note: "原備註",
    seasons: [
      makeSeason(
        { id: "s1", number: 1, totalEpisodes: 40, currentEpisodes: 35, watchedEpisodes: 35 },
        stamp,
      ),
    ],
    currentSeasonId: "s1",
    isDemo: false,
    createdAt: stamp,
    updatedAt: stamp,
    lastWatchedAt: null,
    seriesStatus: "ongoing",
    updateDate: "2026-10-27",
  };
}
beforeEach(() => {
  window.localStorage.clear();
  new LocalStorageRepository().save([], []);
});

describe("使用者案例 A–E", () => {
  it("A：連載中更新35、已看35 → 等更新，保留手動狀態", () => {
    const w = work();
    expect(progressHint(w)).toBe("等更新");
    expect(w.watchStatus).toBe("paused");
  });
  it("B：更新35→40仍已看35 → 有5集未看，更新內容不動原進度", () => {
    const repo = new LocalStorageRepository();
    const store = createDramaStore(repo);
    store.add(work());
    store.upsertSeason("a", { ...store.get("a")!.seasons[0]!, currentEpisodes: 40 });
    const w = createDramaStore(repo).get("a")!;
    expect(workTotals(w)).toMatchObject({ watched: 35, total: 40 });
    expect(progressHint(w)).toBe("有 5 集未看");
    expect(w.watchStatus).toBe("paused");
  });
  it("C：已完結40集、已看40 → 已完成，但個人狀態不被覆寫", () => {
    const w = work();
    w.seriesStatus = "completed";
    w.seasons[0]!.currentEpisodes = 40;
    const next = setSeasonProgress(w, "s1", 40, stamp);
    expect(progressHint(next)).toBe("已完成");
    expect(next.watchStatus).toBe("paused");
  });
  it("D/E：同劇多分類重開存在，改名保留關聯，刪分類不刪劇", () => {
    const repo = new LocalStorageRepository();
    let store = createDramaStore(repo);
    store.add(work());
    store.addCategory("超愛");
    store.addCategory("想二刷");
    const [love, repeat] = store.getCategories();
    store.update("a", { customCategories: [love!.id, repeat!.id] });
    store = createDramaStore(repo);
    expect(store.get("a")!.customCategories).toEqual([love!.id, repeat!.id]);
    expect(filterAndSort(store.getSnapshot(), { customCategory: repeat!.id })).toHaveLength(1);
    store.renameCategory(love!.id, "超級愛");
    expect(store.get("a")!.customCategories).toContain(love!.id);
    store.removeCategory(repeat!.id);
    store = createDramaStore(repo);
    expect(store.getSnapshot()).toHaveLength(1);
    expect(store.get("a")!.customCategories).toEqual([love!.id]);
    expect(store.get("a")!.seasons[0]!.watchedEpisodes).toBe(35);
    expect(store.get("a")!.categories).toEqual(["古裝"]);
    expect(store.get("a")!.tags).toEqual(["重生"]);
    expect(store.getCategories()).toEqual([{ id: love!.id, name: "超級愛" }]);
  });
});

describe("相容、安全及備份", () => {
  it("舊資料補預設值，保留原時間、進度、收藏、封面與未知欄位", () => {
    const legacy = work();
    delete legacy.updateDate;
    delete legacy.seriesStatus;
    delete legacy.customCategories;
    delete legacy.seasons[0]!.currentEpisodes;
    localStorage.setItem(
      "nina-drama:v1",
      JSON.stringify({ version: 1, works: [legacy], extra: "保留" }),
    );
    const store = createDramaStore(new LocalStorageRepository());
    const w = store.get("a")!;
    expect(w).toMatchObject({
      updateDate: null,
      seriesStatus: "pending",
      watchStatus: "paused",
      customCategories: [],
      collectStatus: "favorite",
      updatedAt: stamp,
    });
    expect(w.seasons[0]).toMatchObject({ watchedEpisodes: 35, currentEpisodes: 40 });
    store.update("a", { note: "新備註" });
    expect(JSON.parse(localStorage.getItem("nina-drama:v1")!).extra).toBe("保留");
  });
  it("劇集日期排序與資料修改時間無關，空日期排最後", () => {
    const a = work();
    const b = { ...work(), id: "b", updateDate: "2026-10-26", updatedAt: "2099-01-01" };
    const c = { ...work(), id: "c", updateDate: null };
    expect(filterAndSort([c, b, a], { sort: "updateDate" }).map((w) => w.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
  it("備份往返保留分類 registry、關聯、進度與日期", () => {
    const w = { ...work(), customCategories: ["love"] };
    const cats = [
      { id: "love", name: "超愛" },
      { id: "empty", name: "空分類" },
    ];
    const parsed = parseBackup(JSON.stringify(createBackup([w], stamp, cats)), []);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.preview.customCategories).toEqual(cats);
    expect(parsed.preview.fresh[0]).toMatchObject({
      id: w.id,
      title: w.title,
      customCategories: w.customCategories,
      updateDate: w.updateDate,
      watchStatus: w.watchStatus,
      note: w.note,
      seasons: [
        expect.objectContaining({
          id: "s1",
          watchedEpisodes: 35,
          currentEpisodes: 35,
          status: w.seasons[0]!.status,
        }),
      ],
    });
  });
  it("不覆蓋損壞 JSON", () => {
    localStorage.setItem("nina-drama:v1", "broken");
    expect(() => new LocalStorageRepository().save([work()], [])).toThrow();
    expect(localStorage.getItem("nina-drama:v1")).toBe("broken");
  });
  it("損壞 JSON 不會被當成空收藏，也會阻斷後續寫入", () => {
    localStorage.setItem("nina-drama:v1", "broken");
    const store = createDramaStore(new LocalStorageRepository());
    expect(store.getSnapshot()).toEqual([]);
    expect(store.getDataError()).toContain("停止所有寫入");
    expect(store.add(work())).toBe(false);
    expect(localStorage.getItem("nina-drama:v1")).toBe("broken");
  });

  it("連載增加集數後由等待更新轉為待觀看並顯示未看集數", () => {
    const w = { ...work(), watchStatus: "waiting" as const, watchStatusMode: "auto" as const };
    w.seasons[0] = { ...w.seasons[0]!, status: "waiting", currentEpisodes: 40 };
    const store = createDramaStore(new MemoryRepository([w]));
    store.upsertSeason("a", { ...w.seasons[0]!, currentEpisodes: 45 });
    expect(store.get("a")?.watchStatus).toBe("watching");
    expect(progressHint(store.get("a")!)).toBe("有 10 集未看");
  });
  it("日期驗證拒絕2月30日、接受閏年", () => {
    expect(validUpdateDate("2026-02-30")).toBe(false);
    expect(validUpdateDate("2024-02-29")).toBe(true);
  });
  it("零更新集數不會除以零或顯示負未看集數", () => {
    const w = migrateWork(work());
    w.seasons[0]!.currentEpisodes = 0;
    expect(workTotals(w).percent).toBe(0);
    expect(progressHint(w)).toBe("等更新");
  });
});
