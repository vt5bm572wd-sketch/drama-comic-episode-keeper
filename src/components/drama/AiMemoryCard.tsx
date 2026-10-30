import { ChevronDown, Heart, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { generateAiMemory, mergeRegeneratedMemory } from "@/lib/drama/ai-memory";
import { dramaStore } from "@/lib/drama/store";
import type { Season, Work } from "@/lib/drama/types";
import { AiMemoryEditorDialog } from "./AiMemoryEditorDialog";

function MemorySection({
  title,
  children,
  open = false,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="group border-t border-border first:border-t-0" open={open}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <ChevronDown className="size-4 shrink-0 text-subtle-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}

export function AiMemoryCard({ work, season }: { work: Work; season: Season }) {
  const memory = season.aiMemory;
  const [generating, setGenerating] = useState(false);
  const [editing, setEditing] = useState(false);

  async function generate() {
    setGenerating(true);
    try {
      const next = await generateAiMemory(work, season);
      if (next.model === "mock-v1") {
        toast.info("目前找不到可靠的完整劇情，請使用編輯功能手動補充；原有資料不會被覆蓋。");
        if (memory) return;
      }
      const merged = mergeRegeneratedMemory(memory, next);
      if (!dramaStore.setAiMemory(work.id, season.id, merged)) throw new Error("save failed");
      if (next.model === "mock-v1") {
        toast.info("資料不足：僅保留簡介提示，請手動補充具體場景。");
      } else {
        toast.success(memory ? "已重新整理觀看記憶" : "已生成觀看記憶");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "觀看記憶生成失敗，原有資料沒有變更。");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="surface overflow-hidden p-4" aria-labelledby={`ai-memory-${season.id}`}>
      <div className="flex min-w-0 items-center justify-between gap-2 pb-2">
        <h2 id={`ai-memory-${season.id}`} className="min-w-0 font-serif text-lg font-semibold">
          ✨ AI 觀看記憶
        </h2>
        {memory && (
          <div className="flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-11 px-2"
              onClick={() => setEditing(true)}
            >
              <Pencil />
              編輯
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-11 px-2"
              disabled={generating}
              onClick={generate}
            >
              <RefreshCw className={generating ? "animate-spin" : ""} />
              重新整理
            </Button>
          </div>
        )}
      </div>

      {!memory ? (
        <div className="space-y-3 py-2 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground">
            將本季簡介整理成關鍵劇情、名場面與標籤建議。
          </p>
          <Button className="min-h-11 w-full" disabled={generating} onClick={generate}>
            <Sparkles className={generating ? "animate-pulse" : ""} />
            {generating ? "整理中…" : "生成觀看記憶"}
          </Button>
          {(season.note || work.note) && (
            <div className="rounded-xl bg-muted px-3 py-2.5 text-left">
              <p className="text-xs font-medium text-primary">💭 我的記憶</p>
              {season.note && (
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                  {season.note}
                </p>
              )}
              {work.note && (
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                  {work.note}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <MemorySection title="一句話想起這一季" open>
            <p className="whitespace-pre-line text-[15px] leading-7 text-muted-foreground">
              {memory.summary}
            </p>
            {season.note && (
              <div className="mt-3 rounded-xl bg-muted px-3 py-2.5">
                <p className="text-xs font-medium text-primary">💭 我的一句話</p>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                  {season.note}
                </p>
              </div>
            )}
            {work.note && (
              <div className="mt-3 rounded-xl bg-muted px-3 py-2.5">
                <p className="text-xs font-medium text-primary">💭 我的記憶</p>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                  {work.note}
                </p>
              </div>
            )}
          </MemorySection>

          <MemorySection title="📖 關鍵劇情">
            {memory.keyPlots.length ? (
              <ol className="space-y-3">
                {memory.keyPlots.map((item, index) => (
                  <li
                    key={item.id}
                    className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 text-sm leading-6"
                  >
                    <span className="font-serif text-base text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="text-muted-foreground">{item.text}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-subtle-foreground">目前沒有通過季數驗證的關鍵劇情。</p>
            )}
          </MemorySection>

          <MemorySection title="💗 名場面">
            {memory.famousScenes.length ? (
              <div className="space-y-2.5">
                {memory.famousScenes.map((scene) => (
                  <article key={scene.id} className="rounded-xl bg-muted px-3 py-3">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold">♡ {scene.title}</h3>
                        {scene.description && (
                          <p className="mt-1 text-sm leading-5 text-muted-foreground">
                            {scene.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-11 shrink-0 px-2"
                        aria-pressed={!!scene.favorited}
                        onClick={() =>
                          dramaStore.toggleAiSceneFavorite(work.id, season.id, scene.id)
                        }
                      >
                        <Heart className={scene.favorited ? "fill-primary text-primary" : ""} />
                        {scene.favorited ? "已收藏" : "收藏"}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-subtle-foreground">目前沒有通過季數驗證的名場面。</p>
            )}
          </MemorySection>

          <MemorySection title="🏷 AI 標籤建議">
            {memory.suggestedTags.some((tag) => !work.tags.includes(tag)) ? (
              <div className="flex flex-wrap gap-2">
                {memory.suggestedTags
                  .filter((tag) => !work.tags.includes(tag))
                  .map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="min-h-11 rounded-full border border-border px-3 text-sm text-primary transition-colors hover:bg-primary-soft"
                      onClick={() => {
                        if (dramaStore.addSuggestedTag(work.id, tag))
                          toast.success(`已加入標籤「${tag}」`);
                      }}
                    >
                      ＋{tag}
                    </button>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-subtle-foreground">建議標籤都已加入，或目前沒有新建議。</p>
            )}
          </MemorySection>

          {memory.excludedItems.length > 0 && (
            <MemorySection title="⚠ 已排除疑似其他季內容">
              <div className="space-y-2">
                {memory.excludedItems.map((item) => (
                  <div key={item.id} className="rounded-lg bg-muted px-3 py-2 text-sm">
                    <p>{item.text}</p>
                    <p className="mt-0.5 text-xs text-subtle-foreground">{item.reason}</p>
                  </div>
                ))}
              </div>
            </MemorySection>
          )}
        </div>
      )}
      {memory && (
        <AiMemoryEditorDialog
          work={work}
          season={season}
          open={editing}
          onOpenChange={setEditing}
        />
      )}
    </section>
  );
}
