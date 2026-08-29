/**
 * Cutting-layout maths — a direct port of src/tile_takeoff/cutting.py.
 *
 * It lives in the browser on purpose: the whole promise of the web version is
 * that a floor plan never leaves the machine it was opened on. Nothing here
 * touches the network.
 *
 * All dimensions are centimetres unless the name says otherwise. Areas are m².
 *
 * Keep this file in step with cutting.py — the reference case (a 295x175 slab
 * cutting to 147.5x87.5 with zero waste) is asserted in both.
 */

export const DEFAULT_MAX_SIDE_CM = 150;
export const DEFAULT_MIN_SIDE_CM = 40;
export const DEFAULT_ALLOWANCE = 0.1;
const MAX_DIVISIONS = 12;

export const STANDARD_SIZES_CM = [
  [60, 60], [80, 80], [60, 120], [75, 75], [100, 100], [90, 90],
];

/** Parse "295x175", "295 X 175", "295*175" or "295×175" into [295, 175]. */
export function parseDimensions(text) {
  const cleaned = String(text).toLowerCase().replace(/×/g, 'x').replace(/\*/g, 'x').replace(/\s/g, '');
  if (!cleaned.includes('x')) throw new Error(`expected a size like 295x175, got "${text}"`);
  const [a, b] = cleaned.split('x');
  const width = Number(a);
  const height = Number(b);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`dimensions must be positive numbers, got "${text}"`);
  }
  return [width, height];
}

/** How many whole tiles fit on the slab, trying both tile orientations. */
export function tilesPerSlab(slabW, slabH, tileW, tileH) {
  const fit = (w, h) => Math.floor(slabW / w) * Math.floor(slabH / h);
  return Math.max(fit(tileW, tileH), fit(tileH, tileW));
}

function makeOption(width, height, rows, cols) {
  return {
    widthCm: width,
    heightCm: height,
    rows,
    cols,
    perSlab: rows * cols,
    areaM2: (width * height) / 10000,
    wasteFraction(slabW, slabH) {
      const slabArea = slabW * slabH;
      return (slabArea - this.perSlab * this.widthCm * this.heightCm) / slabArea;
    },
  };
}

/**
 * Every tile size that divides the slab into an exact grid, largest first.
 * These waste nothing at the slab — only at the room's edges.
 */
export function zeroWasteOptions(slabW, slabH, minSide = DEFAULT_MIN_SIDE_CM, maxSide = DEFAULT_MAX_SIDE_CM) {
  const options = [];
  const seen = new Set();

  for (let rows = 1; rows <= MAX_DIVISIONS; rows++) {
    for (let cols = 1; cols <= MAX_DIVISIONS; cols++) {
      const width = slabW / rows;
      const height = slabH / cols;
      const shorter = Math.min(width, height);
      const longer = Math.max(width, height);
      if (shorter < minSide - 1e-9 || longer > maxSide + 1e-9) continue;
      const key = `${width.toFixed(2)}x${height.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      options.push(makeOption(width, height, rows, cols));
    }
  }
  return options.sort((a, b) => b.areaM2 - a.areaM2);
}

/** Pick the tile orientation that leaves the smallest strip to cut at the walls. */
export function fitToFloor(tileW, tileH, floorW, floorH) {
  let best = null;
  for (const [w, h] of [[tileW, tileH], [tileH, tileW]]) {
    const across = Math.floor(floorW / w);
    const up = Math.floor(floorH / h);
    const candidate = {
      tileWidthCm: w,
      tileHeightCm: h,
      coursesAcross: across,
      coursesUp: up,
      borderAcrossCm: floorW - across * w,
      borderUpCm: floorH - up * h,
    };
    candidate.totalBorderCm = candidate.borderAcrossCm + candidate.borderUpCm;
    if (best === null || candidate.totalBorderCm < best.totalBorderCm) best = candidate;
  }
  return best;
}

/** The largest zero-waste tile; ties broken by how cleanly it lands on the room. */
export function recommend(slabW, slabH, floorW = null, floorH = null, minSide = DEFAULT_MIN_SIDE_CM, maxSide = DEFAULT_MAX_SIDE_CM) {
  const options = zeroWasteOptions(slabW, slabH, minSide, maxSide);
  if (options.length === 0) return null;
  if (floorW && floorH) {
    return options.slice().sort((a, b) => {
      if (Math.abs(b.areaM2 - a.areaM2) > 1e-9) return b.areaM2 - a.areaM2;
      return fitToFloor(a.widthCm, a.heightCm, floorW, floorH).totalBorderCm
           - fitToFloor(b.widthCm, b.heightCm, floorW, floorH).totalBorderCm;
    })[0];
  }
  return options[0];
}

/** [width, height, tiles per slab, waste fraction] for each off-the-shelf size. */
export function compareStandardSizes(slabW, slabH) {
  const slabArea = slabW * slabH;
  return STANDARD_SIZES_CM.map(([w, h]) => {
    const count = tilesPerSlab(slabW, slabH, w, h);
    return [w, h, count, (slabArea - count * w * h) / slabArea];
  });
}

/** Quantities for one area, given a chosen tile. Rounding always goes up. */
export function takeoff(areaM2, tileAreaM2, slabAreaM2, allowance = DEFAULT_ALLOWANCE) {
  return {
    areaM2,
    tileAreaM2,
    slabAreaM2,
    allowance,
    tilesNeeded: Math.ceil(areaM2 / tileAreaM2),
    slabsBare: Math.ceil(areaM2 / slabAreaM2),
    slabsWithAllowance: Math.ceil((areaM2 * (1 + allowance)) / slabAreaM2),
  };
}
