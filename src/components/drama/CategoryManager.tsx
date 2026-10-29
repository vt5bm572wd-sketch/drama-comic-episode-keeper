import { Link } from "@tanstack/react-router";
import { Plus, Settings2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addCategoryOption,
  removeCategoryOption,
  useCategoryOptions,
} from "@/lib/drama/category-options";
import type { Work } from "@/lib/drama/types";

export function CategoryManager({ works }: { works: Work[] }) {
  const categories = useCategoryOptions();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const counts = new Map<string, number>();

  useEffect(() => {
    const legacy = document.querySelector<HTMLElement>(
      'section[aria-labelledby="common-categories-title"]',
    );
    if (legacy) legacy.hidden = true;
    return () => {
      if (legacy) legacy.hidden = false;
    };
  }, []);

  for (const work of works) {
    for (const category of work.categories) {
      if (categories.includes(category)) counts.set(category, (counts.get(category) ?? 0) + 1);
    }
  }

  function add() {
    const value = name.trim();
    if (!value) return;
    if (!addCategoryOption(value)) {
      toast.error("分類已存在，或名稱格式不正確");
      return;
    }
    setName("");
    toast.success("已新增分類");
  }

  return (
    <section className="px-5" aria-labelledby="managed-categories-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="managed-categories-title" className="font-serif text-lg font-semibold">
          常用分類
        </h2>
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="flex min-h-8 items-center gap-1 text-xs text-muted-foreground active:text-primary"
        >
          <Settings2 className="size-3.5" /> 設定
        </button>
      </div>

      {editing && (
        <div className="mb-3 space-y-3 rounded-2xl border border-border bg-card p-3">
          <div className="flex gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  add();
                }
              }}
              placeholder="新增分類名稱"
              maxLength={30}
            />
            <Button type="button" size="icon" variant="soft" aria-label="新增分類" onClick={add}>
              <Plus />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <span
                key={category}
                className="inline-flex items-center gap-1 rounded-full bg-elevated py-1 pl-3 pr-1 text-sm"
              >
                {category}
                <button
                  type="button"
                  aria-label={`刪除分類 ${category}`}
                  className="grid size-7 place-items-center rounded-full text-subtle-foreground active:bg-muted"
                  onClick={() => removeCategoryOption(category)}
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-subtle-foreground">
            刪除分類只會從可選清單隱藏，不會刪除既有作品已保存的分類資料。
          </p>
        </div>
      )}

      {categories.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5">
          {categories.map((category) => (
            <Link
              key={category}
              to="/library"
              search={{ category }}
              className="surface flex min-h-12 items-center justify-between gap-2 px-4 py-3 active:scale-[0.98]"
            >
              <span className="truncate font-serif text-[15px] font-semibold">{category}</span>
              <span className="shrink-0 text-xs tabular-nums text-subtle-foreground">
                {counts.get(category) ?? 0} 部
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground"
        >
          尚未設定分類，點此新增
        </button>
      )}
    </section>
  );
}
