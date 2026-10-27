import { Link } from "@tanstack/react-router";
import { Bookmark, Home, PlayCircle, Search, Settings } from "lucide-react";

const ITEMS = [
  { to: "/", label: "首頁", icon: Home, exact: true },
  { to: "/search", label: "搜尋", icon: Search, exact: false },
  { to: "/library", label: "收藏", icon: Bookmark, exact: false },
  { to: "/watching", label: "追劇", icon: PlayCircle, exact: false },
  { to: "/settings", label: "設定", icon: Settings, exact: false },
] as const;

export function BottomNav() {
  return (
    <nav
      aria-label="主要導覽"
      className="nav-bar pb-safe fixed inset-x-0 bottom-0 z-40"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {ITEMS.map(({ to, label, icon: Icon, exact }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact }}
              className="group flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-subtle-foreground transition-colors data-[status=active]:text-primary"
            >
              <Icon className="size-[22px] stroke-[1.75] transition-transform group-active:scale-90" />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

