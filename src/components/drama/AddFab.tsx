import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AddFab() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-above-nav z-30">
      <div className="mx-auto flex max-w-xl justify-end px-5">
        <Button asChild variant="fab" size="icon-lg" className="pointer-events-auto">
          <Link to="/add" aria-label="新增作品">
            <Plus />
          </Link>
        </Button>
      </div>
    </div>
  );
}

