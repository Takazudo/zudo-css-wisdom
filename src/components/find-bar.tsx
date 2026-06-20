import { useState, useRef, useEffect, useCallback } from "react";
import type { FindResult, FindInPage } from "@/utils/find-in-page";

interface FindBarProps {
  visible: boolean;
  onClose: () => void;
  findInPage: FindInPage;
  containerSelector: string;
}

function toMatchInfo(result: FindResult): FindResult | null {
  return result.matches > 0 ? result : null;
}

export function FindBar({ visible, onClose, findInPage, containerSelector }: FindBarProps) {
  const [query, setQuery] = useState("");
  const [matchInfo, setMatchInfo] = useState<FindResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      setQuery("");
      setMatchInfo(null);
      findInPage.stop();
    }
  }, [visible, findInPage]);

  const handleFind = useCallback(
    (text: string) => {
      const container = document.querySelector(containerSelector);
      if (!text || !(container instanceof HTMLElement)) {
        setMatchInfo(null);
        findInPage.stop();
        return;
      }
      const result = findInPage.find(container, text);
      setMatchInfo(toMatchInfo(result));
    },
    [findInPage, containerSelector],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter") {
        const result = e.shiftKey ? findInPage.prev() : findInPage.next();
        setMatchInfo(toMatchInfo(result));
      }
    },
    [onClose, findInPage],
  );

  if (!visible) return null;

  return (
    <div className="fixed top-[3.5rem] right-0 z-50 flex items-center gap-hsp-sm py-hsp-xs px-hsp-md bg-surface border-b border-l border-muted rounded-bl-lg shadow-md">
      <input
        ref={inputRef}
        className="w-48 py-[4px] px-hsp-sm rounded text-small bg-bg border border-muted text-fg outline-none focus:border-accent"
        type="text"
        value={query}
        placeholder="Find in page..."
        aria-label="Find in page"
        onChange={(e) => {
          const value = (e.target as HTMLInputElement).value;
          setQuery(value);
          handleFind(value);
        }}
        onKeyDown={handleKeyDown}
      />
      <span className="text-caption whitespace-nowrap min-w-[3rem] text-center text-fg/60">
        {matchInfo ? `${matchInfo.activeMatchOrdinal}/${matchInfo.matches}` : ""}
      </span>
      <button
        type="button"
        className="py-hsp-2xs px-hsp-sm rounded text-caption bg-bg border border-muted text-fg hover:bg-surface"
        onClick={() => {
          const result = findInPage.prev();
          setMatchInfo(toMatchInfo(result));
        }}
        title="Previous (Shift+Enter)"
      >
        Prev
      </button>
      <button
        type="button"
        className="py-hsp-2xs px-hsp-sm rounded text-caption bg-bg border border-muted text-fg hover:bg-surface"
        onClick={() => {
          const result = findInPage.next();
          setMatchInfo(toMatchInfo(result));
        }}
        title="Next (Enter)"
      >
        Next
      </button>
      <button
        type="button"
        className="py-hsp-2xs px-hsp-sm rounded text-caption bg-bg border border-muted text-fg hover:bg-surface"
        onClick={onClose}
        title="Close (Esc)"
      >
        Close
      </button>
    </div>
  );
}
