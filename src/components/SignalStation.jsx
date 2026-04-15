import { useState } from 'react';
import { useStation } from '../state/useStation.js';

const PHASE_COLORS = { 0: '#3a7', 1: '#ca3', 2: '#c53', 3: '#a2f' };

const LAYER_META = [
  { key: 'ocean', label: 'Ocean', color: '#2a6a8a' },
  { key: 'wind', label: 'Wind', color: '#6a8a6a' },
  { key: 'static', label: 'Static', color: '#8a8a5a' },
  { key: 'horn', label: 'Fog Horn', color: '#8a6a4a' },
  { key: 'deep', label: '??? ', color: '#6a3a8a' },
];

export default function SignalStation() {
  const station = useStation();
  const [showLog, setShowLog] = useState(false);

  if (!station.audioStarted) {
    return <SplashScreen onStart={station.startAudio} />;
  }

  return (
    <div style={styles.shell}>
      <div
        style={{
          ...styles.atmosphere,
          background: `radial-gradient(ellipse at 50% 0%, ${
            station.flickering ? 'rgba(180,120,40,0.04)' : 'rgba(80,120,80,0.03)'
          } 0%, transparent 70%)`,
          animation: station.flickering ? 'flicker 0.3s infinite' : 'none',
        }}
      />

      <TopBar
        gamePhase={station.gamePhase}
        fuelLevel={station.fuelLevel}
        logCount={station.logbook.length}
        showLog={showLog}
        onToggleLog={() => setShowLog((v) => !v)}
      />

      <div style={styles.main}>
        <LeftPanel
          layers={station.layers}
          onLayer={station.setLayer}
          fuelLevel={station.fuelLevel}
        />
        <div style={styles.center}>
          {showLog ? (
            <Logbook entries={station.logbook} />
          ) : (
            <RadioPanel station={station} />
          )}
        </div>
      </div>

      <StatusBar
        processed={station.logbook.length}
        total={station.transmissionTotal}
        fuelLevel={station.fuelLevel}
      />

      <GlobalStyles />
    </div>
  );
}

function SplashScreen({ onStart }) {
  return (
    <div style={styles.splash} onClick={onStart}>
      <div style={styles.splashLabel}>Signal Station v0.1</div>
      <div style={styles.splashRing}>
        <div style={styles.splashDot} />
      </div>
      <div style={styles.splashHint}>click to initialize</div>
      <GlobalStyles />
    </div>
  );
}

function TopBar({ gamePhase, fuelLevel, logCount, showLog, onToggleLog }) {
  const fuelColor = fuelLevel < 30 ? '#c53' : fuelLevel < 60 ? '#ca3' : '#3a7';
  return (
    <div style={styles.topBar}>
      <span style={{ opacity: 0.5 }}>Signal Station</span>
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <span style={{ color: PHASE_COLORS[gamePhase] }}>Phase {gamePhase}</span>
        <span style={{ color: fuelColor }}>Fuel: {Math.round(fuelLevel)}%</span>
        <span style={{ cursor: 'pointer', opacity: 0.7 }} onClick={onToggleLog}>
          [{showLog ? 'Radio' : `Log (${logCount})`}]
        </span>
      </div>
    </div>
  );
}

