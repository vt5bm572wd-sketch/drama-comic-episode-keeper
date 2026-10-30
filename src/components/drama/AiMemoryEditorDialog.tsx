import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { uid } from "@/lib/drama/domain";
import { dramaStore } from "@/lib/drama/store";
import type { AiMemoryItem, AiScene, Season, Work } from "@/lib/drama/types";
import { Field } from "./fields";

const lines = (value: string) =>
  value
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

const parts = (value: string) => value.split(/[｜|]/).map((item) => item.trim());

export function AiMemoryEditorDialog({
  work,
  season,
  open,
  onOpenChange,
}: {
  work: Work;
  season: Season;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const memory = season.aiMemory;
  const [summary, setSummary] = useState("");
  const [keyPlots, setKeyPlots] = useState("");
  const [famousScenes, setFamousScenes] = useState("");
  const [suggestedTags, setSuggestedTags] = useState("");
  const [excludedItems, setExcludedItems] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !memory) return;
    setSummary(memory.summary);
    setKeyPlots(memory.keyPlots.map((item) => item.text).join("\n"));
    setFamousScenes(
      memory.famousScenes
        .map((scene) => `${scene.title}${scene.description ? `｜${scene.description}` : ""}`)
        .join("\n"),
    );
    setSuggestedTags(memory.suggestedTags.join("、"));
    setExcludedItems(memory.excludedItems.map((item) => `${item.text}｜${item.reason}`).join("\n"));
    setError("");
  }, [memory, open]);

  if (!memory) return null;

  function manualItem(text: string): AiMemoryItem {
    const previous = memory?.keyPlots.find((item) => item.text === text);
    return (
      previous ?? {
        id: uid("memory"),
        text,
        confidence: "high",
        seasonVerified: true,
        sourceCount: 1,
        sourceSeason: season.number,
        verificationReason: "使用者手動編輯",
      }
    );
  }

  function save() {
    if (!summary.trim()) return setError("請保留一句話記憶");
    const nextScenes: AiScene[] = lines(famousScenes).map((line) => {
      const [title = "", description = ""] = parts(line);
      const previous = memory.famousScenes.find((scene) => scene.title === title);
      return {
        id: previous?.id ?? uid("scene"),
        text: description ? `${title}：${description}` : title,
        title,
        description: description || undefined,
        confidence: "high",
        seasonVerified: true,
        sourceCount: previous?.sourceCount ?? 1,
        sourceSeason: season.number,
        verificationReason: previous?.verificationReason ?? "使用者手動編輯",
        favorited: previous?.favorited,
      };
    });
    const tags = suggestedTags
      .split(/[、,，\n]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    const nextExcluded = lines(excludedItems).map((line) => {
      const [text = "", reason = "使用者手動排除"] = parts(line);
      const previous = memory.excludedItems.find((item) => item.text === text);
      return {
        id: previous?.id ?? uid("excluded"),
        text,
        reason: reason || "使用者手動排除",
        suspectedSeason: previous?.suspectedSeason,
      };
    });
    const saved = dramaStore.setAiMemory(work.id, season.id, {
      ...memory,
      summary: summary.trim(),
      keyPlots: lines(keyPlots).map(manualItem),
      famousScenes: nextScenes,
      suggestedTags: Array.from(new Set(tags)),
      excludedItems: nextExcluded,
      generatedAt: new Date().toISOString(),
    });
    if (!saved) return setError("儲存失敗，請稍後再試");
    toast.success("已儲存手動編輯的觀看記憶");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh]">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="font-serif">編輯 AI 觀看記憶</DialogTitle>
          <DialogDescription>
            每行一條；名場面使用「標題｜描述」。重新整理會保留目前內容與已收藏名場面，並優先繼續尋找新的劇情與場景。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="一句話想起這一季">
            <Textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={3}
              aria-label="一句話想起這一季"
            />
          </Field>
          <Field label="關鍵劇情（每行一條）">
            <Textarea
              value={keyPlots}
              onChange={(event) => setKeyPlots(event.target.value)}
              rows={6}
              aria-label="關鍵劇情"
            />
          </Field>
          <Field label="名場面（標題｜描述）">
            <Textarea
              value={famousScenes}
              onChange={(event) => setFamousScenes(event.target.value)}
              rows={6}
              aria-label="名場面"
            />
          </Field>
          <Field label="AI 標籤建議">
            <Input
              value={suggestedTags}
              onChange={(event) => setSuggestedTags(event.target.value)}
              aria-label="AI 標籤建議"
              placeholder="破鏡重圓、久別重逢"
            />
          </Field>
          <Field label="排除內容（內容｜原因）">
            <Textarea
              value={excludedItems}
              onChange={(event) => setExcludedItems(event.target.value)}
              rows={4}
              aria-label="排除內容"
            />
          </Field>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button className="min-h-11 w-full" onClick={save}>
            儲存觀看記憶
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
