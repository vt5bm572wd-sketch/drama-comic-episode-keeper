import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import {
  aiMemoryGeneratedSchema,
  aiMemoryGenerationInputSchema,
  type AiMemoryServerResult,
} from "./ai-memory-contract";

const DEFAULT_MODEL = "google/gemini-3.1-flash-lite";

function promptFor(data: ReturnType<typeof aiMemoryGenerationInputSchema.parse>) {
  const sourceCount = data.officialSynopsis ? 1 : 0;
  return `你是台灣繁體中文的追劇記憶整理員。只整理指定作品與指定季，禁止補寫來源未提供的劇情。

【本次唯一身份】
作品：${data.workTitle}
季數：第 ${data.seasonNumber} 季
紅果 seriesId：${data.seriesId || "未提供"}
主要人物：${data.mainCharacters.join("、") || "未提供"}

【目前可驗證來源】
第 ${data.seasonNumber} 季官方劇情簡介：
${data.officialSynopsis || "未提供"}

【硬性驗證規則】
1. 正式內容只能使用上方官方簡介明確支持的資訊；目前來源數固定為 ${sourceCount}。
2. sourceSeason 必須是 ${data.seasonNumber}；若無法確認屬於本季，seasonVerified=false，且不要放入 keyPlots 或 famousScenes。
3. 不得因人物相同而引入其他季。疑似其他季、來源不足或無法確認的項目放入 excludedItems。
4. confidence=high 只限來源直接明載；可合理改寫但仍明確可驗證時為 medium；推測為 low。
5. 不可虛構集數、場景、人物關係、事件或第二個來源。episode 不確定時填 null。
6. summary 用 1～2 句、台灣繁體中文；keyPlots 按時間順序，最多 8 條，每條簡短；若資料不足可以少於 4 條。
7. famousScenes 只收錄官方簡介明確描述的具體場景；若沒有就回傳空陣列。
8. suggestedTags 僅提供精簡題材標籤，不要加「＋」符號。
9. verificationReason 簡短說明如何由本季官方簡介確認，不可聲稱已搜尋或引用未提供的資料。

請輸出符合 schema 的結構化資料。`;
}

function safeGatewayError(error: unknown) {
  if (!(error instanceof Error)) return "unknown";
  const status = "statusCode" in error ? String(error.statusCode) : "unknown";
  return `${error.name} (status ${status})`;
}

export const generateAiMemoryServer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => aiMemoryGenerationInputSchema.parse(input))
  .handler(async ({ data }): Promise<AiMemoryServerResult> => {
    if (!data.officialSynopsis.trim()) {
      return {
        ok: false,
        code: "insufficient_source",
        message: "本季尚無官方簡介，已保留原資料。",
      };
    }

    const model = process.env.AI_GATEWAY_MODEL?.trim() || DEFAULT_MODEL;
    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: aiMemoryGeneratedSchema }),
        temperature: 0.1,
        prompt: promptFor(data),
      });
      if (!output) throw new Error("AI Gateway did not return structured output");
      return {
        ok: true,
        memory: output,
        generatedAt: new Date().toISOString(),
        model,
      };
    } catch (error) {
      // 不記錄簡介或使用者資料，只留下非敏感錯誤類型供 Vercel Logs 偵錯。
      console.error("AI memory gateway request failed", safeGatewayError(error));
      return {
        ok: false,
        code: "gateway_unavailable",
        message: "AI 暫時無法連線，已改用官方簡介整理。",
      };
    }
  });
