import { describe, expect, it } from "vitest";
import { parseBackup } from "./backup";
import { makeSeason } from "./domain";
import { findWorkBySeriesId, parseWorkLink } from "./link-import";
import type { Work } from "./types";

const NOW = "2026-10-23T00:00:00.000Z";
const ID = "7401455874184580121";

function work(id: string, title: string, seriesId?: string): Work {
  const s = makeSeason({ id: `${id}_s1`, number: 1, totalEpisodes: 80 }, NOW);
  return {
    id,
    title,
    aliases: [],
    cover: null,
    synopsis: "",
    actors: [],
    type: "short",
    categories: [],
    tags: [],
    collectStatus: "collected",
    watchStatus: "want",
    rating: 0,
    note: "",
    seasons: [s],
    currentSeasonId: s.id,
    isDemo: false,
    createdAt: NOW,
    updatedAt: NOW,
    lastWatchedAt: null,
    ...(seriesId
      ? { source: { platform: "hongguo" as const, seriesId, url: `https://hongguoduanju.com/detail?series_id=${seriesId}`, linkedAt: NOW } }
      : {}),
  };
}

function expectCode(input: string, code: string) {
  const r = parseWorkLink(input);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.code).toBe(code);
}

describe("作品網址辨識", () => {
  it("從 hongguoduanju.com/detail?series_id= 取得 ID 與來源網址", () => {
    const r = parseWorkLink(`https://hongguoduanju.com/detail?series_id=${ID}`);
    expect(r).toEqual({
      ok: true,
      platform: "hongguo",
      seriesId: ID,
      sourceUrl: `https://hongguoduanju.com/detail?series_id=${ID}`,
      title: null,
    });
  });

  it("接受 www 網域、http 與省略 https:// 的網址", () => {
    for (const u of [
      `https://www.hongguoduanju.com/detail?series_id=${ID}`,
      `http://hongguoduanju.com/detail?series_id=${ID}`,
      `hongguoduanju.com/detail?series_id=${ID}`,
    ]) {
      const r = parseWorkLink(u);
      expect(r.ok && r.seriesId).toBe(ID);
    }
  });

  it("接受官方分享網域 novelquickapp.com 與播放頁網址", () => {
    const a = parseWorkLink(`https://novelquickapp.com/detail?series_id=${ID}`);
    const b = parseWorkLink(`https://hongguoduanju.com/player/${ID}/7401455874184580999`);
    expect(a.ok && a.seriesId).toBe(ID);
    expect(b.ok && b.seriesId).toBe(ID);
  });

  it("來源網址只保留作品 ID，移除追蹤參數", () => {
    const r = parseWorkLink(`https://hongguoduanju.com/detail?series_id=${ID}&share_uid=123&utm_source=x#top`);
    expect(r.ok && r.sourceUrl).toBe(`https://hongguoduanju.com/detail?series_id=${ID}`);
  });

  it("從分享文字取出《劇名》與 ID，網址後的標點不影響", () => {
    const r = parseWorkLink(`我在紅果短劇追《長公主駕到》，快來一起看！https://hongguoduanju.com/detail?series_id=${ID}。`);
    expect(r.ok && r.title).toBe("長公主駕到");
    expect(r.ok && r.seriesId).toBe(ID);
  });
});

describe("網址錯誤提示", () => {
  it("空白輸入", () => expectCode("   ", "empty"));
  it("沒有網址的文字", () => expectCode("長公主駕到", "no_url"));
  it("javascript: 等非網頁連結不算網址", () => expectCode("javascript:alert(1)", "no_url"));
  it("非官方網站", () => expectCode(`https://example.com/detail?series_id=${ID}`, "unsupported_site"));
  it("假冒網域：官方網域只出現在子網域或參數中", () => {
    expectCode(`https://hongguoduanju.com.evil.com/detail?series_id=${ID}`, "unsupported_site");
    expectCode(`https://evil.com/?u=hongguoduanju.com/detail?series_id=${ID}`, "unsupported_site");
  });
  it("帶帳號密碼的網址（常用來偽裝網域）視為無效", () => {
    expectCode(`https://hongguoduanju.com@evil.com/detail?series_id=${ID}`, "invalid_url");
    expectCode(`https://evil@hongguoduanju.com/detail?series_id=${ID}`, "invalid_url");
  });
  it("官方網址缺少 series_id", () => expectCode("https://hongguoduanju.com/detail", "missing_id"));
  it("官方首頁沒有 ID", () => expectCode("https://hongguoduanju.com/", "missing_id"));
  it("series_id 不是數字", () => expectCode("https://hongguoduanju.com/detail?series_id=abc", "invalid_id"));
  it("官方短連結不含 ID，提示改貼跳轉後網址", () => expectCode("https://novelquickapp.com/s/WGPClz6sw10/", "short_link"));
  it("超過 2000 字拒絕辨識", () => expectCode("a".repeat(2001), "too_long"));
});

describe("重複作品 ID", () => {
  it("已收藏相同 series_id 時找得到原作品", () => {
    const list = [work("w1", "長公主駕到", ID), work("w2", "別的劇")];
    expect(findWorkBySeriesId(list, ID)?.id).toBe("w1");
    expect(findWorkBySeriesId(list, "7000000000000000000")).toBeUndefined();
  });

  it("匯入備份時，與現有作品來源 ID 相同的列為重複", () => {
    const existing = [work("w1", "長公主駕到", ID)];
    const r = parseBackup(JSON.stringify({ works: [work("w9", "另一個名字", ID)] }), existing, NOW);
    expect(r.ok && r.preview.fresh.length).toBe(0);
    expect(r.ok && r.preview.duplicates[0]?.reason).toContain("來源 ID 相同");
  });

  it("匯入備份會保留來源，並依 ID 重建網址", () => {
    const w = work("w5", "新劇", ID);
    const tampered = { ...w, source: { ...w.source, url: "javascript:alert(1)" } };
    const r = parseBackup(JSON.stringify({ works: [tampered] }), [], NOW);
    expect(r.ok && r.preview.fresh[0]?.source?.url).toBe(`https://hongguoduanju.com/detail?series_id=${ID}`);
  });

  it("舊備份沒有來源欄位仍可匯入", () => {
    const r = parseBackup(JSON.stringify({ works: [work("w6", "舊資料")] }), [], NOW);
    expect(r.ok && r.preview.fresh[0]?.source).toBeUndefined();
  });
});

