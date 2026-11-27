/**
 * Procedural Web Audio Synth Engine (Approved Enhancement #4)
 * Zero external audio assets; all sounds are synthesized cleanly with graceful fallback.
 */
export function createSoundEngine() {
  let ctx = null;
  let masterGain = null;
  let muted = false;
  let ambientNodes = null;

  function ensureContext() {
    if (ctx) return true;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;
    try {
      ctx = new AudioCtx();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : 0.32;
      masterGain.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    if (!ensureContext()) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  function setMuted(nextMuted) {
    muted = Boolean(nextMuted);
    if (masterGain && ctx) {
      masterGain.gain.setTargetAtTime(muted ? 0 : 0.32, ctx.currentTime, 0.05);
    }
  }

  function isMuted() {
    return muted;
  }

  function startAmbientDrone() {
    if (!ensureContext() || ambientNodes) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0.001, now);
    droneGain.gain.exponentialRampToValueAtTime(0.14, now + 1.4);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    filter.Q.value = 1.6;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 55; // A1 sub

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 110.25; // slight detune shimmer

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(masterGain);

    osc1.start(now);
    osc2.start(now);
    ambientNodes = { osc1, osc2, droneGain, filter };
  }

  function stopAmbient() {
    if (!ambientNodes || !ctx) return;
    const now = ctx.currentTime;
    const { osc1, osc2, droneGain } = ambientNodes;
    try {
      droneGain.gain.setTargetAtTime(0.0001, now, 0.15);
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);
    } catch {}
    ambientNodes = null;
  }

  function playIntroLaunch() {
    if (muted || !ensureContext()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(520, now + 0.55);
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.24, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    osc.connect(g).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.9);
  }

  function playSilkSweep() {
    if (muted || !ensureContext()) return;
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.65);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(540, now);
    bp.frequency.exponentialRampToValueAtTime(1850, now + 0.58);
    bp.Q.value = 2.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.11, now + 0.14);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    src.connect(bp).connect(g).connect(masterGain);
    src.start(now);

    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.55);
    og.gain.setValueAtTime(0.001, now);
    og.gain.exponentialRampToValueAtTime(0.06, now + 0.12);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
    osc.connect(og).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.75);
  }

  function playCenterCharge() {
    if (muted || !ensureContext()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1174.66, now);
    osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.42);
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.14, now + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.68);
    osc.connect(g).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.72);

    const shim = ctx.createOscillator();
    const sg = ctx.createGain();
    shim.type = 'triangle';
    shim.frequency.setValueAtTime(784, now + 0.04);
    shim.frequency.exponentialRampToValueAtTime(1568, now + 0.65);
    sg.gain.setValueAtTime(0.001, now + 0.04);
    sg.gain.exponentialRampToValueAtTime(0.075, now + 0.12);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.78);
    shim.connect(sg).connect(masterGain);
    shim.start(now + 0.04);
    shim.stop(now + 0.82);
  }

  function playPaperFold() {
    if (muted || !ensureContext()) return;
    const now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * 0.42);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(900, now);
    bp.frequency.exponentialRampToValueAtTime(2400, now + 0.35);
    bp.Q.value = 1.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    src.connect(bp).connect(g).connect(masterGain);
    src.start(now);
  }

  function playThreadTraceShimmer() {
    if (muted || !ensureContext()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.45);
    g.gain.setValueAtTime(0.001, now);
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc.connect(g).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  function playMobiusChime() {
    if (muted || !ensureContext()) return;
    const now = ctx.currentTime;
    const freqs = [440, 554.37, 659.25, 880]; // A major celestial chord
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.06);
      g.gain.setValueAtTime(0.001, now + idx * 0.06);
      g.gain.exponentialRampToValueAtTime(0.11, now + idx * 0.06 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 1.3);
      osc.connect(g).connect(masterGain);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 1.35);
    });
  }

  function playThemeShift() {
    if (muted || !ensureContext()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1600, now);
    lp.frequency.exponentialRampToValueAtTime(220, now + 0.35);
    osc.frequency.setValueAtTime(310, now);
    osc.frequency.exponentialRampToValueAtTime(155, now + 0.35);
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    osc.connect(lp).connect(g).connect(masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  return {
    unlock,
    setMuted,
    isMuted,
    startAmbientDrone,
    stopAmbient,
    playIntroLaunch,
    playSilkSweep,
    playCenterCharge,
    playPaperFold,
    playThreadTraceShimmer,
    playMobiusChime,
    playThemeShift,
  };
}