function LeftPanel({ layers, onLayer, fuelLevel }) {
  const fuelColor = fuelLevel < 30 ? '#c53' : fuelLevel < 60 ? '#ca3' : '#3a7';
  return (
    <div style={styles.leftPanel}>
      <div style={styles.sectionLabel}>Ambient</div>
      {LAYER_META.map(({ key, label, color }) => (
        <div key={key}>
          <div style={styles.sliderHead}>
            <span style={{ color }}>{label}</span>
            <span style={{ opacity: 0.4 }}>{Math.round(layers[key] * 100)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(layers[key] * 100)}
            onChange={(e) => onLayer(key, parseInt(e.target.value, 10) / 100)}
            style={{ width: '100%', accentColor: color, height: 4 }}
          />
        </div>
      ))}
      <div style={{ marginTop: 'auto' }}>
        <div style={styles.sectionLabel}>Beacon Fuel</div>
        <div style={styles.fuelGauge}>
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              width: '100%',
              height: `${fuelLevel}%`,
              background: `linear-gradient(to top, ${fuelColor}, transparent)`,
              transition: 'height 1s, background 2s',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function RadioPanel({ station }) {
  const {
    currentTransmission,
    displayedFragments,
    typingText,
    isTyping,
    waiting,
    transmissionIndex,
    transmissionTotal,
    decide,
  } = station;

  const fragColor = (currentTransmission?.phase ?? 0) >= 2 ? '#a87a6a' : '#7a8a7a';
  const allFragmentsShown =
    currentTransmission &&
    !isTyping &&
    displayedFragments.length === currentTransmission.fragments.length;

  return (
    <>
      <div style={styles.sectionLabel}>Incoming Transmissions</div>
      <div style={styles.radioFrame}>
        <div style={styles.scanlines} />
        {!currentTransmission && !waiting ? (
          <div style={styles.placeholder}>
            {transmissionIndex >= transmissionTotal
              ? 'No more transmissions. The silence is absolute.'
              : 'Monitoring frequencies...'}
          </div>
        ) : waiting ? (
          <div style={styles.placeholder}>
            <span style={{ animation: 'pulse 1.5s infinite' }}>◉ scanning</span>
          </div>
        ) : (
          <>
            <div style={styles.txHeader}>
              <span style={{ color: PHASE_COLORS[currentTransmission.phase] }}>
                ◉ {currentTransmission.callsign}
              </span>
              <span style={{ opacity: 0.5 }}>{currentTransmission.freq} MHz</span>
            </div>
            <div style={{ flex: 1 }}>
              {displayedFragments.map((frag, i) => (
                <div key={i} style={{ ...styles.fragment, color: fragColor }}>
                  &gt; {frag}
                </div>
              ))}
              {isTyping && (
                <div style={{ ...styles.fragment, color: fragColor }}>
                  &gt; {typingText}
                  <span style={{ animation: 'blink 0.6s infinite' }}>█</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {allFragmentsShown && (
        <DecisionButtons phase={currentTransmission.phase} onDecide={decide} />
      )}
    </>
  );
}

function DecisionButtons({ phase, onDecide }) {
  const buttons = [
    { label: 'DOCK', color: '#3a7' },
    { label: 'REJECT', color: '#c53' },
    ...(phase >= 1 ? [{ label: 'INVESTIGATE', color: '#ca3' }] : []),
    ...(phase >= 2 ? [{ label: 'REFUEL', color: '#2a6a8a' }] : []),
  ];
  return (
    <div style={styles.decisionRow}>
      {buttons.map(({ label, color }) => (
        <button
          key={label}
          onClick={() => onDecide(label)}
          style={{ ...styles.decisionBtn, borderColor: color, color }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = color;
            e.currentTarget.style.color = '#0a0c0f';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = color;
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Logbook({ entries }) {
  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={styles.sectionLabel}>Keeper's Logbook</div>
      {entries.length === 0 ? (
        <div style={{ opacity: 0.3, fontSize: 13 }}>No entries yet.</div>
      ) : (
        entries.map((entry, i) => {
          const accent =
            entry.decision === 'DOCK'
              ? '#3a7'
              : entry.decision === 'REJECT'
              ? '#c53'
              : entry.decision === 'REFUEL'
              ? '#ca3'
              : '#555';
          return (
            <div
              key={i}
              style={{ ...styles.logEntry, borderLeft: `2px solid ${accent}` }}
            >
              <div style={{ opacity: 0.5, fontSize: 10 }}>
                {entry.time} — {entry.freq} MHz
              </div>
              <div style={{ marginTop: 4 }}>
                <span style={{ color: PHASE_COLORS[entry.phase] }}>
                  {entry.callsign}
                </span>{' '}
                → <span style={{ color: accent }}>{entry.decision}</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function StatusBar({ processed, total, fuelLevel }) {
  const message =
    fuelLevel <= 0
      ? 'THE LIGHT IS OUT.'
      : fuelLevel < 15
      ? 'fuel critical — they are stirring'
      : fuelLevel < 30
      ? 'fuel low — beacon unstable'
      : 'beacon operational';
  return (
    <div style={styles.statusBar}>
      <span>Vessels processed: {processed} / {total}</span>
      <span>{message}</span>
    </div>
  );
}

function GlobalStyles() {
  return (
    <style>{`
      @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
      @keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:0.8} }
      @keyframes flicker {
        0%{opacity:1} 10%{opacity:0.4} 20%{opacity:0.9} 40%{opacity:0.3}
        50%{opacity:1} 70%{opacity:0.5} 100%{opacity:0.9}
      }
      @keyframes splashPulse {
        0%,100%{transform:scale(1);opacity:0.6}
        50%{transform:scale(1.05);opacity:1}
      }
      input[type="range"] {
        -webkit-appearance: none;
        background: #1a2a1a;
        border-radius: 2px;
        outline: none;
      }
      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 12px; height: 12px; border-radius: 50%;
        background: currentColor; cursor: pointer;
      }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #1a2a1a; border-radius: 2px; }
    `}</style>
  );
}

const styles = {
  shell: {
    height: '100vh',
    background: '#0a0c0f',
    fontFamily: "'Courier New', monospace",
    color: '#7a8a7a',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  atmosphere: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    transition: 'background 2s',
  },
  topBar: {
    padding: '12px 20px',
    borderBottom: '1px solid #1a2a1a',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
    flexShrink: 0,
  },
  main: { flex: 1, display: 'flex', minHeight: 0 },
  leftPanel: {
    width: 200,
    borderRight: '1px solid #1a2a1a',
    padding: '20px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
    flexShrink: 0,
  },
  center: {
    flex: 1,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  sectionLabel: {
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    opacity: 0.4,
    marginBottom: 8,
  },
  sliderHead: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 11,
    marginBottom: 6,
  },
  fuelGauge: {
    height: 120,
    width: 30,
    margin: '0 auto',
    border: '1px solid #2a3a2a',
    borderRadius: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  radioFrame: {
    flex: 1,
    border: '1px solid #1a2a1a',
    borderRadius: 4,
    padding: 20,
    background: 'rgba(0,0,0,0.3)',
    position: 'relative',
    overflow: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  scanlines: {
    position: 'absolute',
    inset: 0,
    background:
      'repeating-linear-gradient(transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
    pointerEvents: 'none',
    borderRadius: 4,
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.3,
    fontSize: 13,
  },
  txHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    borderBottom: '1px solid #1a2a1a',
    paddingBottom: 10,
    marginBottom: 16,
    fontSize: 12,
  },
  fragment: {
    marginBottom: 10,
    fontSize: 13,
    lineHeight: 1.6,
  },
  decisionRow: {
    display: 'flex',
    gap: 12,
    marginTop: 16,
    justifyContent: 'center',
  },
  decisionBtn: {
    background: 'transparent',
    border: '1px solid',
    padding: '10px 20px',
    fontFamily: "'Courier New', monospace",
    fontSize: 12,
    letterSpacing: 2,
    cursor: 'pointer',
    transition: 'all 0.2s',
    borderRadius: 2,
  },
  logEntry: {
    padding: '10px 12px',
    marginBottom: 10,
    fontSize: 12,
    background: 'rgba(255,255,255,0.02)',
  },
  statusBar: {
    padding: '8px 20px',
    borderTop: '1px solid #1a2a1a',
    fontSize: 10,
    display: 'flex',
    justifyContent: 'space-between',
    opacity: 0.4,
    flexShrink: 0,
  },
  splash: {
    height: '100vh',
    background: '#0a0c0f',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    fontFamily: "'Courier New', monospace",
    color: '#7a8a7a',
    cursor: 'pointer',
  },
  splashLabel: {
    fontSize: 11,
    letterSpacing: 6,
    textTransform: 'uppercase',
    opacity: 0.4,
    marginBottom: 24,
  },
  splashRing: {
    width: 80,
    height: 80,
    border: '2px solid #3a5',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'splashPulse 2s ease-in-out infinite',
  },
  splashDot: {
    width: 12,
    height: 12,
    background: '#3a5',
    borderRadius: '50%',
    boxShadow: '0 0 20px #3a5',
  },
  splashHint: { fontSize: 13, marginTop: 24, opacity: 0.6 },
};
