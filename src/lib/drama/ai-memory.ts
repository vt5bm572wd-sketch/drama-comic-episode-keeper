import { uid } from "./domain";
import { generateAiMemoryServer } from "./ai-memory.functions";
import type { AiMemoryGenerated, AiMemoryGenerationInput } from "./ai-memory-contract";
import type { AiMemory, AiMemoryItem, AiScene, Season, Work } from "./types";

export type { AiMemoryGenerationInput } from "./ai-memory-contract";

const accepted = (item: Pick<AiMemoryItem, "confidence" | "seasonVerified">) =>
  item.seasonVerified && item.confidence !== "low";

const normalizeMemoryText = (value: string) =>
  value
    .toLocaleLowerCase("zh-TW")
    .replace(/[\s，。！？、；：,.!?;:'"「」『』（）()\-—_]/g, "")
    .trim();

export function sanitizeAiMemory(memory: AiMemory): AiMemory {
  const sanitized = {
    ...memory,
    keyPlots: memory.keyPlots.filter(accepted),
    famousScenes: memory.famousScenes.filter(accepted),
    suggestedTags: Array.from(
      new Set(memory.suggestedTags.map((tag) => tag.trim()).filter(Boolean)),
    ),
  };
  return sanitized;
}

function mergeUniquePlots(previous: AiMemoryItem[], next: AiMemoryItem[]) {
  const result: AiMemoryItem[] = [];
  const seen = new Set<string>();
  for (const item of [...previous, ...next]) {
    const key = normalizeMemoryText(item.text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function mergeUniqueScenes(previous: AiScene[], next: AiScene[]) {
  const result: AiScene[] = [];
  const seen = new Set<string>();
  const favorites = new Set(
    previous
      .filter((scene) => scene.favorited)
      .flatMap((scene) => [normalizeMemoryText(scene.title), normalizeMemoryText(scene.text)]),
  );

  for (const scene of [...previous, ...next]) {
    const key = normalizeMemoryText(`${scene.title}${scene.description ?? ""}`);
    const titleKey = normalizeMemoryText(scene.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({
      ...scene,
      favorited:
        scene.favorited || favorites.has(titleKey) || favorites.has(normalizeMemoryText(scene.text)),
    });
  }
  return result;
}

export function mergeRegeneratedMemory(previous: AiMemory | undefined, next: AiMemory): AiMemory {
  if (!previous) return sanitizeAiMemory(next);

  return sanitizeAiMemory({
    ...next,
    // 「重新整理」是續挖，不是覆蓋：舊記憶保留，新找到的內容追加並去重。
    keyPlots: mergeUniquePlots(previous.keyPlots, next.keyPlots),
    famousScenes: mergeUniqueScenes(previous.famousScenes, next.famousScenes),
    suggestedTags: Array.from(new Set([...previous.suggestedTags, ...next.suggestedTags])),
    excludedItems: [
      ...previous.excludedItems,
      ...next.excludedItems.filter(
        (candidate) =>
          !previous.excludedItems.some(
            (item) => normalizeMemoryText(item.text) === normalizeMemoryText(candidate.text),
          ),
      ),
    ],
  });
}

export function seasonIdentity(work: Work, season: Season): AiMemoryGenerationInput {
  const previous = season.aiMemory;
  const contextParts = [
    work.note?.trim() ? `作品備註：${work.note.trim()}` : "",
    season.note?.trim() ? `本季備註：${season.note.trim()}` : "",
    `觀看進度：${season.watchedEpisodes}/${season.totalEpisodes} 集`,
  ].filter(Boolean);

  return {
    workTitle: season.title?.trim() || season.originTitle?.trim() || work.title,
    seasonNumber: season.number,
    seriesId: season.source?.seriesId ?? work.source?.seriesId,
    coverUrl: season.cover ?? work.cover ?? undefined,
    officialSynopsis: season.synopsis?.trim() || work.synopsis.trim(),
    userContext: contextParts.join("\n"),
    existingKeyPlots: previous?.keyPlots.map((item) => item.text) ?? [],
    existingFamousScenes:
      previous?.famousScenes.map((scene) =>
        scene.description ? `${scene.title}：${scene.description}` : scene.title,
      ) ?? [],
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
    .slice(0, 5);
  const keyPlots: AiMemoryItem[] = [];
  return sanitizeAiMemory({
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
  });
}

export function toAiMemory(
  generated: AiMemoryGenerated,
  input: AiMemoryGenerationInput,
  generatedAt: string,
  model: string,
): AiMemory {
  return sanitizeAiMemory({
    summary: generated.summary,
    keyPlots: generated.keyPlots.map((item) => ({ id: uid("memory"), ...item })),
    famousScenes: generated.famousScenes.map((scene) => ({
      id: uid("scene"),
      text: scene.description ? `${scene.title}：${scene.description}` : scene.title,
      ...scene,
    })),
    suggestedTags: generated.suggestedTags,
    excludedItems: generated.excludedItems.map((item) => ({ id: uid("excluded"), ...item })),
    generatedAt,
    model,
    identity: input,
  });
}

function fallbackMemory(input: AiMemoryGenerationInput) {
  return localMemory(input);
}

/** 伺服器 AI 優先；缺少來源、額度或連線失敗時安全回退，永不阻塞收藏流程。 */
export async function generateAiMemory(work: Work, season: Season): Promise<AiMemory> {
  const input = seasonIdentity(work, season);
  if (import.meta.env.MODE !== "test") {
    try {
      const result = await generateAiMemoryServer({ data: input });
      if (result.ok) return toAiMemory(result.memory, input, result.generatedAt, result.model);
    } catch {
      // Server Function 本身失敗時仍使用本機備援，避免影響既有收藏資料。
    }
  }
  // Never present synopsis fragments or hard-coded scenes as verified AI research.
  return sanitizeAiMemory(fallbackMemory(input));
}
