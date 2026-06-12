// [kolab] Anchored comment stickers (PowerPoint-style).
//
// Upstream renders comments only as a list in a bottom-right corner panel
// (`comment-widget.tsx`). This overlays an expandable "sticker" pin on top of
// the slide, positioned over the element each comment refers to — like the
// comment markers in PowerPoint/Google Slides.
//
// How a comment finds its element: a comment stores the source `line` of its
// `@slide-comment` marker. The loc-tags Vite plugin stamps rendered host JSX
// with `data-slide-loc="line:column"`, so we resolve a comment to the element
// whose loc-line is the greatest one <= the comment's line (the innermost
// element that opens at/just before the marker). Positioning then mirrors the
// `Frame` technique in `inspect-overlay.tsx` (getBoundingClientRect relative to
// the overlay), so pins track the scaled slide on resize/scroll.

import { MessageSquare, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SlideComment } from '@/lib/inspector/use-comments';
import { useInspector } from './inspector-provider';

type Pin = {
  key: string;
  left: number;
  top: number;
  comments: SlideComment[];
};

// Resolve a comment's source line to the rendered element it annotates.
// Prefer the deepest element opening at or before the marker line; fall back to
// the nearest tagged element if none qualifies (e.g. imported-component JSX).
function resolveAnchor(root: HTMLElement, line: number): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestLine = Number.NEGATIVE_INFINITY;
  let fallback: HTMLElement | null = null;
  let fallbackDelta = Number.POSITIVE_INFINITY;
  for (const el of root.querySelectorAll<HTMLElement>('[data-slide-loc]')) {
    const loc = el.dataset.slideLoc;
    if (!loc) continue;
    const colon = loc.indexOf(':');
    const l = Number(colon > 0 ? loc.slice(0, colon) : loc);
    if (!Number.isFinite(l)) continue;
    if (l <= line && l > bestLine) {
      bestLine = l;
      best = el;
    }
    const delta = Math.abs(l - line);
    if (delta < fallbackDelta) {
      fallbackDelta = delta;
      fallback = el;
    }
  }
  return best ?? fallback;
}

export function CommentOverlay() {
  const { comments, remove } = useInspector();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const measure = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const root = document.querySelector<HTMLElement>('[data-inspector-root]');
    if (!root || comments.length === 0) {
      setPins([]);
      return;
    }
    const overlayRect = overlay.getBoundingClientRect();

    // Group comments that resolve to the same element into one pin.
    const groups = new Map<HTMLElement, SlideComment[]>();
    for (const c of comments) {
      const el = resolveAnchor(root, c.line);
      if (!el) continue;
      const arr = groups.get(el);
      if (arr) arr.push(c);
      else groups.set(el, [c]);
    }

    const next: Pin[] = [];
    for (const [el, cs] of groups) {
      const r = el.getBoundingClientRect();
      next.push({
        key: cs.map((c) => c.id).join(','),
        left: r.left - overlayRect.left,
        top: r.top - overlayRect.top,
        comments: cs,
      });
    }
    setPins(next);
  }, [comments]);

  useEffect(() => {
    measure();
    const root = document.querySelector<HTMLElement>('[data-inspector-root]');
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    const ro = new ResizeObserver(schedule);
    if (root) ro.observe(root);
    if (overlayRef.current) ro.observe(overlayRef.current);
    window.addEventListener('resize', schedule, true);
    window.addEventListener('scroll', schedule, true);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', schedule, true);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [measure]);

  // Keep the overlay mounted (so its ref + observers stay alive) even with no
  // pins; just render nothing visible.
  return (
    <div
      ref={overlayRef}
      data-inspector-ui
      data-comment-overlay
      data-comment-count={comments.length}
      data-pin-count={pins.length}
      className="pointer-events-none absolute inset-0 z-40"
    >
      {pins.map((pin) => (
        <CommentPin
          key={pin.key}
          pin={pin}
          open={openKey === pin.key}
          onToggle={() => setOpenKey((k) => (k === pin.key ? null : pin.key))}
          onClose={() => setOpenKey(null)}
          onRemove={remove}
        />
      ))}
    </div>
  );
}

function CommentPin({
  pin,
  open,
  onToggle,
  onClose,
  onRemove,
}: {
  pin: Pin;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onRemove: (id: string) => void | Promise<void>;
}) {
  const count = pin.comments.length;
  // Sit the marker just outside the element's top-left corner (PowerPoint-style),
  // clamped so it never renders off the top/left edge of the canvas.
  const left = Math.max(2, pin.left - 12);
  const top = Math.max(2, pin.top - 12);

  return (
    <div className="absolute" style={{ left, top }}>
      <button
        type="button"
        onClick={onToggle}
        data-comment-pin
        className="pointer-events-auto flex h-6 min-w-6 items-center justify-center gap-1 rounded-full rounded-bl-sm border border-amber-300 bg-amber-200 px-1.5 text-[11px] font-semibold text-amber-950 shadow-md transition-transform hover:scale-105"
        title={count === 1 ? '1 comment' : `${count} comments`}
        aria-label={count === 1 ? '1 comment' : `${count} comments`}
      >
        <MessageSquare className="size-3" />
        {count > 1 ? count : null}
      </button>

      {open && (
        <div className="pointer-events-auto absolute left-7 top-0 z-10 w-72 rounded-md border bg-card shadow-xl animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-xs font-semibold">
              {count === 1 ? 'Comment' : `${count} comments`}
            </span>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <ul className="max-h-72 overflow-auto">
            {pin.comments.map((c) => (
              <li key={c.id} className="flex items-start gap-2 border-b px-3 py-2 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-mono text-muted-foreground">line {c.line}</div>
                  <div className="mt-0.5 break-words text-xs">{c.note}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(c.id)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-600"
                  title="Delete comment"
                  aria-label="Delete comment"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
