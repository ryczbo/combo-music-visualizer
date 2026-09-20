import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Scene } from "./components/Scene";
import { AudioEngine } from "./services/audioEngine";
import { SCALES, expandScaleOctaves, type ScaleName } from "./constants/notes";

const audioEngine = new AudioEngine();

const MAX_PATTERN_COUNT = 20;

type WheelSettings = {
  active: boolean;
  length: number;
  sectionCount: number;
  beadCount: number;
  spinDirection: 1 | -1;
  spinSpeed: number;
  scaleName: ScaleName;
  volume: number;
  tone: number;
  reverb: number;
  sustain: number;
  ringModulation: number;
  oscillatorType: OscillatorType;
  filterType: BiquadFilterType;
  filterFrequency: number;
  lfoType: OscillatorType;
  lfoRate: number;
};

// Clockwise by default; a negative spin direction reads as clockwise on screen.
const createDefaultWheelSettings = (): WheelSettings => ({
  active: false,
  length: 4,
  sectionCount: 20,
  beadCount: 2,
  spinDirection: -1,
  spinSpeed: 8,
  scaleName: "ePhrygianDominant",
  volume: 0.8,
  tone: 1,
  reverb: 0.24,
  sustain: 0.5,
  ringModulation: 0,
  oscillatorType: "sine",
  filterType: "lowpass",
  filterFrequency: 12000,
  lfoType: "sine",
  lfoRate: 0,
});

