/**
 * Liquescent Design System - Perlin Noise
 *
 * Multi-octave Perlin noise for organic drift.
 * Optimized for per-frame video rendering.
 *
 * Philosophy: Random is mechanical. Noise is organic.
 * Perlin noise creates smooth, continuous variation that feels alive.
 */

// =============================================================================
// PERMUTATION TABLE
// =============================================================================

/**
 * Pre-computed permutation table for noise generation
 * Using a seeded pseudo-random generator for reproducibility
 */
const createPermutationTable = (seed: number = 0): Uint8Array => {
  const p = new Uint8Array(512);

  // Initialize with seeded pseudo-random values
  for (let i = 0; i < 256; i++) {
    const x = (i + seed) * 1103515245 + 12345;
    p[i] = ((x >> 16) & 0xff) ^ (x & 0xff);
  }

  // Duplicate for overflow
  for (let i = 0; i < 256; i++) {
    p[i + 256] = p[i];
  }

  return p;
};

// Default permutation table
const defaultP = createPermutationTable(0);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Fade function: 6t^5 - 15t^4 + 10t^3
 * Creates smooth interpolation without visible seams
 */
const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

/**
 * Linear interpolation
 */
const lerp = (a: number, b: number, t: number): number => a + t * (b - a);

/**
 * Gradient function for 2D noise
 */
const grad2D = (hash: number, x: number, y: number): number => {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
};

/**
 * Gradient function for 3D noise
 */
const grad3D = (hash: number, x: number, y: number, z: number): number => {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
};

// =============================================================================
// 2D PERLIN NOISE
// =============================================================================

/**
 * Classic 2D Perlin noise
 * Returns value in range [-1, 1]
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param p - Permutation table (optional, uses default)
 */
export const perlin2D = (x: number, y: number, p: Uint8Array = defaultP): number => {
  // Find unit grid cell containing point
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;

  // Get relative position within cell
  x -= Math.floor(x);
  y -= Math.floor(y);

  // Compute fade curves
  const u = fade(x);
  const v = fade(y);

  // Hash coordinates of cube corners
  const A = p[X] + Y;
  const B = p[X + 1] + Y;

  // Blend results from corners
  return lerp(
    lerp(grad2D(p[A], x, y), grad2D(p[B], x - 1, y), u),
    lerp(grad2D(p[A + 1], x, y - 1), grad2D(p[B + 1], x - 1, y - 1), u),
    v
  );
};

// =============================================================================
// 3D PERLIN NOISE
// =============================================================================

/**
 * Classic 3D Perlin noise
 * Returns value in range [-1, 1]
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param z - Z coordinate
 * @param p - Permutation table (optional)
 */
export const perlin3D = (
  x: number,
  y: number,
  z: number,
  p: Uint8Array = defaultP
): number => {
  // Find unit cube containing point
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const Z = Math.floor(z) & 255;

  // Get relative position within cube
  x -= Math.floor(x);
  y -= Math.floor(y);
  z -= Math.floor(z);

  // Compute fade curves
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);

  // Hash coordinates of cube corners
  const A = p[X] + Y;
  const AA = p[A] + Z;
  const AB = p[A + 1] + Z;
  const B = p[X + 1] + Y;
  const BA = p[B] + Z;
  const BB = p[B + 1] + Z;

  // Blend results from corners
  return lerp(
    lerp(
      lerp(grad3D(p[AA], x, y, z), grad3D(p[BA], x - 1, y, z), u),
      lerp(grad3D(p[AB], x, y - 1, z), grad3D(p[BB], x - 1, y - 1, z), u),
      v
    ),
    lerp(
      lerp(grad3D(p[AA + 1], x, y, z - 1), grad3D(p[BA + 1], x - 1, y, z - 1), u),
      lerp(grad3D(p[AB + 1], x, y - 1, z - 1), grad3D(p[BB + 1], x - 1, y - 1, z - 1), u),
      v
    ),
    w
  );
};

// =============================================================================
// FRACTAL BROWNIAN MOTION (fBm)
// =============================================================================

/**
 * Multi-octave fractal noise (2D)
 * Layers multiple noise samples for natural-looking results
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param octaves - Number of noise layers (default 4)
 * @param lacunarity - Frequency multiplier per octave (default 2)
 * @param persistence - Amplitude multiplier per octave (default 0.5)
 */
