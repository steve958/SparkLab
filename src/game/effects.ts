import { Container, Graphics, Text, Ticker } from "pixi.js";

// ============================================================================
// SparkLab Visual Effects Engine
// PixiJS-based animations and particles
// ============================================================================

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
}

export function createParticleBurst(
  container: Container,
  x: number,
  y: number,
  color: number,
  count = 30
): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed = 2 + Math.random() * 4;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      maxLife: 0.8 + Math.random() * 0.6,
      color,
      size: 3 + Math.random() * 4,
    });
  }

  const graphics = new Graphics();
  container.addChild(graphics);

  const ticker = new Ticker();
  ticker.add(() => {
    let alive = false;
    graphics.clear();
    for (const p of particles) {
      if (p.life <= 0) continue;
      alive = true;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // gravity
      p.life -= 1 / 60 / p.maxLife;
      const alpha = Math.max(0, p.life);
      graphics.beginFill(p.color, alpha);
      graphics.drawCircle(p.x, p.y, p.size * alpha);
      graphics.endFill();
    }
    if (!alive) {
      ticker.stop();
      ticker.destroy();
      graphics.destroy();
    }
  });
  ticker.start();

  return particles;
}

export function shakeSprite(
  sprite: Container,
  intensity = 8,
  duration = 300
): void {
  const originalX = sprite.x;
  const startTime = performance.now();

  function tick(now: number) {
    const elapsed = now - startTime;
    if (elapsed >= duration) {
      sprite.x = originalX;
      return;
    }
    const progress = elapsed / duration;
    const decay = 1 - progress;
    const offset = Math.sin(progress * Math.PI * 8) * intensity * decay;
    sprite.x = originalX + offset;
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

export function animateBondDraw(
  graphics: Graphics,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: number,
  width: number,
  duration = 200
): void {
  const startTime = performance.now();

  function tick(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);

    const currentX = fromX + (toX - fromX) * ease;
    const currentY = fromY + (toY - fromY) * ease;

    graphics.clear();
    graphics.moveTo(fromX, fromY);
    graphics.lineTo(currentX, currentY);
    graphics.stroke({ color, width });

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}

export function createTooltip(
  parent: Container,
  x: number,
  y: number,
  text: string
): Container {
  const container = new Container();
  container.x = x;
  container.y = y - 40;

  const label = new Text({
    text,
    style: {
      fontSize: 12,
      fill: 0xffffff,
      fontWeight: "bold",
    },
  });
  label.anchor.set(0.5);

  const bg = new Graphics();
  bg.roundRect(
    -label.width / 2 - 8,
    -label.height / 2 - 4,
    label.width + 16,
    label.height + 8,
    6
  );
  bg.fill(0x1e293b, 0.9);

  container.addChild(bg, label);
  parent.addChild(container);

  // Auto fade out
  let alpha = 1;
  const fadeTicker = new Ticker();
  fadeTicker.add(() => {
    alpha -= 0.02;
    container.alpha = alpha;
    if (alpha <= 0) {
      fadeTicker.stop();
      fadeTicker.destroy();
      container.destroy();
    }
  });
  setTimeout(() => fadeTicker.start(), 1500);

  return container;
}

export function createElectronOrbital(
  parent: Container,
  x: number,
  y: number,
  radius: number,
  color: number
): Graphics {
  const graphics = new Graphics();
  graphics.x = x;
  graphics.y = y;

  let angle = 0;
  const ticker = new Ticker();
  ticker.add(() => {
    angle += 0.02;
    graphics.clear();
    graphics.lineStyle(2, color, 0.3);
    graphics.drawCircle(0, 0, radius);

    // Draw electrons
    const electronCount = Math.min(8, Math.floor(radius / 6));
    for (let i = 0; i < electronCount; i++) {
      const a = angle + (Math.PI * 2 * i) / electronCount;
      const ex = Math.cos(a) * radius;
      const ey = Math.sin(a) * radius;
      graphics.beginFill(color, 0.8);
      graphics.drawCircle(ex, ey, 2);
      graphics.endFill();
    }
  });
  ticker.start();

  parent.addChild(graphics);
  return graphics;
}

export function animateIonicTransfer(
  container: Container,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: number,
  duration = 400
): void {
  const electron = new Graphics();
  electron.circle(0, 0, 4);
  electron.fill(color);
  electron.x = fromX;
  electron.y = fromY;
  container.addChild(electron);

  const startTime = performance.now();

  function tick(now: number) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);

    electron.x = fromX + (toX - fromX) * ease;
    electron.y = fromY + (toY - fromY) * ease;
    electron.alpha = 1 - Math.abs(progress - 0.5) * 2;

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      electron.destroy();
    }
  }

  requestAnimationFrame(tick);
}
