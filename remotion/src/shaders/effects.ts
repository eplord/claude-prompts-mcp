/**
 * GLSL Effects - Liquescent Design System
 *
 * Advanced visual effects: caustics, god rays, bioluminescent grain.
 * These build on noise.ts and easing.ts functions.
 */

// =============================================================================
// VORONOI CAUSTICS
// =============================================================================

/**
 * Voronoi-based caustic patterns (underwater light scattering)
 * Requires: GLSL_NOISE_COMMON from noise.ts
 * Cost: ~150-200 GPU ops
 */
export const GLSL_CAUSTICS = /* glsl */ `
// Voronoi distance fields
vec3 voronoi(vec2 p, float time) {
  vec2 n = floor(p);
  vec2 f = fract(p);
  float F1 = 8.0;
  float F2 = 8.0;
  float cellId = 0.0;

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 neighbor = vec2(float(i), float(j));
      vec2 cellPos = n + neighbor;
      vec2 cellRandom = hash2(cellPos);

      // Animate cell centers with sine waves
      vec2 cellCenter = 0.5 + 0.4 * sin(time * 0.5 + 6.2831 * cellRandom);
      vec2 diff = neighbor + cellCenter - f;
      float dist = length(diff);

      if (dist < F1) {
        F2 = F1;
        F1 = dist;
        cellId = dot(cellPos, vec2(7.0, 113.0));
      } else if (dist < F2) {
        F2 = dist;
      }
    }
  }
  return vec3(F1, F2, cellId);
}

// Main caustics function
// attention: 0-1 (higher = sharper patterns)
// depth: 0-1 (higher = larger patterns, more intensity)
float caustics(vec2 p, float time, float depth, float attention) {
  // Scale increases with depth (patterns expand)
  float scale = 4.0 + depth * 6.0;

  // Two layers of voronoi for complexity
  vec3 v1 = voronoi(p * scale, time);
  vec3 v2 = voronoi(p * scale * 1.5 + vec2(3.7, 2.1), time * 1.3);

  // Caustic pattern from edge distances
  float caustic1 = v1.y - v1.x;
  float caustic2 = v2.y - v2.x;

  // Sharpness controlled by attention
  float sharpness = 2.0 + attention * 3.0;
  float pattern = pow(caustic1 * caustic2, 1.0 / sharpness);

  // Intensity increases with depth
  float depthIntensity = smoothstep(0.15, 0.7, depth);

  return pattern * depthIntensity;
}

// Multi-layer caustics for more realistic effect
float causticsFull(vec2 p, float time, float depth, float attention) {
  float c1 = caustics(p, time, depth, attention);
  float c2 = caustics(p * 0.7 + vec2(1.3, 0.8), time * 0.8, depth, attention * 0.7) * 0.5;
  float c3 = caustics(p * 1.3 + vec2(-0.5, 1.2), time * 1.2, depth, attention * 0.5) * 0.25;
  return c1 + c2 + c3;
}
`;

// =============================================================================
// VOLUMETRIC GOD RAYS
// =============================================================================

/**
 * Radial light scattering (god rays / crepuscular rays)
 * Requires: GLSL_SIMPLEX_2D from noise.ts
 * Cost: ~200-400 GPU ops (varies with sample count)
 */
export const GLSL_GOD_RAYS = /* glsl */ `
// Volumetric light rays from a point source
// lightPos: light position in UV space (0-1)
// samples: quality (16-32 recommended)
// density: ray spread (0.5-1.0)
// decay: falloff per sample (0.9-0.98)
float volumetricRays(
  vec2 uv,
  vec2 lightPos,
  float depth,
  float time,
  int samples,
  float density,
  float decay
) {
  vec2 baseDir = uv - lightPos;
  vec2 deltaUV = baseDir / float(samples) * density;
  vec2 sampleUV = uv;
  float illumination = 0.0;
  float weight = 1.0;

  for (int i = 0; i < 32; i++) {
    if (i >= samples) break;

    // Jitter to break banding
    float jitter = snoise(sampleUV * 30.0 + float(i) * 0.7) * 0.015;
    sampleUV -= deltaUV * (1.0 + jitter);

    // Domain warp for organic look
    vec2 warp = vec2(
      snoise(sampleUV * 3.0 + time * 0.2),
      snoise(sampleUV * 3.0 + vec2(5.2, 1.3) + time * 0.15)
    ) * 0.02;
    vec2 warpedSampleUV = sampleUV + warp;

    // Sample noise for ray occlusion
    float noiseSample = snoise(warpedSampleUV * 6.0 + time * 0.25) * 0.5 + 0.5;
    noiseSample = pow(noiseSample, 0.8);

    illumination += noiseSample * weight;
    weight *= decay;
  }

  // Fade rays with depth (rays disappear underwater)
  float depthFade = 1.0 - smoothstep(0.1, 0.6, depth);
  return illumination * depthFade / float(samples);
}

// Simplified god rays (faster, less samples)
float godRaysSimple(vec2 uv, vec2 lightPos, float depth, float time) {
  return volumetricRays(uv, lightPos, depth, time, 16, 0.8, 0.95);
}

// High quality god rays
float godRaysHQ(vec2 uv, vec2 lightPos, float depth, float time) {
  return volumetricRays(uv, lightPos, depth, time, 32, 0.6, 0.97);
}
`;

