import { VoiceBeam } from "voice-glow";

/**
 * The voice-reactive glow around the composer (Polaris, `voice-glow` MIT).
 * Drawn in the brand's green family; while transcribing it settles to a slow
 * pulse. Only mounted while voice owns the composer outline and motion is on.
 */
export default function VoiceGlow({
  level,
  processing,
  theme,
}: {
  readonly level: () => number;
  readonly processing: boolean;
  readonly theme: "light" | "dark";
}) {
  return (
    <VoiceBeam
      aria-hidden
      className="pointer-events-none z-20 rounded-[inherit]"
      // Inline, because the library sets its own `position: relative`, which
      // beat the classes and collapsed the glow to nothing (fixed in V 4.5.0).
      style={{ position: "absolute", inset: 0 }}
      level={processing ? () => 0.22 + 0.12 * Math.sin(performance.now() / 420) : level}
      colorVariant="forest"
      theme={theme}
      borderRadius={24}
      strength={processing ? 0.7 : 1}
    >
      <div className="size-full rounded-[inherit]" />
    </VoiceBeam>
  );
}
