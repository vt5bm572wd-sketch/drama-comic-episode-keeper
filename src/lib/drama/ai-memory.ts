import { uid } from "./domain";
import type { AiMemory, AiMemoryItem, AiScene, Season, Work } from "./types";

export interface AiMemoryGenerationInput {
  workTitle: string;
  seasonNumber: number;
  seriesId?: string | undefined;
  officialSynopsis: string;
  mainCharacters: string[];
}

const accepted = (item: Pick<AiMemoryItem, "confidence" | "seasonVerified">) =>
  item.confidence === "high" || (item.confidence === "medium" && item.seasonVerified);

export function sanitizeAiMemory(memory: AiMemory): AiMemory {
  return {
    ...memory,
    keyPlots: memory.keyPlots.filter(accepted),
    famousScenes: memory.famousScenes.filter(accepted),
    suggestedTags: Array.from(
      new Set(memory.suggestedTags.map((tag) => tag.trim()).filter(Boolean)),
    ),
  };
}

export function mergeRegeneratedMemory(previous: AiMemory | undefined, next: AiMemory): AiMemory {
  if (!previous) return sanitizeAiMemory(next);
  const favoriteKeys = new Set(
    previous.famousScenes
      .filter((scene) => scene.favorited)
      .flatMap((scene) => [scene.id, scene.title.trim()]),
  );
  return sanitizeAiMemory({
    ...next,
    famousScenes: next.famousScenes.map((scene) => ({
      ...scene,
      favorited:
        scene.favorited || favoriteKeys.has(scene.id) || favoriteKeys.has(scene.title.trim()),
    })),
  });
}

export function seasonIdentity(work: Work, season: Season): AiMemoryGenerationInput {
  return {
    workTitle: work.title,
    seasonNumber: season.number,
    seriesId: season.source?.seriesId ?? work.source?.seriesId,
    officialSynopsis: season.synopsis?.trim() || work.synopsis.trim(),
    mainCharacters: [],
  };
}

function verifiedItem(text: string, input: AiMemoryGenerationInput): AiMemoryItem {
  return {
    id: uid("memory"),
    text,
    confidence: "medium",
    seasonVerified: true,
    sourceCount: input.seriesId ? 2 : 1,
    sourceSeason: input.seasonNumber,
    verificationReason: input.seriesId
      ? "作品標題、季數、官方簡介與本季紅果 seriesId 一致"
      : "作品標題、季數與本季官方簡介一致",
  };
}

function iceColdMemory(input: AiMemoryGenerationInput): AiMemory {
  const item = (text: string) => ({
    ...verifiedItem(text, input),
    confidence: "high" as const,
    sourceCount: 2,
  });
  const scene = (title: string, description: string): AiScene => ({
    ...item(`${title}：${description}`),
    title,
    description,
  });
  return {
    summary: "三年前被迫分開，三年後再次相遇。\n顧景琛表面冷淡刁難，實際一直暗中護著蘇沐妍。",
    keyPlots: [
      item("三年前顧景琛為保護蘇沐妍，故意讓她以為自己不愛她。"),
      item("三年後蘇沐妍回國處理繁星集團，兩人在機場重新相遇。"),
      item("顧景琛帶假女友故意刺激蘇沐妍。"),
      item("兩人重新進入互相試探、拉扯的狀態。"),
    ],
    famousScenes: [
      scene("機場重逢", "顧景琛帶假女友出現刺激蘇沐妍"),
      scene("樓梯間吃醋試探", "以合作為理由逼近她，試探她的心意"),
      scene("地下車庫拒絕銀行卡", "蘇沐妍冷淡拒絕顧景琛遞來的卡"),
    ],
    suggestedTags: ["破鏡重圓", "久別重逢", "暗中守護", "豪門", "商戰"],
    excludedItems: [
      { id: uid("excluded"), text: "股東離奇身亡", reason: "疑似第二季", suspectedSeason: 2 },
      { id: uid("excluded"), text: "連環車禍", reason: "疑似第二季", suspectedSeason: 2 },
      {
        id: uid("excluded"),
        text: "秘匣真相",
        reason: "疑似第二／第三季",
        suspectedSeason: null,
      },
    ],
    generatedAt: new Date().toISOString(),
    model: "mock-v1",
    identity: input,
  };
}

function localMemory(input: AiMemoryGenerationInput): AiMemory {
  const sentences = input.officialSynopsis
    .split(/[。！？!?\n]+/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 6)
    .slice(0, 8);
  const keyPlots = sentences.map((text) => verifiedItem(`${text}。`, input));
  return {
    summary:
      sentences.slice(0, 2).join("。") +
      (sentences.length ? "。" : `第 ${input.seasonNumber} 季尚未有足夠簡介可整理。`),
    keyPlots,
    famousScenes: [],
    suggestedTags: [],
    excludedItems: [],
    generatedAt: new Date().toISOString(),
    model: "mock-v1",
    identity: input,
  };
}

/**
 * Phase 1 的非阻塞生成器。未來接上伺服器 AI／搜尋 API 時只需替換此函式，
 * UI、每季資料隔離、驗證與重新生成合併規則都不必重做。
 */
export async function generateAiMemory(work: Work, season: Season): Promise<AiMemory> {
  const input = seasonIdentity(work, season);
  await Promise.resolve();
  const result =
    /冰冷重遇/.test(input.workTitle) && input.seasonNumber === 1
      ? iceColdMemory(input)
      : localMemory(input);
  return sanitizeAiMemory(result);
}
