import * as Tone from 'tone';

// Builds the layered ambient audio engine.
// Each layer exposes a Volume node so the UI can fade it independently.
export function createAudioEngine() {
  const masterVol = new Tone.Volume(-6).toDestination();
  const layers = {};

  // Ocean — brown noise through a slow auto-filter
  const oceanNoise = new Tone.Noise('brown').start();
  const oceanFilter = new Tone.AutoFilter({
    frequency: 0.08,
    baseFrequency: 100,
    octaves: 2.5,
  }).connect(masterVol).start();
  const oceanVol = new Tone.Volume(-Infinity).connect(oceanFilter);
  oceanNoise.connect(oceanVol);
  layers.ocean = { vol: oceanVol };

  // Wind — white noise through a higher auto-filter
  const windNoise = new Tone.Noise('white').start();
  const windFilter = new Tone.AutoFilter({
    frequency: 0.15,
    baseFrequency: 800,
    octaves: 3,
  }).connect(masterVol).start();
  const windVol = new Tone.Volume(-Infinity).connect(windFilter);
  windNoise.connect(windVol);
  layers.wind = { vol: windVol };

  // Radio static — bandpassed white noise
  const staticNoise = new Tone.Noise('white').start();
  const staticFilter = new Tone.Filter(3000, 'bandpass').connect(masterVol);
  const staticVol = new Tone.Volume(-Infinity).connect(staticFilter);
  staticNoise.connect(staticVol);
  layers.static = { vol: staticVol };

  // Fog horn — slow sawtooth synth, triggered on an interval
  const hornSynth = new Tone.Synth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 1.5, decay: 0.5, sustain: 0.6, release: 2.0 },
  });
  const hornFilter = new Tone.Filter(200, 'lowpass').connect(masterVol);
  const hornVol = new Tone.Volume(-Infinity).connect(hornFilter);
  hornSynth.connect(hornVol);
  layers.horn = { vol: hornVol, synth: hornSynth };

  // Deep — the "beneath" layer, a tremolo'd sine drone
  const deepSynth = new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 3, decay: 1, sustain: 1, release: 3 },
  });
  const deepVol = new Tone.Volume(-Infinity).connect(masterVol);
  const deepTremolo = new Tone.Tremolo(0.3, 0.4).connect(deepVol).start();
  deepSynth.connect(deepTremolo);
  layers.deep = { vol: deepVol, synth: deepSynth };

  return { masterVol, layers };
}

// Apply a {layerKey: 0..1} map to the engine's volume nodes.
export function applyLayerLevels(engine, levels) {
  if (!engine) return;
  for (const [key, val] of Object.entries(levels)) {
    const layer = engine.layers[key];
    if (!layer?.vol) continue;
    layer.vol.volume.value = val > 0 ? Tone.gainToDb(val) : -Infinity;
  }
}
