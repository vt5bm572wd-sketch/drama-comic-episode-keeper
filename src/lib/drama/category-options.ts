import { useSyncExternalStore } from "react";
import { PRESET_CATEGORIES } from "./labels";

const STORAGE_KEY = "nina-drama-category-options-v1";
type Listener = () => void;

const listeners = new Set<Listener>();
let cache: string[] | null = null;

function normalize(values: unknown): string[] {
  if (!Array.isArray(values)) return [...PRESET_CATEGORIES];
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const name = value.trim();
    if (!name || name.length > 30 || result.includes(name)) continue;
    result.push(name);
  }
  return result;
}

function load(): string[] {
  if (cache) return cache;
  if (typeof window === "undefined") return [...PRESET_CATEGORIES];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    cache = raw === null ? [...PRESET_CATEGORIES] : normalize(JSON.parse(raw));
  } catch {
    cache = [...PRESET_CATEGORIES];
  }
  return cache;
}

function save(next: string[]): boolean {
  const normalized = normalize(next);
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
    cache = normalized;
    listeners.forEach((listener) => listener());
    return true;
  } catch {
    return false;
  }
}

export function getCategoryOptions(): string[] {
  return load();
}

export function addCategoryOption(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 30 || load().includes(trimmed)) return false;
  return save([...load(), trimmed]);
}

export function removeCategoryOption(name: string): boolean {
  return save(load().filter((item) => item !== name));
}

export function useCategoryOptions(): string[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load,
    () => PRESET_CATEGORIES,
  );
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    try {
      cache = event.newValue === null ? [...PRESET_CATEGORIES] : normalize(JSON.parse(event.newValue));
    } catch {
      cache = [...PRESET_CATEGORIES];
    }
    listeners.forEach((listener) => listener());
  });
}
