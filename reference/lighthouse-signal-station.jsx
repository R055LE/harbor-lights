import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from "tone";

// --- TRANSMISSION DATA ---
const TRANSMISSIONS = [
  // Phase 1: Normal
  {
    id: "t1",
    callsign: "MV CLARITY",
    freq: "156.800",
    fragments: [
      "MV Clarity requesting approach...",
      "Cargo: medical supplies, 40 tonnes...",
      "ETA harbor: 0230 hours...",
      "Crew complement: 14, all accounted for.",
    ],
    phase: 0,
  },
  {
    id: "t2",
    callsign: "TUG RESOLUTE",
    freq: "156.300",
    fragments: [
      "Tug Resolute inbound from south channel...",
      "Towing disabled vessel, name unclear...",
      "Requesting berth assignment...",
      "Weather deteriorating. Visibility 200m.",
    ],
    phase: 0,
  },
  // Phase 2: Slightly off
  {
    id: "t3",
    callsign: "FV SECOND DAWN",
    freq: "156.450",
    fragments: [
      "Fishing vessel Second Dawn requesting harbor...",
      "Nets are... full. We need to offload...",
      "Catch is unlike anything we've... [static]",
      "One crewman won't stop staring at the water.",
    ],
    phase: 1,
  },
  {
    id: "t4",
    callsign: "RV PELAGIC",
    freq: "156.700",
    fragments: [
      "Research vessel Pelagic, urgent request...",
      "Sonar readings are... wrong. Depth is wrong...",
      "We measured 11,000 meters. Charts say 200...",
      "Dr. Kessler insists we continue. Overruling her.",
    ],
    phase: 1,
  },
  // Phase 3: Wrong
  {
    id: "t5",
    callsign: "MV ░░░░░░",
    freq: "1█6.000",
    fragments: [
      "[static] ...requesting... [static] ...approach...",
      "Cargo manifest reads: [INCOMPREHENSIBLE]",
      "Crew complement: 14. No. 15. No. We keep counting...",
      "The wake behind us is the wrong color.",
    ],
    phase: 2,
  },
  {
    id: "t6",
    callsign: "UNKNOWN",
    freq: "000.000",
    fragments: [
      "This is... I was the keeper before you...",
      "I left the light on. Why did you change the frequency...",
      "The ships aren't coming TO the harbor...",
      "They're coming FROM underneath it.",
    ],
    phase: 2,
  },
  // Phase 4: Very wrong
  {
    id: "t7",
    callsign: "LIGHTHOUSE",
    freq: "YOUR.FREQ",
    fragments: [
      "This is your station calling your station...",
      "You logged vessel MV Clarity at 0230...",
      "MV Clarity sank in 1987...",
      "Check your logbook. Check your hands.",
    ],
    phase: 3,
  },
  {
    id: "t8",
    callsign: "THE LIGHT",
    freq: "———.———",
    fragments: [
      "You were right to keep the light on...",
      "It keeps us below the surface...",
      "We are very patient...",
      "When the fuel runs out, we will be so grateful.",
    ],
    phase: 3,
  },
];

