import { OrbitControls } from "@react-three/drei";
import { AudioEngine } from "../services/audioEngine";
import { Wheel } from "./Wheel";

type PatternBead = {
  spoke: number;
  startingPosition: "start" | "middle" | "end";
  note: string;
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
      />

      <OrbitControls target={[0, 0, 0]} enablePan={false} />
    </>
  );
}