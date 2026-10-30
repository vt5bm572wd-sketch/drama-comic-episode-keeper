import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Heart, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { dramaStore } from "@/lib/drama/store";
import type { Season, WatchMemory } from "@/lib/drama/types";

const sections = [
  { key: "summary", title: "一句話想起這一季", hint: "快速想起本季故事" },
  { key: "plot", title: "關鍵劇情", hint: "重要事件，每行一項" },
  { key: "scenes", title: "名場面", hint: "每行一個：標題｜場景描述" },
  { key: "characters", title: "人物關係", hint: "人物關係與情感變化" },
  { key: "notes", title: "我的觀看筆記", hint: "自由記錄心得與感想" },
] as const;

function plotLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\d+[.、．]\s*/, ""));
}

function sceneLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, ...rest] = line.split(/[｜|]/);
      return { title: title.trim(), description: rest.join("｜").trim() };
    });
}

export function ManualWatchMemory({ workId, season }: { workId: string; season: Season }) {
  const [expanded, setExpanded] = useState<string | null>("summary");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setExpanded("summary");
    setEditing(false);
    setDraft("");
  }, [season.id]);

  const memory: WatchMemory = season.watchMemory ?? {};

  const save = (key: keyof WatchMemory) => {
    if (dramaStore.setSeasonMemory(workId, season.id, { ...memory, [key]: draft })) {
      toast.success("觀看記憶已儲存");
      setEditing(false);
    }
  };

  return (
    <section aria-label="我的觀看記憶" className="surface overflow-hidden p-4 sm:p-6">
      <div className="mb-3">
        <h2 className="font-serif text-xl font-semibold">我的觀看記憶</h2>
        <p className="text-xs text-subtle-foreground">第 {season.number} 季 · 純手動記錄</p>
      </div>

      {sections.map(({ key, title, hint }) => {
        const open = expanded === key;
        const value = memory[key] ?? "";

        return (
          <div key={key} className="border-b border-border/70 py-3 last:border-b-0">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 py-2 text-left"
              aria-expanded={open}
              onClick={() => {
                setExpanded(open ? null : key);
                setDraft(value);
                setEditing(false);
              }}
            >
              <span className="min-w-0 font-semibold">
                {key === "plot" ? "📖 " : key === "scenes" ? "💗 " : ""}
                {title}
              </span>
              {open ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
            </button>

            {open && (
              <div className="space-y-3 pt-3">
                {editing ? (
                  <>
                    <textarea
                      aria-label={title}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      rows={key === "summary" || key === "notes" ? 6 : 5}
                      placeholder={hint}
                      className="w-full resize-y rounded-2xl border border-border bg-background p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => save(key)}>儲存</Button>
                      <Button size="sm" variant="secondary" onClick={() => { setDraft(value); setEditing(false); }}>取消</Button>
                      {value && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto text-destructive"
                          onClick={() => {
                            if (!window.confirm("確定清空這個格子的內容？")) return;
                            setDraft("");
                            if (dramaStore.setSeasonMemory(workId, season.id, { ...memory, [key]: "" })) {
                              setEditing(false);
                              toast.success("已清空");
                            }
                          }}
                        >
                          <Trash2 className="size-4" /> 清空
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    {value ? (
                      key === "plot" ? (
                        <ol className="space-y-4">
                          {plotLines(value).map((line, index) => (
                            <li key={`${index}-${line}`} className="flex gap-4 text-sm leading-7">
                              <span className="shrink-0 font-serif text-xl text-primary/70">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <span className="min-w-0 whitespace-pre-wrap break-words text-muted-foreground">{line}</span>
                            </li>
                          ))}
                        </ol>
                      ) : key === "scenes" ? (
                        <div className="space-y-3">
                          {sceneLines(value).map((scene, index) => (
                            <div key={`${index}-${scene.title}`} className="rounded-2xl bg-primary/10 p-4">
                              <div className="flex items-start gap-2 text-sm font-semibold">
                                <Heart className="mt-0.5 size-4 shrink-0 text-primary/70" />
                                <span className="break-words">{scene.title}</span>
                              </div>
                              {scene.description && (
                                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                                  {scene.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{value}</p>
                      )
                    ) : (
                      <p className="text-sm text-subtle-foreground">尚未填寫</p>
                    )}

                    <Button size="sm" variant="secondary" onClick={() => { setDraft(value); setEditing(true); }}>
                      {value ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                      {value ? "編輯內容" : "新增內容"}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
