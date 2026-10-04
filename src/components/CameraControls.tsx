import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  CAMERA_MOVES,
  DEFAULT_MODULATION,
  MODULATION_TARGETS,
  SPEED_RANGE,
  type CameraCommand,
  type CameraModulation,
  type CameraMoveName,
  type ModulationTarget,
} from "../constants/cameraMoves";

type CameraControlsProps = {
  onCommand: (command: CameraCommand) => void;
  getSoundValue: (target: ModulationTarget) => number;
  onSoundChange: (target: ModulationTarget, value: number) => void;
};

type MoveSettings = { speed: number; amount: number };

const MOVE_NAMES = Object.keys(CAMERA_MOVES) as CameraMoveName[];
const ANIMATED_MOVES = MOVE_NAMES.filter(
  (move): move is Exclude<CameraMoveName, "reset"> => move !== "reset"
);

const buttonStyle: CSSProperties = {
  padding: "8px 16px",
  fontSize: "14px",
  borderRadius: "8px",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  background: "rgba(17, 17, 17, 0.82)",
  color: "white",
  cursor: "pointer",
};

const cardStyle: CSSProperties = {
  padding: "8px 12px",
  fontSize: "13px",
  borderRadius: "8px",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  background: "rgba(17, 17, 17, 0.82)",
  color: "white",
};

const fullWidth: CSSProperties = { width: "100%" };

export function CameraControls({
  onCommand,
  getSoundValue,
  onSoundChange,
}: CameraControlsProps) {
  const commandId = useRef(0);
  const modulationFrame = useRef(0);
  const [activeMoves, setActiveMoves] = useState<
    Partial<Record<CameraMoveName, boolean>>
  >({});
  const [moveSettings, setMoveSettings] = useState(
    () =>
      Object.fromEntries(
        MOVE_NAMES.map((move) => [
          move,
          {
            speed: CAMERA_MOVES[move].speed,
            amount: CAMERA_MOVES[move].amount?.value ?? 0,
          },
        ])
      ) as Record<CameraMoveName, MoveSettings>
  );
  const [modulation, setModulation] = useState(
    () =>
      Object.fromEntries(
        MOVE_NAMES.map((move) => [move, DEFAULT_MODULATION])
      ) as Record<CameraMoveName, CameraModulation>
  );

  useEffect(() => {
    const frame = modulationFrame;
    return () => cancelAnimationFrame(frame.current);
  }, []);

  const sendCommand = (steps: CameraCommand["steps"]) => {
    commandId.current += 1;
    onCommand({ id: commandId.current, steps });
  };

  // Eases each bound control toward its goal with the same exponential curve
  // the camera rig uses, so both finish together.
  const startModulations = (steps: CameraCommand["steps"]) => {
    cancelAnimationFrame(modulationFrame.current);
    const mods = steps.flatMap(({ move, speed }) => {
      const { target, direction, percent } = modulation[move];
      if (target === "none") return [];
      const { min, max } = MODULATION_TARGETS[target];
      const from = getSoundValue(target);
      const to = Math.min(
        max,
        Math.max(min, from + (direction * percent * (max - min)) / 100)
      );
      return [{ target, speed, to, value: from, tolerance: (max - min) * 0.001 }];
    });
    if (mods.length === 0) return;

    let last = performance.now();
    const tick = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.1);
      last = now;
      let running = false;
      for (const mod of mods) {
        mod.value = mod.to + (mod.value - mod.to) * Math.exp(-mod.speed * delta);
        if (Math.abs(mod.value - mod.to) < mod.tolerance) mod.value = mod.to;
        else running = true;
        onSoundChange(mod.target, mod.value);
      }
      if (running) modulationFrame.current = requestAnimationFrame(tick);
    };
    modulationFrame.current = requestAnimationFrame(tick);
  };

  const startSelected = () => {
    const steps = ANIMATED_MOVES.filter((move) => activeMoves[move]).map(
      (move) => ({ move, ...moveSettings[move] })
    );
    if (steps.length === 0) return;
    sendCommand(steps);
    startModulations(steps);
  };

  const reset = () => {
    cancelAnimationFrame(modulationFrame.current);
    sendCommand([{ move: "reset", ...moveSettings.reset }]);
  };

  const updateMoveSetting = (
    move: CameraMoveName,
    key: keyof MoveSettings,
    value: number
  ) =>
    setMoveSettings((current) => ({
      ...current,
      [move]: { ...current[move], [key]: value },
    }));

  const updateModulation = (
    move: CameraMoveName,
    changes: Partial<CameraModulation>
  ) =>
    setModulation((current) => ({
      ...current,
      [move]: { ...current[move], ...changes },
    }));

  return (
    <div
      style={{
        position: "fixed",
        top: "220px",
        right: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        width: "210px",
        maxHeight: "calc(100vh - 240px)",
        overflowY: "auto",
        zIndex: 2,
      }}
    >
      <button
        onClick={startSelected}
        style={{ ...buttonStyle, position: "sticky", top: 0, background: "rgba(17, 17, 17, 0.95)" }}
      >
        Start selected animations
      </button>
      <button onClick={reset} style={buttonStyle}>
        {CAMERA_MOVES.reset.label}
      </button>

      {ANIMATED_MOVES.map((move) => {
        const { label, amount } = CAMERA_MOVES[move];
        const { speed, amount: amountValue } = moveSettings[move];
        const { target, direction, percent } = modulation[move];

        return (
          <div key={move} style={cardStyle}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontWeight: 600,
                marginBottom: "4px",
              }}
            >
              <input
                type="checkbox"
                checked={!!activeMoves[move]}
                onChange={(event) =>
                  setActiveMoves((current) => ({
                    ...current,
                    [move]: event.target.checked,
                  }))
                }
              />
              {label}
            </label>

            <label style={{ display: "block" }}>
              Speed: {speed.toFixed(1)}
              <input
                type="range"
                {...SPEED_RANGE}
                value={speed}
                onChange={(event) =>
                  updateMoveSetting(move, "speed", Number(event.target.value))
                }
                style={fullWidth}
              />
            </label>
            <label style={{ display: "block" }}>
              {amount.label}: {amountValue}
              <input
                type="range"
                min={amount.min}
                max={amount.max}
                step={amount.step}
                value={amountValue}
                onChange={(event) =>
                  updateMoveSetting(move, "amount", Number(event.target.value))
                }
                style={fullWidth}
              />
            </label>

            <label style={{ display: "block", marginTop: "4px" }}>
              Modulate sound
              <select
                value={target}
                onChange={(event) =>
                  updateModulation(move, {
                    target: event.target.value as ModulationTarget | "none",
                  })
                }
                style={fullWidth}
              >
                <option value="none">None</option>
                {(Object.keys(MODULATION_TARGETS) as ModulationTarget[]).map(
                  (option) => (
                    <option key={option} value={option}>
                      {MODULATION_TARGETS[option].label}
                    </option>
                  )
                )}
              </select>
            </label>
            {target !== "none" && (
              <>
                <label style={{ display: "block" }}>
                  Direction
                  <select
                    value={direction}
                    onChange={(event) =>
                      updateModulation(move, {
                        direction: Number(event.target.value) === -1 ? -1 : 1,
                      })
                    }
                    style={fullWidth}
                  >
                    <option value={1}>More</option>
                    <option value={-1}>Less</option>
                  </select>
                </label>
                <label style={{ display: "block" }}>
                  Extent: {percent}%
                  <input
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={percent}
                    onChange={(event) =>
                      updateModulation(move, {
                        percent: Number(event.target.value),
                      })
                    }
                    style={fullWidth}
                  />
                </label>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
