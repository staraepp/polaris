/**
 * Polaris (V 5.3.0): the keyword level's flames. A WebGL1 fragment shader on a
 * canvas a little larger than the composer: fbm noise scrolled upward shapes
 * flame tongues outside the composer's rounded rectangle, tallest on the top
 * edge, climbing the sides and only a glow along the bottom, colored by a
 * blackbody ramp, with embers rising above. Inside the composer only a thin
 * ember border is drawn, so text stays readable.
 */

/** How far the canvas reaches past the composer, in CSS pixels. */
export const FLAME_MARGIN = { top: 40, side: 16, bottom: 10 } as const;

export interface FlameQuality {
  readonly name: "high" | "low";
  /** Cap on device pixels per CSS pixel. */
  readonly maxPixelRatio: number;
  readonly octaves: number;
  readonly embers: boolean;
}

export const FLAME_QUALITY = {
  high: { name: "high", maxPixelRatio: 2, octaves: 4, embers: true },
  low: { name: "low", maxPixelRatio: 1, octaves: 2, embers: false },
} as const satisfies Record<FlameQuality["name"], FlameQuality>;

/** Frames sampled before deciding whether the machine keeps up. */
export const QUALITY_SAMPLE_FRAMES = 90;

/**
 * High quality unless frames come slower than ~45 fps. The median ignores the
 * odd long frame (a tab switch, a GC pause).
 */
