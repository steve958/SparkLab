"use client";

import { useMemo, useEffect, useState } from "react";

// Chemistry-flavored particle burst that fires when the mission
// complete overlay opens. Uses element-category colors so the burst
// reads as "atoms of all kinds celebrating" rather than generic
// confetti — ties the celebration back to what the player just did.
// Honors prefers-reduced-motion (renders nothing in that case so
// vestibular-sensitive players don't get a sudden burst).
const PARTICLE_COLORS = [
  "#ef4444", // oxygen / alkali (red)
  "#3b82f6", // hydrogen / nitrogen (blue)
  "#475569", // carbon (slate)
  "#f59e0b", // transition metal (amber)
  "#84cc16", // post-transition (lime)
  "#06b6d4", // noble gas (cyan)
  "#8b5cf6", // halogen (violet)
  "#15803d", // brand green
];

interface Particle {
  id: number;
  color: string;
  dx: number;
  dy: number;
  size: number;
  delay: number;
  duration: number;
  rotateEnd: number;
}

function makeParticles(count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    // Spread angles roughly evenly with a small jitter so the burst
    // doesn't look like a dial.
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const distance = 110 + Math.random() * 130;
    particles.push({
      id: i,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      size: 7 + Math.random() * 8,
      delay: Math.random() * 120,
      duration: 950 + Math.random() * 350,
      rotateEnd: (Math.random() - 0.5) * 540,
    });
  }
  return particles;
}

export default function MissionCompleteConfetti() {
  const particles = useMemo(() => makeParticles(28), []);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  if (reduceMotion) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center z-10"
      aria-hidden
    >
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full mission-burst-particle"
          style={
            {
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.color,
              boxShadow: `0 0 8px ${p.color}aa`,
              animationDelay: `${p.delay}ms`,
              animationDuration: `${p.duration}ms`,
              "--burst-x": `${p.dx}px`,
              "--burst-y": `${p.dy}px`,
              "--burst-rotate": `${p.rotateEnd}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
