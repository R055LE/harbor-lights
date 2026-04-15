// Reactive transmission picker.
//
// Replaces the linear walk through transmissions.json with a weighted draw
// based on the player's current state. The "phase" the player is in is
// derived from accumulated flags rather than baked into a sequence — every
// run reshapes itself around the choices made so far.

// How much of each flag pulls the player toward higher phases. Tuned by
// feel, not science.
const PHASE_PRESSURE = {
  corruption: 1.0,
  trust: -0.25,
};

// Compute the player's effective phase from current flags. Capped to the
// max phase declared in the data so we never aim at content that doesn't
// exist.
export function derivePhase(flags, maxPhase) {
  let pressure = 0;
  for (const [key, weight] of Object.entries(PHASE_PRESSURE)) {
    pressure += (flags[key] ?? 0) * weight;
  }
  // Every ~3 points of pressure advances one phase.
  const phase = Math.floor(Math.max(0, pressure) / 3);
  return Math.min(phase, maxPhase);
}

// Does a transmission's `requires` block accept the current state?
function meetsRequirements(tx, { flags, phase }) {
  const req = tx.requires;
  if (!req) return true;
  if (req.minPhase != null && phase < req.minPhase) return false;
  if (req.maxPhase != null && phase > req.maxPhase) return false;
  for (const [key, min] of Object.entries(req.minFlags ?? {})) {
    if ((flags[key] ?? 0) < min) return false;
  }
  for (const [key, max] of Object.entries(req.maxFlags ?? {})) {
    if ((flags[key] ?? 0) > max) return false;
  }
  return true;
}

// Pick the next transmission given current state, or null if nothing
// eligible remains. Eligible = unseen + requirements met + within one
// phase of the current player phase. Among eligible, transmissions whose
// declared phase matches the player's phase are weighted highest.
export function pickNext(transmissions, { seen, flags, phase }) {
  const eligible = transmissions.filter((tx) => {
    if (seen.has(tx.id)) return false;
    if (!meetsRequirements(tx, { flags, phase })) return false;
    // Allow drift up by one phase so escalation feels gradual rather than
    // a hard step. Never serve content from phases below the player.
    if (tx.phase > phase + 1) return false;
    if (tx.phase < phase - 1) return false;
    return true;
  });

  if (eligible.length === 0) return null;

  const weighted = eligible.map((tx) => {
    const distance = Math.abs(tx.phase - phase);
    // Same-phase = weight 4, off-by-one = weight 1.
    const weight = distance === 0 ? 4 : 1;
    return { tx, weight };
  });

  const total = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * total;
  for (const { tx, weight } of weighted) {
    roll -= weight;
    if (roll <= 0) return tx;
  }
  return weighted[weighted.length - 1].tx;
}
