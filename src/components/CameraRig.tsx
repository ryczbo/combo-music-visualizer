import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  CAMERA_MAX_DISTANCE,
  CAMERA_MIN_DISTANCE,
  CAMERA_MOVES,
  CAMERA_TARGET,
  type CameraCommand,
  type CameraView,
} from "../constants/cameraMoves";

type CameraRigProps = {
  command: CameraCommand | null;
};

const target = new THREE.Vector3(...CAMERA_TARGET);
const MIN_POLAR = 0.05;
const MAX_POLAR = Math.PI - 0.05;
const SETTLE_THRESHOLD = 0.001;

function readView(camera: THREE.Camera): CameraView {
  const spherical = new THREE.Spherical().setFromVector3(
    camera.position.clone().sub(target)
  );
  return {
    azimuth: spherical.theta,
    polar: spherical.phi,
    distance: spherical.radius,
  };
}

// Animates the camera toward the combined finish view of the latest command.
export function CameraRig({ command }: CameraRigProps) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls);
  // Tracks the animated view itself: re-reading the camera each frame would wrap
  // azimuth at +-PI and send the damping the wrong way around.
  const animation = useRef<{
    current: CameraView;
    goal: CameraView;
    speeds: CameraView;
  } | null>(null);

  useEffect(() => {
    if (!command || command.steps.length === 0) return;
    const start = readView(camera);
    let view = start;
    // Each axis moves at the speed of the last step that changed it.
    const speeds: CameraView = { azimuth: 1, polar: 1, distance: 1 };
    for (const step of command.steps) {
      const finish = CAMERA_MOVES[step.move].getFinishView(view, step.amount);
      if (finish.azimuth !== view.azimuth) speeds.azimuth = step.speed;
      if (finish.polar !== view.polar) speeds.polar = step.speed;
      if (finish.distance !== view.distance) speeds.distance = step.speed;
      view = finish;
    }
    animation.current = {
      current: start,
      speeds,
      goal: {
        azimuth: view.azimuth,
        polar: THREE.MathUtils.clamp(view.polar, MIN_POLAR, MAX_POLAR),
        distance: THREE.MathUtils.clamp(
          view.distance,
          CAMERA_MIN_DISTANCE,
          CAMERA_MAX_DISTANCE
        ),
      },
    };
  }, [command, camera]);

  // Dragging the view takes over from any running animation.
  useEffect(() => {
    const dispatcher = controls as THREE.EventDispatcher<{ start: object }> | null;
    if (!dispatcher) return;
    const cancel = () => {
      animation.current = null;
    };
    dispatcher.addEventListener("start", cancel);
    return () => dispatcher.removeEventListener("start", cancel);
  }, [controls]);

  useFrame((_, delta) => {
    const running = animation.current;
    if (!running) return;

    const { current, goal, speeds } = running;
    const next: CameraView = {
      azimuth: THREE.MathUtils.damp(current.azimuth, goal.azimuth, speeds.azimuth, delta),
      polar: THREE.MathUtils.damp(current.polar, goal.polar, speeds.polar, delta),
      distance: THREE.MathUtils.damp(current.distance, goal.distance, speeds.distance, delta),
    };
    running.current = next;

    camera.position
      .setFromSpherical(
        new THREE.Spherical(next.distance, next.polar, next.azimuth)
      )
      .add(target);
    camera.lookAt(target);

    const settled =
      Math.abs(next.azimuth - goal.azimuth) < SETTLE_THRESHOLD &&
      Math.abs(next.polar - goal.polar) < SETTLE_THRESHOLD &&
      Math.abs(next.distance - goal.distance) < SETTLE_THRESHOLD;
    if (settled) animation.current = null;
  });

  return null;
}
