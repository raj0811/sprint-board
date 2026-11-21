"use client";

import { useEffect, useRef, useState } from "react";

type ExpandableTextProps = {
  text: string;
  /** Lines shown while collapsed. */
  lines?: 2 | 3 | 4 | 5 | 6;
  className?: string;
};

const clamp = { 2: "line-clamp-2", 3: "line-clamp-3", 4: "line-clamp-4", 5: "line-clamp-5", 6: "line-clamp-6" };

/** Text that keeps its line breaks and collapses to a few lines with a "Show more" toggle when it's long. */
export function ExpandableText({ text, lines = 4, className = "" }: ExpandableTextProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  // Measure whether the clamped text is cut off; re-check when the width changes.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (!element.classList.contains(clamp[lines])) return; // only measurable while clamped
      setOverflowing(element.scrollHeight > element.clientHeight + 1);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, lines]);

  return <div className={className}>
    <p ref={ref} className={`m-0 whitespace-pre-line break-words ${expanded ? "" : clamp[lines]}`}>{text.trim()}</p>
    {(overflowing || expanded) && <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="mt-1 text-[13px] font-semibold text-brand-600 hover:text-brand-700 hover:underline">
      {expanded ? "Show less" : "Show more"}
    </button>}
  </div>;
}
