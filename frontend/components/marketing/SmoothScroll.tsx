"use client";

import { useEffect } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Lenis is scoped to the marketing route group only. It syncs into GSAP's
 * ticker so ScrollTrigger keeps its measurements, and it fully tears down on
 * unmount or when reduced motion is requested. Dashboard and auth routes never
 * load this component.
 */
export function SmoothScroll() {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;

    let cancelled = false;
    let frame: ((time: number) => void) | undefined;
    let removeFrame: (() => void) | undefined;
    let destroy: (() => void) | undefined;

    void (async () => {
      const [{ default: Lenis }, gsapModule, scrollTriggerModule] =
        await Promise.all([
          import("lenis"),
          import("gsap"),
          import("gsap/ScrollTrigger"),
        ]);

      if (cancelled) return;

      const gsap = gsapModule.default;
      const { ScrollTrigger } = scrollTriggerModule;
      gsap.registerPlugin(ScrollTrigger);

      const lenis = new Lenis({
        duration: 1.05,
        smoothWheel: true,
        syncTouch: false,
        wheelMultiplier: 1,
      });

      const onScroll = () => ScrollTrigger.update();
      lenis.on("scroll", onScroll);

      frame = (time: number) => {
        lenis.raf(time * 1000);
      };
      gsap.ticker.add(frame);
      gsap.ticker.lagSmoothing(0);

      removeFrame = () => {
        gsap.ticker.remove(frame!);
      };

      destroy = () => {
        lenis.off("scroll", onScroll);
        lenis.destroy();
      };
    })();

    return () => {
      cancelled = true;
      removeFrame?.();
      destroy?.();
    };
  }, [reduce]);

  return null;
}
