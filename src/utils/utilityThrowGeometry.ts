import { Language, UtilityThrowType } from '../types';

export interface Point2D {
  x: number;
  y: number;
}

export interface ThrowGeometry {
  from: Point2D;
  to: Point2D;
  cp: Point2D;
  mid: Point2D;
  midOnCurve: Point2D;
  dist: number;
  nx: number;
  ny: number;
  bend: number;
  arrivalAngleRad: number;
}

export const THROW_TYPE_META: Record<
  UtilityThrowType,
  { short: string; labelDe: string; labelEn: string }
> = {
  left: { short: 'L', labelDe: 'Linksklick', labelEn: 'Left Click' },
  right: { short: 'R', labelDe: 'Rechtsklick', labelEn: 'Right Click' },
  both: { short: 'L+R', labelDe: 'Links + Rechts', labelEn: 'Left + Right' },
  jump: { short: 'JT', labelDe: 'Jumpthrow', labelEn: 'Jumpthrow' },
  run_jump: { short: 'R+JT', labelDe: 'Run + Jumpthrow', labelEn: 'Run + Jumpthrow' },
};

export const UTILITY_THROW_TYPES: UtilityThrowType[] = ['left', 'right', 'both', 'jump', 'run_jump'];

export function getThrowTypeLabel(throwType: UtilityThrowType | undefined, lang: Language): string {
  const key = throwType || 'left';
  const meta = THROW_TYPE_META[key] || THROW_TYPE_META.left;
  return lang === 'de' ? meta.labelDe : meta.labelEn;
}

export function formatThrowTypeFull(throwType: UtilityThrowType | undefined, lang: Language): string {
  const key = throwType || 'left';
  const meta = THROW_TYPE_META[key] || THROW_TYPE_META.left;
  const label = lang === 'de' ? meta.labelDe : meta.labelEn;
  return meta.short === label ? label : `${meta.short} · ${label}`;
}


/**
 * Computes a consistent default perpendicular arc bend so throws bow upward naturally
 * on screen regardless of left-to-right or right-to-left direction.
 */
export function getDefaultCurveBend(from: Point2D, to: Point2D): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) return 0;
  const magnitude = Math.min(12, Math.max(2.5, dist * 0.22));
  const sign = dx >= 0 ? -1 : 1;
  return Math.round(magnitude * sign * 10) / 10;
}

/**
 * Computes full quadratic Bezier geometry between throw origin `from` and landing `to`.
 * All coordinates live in centered map % space (-50 to +50).
 */
export function getThrowGeometry(
  from: Point2D,
  to: Point2D,
  curveBend?: number
): ThrowGeometry {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);

  const nx = dist > 0.001 ? -dy / dist : 0;
  const ny = dist > 0.001 ? dx / dist : -1;
  const bend = curveBend !== undefined ? curveBend : getDefaultCurveBend(from, to);

  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const cx = mx + nx * bend;
  const cy = my + ny * bend;

  // Point on quadratic Bezier at t = 0.5
  const midOnCurveX = 0.25 * from.x + 0.5 * cx + 0.25 * to.x;
  const midOnCurveY = 0.25 * from.y + 0.5 * cy + 0.25 * to.y;

  // Derivative near landing endpoint (t = 0.88) for crisp arrowhead/chevron alignment
  const t = 0.88;
  const dxdt = 2 * (1 - t) * (cx - from.x) + 2 * t * (to.x - cx);
  const dydt = 2 * (1 - t) * (cy - from.y) + 2 * t * (to.y - cy);
  const arrivalAngleRad =
    Math.hypot(dxdt, dydt) > 0.0001 ? Math.atan2(dydt, dxdt) : Math.atan2(dy, dx);

  return {
    from,
    to,
    cp: { x: cx, y: cy },
    mid: { x: mx, y: my },
    midOnCurve: { x: midOnCurveX, y: midOnCurveY },
    dist,
    nx,
    ny,
    bend,
    arrivalAngleRad,
  };
}

/**
 * Converts a dragged curve-handle cursor coordinate into the exact signed `curveBend` scalar
 * so the midpoint of the Bezier follows the cursor 1:1.
 */
export function computeCurveBendFromHandlePoint(
  from: Point2D,
  to: Point2D,
  handlePt: Point2D
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) return 0;

  const nx = -dy / dist;
  const ny = dx / dist;
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;

  const offsetAlongNormal = (handlePt.x - mx) * nx + (handlePt.y - my) * ny;
  const rawBend = offsetAlongNormal * 2;
  const clamped = Math.max(-45, Math.min(45, rawBend));
  return Math.round(clamped * 10) / 10;
}

export function evaluateQuadraticBezier(
  p0: Point2D,
  cp: Point2D,
  p2: Point2D,
  t: number
): Point2D {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * cp.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * cp.y + t * t * p2.y,
  };
}

function distPointToSegment(p: Point2D, a: Point2D, b: Point2D): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-6) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

/**
 * Returns minimum distance in centered map % units from `pt` to any part of a utility throw curve.
 */
export function distanceToThrowCurve(
  pt: Point2D,
  from: Point2D,
  to: Point2D,
  curveBend?: number
): number {
  const geom = getThrowGeometry(from, to, curveBend);
  let minD = Math.min(
    Math.hypot(pt.x - from.x, pt.y - from.y),
    Math.hypot(pt.x - to.x, pt.y - to.y)
  );
  const steps = 16;
  let prev = from;
  for (let i = 1; i <= steps; i++) {
    const cur = evaluateQuadraticBezier(from, geom.cp, to, i / steps);
    const d = distPointToSegment(pt, prev, cur);
    if (d < minD) minD = d;
    prev = cur;
  }
  return minD;
}
