import { useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  Physics,
  RigidBody,
  BallCollider,
  CuboidCollider,
} from "@react-three/rapier";
import type { RapierRigidBody } from "@react-three/rapier";

const NOTE_FREQUENCIES: Record<string, number> = {
  C4: 261.63,
  C5: 523.25,
  D4: 293.66,
  D5: 587.33,
  E4: 329.63,
  E5: 659.25,
  F4: 349.23,
  F5: 698.46,
  G4: 392.0,
  G5: 783.99,
  A4: 440.0,
  A5: 880.0,
  C6: 1046.5,
};

const VOICES_PER_NOTE = 4;

class AudioEngine {
  private context: AudioContext | null = null;

  private masterGain: GainNode | null = null;

  private compressor: DynamicsCompressorNode | null = null;

  private limiter: DynamicsCompressorNode | null = null;

  private voices = new Map<
    string,
    Array<{ oscillator: OscillatorNode; gain: GainNode }>
  >();

  private voiceCursors = new Map<string, number>();

  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    this.context = new AudioContext({ latencyHint: "interactive" });

    // Master output
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.8;
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -10;
    this.compressor.knee.value = 10;
    this.compressor.ratio.value = 20;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.12;
    this.masterGain.connect(this.compressor);

    const makeupGain = this.context.createGain();
    makeupGain.gain.value = 2.7;
    this.compressor.connect(makeupGain);

    this.limiter = this.context.createDynamicsCompressor();
    this.limiter.threshold.value = -2;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.08;
    makeupGain.connect(this.limiter);
    this.limiter.connect(this.context.destination);

    this.initialized = true;
  }

  async start() {
    await this.initialize();

    if (!this.context) {
      throw new Error("AudioEngine has not been initialized.");
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    this.prewarmNotes();
  }

  private prewarmNotes() {
    if (!this.context || !this.masterGain) return;

    const startTime = this.context.currentTime;

    for (const [note, frequency] of Object.entries(NOTE_FREQUENCIES)) {
      if (this.voices.has(note)) continue;

      const noteVoices = [];

      for (let voiceIndex = 0; voiceIndex < VOICES_PER_NOTE; voiceIndex += 1) {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(frequency, startTime);
        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.05);
        gain.gain.setValueAtTime(0, startTime + 0.05);

        oscillator.connect(gain);
        gain.connect(this.masterGain);
        oscillator.start(startTime);
        noteVoices.push({ oscillator, gain });
      }

      this.voices.set(note, noteVoices);
      this.voiceCursors.set(note, 0);
    }
  }

  playNote(note: string, velocity = 1) {
    if (!this.context || !this.masterGain) {
      console.warn("AudioEngine is not ready.");
      return;
    }

    const frequency = NOTE_FREQUENCIES[note];

    if (!frequency) {
      console.warn(`Unknown note: ${note}`);
      return;
    }

    const noteVoices = this.voices.get(note);
    if (!noteVoices) {
      console.warn("AudioEngine has not been started.");
      return;
    }

    const cursor = this.voiceCursors.get(note) ?? 0;
    const voice = noteVoices[cursor];
    this.voiceCursors.set(note, (cursor + 1) % noteVoices.length);

    const now = this.context.currentTime;
    const gain = voice.gain.gain;
    const attackTime = now + 0.008;

    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(gain.value, 0.0001), now);
    gain.exponentialRampToValueAtTime(0.0001, attackTime);

    gain.exponentialRampToValueAtTime(
      0.13 * velocity,
      attackTime + 0.005
    );

    gain.exponentialRampToValueAtTime(
      0.0001,
      attackTime + 0.5
    );
  }
}

const audioEngine = new AudioEngine();

type BallProps = {
  note: string;
  position: [number, number, number];
  color: string;
};

const BALLS: BallProps[] = [
  { note: "C4", position: [-2.25, 3, -0.5], color: "hotpink" },
  { note: "E4", position: [-1.75, 4.5, 0.5], color: "deepskyblue" },
  { note: "G4", position: [-1.25, 6, -0.5], color: "gold" },
  { note: "A4", position: [-0.75, 7.5, 0.5], color: "tomato" },
  { note: "D4", position: [-0.25, 9, -0.5], color: "mediumseagreen" },
  { note: "F4", position: [0.25, 10.5, 0.5], color: "orchid" },
  { note: "C5", position: [0.75, 12, -0.5], color: "coral" },
  { note: "E5", position: [1.25, 13.5, 0.5], color: "skyblue" },
  { note: "G5", position: [1.75, 15, -0.5], color: "khaki" },
  { note: "C6", position: [2.25, 16.5, 0.5], color: "plum" },
];

function Ball({ note, position, color }: BallProps) {
  const rigidBody = useRef<RapierRigidBody>(null);
  const lastCollisionTime = useRef(0);

  return (
    <RigidBody
      ref={rigidBody}
      position={position}
      restitution={0.7}
      friction={0.3}
      onCollisionEnter={() => {
        const now = performance.now();
        if (now - lastCollisionTime.current < 180) return;

        lastCollisionTime.current = now;
        const impactSpeed = Math.abs(rigidBody.current?.linvel().y ?? 0);
        const velocity = Math.min(1, Math.max(0.12, (impactSpeed - 1) / 9));
        audioEngine.playNote(note, velocity);
      }}
    >
      <mesh castShadow>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial
          color={color}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>

      <BallCollider args={[0.4]} />
    </RigidBody>
  );
}

function Floor() {
  return (
    <RigidBody type="fixed">
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
      >
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial
          color="#444444"
          roughness={0.8}
        />
      </mesh>

      <CuboidCollider
        args={[10, 0.05, 10]}
        position={[0, -0.05, 0]}
      />
    </RigidBody>
  );
}

function Scene({ dropCount }: { dropCount: number }) {
  return (
    <>
      <ambientLight intensity={0.5} />

      <directionalLight
        position={[5, 10, 5]}
        intensity={2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />

      <Physics gravity={[0, -9.81, 0]}>
        {dropCount > 0 && (
          <>
            {BALLS.map((ball, index) => (
              <Ball key={`${dropCount}-${index}`} {...ball} />
            ))}
          </>
        )}

        <Floor />
      </Physics>

      <OrbitControls />
    </>
  );
}

export default function App() {
  const [dropCount, setDropCount] = useState(0);

  const drop = async () => {
    try {
      if (dropCount === 0) {
        await audioEngine.start();
      }
      setDropCount((count) => count + 1);
    } catch (error) {
      console.error("Failed to start audio:", error);
    }
  };

  return (
    <>
      <Canvas
        shadows
        camera={{
          position: [6, 5, 13],
          fov: 50,
        }}
        style={{
          width: "100vw",
          height: "100vh",
          background: "#111111",
        }}
      >
        <Scene dropCount={dropCount} />
      </Canvas>

      <div
        style={{
          position: "fixed",
          top: "20px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1,
        }}
      >
        <button
          onClick={drop}
          style={{
            padding: "15px 35px",
            fontSize: "18px",
            borderRadius: "8px",
            border: "none",
            cursor: "pointer",
          }}
        >
          {dropCount === 0 ? "Start" : "Drop"}
        </button>
      </div>
    </>
  );
}