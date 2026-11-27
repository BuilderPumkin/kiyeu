import gsap from 'gsap';
import { IntroDirector } from './intro3d.js';
import { createMobiusThreadStage } from './mobiusThreadStage.js';
import { createSoundEngine } from './soundEngine.js';
import { hydrateInvitation } from './uiRenderer.js';

async function bootstrap() {
  const loaderEl = document.getElementById('intro-loader');
  const loaderFillEl = document.getElementById('intro-loader-fill');
  const introStageEl = document.getElementById('intro-stage');
  const startGateEl = document.getElementById('cosmic-start-gate');
  const startBtn = document.getElementById('btn-start-journey');

  const tabletSection = document.getElementById('stone-tablet-section');
  const tabletCard = document.getElementById('stone-tablet-card');
  const openBtn = document.getElementById('btn-open-invitation');
  const replayBtn = document.getElementById('btn-replay-intro');
  const footerReplayBtn = document.getElementById('btn-footer-replay');
  const canvas = document.getElementById('cosmos-canvas');

  const mobiusStageEl = document.getElementById('mobius-stage');
  const mobiusCanvas = document.getElementById('mobius-canvas');
  const scrollCueWrap = document.getElementById('mobius-scroll-cue');
  const pauseBtn = document.getElementById('btn-toggle-mobius-motion');
  const pauseIcon = document.getElementById('mobius-pause-icon');

  const audioBtn = document.getElementById('btn-toggle-audio');
  const audioIcon = document.getElementById('audio-icon');
  const themeBtn = document.getElementById('btn-theme-shift');

  const mainEl = document.getElementById('invitation-main');
  const footerEl = document.querySelector('.site-footer');

  const soundEngine = createSoundEngine();
  let transitionCtx = null;

  let invitationData;
  let choreographyData;

  const unlockScrollAndSections = () => {
    scrollCueWrap?.classList.add('is-visible');
    scrollCueWrap?.setAttribute('aria-hidden', 'false');
    if (mainEl) mainEl.hidden = false;
    if (footerEl) footerEl.hidden = false;
    document.body.classList.remove('is-intro-locked');
  };

  const mobiusController = createMobiusThreadStage({
    canvas: mobiusCanvas,
    onPhaseEvent: (phase) => {
      if (phase === 'loom') soundEngine.playSilkSweep();
      else if (phase === 'charge') soundEngine.playCenterCharge();
      else if (phase === 'fold') soundEngine.playPaperFold();
      else if (phase === 'trace') soundEngine.playThreadTraceShimmer();
      else if (phase === 'formed') soundEngine.playMobiusChime();
    },
    onFormed: unlockScrollAndSections,
  });

  try {
    const [invRes, choreoRes] = await Promise.all([
      fetch('./data/invitation.json'),
      fetch('./data/intro-choreography.json'),
    ]);
    if (!invRes.ok || !choreoRes.ok) {
      throw new Error('Không thể tải dữ liệu JSON cấu hình thiệp mời.');
    }
    invitationData = await invRes.json();
    choreographyData = await choreoRes.json();
  } catch (err) {
    console.error(err);
    loaderEl?.classList.add('is-hidden');
    document.body.classList.add('is-intro-locked');
    tabletSection?.classList.add('is-visible');
    tabletSection?.setAttribute('aria-hidden', 'false');
    return;
  }

  hydrateInvitation(invitationData);

  const revealStoneTablet = () => {
    transitionCtx?.revert();
    transitionCtx = null;
    if (startGateEl) startGateEl.hidden = true;
    document.body.classList.add('is-intro-locked');
    if (mainEl) mainEl.hidden = true;
    if (footerEl) footerEl.hidden = true;
    tabletSection?.classList.remove('is-opening-threads');
    tabletSection?.classList.add('is-visible');
    tabletSection?.setAttribute('aria-hidden', 'false');
    if (openBtn) openBtn.disabled = false;
  };

  const director = new IntroDirector({
    canvas,
    choreography: choreographyData,
    onProgress: (pct) => {
      if (loaderFillEl) loaderFillEl.style.width = `${pct}%`;
    },
    onBeatChange: () => {},
    onTabletReady: () => {
      revealStoneTablet();
    },
    onWebGLUnavailable: () => {
      loaderEl?.classList.add('is-hidden');
      revealStoneTablet();
    },
  });

  // Always start immediately in Ambient Spinning Galaxy Standby (never auto-skip intro!)
  await director.loadAssetsAndStart({
    skipIntroImmediately: false,
    startInAmbient: true,
  });

  window.__introDirector = director;
  loaderEl?.classList.add('is-hidden');

  if (startGateEl) {
    startGateEl.hidden = false;
    gsap.fromTo(
      startGateEl,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.75, ease: 'power2.out', clearProps: 'transform,opacity' }
    );
  }

  let introLaunched = false;
  const launchIntroFromGate = () => {
    if (introLaunched) return;
    introLaunched = true;

    soundEngine.unlock();
    soundEngine.startAmbientDrone();
    soundEngine.playIntroLaunch();
    director.startFromAmbient();

    if (!startGateEl) return;

    transitionCtx?.revert();
    transitionCtx = gsap.context(() => {
      gsap.to(startGateEl, {
        opacity: 0,
        scale: 0.94,
        y: 12,
        duration: 0.5,
        ease: 'power2.in',
        onComplete: () => {
          startGateEl.hidden = true;
          gsap.set(startGateEl, { clearProps: 'all' });
        },
      });
    }, introStageEl || document.body);
  };

  startBtn?.addEventListener('click', launchIntroFromGate);

  // Corner Sound Toggle (#4) & Stand Shift Theme Toggle (#2)
  const syncAudioUi = () => {
    const muted = soundEngine.isMuted();
    if (audioBtn) {
      audioBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
      audioBtn.setAttribute('aria-label', muted ? 'Bật âm thanh hiệu ứng' : 'Tắt âm thanh hiệu ứng');
    }
    if (audioIcon) audioIcon.textContent = muted ? '🔇' : '🔊';
  };

  audioBtn?.addEventListener('click', () => {
    soundEngine.unlock();
    soundEngine.setMuted(!soundEngine.isMuted());
    if (!soundEngine.isMuted()) soundEngine.startAmbientDrone();
    syncAudioUi();
  });

  let isJojoShift = false;
  themeBtn?.addEventListener('click', () => {
    soundEngine.unlock();
    soundEngine.playThemeShift();
    isJojoShift = !isJojoShift;
    if (isJojoShift) {
      document.documentElement.setAttribute('data-theme', 'jojo-shift');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    themeBtn.setAttribute('aria-pressed', isJojoShift ? 'true' : 'false');
    mobiusController.setPaletteTheme(isJojoShift);

    // Subtle JoJo chromatic pulse on shift
    document.body.classList.add('is-theme-pulsing');
    window.setTimeout(() => document.body.classList.remove('is-theme-pulsing'), 380);
  });

  let mobiusPaused = false;
  const syncPauseUi = () => {
    if (!pauseBtn) return;
    pauseBtn.setAttribute('aria-pressed', mobiusPaused ? 'true' : 'false');
    pauseBtn.setAttribute(
      'aria-label',
      mobiusPaused ? 'Tiếp tục chuyển động dải Möbius' : 'Tạm dừng chuyển động dải Möbius'
    );
    if (pauseIcon) pauseIcon.textContent = mobiusPaused ? '▶' : '❚❚';
  };

  pauseBtn?.addEventListener('click', () => {
    mobiusPaused = !mobiusPaused;
    mobiusController.setPaused(mobiusPaused);
    syncPauseUi();
  });

  // Dramatic Tablet-to-Starry-Void-Thread GSAP Morph on "Mở thiệp mời"
  const openInvitationFlow = () => {
    if (!mobiusStageEl || !tabletSection || !tabletCard) {
      unlockScrollAndSections();
      return;
    }

    soundEngine.unlock();
    soundEngine.playIntroLaunch();
    if (openBtn) openBtn.disabled = true;

    scrollCueWrap?.classList.remove('is-visible');
    scrollCueWrap?.setAttribute('aria-hidden', 'true');
    mobiusPaused = false;
    syncPauseUi();

    mobiusStageEl.hidden = false;
    mobiusStageEl.classList.add('is-transitioning');
    mobiusStageEl.style.opacity = '0';

    let mobiusStarted = false;
    const ensureMobiusStarted = () => {
      if (mobiusStarted) return;
      mobiusStarted = true;
      mobiusController.start();
    };

    transitionCtx?.revert();
    transitionCtx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          ensureMobiusStarted();
          if (introStageEl) introStageEl.hidden = true;
          director.timeline?.pause();
          director.setPaused(true);

          tabletSection.classList.remove('is-visible', 'is-opening-threads');
          tabletSection.setAttribute('aria-hidden', 'true');
          gsap.set(
            '#stone-tablet-card, .stone-tablet__thread-core, .tablet-coords, .countdown, .stone-tablet__actions, .stone-tablet__lead, .stone-tablet__title, .stone-tablet__host, .stone-tablet__engraved',
            { clearProps: 'all' }
          );

          window.scrollTo({ top: 0, behavior: 'auto' });
          mobiusStageEl.classList.remove('is-transitioning');
          mobiusStageEl.style.opacity = '1';
          if (openBtn) openBtn.disabled = false;
        },
      });

      const threadCore = tabletCard.querySelector('.stone-tablet__thread-core');
      const innerPieces = tabletCard.querySelectorAll(
        '.stone-tablet__engraved, .stone-tablet__title, .stone-tablet__host, .stone-tablet__lead, .tablet-coords, .countdown, .stone-tablet__actions'
      );

      // 1. Ignite vertical Stone Free cyan thread beam down center of tablet
      if (threadCore) {
        tl.fromTo(
          threadCore,
          { opacity: 0, scaleY: 0 },
          { opacity: 1, scaleY: 1, duration: 0.42, ease: 'power3.out' },
          0
        );
      }

      // 2. Collapse countdown boxes & coordinates inward toward the vertical cyan beam
      tl.to(
        innerPieces,
        { opacity: 0, scaleX: 0.72, y: -8, duration: 0.36, stagger: 0.03, ease: 'power2.in' },
        0.05
      );

      // 3. Compress Stone Tablet card itself into a vertical filament as starry Möbius stage fades in
      tl.to(
        tabletCard,
        { scaleX: 0.02, scaleY: 1.15, opacity: 0, duration: 0.52, ease: 'power3.inOut' },
        0.28
      );

      tl.to(
        mobiusStageEl,
        { opacity: 1, duration: 0.65, ease: 'power2.out' },
        0.34
      );
      tl.call(ensureMobiusStarted, null, 0.34);
    }, document.body);
  };

  openBtn?.addEventListener('click', openInvitationFlow);

  const handleReplay = () => {
    transitionCtx?.revert();
    transitionCtx = null;

    mobiusController.stop();
    if (mobiusStageEl) {
      mobiusStageEl.hidden = true;
      mobiusStageEl.classList.remove('is-transitioning');
      mobiusStageEl.style.opacity = '';
    }
    scrollCueWrap?.classList.remove('is-visible');
    scrollCueWrap?.setAttribute('aria-hidden', 'true');

    if (mainEl) mainEl.hidden = true;
    if (footerEl) footerEl.hidden = true;
    if (introStageEl) introStageEl.hidden = false;
    if (startGateEl) startGateEl.hidden = true;

    window.scrollTo({ top: 0, behavior: 'auto' });
    document.body.classList.add('is-intro-locked');

    tabletSection?.classList.remove('is-visible', 'is-opening-threads');
    tabletSection?.setAttribute('aria-hidden', 'true');
    gsap.set('#stone-tablet-card', { clearProps: 'all' });
    if (openBtn) openBtn.disabled = false;

    soundEngine.unlock();
    soundEngine.startAmbientDrone();
    director.replay();
  };

  replayBtn?.addEventListener('click', handleReplay);
  footerReplayBtn?.addEventListener('click', handleReplay);
}

bootstrap();
