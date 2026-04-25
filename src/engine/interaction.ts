import type { SceneAtom } from "@/types";

export function nudgePosition(
  x: number,
  y: number,
  key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
  step = 10
): { x: number; y: number } {
  switch (key) {
    case "ArrowUp":
      return { x, y: y - step };
    case "ArrowDown":
      return { x, y: y + step };
    case "ArrowLeft":
      return { x: x - step, y };
    case "ArrowRight":
      return { x: x + step, y };
    default:
      return { x, y };
  }
}

export function findNearestAtom(
  selectedAtom: SceneAtom,
  allAtoms: SceneAtom[],
  maxDistance = 150
): SceneAtom | null {
  let nearest: SceneAtom | null = null;
  let nearestDist = Infinity;

  for (const atom of allAtoms) {
    if (atom.id === selectedAtom.id) continue;
    const dx = atom.x - selectedAtom.x;
    const dy = atom.y - selectedAtom.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < nearestDist && dist < maxDistance) {
      nearestDist = dist;
      nearest = atom;
    }
  }

  return nearest;
}

export function shouldTapBond(selectedId: string | null, tappedId: string): boolean {
  return selectedId !== null && selectedId !== tappedId;
}

/**
 * Determines if a pointer event sequence should be treated as a tap
 * rather than a drag, based on movement distance and duration.
 */
export function isTapGesture(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  durationMs: number,
  moveThreshold = 5,
  durationThreshold = 400
): boolean {
  const dx = endX - startX;
  const dy = endY - startY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist <= moveThreshold && durationMs < durationThreshold;
}
