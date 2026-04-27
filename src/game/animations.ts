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

/** Tween scale with an overshoot ("pop") — easeOutBack so the sprite
 *  rebounds slightly past `to` before settling. Intended for fresh
 *  spawn-in animations where a flat ease feels mechanical. */
export function animateScalePop(
  sprite: Container,
  from: number,
  to: number,
  duration: number,
  onComplete?: () => void
) {
  const startTime = performance.now();
  // Standard easeOutBack constants — ~10% overshoot, settles cleanly.
  const c1 = 1.70158;
  const c3 = c1 + 1;

  function tick(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease =
      1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);
    const scale = from + (to - from) * ease;
    sprite.scale.set(scale);

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      // Make sure we land exactly on `to` even if floating-point ease
      // overshot fractionally on the last frame.
      sprite.scale.set(to);
      if (onComplete) onComplete();
    }
  }

  requestAnimationFrame(tick);
}

/** Tween a sprite's alpha via easeOutCubic over `duration` ms. */
export function animateAlpha(
  sprite: Container,
  from: number,
  to: number,
  duration: number,
  onComplete?: () => void
) {
  const startTime = performance.now();
  sprite.alpha = from;

  function tick(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    sprite.alpha = from + (to - from) * ease;

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else if (onComplete) {
      onComplete();
    }
  }

  requestAnimationFrame(tick);
}
