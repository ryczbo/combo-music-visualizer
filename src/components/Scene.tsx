import { OrbitControls } from "@react-three/drei";
import { AudioEngine } from "../services/audioEngine";
import type { NotePlayer } from "../services/notePlayer";
import { CAMERA_TARGET, type CameraCommand } from "../constants/cameraMoves";
import { CameraRig } from "./CameraRig";
import { Wheel } from "./Wheel";
import {
  BLUE_WHEEL_THEME,
  PINK_WHEEL_THEME,
  SECOND_WHEEL_POSITION,
  SECOND_WHEEL_ROTATION_RATIO,
  SECOND_WHEEL_SCALE,
} from "../constants/wheelLayout";

type PatternBead = {
  spoke: number;
  note: string;
};

type SecondWheelProps = {
  audioEngine: NotePlayer;
  noteOptions: string[];
  scaleNotes: string[];
  sectionCount: number;
  beads: PatternBead[];
  onBeadsChange: (beads: PatternBead[]) => void;
  onBeadNoteChange: (beads: PatternBead[]) => void;
};

type SceneProps = {
  spinning: boolean;
  spinDirection: 1 | -1;
  spinSpeed: number;
  audioEngine: AudioEngine;
  noteOptions: string[];
  scaleNotes: string[];
  inflateHeld: boolean;
  showOuterRing: boolean;
  sectionCount: number;
  beads: PatternBead[];
  onBeadsChange: (beads: PatternBead[]) => void;
  onBeadNoteChange: (beads: PatternBead[]) => void;
  onSectionTurn: () => void;
  secondWheel: SecondWheelProps | null;
  cameraCommand: CameraCommand | null;
};

export function Scene({
  spinning,
  spinDirection,
  spinSpeed,
  audioEngine,
  noteOptions,
  scaleNotes,
  inflateHeld,
  showOuterRing,
  sectionCount,
  beads,
  onBeadsChange,
  onBeadNoteChange,
  onSectionTurn,
  secondWheel,
  cameraCommand,
}: SceneProps) {
  return (
    <>
      {/* Lighting is kept outside the physics world because it is visual only. */}
      <ambientLight intensity={0.5} />

      <directionalLight
        position={[5, 10, 5]}
        intensity={2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <Wheel
        spinning={spinning}
        spinDirection={spinDirection}
        spinSpeed={spinSpeed}
        audioEngine={audioEngine}
        noteOptions={noteOptions}
        scaleNotes={scaleNotes}
        inflateHeld={inflateHeld}
        showOuterRing={showOuterRing}
        sectionCount={sectionCount}
        beads={beads}
        onBeadsChange={onBeadsChange}
        onBeadNoteChange={onBeadNoteChange}
        onSectionTurn={onSectionTurn}
        theme={BLUE_WHEEL_THEME}
      />

      {secondWheel && (
        <Wheel
          spinning={spinning}
          spinDirection={spinDirection}
          spinSpeed={spinSpeed}
          audioEngine={secondWheel.audioEngine}
          noteOptions={secondWheel.noteOptions}
          scaleNotes={secondWheel.scaleNotes}
          inflateHeld={inflateHeld}
          showOuterRing={showOuterRing}
          sectionCount={secondWheel.sectionCount}
          beads={secondWheel.beads}
          onBeadsChange={secondWheel.onBeadsChange}
          onBeadNoteChange={secondWheel.onBeadNoteChange}
          // Pattern progress follows the first wheel only.
          onSectionTurn={() => {}}
          theme={PINK_WHEEL_THEME}
          position={SECOND_WHEEL_POSITION}
          scale={SECOND_WHEEL_SCALE}
          rotationRatio={SECOND_WHEEL_ROTATION_RATIO}
        />
      )}

      <OrbitControls makeDefault target={CAMERA_TARGET} enablePan={false} />
      <CameraRig command={cameraCommand} />
    </>
  );
}