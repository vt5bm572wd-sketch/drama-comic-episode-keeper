import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FileQuestion } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, LoadingBlock } from "@/components/drama/EmptyState";
import { PageHeader } from "@/components/drama/PageHeader";
import { WorkForm } from "@/components/drama/WorkForm";
import { Button } from "@/components/ui/button";
import { dramaStore, useWork } from "@/lib/drama/store";

export const Route = createFileRoute("/edit/$id")({
  head: () => ({
    meta: [
      { title: "編輯作品｜NINA DRAMA" },
      { name: "description", content: "編輯作品資訊、分類、季數與觀看進度。" },
      { property: "og:title", content: "編輯作品｜NINA DRAMA" },
      { property: "og:description", content: "編輯作品資訊與觀看進度。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EditPage,
});

function EditPage() {
  const { id } = Route.useParams();
  const work = useWork(id);
  const navigate = useNavigate();

  if (work === null) return <LoadingBlock />;
  if (!work)
    return (
      <main>
        <PageHeader back title="編輯作品" />
        <EmptyState
          icon={FileQuestion}
          title="找不到這部作品"
          description="它可能已被刪除或合併到其他系列。"
          action={
            <Button asChild>
              <Link to="/library">回到收藏</Link>
            </Button>
          }
        />
      </main>
    );

  return (
    <main>
      <PageHeader back title="編輯作品" subtitle={work.title} />
      <WorkForm
        key={work.id}
        initial={work}
        submitLabel="儲存變更"
        onSubmit={(next) => {
          const { id: _id, ...patch } = next;
          if (dramaStore.update(work.id, patch)) {
            toast.success("已儲存變更");
            navigate({ to: "/work/$id", params: { id: work.id }, replace: true });
          }
        }}
      />
    </main>
  );
}

