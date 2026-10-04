import type { ScaleName } from "../constants/notes";
import {
  beadCountPatch,
  scalePatch,
  sectionCountPatch,
  type WheelConfig,
} from "../constants/wheelConfig";

type WheelControlsProps = {
  title: string;
  config: WheelConfig;
  maxSections: number;
  onChange: (patch: Partial<WheelConfig>) => void;
  // When set, the wheel plays these sounds (e.g. drums) and only the volume,
  // tone and reverb controls apply.
  noteNames?: readonly string[];
  // Only the first wheel sets the spin; the second one is driven by it.
  spin?: {
    direction: 1 | -1;
    speed: number;
    onReverse: () => void;
    onSpeedChange: (value: number) => void;
  };
};

const SCALE_OPTIONS: { value: ScaleName; label: string }[] = [
  { value: "custom", label: "Custom chromatic (C3-B6)" },
  { value: "ePhrygianDominant", label: "E Phrygian dominant" },
  { value: "eMinorPentatonic", label: "E minor pentatonic" },
  { value: "cMajor", label: "C major" },
  { value: "eMajor", label: "E major" },
  { value: "aMinor", label: "A minor" },
  { value: "aHarmonicMinor", label: "A harmonic minor" },
  { value: "dDorian", label: "D dorian" },
  { value: "cBluesMinor", label: "C blues minor" },
  { value: "gMixolydian", label: "G mixolydian" },
  { value: "hirajoshi", label: "Hirajoshi" },
  { value: "wholeTone", label: "Whole tone" },
  { value: "indian", label: "Indian" },
];

const WAVEFORMS: OscillatorType[] = ["sine", "triangle", "square", "sawtooth"];

const FILTER_OPTIONS: { value: BiquadFilterType; label: string }[] = [
  { value: "lowpass", label: "Low-pass" },
  { value: "highpass", label: "High-pass" },
  { value: "bandpass", label: "Band-pass" },
  { value: "notch", label: "Notch" },
  { value: "allpass", label: "All-pass" },
];

const fullWidth = { display: "block", width: "100%" } as const;

export function WheelControls({
  title,
  config,
  maxSections,
  onChange,
  noteNames,
  spin,
}: WheelControlsProps) {
  const percentSlider = (
    label: string,
    key: "volume" | "tone" | "reverb" | "sustain" | "ringModulation"
  ) => (
    <label>
      {label}: {Math.round(config[key] * 100)}%
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={config[key]}
        onChange={(event) => onChange({ [key]: Number(event.target.value) })}
        style={fullWidth}
      />
    </label>
  );

  const waveformSelect = (label: string, key: "oscillatorType" | "lfoType") => (
    <label>
      {label}
      <select
        value={config[key]}
        onChange={(event) =>
          onChange({ [key]: event.target.value as OscillatorType })
        }
        style={fullWidth}
      >
        {WAVEFORMS.map((waveform) => (
          <option key={waveform} value={waveform}>
            {waveform[0].toUpperCase() + waveform.slice(1)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <strong>{title}</strong>
      <label>
        Sections: {config.sectionCount}
        <input
          type="range"
          min={2}
          max={maxSections}
          step={1}
          value={config.sectionCount}
          onChange={(event) =>
            onChange(sectionCountPatch(config, Number(event.target.value)))
          }
          style={fullWidth}
        />
      </label>
      <label>
        Beads: {config.beads.length}
        <input
          type="range"
          min={0}
          max={config.sectionCount}
          step={1}
          value={config.beads.length}
          onChange={(event) =>
            onChange(beadCountPatch(config, Number(event.target.value), noteNames))
          }
          style={fullWidth}
        />
      </label>
      {spin && (
        <div style={{ display: "grid", gap: "6px" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={spin.onReverse}
              style={{
                padding: "10px 12px",
                fontSize: "15px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
              }}
              title="Reverse spin direction"
            >
              {spin.direction === 1 ? "+" : "-"}
            </button>
          </div>
          <label>
            Speed: {spin.speed}
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={spin.speed}
              onChange={(event) => spin.onSpeedChange(Number(event.target.value))}
              style={fullWidth}
            />
          </label>
        </div>
      )}
      {!noteNames && (
        <label>
          Scale
          <select
            value={config.scaleName}
            onChange={(event) =>
              onChange(scalePatch(config, event.target.value as ScaleName))
            }
            style={fullWidth}
          >
            {SCALE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      {percentSlider("Volume", "volume")}
      {percentSlider("Tone", "tone")}
      {percentSlider("Reverb", "reverb")}
      {noteNames ? null : (
        <>
          {percentSlider("Sustain", "sustain")}
          {percentSlider("Ring modulation", "ringModulation")}
          {waveformSelect("Oscillator", "oscillatorType")}
          <label>
            Filter
            <select
              value={config.filterType}
              onChange={(event) =>
                onChange({ filterType: event.target.value as BiquadFilterType })
              }
              style={fullWidth}
            >
              {FILTER_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Filter frequency: {Math.round(config.filterFrequency)} Hz
            <input
              type="range"
              min={100}
              max={12000}
              step={10}
              value={config.filterFrequency}
              onChange={(event) =>
                onChange({ filterFrequency: Number(event.target.value) })
              }
              style={fullWidth}
            />
          </label>
          {waveformSelect("LFO waveform", "lfoType")}
          <label>
            LFO rate: {config.lfoRate.toFixed(1)} Hz
            <input
              type="range"
              min={0}
              max={20}
              step={0.1}
              value={config.lfoRate}
              onChange={(event) => onChange({ lfoRate: Number(event.target.value) })}
              style={fullWidth}
            />
          </label>
        </>
      )}
    </>
  );
}
