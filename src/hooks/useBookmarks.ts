import { useState, useEffect } from "react";

export interface Bookmark {
  resourceId: string;
  title: string;
  pageNumber: number;
  savedAt: string;
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("mybookshelf_bookmarks");
      if (stored) setBookmarks(JSON.parse(stored));
    } catch {
      // ignore
    }
  }, []);

  const saveToStorage = (newBookmarks: Bookmark[]) => {
    localStorage.setItem("mybookshelf_bookmarks", JSON.stringify(newBookmarks));
    setBookmarks(newBookmarks);
  };

  const addBookmark = (resourceId: string, title: string, pageNumber: number) => {
    const existing = bookmarks.filter(
      (b) => b.resourceId !== resourceId || b.pageNumber !== pageNumber
    );
    saveToStorage([
      ...existing,
      { resourceId, title, pageNumber, savedAt: new Date().toISOString() },
    ]);
  };

  const removeBookmark = (resourceId: string, pageNumber: number) => {
    saveToStorage(
      bookmarks.filter((b) => b.resourceId !== resourceId || b.pageNumber !== pageNumber)
    );
  };

  const isBookmarked = (resourceId: string, pageNumber: number) => {
    return bookmarks.some((b) => b.resourceId === resourceId && b.pageNumber === pageNumber);
  };

  const clearAll = () => {
    saveToStorage([]);
  };

  return {
    bookmarks,
    addBookmark,
    removeBookmark,
    isBookmarked,
    clearAll,
  };
}
