import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Canvas } from "@react-three/fiber";
import { Scene } from "./components/Scene";
import { CameraControls } from "./components/CameraControls";
import { WheelControls } from "./components/WheelControls";
import { AudioEngine } from "./services/audioEngine";
import { DRUM_SOUNDS, DrumEngine } from "./services/drumEngine";
import { SCALES } from "./constants/notes";
import type { CameraCommand } from "./constants/cameraMoves";
import {
  createDefaultDrumConfig,
  createDefaultWheelConfig,
  createDefaultWheelSound,
  getScaleNoteNames,
  MAX_SECTIONS,
  normalizeWheelConfig,
  normalizeWheelSound,
  splitWheelPatch,
  type PatternBead,
  type WheelConfig,
  type WheelControlValues,
  type WheelSound,
} from "./constants/wheelConfig";
import { useDrumAudio, useWheelAudio } from "./hooks/useWheelAudio";
import { DEFAULT_COLORS, createWheelTheme } from "./constants/wheelLayout";

const audioEngine = new AudioEngine();
// The second wheel has its own audio chain so its sound options are independent.
const drumEngine = new DrumEngine();

const MAX_PATTERN_COUNT = 30;

// Patterns are shared by both wheels: they pick activeness and length for each.
type WheelSettings = WheelConfig & {
  active: boolean;
  length: number;
  spinDirection: 1 | -1;
  spinSpeed: number;
  secondWheel: WheelConfig;
};

// Clockwise by default; a negative spin direction reads as clockwise on screen.
const createDefaultWheelSettings = (): WheelSettings => ({
  ...createDefaultWheelConfig(MAX_SECTIONS),
  active: false,
  length: 4,
  spinDirection: -1,
  spinSpeed: 8,
  secondWheel: createDefaultDrumConfig(),
});

