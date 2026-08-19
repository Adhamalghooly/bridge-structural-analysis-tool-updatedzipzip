/**
 * Slab Geometry Helpers
 * ======================
 * دوال هندسة البلاطات — مستخرجة من Index.tsx في المرحلة 2 من إعادة الهيكلة.
 * دوال خالصة (pure functions) لا تعتمد على React أو حالة التطبيق.
 */

import type { Slab } from './structuralEngine';

/** Returns the polygon vertices of a slab (uses slab.vertices if present, otherwise builds rectangle). */
export function getSlabPolygonVerts(slab: Slab): { x: number; y: number }[] {
  if (slab.vertices && slab.vertices.length >= 3) return slab.vertices;
  const x1 = Math.min(slab.x1, slab.x2);
  const y1 = Math.min(slab.y1, slab.y2);
  const x2 = Math.max(slab.x1, slab.x2);
  const y2 = Math.max(slab.y1, slab.y2);
  return [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];
}

/** Ray-casting point-in-polygon test (2D). */
export function pointInPolygon2D(
  px: number,
  py: number,
  poly: { x: number; y: number }[],
): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/** Removes collinear intermediate vertices from an axis-aligned polygon. */
export function removeCollinear(
  poly: { x: number; y: number }[],
): { x: number; y: number }[] {
  if (poly.length <= 3) return poly;
  const result: { x: number; y: number }[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n];
    const curr = poly[i];
    const next = poly[(i + 1) % n];
    const cross =
      (curr.x - prev.x) * (next.y - prev.y) -
      (curr.y - prev.y) * (next.x - prev.x);
    if (Math.abs(cross) > 1e-10) result.push(curr);
  }
  return result.length >= 3 ? result : poly;
}

/**
 * Computes the union polygon of a set of slabs using a grid-based boundary tracing.
 * Works correctly for axis-aligned rectangles and convex polygons.
 * Returns the CCW boundary of the union, or null if computation fails.
 */
export function computeSlabUnionPolygon(
  slabs: Slab[],
): { x: number; y: number }[] | null {
  const polygons = slabs.map(getSlabPolygonVerts);

  const xSet = new Set<number>();
  const ySet = new Set<number>();
  polygons.forEach(poly => poly.forEach(pt => { xSet.add(pt.x); ySet.add(pt.y); }));

  const xs = Array.from(xSet).sort((a, b) => a - b);
  const ys = Array.from(ySet).sort((a, b) => a - b);
  if (xs.length < 2 || ys.length < 2) return null;

  const nx = xs.length - 1;
  const ny = ys.length - 1;

  const covered = (i: number, j: number): boolean => {
    if (i < 0 || i >= nx || j < 0 || j >= ny) return false;
    const cx = (xs[i] + xs[i + 1]) / 2;
    const cy = (ys[j] + ys[j + 1]) / 2;
    return polygons.some(poly => pointInPolygon2D(cx, cy, poly));
  };

  // Build directed half-edge graph for the CCW union boundary.
  // Convention (Y-up, CCW = interior to the left of travel direction):
  //   bottom boundary → edge goes RIGHT  (xs[i]→xs[i+1], y=ys[j])
  //   top    boundary → edge goes LEFT   (xs[i+1]→xs[i], y=ys[j+1])
  //   left   boundary → edge goes DOWN   (x=xs[i], ys[j+1]→ys[j])
  //   right  boundary → edge goes UP     (x=xs[i+1], ys[j]→ys[j+1])
  const edgeMap = new Map<string, [number, number]>();
  const key = (x: number, y: number) => `${x},${y}`;

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      if (!covered(i, j)) continue;
      if (!covered(i, j - 1)) edgeMap.set(key(xs[i],     ys[j]),     [xs[i + 1], ys[j]]);
      if (!covered(i, j + 1)) edgeMap.set(key(xs[i + 1], ys[j + 1]), [xs[i],     ys[j + 1]]);
      if (!covered(i - 1, j)) edgeMap.set(key(xs[i],     ys[j + 1]), [xs[i],     ys[j]]);
      if (!covered(i + 1, j)) edgeMap.set(key(xs[i + 1], ys[j]),     [xs[i + 1], ys[j + 1]]);
    }
  }

  if (edgeMap.size === 0) return null;

  const startKey = edgeMap.keys().next().value!;
  const polygon: { x: number; y: number }[] = [];
  let currentKey = startKey;
  let maxIter = edgeMap.size + 2;

  while (maxIter-- > 0) {
    const [sx, sy] = currentKey.split(',').map(Number);
    polygon.push({ x: sx, y: sy });
    const next = edgeMap.get(currentKey);
    if (!next) break;
    const nextKey = key(next[0], next[1]);
    if (nextKey === startKey) break;
    currentKey = nextKey;
  }

  if (polygon.length < 3) return null;
  return removeCollinear(polygon);
}