export const fractalNoise2D = (
  x: number,
  y: number,
  octaves: number = 4,
  lacunarity: number = 2,
  persistence: number = 0.5
): number => {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += perlin2D(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return total / maxValue;
};

/**
 * Multi-octave fractal noise (3D)
 */
export const fractalNoise3D = (
  x: number,
  y: number,
  z: number,
  octaves: number = 4,
  lacunarity: number = 2,
  persistence: number = 0.5
): number => {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += perlin3D(x * frequency, y * frequency, z * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= lacunarity;
  }

  return total / maxValue;
};

// =============================================================================
// DOMAIN WARPING
// =============================================================================

/**
 * Domain warp - noise distorting noise
 * Creates swirling, organic patterns
 *
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param warpStrength - How much to distort (default 1)
 * @param octaves - Noise octaves
 */
export const domainWarp2D = (
  x: number,
  y: number,
  warpStrength: number = 1,
  octaves: number = 3
): number => {
  // First layer of noise to warp coordinates
  const warpX = fractalNoise2D(x, y, octaves) * warpStrength;
  const warpY = fractalNoise2D(x + 5.2, y + 1.3, octaves) * warpStrength;

  // Sample noise at warped coordinates
  return fractalNoise2D(x + warpX, y + warpY, octaves);
};

// =============================================================================
// LIQUESCENT-SPECIFIC UTILITIES
// =============================================================================

/**
 * Organic drift using Perlin noise
 * Replaces the old particleDrift function with smoother motion
 *
 * @param frame - Current frame number
 * @param seed - Unique seed for this element
 * @param speed - Movement speed multiplier (default 1)
 * @param scale - Coordinate scale (default 0.01)
 * @param amplitude - Movement amplitude in pixels (default 20)
 */
export const organicDrift = (
  frame: number,
  seed: number,
  speed: number = 1,
  scale: number = 0.01,
  amplitude: number = 20
): { x: number; y: number } => {
  const t = frame * speed * scale;
  return {
    x: fractalNoise2D(t + seed, seed * 0.7) * amplitude,
    y: fractalNoise2D(seed * 0.7, t + seed) * amplitude,
  };
};

/**
 * Organic drift with depth (parallax)
 */
export const organicDrift3D = (
  frame: number,
  seed: number,
  speed: number = 1,
  scale: number = 0.01,
  amplitude: number = 20
): { x: number; y: number; z: number } => {
  const t = frame * speed * scale;
  return {
    x: fractalNoise2D(t + seed, seed * 0.7) * amplitude,
    y: fractalNoise2D(seed * 0.7, t + seed) * amplitude,
    z: fractalNoise2D(t * 0.5 + seed, seed * 0.3 + t) * amplitude * 0.3,
  };
};

/**
 * Breathing pulse with noise modulation
 * More organic than pure sine wave
 *
 * @param frame - Current frame number
 * @param fps - Frames per second
 * @param seed - Unique seed (default 0)
 */
export const organicBreath = (
  frame: number,
  fps: number,
  seed: number = 0
): number => {
  // Base 60 BPM sine wave
  const breathCycleFrames = fps; // 1 second at 30fps = 30 frames
  const phase = (frame % breathCycleFrames) / breathCycleFrames;
  const baseSine = Math.sin(phase * Math.PI * 2);

  // Add subtle noise modulation
  const noiseT = frame * 0.005;
  const noiseModulation = perlin2D(noiseT + seed, seed * 0.7) * 0.15;

  // Combine: 70-100% range with noise variation
  return 0.7 + 0.3 * ((baseSine + 1) / 2) * (1 + noiseModulation);
};

/**
 * Trembling/jitter effect
 * Good for "characters about to liquefy" animation
 *
 * @param frame - Current frame number
 * @param seed - Unique seed
 * @param intensity - Jitter intensity (default 1)
 */
export const organicTremble = (
  frame: number,
  seed: number,
  intensity: number = 1
): { x: number; y: number; rotation: number } => {
  const scale = 0.3; // Higher frequency for trembling
  const t = frame * scale;

  return {
    x: perlin2D(t + seed, seed) * 2 * intensity,
    y: perlin2D(seed, t + seed) * 2 * intensity,
    rotation: perlin2D(t * 0.7, seed * 1.3) * 1 * intensity, // degrees
  };
};

/**
 * Swarm/flocking behavior
 * Good for particle fields that feel alive
 *
 * @param frame - Current frame
 * @param index - Particle index
 * @param totalParticles - Total particle count
 */
export const swarmMotion = (
  frame: number,
  index: number,
  totalParticles: number
): { x: number; y: number; phase: number } => {
  const t = frame * 0.02;
  const particlePhase = (index / totalParticles) * Math.PI * 2;

  // Global swarm direction
  const globalX = fractalNoise2D(t, 0) * 30;
  const globalY = fractalNoise2D(0, t) * 30;

  // Individual variation
  const individualX = perlin2D(t + index * 0.1, index * 0.7) * 10;
  const individualY = perlin2D(index * 0.7, t + index * 0.1) * 10;

  return {
    x: globalX + individualX,
    y: globalY + individualY,
    phase: particlePhase + perlin2D(t * 0.5, index) * 0.5,
  };
};

// =============================================================================
// SEEDED NOISE GENERATOR
// =============================================================================

/**
 * Create a seeded noise generator for reproducible results
 */
export const createSeededNoise = (seed: number) => {
  const p = createPermutationTable(seed);

  return {
    perlin2D: (x: number, y: number) => perlin2D(x, y, p),
    perlin3D: (x: number, y: number, z: number) => perlin3D(x, y, z, p),
    fractal2D: (x: number, y: number, octaves?: number) =>
      fractalNoise2D(x, y, octaves, 2, 0.5),
    fractal3D: (x: number, y: number, z: number, octaves?: number) =>
      fractalNoise3D(x, y, z, octaves, 2, 0.5),
  };
};
