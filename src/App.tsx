import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AudioEngine } from "./services/audioEngine";
import { Scene } from "./components/Scene";

const audioEngine = new AudioEngine();

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
          position: [17.7, 8.5, 0.06],
          fov: 60,
        }}
        style={{
          width: "100vw",
          height: "100vh",
          background: "#111111",
        }}
      >
        <Scene dropCount={dropCount} audioEngine={audioEngine} />
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