// --- AUDIO ENGINE ---
function createAudioEngine() {
  const engine = {
    started: false,
    layers: {},
    masterVol: new Tone.Volume(-6).toDestination(),
  };

  // Ocean layer - filtered noise with LFO
  const oceanNoise = new Tone.Noise("brown").start();
  const oceanFilter = new Tone.AutoFilter({
    frequency: 0.08,
    baseFrequency: 100,
    octaves: 2.5,
  })
    .connect(engine.masterVol)
    .start();
  const oceanVol = new Tone.Volume(-Infinity).connect(oceanFilter);
  oceanNoise.connect(oceanVol);
  engine.layers.ocean = { vol: oceanVol, source: oceanNoise };

  // Wind layer - higher filtered noise
  const windNoise = new Tone.Noise("white").start();
  const windFilter = new Tone.AutoFilter({
    frequency: 0.15,
    baseFrequency: 800,
    octaves: 3,
  })
    .connect(engine.masterVol)
    .start();
  const windVol = new Tone.Volume(-Infinity).connect(windFilter);
  windNoise.connect(windVol);
  engine.layers.wind = { vol: windVol, source: windNoise };

  // Radio static
  const staticNoise = new Tone.Noise("white").start();
  const staticFilter = new Tone.Filter(3000, "bandpass").connect(
    engine.masterVol
  );
  const staticVol = new Tone.Volume(-Infinity).connect(staticFilter);
  staticNoise.connect(staticVol);
  engine.layers.static = { vol: staticVol, source: staticNoise };

  // Fog horn - low synth with slow envelope
  const hornSynth = new Tone.Synth({
    oscillator: { type: "sawtooth" },
    envelope: { attack: 1.5, decay: 0.5, sustain: 0.6, release: 2.0 },
  });
  const hornFilter = new Tone.Filter(200, "lowpass").connect(engine.masterVol);
  const hornVol = new Tone.Volume(-Infinity).connect(hornFilter);
  hornSynth.connect(hornVol);
  engine.layers.horn = { vol: hornVol, synth: hornSynth };

  // Deep hum - the "beneath" layer
  const deepSynth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 3, decay: 1, sustain: 1, release: 3 },
  });
  const deepVol = new Tone.Volume(-Infinity).connect(engine.masterVol);
  const deepTremolo = new Tone.Tremolo(0.3, 0.4)
    .connect(deepVol)
    .start();
  deepSynth.connect(deepTremolo);
  engine.layers.deep = { vol: deepVol, synth: deepSynth };

  return engine;
}

