import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import transmissions from '../data/transmissions.json';
import { applyLayerLevels, createAudioEngine } from '../audio/engine.js';

const INITIAL_LAYERS = {
  ocean: 0.6,
  wind: 0.3,
  static: 0.1,
  horn: 0.0,
  deep: 0.0,
};

// Fallback outcomes used when a transmission doesn't override a given
// decision. Per-transmission outcomes always win.
const DEFAULT_OUTCOMES = {
  DOCK:        { fuel: -2, flags: {} },
  REJECT:      { fuel:  0, flags: {} },
  INVESTIGATE: { fuel: -3, flags: {} },
  REFUEL:      { fuel: 25, flags: {} },
};

function resolveOutcome(transmission, decision) {
  const base = DEFAULT_OUTCOMES[decision] ?? { fuel: 0, flags: {} };
  const override = transmission.outcomes?.[decision] ?? {};
  return {
    fuel: override.fuel ?? base.fuel,
    flags: { ...(base.flags ?? {}), ...(override.flags ?? {}) },
  };
}

// Single hook that owns the whole game session: audio engine, transmission
// queue, fuel drain, and logbook. Components stay dumb.
export function useStation() {
  const [audioStarted, setAudioStarted] = useState(false);
  const [layers, setLayers] = useState(INITIAL_LAYERS);
  const [currentTransmission, setCurrent] = useState(null);
  const [displayedFragments, setDisplayed] = useState([]);
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [logbook, setLogbook] = useState([]);
  const [transmissionIndex, setTxIndex] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [gamePhase, setGamePhase] = useState(0);
  const [fuelLevel, setFuelLevel] = useState(100);
  const [flags, setFlags] = useState({});
  const [flickering, setFlickering] = useState(false);

  const engineRef = useRef(null);
  const hornIntervalRef = useRef(null);
  const deepIntervalRef = useRef(null);

  // --- audio start ---
  const startAudio = useCallback(async () => {
    if (audioStarted) return;
    await Tone.start();
    engineRef.current = createAudioEngine();
    applyLayerLevels(engineRef.current, INITIAL_LAYERS);
    setAudioStarted(true);

    hornIntervalRef.current = setInterval(() => {
      engineRef.current?.layers.horn?.synth?.triggerAttackRelease('C1', '3s');
    }, 15000);
    deepIntervalRef.current = setInterval(() => {
      engineRef.current?.layers.deep?.synth?.triggerAttackRelease('E0', '8s');
    }, 12000);
  }, [audioStarted]);

  useEffect(() => () => {
    if (hornIntervalRef.current) clearInterval(hornIntervalRef.current);
    if (deepIntervalRef.current) clearInterval(deepIntervalRef.current);
  }, []);

  // --- mirror layer state to audio engine ---
  useEffect(() => {
    applyLayerLevels(engineRef.current, layers);
  }, [layers]);

  const setLayer = useCallback((key, value) => {
    setLayers((l) => ({ ...l, [key]: value }));
  }, []);

  // --- fuel drain ---
  useEffect(() => {
    if (!audioStarted) return undefined;
    const id = setInterval(() => {
      setFuelLevel((prev) => {
        const next = Math.max(0, prev - 0.15);
        if (next < 30) setFlickering(true);
        if (next < 15) {
          setLayers((l) => ({ ...l, deep: Math.min(l.deep + 0.05, 0.8) }));
        }
        return next;
      });
    }, 2000);
    return () => clearInterval(id);
  }, [audioStarted]);

  // --- typing effect ---
  const typeFragment = useCallback((text, onDone) => {
    setIsTyping(true);
    setTypingText('');
    let i = 0;
    const id = setInterval(() => {
      if (i <= text.length) {
        setTypingText(text.slice(0, i));
        i += 1;
      } else {
        clearInterval(id);
        setIsTyping(false);
        setDisplayed((prev) => [...prev, text]);
        setTypingText('');
        onDone?.();
      }
    }, 40 + Math.random() * 30);
  }, []);

  // --- transmission queueing ---
  const queueTransmission = useCallback(() => {
    if (transmissionIndex >= transmissions.length) return;
    const delay = 3000 + Math.random() * 5000;
    setWaiting(true);
    setTimeout(() => {
      const tx = transmissions[transmissionIndex];
      setCurrent(tx);
      setDisplayed([]);
      setWaiting(false);
      setGamePhase(tx.phase);

      if (tx.phase >= 2) {
        setLayers((l) => ({
          ...l,
          static: Math.min(l.static + 0.15, 0.7),
          deep: Math.min(l.deep + 0.1, 0.6),
        }));
      }

      let fragIndex = 0;
      const typeNext = () => {
        if (fragIndex < tx.fragments.length) {
          const frag = tx.fragments[fragIndex];
          fragIndex += 1;
          setTimeout(() => typeFragment(frag, typeNext), 800);
        }
      };
      typeNext();
    }, delay);
  }, [transmissionIndex, typeFragment]);

  // Kick off the first transmission once audio is live.
  useEffect(() => {
    if (audioStarted && transmissionIndex === 0 && !currentTransmission) {
      const id = setTimeout(() => queueTransmission(), 4000);
      return () => clearTimeout(id);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioStarted]);

  // --- decisions ---
  const decide = useCallback(
    (decision) => {
      if (!currentTransmission) return;
      const outcome = resolveOutcome(currentTransmission, decision);

      const entry = {
        callsign: currentTransmission.callsign,
        freq: currentTransmission.freq,
        phase: currentTransmission.phase,
        decision,
        outcome,
        time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      };
      setLogbook((prev) => [...prev, entry]);
      setCurrent(null);
      setDisplayed([]);
      setTypingText('');

      if (outcome.fuel) {
        setFuelLevel((f) => Math.max(0, Math.min(100, f + outcome.fuel)));
      }
      if (outcome.flags && Object.keys(outcome.flags).length > 0) {
        setFlags((prev) => {
          const next = { ...prev };
          for (const [k, delta] of Object.entries(outcome.flags)) {
            next[k] = (next[k] ?? 0) + delta;
          }
          return next;
        });
      }

      setTxIndex((prev) => prev + 1);
      setTimeout(() => queueTransmission(), 2000);
    },
    [currentTransmission, queueTransmission]
  );

  return {
    audioStarted,
    startAudio,
    layers,
    setLayer,
    currentTransmission,
    displayedFragments,
    typingText,
    isTyping,
    logbook,
    transmissionIndex,
    transmissionTotal: transmissions.length,
    waiting,
    gamePhase,
    fuelLevel,
    flags,
    flickering,
    decide,
  };
}
