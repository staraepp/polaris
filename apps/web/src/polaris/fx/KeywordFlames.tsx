import { useEffect, useLayoutEffect, useRef } from "react";

import {
  composerRectInCanvas,
  FLAME_FRAGMENT_SHADER,
  FLAME_MARGIN,
  FLAME_QUALITY,
  FLAME_VERTEX_SHADER,
  type FlameQuality,
  pickFlameQuality,
  QUALITY_SAMPLE_FRAMES,
} from "./flameShader";

/** Seconds to fade the flames in or out. */
const FADE_SECONDS = 0.45;

// Decided once per session from the first frames, then kept.
let sessionQuality: FlameQuality | null = null;

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (shader === null) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, FLAME_VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FLAME_FRAGMENT_SHADER);
  if (vertex === null || fragment === null) return null;
  const program = gl.createProgram();
  if (program === null) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

interface FlameRenderer {
  /** Restarts the loop after it stopped on a full fade-out. */
  readonly kick: () => void;
  readonly dispose: () => void;
}

/**
 * Draws the flames into `canvas` until faded out; `live` is read every frame.
 * Returns null, after calling `onUnavailable`, when WebGL cannot run them.
 */
function startFlameRenderer(
  canvas: HTMLCanvasElement,
  live: () => { readonly active: boolean; readonly theme: "light" | "dark" },
  onUnavailable: () => void,
): FlameRenderer | null {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: false });
  if (gl === null) {
    onUnavailable();
    return null;
  }
  const program = createProgram(gl);
  if (program === null) {
    onUnavailable();
    return null;
  }
  const onLost = (event: Event) => {
    event.preventDefault();
    onUnavailable();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.useProgram(program);
  const position = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uniform = (name: string) => gl.getUniformLocation(program, name);
  const u = {
    pixelRatio: uniform("uPixelRatio"),
    rect: uniform("uRect"),
    radius: uniform("uRadius"),
    time: uniform("uTime"),
    intensity: uniform("uIntensity"),
    octaves: uniform("uOctaves"),
    embers: uniform("uEmbers"),
    light: uniform("uLight"),
  };

  const host = canvas.parentElement;
  const hostRadius = host ? Number.parseFloat(getComputedStyle(host).borderTopLeftRadius) : 24;
  const radius = Number.isFinite(hostRadius) ? hostRadius : 24;

  let quality = sessionQuality ?? FLAME_QUALITY.high;
  const samples: number[] = [];
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  const resize = () => {
    pixelRatio = Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  let intensity = 0;
  let frame = 0;
  let looping = false;
  let last = performance.now();
  const start = last;
  const draw = (now: number) => {
    const delta = Math.min(0.1, (now - last) / 1000);
    last = now;
    const target = live().active ? 1 : 0;
    intensity +=
      Math.sign(target - intensity) * Math.min(Math.abs(target - intensity), delta / FADE_SECONDS);
    if (sessionQuality === null && live().active) {
      samples.push(delta * 1000);
      if (samples.length >= QUALITY_SAMPLE_FRAMES) {
        sessionQuality = pickFlameQuality(samples);
        if (sessionQuality !== quality) {
          quality = sessionQuality;
          resize();
        }
      }
    }
    const [x0, y0, x1, y1] = composerRectInCanvas(width, height);
    gl.uniform1f(u.pixelRatio, pixelRatio);
    gl.uniform4f(u.rect, x0, y0, x1, y1);
    gl.uniform1f(u.radius, radius);
    gl.uniform1f(u.time, (now - start) / 1000);
    gl.uniform1f(u.intensity, intensity);
    gl.uniform1f(u.octaves, quality.octaves);
    gl.uniform1f(u.embers, quality.embers ? 1 : 0);
    gl.uniform1f(u.light, live().theme === "light" ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // Faded out: leave a clear canvas and stop until active again.
    if (!live().active && intensity <= 0) {
      looping = false;
      return;
    }
    frame = requestAnimationFrame(draw);
  };
  const kick = () => {
    if (looping) return;
    looping = true;
    last = performance.now();
    frame = requestAnimationFrame(draw);
  };
  kick();

  return {
    kick,
    dispose: () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}

/**
 * The keyword level's flames (Polaris, V 5.3.0), drawn on a canvas that
 * reaches a little past the composer it sits in. Animates only while `active`
 * and the window is in front of the user (`running`), fades in and out, and
 * calls `onUnavailable` when WebGL is missing or the context is lost, so the
 * caller can draw the still ember ring instead.
 */
export function KeywordFlames({
  active,
  running,
  theme,
  onUnavailable,
}: {
  readonly active: boolean;
  /** The window is visible and focused: the flames may move. */
  readonly running: boolean;
  readonly theme: "light" | "dark";
  readonly onUnavailable: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Read by the render loop without restarting it.
  const live = useRef({ active, theme });
  const onUnavailableRef = useRef(onUnavailable);
  useLayoutEffect(() => {
    live.current = { active, theme };
    onUnavailableRef.current = onUnavailable;
  });
  // Restarts the render loop after it stopped on a full fade-out.
  const kickRef = useRef<(() => void) | null>(null);

  // Set up while the window is in front of the user; the loop itself runs
  // only while lit or fading, and a blurred window keeps its last frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || !running) return;
    const renderer = startFlameRenderer(
      canvas,
      () => live.current,
      () => onUnavailableRef.current(),
    );
    kickRef.current = renderer?.kick ?? null;
    return () => {
      kickRef.current = null;
      renderer?.dispose();
    };
  }, [running]);

  useEffect(() => {
    if (active) kickRef.current?.();
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      data-polaris-keyword-flames
      style={{
        position: "absolute",
        top: -FLAME_MARGIN.top,
        left: -FLAME_MARGIN.side,
        // A canvas keeps its intrinsic size under insets, so size it outright.
        width: `calc(100% + ${FLAME_MARGIN.side * 2}px)`,
        height: `calc(100% + ${FLAME_MARGIN.top + FLAME_MARGIN.bottom}px)`,
        zIndex: 25,
        pointerEvents: "none",
      }}
    />
  );
}
