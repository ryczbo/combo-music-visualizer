// Low shelf, mid peak and high shelf (unconnected); gains in dB.
export function createEqBands(context: AudioContext, gains: number[]) {
  const settings: { type: BiquadFilterType; frequency: number }[] = [
    { type: "lowshelf", frequency: 200 },
    { type: "peaking", frequency: 1000 },
    { type: "highshelf", frequency: 4000 },
  ];
  return settings.map(({ type, frequency }, index) => {
    const band = context.createBiquadFilter();
    band.type = type;
    band.frequency.value = frequency;
    band.gain.value = gains[index];
    return band;
  });
}