export default function App() {
  // Spinning is a single global toggle; each pattern remembers its own
  // direction/speed and every other wheel control independently.
  const [spinning, setSpinning] = useState(false);
  const [activePattern, setActivePattern] = useState(0);
  const [patternSettings, setPatternSettings] = useState<WheelSettings[]>(() => [
    { ...createDefaultWheelSettings(), active: true },
  ]);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [inflateHeld, setInflateHeld] = useState(false);
  const [showOuterRing, setShowOuterRing] = useState(true);
  // Counts full wheel spins completed on the currently playing pattern.
  const spinsCompletedRef = useRef(0);

  const settings = patternSettings[activePattern];

  const exportSettings = () => {
    const blob = new Blob([JSON.stringify(patternSettings, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "combo-music-visualizer-patterns.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importInputRef = useRef<HTMLInputElement>(null);

  const importSettings = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Expected a non-empty array of pattern settings.");
      }
      setPatternSettings(
        parsed.map((pattern) => ({ ...createDefaultWheelSettings(), ...pattern }))
      );
      setActivePattern(0);
    } catch (error) {
      console.warn("Failed to import pattern settings:", error);
    }
  };

  const updatePatternSetting = <K extends keyof WheelSettings>(
    index: number,
    key: K,
    value: WheelSettings[K]
  ) => {
    setPatternSettings((current) => {
      // Bail out without a new array/object when the value is unchanged, so
      // effects driven by this callback's identity don't loop.
      if (current[index][key] === value) return current;
      const next = [...current];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  const updateSetting = <K extends keyof WheelSettings>(
    key: K,
    value: WheelSettings[K]
  ) => updatePatternSetting(activePattern, key, value);

  const togglePatternActive = (index: number, active: boolean) =>
    updatePatternSetting(index, "active", active);

  const updatePatternLength = (index: number, length: number) =>
    updatePatternSetting(index, "length", length);

  const updatePatternCount = (count: number) => {
    setPatternSettings((current) => {
      if (count === current.length) return current;
      if (count > current.length) {
        const additional = Array.from({ length: count - current.length }, () => ({
          ...createDefaultWheelSettings(),
          active: false,
        }));
        return [...current, ...additional];
      }
      return current.slice(0, count);
    });
    setActivePattern((current) => Math.min(current, count - 1));
  };

  const advanceToNextActivePattern = () => {
    setActivePattern((current) => {
      for (let step = 1; step <= patternSettings.length; step += 1) {
        const candidate = (current + step) % patternSettings.length;
        if (patternSettings[candidate].active) return candidate;
      }
      return current;
    });
  };

  const handleFullSpin = () => {
    spinsCompletedRef.current += 1;
    if (settings.length > 0 && spinsCompletedRef.current >= settings.length) {
      spinsCompletedRef.current = 0;
      advanceToNextActivePattern();
    }
  };

  const toggleSpin = async () => {
    if (!spinning) {
      await audioEngine.start();
      spinsCompletedRef.current = 0;
      const firstActiveIndex = patternSettings.findIndex((pattern) => pattern.active);
      if (firstActiveIndex !== -1) {
        setActivePattern(firstActiveIndex);
      }
    }
    setSpinning((current) => !current);
  };

  const reverseSpinDirection = () => {
    updateSetting("spinDirection", settings.spinDirection === 1 ? -1 : 1);
  };

  const updateSpinSpeed = (value: number) => updateSetting("spinSpeed", value);

  const updateBeadCount = (value: number) => updateSetting("beadCount", value);

  const updateVolume = (value: number) => updateSetting("volume", value);

  const updateTone = (value: number) => updateSetting("tone", value);

  const updateReverb = (value: number) => updateSetting("reverb", value);

  const updateSustain = (value: number) => updateSetting("sustain", value);

  const updateRingModulation = (value: number) =>
    updateSetting("ringModulation", value);

  const updateOscillatorType = (value: OscillatorType) =>
    updateSetting("oscillatorType", value);

  const updateFilterType = (value: BiquadFilterType) =>
    updateSetting("filterType", value);

  const updateFilterFrequency = (value: number) =>
    updateSetting("filterFrequency", value);

  const updateLfoType = (value: OscillatorType) =>
    updateSetting("lfoType", value);

  const updateLfoRate = (value: number) => updateSetting("lfoRate", value);

  const updateScale = (value: ScaleName) => updateSetting("scaleName", value);

  // Re-apply the active pattern's audio settings whenever they change, and
  // whenever switching to a pattern that remembers different values.
  useEffect(() => {
    audioEngine.setVolume(settings.volume);
  }, [settings.volume]);

  useEffect(() => {
    audioEngine.setTone(settings.tone);
  }, [settings.tone]);

  useEffect(() => {
    audioEngine.setReverb(settings.reverb);
  }, [settings.reverb]);

  useEffect(() => {
    audioEngine.setSustain(settings.sustain);
  }, [settings.sustain]);

  useEffect(() => {
    audioEngine.setRingModulation(settings.ringModulation);
  }, [settings.ringModulation]);

  useEffect(() => {
    audioEngine.setOscillatorType(settings.oscillatorType);
  }, [settings.oscillatorType]);

  useEffect(() => {
    audioEngine.setFilterType(settings.filterType);
  }, [settings.filterType]);

  useEffect(() => {
    audioEngine.setFilterFrequency(settings.filterFrequency);
  }, [settings.filterFrequency]);

  useEffect(() => {
    audioEngine.setLfoType(settings.lfoType);
  }, [settings.lfoType]);

  useEffect(() => {
    audioEngine.setLfoRate(settings.lfoRate);
  }, [settings.lfoRate]);

  // Register three octaves of the scale so the sector note picker can offer a
  // wider range than the single octave used for automatic sector assignment.
  useEffect(() => {
    audioEngine.setScale(expandScaleOctaves(SCALES[settings.scaleName]));
  }, [settings.scaleName]);

  const noteOptions = Object.entries(
    expandScaleOctaves(SCALES[settings.scaleName])
  )
    .sort((a, b) => a[1] - b[1])
    .map(([note]) => note);

  return (
    <>
      <Canvas
        shadows
        camera={{
          position: [0, 0, 18],
          fov: 45,
        }}
        style={{
          width: "100vw",
          height: "100vh",
          background: "#111111",
        }}
      >
        <Scene
          spinning={spinning}
          spinDirection={settings.spinDirection}
          spinSpeed={settings.spinSpeed}
          audioEngine={audioEngine}
          noteOptions={noteOptions}
          inflateHeld={inflateHeld}
          showOuterRing={showOuterRing}
          sectionCount={settings.sectionCount}
          beadCount={settings.beadCount}
          onBeadCountChange={updateBeadCount}
          onFullSpin={handleFullSpin}
        />
      </Canvas>


      <button
        onClick={() => setControlsVisible((visible) => !visible)}
        aria-label="Toggle wheel controls"
        style={{
          position: "fixed",
          top: "20px",
          left: "20px",
          width: "40px",
          height: "40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          background: "rgba(17, 17, 17, 0.82)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: "8px",
          cursor: "pointer",
          zIndex: 2,
        }}
      >
        <span style={{ width: "18px", height: "2px", background: "white" }} />
        <span style={{ width: "18px", height: "2px", background: "white" }} />
        <span style={{ width: "18px", height: "2px", background: "white" }} />
      </button>

      <button
        onMouseDown={() => setInflateHeld(true)}
        onMouseUp={() => setInflateHeld(false)}
        onMouseLeave={() => setInflateHeld(false)}
        onTouchStart={() => setInflateHeld(true)}
        onTouchEnd={() => setInflateHeld(false)}
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          padding: "10px 16px",
          fontSize: "15px",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          background: "rgba(17, 17, 17, 0.82)",
          color: "white",
          cursor: "pointer",
          opacity: inflateHeld ? 0.6 : 1,
          zIndex: 2,
        }}
      >
        {inflateHeld ? "Inflating..." : "Inflate center"}
      </button>

      <button
        onClick={() => setShowOuterRing((visible) => !visible)}
        style={{
          position: "fixed",
          top: "70px",
          right: "20px",
          padding: "10px 16px",
          fontSize: "15px",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          background: "rgba(17, 17, 17, 0.82)",
          color: "white",
          cursor: "pointer",
          zIndex: 2,
        }}
      >
        {showOuterRing ? "Hide outer ring" : "Show outer ring"}
      </button>

      <button
        onClick={exportSettings}
        style={{
          position: "fixed",
          top: "120px",
          right: "20px",
          padding: "10px 16px",
          fontSize: "15px",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          background: "rgba(17, 17, 17, 0.82)",
          color: "white",
          cursor: "pointer",
          zIndex: 2,
        }}
      >
        Export settings
      </button>

      <button
        onClick={() => importInputRef.current?.click()}
        style={{
          position: "fixed",
          top: "170px",
          right: "20px",
          padding: "10px 16px",
          fontSize: "15px",
          borderRadius: "8px",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          background: "rgba(17, 17, 17, 0.82)",
          color: "white",
          cursor: "pointer",
          zIndex: 2,
        }}
      >
        Import settings
      </button>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) importSettings(file);
          event.target.value = "";
        }}
        style={{ display: "none" }}
      />

      {controlsVisible && (
      <div
        style={{
          position: "fixed",
          top: "70px",
          left: "20px",
          width: "220px",
          maxHeight: "calc(100vh - 90px)",
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          color: "white",
          fontFamily: "sans-serif",
          background: "rgba(17, 17, 17, 0.82)",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          borderRadius: "10px",
          zIndex: 1,
        }}
      >
        <button
          onClick={toggleSpin}
          style={{
            padding: "10px 8px",
            fontSize: "15px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
          }}
        >
          {spinning ? "Stop Spin" : "Spin"}
        </button>

        <label>
          Patterns
          <select
            value={patternSettings.length}
            onChange={(event) => updatePatternCount(Number(event.target.value))}
            style={{ display: "block", width: "100%" }}
          >
            {Array.from({ length: MAX_PATTERN_COUNT }, (_, index) => index + 1).map(
              (count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              )
            )}
          </select>
        </label>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {patternSettings.map((_, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  padding: "6px",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  borderRadius: "6px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input
                      type="checkbox"
                      checked={activePattern === index}
                      onChange={() => setActivePattern(index)}
                    />
                    Pattern {index + 1}
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <input
                      type="checkbox"
                      checked={patternSettings[index].active}
                      onChange={(event) =>
                        togglePatternActive(index, event.target.checked)
                      }
                    />
                    Active
                  </label>
                </div>
                <label>
                  Length: {patternSettings[index].length}
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={1}
                    value={patternSettings[index].length}
                    onChange={(event) =>
                      updatePatternLength(index, Number(event.target.value))
                    }
                    style={{ display: "block", width: "100%" }}
                  />
                </label>
              </div>
          ))}
        </div>

        <strong>Wheel controls</strong>
        <label>
          Sections: {settings.sectionCount}
          <input
            type="range"
            min={2}
            max={20}
            step={1}
            value={settings.sectionCount}
            onChange={(event) =>
              updateSetting("sectionCount", Number(event.target.value))
            }
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          Beads: {settings.beadCount}
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={settings.beadCount}
            onChange={(event) => updateBeadCount(Number(event.target.value))}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <div style={{ display: "grid", gap: "6px" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              onClick={reverseSpinDirection}
              style={{
                padding: "10px 12px",
                fontSize: "15px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
              }}
              title="Reverse spin direction"
            >
              {settings.spinDirection === 1 ? "+" : "-"}
            </button>
          </div>
          <label>
            Speed: {settings.spinSpeed}
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={settings.spinSpeed}
              onChange={(event) => updateSpinSpeed(Number(event.target.value))}
              style={{ display: "block", width: "100%" }}
            />
          </label>
        </div>
        <label>
          Scale
          <select
            value={settings.scaleName}
            onChange={(event) => updateScale(event.target.value as ScaleName)}
            style={{ display: "block", width: "100%" }}
          >
            <option value="ePhrygianDominant">E Phrygian dominant</option>
            <option value="eMinorPentatonic">E minor pentatonic</option>
            <option value="cMajor">C major</option>
            <option value="eMajor">E major</option>
            <option value="aMinor">A minor</option>
            <option value="aHarmonicMinor">A harmonic minor</option>
            <option value="dDorian">D dorian</option>
            <option value="cBluesMinor">C blues minor</option>
            <option value="gMixolydian">G mixolydian</option>
            <option value="hirajoshi">Hirajoshi</option>
            <option value="wholeTone">Whole tone</option>
            <option value="indianxD">Indian xD</option>
          </select>
        </label>
        <label>
          Volume: {Math.round(settings.volume * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.volume}
            onChange={(event) => updateVolume(Number(event.target.value))}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          Tone: {Math.round(settings.tone * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.tone}
            onChange={(event) => updateTone(Number(event.target.value))}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          Reverb: {Math.round(settings.reverb * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.reverb}
            onChange={(event) => updateReverb(Number(event.target.value))}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          Sustain: {Math.round(settings.sustain * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.sustain}
            onChange={(event) => updateSustain(Number(event.target.value))}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          Ring modulation: {Math.round(settings.ringModulation * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={settings.ringModulation}
            onChange={(event) => updateRingModulation(Number(event.target.value))}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          Oscillator
          <select
            value={settings.oscillatorType}
            onChange={(event) =>
              updateOscillatorType(event.target.value as OscillatorType)
            }
            style={{ display: "block", width: "100%" }}
          >
            <option value="sine">Sine</option>
            <option value="triangle">Triangle</option>
            <option value="square">Square</option>
            <option value="sawtooth">Sawtooth</option>
          </select>
        </label>
        <label>
          Filter
          <select
            value={settings.filterType}
            onChange={(event) =>
              updateFilterType(event.target.value as BiquadFilterType)
            }
            style={{ display: "block", width: "100%" }}
          >
            <option value="lowpass">Low-pass</option>
            <option value="highpass">High-pass</option>
            <option value="bandpass">Band-pass</option>
            <option value="notch">Notch</option>
            <option value="allpass">All-pass</option>
          </select>
        </label>
        <label>
          Filter frequency: {Math.round(settings.filterFrequency)} Hz
          <input
            type="range"
            min={100}
            max={12000}
            step={10}
            value={settings.filterFrequency}
            onChange={(event) =>
              updateFilterFrequency(Number(event.target.value))
            }
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          LFO waveform
          <select
            value={settings.lfoType}
            onChange={(event) =>
              updateLfoType(event.target.value as OscillatorType)
            }
            style={{ display: "block", width: "100%" }}
          >
            <option value="sine">Sine</option>
            <option value="triangle">Triangle</option>
            <option value="square">Square</option>
            <option value="sawtooth">Sawtooth</option>
          </select>
        </label>
        <label>
          LFO rate: {settings.lfoRate.toFixed(1)} Hz
          <input
            type="range"
            min={0}
            max={20}
            step={0.1}
            value={settings.lfoRate}
            onChange={(event) => updateLfoRate(Number(event.target.value))}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      </div>
      )}
    </>
  );
}