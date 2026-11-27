import * as THREE from 'three';

const TAU = Math.PI * 2;
const FOUR_PI = Math.PI * 4;

// True Sculptural Horizontal Möbius proportions: 30% slimmer ribbon (0.84 total width vs prior 1.20)
// keeps the 180-deg flat-band S-twist silhouette razor-sharp while feeling sleek and agile.
const RING_RADIUS = 1.54;
const BAND_HALF_WIDTH = 0.42;
const FLAT_LENGTH = 5.60;

/**
 * Evaluates closed horizontal circular Möbius centerline & twisted frame for sLoop in [0, 1] (u in [0, 4*PI]).
 */
function sampleClosedHorizontalMobius(sLoop, outCenter, outU1, outU2) {
  const phi = FOUR_PI * sLoop;
  const psi = TAU * sLoop + Math.PI * 0.5;

  const sp = Math.sin(phi);
  const cp = Math.cos(phi);
  outCenter.set(RING_RADIUS * sp, 0, -RING_RADIUS * cp);

  const rOutX = sp;
  const rOutZ = -cp;
  const sinPsi = Math.sin(psi);
  const cosPsi = Math.cos(psi);

  outU1.set(rOutX * sinPsi, cosPsi, rOutZ * sinPsi).normalize();
  outU2.set(-rOutX * cosPsi, sinPsi, -rOutZ * cosPsi).normalize();
}

/**
 * CPU counterpart to GPU evalPaperFrame(s, bend, twist), s in [-0.5, +0.5].
 */
function sampleBendingPaperFrame(s, bend, twist, outCenter, outU1, outU2) {
  const circleLen = TAU * RING_RADIUS;
  const L = THREE.MathUtils.lerp(FLAT_LENGTH, circleLen, bend);

  let rOutX = 0;
  let rOutZ = -1;

  if (bend < 0.0005) {
    outCenter.set(s * L, 0, 0);
  } else {
    const phi = TAU * bend * s;
    const r = L / (TAU * bend);
    const sp = Math.sin(phi);
    const cp = Math.cos(phi);
    outCenter.set(r * sp, 0, r * (1 - cp) - RING_RADIUS * bend);
    rOutX = sp;
    rOutZ = -cp;
  }

  const psi = Math.PI * twist * (s + 0.5);
  const sinPsi = Math.sin(psi);
  const cosPsi = Math.cos(psi);

  outU1.set(rOutX * sinPsi, cosPsi, rOutZ * sinPsi).normalize();
  outU2.set(-rOutX * cosPsi, sinPsi, -rOutZ * cosPsi).normalize();
}

const GLSL_EVAL_PAPER_FRAME = `
  void evalPaperFrame(float s, float bend, float twist, out vec3 center, out vec3 u1, out vec3 u2) {
    float circleLen = 6.283185307 * 1.54;
    float L = mix(5.60, circleLen, bend);
    float rOutX = 0.0;
    float rOutZ = -1.0;

    if (bend < 0.001) {
      center = vec3(s * L, 0.0, 0.0);
    } else {
      float phi = 6.283185307 * bend * s;
      float r = L / (6.283185307 * bend);
      float sp = sin(phi);
      float cp = cos(phi);
      center = vec3(r * sp, 0.0, r * (1.0 - cp) - 1.54 * bend);
      rOutX = sp;
      rOutZ = -cp;
    }

    float psi = 3.141592654 * twist * (s + 0.5);
    float sinPsi = sin(psi);
    float cosPsi = cos(psi);
    u1 = normalize(vec3(rOutX * sinPsi, cosPsi, rOutZ * sinPsi));
    u2 = normalize(vec3(-rOutX * cosPsi, sinPsi, -rOutZ * cosPsi));
  }
`;

/**
 * 0. Deep Starry Cosmic Void ("không gian tinh không") twinkling field
 */
