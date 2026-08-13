"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ChevronLeft } from "lucide-react";

function subscribeOrientation(onChange: () => void) {
  const mq = window.matchMedia("(orientation: portrait)");
  mq.addEventListener("change", onChange);
  window.addEventListener("orientationchange", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    mq.removeEventListener("change", onChange);
    window.removeEventListener("orientationchange", onChange);
    window.removeEventListener("resize", onChange);
  };
}

function isPortrait() {
  return window.matchMedia("(orientation: portrait)").matches;
}

/**
 * Presents children as a landscape workspace.
 * Portrait: rotate the stage so periods run on the long edge.
 * Landscape: native. Tries Screen Orientation lock in standalone PWAs.
 */
export function TeacherLandscapeStage({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  const portrait = useSyncExternalStore(
    subscribeOrientation,
    isPortrait,
    () => true,
  );

  useEffect(() => {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (type: string) => Promise<void>;
    };
    if (typeof orientation.lock !== "function") return;
    void orientation.lock("landscape").catch(() => {
      // Browser / non-standalone — CSS rotate handles it.
    });
    return () => {
      try {
        orientation.unlock();
      } catch {
        // ignore
      }
    };
  }, []);

  const stage = (
    <div className="flex h-full w-full flex-col bg-[#f2f2f7]">
      <header className="flex h-10 shrink-0 items-center justify-between px-1.5">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-0.5 rounded-full py-1 pr-2 text-[16px] font-medium tracking-[-0.02em] text-neutral-950"
        >
          <ChevronLeft className="size-5" strokeWidth={2.25} />
          Back
        </button>
        <h1 className="text-[16px] font-semibold tracking-[-0.02em] text-neutral-950">
          {title}
        </h1>
        <span className="w-[4.25rem]" aria-hidden />
      </header>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto px-2 pb-2">
        {children}
      </div>
    </div>
  );

  if (!portrait) return stage;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f2f2f7]">
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: "100dvh",
          height: "100dvw",
          transform: "translate(-50%, -50%) rotate(90deg)",
        }}
      >
        {stage}
      </div>
    </div>
  );
}
