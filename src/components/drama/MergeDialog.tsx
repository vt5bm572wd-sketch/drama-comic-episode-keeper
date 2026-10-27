import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { matchesQuery, nextSeasonNumber } from "@/lib/drama/domain";
import { dramaStore, useWorks } from "@/lib/drama/store";
import type { Work } from "@/lib/drama/types";
import { cn } from "@/lib/utils";
import { WorkCover } from "./WorkCover";

/** 把目前作品移到另一個系列底下，成為該系列的新季數。 */
export function MergeDialog({
  work,
  open,
  onOpenChange,
}: {
  work: Work;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const works = useWorks() ?? [];
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);

  const candidates = useMemo(
    () => works.filter((w) => w.id !== work.id && matchesQuery(w, q)),
    [works, work.id, q],
  );
  const target = works.find((w) => w.id === targetId);

  function confirm() {
    if (!target) return;
    const first = nextSeasonNumber(target);
    if (dramaStore.mergeInto(target.id, work.id)) {
      toast.success(`已移入《${target.title}》，成為第 ${first} 季起`);
      onOpenChange(false);
      navigate({ to: "/work/$id", params: { id: target.id }, replace: true });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setQ("");
          setTargetId(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader className="text-left">
          <DialogTitle className="font-serif">移動到系列</DialogTitle>
          <DialogDescription>
            《{work.title}》的 {work.seasons.length} 季將接在目標系列最後一季之後，所有觀看進度與備註都會保留。
          </DialogDescription>
        </DialogHeader>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋目標系列" aria-label="搜尋目標系列" />
        <div className="-mx-1 max-h-[40dvh] space-y-1.5 overflow-y-auto px-1">
          {candidates.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">沒有其他作品可以合併</p>
          )}
          {candidates.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => setTargetId(w.id)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-xl border p-2 text-left transition-colors",
                targetId === w.id ? "border-primary/60 bg-primary-soft" : "border-border bg-card",
              )}
            >
              <WorkCover src={w.cover} title={w.title} className="w-10 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{w.title}</p>
                <p className="text-xs text-subtle-foreground">目前 {w.seasons.length} 季</p>
              </div>
              {targetId === w.id && <Check className="size-5 shrink-0 text-primary" />}
            </button>
          ))}
        </div>
        <Button disabled={!target} onClick={confirm} className="w-full">
          {target ? `移入《${target.title}》` : "請選擇目標系列"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

