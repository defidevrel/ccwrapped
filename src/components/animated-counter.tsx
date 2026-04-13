"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  delay?: number;
  format?: (n: number) => string;
  className?: string;
}

export function AnimatedCounter({
  value,
  duration = 1.2,
  delay = 0,
  format,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!isInView) return;

    const timeout = setTimeout(() => {
      const start = performance.now();
      const durationMs = duration * 1000;

      function tick() {
        const elapsed = performance.now() - start;
        const progress = Math.min(elapsed / durationMs, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(eased * value);
        setDisplay(format ? format(current) : current.toLocaleString("en-US"));

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          setDisplay(format ? format(value) : value.toLocaleString("en-US"));
        }
      }

      requestAnimationFrame(tick);
    }, delay * 1000);

    return () => clearTimeout(timeout);
  }, [isInView, value, duration, delay, format]);

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.3, delay }}
    >
      {display}
    </motion.span>
  );
}
