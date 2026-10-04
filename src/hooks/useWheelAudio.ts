import { useEffect } from "react";
import type { AudioEngine } from "../services/audioEngine";
import type { DrumEngine } from "../services/drumEngine";
import { SCALES, expandScaleOctaves } from "../constants/notes";
import type { WheelConfig } from "../constants/wheelConfig";

// Drums only use the volume, tone and reverb settings.
export function useDrumAudio(engine: DrumEngine, config: WheelConfig) {
  useEffect(() => engine.setVolume(config.volume), [engine, config.volume]);
  useEffect(() => engine.setTone(config.tone), [engine, config.tone]);
  useEffect(() => engine.setReverb(config.reverb), [engine, config.reverb]);
}

// Re-applies a wheel's audio settings whenever they change, and whenever
// switching to a pattern that remembers different values.
export function useWheelAudio(engine: AudioEngine, config: WheelConfig) {
  useEffect(() => engine.setVolume(config.volume), [engine, config.volume]);
  useEffect(() => engine.setTone(config.tone), [engine, config.tone]);
  useEffect(() => engine.setReverb(config.reverb), [engine, config.reverb]);
  useEffect(() => engine.setSustain(config.sustain), [engine, config.sustain]);
  useEffect(
    () => engine.setRingModulation(config.ringModulation),
    [engine, config.ringModulation]
  );
  useEffect(
    () => engine.setOscillatorType(config.oscillatorType),
    [engine, config.oscillatorType]
  );
  useEffect(
    () => engine.setFilterType(config.filterType),
    [engine, config.filterType]
  );
  useEffect(
    () => engine.setFilterFrequency(config.filterFrequency),
    [engine, config.filterFrequency]
  );
  useEffect(() => engine.setLfoType(config.lfoType), [engine, config.lfoType]);
  useEffect(() => engine.setLfoRate(config.lfoRate), [engine, config.lfoRate]);

  // Register three octaves of the scale so the sector note picker can offer a
  // wider range than the single octave used for automatic sector assignment.
  useEffect(() => {
    engine.setScale({
      ...expandScaleOctaves(SCALES[config.scaleName]),
      ...SCALES.custom,
    });
  }, [engine, config.scaleName]);
}
