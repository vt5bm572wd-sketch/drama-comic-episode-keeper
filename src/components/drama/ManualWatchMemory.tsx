import { useEffect, useState } from "react";
import { Heart, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { dramaStore } from "@/lib/drama/store";
import type { Season, WatchMemory } from "@/lib/drama/types";

type MemoryTab = "plot" | "scenes" | "notes";

const tabLabels: Record<MemoryTab, string> = {
  plot: "關鍵劇情",
  scenes: "名場面",
  notes: "筆記",
};

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
  const [tab, setTab] = useState<MemoryTab>("plot");
  const [editingKey, setEditingKey] = useState<keyof WatchMemory | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    setTab("plot");
    setEditingKey(null);
    setDraft("");
  }, [season.id]);

  const memory: WatchMemory = season.watchMemory ?? {};

  const beginEdit = (key: keyof WatchMemory) => {
    setEditingKey(key);
    setDraft(memory[key] ?? "");
  };

  const save = (key: keyof WatchMemory) => {
    if (dramaStore.setSeasonMemory(workId, season.id, { ...memory, [key]: draft })) {
      toast.success("觀看記憶已儲存");
      setEditingKey(null);
    }
  };

  const clear = (key: keyof WatchMemory) => {
    if (!window.confirm("確定清空這個欄位？")) return;
    if (dramaStore.setSeasonMemory(workId, season.id, { ...memory, [key]: "" })) {
      setEditingKey(null);
      setDraft("");
      toast.success("已清空");
    }
  };

  const editor = (key: keyof WatchMemory, label: string, hint: string, rows = 5) => {
    const value = memory[key] ?? "";
    const editing = editingKey === key;

    if (editing) {
      return (
        <div className="space-y-3">
          <textarea
            aria-label={label}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={rows}
            placeholder={hint}
            className="w-full resize-y rounded-2xl border border-border bg-background p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => save(key)}>儲存</Button>
            <Button size="sm" variant="secondary" onClick={() => setEditingKey(null)}>取消</Button>
            {value && (
              <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => clear(key)}>
                <Trash2 className="size-4" /> 清空
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {!value && <p className="text-sm text-subtle-foreground">尚未填寫</p>}
        <Button size="sm" variant="secondary" onClick={() => beginEdit(key)}>
          {value ? <Pencil className="size-4" /> : <Plus className="size-4" />}
          {value ? "編輯" : "新增內容"}
        </Button>
      </div>
    );
  };

  return (
    <section aria-label="我的觀看記憶" className="surface overflow-hidden p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="font-serif text-xl font-semibold">我的觀看記憶</h2>
        <p className="text-xs text-subtle-foreground">第 {season.number} 季 · 純手動記錄</p>
      </div>

      <div role="tablist" aria-label="觀看記憶分類" className="mb-5 grid grid-cols-3 gap-1 rounded-2xl bg-muted/60 p-1">
        {(Object.keys(tabLabels) as MemoryTab[]).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={`min-h-11 rounded-xl px-2 text-sm transition ${
              tab === value ? "bg-card font-semibold text-primary shadow-sm" : "text-muted-foreground"
            }`}
            onClick={() => {
              setTab(value);
              setEditingKey(null);
            }}
          >
            {tabLabels[value]}
          </button>
        ))}
      </div>

      {tab === "plot" && (
        <div>
          <h3 className="mb-3 font-semibold">📖 關鍵劇情</h3>
          {memory.plot && editingKey !== "plot" && (
            <ol className="mb-4 space-y-4">
              {plotLines(memory.plot).map((line, index) => (
                <li key={`${index}-${line}`} className="flex gap-4 text-sm leading-7">
                  <span className="shrink-0 font-serif text-xl text-primary/70">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 whitespace-pre-wrap break-words text-muted-foreground">{line}</span>
                </li>
              ))}
            </ol>
          )}
          {editor("plot", "關鍵劇情", "每行輸入一個重要事件", 6)}
        </div>
      )}

      {tab === "scenes" && (
        <div>
          {memory.scenes && editingKey !== "scenes" ? (
            <div className="mb-4 space-y-3">
              {sceneLines(memory.scenes).map((scene, index) => (
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
          ) : null}
          {editor("scenes", "名場面", "每行一個：標題｜場景描述", 7)}
        </div>
      )}

      {tab === "notes" && (
        <div>
          {memory.notes && editingKey !== "notes" && (
            <p className="mb-4 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{memory.notes}</p>
          )}
          {editor("notes", "我的觀看筆記", "自由記錄心得、感想或其他備註", 8)}
        </div>
      )}
    </section>
  );
}