const panelStyle: CSSProperties = {
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
};

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
  const [secondWheelEnabled, setSecondWheelEnabled] = useState(false);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand | null>(null);
  // Counts section-width turns completed on the currently playing pattern.
  const sectionsCompletedRef = useRef(0);
  // Sound settings are shared by every pattern; only the camera animations move them.
  const [sounds, setSounds] = useState<{ blue: WheelSound; pink: WheelSound }>(() => ({
    blue: createDefaultWheelSound(),
    pink: createDefaultWheelSound(),
  }));

  const settings = patternSettings[activePattern];
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const blueTheme = useMemo(() => createWheelTheme(colors.blue), [colors.blue]);
  const pinkTheme = useMemo(() => createWheelTheme(colors.pink), [colors.pink]);
  const blueControls: WheelControlValues = { ...settings, ...sounds.blue };
  const pinkControls: WheelControlValues = { ...settings.secondWheel, ...sounds.pink };

  const exportSettings = () => {
    const blob = new Blob([JSON.stringify({ patterns: patternSettings, sounds, colors }, null, 2)], {
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
      // Older exports were a bare array of patterns that each carried sound settings.
      const patterns = Array.isArray(parsed) ? parsed : parsed?.patterns;
      if (!Array.isArray(patterns) || patterns.length === 0) {
        throw new Error("Expected a non-empty array of pattern settings.");
      }
      const savedSounds = Array.isArray(parsed)
        ? { blue: patterns[0], pink: patterns[0]?.secondWheel }
        : parsed.sounds;
      setSounds({
        blue: normalizeWheelSound(savedSounds?.blue),
        pink: normalizeWheelSound(savedSounds?.pink),
      });
      if (!Array.isArray(parsed)) setColors({ ...DEFAULT_COLORS, ...parsed.colors });
      setPatternSettings(
        patterns.map((pattern) => {
          const defaults = createDefaultWheelSettings();
          const saved = pattern as Partial<WheelSettings> & { beadCount?: number };
          return {
            ...normalizeWheelConfig(saved, defaults),
            secondWheel: normalizeWheelConfig(
              saved.secondWheel ?? {},
              defaults.secondWheel,
              MAX_SECTIONS,
              DRUM_SOUNDS
            ),
          };
        })
      );
      setActivePattern(0);
    } catch (error) {
      console.warn("Failed to import pattern settings:", error);
    }
  };

  const updatePatternSettings = (index: number, patch: Partial<WheelSettings>) => {
    setPatternSettings((current) => {
      // Bail out without a new array/object when nothing changed, so effects
      // driven by this callback's identity don't loop.
      const keys = Object.keys(patch) as (keyof WheelSettings)[];
      if (keys.every((key) => current[index][key] === patch[key])) return current;
      const next = [...current];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const updatePatternSetting = <K extends keyof WheelSettings>(
    index: number,
    key: K,
    value: WheelSettings[K]
  ) => updatePatternSettings(index, { [key]: value } as Partial<WheelSettings>);

  const updateSetting = <K extends keyof WheelSettings>(
    key: K,
    value: WheelSettings[K]
  ) => updatePatternSetting(activePattern, key, value);

  const updateFirstWheel = (patch: Partial<WheelControlValues>) => {
    const { sound, config } = splitWheelPatch(patch);
    setSounds((current) => ({ ...current, blue: { ...current.blue, ...sound } }));
    updatePatternSettings(activePattern, config);
  };

  const updateSecondWheel = (patch: Partial<WheelControlValues>) => {
    const { sound, config } = splitWheelPatch(patch);
    setSounds((current) => ({ ...current, pink: { ...current.pink, ...sound } }));
    updatePatternSettings(activePattern, {
      secondWheel: { ...settings.secondWheel, ...config },
    });
  };

  const togglePatternActive = (index: number, active: boolean) =>
    updatePatternSetting(index, "active", active);

  const updatePatternLength = (index: number, length: number) =>
    updatePatternSetting(index, "length", length);

  const copyPattern = () => {
    if (patternSettings.length >= MAX_PATTERN_COUNT) return;

    const copy = {
      ...settings,
      beads: settings.beads.map((bead) => ({ ...bead })),
      secondWheel: {
        ...settings.secondWheel,
        beads: settings.secondWheel.beads.map((bead) => ({ ...bead })),
      },
    };
    setPatternSettings((current) => [...current, copy]);
    setActivePattern(patternSettings.length);
  };

  const deletePattern = (index: number) => {
    if (patternSettings.length <= 1) return;

    setPatternSettings((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setActivePattern((current) => {
      if (current === index) return Math.min(index, patternSettings.length - 2);
      return current > index ? current - 1 : current;
    });
    if (activePattern === index) sectionsCompletedRef.current = 0;
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

  const handleSectionTurn = () => {
    sectionsCompletedRef.current += 1;
    if (sectionsCompletedRef.current >= settings.length) {
      sectionsCompletedRef.current = 0;
      advanceToNextActivePattern();
    }
  };

  const toggleSpin = async () => {
    if (!spinning) {
      await Promise.all([audioEngine.start(), drumEngine.start()]);
      sectionsCompletedRef.current = 0;
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

  const updateBeads = (beads: PatternBead[]) => updateFirstWheel({ beads });

  // Editing a note by hand leaves the scale, so the picker shows the custom range.
  const updateBeadNote = (beads: PatternBead[]) =>
    updateFirstWheel({ beads, scaleName: "custom", sectorNotes: scaleNotes });

  useWheelAudio(audioEngine, blueControls);
  useDrumAudio(drumEngine, sounds.pink);

  const noteOptions = Object.keys(SCALES.custom);
  const scaleNotes = settings.sectorNotes ?? getScaleNoteNames(settings.scaleName);

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
          background: colors.background,
        }}
      >
        <Scene
          spinning={spinning}
          spinDirection={settings.spinDirection}
          spinSpeed={settings.spinSpeed}
          audioEngine={audioEngine}
          noteOptions={noteOptions}
          scaleNotes={scaleNotes}
          inflateHeld={inflateHeld}
          showOuterRing={showOuterRing}
          sectionCount={settings.sectionCount}
          beads={settings.beads}
          onBeadsChange={updateBeads}
          onBeadNoteChange={updateBeadNote}
          onSectionTurn={handleSectionTurn}
          blueTheme={blueTheme}
          pinkTheme={pinkTheme}
          beadColor={colors.beads}
          secondWheel={
            secondWheelEnabled
              ? {
                  audioEngine: drumEngine,
                  noteOptions: [...DRUM_SOUNDS],
                  scaleNotes: [...DRUM_SOUNDS],
                  sectionCount: settings.secondWheel.sectionCount,
                  beads: settings.secondWheel.beads,
                  onBeadsChange: (beads) => updateSecondWheel({ beads }),
                  onBeadNoteChange: (beads) => updateSecondWheel({ beads }),
                }
              : null
          }
          cameraCommand={cameraCommand}
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

      {controlsVisible && (
      <>
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
      </>
      )}
      <CameraControls
        visible={controlsVisible}
        onCommand={setCameraCommand}
        getSoundValue={(target) => sounds.blue[target]}
        onSoundChange={(target, value) =>
          setSounds((current) => ({
            ...current,
            blue: { ...current.blue, [target]: value },
          }))
        }
      />
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
      <div style={panelStyle}>
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

        <button
          onClick={() => setSecondWheelEnabled((enabled) => !enabled)}
          style={{
            padding: "10px 8px",
            fontSize: "15px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
          }}
        >
          {secondWheelEnabled ? "Remove pink wheel" : "Add pink wheel"}
        </button>

        <strong>Patterns (both wheels)</strong>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={copyPattern}
            disabled={patternSettings.length >= MAX_PATTERN_COUNT}
            style={{
              flex: 1,
              padding: "10px 8px",
              fontSize: "15px",
              borderRadius: "8px",
              border: "none",
              cursor: patternSettings.length >= MAX_PATTERN_COUNT ? "not-allowed" : "pointer",
              opacity: patternSettings.length >= MAX_PATTERN_COUNT ? 0.5 : 1,
            }}
          >
            Copy pattern
          </button>
          <span>{patternSettings.length}/{MAX_PATTERN_COUNT}</span>
        </div>

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
                  <button
                    type="button"
                    onClick={() => deletePattern(index)}
                    disabled={patternSettings.length === 1}
                    aria-label={`Delete pattern ${index + 1}`}
                    title="Delete pattern"
                    style={{
                      marginLeft: "auto",
                      width: "24px",
                      height: "24px",
                      padding: 0,
                      border: "1px solid rgba(255, 255, 255, 0.25)",
                      borderRadius: "4px",
                      color: "white",
                      background: "rgba(255, 80, 100, 0.2)",
                      cursor: patternSettings.length === 1 ? "not-allowed" : "pointer",
                      opacity: patternSettings.length === 1 ? 0.45 : 1,
                    }}
                  >
                    ×
                  </button>
                </div>
                <label>
                  Sections per pattern: {patternSettings[index].length}
                  <input
                    type="range"
                    min={1}
                    max={20}
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

        <WheelControls
          title="Blue wheel controls"
          config={blueControls}
          maxSections={MAX_SECTIONS}
          onChange={updateFirstWheel}
          spin={{
            direction: settings.spinDirection,
            speed: settings.spinSpeed,
            onReverse: reverseSpinDirection,
            onSpeedChange: updateSpinSpeed,
          }}
        />

        <strong>Colors</strong>
        {(
          [
            ["blue", "Blue wheel"],
            ["pink", "Pink wheel"],
            ["background", "Background"],
            ["beads", "Beads"],
          ] as const
        ).map(([key, label]) => (
          <label
            key={key}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            {label}
            <input
              type="color"
              value={colors[key]}
              onChange={(event) =>
                setColors((current) => ({ ...current, [key]: event.target.value }))
              }
            />
          </label>
        ))}
      </div>
      )}

      {controlsVisible && secondWheelEnabled && (
        <div style={{ ...panelStyle, left: "290px" }}>
          <WheelControls
            title="Pink wheel controls"
            config={pinkControls}
            maxSections={MAX_SECTIONS}
            noteNames={DRUM_SOUNDS}
            onChange={updateSecondWheel}
          />
          <small>Turns with the blue wheel, twice as fast and the other way. Click its outer ring (while stopped) to assign drum sounds.</small>
        </div>
      )}
    </>
  );
}