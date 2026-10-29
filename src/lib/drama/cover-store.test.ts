import { describe, expect, it } from "vitest";
import { parseBackup } from "./backup";
import {
  COVER_REF_PREFIX,
  MemoryCoverStore,
  dataUrlToRecord,
  externalizeCovers,
  gcCovers,
  inlineCoversForBackup,
  isCoverRef,
  migrateInlineCovers,
  recordToDataUrl,
  runCoverMaintenance,
} from "./cover-store";
import { makeSeason } from "./domain";
import { LocalStorageRepository, MemoryRepository } from "./repository";
import { createDramaStore } from "./store";
import type { Work } from "./types";

const NOW = "2026-10-27T00:00:00.000Z";
// 1x1 JPEG 的開頭位元組（內容不重要，只要是 base64）
const DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U";

function work(id: string, cover: string | null): Work {
  const s = makeSeason({ id: `${id}_s1`, number: 1, totalEpisodes: 80, watchedEpisodes: 12 }, NOW);
  return {
    id,
    title: `作品${id}`,
    aliases: [],
    cover,
    synopsis: "",
    actors: [],
    type: "short",
    categories: [],
    tags: [],
    collectStatus: "collected",
    watchStatus: "watching",
    rating: 0,
    note: "",
    seasons: [s],
    currentSeasonId: s.id,
    isDemo: false,
    createdAt: NOW,
    updatedAt: NOW,
    lastWatchedAt: null,
  };
}

describe("封面儲存", () => {
  it("Base64 與二進位互轉內容不變", () => {
    expect(recordToDataUrl(dataUrlToRecord(DATA_URL))).toBe(DATA_URL);
  });

  it("舊資料的 Base64 封面搬進 IndexedDB，作品只留參照，觀看進度不變", async () => {
    const covers = new MemoryCoverStore();
    const repo = new MemoryRepository([
      work("a", DATA_URL),
      work("b", "https://p3-novel.byteimg.com/x.image"),
      work("c", null),
    ]);
    const store = createDramaStore(repo);
    await runCoverMaintenance(
      () => store.getSnapshot(),
      (c) => store.replaceCovers(c),
      covers,
    );

    const saved = repo.load()!;
    const a = saved.find((w) => w.id === "a")!;
    expect(isCoverRef(a.cover)).toBe(true);
    expect(a.seasons[0]!.watchedEpisodes).toBe(12);
    expect(a.updatedAt).toBe(NOW);
    expect(saved.find((w) => w.id === "b")!.cover).toBe("https://p3-novel.byteimg.com/x.image");
    expect(saved.find((w) => w.id === "c")!.cover).toBeNull();
    expect(JSON.stringify(saved)).not.toContain("data:image");
    expect(covers.map.size).toBe(1);
  });

  it("圖片無法解析時保留原封面，不會遺失", async () => {
    const covers = new MemoryCoverStore();
    const changes = await migrateInlineCovers([work("a", "data:image/jpeg;base64,")], covers);
    expect(changes).toEqual([]);
  });

  it("遷移期間使用者已更換封面時，不覆蓋新封面", () => {
    const store = createDramaStore(
      new MemoryRepository([work("a", "https://p3-novel.byteimg.com/new.image")]),
    );
    store.replaceCovers([{ workId: "a", from: DATA_URL, to: `${COVER_REF_PREFIX}k1` }]);
    expect(store.get("a")!.cover).toBe("https://p3-novel.byteimg.com/new.image");
  });

  it("清理只刪除沒人使用且超過一天的封面", async () => {
    const covers = new MemoryCoverStore();
    const t = Date.parse(NOW);
    const rec = dataUrlToRecord(DATA_URL);
    await covers.put("used", { ...rec, createdAt: t - 10 * 86400000 });
    await covers.put("old", { ...rec, createdAt: t - 2 * 86400000 });
    await covers.put("fresh", { ...rec, createdAt: t - 60000 });
    await gcCovers([work("a", `${COVER_REF_PREFIX}used`)], covers, t);
    expect([...covers.map.keys()].sort()).toEqual(["fresh", "used"]);
  });

  it("匯出備份時還原成圖片資料，匯入時再存回 IndexedDB", async () => {
    const covers = new MemoryCoverStore();
    await covers.put("k1", dataUrlToRecord(DATA_URL));
    const [exported] = await inlineCoversForBackup([work("a", `${COVER_REF_PREFIX}k1`)], covers);
    expect(exported!.cover).toBe(DATA_URL);

    const [imported] = await externalizeCovers([exported!], covers);
    expect(isCoverRef(imported!.cover)).toBe(true);
    expect(covers.map.size).toBe(2);
  });

  it("備份也會內嵌並還原每季獨立封面", async () => {
    const covers = new MemoryCoverStore();
    await covers.put("season", dataUrlToRecord(DATA_URL));
    const item = work("season-cover", null);
    item.seasons[0]!.cover = `${COVER_REF_PREFIX}season`;
    const [exported] = await inlineCoversForBackup([item], covers);
    expect(exported?.seasons[0]?.cover).toBe(DATA_URL);
    const [imported] = await externalizeCovers([exported!], covers);
    expect(isCoverRef(imported?.seasons[0]?.cover)).toBe(true);
  });

  it("備份檔中不安全的封面值會被移除", () => {
    const bad = { ...work("x", null), cover: "javascript:alert(1)" };
    const r = parseBackup(JSON.stringify({ works: [bad] }), [], NOW);
    expect(r.ok && r.preview.fresh[0]!.cover).toBeNull();
  });

  it("localStorage 只存參照字串，100 部有封面的作品仍遠小於 Safari 5MB 上限", () => {
    const repo = new LocalStorageRepository("cover-size-test");
    const works = Array.from({ length: 100 }, (_, i) =>
      work(`w${i}`, `${COVER_REF_PREFIX}${"k".repeat(20)}${i}`),
    );
    repo.save(works);
    expect(window.localStorage.getItem("cover-size-test")!.length).toBeLessThan(200_000);
  });
});