export function pickFlameQuality(frameMs: readonly number[]): FlameQuality {
  if (frameMs.length === 0) return FLAME_QUALITY.high;
  const sorted = frameMs.toSorted((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return median > 22 ? FLAME_QUALITY.low : FLAME_QUALITY.high;
}

/** The composer's rectangle inside the canvas, in CSS pixels, y up (GL order). */
export function composerRectInCanvas(
  canvasWidth: number,
  canvasHeight: number,
): readonly [x0: number, y0: number, x1: number, y1: number] {
  return [
    FLAME_MARGIN.side,
    FLAME_MARGIN.bottom,
    Math.max(FLAME_MARGIN.side, canvasWidth - FLAME_MARGIN.side),
    Math.max(FLAME_MARGIN.bottom, canvasHeight - FLAME_MARGIN.top),
  ];
}

export const FLAME_VERTEX_SHADER = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

export const FLAME_FRAGMENT_SHADER = `
precision highp float;

uniform float uPixelRatio;
uniform vec4 uRect;       // composer x0, y0, x1, y1 in CSS px, y up
uniform float uRadius;    // composer corner radius, CSS px
uniform float uTime;      // seconds
uniform float uIntensity; // 0..1, fades the whole effect in and out
uniform float uOctaves;   // 2 or 4
uniform float uEmbers;    // 0 or 1
uniform float uLight;     // 1 on a light theme

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    if (float(i) >= uOctaves) break;
    value += amplitude * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    amplitude *= 0.5;
  }
  return value;
}

// Signed distance to a rounded rectangle: negative inside, CSS px.
float roundedRect(vec2 p, vec2 center, vec2 halfSize, float radius) {
  vec2 q = abs(p - center) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

// Blackbody-ish ramp: deep red, orange, gold, white-hot.
vec3 fireColor(float t) {
  vec3 color = mix(vec3(0.45, 0.02, 0.0), vec3(0.86, 0.15, 0.02), smoothstep(0.0, 0.3, t));
  color = mix(color, vec3(1.0, 0.45, 0.06), smoothstep(0.25, 0.55, t));
  color = mix(color, vec3(1.0, 0.76, 0.26), smoothstep(0.5, 0.8, t));
  return mix(color, vec3(1.0, 0.96, 0.84), smoothstep(0.82, 1.0, t));
}

void main() {
  vec2 p = gl_FragCoord.xy / uPixelRatio;
  vec2 center = (uRect.xy + uRect.zw) * 0.5;
  vec2 halfSize = (uRect.zw - uRect.xy) * 0.5;
  float radius = min(uRadius, min(halfSize.x, halfSize.y));
  float d = roundedRect(p, center, halfSize, radius);

  // Which way this stretch of edge faces: +1 on the top edge, 0 on the sides.
  vec2 q = abs(p - center) - halfSize + radius;
  vec2 outward = vec2(sign(p.x - center.x) * max(q.x, 0.0), sign(p.y - center.y) * max(q.y, 0.0));
  float facing = length(outward) > 0.0 ? normalize(outward).y : sign(p.y - center.y);
  float edgeHeight = mix(4.0, 30.0, smoothstep(-0.4, 0.95, facing));
  // Slow swells along the edge, so some stretches flare taller than others.
  edgeHeight *= 0.7 + 0.65 * noise(vec2(p.x * 0.012 + p.y * 0.012, uTime * 0.45));

  // Flame tongues: vertically stretched, domain-warped noise scrolled upward
  // (so fire also climbs the sides). A tongue burns where the noise beats the
  // height above the edge, which leaves dark gaps between tongues.
  float outside = max(d, 0.0);
  float h = outside / edgeHeight;
  vec2 np = vec2(p.x * 0.06, p.y * 0.022 - uTime * 1.5);
  np.x += 0.55 * fbm(np * 0.7 + vec2(uTime * 0.25, 0.0));
  float n = fbm(np) * 0.75 + fbm(np * 2.6 + vec2(0.0, -uTime * 1.2)) * 0.25;
  float body = smoothstep(0.0, 0.35, n * 1.35 - h * 0.95 - 0.12);
  // Inside the composer, only a thin, dimmer border.
  if (d <= 0.0) body = smoothstep(-2.0, 0.0, d) * 0.55;
  // Hottest at the base, cooling toward the tips.
  float heat = body * clamp(1.0 - h * 0.85, 0.0, 1.0) * (0.55 + 0.5 * n);
  // The fire lights its surroundings: a soft warm halo hugging the edge.
  float glow = d > 0.0 ? exp(-outside / 9.0) * 0.22 * (0.7 + 0.3 * n) : 0.0;

  // Embers: sparse sparks drifting up and sideways above the top edge.
  float spark = 0.0;
  if (uEmbers > 0.5) {
    vec2 cell = vec2(p.x / 16.0, (p.y - uTime * 30.0) / 16.0);
    vec2 id = floor(cell);
    float pick = hash(id);
    if (pick > 0.84) {
      vec2 at = vec2(hash(id + 3.1), hash(id + 7.7));
      at.x += 0.25 * sin(uTime * 2.0 + pick * 40.0);
      float dist = length(fract(cell) - at) * 16.0;
      float band = smoothstep(6.0, 14.0, d) * (1.0 - smoothstep(24.0, 38.0, d));
      spark = smoothstep(1.6, 0.0, dist) * band * smoothstep(0.3, 0.9, facing);
      spark *= 0.6 + 0.4 * sin(uTime * 9.0 + pick * 70.0);
    }
  }

  float t = clamp(heat * 1.25 + spark, 0.0, 1.0);
  // Light surfaces: white-hot and pale gold vanish on paper, and the darkest
  // reds read as smudges, so light keeps to the saturated middle of the ramp.
  vec3 color = fireColor(uLight > 0.5 ? mix(0.22, 0.72, t) : t);
  // Tips fade out as they cool.
  float alpha = body * (0.35 + 0.65 * clamp(1.0 - h * 0.6, 0.0, 1.0)) + spark;
  alpha = clamp(alpha * (uLight > 0.5 ? 1.25 : 1.0), 0.0, 1.0);
  glow *= uLight > 0.5 ? 0.5 : 1.0;
  vec3 lit = color * alpha + vec3(1.0, 0.38, 0.08) * glow;
  alpha = clamp(alpha + glow, 0.0, 1.0) * uIntensity;
  lit *= uIntensity;
  gl_FragColor = vec4(lit, alpha);
}
`;
