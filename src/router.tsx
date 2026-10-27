import { QueryClient } from "@tanstack/react-query";
import { createRouter, parseSearchWith, stringifySearchWith } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// 長串數字（例如紅果作品 ID）保留為文字，避免被當成數字而失去精確度
const parseSearchValue = (value: string): unknown => (/^\d{16,}$/.test(value) ? value : JSON.parse(value));

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    parseSearch: parseSearchWith(parseSearchValue),
    stringifySearch: stringifySearchWith(JSON.stringify, parseSearchValue),
  });

  return router;
};