// =============================================================================
// BIOLUMINESCENT GRAIN
// =============================================================================

/**
 * Animated organic particles that respond to depth and attention
 * Requires: GLSL_SIMPLEX_2D from noise.ts
 */
export const GLSL_BIO_GRAIN = /* glsl */ `
// Bioluminescent grain effect
// Returns color contribution to add to final color
vec3 bioGrain(
  vec2 uv,
  float time,
  float attention,
  float attentionVelocity,
  float depth,
  vec3 cyanColor,
  vec3 amberColor
) {
  // Base grain layer (fine noise)
  float grain = snoise(uv * 25.0 + time * 0.3) * 0.5 + 0.5;

  // Sparkle layer (rare bright points)
  float sparkle = pow(snoise(uv * 50.0 + time * 0.8) * 0.5 + 0.5, 6.0);

  // Bioluminescence triggers
  float bioTrigger = smoothstep(0.3, 0.8, attention);
  float depthGlow = smoothstep(0.5, 1.0, depth) * 0.5;

  // Combined intensity
  float intensity = grain * 0.015 + sparkle * (bioTrigger + depthGlow) * 0.04;

  // Color based on attention velocity
  // Rising attention = cyan (awakening)
  // Falling attention = amber (settling)
  vec3 bioColor = attentionVelocity > 0.0 ? cyanColor : amberColor;
  float colorBlend = abs(attentionVelocity) * 2.0;

  return bioColor * intensity * (0.5 + colorBlend * 0.5);
}

// Simplified grain (no attention tracking)
vec3 bioGrainSimple(vec2 uv, float time, float depth, vec3 color) {
  float grain = snoise(uv * 30.0 + time * 0.2) * 0.5 + 0.5;
  float sparkle = pow(snoise(uv * 60.0 + time * 0.5) * 0.5 + 0.5, 8.0);
  float depthGlow = smoothstep(0.3, 0.8, depth);
  float intensity = grain * 0.01 + sparkle * depthGlow * 0.03;
  return color * intensity;
}
`;

// =============================================================================
// MEMBRANE TEXTURE
// =============================================================================

/**
 * Cellular membrane pattern (Ganzfeld effect at depth)
 */
export const GLSL_MEMBRANE = /* glsl */ `
// Membrane cell texture
// Cells EXPAND with depth (dissolution effect)
float membraneTexture(vec2 p, float time, float depth, float attention) {
  // Scale decreases with depth (cells expand)
  float scale = 8.0 - depth * 5.0;
  scale = max(scale, 2.0);

  // Voronoi-based cells
  vec3 v = voronoi(p * scale, time * 0.3);

  // Edge detection
  float edge = v.y - v.x;

  // Sharpness decreases with depth (softer at deep levels)
  float sharpness = 1.0 - depth * 0.6;
  edge = smoothstep(0.0, 0.1 * sharpness, edge);

  // Visibility: 3-5% base + attention boost
  float visibility = 0.03 + attention * 0.02;

  return edge * visibility;
}
`;

// =============================================================================
// RIPPLE WAVES
// =============================================================================

/**
 * Analytical ripple waves (not GPGPU, simpler)
 */
export const GLSL_RIPPLES = /* glsl */ `
// Single ripple wave
float ripple(vec2 uv, vec2 center, float time, float speed, float frequency, float decay) {
  float dist = length(uv - center);
  float wave = sin(dist * frequency - time * speed);
  float envelope = exp(-dist * decay) * exp(-time * 0.5);
  return wave * envelope;
}

// Multiple ripples from array of centers
float multiRipple(vec2 uv, float time) {
  float result = 0.0;

  // Hardcoded ripple centers (could be uniform array)
  vec2 centers[4];
  centers[0] = vec2(0.3, 0.3);
  centers[1] = vec2(0.7, 0.4);
  centers[2] = vec2(0.5, 0.7);
  centers[3] = vec2(0.2, 0.6);

  for (int i = 0; i < 4; i++) {
    float delay = float(i) * 0.5;
    float t = max(0.0, time - delay);
    result += ripple(uv, centers[i], t, 3.0, 30.0, 3.0);
  }

  return result * 0.25;
}

// Impact flash at ripple origin
float impactFlash(vec2 uv, vec2 center, float age, float velocity) {
  float dist = length(uv - center);
  float radius = age * velocity;
  float flash = smoothstep(radius + 0.02, radius, dist);
  flash *= exp(-age * 8.0);  // Quick fade
  return flash;
}
`;

// =============================================================================
// BUNDLED EXPORTS
// =============================================================================

/**
 * Caustics only
 */
export const GLSL_EFFECTS_CAUSTICS = GLSL_CAUSTICS;

/**
 * Atmospheric effects (god rays + grain)
 */
export const GLSL_EFFECTS_ATMOSPHERE = [GLSL_GOD_RAYS, GLSL_BIO_GRAIN].join('\n');

/**
 * Full effects bundle
 */
export const GLSL_EFFECTS_FULL = [
  GLSL_CAUSTICS,
  GLSL_GOD_RAYS,
  GLSL_BIO_GRAIN,
  GLSL_MEMBRANE,
  GLSL_RIPPLES,
].join('\n');
