/**
 * useProgress — localStorage-based reading progress tracker (no login required)
 * Key: "edushelf_progress"
 * Shape: { [resourceId]: { lastPage: number; totalPages: number; completed: boolean } }
 */

export interface ProgressEntry {
  lastPage: number;
  totalPages: number;
  completed: boolean;
}

type ProgressMap = Record<string, ProgressEntry>;

const STORAGE_KEY = "edushelf_progress";

function read(): ProgressMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as ProgressMap;
  } catch {
    return {};
  }
}

function write(map: ProgressMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Silently fail if storage is full / blocked
  }
}

export function useProgress(resourceId: string) {
  /** Get progress entry for this resource, or null if never opened. */
  const getProgress = (): ProgressEntry | null => {
    const map = read();
    return map[resourceId] ?? null;
  };

  /**
   * Save current page + total pages.
   * Automatically marks completed when lastPage === totalPages.
   */
  const setProgress = (lastPage: number, totalPages: number): void => {
    if (!resourceId || totalPages < 1) return;
    const map = read();
    const prev = map[resourceId];
    map[resourceId] = {
      lastPage,
      totalPages,
      completed: prev?.completed || lastPage >= totalPages,
    };
    write(map);
  };

  /** Force-mark as completed. */
  const markComplete = (): void => {
    const map = read();
    const prev = map[resourceId];
    if (!prev) return;
    map[resourceId] = { ...prev, completed: true };
    write(map);
  };

  /**
   * Returns a 0–100 percentage based on lastPage / totalPages.
   * Returns 0 if no progress recorded yet.
   */
  const getPercentage = (totalPages: number): number => {
    const map = read();
    const entry = map[resourceId];
    if (!entry || totalPages < 1) return 0;
    return Math.min(100, Math.round((entry.lastPage / totalPages) * 100));
  };

  return { getProgress, setProgress, markComplete, getPercentage };
}
