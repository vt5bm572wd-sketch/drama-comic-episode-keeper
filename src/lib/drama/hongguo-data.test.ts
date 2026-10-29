import { describe, expect, it } from "vitest";
import { searchWorks, makeSeason } from "./domain";
import {
  extractJsonObject,
  guessWorkType,
  isAllowedImageUrl,
  parseDetailHtml,
  parseRankingHtml,
  parseSearchJson,
  tagsToCategories,
} from "./hongguo-data";
import type { Work } from "./types";

const ID = "7683373426689461273";
const COVER = "https://p6-novel.byteimg.com/novel-pic/abc~tplv-shrink:640:0.image";

function detailHtml(detail: Record<string, unknown> | null) {
  const data = {
    loaderData: {
      detail_layout: null,
      detail_page:
        detail === null
          ? {}
          : {
              seriesDetail: detail,
              seriesSocialInfo: { rating: 8.5, hot_score_data: { text: "3726万热度" } },
            },
    },
  };
  return `<html><script>_ROUTER_DATA = ${JSON.stringify(data)};!function(){var a={}}()</script></html>`;
}

describe("紅果作品頁解析", () => {
  it("取出劇名、封面、簡介、演員、標籤與總集數", () => {
    const r = parseDetailHtml(
      detailHtml({
        series_id: ID,
        series_name: "扁担银行",
        series_cover: COVER,
        series_intro: '1935年，{大小姐}沈昭"受命"',
        celebrities: [{ nickname: "王小亿" }, { nickname: "王道铁" }],
        tags: ["民国", "大女主"],
        episode_cnt: 63,
        series_episode_info: { episode_total_cnt: 63 },
      }),
      ID,
    );
    if (typeof r === "string") throw new Error(r);
    expect(r.title).toBe("扁担银行");
    expect(r.coverUrl).toBe(COVER);
    expect(r.synopsis).toBe('1935年，{大小姐}沈昭"受命"');
    expect(r.actors).toEqual(["王小亿", "王道铁"]);
    expect(r.tags).toEqual(["民国", "大女主"]);
    expect(r.totalEpisodes).toBe(63);
    expect(r.heat).toBe("3726万热度");
    expect(r.sourceUrl).toBe(`https://hongguoduanju.com/detail?series_id=${ID}`);
  });

  it("官方找不到作品時回報 not_found", () => {
    expect(parseDetailHtml(detailHtml(null), ID)).toBe("not_found");
  });

  it("回傳的作品 ID 與要求不同時視為找不到", () => {
    expect(
      parseDetailHtml(detailHtml({ series_id: "7000000000000000001", series_name: "别的剧" }), ID),
    ).toBe("not_found");
  });

  it("頁面沒有資料區塊時回報 parse", () => {
    expect(parseDetailHtml("<html>改版了</html>", ID)).toBe("parse");
  });

  it("非官方圖床的封面不採用", () => {
    const r = parseDetailHtml(
      detailHtml({ series_id: ID, series_name: "剧", series_cover: "https://evil.com/a.jpg" }),
      ID,
    );
    if (typeof r === "string") throw new Error(r);
    expect(r.coverUrl).toBeNull();
  });
});

describe("JSON 區塊擷取", () => {
  it("字串中的大括號不影響結尾判斷", () => {
    expect(extractJsonObject('x = {"a":"}{","b":{"c":1}};rest', 0)).toBe('{"a":"}{","b":{"c":1}}');
  });
});

describe("封面網址白名單", () => {
  it("只接受 https 官方圖床", () => {
    expect(isAllowedImageUrl(COVER)).toBe(true);
    expect(isAllowedImageUrl("http://p6-novel.byteimg.com/a.jpg")).toBe(false);
    expect(isAllowedImageUrl("https://byteimg.com.evil.com/a.jpg")).toBe(false);
    expect(isAllowedImageUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("紅果搜尋結果解析", () => {
  it("轉成作品清單並略過格式不符與重複項目", () => {
    const r = parseSearchJson(
      {
        searchList: [
          {
            video_data: {
              series_id: ID,
              series_title: "总裁是我前女友",
              episode_cnt: 95,
              category_list: [{ name: "都市" }],
              series_cover: COVER,
            },
          },
          { video_data: { series_id: ID, series_title: "重复" } },
          { video_data: { series_id: "abc", series_title: "坏ID" } },
          { doc_type: 1 },
        ],
        totalCount: "209",
        hasMore: true,
      },
      1,
    );
    if (!r.ok) throw new Error(r.message);
    expect(r.items.map((i) => i.title)).toEqual(["总裁是我前女友"]);
    expect(r.items[0]?.totalEpisodes).toBe(95);
    expect(r.items[0]?.tags).toEqual(["都市"]);
    expect(r.total).toBe(209);
    expect(r.hasMore).toBe(true);
  });

  it("回應格式不符時回報錯誤", () => {
    expect(parseSearchJson({ error: 1 }, 1).ok).toBe(false);
  });
});

describe("紅果真實榜單解析", () => {
  it("解析官網作品排名、熱度、分類與封面", () => {
    const html = `<ol aria-label="漫剧热播榜"><li><article><a href="/detail?series_id=${ID}"><img class="pc-cover-abc" src="${COVER}"/><span class="pc-badge-number-abc">1</span></a><h2 id="rank-title-${ID}">和离后我带女儿横扫魔域</h2><p class="pc-metrics-abc"><span><svg></svg>8686万热度</span></p><p class="pc-categories-abc"><span>玄幻</span><span>系统</span></p></article></li></ol>`;
    expect(parseRankingHtml(html, "comic")).toMatchObject([
      {
        seriesId: ID,
        rank: 1,
        title: "和离后我带女儿横扫魔域",
        heat: "8686万热度",
        tags: ["玄幻", "系统"],
        coverUrl: COVER,
      },
    ]);
    expect(parseRankingHtml(html.replace("漫剧热播榜", "AI剧热播榜"), "ai")).toHaveLength(1);
    expect(parseRankingHtml("<html>unavailable</html>", "comic")).toEqual([]);
  });
});

describe("帶入表單的對應", () => {
  it("官方簡體標籤對應到預設分類", () => {
    expect(tagsToCategories(["民国", "总裁", "大女主", "古代"])).toEqual(["民國", "霸總", "古裝"]);
  });

  it("沒有演員時推測為漫劇", () => {
    expect(guessWorkType({ actors: [] })).toBe("comic");
    expect(guessWorkType({ actors: ["王小亿"] })).toBe("short");
  });
});

describe("收藏搜尋可用作品 ID 或連結找到匯入的作品", () => {
  const NOW = "2026-10-25T00:00:00.000Z";
  const s = makeSeason({ id: "s1", number: 1, totalEpisodes: 63 }, NOW);
  const linked: Work = {
    id: "w1",
    title: "扁担银行",
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
    source: {
      platform: "hongguo",
      seriesId: ID,
      url: `https://hongguoduanju.com/detail?series_id=${ID}`,
      linkedAt: NOW,
    },
  };
  const other: Work = { ...linked, id: "w2", title: "别的剧", source: undefined };

  it("貼上作品網址找到同一部", () => {
    expect(
      searchWorks([linked, other], `https://hongguoduanju.com/detail?series_id=${ID}`).map(
        (w) => w.id,
      ),
    ).toEqual(["w1"]);
  });

  it("輸入作品 ID 找到同一部", () => {
    expect(searchWorks([linked, other], ID).map((w) => w.id)).toEqual(["w1"]);
  });
});
