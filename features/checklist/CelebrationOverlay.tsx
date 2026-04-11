"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Props {
  runId: string;
  active: boolean; // true while 100% complete
}

const STORAGE_PREFIX = "checklist-celebration-";

export function CelebrationOverlay({ runId, active }: Props) {
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const prevActiveRef = useRef(active);

  useEffect(() => {
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = active;

    // Edge-detect active transitions. This effect synchronizes local UI state
    // with an external signal (the `active` prop transition combined with
    // localStorage persistence across reloads), so the setState calls here
    // are intentional and not cascading renders.
    if (active && !wasActive) {
      const key = `${STORAGE_PREFIX}${runId}`;
      const seen = typeof window !== "undefined" ? window.localStorage.getItem(key) : "1";
      if (!seen) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowFullscreen(true);
        try {
          window.localStorage.setItem(key, "1");
        } catch {
          /* ignore */
        }
        const t = setTimeout(() => {
          setShowFullscreen(false);
          setShowBanner(true);
        }, 4000);
        return () => clearTimeout(t);
      } else {
        setShowBanner(true);
      }
    } else if (!active && wasActive) {
      setShowFullscreen(false);
      setShowBanner(false);
    }
  }, [active, runId]);

  return (
    <>
      <AnimatePresence>
        {showBanner && active ? (
          <motion.div
            key="banner"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            style={{
              position: "fixed",
              top: 20,
              left: "50%",
              transform: "translateX(-50%)",
              background: "linear-gradient(90deg, rgba(34,211,238,0.22), rgba(74,222,128,0.18))",
              border: "1px solid #22d3ee",
              borderRadius: 8,
              padding: "12px 18px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              boxShadow: "0 0 24px rgba(34,211,238,0.25)",
              zIndex: 20,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#22d3ee",
                color: "#050a14",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              ✓
            </div>
            <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600 }}>
              All systems ready — to God be the glory
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {showFullscreen ? (
          <motion.div
            key="fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              position: "fixed",
              inset: 0,
              background:
                "radial-gradient(ellipse at center, rgba(34,211,238,0.2), rgba(5,10,20,0.98) 70%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 50,
              pointerEvents: "none",
            }}
          >
            {Array.from({ length: 24 }).map((_, i) => (
              <motion.span
                key={i}
                initial={{ y: -40, x: (i - 12) * 24, opacity: 0, rotate: 0 }}
                animate={{
                  y: [0, 200, 340],
                  opacity: [0, 1, 0.8, 0],
                  rotate: [0, 120, 240, 360],
                }}
                transition={{ duration: 2.8, delay: 0.2 + (i % 6) * 0.08, ease: "easeOut" }}
                style={{
                  position: "absolute",
                  top: "25%",
                  left: "50%",
                  width: 8,
                  height: 14,
                  background: i % 3 === 0 ? "#22d3ee" : i % 3 === 1 ? "#4ade80" : "#fbbf24",
                  borderRadius: 2,
                }}
              />
            ))}
            <motion.div
              initial={{ scale: 0, rotate: -45 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 12 }}
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                background: "#22d3ee",
                color: "#050a14",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 68,
                marginBottom: 24,
                boxShadow: "0 0 60px rgba(34,211,238,0.6)",
              }}
            >
              ✓
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              style={{
                fontSize: 36,
                fontWeight: 800,
                margin: 0,
                color: "#22d3ee",
                textShadow: "0 0 20px rgba(34,211,238,0.4)",
              }}
            >
              All Systems Ready
            </motion.h1>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
              style={{ color: "#94a3b8", fontSize: 16, marginTop: 10 }}
            >
              To God be the glory.
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
