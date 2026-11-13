// Framing metadata consumes an unmodified generated PNG. It never rewrites the
// source atlas, pivots or locomotion clips.
export function frontIdlePlacement(spec) {
  const [sx, sy, sw, sh] = spec.sourceRect;
  if (![sx, sy, sw, sh].every(Number.isFinite) || sw <= 0 || sh <= 0) throw new TypeError('Invalid front idle bounds');
  const height = spec.renderedHeight || 202;
  const width = height * sw / sh;
  const pivot = spec.pivot || [128, 218];
  return [sx, sy, sw, sh, pivot[0] - width / 2, pivot[1] - height, width, height];
}

export function drawFrontIdle(context, image, spec) {
  context.drawImage(image, ...frontIdlePlacement(spec));
}
