import type { Container } from "pixi.js";

/** Tween a sprite's scale via easeOutCubic over `duration` ms. */
export function animateScale(
  sprite: Container,
  from: number,
  to: number,
  duration: number,
  onComplete?: () => void
) {
  const startTime = performance.now();

  function tick(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    const scale = from + (to - from) * ease;
    sprite.scale.set(scale);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else if (onComplete) {
      onComplete();
    }
  }

  requestAnimationFrame(tick);
}
