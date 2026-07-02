// Estimates horizontal fall distance using a simplified ballistic model.
// Assumes terminal velocity reached quickly for small UAS; formula:
//   t = sqrt(2h / g),  d = V_terminal * t
// V_terminal approximated from weight: (weightGrams / 1000) * 2 m/s (empirical constant)
const GRAVITY_MS2 = 9.81;
const TERMINAL_VELOCITY_FACTOR = 2; // m/s per kg (empirical UAS approximation)

export function calcFallDistance(weightGrams: number, heightMeters: number): number {
  if (weightGrams <= 0 || heightMeters <= 0) return 0;

  const weightKg = weightGrams / 1000;
  const terminalVelocity = weightKg * TERMINAL_VELOCITY_FACTOR;
  const fallTimeSeconds = Math.sqrt((2 * heightMeters) / GRAVITY_MS2);

  return Math.round(terminalVelocity * fallTimeSeconds * 10) / 10;
}
