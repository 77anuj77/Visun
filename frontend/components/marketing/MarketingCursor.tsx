"use client";

import { useEffect, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { cn } from "@/lib/utils";

type HoverState = "idle" | "grow";
type CursorLabel = string | null;

/**
 * Marketing-only cursor. It hides the native cursor only while it can actually
 * render, and it hands control back to the browser for:
 *
 * - touch / coarse pointers
 * - `prefers-reduced-motion`
 * - any open Clerk modal or third-party auth surface
 * - text fields, which always keep the native I-beam
 * - route changes, because the marketing layout unmounts and the class is
 *   removed in cleanup
 */
export function MarketingCursor() {
  const reduce = useReducedMotion();
  const [enabled, setEnabled] = useState(false);
  const [authSurface, setAuthSurface] = useState(false);
  const [hover, setHover] = useState<HoverState>("idle");
  const [label, setLabel] = useState<CursorLabel>(null);
  const [pressed, setPressed] = useState(false);
  const [visible, setVisible] = useState(false);

  const rawX = useMotionValue(-120);
  const rawY = useMotionValue(-120);
  const x = useSpring(rawX, { stiffness: 420, damping: 36, mass: 0.45 });
  const y = useSpring(rawY, { stiffness: 420, damping: 36, mass: 0.45 });

  // Enable only for a fine pointer that accepts motion.
  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const sync = () => setEnabled(fine.matches && !reduced.matches);
    sync();
    fine.addEventListener("change", sync);
    reduced.addEventListener("change", sync);
    return () => {
      fine.removeEventListener("change", sync);
      reduced.removeEventListener("change", sync);
    };
  }, []);

  useEffect(() => {
    if (reduce) setEnabled(false);
  }, [reduce]);

  // Clerk renders its modal through a portal, which is outside the marketing
  // layout. Watch for it so the native cursor comes back immediately. Mutations
  // inside a typing form are frequent, so coalesce checks into one frame.
  useEffect(() => {
    const authSelector =
      ".cl-modalContent, .cl-modal, .cl-modalBackdrop, [data-clerk-component], .cl-rootBox, [class*='cl-modal']";

    let frame = 0;
    const check = () => {
      frame = 0;
      setAuthSurface(Boolean(document.querySelector(authSelector)));
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(check);
    };

    check();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (authSurface || !enabled) {
      setVisible(false);
      document.documentElement.classList.remove("mk-cursor-on");
    }
  }, [authSurface, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;

    const release = () => {
      root.classList.remove("mk-cursor-on");
      setVisible(false);
      setHover("idle");
      setLabel(null);
    };

    const onMove = (event: PointerEvent) => {
      rawX.set(event.clientX);
      rawY.set(event.clientY);

      if (authSurface) {
        release();
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      const inTextField = Boolean(
        target?.closest(
          "input, textarea, select, [contenteditable='true'], [data-native-cursor]",
        ),
      );

      // Text fields keep the native I-beam, so the dot and the hidden native
      // cursor both step aside.
      if (inTextField) {
        release();
        return;
      }

      // Only hide the native cursor once the dot has a real pointer position.
      root.classList.add("mk-cursor-on");
      setVisible(true);
      const labeled = target?.closest<HTMLElement>("[data-cursor]");
      setLabel(labeled?.getAttribute("data-cursor") || null);
      setHover(
        labeled ||
          target?.closest(
            "a, button, [role='button'], [data-cursor-grow], summary, label[for]",
          )
          ? "grow"
          : "idle",
      );
    };

    const onLeave = () => release();
    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);
    const onBlur = () => {
      setPressed(false);
      release();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("blur", onBlur);
      root.classList.remove("mk-cursor-on");
    };
  }, [authSurface, enabled, rawX, rawY]);

  if (!enabled || reduce) return null;

  return (
    <motion.div
      aria-hidden="true"
      className="mk-cursor pointer-events-none fixed left-0 top-0 z-[95] select-none"
      style={{ x, y }}
    >
      <motion.span
        className={cn(
          "block h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white",
          "shadow-[0_0_0_1px_rgba(255,255,255,0.25)]",
        )}
        animate={{
          scale: pressed ? 0.72 : label ? 2.2 : hover === "grow" ? 2.8 : 1,
          opacity: visible ? 1 : 0,
        }}
        transition={{ type: "spring", stiffness: 320, damping: 24 }}
      />
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-2 whitespace-nowrap font-mono text-[8px] uppercase tracking-[0.16em] text-white"
        animate={{
          opacity: visible && label ? 1 : 0,
          x: visible && label ? 0 : -4,
        }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
        {label}
      </motion.span>
    </motion.div>
  );
}
