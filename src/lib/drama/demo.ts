import coverSnow from "@/assets/cover-snow.jpg";
import coverNeon from "@/assets/cover-neon.jpg";
import coverCat from "@/assets/cover-cat.jpg";
import coverLetter from "@/assets/cover-letter.jpg";
import coverStars from "@/assets/cover-stars.jpg";
import coverMansion from "@/assets/cover-mansion.jpg";
import coverPastry from "@/assets/cover-pastry.jpg";
import { makeSeason } from "./domain";
import type { Season, Work } from "./types";

type DemoSeason = Partial<Season> & { number: number; totalEpisodes: number };

interface DemoInput extends Omit<Work, "id" | "seasons" | "currentSeasonId" | "isDemo" | "createdAt" | "updatedAt" | "lastWatchedAt"> {
  key: string;
  seasons: DemoSeason[];
  currentSeason: number;
  createdDaysAgo: number;
  watchedHoursAgo: number | null;
}

const DEMO: DemoInput[] = [
  {
    key: "snow",
    title: "雪落長安",
    aliases: ["長安雪", "Snow over Chang'an"],
    cover: coverSnow,
    synopsis:
      "【示範作品・虛構】被貶的郡主在雪夜重返長安，以一盞宮燈為線索，揭開父兄當年的冤案。",
    actors: ["示範演員甲", "示範演員乙"],
    type: "short",
    categories: ["古裝", "復仇"],
    tags: ["宮廷", "女主成長"],
    collectStatus: "favorite",
    watchStatus: "watching",
    rating: 5,
    note: "示範備註：第二季節奏最好。",
    seasons: [
      { number: 1, totalEpisodes: 80, watchedEpisodes: 80, status: "completed" },
      { number: 2, totalEpisodes: 72, watchedEpisodes: 72, status: "completed" },
      { number: 3, totalEpisodes: 90, watchedEpisodes: 34, status: "watching", note: "看到宮宴那段。" },
    ],
    currentSeason: 3,
    createdDaysAgo: 30,
    watchedHoursAgo: 3,
  },
  {
    key: "neon",
    title: "霓虹契約",
    aliases: ["Neon Contract"],
    cover: coverNeon,
    synopsis: "【示範作品・虛構】落魄設計師與集團繼承人簽下一年契約，在雨夜的城市裡互相試探。",
    actors: ["示範演員丙", "示範演員丁"],
    type: "short",
    categories: ["霸總", "都市", "甜寵"],
    tags: ["契約戀愛"],
    collectStatus: "collected",
    watchStatus: "completed",
    rating: 4,
    note: "",
    seasons: [{ number: 1, totalEpisodes: 60, watchedEpisodes: 60, status: "completed" }],
    currentSeason: 1,
    createdDaysAgo: 21,
    watchedHoursAgo: 72,
  },
  {
    key: "cat",
    title: "貓咪偵探事務所",
    aliases: ["喵探"],
    cover: coverCat,
    synopsis: "【示範作品・虛構】一隻灰貓在雨夜的舊城區開了偵探事務所，專接人類解不開的小案子。",
    actors: ["示範配音甲"],
    type: "comic",
    categories: ["懸疑", "喜劇"],
    tags: ["療癒", "單元劇"],
    collectStatus: "favorite",
    watchStatus: "watching",
    rating: 4,
    note: "",
    seasons: [
      { number: 1, totalEpisodes: 40, watchedEpisodes: 40, status: "completed" },
      { number: 2, totalEpisodes: 40, watchedEpisodes: 12, status: "watching" },
    ],
    currentSeason: 2,
    createdDaysAgo: 14,
    watchedHoursAgo: 20,
  },
  {
    key: "letter",
    title: "第七封信",
    aliases: [],
    cover: coverLetter,
    synopsis: "【示範作品・虛構】每年同一天寄來的匿名信，第七封終於寫下了寄信人的名字。",
    actors: ["示範演員戊"],
    type: "short",
    categories: ["懸疑"],
    tags: ["燒腦"],
    collectStatus: "collected",
    watchStatus: "want",
    rating: 0,
    note: "",
    seasons: [{ number: 1, totalEpisodes: 50, watchedEpisodes: 0, status: "want" }],
    currentSeason: 1,
    createdDaysAgo: 2,
    watchedHoursAgo: null,
  },
  {
    key: "stars",
    title: "星河旅人",
    aliases: ["Galaxy Wanderer"],
    cover: coverStars,
    synopsis: "【示範作品・虛構】少年駕駛舊型飛船橫越星河，只為送出一封遲到百年的信。",
    actors: ["示範配音乙"],
    type: "comic",
    categories: ["科幻", "奇幻"],
    tags: ["冒險"],
    collectStatus: "collected",
    watchStatus: "completed",
    rating: 5,
    note: "",
    seasons: [{ number: 1, totalEpisodes: 36, watchedEpisodes: 36, status: "completed" }],
    currentSeason: 1,
    createdDaysAgo: 40,
    watchedHoursAgo: 240,
  },
  {
    key: "mansion",
    title: "深宅迷局",
    aliases: ["公館疑雲"],
    cover: coverMansion,
    synopsis: "【示範作品・虛構】民國年間的上海公館，一場停電之後，管家消失在走廊盡頭。",
    actors: ["示範演員己", "示範演員庚"],
    type: "short",
    categories: ["民國", "懸疑"],
    tags: ["大宅門"],
    collectStatus: "archived",
    watchStatus: "paused",
    rating: 3,
    note: "示範備註：等第二季更新完再看。",
    seasons: [
      { number: 1, totalEpisodes: 64, watchedEpisodes: 64, status: "completed" },
      { number: 2, totalEpisodes: 70, watchedEpisodes: 8, status: "paused" },
    ],
    currentSeason: 2,
    createdDaysAgo: 10,
    watchedHoursAgo: 120,
  },
  {
    key: "pastry",
    title: "甜點師的秘密",
    aliases: [],
    cover: coverPastry,
    synopsis: "【示範作品・虛構】米其林甜點師隱藏身份到小店打工，卻被老闆識破。",
    actors: ["示範演員辛"],
    type: "short",
    categories: ["甜寵", "都市"],
    tags: ["美食"],
    collectStatus: "collected",
    watchStatus: "dropped",
    rating: 2,
    note: "",
    seasons: [{ number: 1, totalEpisodes: 45, watchedEpisodes: 15, status: "dropped" }],
    currentSeason: 1,
    createdDaysAgo: 6,
    watchedHoursAgo: 96,
  },
];

export function buildDemoWorks(nowMs = Date.now()): Work[] {
  return DEMO.map((d) => {
    const created = new Date(nowMs - d.createdDaysAgo * 86400000).toISOString();
    const watched =
      d.watchedHoursAgo === null ? null : new Date(nowMs - d.watchedHoursAgo * 3600000).toISOString();
    const seasons = d.seasons.map((s) =>
      makeSeason({ ...s, id: `demo_${d.key}_s${s.number}` }, created),
    );
    const { key, seasons: _s, currentSeason, createdDaysAgo: _c, watchedHoursAgo: _w, ...rest } = d;
    return {
      ...rest,
      id: `demo_${key}`,
      seasons,
      currentSeasonId: seasons.find((s) => s.number === currentSeason)?.id ?? seasons[0]?.id ?? null,
      isDemo: true,
      createdAt: created,
      updatedAt: watched ?? created,
      lastWatchedAt: watched,
    };
  });
}

