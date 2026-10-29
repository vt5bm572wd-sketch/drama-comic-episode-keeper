const UI_WORDS =
  /^(?:紅果|红果|番茄|紅果短劇|红果短剧|短劇|短剧|漫劇|漫剧|AI劇|AI剧|立即播放|播放|選集|选集|全集|熱度|热度|點讚|点赞|評論|评论|分享|收藏|首頁|首页|搜尋|搜索|我的|廣告|广告|下載|下载|打開APP|打开APP|追劇|追剧|完結|完结|更新至\s*\d+\s*集|(?:第|全|共)\s*\d+\s*集)$/i;

export interface ScreenshotDetails {
  text: string;
  titleCandidates: string[];
  totalEpisodes: number | null;
}

function cleanLine(value: string) {
  return value
    .replace(/^[\s|丨·•:：,，。.!！?？《》「」『』【】()（）-]+/, "")
    .replace(/[\s|丨·•:：,，。.!！?？《》「」『』【】()（）-]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** 從 OCR 全文找出最可能的劇名與集數；結果仍由使用者確認後才寫入表單。 */
export function parseScreenshotText(text: string): ScreenshotDetails {
  const normalized = text.replace(/\r/g, "").trim();
  const episodeMatches = Array.from(
    normalized.matchAll(/(?:全|共|更新至)?\s*(\d{1,4})\s*集(?:全|完結|完结)?/g),
  )
    .map((match) => Number(match[1]))
    .filter((count) => count > 0 && count <= 10000);

  const titleCandidates = normalized
    .split("\n")
    .map(cleanLine)
    .filter((line) => {
      const hanCount = (line.match(/[\u3400-\u9fff]/g) ?? []).length;
      return hanCount >= 2 && line.length <= 40 && !UI_WORDS.test(line);
    })
    .sort((a, b) => {
      const score = (line: string) => {
        const hanCount = (line.match(/[\u3400-\u9fff]/g) ?? []).length;
        const idealLength = line.length >= 4 && line.length <= 18 ? 5 : 0;
        return hanCount * 2 + idealLength - Math.max(0, line.length - 24);
      };
      return score(b) - score(a);
    })
    .filter((line, index, all) => all.indexOf(line) === index)
    .slice(0, 5);

  return {
    text: normalized,
    titleCandidates,
    totalEpisodes: episodeMatches.length ? Math.max(...episodeMatches) : null,
  };
}

export async function recognizeScreenshot(
  image: File,
  onProgress: (progress: number, status: string) => void,
): Promise<ScreenshotDetails> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker(["chi_sim", "chi_tra"], 1, {
    logger: ({ progress, status }) => onProgress(progress, status),
  });
  try {
    const result = await worker.recognize(image, { rotateAuto: true });
    return parseScreenshotText(result.data.text);
  } finally {
    await worker.terminate();
  }
}