// --- MAIN COMPONENT ---
export default function LighthouseSignalStation() {
  const [audioStarted, setAudioStarted] = useState(false);
  const [layers, setLayers] = useState({
    ocean: 0.6,
    wind: 0.3,
    static: 0.1,
    horn: 0,
    deep: 0,
  });
  const [currentTransmission, setCurrentTransmission] = useState(null);
  const [displayedFragments, setDisplayedFragments] = useState([]);
  const [typingText, setTypingText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [logbook, setLogbook] = useState([]);
  const [transmissionIndex, setTransmissionIndex] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [gamePhase, setGamePhase] = useState(0);
  const [fuelLevel, setFuelLevel] = useState(100);
  const [flickering, setFlickering] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const engineRef = useRef(null);
  const hornIntervalRef = useRef(null);
  const deepDroneRef = useRef(null);

  const startAudio = async () => {
    await Tone.start();
    engineRef.current = createAudioEngine();
    setAudioStarted(true);

    // Start fog horn loop
    hornIntervalRef.current = setInterval(() => {
      if (engineRef.current?.layers.horn?.synth) {
        engineRef.current.layers.horn.synth.triggerAttackRelease("C1", "3s");
      }
    }, 15000);

    // Start deep drone
    deepDroneRef.current = setInterval(() => {
      if (engineRef.current?.layers.deep?.synth) {
        engineRef.current.layers.deep.synth.triggerAttackRelease(
          "E0",
          "8s"
        );
      }
    }, 12000);
  };

  // Update audio volumes
  useEffect(() => {
    if (!engineRef.current) return;
    Object.entries(layers).forEach(([key, val]) => {
      const layer = engineRef.current.layers[key];
      if (layer?.vol) {
        layer.vol.volume.value = val > 0 ? Tone.gainToDb(val) : -Infinity;
      }
    });
  }, [layers]);

  // Fuel drain
  useEffect(() => {
    if (!audioStarted) return;
    const interval = setInterval(() => {
      setFuelLevel((prev) => {
        const newLevel = Math.max(0, prev - 0.15);
        if (newLevel < 30) setFlickering(true);
        if (newLevel < 15) {
          setLayers((l) => ({ ...l, deep: Math.min(l.deep + 0.05, 0.8) }));
        }
        return newLevel;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [audioStarted]);

  // Typing effect
  const typeFragment = useCallback((text, onDone) => {
    setIsTyping(true);
    setTypingText("");
    let i = 0;
    const interval = setInterval(() => {
      if (i <= text.length) {
        setTypingText(text.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
        setDisplayedFragments((prev) => [...prev, text]);
        setTypingText("");
        onDone?.();
      }
    }, 40 + Math.random() * 30);
    return () => clearInterval(interval);
  }, []);

  // Queue next transmission
  const queueTransmission = useCallback(() => {
    if (transmissionIndex >= TRANSMISSIONS.length) return;

    const delay = 3000 + Math.random() * 5000;
    setWaiting(true);
    setTimeout(() => {
      const tx = TRANSMISSIONS[transmissionIndex];
      setCurrentTransmission(tx);
      setDisplayedFragments([]);
      setWaiting(false);
      setGamePhase(tx.phase);

      if (tx.phase >= 2) {
        setLayers((l) => ({
          ...l,
          static: Math.min(l.static + 0.15, 0.7),
          deep: Math.min(l.deep + 0.1, 0.6),
        }));
      }

      // Type fragments sequentially
      let fragIndex = 0;
      const typeNext = () => {
        if (fragIndex < tx.fragments.length) {
          const frag = tx.fragments[fragIndex];
          fragIndex++;
          setTimeout(() => typeFragment(frag, typeNext), 800);
        }
      };
      typeNext();
    }, delay);
  }, [transmissionIndex, typeFragment]);

  // Start first transmission
  useEffect(() => {
    if (audioStarted && transmissionIndex === 0 && !currentTransmission) {
      setTimeout(() => queueTransmission(), 4000);
    }
  }, [audioStarted]);

  const handleDecision = (decision) => {
    if (!currentTransmission) return;
    const entry = {
      callsign: currentTransmission.callsign,
      freq: currentTransmission.freq,
      decision,
      phase: currentTransmission.phase,
      time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
    };
    setLogbook((prev) => [...prev, entry]);
    setCurrentTransmission(null);
    setDisplayedFragments([]);
    setTypingText("");

    if (decision === "DOCK" && currentTransmission.phase >= 2) {
      setFuelLevel((f) => Math.max(0, f - 10));
    }
    if (decision === "REFUEL") {
      setFuelLevel((f) => Math.min(100, f + 25));
    }

    setTransmissionIndex((prev) => prev + 1);
    setTimeout(() => queueTransmission(), 2000);
  };

  const phaseColors = {
    0: "#3a7",
    1: "#ca3",
    2: "#c53",
    3: "#a2f",
  };

  // --- RENDER ---

  if (!audioStarted) {
    return (
      <div
        style={{
          height: "100vh",
          background: "#0a0c0f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          fontFamily: "'Courier New', monospace",
          color: "#7a8a7a",
          cursor: "pointer",
        }}
        onClick={startAudio}
      >
        <div
          style={{
            fontSize: "11px",
            letterSpacing: "6px",
            textTransform: "uppercase",
            opacity: 0.4,
            marginBottom: "24px",
          }}
        >
          Signal Station v0.1
        </div>
        <div
          style={{
            width: "80px",
            height: "80px",
            border: "2px solid #3a5",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "pulse 2s ease-in-out infinite",
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              background: "#3a5",
              borderRadius: "50%",
              boxShadow: "0 0 20px #3a5",
            }}
          />
        </div>
        <div
          style={{
            fontSize: "13px",
            marginTop: "24px",
            opacity: 0.6,
          }}
        >
          click to initialize
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.05); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        background: "#0a0c0f",
        fontFamily: "'Courier New', monospace",
        color: "#7a8a7a",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Atmospheric overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 0%, ${
            flickering ? "rgba(180,120,40,0.04)" : "rgba(80,120,80,0.03)"
          } 0%, transparent 70%)`,
          pointerEvents: "none",
          transition: "background 2s",
          animation: flickering ? "flicker 0.3s infinite" : "none",
        }}
      />

      {/* Top bar */}
      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid #1a2a1a",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "11px",
          letterSpacing: "2px",
          textTransform: "uppercase",
          flexShrink: 0,
        }}
      >
        <span style={{ opacity: 0.5 }}>Signal Station</span>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <span style={{ color: phaseColors[gamePhase] }}>
            Phase {gamePhase}
          </span>
          <span
            style={{
              color: fuelLevel < 30 ? "#c53" : fuelLevel < 60 ? "#ca3" : "#3a7",
            }}
          >
            Fuel: {Math.round(fuelLevel)}%
          </span>
          <span
            style={{ cursor: "pointer", opacity: 0.7 }}
            onClick={() => setShowLog(!showLog)}
          >
            [{showLog ? "Radio" : `Log (${logbook.length})`}]
          </span>
        </div>
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Left panel - Audio controls */}
        <div
          style={{
            width: "200px",
            borderRight: "1px solid #1a2a1a",
            padding: "20px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "3px",
              textTransform: "uppercase",
              opacity: 0.4,
              marginBottom: "4px",
            }}
          >
            Ambient
          </div>
          {[
            { key: "ocean", label: "Ocean", color: "#2a6a8a" },
            { key: "wind", label: "Wind", color: "#6a8a6a" },
            { key: "static", label: "Static", color: "#8a8a5a" },
            { key: "horn", label: "Fog Horn", color: "#8a6a4a" },
            { key: "deep", label: "??? ", color: "#6a3a8a" },
          ].map(({ key, label, color }) => (
            <div key={key}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "11px",
                  marginBottom: "6px",
                }}
              >
                <span style={{ color }}>{label}</span>
                <span style={{ opacity: 0.4 }}>
                  {Math.round(layers[key] * 100)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(layers[key] * 100)}
                onChange={(e) =>
                  setLayers((l) => ({
                    ...l,
                    [key]: parseInt(e.target.value) / 100,
                  }))
                }
                style={{
                  width: "100%",
                  accentColor: color,
                  height: "4px",
                }}
              />
            </div>
          ))}

          {/* Fuel gauge */}
          <div style={{ marginTop: "auto" }}>
            <div
              style={{
                fontSize: "10px",
                letterSpacing: "3px",
                textTransform: "uppercase",
                opacity: 0.4,
                marginBottom: "8px",
              }}
            >
              Beacon Fuel
            </div>
            <div
              style={{
                height: "120px",
                width: "30px",
                margin: "0 auto",
                border: "1px solid #2a3a2a",
                borderRadius: "4px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  width: "100%",
                  height: `${fuelLevel}%`,
                  background: `linear-gradient(to top, ${
                    fuelLevel < 30
                      ? "#c53"
                      : fuelLevel < 60
                      ? "#ca3"
                      : "#3a7"
                  }, transparent)`,
                  transition: "height 1s, background 2s",
                }}
              />
            </div>
          </div>
        </div>

        {/* Center panel - Radio / Logbook */}
        <div
          style={{
            flex: 1,
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {showLog ? (
            // Logbook view
            <div style={{ flex: 1, overflow: "auto" }}>
              <div
                style={{
                  fontSize: "10px",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  opacity: 0.4,
                  marginBottom: "16px",
                }}
              >
                Keeper's Logbook
              </div>
              {logbook.length === 0 ? (
                <div style={{ opacity: 0.3, fontSize: "13px" }}>
                  No entries yet.
                </div>
              ) : (
                logbook.map((entry, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "10px 12px",
                      borderLeft: `2px solid ${
                        entry.decision === "DOCK"
                          ? "#3a7"
                          : entry.decision === "REJECT"
                          ? "#c53"
                          : entry.decision === "REFUEL"
                          ? "#ca3"
                          : "#555"
                      }`,
                      marginBottom: "10px",
                      fontSize: "12px",
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div style={{ opacity: 0.5, fontSize: "10px" }}>
                      {entry.time} — {entry.freq} MHz
                    </div>
                    <div style={{ marginTop: "4px" }}>
                      <span style={{ color: phaseColors[entry.phase] }}>
                        {entry.callsign}
                      </span>{" "}
                      →{" "}
                      <span
                        style={{
                          color:
                            entry.decision === "DOCK"
                              ? "#3a7"
                              : entry.decision === "REJECT"
                              ? "#c53"
                              : "#ca3",
                        }}
                      >
                        {entry.decision}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            // Radio view
            <>
              <div
                style={{
                  fontSize: "10px",
                  letterSpacing: "3px",
                  textTransform: "uppercase",
                  opacity: 0.4,
                  marginBottom: "16px",
                }}
              >
                Incoming Transmissions
              </div>

              {/* Radio display */}
              <div
                style={{
                  flex: 1,
                  border: "1px solid #1a2a1a",
                  borderRadius: "4px",
                  padding: "20px",
                  background: "rgba(0,0,0,0.3)",
                  position: "relative",
                  overflow: "auto",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Scanlines overlay */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "repeating-linear-gradient(transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)",
                    pointerEvents: "none",
                    borderRadius: "4px",
                  }}
                />

                {!currentTransmission && !waiting ? (
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: 0.3,
                      fontSize: "13px",
                    }}
                  >
                    {transmissionIndex >= TRANSMISSIONS.length
                      ? "No more transmissions. The silence is absolute."
                      : "Monitoring frequencies..."}
                  </div>
                ) : waiting ? (
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: 0.3,
                    }}
                  >
                    <span style={{ animation: "pulse 1.5s infinite" }}>
                      ◉ scanning
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Transmission header */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        borderBottom: "1px solid #1a2a1a",
                        paddingBottom: "10px",
                        marginBottom: "16px",
                        fontSize: "12px",
                      }}
                    >
                      <span
                        style={{
                          color: phaseColors[currentTransmission?.phase || 0],
                        }}
                      >
                        ◉ {currentTransmission?.callsign}
                      </span>
                      <span style={{ opacity: 0.5 }}>
                        {currentTransmission?.freq} MHz
                      </span>
                    </div>

                    {/* Fragments */}
                    <div style={{ flex: 1 }}>
                      {displayedFragments.map((frag, i) => (
                        <div
                          key={i}
                          style={{
                            marginBottom: "10px",
                            fontSize: "13px",
                            lineHeight: "1.6",
                            color:
                              currentTransmission?.phase >= 2
                                ? "#a87a6a"
                                : "#7a8a7a",
                          }}
                        >
                          &gt; {frag}
                        </div>
                      ))}
                      {isTyping && (
                        <div
                          style={{
                            fontSize: "13px",
                            lineHeight: "1.6",
                            color:
                              currentTransmission?.phase >= 2
                                ? "#a87a6a"
                                : "#7a8a7a",
                          }}
                        >
                          &gt; {typingText}
                          <span style={{ animation: "blink 0.6s infinite" }}>
                            █
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Decision buttons */}
              {currentTransmission && !isTyping && displayedFragments.length === currentTransmission.fragments.length && (
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    marginTop: "16px",
                    justifyContent: "center",
                  }}
                >
                  {[
                    { label: "DOCK", color: "#3a7", desc: "Grant harbor access" },
                    { label: "REJECT", color: "#c53", desc: "Deny approach" },
                    ...(currentTransmission.phase >= 1
                      ? [
                          {
                            label: "INVESTIGATE",
                            color: "#ca3",
                            desc: "Board and inspect",
                          },
                        ]
                      : []),
                    ...(currentTransmission.phase >= 2
                      ? [
                          {
                            label: "REFUEL",
                            color: "#2a6a8a",
                            desc: "Siphon fuel (+25%)",
                          },
                        ]
                      : []),
                  ].map(({ label, color, desc }) => (
                    <button
                      key={label}
                      onClick={() => handleDecision(label)}
                      style={{
                        background: "transparent",
                        border: `1px solid ${color}`,
                        color,
                        padding: "10px 20px",
                        fontFamily: "'Courier New', monospace",
                        fontSize: "12px",
                        letterSpacing: "2px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        borderRadius: "2px",
                      }}
                      title={desc}
                      onMouseEnter={(e) => {
                        e.target.style.background = color;
                        e.target.style.color = "#0a0c0f";
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = "transparent";
                        e.target.style.color = color;
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div
        style={{
          padding: "8px 20px",
          borderTop: "1px solid #1a2a1a",
          fontSize: "10px",
          display: "flex",
          justifyContent: "space-between",
          opacity: 0.4,
          flexShrink: 0,
        }}
      >
        <span>
          Vessels processed: {logbook.length} / {TRANSMISSIONS.length}
        </span>
        <span>
          {fuelLevel <= 0
            ? "THE LIGHT IS OUT."
            : fuelLevel < 15
            ? "fuel critical — they are stirring"
            : fuelLevel < 30
            ? "fuel low — beacon unstable"
            : "beacon operational"}
        </span>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        @keyframes flicker {
          0% { opacity: 1; }
          10% { opacity: 0.4; }
          20% { opacity: 0.9; }
          40% { opacity: 0.3; }
          50% { opacity: 1; }
          70% { opacity: 0.5; }
          100% { opacity: 0.9; }
        }
        input[type="range"] {
          -webkit-appearance: none;
          background: #1a2a1a;
          border-radius: 2px;
          outline: none;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: currentColor;
          cursor: pointer;
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1a2a1a; border-radius: 2px; }
      `}</style>
    </div>
  );
}
