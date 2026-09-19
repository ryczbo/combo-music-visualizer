import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Scene } from "./components/Scene";
import { AudioEngine } from "./services/audioEngine";
import { SCALES, type ScaleName } from "./constants/notes";

const audioEngine = new AudioEngine();

export default function App() {
  const [activeAxes, setActiveAxes] = useState({ x: false, y: false, z: false });
  const [axisDirections, setAxisDirections] = useState<Record<"x" | "y" | "z", 1 | -1>>({
    x: 1,
    y: 1,
    z: 1,
  });
  const [axisSpeeds, setAxisSpeeds] = useState<Record<"x" | "y" | "z", number>>({
    x: 8,
    y: 8,
    z: 8,
  });
  const [beadCount, setBeadCount] = useState(6);
  const [scaleName, setScaleName] = useState<ScaleName>("ePhrygianDominant");
  const [volume, setVolume] = useState(0.8);
  const [tone, setTone] = useState(1);
  const [reverb, setReverb] = useState(0.24);
  const [sustain, setSustain] = useState(0.5);
  const [ringModulation, setRingModulation] = useState(0);
  const [oscillatorType, setOscillatorType] = useState<OscillatorType>("sine");
  const [filterType, setFilterType] = useState<BiquadFilterType>("lowpass");
  const [filterFrequency, setFilterFrequency] = useState(12000);
  const [lfoType, setLfoType] = useState<OscillatorType>("sine");
  const [lfoRate, setLfoRate] = useState(0);

  const toggleAxis = async (axis: "x" | "y" | "z") => {
    if (!activeAxes[axis]) {
      await audioEngine.start();
    }

    setActiveAxes((current) => ({
      ...current,
      [axis]: !current[axis],
    }));
  };

  const reverseAxis = (axis: "x" | "y" | "z") => {
    setAxisDirections((current) => ({
      ...current,
      [axis]: current[axis] === 1 ? -1 : 1,
    }));
  };

  const updateAxisSpeed = (axis: "x" | "y" | "z", speed: number) => {
    setAxisSpeeds((current) => ({ ...current, [axis]: speed }));
  };

  const updateVolume = (value: number) => {
    setVolume(value);
    audioEngine.setVolume(value);
  };

  const updateTone = (value: number) => {
    setTone(value);
    audioEngine.setTone(value);
  };

  const updateReverb = (value: number) => {
    setReverb(value);
    audioEngine.setReverb(value);
  };

  const updateSustain = (value: number) => {
    setSustain(value);
    audioEngine.setSustain(value);
  };

  const updateRingModulation = (value: number) => {
    setRingModulation(value);
    audioEngine.setRingModulation(value);
  };

  const updateOscillatorType = (value: OscillatorType) => {
    setOscillatorType(value);
    audioEngine.setOscillatorType(value);
  };

  const updateFilterType = (value: BiquadFilterType) => {
    setFilterType(value);
    audioEngine.setFilterType(value);
  };

  const updateFilterFrequency = (value: number) => {
    setFilterFrequency(value);
    audioEngine.setFilterFrequency(value);
  };

  const updateLfoType = (value: OscillatorType) => {
    setLfoType(value);
    audioEngine.setLfoType(value);
  };

  const updateLfoRate = (value: number) => {
    setLfoRate(value);
    audioEngine.setLfoRate(value);
  };

  const updateScale = (value: ScaleName) => {
    setScaleName(value);
    audioEngine.setScale(SCALES[value]);
  };

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
          activeAxes={activeAxes}
          axisDirections={axisDirections}
          axisSpeeds={axisSpeeds}
          audioEngine={audioEngine}
          beadCount={beadCount}
          notes={Object.keys(SCALES[scaleName])}
        />
      </Canvas>

      <div
        style={{
          position: "fixed",
          top: "20px",
          left: "20px",
          width: "220px",
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
        <strong>Wheel controls</strong>
        {(["x", "y", "z"] as const).map((axis) => (
          <div key={axis} style={{ display: "grid", gap: "6px" }}>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={() => toggleAxis(axis)}
                style={{
                  flex: 1,
                  padding: "10px 8px",
                  fontSize: "15px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {activeAxes[axis] ? `Stop ${axis.toUpperCase()}` : `Start ${axis.toUpperCase()}`}
              </button>
              <button
                onClick={() => reverseAxis(axis)}
                style={{
                  padding: "10px 12px",
                  fontSize: "15px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                }}
                title={`Reverse ${axis.toUpperCase()} direction`}
              >
                {axisDirections[axis] === 1 ? "+" : "-"}
              </button>
            </div>
            <label>
              Speed {axis.toUpperCase()}: {axisSpeeds[axis]}
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={axisSpeeds[axis]}
                onChange={(event) =>
                  updateAxisSpeed(axis, Number(event.target.value))
                }
                style={{ display: "block", width: "100%" }}
              />
            </label>
          </div>
        ))}
        <label>
          Beads: {beadCount}
          <input
            type="range"
            min={0}
            max={20}
            value={beadCount}
            onChange={(event) => setBeadCount(Number(event.target.value))}
            style={{ display: "block" }}
          />
        </label>
        <label>
          Scale
          <select
            value={scaleName}
            onChange={(event) => updateScale(event.target.value as ScaleName)}
            style={{ display: "block", width: "100%" }}
          >
            <option value="ePhrygianDominant">E Phrygian dominant</option>
            <option value="eMinorPentatonic">E minor pentatonic</option>
            <option value="cMajor">C major</option>
            <option value="eMajor">E major</option>
          </select>
        </label>
        <label>
          Volume: {Math.round(volume * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => updateVolume(Number(event.target.value))}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          Tone: {Math.round(tone * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={tone}
            onChange={(event) => updateTone(Number(event.target.value))}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          Reverb: {Math.round(reverb * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={reverb}
            onChange={(event) => updateReverb(Number(event.target.value))}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          Sustain: {Math.round(sustain * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={sustain}
            onChange={(event) => updateSustain(Number(event.target.value))}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          Ring modulation: {Math.round(ringModulation * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={ringModulation}
            onChange={(event) => updateRingModulation(Number(event.target.value))}
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          Oscillator
          <select
            value={oscillatorType}
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
            value={filterType}
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
          Filter frequency: {Math.round(filterFrequency)} Hz
          <input
            type="range"
            min={100}
            max={12000}
            step={10}
            value={filterFrequency}
            onChange={(event) =>
              updateFilterFrequency(Number(event.target.value))
            }
            style={{ display: "block", width: "100%" }}
          />
        </label>
        <label>
          LFO waveform
          <select
            value={lfoType}
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
          LFO rate: {lfoRate.toFixed(1)} Hz
          <input
            type="range"
            min={0}
            max={20}
            step={0.1}
            value={lfoRate}
            onChange={(event) => updateLfoRate(Number(event.target.value))}
            style={{ display: "block", width: "100%" }}
          />
        </label>
      </div>
    </>
  );
}