import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { dramaStore } from "@/lib/drama/store";
import type { Season, WatchMemory } from "@/lib/drama/types";

const sections = [
  { key: "summary", title: "劇情回顧", hint: "故事主線、轉折與結局" },
  { key: "plot", title: "關鍵劇情", hint: "重要事件，每行一項" },
  { key: "scenes", title: "名場面收藏", hint: "經典台詞、事件、集數與喜歡的原因，每行一項" },
  { key: "characters", title: "人物關係", hint: "人物關係與情感變化" },
  { key: "notes", title: "我的觀看筆記", hint: "自由記錄心得與感想" },
] as const;

export function ManualWatchMemory({ workId, season }: { workId: string; season: Season }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  useEffect(() => { setExpanded(null); setEditing(false); setDraft(""); }, [season.id]);
  const memory: WatchMemory = season.watchMemory ?? {};
  const save = (key: keyof WatchMemory) => {
    if (dramaStore.setSeasonMemory(workId, season.id, { ...memory, [key]: draft })) {
      toast.success("觀看記憶已儲存");
      setEditing(false);
    }
  };
  return (
    <section aria-label="我的觀看記憶" className="space-y-3">
      <div>
        <h2 className="font-serif text-lg font-semibold">我的觀看記憶</h2>
        <p className="text-xs text-subtle-foreground">第 {season.number} 季 · 純手動記錄，不使用 AI</p>
      </div>
      {sections.map(({ key, title, hint }) => {
        const open = expanded === key;
        const value = memory[key] ?? "";
        return (
          <div key={key} className="surface overflow-hidden">
            <button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-left" aria-expanded={open}
              onClick={() => { setExpanded(open ? null : key); setDraft(value); setEditing(false); }}>
              <span className="min-w-0"><span className="block font-semibold">{title}</span><span className="block text-xs text-subtle-foreground">{hint}</span></span>
              {open ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
            </button>
            {open && <div className="space-y-3 border-t border-border p-4">
              {editing ? <>
                <textarea aria-label={title} value={draft} onChange={e => setDraft(e.target.value)}
                  rows={key === "summary" || key === "notes" ? 6 : 4}
                  placeholder={hint} className="w-full resize-y rounded-xl border border-border bg-background p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary" />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => save(key)}>儲存</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setDraft(value); setEditing(false); }}>取消</Button>
                  {value && <Button size="sm" variant="ghost" className="ml-auto text-destructive"
                    onClick={() => { if (window.confirm("確定清空這個格子的內容？")) { setDraft(""); if (dramaStore.setSeasonMemory(workId, season.id, { ...memory, [key]: "" })) { setEditing(false); toast.success("已清空"); } } }}>
                    <Trash2 className="size-4" /> 清空
                  </Button>}
                </div>
              </> : <>
                {value ? <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{value}</p> :
                  <p className="text-sm text-subtle-foreground">尚未填寫</p>}
                <Button size="sm" variant="secondary" onClick={() => { setDraft(value); setEditing(true); }}>
                  {value ? <Pencil className="size-4" /> : <Plus className="size-4" />}
                  {value ? "編輯內容" : "新增內容"}
                </Button>
              </>}
            </div>}
          </div>
        );
      })}
    </section>
  );
}
