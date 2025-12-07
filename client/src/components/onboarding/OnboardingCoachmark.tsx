import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import type { OnboardingTourStep } from "@/onboarding/steps";

interface OnboardingCoachmarkProps {
  rect: DOMRect;
  step: OnboardingTourStep;
  totalSteps: number;
  stepIndex: number;
  onNext: () => void;
  onSkip: () => void;
}

const CARD_WIDTH = 320;
const CARD_HEIGHT = 180;
const GAP = 16;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const computePosition = (rect: DOMRect, placement: OnboardingTourStep["placement"]) => {
  if (typeof window === "undefined") {
    return { top: 80, left: 80 };
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let top = clamp(rect.bottom + GAP, GAP, viewportHeight - CARD_HEIGHT - GAP);
  let left = clamp(rect.left, GAP, viewportWidth - CARD_WIDTH - GAP);

  switch (placement) {
    case "top":
      top = clamp(rect.top - CARD_HEIGHT - GAP, GAP, viewportHeight - CARD_HEIGHT - GAP);
      break;
    case "left":
      left = clamp(rect.left - CARD_WIDTH - GAP, GAP, viewportWidth - CARD_WIDTH - GAP);
      top = clamp(rect.top, GAP, viewportHeight - CARD_HEIGHT - GAP);
      break;
    case "right":
      left = clamp(rect.right + GAP, GAP, viewportWidth - CARD_WIDTH - GAP);
      top = clamp(rect.top, GAP, viewportHeight - CARD_HEIGHT - GAP);
      break;
    case "bottom":
      top = clamp(rect.bottom + GAP, GAP, viewportHeight - CARD_HEIGHT - GAP);
      left = clamp(rect.left, GAP, viewportWidth - CARD_WIDTH - GAP);
      break;
    default:
      break;
  }

  return { top, left };
};

export function OnboardingCoachmark({
  rect,
  step,
  totalSteps,
  stepIndex,
  onNext,
  onSkip,
}: OnboardingCoachmarkProps) {
  if (typeof document === "undefined") {
    return null;
  }

  const position = computePosition(rect, step.placement);
  const actionLabel = stepIndex === totalSteps - 1 ? "Готово" : "Далее";

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed z-[9999]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        style={{
          top: position.top,
          left: position.left,
          width: CARD_WIDTH,
        }}
      >
        <div className="rounded-2xl bg-white shadow-2xl border border-slate-100 p-5 space-y-3 text-slate-900 max-w-full">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Шаг {stepIndex + 1} из {totalSteps}
          </div>
          <div>
            <h3 className="text-lg font-semibold">{step.title}</h3>
            <p className="text-sm text-slate-600 mt-1">{step.description}</p>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button size="sm" onClick={onNext}>
              {actionLabel}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

