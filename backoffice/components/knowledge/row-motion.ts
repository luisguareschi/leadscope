import type { HTMLMotionProps } from "motion/react";

/** Rows grow in, shrink out, and slide to their new place after a move. */
export const rowMotion = {
  layout: "position",
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
  transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] },
} satisfies HTMLMotionProps<"li">;
