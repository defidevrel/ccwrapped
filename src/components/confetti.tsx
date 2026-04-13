"use client";

import { useEffect, useState } from "react";

interface Particle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
  delay: number;
  duration: number;
  drift: number;
}

const COLORS = ["#8B5CF6", "#A78BFA", "#C4B5FD", "#DDD6FE", "#FAFAFA", "#7C3AED", "#6D28D9"];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function Confetti({ count = 60, trigger = true }: { count?: number; trigger?: boolean }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!trigger) return;

    const timer = setTimeout(() => {
      const newParticles: Particle[] = Array.from({ length: count }, (_, i) => ({
        id: i,
        x: randomBetween(5, 95),
        y: randomBetween(-20, -5),
        rotation: randomBetween(0, 360),
        scale: randomBetween(0.5, 1.2),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: randomBetween(0, 0.5),
        duration: randomBetween(1.8, 3.5),
        drift: randomBetween(-30, 30),
      }));
      setParticles(newParticles);
    }, 300);

    return () => clearTimeout(timer);
  }, [trigger, count]);

  if (particles.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            "--drift": `${p.drift}px`,
          } as React.CSSProperties}
        >
          <div
            style={{
              width: `${6 * p.scale}px`,
              height: `${10 * p.scale}px`,
              backgroundColor: p.color,
              transform: `rotate(${p.rotation}deg)`,
              borderRadius: "1px",
            }}
          />
        </div>
      ))}
    </div>
  );
}
