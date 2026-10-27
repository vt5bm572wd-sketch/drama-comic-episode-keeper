import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dramaStore, useCustomCategories } from "@/lib/drama/store";
import { Chip } from "./Chip";
import { ConfirmDialog } from "./ConfirmDialog";

export function CategoryPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const categories = useCustomCategories() ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <Chip
            className="h-auto min-h-8 min-w-0 max-w-full break-all py-1"
            key={c.id}
            active={value.includes(c.id)}
            onClick={() =>
              onChange(value.includes(c.id) ? value.filter((id) => id !== c.id) : [...value, c.id])
            }
          >
            {c.name}
          </Chip>
        ))}
        {categories.length === 0 && (
          <p className="text-xs text-subtle-foreground">尚無自訂分類，可在下方建立。</p>
        )}
      </div>
      <CategoryManager />
    </div>
  );
}

export function CategoryManager() {
  const categories = useCustomCategories() ?? [];
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [renamed, setRenamed] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const add = () => {
    if (dramaStore.addCategory(name)) setName("");
    else toast.error("請輸入不重複的分類名稱（1–80 字）");
  };
  return (
    <details className="rounded-xl border border-border p-3">
      <summary className="cursor-pointer text-sm">管理自訂分類</summary>
      <div className="mt-3 space-y-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <Input
            aria-label="新增自訂分類名稱"
            placeholder="例如：超愛、想二刷"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button type="button" variant="secondary" onClick={add}>
            新增
          </Button>
        </div>
        {categories.map((c) => (
          <div key={c.id} className="flex min-w-0 flex-wrap items-center gap-2">
            {editing === c.id ? (
              <>
                <Input
                  className="min-w-0 flex-1"
                  aria-label="修改分類名稱"
                  value={renamed}
                  maxLength={80}
                  onChange={(e) => setRenamed(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (dramaStore.renameCategory(c.id, renamed)) setEditing(null);
                    else toast.error("名稱不可空白或重複");
                  }}
                >
                  儲存
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  取消
                </Button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 break-words text-sm">{c.name}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={`修改分類 ${c.name}`}
                  onClick={() => {
                    setEditing(c.id);
                    setRenamed(c.name);
                  }}
                >
                  改名
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  aria-label={`刪除分類 ${c.name}`}
                  onClick={() => setDeleting(c.id)}
                >
                  刪除
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="刪除自訂分類？"
        description={<p>只移除分類與作品的關聯，作品和觀看進度都會保留。</p>}
        confirmLabel="刪除分類"
        onConfirm={() => {
          if (deleting) dramaStore.removeCategory(deleting);
          setDeleting(null);
        }}
      />
    </details>
  );
}
