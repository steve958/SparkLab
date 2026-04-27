"use client";

interface AtomSpinnerProps {
  size?: number;
  className?: string;
  // Optional aria-label override; defaults to "Loading".
  label?: string;
}

// Atom-themed loading indicator: a brand-green nucleus with a single
// electron orbiting along a faint outer ring. Replaces the generic
// CSS border-spinner used across loading / Suspense fallbacks. Pure
// CSS animation (rotor element rotates around its own center, the
// electron child rides at the top edge so it traces the orbit), no
// per-frame JS. The global prefers-reduced-motion rule in
// globals.css already zeros the animation for vestibular-sensitive
// users — they see the static "atom" as a brand mark instead.
export default function AtomSpinner({
  size = 48,
  className = "",
  label = "Loading",
}: AtomSpinnerProps) {
  const electronSize = size * 0.16;
  const nucleusSize = size * 0.42;
  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label={label}
    >
      {/* Faint outer orbit ring — sets the path the electron rides. */}
      <div className="absolute inset-0 rounded-full border border-primary/25" />

      {/* Nucleus: brand-green disk, soft glow underneath. */}
      <div
        className="absolute rounded-full bg-primary"
        style={{
          width: nucleusSize,
          height: nucleusSize,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          boxShadow: `0 0 ${size * 0.2}px rgba(21, 128, 61, 0.45)`,
        }}
      />

      {/* Orbiting rotor — same size as the container, spins around
          its own center. The electron child sits at the top edge and
          is carried around by the rotation, tracing the orbit. */}
      <div className="absolute inset-0 atom-spinner-rotor">
        <div
          className="absolute rounded-full bg-primary"
          style={{
            width: electronSize,
            height: electronSize,
            top: 0,
            left: "50%",
            transform: "translate(-50%, -50%)",
            boxShadow: `0 0 ${size * 0.12}px rgba(21, 128, 61, 0.55)`,
          }}
        />
      </div>
    </div>
  );
}
