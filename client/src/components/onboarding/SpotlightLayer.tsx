import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";

interface SpotlightLayerProps {
  rect: DOMRect;
  onDismiss?: () => void;
}

export function SpotlightLayer({ rect, onDismiss }: SpotlightLayerProps) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9998]"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div
          className="absolute inset-0 bg-black/60 pointer-events-auto"
          role="presentation"
          onClick={onDismiss}
        />
        <motion.div
          className="absolute pointer-events-none rounded-2xl ring-2 ring-white/40 shadow-[0_0_50px_rgba(0,0,0,0.4)]"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
        >
          <div className="absolute inset-0 rounded-2xl border border-white/30 shadow-[0_0_30px_rgba(255,255,255,0.35)]" />
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

