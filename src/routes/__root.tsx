import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BottomNav } from "@/components/drama/BottomNav";
import { Toaster } from "@/components/ui/sonner";
import { dramaStore } from "@/lib/drama/store";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <p className="brand-title text-xs text-subtle-foreground">NINA DRAMA</p>
        <h1 className="mt-4 font-serif text-5xl font-semibold text-foreground">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">找不到這個頁面，可能已被移除。</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            回到首頁
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-xl font-semibold text-foreground">頁面載入失敗</h1>
        <p className="mt-2 text-sm text-muted-foreground">發生了一點問題，請重新整理或回到首頁。</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex h-11 cursor-pointer items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            再試一次
          </button>
          <a
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-input px-5 text-sm font-medium text-foreground"
          >
            回到首頁
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0f0f12" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "NINA DRAMA" },
      { title: "NINA DRAMA" },
      { name: "description", content: "私人短劇與漫劇收藏、追劇進度管理。" },
      { property: "og:title", content: "NINA DRAMA" },
      { property: "og:description", content: "私人短劇與漫劇收藏、追劇進度管理。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Noto+Sans+TC:wght@400;500;600;700&family=Noto+Serif+TC:wght@500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", href: "/favicon-32.png?v=3", type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=3", sizes: "180x180" },
      {
        rel: "apple-touch-icon-precomposed",
        href: "/apple-touch-icon.png?v=3",
        sizes: "180x180",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant-TW" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideNav = pathname === "/add" || pathname.startsWith("/edit/");
  const dataError = typeof window === "undefined" ? null : dramaStore.getDataError();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      document.querySelectorAll("h2").forEach((heading) => {
        if (heading.textContent?.trim() === "演員") {
          const section = heading.closest("section");
          if (section) section.hidden = true;
        }
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="mx-auto min-h-dvh w-full max-w-xl overflow-x-clip">
        {dataError && (
          <div
            role="alert"
            className="sticky top-0 z-50 border-b border-destructive/40 bg-destructive px-4 py-3 text-sm font-medium text-destructive-foreground"
          >
            {dataError} 原始資料仍保留，請前往設定匯入備份。
          </div>
        )}
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </div>
      {!hideNav && <BottomNav />}
      <Toaster position="top-center" theme="dark" />
    </QueryClientProvider>
  );
}