function buildCosmicVoidStars() {
  const count = 440;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const tints = new Float32Array(count * 3);

  const hash = (i, k) => {
    const x = Math.sin(i * 193.7 + k * 419.3) * 43758.5453;
    return x - Math.floor(x);
  };

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (hash(i, 1) - 0.5) * 18.0;
    positions[i * 3 + 1] = (hash(i, 2) - 0.5) * 12.0;
    positions[i * 3 + 2] = -2.2 - hash(i, 3) * 10.5;
    sizes[i] = 10.0 + Math.pow(hash(i, 4), 2.4) * 34.0;
    phases[i] = hash(i, 5) * TAU;

    const palettePick = hash(i, 6);
    if (palettePick < 0.55) {
      tints[i * 3] = 0.72; tints[i * 3 + 1] = 0.90; tints[i * 3 + 2] = 1.0; // icy cyan-white
    } else if (palettePick < 0.85) {
      tints[i * 3] = 0.96; tints[i * 3 + 1] = 0.88; tints[i * 3 + 2] = 0.68; // faint gold
    } else {
      tints[i * 3] = 0.70; tints[i * 3 + 1] = 0.58; tints[i * 3 + 2] = 0.98; // stone ocean violet
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geo.setAttribute('aTint', new THREE.BufferAttribute(tints, 3));
  return geo;
}

/**
 * 1A. Expressive 3D Catmull-Rom Calligraphy Curve & Bishop/Parallel-Transport Frame Table
 * Act I (0.00 -> 0.42): Serpentine 3D S-curve descent in starry space
 * Act II (0.42 -> 0.80): Sweeping horizontal cosmic loom arcs across the paper zone
 * Act III (0.80 -> 1.00): Graceful overhead dive cleanly onto center (0, 0, 0.03)
 */
function createPreludeCurveData() {
  const controlPoints = [
    new THREE.Vector3(0.25, 2.38, -0.25),
    new THREE.Vector3(-0.78, 2.02, 0.34),
    new THREE.Vector3(-1.74, 1.54, 0.58),
    new THREE.Vector3(0.22, 1.24, 0.16),
    new THREE.Vector3(1.66, 0.96, -0.32),
    new THREE.Vector3(-1.38, 0.58, 0.72),
    new THREE.Vector3(1.88, 0.38, 0.34),
    new THREE.Vector3(2.68, 0.10, 0.46),
    new THREE.Vector3(1.18, -0.44, 0.64),
    new THREE.Vector3(-0.52, 0.34, 0.56),
    new THREE.Vector3(-2.62, -0.12, 0.36),
    new THREE.Vector3(-1.92, 0.66, -0.22),
    new THREE.Vector3(1.48, 0.86, 0.26),
    new THREE.Vector3(0.86, 1.12, 0.44),
    new THREE.Vector3(-0.34, 0.58, 0.36),
    new THREE.Vector3(0.14, 0.24, 0.16),
    new THREE.Vector3(0.0, 0.0, 0.03),
  ];

  const curve = new THREE.CatmullRomCurve3(controlPoints, false, 'centripetal', 0.5);
  const segs = 480;
  const count = segs + 1;

  const points = new Array(count);
  const tangents = new Array(count);
  const normals = new Array(count);
  const binormals = new Array(count);

  const tmp = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  for (let i = 0; i <= segs; i++) {
    const p = i / segs;
    points[i] = curve.getPointAt(p);
    tangents[i] = curve.getTangentAt(p).normalize();

    if (i === 0) {
      const ref = Math.abs(tangents[0].z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
      normals[0] = ref.clone().addScaledVector(tangents[0], -ref.dot(tangents[0])).normalize();
      binormals[0] = tmp.crossVectors(tangents[0], normals[0]).clone().normalize();
    } else {
      quat.setFromUnitVectors(tangents[i - 1], tangents[i]);
      normals[i] = normals[i - 1].clone().applyQuaternion(quat).normalize();
      // Re-orthogonalize against current tangent to prevent numerical drift
      normals[i].addScaledVector(tangents[i], -normals[i].dot(tangents[i])).normalize();
      binormals[i] = tmp.crossVectors(tangents[i], normals[i]).clone().normalize();
    }
  }

  function samplePoint(p, outVec) {
    const clamped = THREE.MathUtils.clamp(p, 0, 1);
    const fIdx = clamped * segs;
    const i0 = Math.min(segs - 1, Math.floor(fIdx));
    const frac = fIdx - i0;
    return outVec.copy(points[i0]).lerp(points[i0 + 1], frac);
  }

  return { segs, count, points, tangents, normals, binormals, samplePoint };
}

/**
 * 1B. 5-Strand Undulating Calligraphic Silk Bundle (1 hero ribbon + 4 helical aura wisps)
 */
function buildUndulatingPreludeGeometry(curveData) {
  const { segs, count, points, normals, binormals } = curveData;
  const strandConfigs = [
    { halfW: 0.056, orbitRadius: 0.0, freq: 0.0, phase: 0.0, normIdx: 0.0 },
    { halfW: 0.025, orbitRadius: 0.145, freq: 5.5, phase: 0.4, normIdx: 0.25 },
    { halfW: 0.021, orbitRadius: 0.115, freq: -7.0, phase: 2.1, normIdx: 0.50 },
    { halfW: 0.019, orbitRadius: 0.16, freq: 4.5, phase: 3.9, normIdx: 0.75 },
    { halfW: 0.017, orbitRadius: 0.085, freq: -8.5, phase: 5.2, normIdx: 1.0 },
  ];

  const strandCount = strandConfigs.length;
  const vertsPerStrand = count * 2;
  const totalVerts = strandCount * vertsPerStrand;

  const posArr = new Float32Array(totalVerts * 3);
  const normArr = new Float32Array(totalVerts * 3);
  const binormArr = new Float32Array(totalVerts * 3);
  const metaArr = new Float32Array(totalVerts * 4); // p, side, strandNorm, phase
  const indices = [];

  const centerP = new THREE.Vector3();
  const vPos = new THREE.Vector3();
  let vIdx = 0;

  for (let st = 0; st < strandCount; st++) {
    const cfg = strandConfigs[st];
    const baseV = vIdx;

    for (let i = 0; i <= segs; i++) {
      const p = i / segs;
      const basePt = points[i];
      const nVec = normals[i];
      const bVec = binormals[i];

      // Taper spiral radius smoothly to zero near ends so all strands converge on impact
      const endTaper = Math.sin(Math.min(1, p / 0.96) * Math.PI);
      const radius = cfg.orbitRadius * Math.pow(Math.max(0, endTaper), 0.75);
      const angle = p * TAU * cfg.freq + cfg.phase;

      centerP.copy(basePt);
      if (radius > 0.0001) {
        centerP.addScaledVector(nVec, Math.cos(angle) * radius).addScaledVector(bVec, Math.sin(angle) * radius);
      }

      const tipTaper = 0.65 + 0.35 * Math.sin(p * Math.PI);
      const hw = cfg.halfW * tipTaper;

      for (let side = -1; side <= 1; side += 2) {
        vPos.copy(centerP).addScaledVector(nVec, side * hw);
        posArr[vIdx * 3] = vPos.x;
        posArr[vIdx * 3 + 1] = vPos.y;
        posArr[vIdx * 3 + 2] = vPos.z;

        normArr[vIdx * 3] = nVec.x;
        normArr[vIdx * 3 + 1] = nVec.y;
        normArr[vIdx * 3 + 2] = nVec.z;

        binormArr[vIdx * 3] = bVec.x;
        binormArr[vIdx * 3 + 1] = bVec.y;
        binormArr[vIdx * 3 + 2] = bVec.z;

        metaArr[vIdx * 4] = p;
        metaArr[vIdx * 4 + 1] = side;
        metaArr[vIdx * 4 + 2] = cfg.normIdx;
        metaArr[vIdx * 4 + 3] = cfg.phase;
        vIdx++;
      }
    }

    for (let i = 0; i < segs; i++) {
      const a = baseV + i * 2;
      const b = a + 2;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  geo.setAttribute('aBinorm', new THREE.BufferAttribute(binormArr, 3));
  geo.setAttribute('aRibbonMeta', new THREE.BufferAttribute(metaArr, 4));
  geo.setIndex(indices);
  return geo;
}

/**
 * 2. Rectangular Parchment Paper Strip curving & flipping 180 deg into Round Horizontal Paper Möbius.
 */
function buildPaperStripGeometry() {
  const sSegs = 260;
  const wSegs = 22;
  const vCount = (sSegs + 1) * (wSegs + 1);
  const posArr = new Float32Array(vCount * 3);
  const uvArr = new Float32Array(vCount * 2);

  let p3 = 0;
  let p2 = 0;
  for (let is = 0; is <= sSegs; is++) {
    const s = is / sSegs - 0.5;
    for (let iw = 0; iw <= wSegs; iw++) {
      const w = (iw / wSegs) * 2 - 1;
      posArr[p3] = s * FLAT_LENGTH;
      posArr[p3 + 1] = w * BAND_HALF_WIDTH;
      posArr[p3 + 2] = 0;
      uvArr[p2] = s;
      uvArr[p2 + 1] = w;
      p3 += 3;
      p2 += 2;
    }
  }

  const indices = [];
  const stride = wSegs + 1;
  for (let is = 0; is < sSegs; is++) {
    for (let iw = 0; iw < wSegs; iw++) {
      const a = is * stride + iw;
      const b = (is + 1) * stride + iw;
      const c = (is + 1) * stride + (iw + 1);
      const d = is * stride + (iw + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('aStripUv', new THREE.BufferAttribute(uvArr, 2));
  geo.setIndex(indices);
  return geo;
}

/**
 * 3. Luminous 3D Tracing Filament racing across the 4*PI bending/folded Paper Möbius centerline.
 */
function buildTraceFilamentGeometry() {
  const segs = 360;
  const vCount = (segs + 1) * 2;
  const posArr = new Float32Array(vCount * 3);
  const metaArr = new Float32Array(vCount * 2);
  const indices = [];

  for (let i = 0; i <= segs; i++) {
    const sLoop = i / segs;
    for (let k = 0; k < 2; k++) {
      const idx = i * 2 + k;
      posArr[idx * 3] = 0;
      posArr[idx * 3 + 1] = 0;
      posArr[idx * 3 + 2] = 0;
      metaArr[idx * 2] = sLoop;
      metaArr[idx * 2 + 1] = k === 0 ? -1 : 1;
    }
    if (i < segs) {
      const a = i * 2;
      const b = a + 2;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('aTraceMeta', new THREE.BufferAttribute(metaArr, 2));
  geo.setIndex(indices);
  return geo;
}

/**
 * 4A. Core Flat-Sheet Sculptural Möbius Ribbon (2*PI half-twist, zero seam, two-tone side shading).
 */
function buildCoreRoundMobiusGeometry() {
  const uSegs = 360;
  const wSegs = 26;
  const vCount = (uSegs + 1) * (wSegs + 1);

  const posArr = new Float32Array(vCount * 3);
  const normArr = new Float32Array(vCount * 3);
  const uvArr = new Float32Array(vCount * 2);

  const c = new THREE.Vector3();
  const u1 = new THREE.Vector3();
  const u2 = new THREE.Vector3();
  const p = new THREE.Vector3();

  let p3 = 0;
  let p2 = 0;
  for (let iu = 0; iu <= uSegs; iu++) {
    const tNorm = iu / uSegs;
    const sLoop = tNorm * 0.5;
    sampleClosedHorizontalMobius(sLoop, c, u1, u2);

    for (let iw = 0; iw <= wSegs; iw++) {
      const w = (iw / wSegs) * 2 - 1;
      p.copy(c).addScaledVector(u1, w * BAND_HALF_WIDTH);

      posArr[p3] = p.x;
      posArr[p3 + 1] = p.y;
      posArr[p3 + 2] = p.z;
      normArr[p3] = u2.x;
      normArr[p3 + 1] = u2.y;
      normArr[p3 + 2] = u2.z;
      uvArr[p2] = tNorm;
      uvArr[p2 + 1] = w;
      p3 += 3;
      p2 += 2;
    }
  }

  const indices = [];
  const stride = wSegs + 1;
  for (let iu = 0; iu < uSegs; iu++) {
    for (let iw = 0; iw < wSegs; iw++) {
      const a = iu * stride + iw;
      const b = (iu + 1) * stride + iw;
      const cIdx = (iu + 1) * stride + (iw + 1);
      const d = iu * stride + (iw + 1);
      indices.push(a, b, d, b, cIdx, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  geo.setAttribute('aUv', new THREE.BufferAttribute(uvArr, 2));
  geo.setIndex(indices);
  return geo;
}

/**
 * 4B. 56 Sheet-Bound Woven Stone Free Filaments + 2 Glowing 4*PI Boundary Rim Cords.
 * Strictly flat along the Möbius sheet (tiny normal displacement) so the flat twisted ribbon silhouette
 * never puffs into a cylindrical donut!
 */
function buildSheetWovenStrandsGeometry() {
  const innerStrandCount = 56;
  const rimStrandCount = 2; // w = +0.98 and w = -0.98 across 0..4*PI
  const totalStrands = innerStrandCount + rimStrandCount;
  const uSegs = 260;
  const vertsPerStrand = (uSegs + 1) * 2;
  const totalVerts = totalStrands * vertsPerStrand;

  const posArr = new Float32Array(totalVerts * 3);
  const normArr = new Float32Array(totalVerts * 3);
  const metaArr = new Float32Array(totalVerts * 4); // sLoop, side, seed, speedMult + isRim flag (>= 1.5)
  const indices = [];

  const c = new THREE.Vector3();
  const u1 = new THREE.Vector3();
  const u2 = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const p = new THREE.Vector3();

  const hash = (i, k) => {
    const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  let vIdx = 0;

  for (let st = 0; st < totalStrands; st++) {
    const isRim = st >= innerStrandCount;
    const seed = isRim ? 1.5 + (st - innerStrandCount) * 0.25 : st / innerStrandCount;
    const phase0 = hash(st, 3) * TAU;
    const weaveAmp = isRim ? 0 : 0.14 + hash(st, 2) * 0.36;
    const baseRatio = (hash(st, 1) * 2 - 1) * 0.88;
    const ribbonHalfW = isRim ? 0.026 : 0.012 + hash(st, 4) * 0.009;
    const speedMult = isRim ? 1.25 : 0.82 + hash(st, 5) * 0.56;

    const baseV = vIdx;
    for (let iu = 0; iu <= uSegs; iu++) {
      const sLoop = iu / uSegs;
      sampleClosedHorizontalMobius(sLoop, c, u1, u2);

      // Lateral weave stays bound cleanly inside [-0.96*H, +0.96*H] on the sheet and closes at sLoop=1
      let wNorm;
      let liftSpan;
      if (isRim) {
        wNorm = st === innerStrandCount ? 0.985 : -0.985;
        liftSpan = 0.008;
      } else {
        wNorm = THREE.MathUtils.clamp(
          baseRatio * Math.cos(TAU * sLoop) + weaveAmp * Math.sin(FOUR_PI * sLoop + phase0),
          -0.93,
          0.93
        );
        // Very tight normal relief (0.014 max) keeps the ribbon undeniably flat like a sheet of threads
        liftSpan = 0.014 * Math.sin(TAU * 3 * sLoop + phase0);
      }

      offset.copy(c).addScaledVector(u1, wNorm * BAND_HALF_WIDTH).addScaledVector(u2, liftSpan);

      for (let side = -1; side <= 1; side += 2) {
        p.copy(offset).addScaledVector(u1, side * ribbonHalfW);
        posArr[vIdx * 3] = p.x;
        posArr[vIdx * 3 + 1] = p.y;
        posArr[vIdx * 3 + 2] = p.z;

        normArr[vIdx * 3] = u2.x;
        normArr[vIdx * 3 + 1] = u2.y;
        normArr[vIdx * 3 + 2] = u2.z;

        metaArr[vIdx * 4] = sLoop;
        metaArr[vIdx * 4 + 1] = side;
        metaArr[vIdx * 4 + 2] = seed;
        metaArr[vIdx * 4 + 3] = speedMult;
        vIdx++;
      }
    }

    for (let iu = 0; iu < uSegs; iu++) {
      const a = baseV + iu * 2;
      const b = a + 2;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
  geo.setAttribute('aMeta', new THREE.BufferAttribute(metaArr, 4));
  geo.setIndex(indices);
  return geo;
}

/**
 * 5. Hero Circular-Halo 4-Point Sparkles, Prelude Trail Dust, Dual-End Charge Glints & Bokeh.
 */
function buildSparkleField(tiltGroup, preludeCurve) {
  const starSpecs = [];
  const c = new THREE.Vector3();
  const u1 = new THREE.Vector3();
  const u2 = new THREE.Vector3();
  const worldVec = new THREE.Vector3();
  const preludeVec = new THREE.Vector3();

  // Index 0: Lead weaving / diving / tracing star glint
  starSpecs.push({ type: 'leadTip', size: 146, phase: 0.2, kind: 1.0 });

  // Index 1-2: Twin symmetrical energy charge glints racing toward paper ends (5.45s -> 7.00s)
  starSpecs.push({ type: 'chargeTip', sign: 1, size: 64, phase: 0.7, kind: 1.0 });
  starSpecs.push({ type: 'chargeTip', sign: -1, size: 64, phase: 2.3, kind: 1.0 });

  // Index 3-26: 24 stardust sparkles floating along the undulating prelude silk ribbon
  const preludeDustCount = 24;
  for (let i = 0; i < preludeDustCount; i++) {
    const pSlot = (i + 0.5) / preludeDustCount;
    const ang = i * 2.39996; // golden angle scatter
    const rad = 0.08 + (i % 4) * 0.045;
    starSpecs.push({
      type: 'preludeDust',
      pSlot,
      ox: Math.cos(ang) * rad,
      oy: Math.sin(ang) * rad,
      oz: Math.sin(ang * 1.7) * rad,
      size: 32 + (i % 5) * 10,
      phase: i * 0.91,
      kind: i % 6 === 0 ? 1.0 : 0.0,
    });
  }

  // High-visibility circular-halo 4-point sparkles along rim & sheet
  const rimAnchors = [0.04, 0.13, 0.22, 0.28, 0.38, 0.48, 0.56, 0.66, 0.75, 0.84, 0.92, 0.98];
  rimAnchors.forEach((sLoop, idx) => {
    starSpecs.push({
      type: 'ringStar',
      sLoop,
      lat: (idx % 2 === 0 ? 0.94 : -0.94) * BAND_HALF_WIDTH,
      size: 86 + (idx % 3) * 14,
      phase: idx * 0.88,
      kind: 1.0,
    });
  });

  // Flowing pinpoint anime sparks riding along the 4*PI sheet strands
  const microCount = 72;
  for (let i = 0; i < microCount; i++) {
    starSpecs.push({
      type: 'flowMicro',
      sLoop: i / microCount,
      lat: (((i % 9) - 4) / 4.2) * BAND_HALF_WIDTH,
      size: 24 + (i % 5) * 9,
      phase: i * 0.61,
      speed: 0.08 + (i % 4) * 0.025,
      kind: 0.0,
    });
  }

  // Atmospheric out-of-focus sapphire bokeh orbs
  const bokehCount = 12;
  for (let i = 0; i < bokehCount; i++) {
    const bx = (((i * 73) % 100) / 100 - 0.5) * 7.2;
    const by = (((i * 41) % 100) / 100 - 0.5) * 4.8;
    starSpecs.push({
      type: 'bokeh',
      baseX: bx,
      baseY: by,
      baseZ: -2.0 - (i % 4) * 0.5,
      size: 112 + (i % 4) * 44,
      phase: i * 1.25,
      kind: 2.0,
    });
  }

  const count = starSpecs.length;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const kinds = new Float32Array(count);

  starSpecs.forEach((sp, i) => {
    sizes[i] = sp.size;
    alphas[i] = 1.0;
    kinds[i] = sp.kind;
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geo.setAttribute('aKind', new THREE.BufferAttribute(kinds, 1));

  function updateField({
    uPreludeHead,
    uPreludeTail,
    uDropFade,
    uPaperCharge,
    uBend,
    uTwist,
    uTrace,
    uPaperOpacity,
    uTransmute,
    uThreadOpacity,
    time,
  }) {
    const posAttr = geo.attributes.position;
    const alphaAttr = geo.attributes.aAlpha;
    tiltGroup.updateMatrixWorld();

    for (let i = 0; i < count; i++) {
      const sp = starSpecs[i];
      if (sp.type === 'leadTip') {
        if (uTrace < 0.002 && uThreadOpacity < 0.02) {
          if (uPreludeHead < 0.999) {
            preludeCurve.samplePoint(uPreludeHead, preludeVec);
            posAttr.setXYZ(i, preludeVec.x, preludeVec.y, preludeVec.z + 0.10);
            const gate = THREE.MathUtils.smoothstep(uPreludeHead, 0.01, 0.08);
            alphaAttr.setX(i, gate * uDropFade * (0.88 + 0.12 * Math.sin(time * 9.0)));
          } else {
            // Pulse brightly at parchment center after thread impact before Möbius trace starts
            const preFoldFade = 1.0 - THREE.MathUtils.smoothstep(uPaperCharge, 0.72, 1.0);
            posAttr.setXYZ(i, 0, 0, 0.14);
            alphaAttr.setX(i, preFoldFade * (0.65 + 0.35 * Math.sin(time * 8.0)));
          }
        } else {
          let sPaper = 0;
          let sideSign = 1;
          if (uTrace < 0.25) {
            sPaper = uTrace * 2.0;
            sideSign = 1;
          } else if (uTrace < 0.75) {
            sPaper = (uTrace - 0.5) * 2.0;
            sideSign = -1;
          } else {
            sPaper = (uTrace - 1.0) * 2.0;
            sideSign = 1;
          }
          sampleBendingPaperFrame(sPaper, uBend, uTwist, c, u1, u2);
          worldVec.copy(c).addScaledVector(u2, sideSign * 0.035).applyMatrix4(tiltGroup.matrixWorld);
          posAttr.setXYZ(i, worldVec.x, worldVec.y, worldVec.z + 0.08);
          const traceAlpha = Math.max(uPaperOpacity, uThreadOpacity * 0.9);
          alphaAttr.setX(i, traceAlpha * (0.85 + 0.15 * Math.sin(time * 9.0)));
        }
      } else if (sp.type === 'chargeTip') {
        if (uPaperCharge > 0.01 && uBend < 0.15) {
          const sPaper = sp.sign * uPaperCharge * 0.5;
          sampleBendingPaperFrame(sPaper, 0, 0, c, u1, u2);
          worldVec.copy(c).addScaledVector(u2, 0.05).applyMatrix4(tiltGroup.matrixWorld);
          posAttr.setXYZ(i, worldVec.x, worldVec.y, worldVec.z + 0.06);
          const fadeOut = 1.0 - THREE.MathUtils.smoothstep(uBend, 0.0, 0.14);
          const endGlow = THREE.MathUtils.smoothstep(uPaperCharge, 0.0, 0.12) * fadeOut;
          alphaAttr.setX(i, endGlow * (0.78 + 0.22 * Math.sin(time * 7.0 + sp.phase)));
        } else {
          posAttr.setXYZ(i, 0, 0, -20);
          alphaAttr.setX(i, 0);
        }
      } else if (sp.type === 'preludeDust') {
        if (uDropFade > 0.02 && sp.pSlot <= uPreludeHead && sp.pSlot >= uPreludeTail - 0.04) {
          preludeCurve.samplePoint(sp.pSlot, preludeVec);
          const driftX = sp.ox + Math.sin(time * 2.2 + sp.phase) * 0.05;
          const driftY = sp.oy + Math.cos(time * 1.9 + sp.phase) * 0.05;
          posAttr.setXYZ(i, preludeVec.x + driftX, preludeVec.y + driftY, preludeVec.z + sp.oz);
          const headGate = THREE.MathUtils.smoothstep(uPreludeHead - sp.pSlot, 0.0, 0.06);
          const tailGate = THREE.MathUtils.smoothstep(sp.pSlot - (uPreludeTail - 0.04), 0.0, 0.09);
          const twinkle = 0.5 + 0.5 * Math.sin(time * 5.2 + sp.phase);
          alphaAttr.setX(i, uDropFade * headGate * tailGate * twinkle * 0.88);
        } else {
          posAttr.setXYZ(i, 0, 0, -20);
          alphaAttr.setX(i, 0);
        }
      } else if (sp.type === 'ringStar') {
        const curLoop = (sp.sLoop + time * 0.038) % 1;
        sampleClosedHorizontalMobius(curLoop, c, u1, u2);
        worldVec.copy(c).addScaledVector(u1, sp.lat).addScaledVector(u2, 0.04).applyMatrix4(tiltGroup.matrixWorld);
        posAttr.setXYZ(i, worldVec.x, worldVec.y, worldVec.z);
        // Keep floor brightness >= 0.48 so key stars never all blink dark simultaneously
        const pulse = 0.48 + 0.52 * (0.5 + 0.5 * Math.sin(time * 2.5 + sp.phase));
        const transmuteBoost = uTransmute > 0.01 && uTransmute < 0.99 ? Math.sin(uTransmute * Math.PI) * 0.45 : 0;
        alphaAttr.setX(i, Math.min(1.0, Math.max(uThreadOpacity, transmuteBoost) * pulse));
      } else if (sp.type === 'flowMicro') {
        const curLoop = (sp.sLoop + time * sp.speed) % 1;
        sampleClosedHorizontalMobius(curLoop, c, u1, u2);
        worldVec.copy(c).addScaledVector(u1, sp.lat).addScaledVector(u2, 0.03).applyMatrix4(tiltGroup.matrixWorld);
        posAttr.setXYZ(i, worldVec.x, worldVec.y, worldVec.z);
        const pulse = 0.40 + 0.60 * Math.pow(0.5 + 0.5 * Math.sin(time * 4.8 + sp.phase), 2);
        alphaAttr.setX(i, uThreadOpacity * pulse);
      } else {
        posAttr.setXYZ(i, sp.baseX, sp.baseY + Math.sin(time * 0.3 + sp.phase) * 0.08, sp.baseZ);
        alphaAttr.setX(i, 0.16 + 0.08 * Math.sin(time * 0.9 + sp.phase));
      }
    }

    posAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
  }

  return { geo, updateField };
}

/**
 * Creates the Horizontal Sculptural Paper-to-Thread Möbius VFX Stage Controller.
 */
export function createMobiusThreadStage({ canvas, onFormed, onPhaseEvent }) {
  if (!canvas) {
    return {
      start: () => onFormed?.(),
      stop: () => {},
      setPaused: () => {},
      setPaletteTheme: () => {},
      seekToPhase: () => onFormed?.(),
      dispose: () => {},
      getState: () => ({}),
    };
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    console.warn('Mobius WebGL unavailable, falling back directly to invitation reveal:', err);
    return {
      start: () => onFormed?.(),
      stop: () => {},
      setPaused: () => {},
      setPaletteTheme: () => {},
      seekToPhase: () => onFormed?.(),
      dispose: () => {},
      getState: () => ({}),
    };
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 60);

  const tiltGroup = new THREE.Group();
  tiltGroup.rotation.x = 0.28;
  tiltGroup.rotation.y = 0.0;
  tiltGroup.rotation.z = -0.02;
  scene.add(tiltGroup);

  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: dpr },
    uPreludeHead: { value: 0 },
    uPreludeTail: { value: 0 },
    uDropFade: { value: 1 },
    uPaperReveal: { value: 0 },
    uPaperCharge: { value: 0 },
    uImpactWave: { value: 0 },
    uBend: { value: 0 },
    uTwist: { value: 0 },
    uTrace: { value: 0 },
    uSealFlash: { value: 0 },
    uPaperOpacity: { value: 0 },
    uThreadOpacity: { value: 0 },
    uTransmute: { value: 0 },
    uThemeShift: { value: 0 },
  };

  // 0. Deep Starry Cosmic Void ("không gian tinh không")
  const voidStarsGeo = buildCosmicVoidStars();
  const voidStarsMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      attribute vec3 aTint;
      uniform float uTime;
      uniform float uPixelRatio;

      varying float vTwinkle;
      varying vec3 vTint;

      void main() {
        vTint = aTint;
        vTwinkle = 0.45 + 0.55 * sin(uTime * 1.45 + aPhase);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (5.2 / max(2.0, -mvPos.z));
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      varying float vTwinkle;
      varying vec3 vTint;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float core = exp(-d * d * 42.0);
        float crossSpike = (exp(-abs(uv.x) * 32.0) + exp(-abs(uv.y) * 32.0)) * 0.22 * smoothstep(0.48, 0.05, d);
        gl_FragColor = vec4(vTint, clamp((core + crossSpike) * vTwinkle * 0.92, 0.0, 1.0));
      }
    `,
  });
  const voidStarsPoints = new THREE.Points(voidStarsGeo, voidStarsMat);
  voidStarsPoints.frustumCulled = false;
  scene.add(voidStarsPoints);

  // 1. 5-Strand Undulating Calligraphic Silk-Thread Prelude (0.0s -> 7.0s)
  const preludeCurve = createPreludeCurveData();
  const preludeGeo = buildUndulatingPreludeGeometry(preludeCurve);
  const preludeMat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute vec3 aBinorm;
      attribute vec4 aRibbonMeta;
      uniform float uTime;

      varying vec4 vMeta;

      void main() {
        vMeta = aRibbonMeta;
        float p = aRibbonMeta.x;
        float strandNorm = aRibbonMeta.z;
        float phase = aRibbonMeta.w;

        // Taper living silk flutter cleanly to zero at both endpoints so center impact locks onto (0,0,0)
        float env = sin(p * 3.14159265) * smoothstep(1.0, 0.84, p);
        float ampN = (strandNorm < 0.05 ? 0.065 : 0.095) * env;
        float ampB = (strandNorm < 0.05 ? 0.055 : 0.085) * env;

        vec3 flutter = normal * (sin(p * 24.0 - uTime * 5.2 + phase) * ampN)
                     + aBinorm * (cos(p * 19.0 - uTime * 4.4 + phase * 1.3) * ampB);

        vec3 pos = position + flutter;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPreludeHead;
      uniform float uPreludeTail;
      uniform float uDropFade;
      uniform float uThemeShift;
      varying vec4 vMeta;

      void main() {
        float p = vMeta.x;
        float side = vMeta.y;
        float strandNorm = vMeta.z;
        float phase = vMeta.w;
        bool isHero = strandNorm < 0.05;

        if (uDropFade <= 0.005 || p > uPreludeHead || p < uPreludeTail) discard;

        float headGlow = smoothstep(0.06, 0.0, uPreludeHead - p) * smoothstep(1.0, 0.86, uPreludeHead);
        float tailAlpha = uPreludeTail > 0.001 ? smoothstep(uPreludeTail, uPreludeTail + 0.14, p) : 1.0;

        float freqSide = isHero ? 3.0 : 2.0;
        float rib = 0.5 + 0.5 * cos(abs(side) * freqSide * 3.14159265 + 0.45 * sin(p * 18.0 - uTime * 5.6 + phase));
        vec3 colInk = vec3(0.016, 0.063, 0.180);
        vec3 colDeep = mix(vec3(0.04, 0.30, 0.78), vec3(0.32, 0.20, 0.72), uThemeShift);
        vec3 colCyan = mix(vec3(0.16, 0.80, 1.0), vec3(0.50, 0.90, 0.96), uThemeShift);
        vec3 colIce = mix(vec3(0.86, 0.99, 1.0), vec3(0.98, 0.78, 0.90), uThemeShift * 0.55);

        vec3 col = isHero
          ? mix(colInk, colCyan, smoothstep(0.10, 0.62, rib))
          : mix(colDeep, colCyan, 0.38 + 0.62 * rib);
        col = mix(col, colIce, smoothstep(0.76, 1.0, rib) * (isHero ? 0.92 : 0.62) + headGlow * 0.88);

        float edgeFade = smoothstep(1.0, 0.30, abs(side));
        float strandGain = isHero ? 0.96 : 0.68;
        float alpha = uDropFade * tailAlpha * edgeFade * strandGain;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const preludeMesh = new THREE.Mesh(preludeGeo, preludeMat);
  preludeMesh.frustumCulled = false;
  preludeMesh.renderOrder = 5;
  scene.add(preludeMesh);

  // 1C. Concentric Cyan Contact Shock-Ring & Radial Rune Bloom on Center Impact (5.45s -> 7.00s)
  const impactGeo = new THREE.PlaneGeometry(4.8, 4.8);
  const impactMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uImpactWave;
      uniform float uThemeShift;
      varying vec2 vUv;

      void main() {
        if (uImpactWave <= 0.002 || uImpactWave >= 0.998) discard;
        vec2 p = (vUv - 0.5) * 4.8;
        float r = length(p);
        float angle = atan(p.y, p.x);

        float rMain = 0.08 + uImpactWave * 2.15;
        float rEcho = max(0.04, rMain - 0.36);

        float ringMain = exp(-pow((r - rMain) * 14.0, 2.0));
        float ringEcho = exp(-pow((r - rEcho) * 18.0, 2.0)) * 0.55;
        float ticks = pow(0.5 + 0.5 * cos(angle * 12.0), 8.0) * exp(-pow((r - rMain * 0.86) * 20.0, 2.0)) * 0.65;
        float centerFlash = exp(-r * r * 18.0) * (1.0 - smoothstep(0.0, 0.45, uImpactWave));

        float env = sin(uImpactWave * 3.14159265);
        float intensity = (ringMain + ringEcho + ticks + centerFlash) * smoothstep(2.35, 1.55, r) * env;

        vec3 colCyan = mix(vec3(0.20, 0.84, 1.0), vec3(0.92, 0.60, 0.84), uThemeShift * 0.6);
        vec3 colIce = vec3(0.92, 0.99, 1.0);
        vec3 col = mix(colCyan, colIce, clamp(ringMain * 0.6 + centerFlash, 0.0, 1.0));
        gl_FragColor = vec4(col * intensity, clamp(intensity, 0.0, 1.0));
      }
    `,
  });
  const impactMesh = new THREE.Mesh(impactGeo, impactMat);
  impactMesh.position.set(0, 0, 0.12);
  impactMesh.renderOrder = 6;
  tiltGroup.add(impactMesh);

  // 2. Slim (-30% width) Rectangular Parchment Strip with Loom Reveal, Floating Ripple & Twin-End Charge
  const paperGeo = buildPaperStripGeometry();
  const paperMat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    vertexShader: `
      attribute vec2 aStripUv;
      uniform float uTime;
      uniform float uPaperReveal;
      uniform float uPaperCharge;
      uniform float uBend;
      uniform float uTwist;

      varying vec2 vStripUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      ${GLSL_EVAL_PAPER_FRAME}

      void main() {
        vStripUv = aStripUv;
        vec3 center, u1, u2;
        evalPaperFrame(aStripUv.x, uBend, uTwist, center, u1, u2);
        vec3 pos = center + u1 * (aStripUv.y * 0.42);

        // Organic floating ripple while unbent, settling taut just before the 7.0s Möbius fold
        float floatWave = (1.0 - uBend) * uPaperReveal * (1.0 - smoothstep(0.65, 1.0, uPaperCharge));
        pos += u2 * (0.065 * sin(aStripUv.x * 11.0 - uTime * 2.6) * floatWave);

        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        vNormal = normalize(normalMatrix * u2);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPaperReveal;
      uniform float uPaperCharge;
      uniform float uBend;
      uniform float uTrace;
      uniform float uSealFlash;
      uniform float uPaperOpacity;
      uniform float uTransmute;
      uniform float uThemeShift;

      varying vec2 vStripUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        if (uPaperOpacity <= 0.004 || uPaperReveal <= 0.004) discard;

        float s = vStripUv.x;
        float w = vStripUv.y;
        float absS = abs(s);
        float absW = abs(w);

        // Center-outward luminous stardust loom materialize reveal (2.45s -> 4.65s)
        float revealHalf = uPaperReveal * 0.54;
        if (uPaperReveal < 0.999 && absS > revealHalf + 0.045) discard;
        float loomMask = uPaperReveal < 0.999 ? smoothstep(revealHalf + 0.04, revealHalf - 0.06, absS) : 1.0;
        float loomFrontier = uPaperReveal < 0.999
          ? exp(-pow((absS - revealHalf) * 16.0, 2.0)) * smoothstep(0.0, 0.08, uPaperReveal)
          : 0.0;

        // Directional cyan transmutation sweep (dissolves slim paper progressively front-to-back)
        float sweepDist = 1.0 - absS * 2.0; // 0 at joined ends, 1 at back center
        float waveFront = uTransmute * 1.25;
        float waveBand = exp(-pow((sweepDist - waveFront) * 6.5, 2.0)) * smoothstep(0.0, 0.12, uTransmute);
        float dissolved = smoothstep(waveFront - 0.18, waveFront + 0.04, sweepDist);
        float localPaperAlpha = uPaperOpacity * loomMask * (uTransmute > 0.005 ? dissolved : 1.0);
        if (localPaperAlpha <= 0.005 && waveBand <= 0.02 && loomFrontier <= 0.02) discard;

        vec3 N = gl_FrontFacing ? normalize(vNormal) : -normalize(vNormal);
        vec3 L = normalize(vec3(-0.35, 0.72, 0.80));
        // Blend directional lighting cleanly to symmetric wrap near join seam (abs(s) > 0.42) so zero vertical step appears
        float seamBlend = smoothstep(0.38, 0.49, absS) * uBend;
        float rawDot = max(0.0, dot(N, L));
        float wrapDot = abs(dot(N, L));
        float ndotl = 0.52 + 0.48 * mix(rawDot, wrapDot, seamBlend);

        float grain = fract(sin(dot(floor(vec2(s * 280.0, w * 70.0)), vec2(12.9898, 78.233))) * 43758.5453);
        float fiberLine = 0.5 + 0.5 * sin(s * 240.0 + grain * 2.5);

        vec3 frontBase = vec3(0.94, 0.90, 0.82);
        vec3 frontShadow = vec3(0.68, 0.63, 0.54);
        vec3 backBase = vec3(0.72, 0.80, 0.92);
        vec3 backShadow = vec3(0.46, 0.54, 0.67);

        vec3 paperCol = gl_FrontFacing
          ? mix(frontShadow, frontBase, ndotl)
          : mix(backShadow, backBase, ndotl);
        paperCol *= 0.95 + 0.05 * fiberLine;

        // Crisp dark edges & subtle centerline guide
        float edgeRim = smoothstep(0.90, 0.99, absW);
        float dashGuide = smoothstep(0.032, 0.008, absW) * smoothstep(0.2, 0.8, sin(s * 110.0)) * 0.24;
        paperCol = mix(paperCol, vec3(0.18, 0.24, 0.36), edgeRim * 0.72 + dashGuide);

        // Subtle stardust warp/weft loom shimmer while materializing
        float weaveGrid = pow(0.5 + 0.5 * sin(s * 96.0) * cos(w * 20.0), 4.0);
        paperCol += vec3(0.28, 0.88, 1.0) * (loomFrontier * 1.45 + loomFrontier * weaveGrid * 0.5);

        // Symmetrical twin-end tension waves & illuminated calligraphic runes (5.45s -> 7.00s)
        float chargeFront = uPaperCharge * 0.52;
        float chargePulse = uPaperCharge > 0.004 && uPaperCharge < 0.999
          ? exp(-pow((absS - chargeFront) * 20.0, 2.0)) * (1.0 - smoothstep(0.84, 1.0, uPaperCharge))
          : 0.0;
        float chargedBehind = uPaperCharge > 0.004 && absS <= chargeFront ? (1.0 - uBend * 0.65) : 0.0;
        float runeDiamond = smoothstep(0.055, 0.015, absW) * pow(0.5 + 0.5 * cos(s * 75.398), 4.0);
        float endAnchorGlow = smoothstep(0.455, 0.50, absS) * smoothstep(0.55, 0.95, uPaperCharge) * (1.0 - uBend * 0.8);
        vec3 chargeCyan = mix(vec3(0.18, 0.78, 1.0), vec3(0.92, 0.62, 0.86), uThemeShift * 0.5);
        paperCol += chargeCyan * (chargePulse * 0.62 + chargedBehind * runeDiamond * 0.48 + endAnchorGlow * 0.68);

        // Delicate gold-cyan adhesive highlight right at pasted seam
        float endMask = smoothstep(0.465, 0.50, absS) * uBend;
        paperCol += vec3(0.65, 0.92, 1.0) * endMask * (0.18 + 1.15 * uSealFlash);

        // Embedded Stone Free cyan trace along active face
        float activeLoop = -1.0;
        if (gl_FrontFacing) {
          activeLoop = s >= 0.0 ? s * 0.5 : 0.75 + (s + 0.5) * 0.5;
        } else {
          activeLoop = 0.25 + (s + 0.5) * 0.5;
        }
        float traced = uTrace >= activeLoop && uTrace > 0.002 ? 1.0 : 0.0;
        paperCol = mix(paperCol, vec3(0.09, 0.58, 0.98), traced * smoothstep(0.18, 0.0, absW) * 0.65);
        paperCol += vec3(0.50, 0.94, 1.0) * traced * smoothstep(0.06, 0.0, absW) * 0.82;

        // Sweeping cyan transmutation wave glow
        paperCol += vec3(0.32, 0.88, 1.0) * waveBand * 1.45;

        float outAlpha = clamp(localPaperAlpha + loomFrontier * 0.75 + waveBand * 0.65, 0.0, 0.96);
        gl_FragColor = vec4(paperCol, outAlpha);
      }
    `,
  });
  const paperMesh = new THREE.Mesh(paperGeo, paperMat);
  tiltGroup.add(paperMesh);

  // 3. 3D Luminous Tracing Filament on the Active Face
  const traceGeo = buildTraceFilamentGeometry();
  const traceMat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute vec2 aTraceMeta;
      uniform float uBend;
      uniform float uTwist;

      varying vec2 vMeta;

      ${GLSL_EVAL_PAPER_FRAME}

      void main() {
        vMeta = aTraceMeta;
        float lp = aTraceMeta.x;
        float sPaper = 0.0;
        float sideSign = 1.0;

        if (lp < 0.25) {
          sPaper = lp * 2.0;
          sideSign = 1.0;
        } else if (lp < 0.75) {
          sPaper = (lp - 0.5) * 2.0;
          sideSign = -1.0;
        } else {
          sPaper = (lp - 1.0) * 2.0;
          sideSign = 1.0;
        }

        vec3 center, u1, u2;
        evalPaperFrame(sPaper, uBend, uTwist, center, u1, u2);
        vec3 pos = center + u2 * (sideSign * 0.016) + u1 * (aTraceMeta.y * 0.046);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uTrace;
      uniform float uPaperOpacity;
      varying vec2 vMeta;

      void main() {
        if (uPaperOpacity <= 0.005 || vMeta.x > uTrace || uTrace <= 0.002) discard;
        float absSide = abs(vMeta.y);
        float tip = smoothstep(0.035, 0.0, uTrace - vMeta.x);
        float pulse = 0.5 + 0.5 * sin(vMeta.x * 56.0 - uTime * 8.0);
        vec3 colCyan = vec3(0.15, 0.78, 1.0);
        vec3 colCore = vec3(0.90, 0.99, 1.0);
        vec3 col = mix(colCyan, colCore, smoothstep(0.75, 0.0, absSide) * (0.45 + 0.55 * pulse) + tip * 0.8);
        gl_FragColor = vec4(col, uPaperOpacity * smoothstep(1.0, 0.35, absSide));
      }
    `,
  });
  const traceMesh = new THREE.Mesh(traceGeo, traceMat);
  tiltGroup.add(traceMesh);

  // 4A. Core Flat-Sheet Sculptural Möbius Ribbon (two-tone front cyan vs flipped underside sapphire)
  const coreThreadGeo = buildCoreRoundMobiusGeometry();
  const coreThreadMat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true,
    vertexShader: `
      attribute vec2 aUv;
      uniform float uTime;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        vUv = aUv;
        float wave = 0.011 * sin(aUv.x * 18.84955 - uTime * 3.0 + abs(aUv.y) * 2.0);
        vec3 pos = position + normal * wave;
        vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uThreadOpacity;
      uniform float uThemeShift;

      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        if (uThreadOpacity <= 0.004) discard;

        float absW = abs(vUv.y);
        float flowCoord = vUv.x * 18.84955 - uTime * 3.2;
        float fiberA = 0.5 + 0.5 * cos(absW * 18.0 * 3.14159265 + 0.42 * sin(flowCoord));
        float fiberB = 0.5 + 0.5 * sin(absW * 34.0 * 3.14159265 - 0.32 * cos(flowCoord * 2.0));
        float ridge = clamp(fiberA * 0.72 + fiberB * 0.34, 0.0, 1.0);

        vec3 N = gl_FrontFacing ? normalize(vNormal) : -normalize(vNormal);
        vec3 V = normalize(vViewDir);
        vec3 L = normalize(vec3(-0.35, 0.70, 0.82));
        float ndotl = 0.45 + 0.55 * max(0.0, dot(N, L));
        float fresnel = pow(1.0 - max(0.0, abs(dot(N, V))), 2.1);

        // Two-tone Möbius side distinction: gl_FrontFacing brighter electric cyan vs flipped deep royal sapphire
        float sideScale = gl_FrontFacing ? 1.0 : 0.68;
        float energy = (ridge * (0.48 + 0.52 * ndotl) + fresnel * 0.34) * sideScale;

        vec3 colInk = vec3(0.016, 0.055, 0.165);
        vec3 colSapphire = mix(vec3(0.025, 0.11, 0.34), vec3(0.14, 0.08, 0.34), uThemeShift);
        vec3 colCobalt = mix(vec3(0.06, 0.34, 0.76), vec3(0.28, 0.24, 0.82), uThemeShift);
        vec3 colCyan = mix(vec3(0.14, 0.75, 1.0), vec3(0.50, 0.90, 0.95), uThemeShift);
        vec3 colIce = mix(vec3(0.68, 0.97, 1.0), vec3(0.95, 0.65, 0.84), uThemeShift * 0.55);

        vec3 col = mix(colSapphire, colCobalt, smoothstep(0.20, 0.50, energy));
        col = mix(col, colCyan, smoothstep(0.46, 0.78, energy));
        col = mix(col, colIce, smoothstep(0.76, 1.05, energy));

        float inkGroove = smoothstep(0.26, 0.06, ridge);
        float outerContour = smoothstep(0.90, 0.99, absW);
        col = mix(col, colInk, clamp(inkGroove * 0.84 + outerContour * 0.55, 0.0, 0.90));

        float pulse = 0.5 + 0.5 * sin(vUv.x * 25.13274 - uTime * 5.2 + ridge * 3.0);
        col += colCyan * pow(pulse, 5.0) * 0.36;

        float alpha = uThreadOpacity * smoothstep(1.0, 0.94, absW) * 0.95;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const coreThreadMesh = new THREE.Mesh(coreThreadGeo, coreThreadMat);
  tiltGroup.add(coreThreadMesh);

  // 4B. 56 Sheet-Bound Woven Strands + 2 Luminous 4*PI Continuous Edge Rim Cords
  const strandsGeo = buildSheetWovenStrandsGeometry();
  const strandsMat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true,
    vertexShader: `
      attribute vec4 aMeta;
      uniform float uTime;

      varying vec4 vMeta;

      void main() {
        vMeta = aMeta;
        float flutter = (aMeta.z >= 1.4 ? 0.008 : 0.014) * sin(aMeta.x * 37.6991 - uTime * 3.8 * aMeta.w + aMeta.z * 25.0);
        vec3 pos = position + normal * flutter;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uThreadOpacity;
      uniform float uThemeShift;

      varying vec4 vMeta;

      void main() {
        if (uThreadOpacity <= 0.004) discard;

        bool isRim = vMeta.z >= 1.4;
        float flow = 0.5 + 0.5 * sin(vMeta.x * 50.26548 - uTime * 6.0 * vMeta.w + vMeta.z * 19.0);
        float absSide = abs(vMeta.y);
        float coreMask = smoothstep(1.0, 0.22, absSide);
        float inkEdge = smoothstep(0.65, 1.0, absSide);

        vec3 colInk = vec3(0.016, 0.063, 0.180);
        vec3 colDeep = mix(vec3(0.04, 0.24, 0.64), vec3(0.32, 0.18, 0.66), uThemeShift);
        vec3 colCyan = mix(vec3(0.16, 0.80, 1.0), vec3(0.48, 0.90, 0.96), uThemeShift);
        vec3 colHighlight = mix(vec3(0.86, 0.98, 1.0), vec3(0.98, 0.72, 0.88), uThemeShift);

        vec3 col = isRim
          ? mix(colCyan, colHighlight, 0.45 + 0.55 * flow)
          : mix(colDeep, colCyan, 0.36 + 0.58 * flow);
        col = mix(col, colHighlight, pow(flow, isRim ? 1.8 : 3.0) * (isRim ? 0.88 : 0.65) * coreMask);
        if (!isRim) {
          col = mix(col, colInk, inkEdge * 0.82);
        }

        float alpha = uThreadOpacity * smoothstep(1.0, 0.76, absSide) * (isRim ? 0.98 : 0.92);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
  const strandsMesh = new THREE.Mesh(strandsGeo, strandsMat);
  tiltGroup.add(strandsMesh);

  // 5A. Soft Elliptical Glow Ring behind Horizontal Möbius
  const auraGeo = new THREE.PlaneGeometry(5.8, 4.6);
  const auraMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uThreadOpacity;
      uniform float uThemeShift;
      varying vec2 vUv;

      void main() {
        if (uThreadOpacity <= 0.005) discard;
        vec2 p = (vUv - 0.5) * vec2(5.8, 4.6);
        float ringDist = abs(length(p * vec2(1.0, 1.44)) - 1.54);
        float glow = exp(-ringDist * 2.4) * (0.85 + 0.15 * sin(uTime * 1.8));
        vec3 c1 = mix(vec3(0.05, 0.30, 0.82), vec3(0.32, 0.14, 0.62), uThemeShift);
        vec3 c2 = mix(vec3(0.20, 0.78, 1.0), vec3(0.88, 0.50, 0.72), uThemeShift);
        vec3 col = mix(c1, c2, glow);
        float a = glow * 0.42 * uThreadOpacity;
        gl_FragColor = vec4(col * a, a);
      }
    `,
  });
  const auraMesh = new THREE.Mesh(auraGeo, auraMat);
  auraMesh.position.set(0, 0.04, -0.65);
  scene.add(auraMesh);

  // 5B. Hero 4-Point Cross-Star Anime Sparkles + Circular Lens Halos + Bokeh
  const sparkleField = buildSparkleField(tiltGroup, preludeCurve);
  const sparkleMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      attribute float aKind;
      uniform float uPixelRatio;

      varying float vAlpha;
      varying float vKind;

      void main() {
        vAlpha = aAlpha;
        vKind = aKind;
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio * (6.2 / max(1.5, -mvPos.z));
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uThemeShift;
      varying float vAlpha;
      varying float vKind;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;

        if (vKind > 1.5) {
          float orb = smoothstep(0.5, 0.16, d) * smoothstep(0.04, 0.25, d);
          float softCenter = exp(-d * d * 12.0) * 0.45;
          vec3 bCol = mix(vec3(0.14, 0.54, 0.96), vec3(0.64, 0.42, 0.88), uThemeShift);
          gl_FragColor = vec4(bCol, (orb * 0.55 + softCenter) * vAlpha);
          return;
        }

        float hSpike = exp(-abs(uv.y) * 38.0) * smoothstep(0.49, 0.02, abs(uv.x));
        float vSpike = exp(-abs(uv.x) * 38.0) * smoothstep(0.49, 0.02, abs(uv.y));
        float diamondCore = exp(-d * d * 95.0);
        float innerGlow = exp(-d * d * 24.0) * 0.65;

        float ring = 0.0;
        if (vKind > 0.5) {
          float lensOrb = smoothstep(0.42, 0.26, d) * 0.22;
          float outerRim = smoothstep(0.39, 0.34, d) * smoothstep(0.24, 0.31, d) * 0.28;
          ring = lensOrb + outerRim;
        }

        float shape = diamondCore * 1.15 + (hSpike + vSpike) * 0.85 + innerGlow + ring;
        vec3 colCore = vec3(0.96, 0.99, 1.0);
        vec3 colCyan = mix(vec3(0.22, 0.80, 1.0), vec3(0.94, 0.56, 0.78), uThemeShift * 0.65);
        vec3 col = mix(colCyan, colCore, clamp(diamondCore + (hSpike + vSpike) * 0.5, 0.0, 1.0));
        gl_FragColor = vec4(col, clamp(shape * vAlpha, 0.0, 1.0));
      }
    `,
  });
  const sparklePoints = new THREE.Points(sparkleField.geo, sparkleMat);
  sparklePoints.frustumCulled = false;
  sparklePoints.renderOrder = 6;
  scene.add(sparklePoints);

  // Timeline Constants: 7.00s creative undulating-thread prelude BEFORE transitioning to Möbius at 7.00s
  const T_LOOM_START = 2.45;
  const T_LOOM_END = 4.65;
  const T_IMPACT = 5.45;
  const T_PRELUDE_END = 7.00;
  const T_FOLD_END = 9.35;
  const T_TRACE_END = 11.45;
  const T_FADE_END = 13.05;

  let rafId = null;
  let resizeObs = null;
  let running = false;
  let paused = false;
  let formedNotified = false;
  let loomEventFired = false;
  let chargeEventFired = false;
  let foldEventFired = false;
  let traceEventFired = false;
  let baseCamZ = 7.8;
  let lastNow = 0;
  let elapsed = 0;

  // Interactive 3D Drag + Hover Orbit (Approved Enhancement #1)
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let userYaw = 0;
  let userPitch = 0;
  let targetYaw = 0;
  let targetPitch = 0;

  const onPointerDown = (e) => {
    if (!formedNotified) return;
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    canvas.style.cursor = 'grabbing';
  };
  const onPointerMove = (e) => {
    if (!formedNotified) return;
    if (dragging) {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      targetYaw = THREE.MathUtils.clamp(targetYaw + dx * 0.0085, -Math.PI, Math.PI);
      targetPitch = THREE.MathUtils.clamp(targetPitch + dy * 0.0065, -0.85, 0.85);
    } else if (e.pointerType === 'mouse') {
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      const nx = (e.clientX / w - 0.5) * 0.35;
      const ny = (e.clientY / h - 0.5) * 0.25;
      targetYaw = THREE.MathUtils.lerp(targetYaw, nx, 0.12);
      targetPitch = THREE.MathUtils.lerp(targetPitch, ny, 0.12);
    }
  };
  const onPointerUp = () => {
    dragging = false;
    if (formedNotified) canvas.style.cursor = 'grab';
  };

  function bindInteractiveOrbit(enable) {
    if (enable) {
      canvas.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    } else {
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.style.cursor = '';
    }
  }

  function syncViewport() {
    const parent = canvas.parentElement;
    const w = Math.max(1, parent?.clientWidth || window.innerWidth);
    const h = Math.max(1, parent?.clientHeight || window.innerHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    baseCamZ = Math.max(6.85, 7.8 / Math.max(0.42, camera.aspect));
    camera.position.set(0, 0.34, baseCamZ);
    camera.lookAt(0, -0.02, 0);
    camera.updateProjectionMatrix();
  }

  function smooth01(x) {
    const c = THREE.MathUtils.clamp(x, 0, 1);
    return c * c * (3 - 2 * c);
  }

  function applyTimeline(t) {
    uniforms.uTime.value = t;

    // Prelude Act I-III (0.00s -> 7.00s) before Möbius begins at 7.00s
    const headRaw = THREE.MathUtils.clamp(t / T_IMPACT, 0, 1);
    const tailRaw = THREE.MathUtils.clamp((t - 2.10) / 5.15, 0, 1);
    uniforms.uPreludeHead.value = smooth01(headRaw * 0.92 + headRaw * headRaw * 0.08);
    uniforms.uPreludeTail.value = smooth01(tailRaw);
    uniforms.uDropFade.value = 1 - smooth01((t - 6.55) / 0.80);

    const paperReveal = smooth01((t - T_LOOM_START) / (T_LOOM_END - T_LOOM_START));
    uniforms.uPaperReveal.value = paperReveal;
    uniforms.uImpactWave.value = THREE.MathUtils.clamp((t - T_IMPACT) / (T_PRELUDE_END - T_IMPACT), 0, 1);
    uniforms.uPaperCharge.value = smooth01((t - T_IMPACT) / (T_PRELUDE_END - T_IMPACT));

    const foldRaw = THREE.MathUtils.clamp((t - T_PRELUDE_END) / (T_FOLD_END - T_PRELUDE_END), 0, 1);
    // Twist leads 7.00s -> 8.93s while bend smoothly wraps into circle 7.19s -> 9.35s
    uniforms.uTwist.value = smooth01(foldRaw / 0.82);
    uniforms.uBend.value = smooth01((foldRaw - 0.08) / 0.92);

    const joinDelta = Math.abs(t - (T_FOLD_END - 0.06));
    uniforms.uSealFlash.value = joinDelta < 0.45 ? Math.cos((joinDelta / 0.45) * (Math.PI * 0.5)) : 0;

    if (t <= T_PRELUDE_END) {
      uniforms.uTrace.value = 0;
    } else if (t <= T_FOLD_END) {
      uniforms.uTrace.value = 0.25 * smooth01((t - T_PRELUDE_END) / (T_FOLD_END - T_PRELUDE_END));
    } else {
      const ringTrace = THREE.MathUtils.clamp((t - T_FOLD_END) / (T_TRACE_END - T_FOLD_END), 0, 1);
      uniforms.uTrace.value = 0.25 + 0.75 * ringTrace;
    }

    const fadeRaw = THREE.MathUtils.clamp((t - T_TRACE_END) / (T_FADE_END - T_TRACE_END), 0, 1);
    const fadeSmooth = smooth01(fadeRaw);
    uniforms.uTransmute.value = fadeRaw;
    uniforms.uPaperOpacity.value = paperReveal * (1 - fadeSmooth);
    uniforms.uThreadOpacity.value = fadeSmooth;

    if (!loomEventFired && t >= T_LOOM_START) {
      loomEventFired = true;
      onPhaseEvent?.('loom');
    }
    if (!chargeEventFired && t >= T_IMPACT) {
      chargeEventFired = true;
      onPhaseEvent?.('charge');
    }
    if (!foldEventFired && t >= T_PRELUDE_END) {
      foldEventFired = true;
      onPhaseEvent?.('fold');
    }
    if (!traceEventFired && t >= T_FOLD_END) {
      traceEventFired = true;
      onPhaseEvent?.('trace');
    }

    // Subtle motivated camera choreography tracking prelude rhythm, settling cleanly before 7.0s fold
    const preludeCamWeight = 1 - smooth01((t - 5.4) / 1.5);
    const camTrackX = preludeCamWeight * (Math.sin(t * 1.15) * 0.26);
    const camTrackY = preludeCamWeight * (0.28 + Math.cos(t * 0.95) * 0.16);
    const camTrackZ = baseCamZ * (1 + 0.055 * preludeCamWeight);
    camera.position.set(camTrackX, 0.34 + camTrackY, camTrackZ);
    camera.lookAt(camTrackX * 0.3, -0.02 + camTrackY * 0.25, 0);

    // Orient tiltGroup so the slimmed horizontal round Möbius displays its razor S-twist silhouette clearly
    userYaw = THREE.MathUtils.lerp(userYaw, targetYaw, 0.12);
    userPitch = THREE.MathUtils.lerp(userPitch, targetPitch, 0.12);

    const bendFrac = uniforms.uBend.value;
    const threadFrac = uniforms.uThreadOpacity.value;
    tiltGroup.rotation.x = THREE.MathUtils.lerp(0.28, 0.62, bendFrac) + threadFrac * Math.cos(t * 0.42) * 0.05 + userPitch;
    tiltGroup.rotation.y = THREE.MathUtils.lerp(0.0, 0.62, bendFrac) + threadFrac * Math.sin(t * 0.32) * 0.14 + userYaw;
    tiltGroup.rotation.z = -0.02 + threadFrac * Math.sin(t * 0.28) * 0.02;

    // Gentle deep-space star parallax
    voidStarsPoints.rotation.y = (userYaw + Math.sin(t * 0.15) * 0.05) * 0.12;
    voidStarsPoints.rotation.x = userPitch * 0.12;

    sparkleField.updateField({
      uPreludeHead: uniforms.uPreludeHead.value,
      uPreludeTail: uniforms.uPreludeTail.value,
      uDropFade: uniforms.uDropFade.value,
      uPaperCharge: uniforms.uPaperCharge.value,
      uBend: uniforms.uBend.value,
      uTwist: uniforms.uTwist.value,
      uTrace: uniforms.uTrace.value,
      uPaperOpacity: uniforms.uPaperOpacity.value,
      uTransmute: uniforms.uTransmute.value,
      uThreadOpacity: uniforms.uThreadOpacity.value,
      time: t,
    });

    if (!formedNotified && t >= T_FADE_END - 0.10) {
      formedNotified = true;
      canvas.style.cursor = 'grab';
      onPhaseEvent?.('formed');
      onFormed?.();
    }
  }

  function tick(now) {
    if (!running) return;
    rafId = requestAnimationFrame(tick);

    const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016;
    lastNow = now;

    if (!paused) {
      elapsed += dt;
      applyTimeline(elapsed);
    } else if (Math.abs(targetYaw - userYaw) > 0.001 || Math.abs(targetPitch - userPitch) > 0.001) {
      applyTimeline(elapsed);
    }

    renderer.render(scene, camera);
  }

  function start() {
    stop();
    syncViewport();
    formedNotified = false;
    loomEventFired = false;
    chargeEventFired = false;
    foldEventFired = false;
    traceEventFired = false;
    paused = false;
    elapsed = 0;
    lastNow = 0;
    userYaw = 0;
    userPitch = 0;
    targetYaw = 0;
    targetPitch = 0;
    running = true;

    bindInteractiveOrbit(true);

    if (!resizeObs && typeof ResizeObserver !== 'undefined') {
      resizeObs = new ResizeObserver(() => {
        syncViewport();
        if (running) renderer.render(scene, camera);
      });
      if (canvas.parentElement) resizeObs.observe(canvas.parentElement);
    }
    window.addEventListener('resize', syncViewport);

    applyTimeline(elapsed);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    bindInteractiveOrbit(false);
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    window.removeEventListener('resize', syncViewport);
  }

  function setPaused(nextPaused) {
    paused = Boolean(nextPaused);
    if (!paused) lastNow = performance.now();
  }

  function setPaletteTheme(isJojoShift) {
    uniforms.uThemeShift.value = isJojoShift ? 1.0 : 0.0;
    if (running) renderer.render(scene, camera);
  }

  function simulateOrbit(dxRad, dyRad) {
    targetYaw = THREE.MathUtils.clamp(targetYaw + dxRad, -Math.PI, Math.PI);
    targetPitch = THREE.MathUtils.clamp(targetPitch + dyRad, -0.85, 0.85);
    userYaw = targetYaw;
    userPitch = targetPitch;
    applyTimeline(elapsed);
    renderer.render(scene, camera);
  }

  function seekToPhase(seconds) {
    syncViewport();
    elapsed = Math.max(0, Number(seconds) || 0);
    applyTimeline(elapsed);
    renderer.render(scene, camera);
  }

  function dispose() {
    stop();
    resizeObs?.disconnect();
    resizeObs = null;
    voidStarsGeo.dispose();
    voidStarsMat.dispose();
    preludeGeo.dispose();
    preludeMat.dispose();
    impactGeo.dispose();
    impactMat.dispose();
    paperGeo.dispose();
    paperMat.dispose();
    traceGeo.dispose();
    traceMat.dispose();
    coreThreadGeo.dispose();
    coreThreadMat.dispose();
    strandsGeo.dispose();
    strandsMat.dispose();
    auraGeo.dispose();
    auraMat.dispose();
    sparkleField.geo.dispose();
    sparkleMat.dispose();
    renderer.dispose();
  }

  const controller = {
    start,
    stop,
    setPaused,
    setPaletteTheme,
    simulateOrbit,
    seekToPhase,
    dispose,
    getState: () => ({
      elapsed,
      bandHalfWidth: BAND_HALF_WIDTH,
      uPreludeHead: uniforms.uPreludeHead.value,
      uPreludeTail: uniforms.uPreludeTail.value,
      uDropFade: uniforms.uDropFade.value,
      uPaperReveal: uniforms.uPaperReveal.value,
      uPaperCharge: uniforms.uPaperCharge.value,
      uImpactWave: uniforms.uImpactWave.value,
      uBend: uniforms.uBend.value,
      uTwist: uniforms.uTwist.value,
      uTrace: uniforms.uTrace.value,
      uTransmute: uniforms.uTransmute.value,
      uPaperOpacity: uniforms.uPaperOpacity.value,
      uThreadOpacity: uniforms.uThreadOpacity.value,
      rotX: tiltGroup.rotation.x,
      rotY: tiltGroup.rotation.y,
      paused,
      formedNotified,
    }),
  };

  window.__mobiusStage = controller;
  return controller;
}
