import gsap from 'gsap';

const STORAGE_KEY = 'thiep_ki_yeu_guestbook_v1';

function getByPath(obj, path) {
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

/**
 * Hydrates all [data-bind] elements and dynamic sections from invitation.json
 */
export function hydrateInvitation(data) {
  if (data?.meta?.pageTitle) {
    document.title = data.meta.pageTitle;
  }

  document.querySelectorAll('[data-bind]').forEach((el) => {
    const key = el.getAttribute('data-bind');
    const val = getByPath(data, key);
    if (typeof val === 'string') {
      el.textContent = val;
    }
  });

  // Story paragraphs
  const storyContainer = document.getElementById('story-paragraphs');
  if (storyContainer && Array.isArray(data.story?.paragraphs)) {
    storyContainer.innerHTML = '';
    for (const pText of data.story.paragraphs) {
      const p = document.createElement('p');
      p.textContent = pText;
      storyContainer.appendChild(p);
    }
  }

  // Equations list (formulas only, zero effect explanation captions)
  const eqList = document.getElementById('equations-list');
  if (eqList && Array.isArray(data.story?.equations)) {
    eqList.innerHTML = '';
    for (const eq of data.story.equations) {
      const li = document.createElement('li');
      const code = document.createElement('code');
      code.className = 'equation-code';
      code.textContent = eq.formula;
      li.append(code);
      eqList.appendChild(li);
    }
  }

  // Schedule timeline
  const scheduleList = document.getElementById('schedule-list');
  if (scheduleList && Array.isArray(data.schedule?.items)) {
    scheduleList.innerHTML = '';
    for (const item of data.schedule.items) {
      const li = document.createElement('li');
      li.className = 'timeline-item';

      const timeEl = document.createElement('div');
      timeEl.className = 'timeline-item__time';
      timeEl.textContent = item.time;

      const titleEl = document.createElement('h4');
      titleEl.className = 'timeline-item__title';
      titleEl.textContent = item.title;

      const descEl = document.createElement('p');
      descEl.className = 'timeline-item__desc';
      descEl.textContent = item.desc;

      li.append(timeEl, titleEl, descEl);
      scheduleList.appendChild(li);
    }
  }

  // Dress code swatches
  const swatchesEl = document.getElementById('dress-swatches');
  if (swatchesEl && Array.isArray(data.dressCode?.swatches)) {
    swatchesEl.innerHTML = '';
    for (const sw of data.dressCode.swatches) {
      const li = document.createElement('li');
      li.className = 'swatch-item';

      const dot = document.createElement('span');
      dot.className = 'swatch-dot';
      dot.style.backgroundColor = sw.hex;

      const meta = document.createElement('div');
      const nameSpan = document.createElement('span');
      nameSpan.className = 'swatch-name';
      nameSpan.textContent = sw.name;

      const roleSpan = document.createElement('span');
      roleSpan.className = 'swatch-role';
      roleSpan.textContent = sw.role;

      meta.append(nameSpan, roleSpan);
      li.append(dot, meta);
      swatchesEl.appendChild(li);
    }
  }

  // Maps & Google Calendar URLs
  const mapsLink = document.getElementById('link-google-maps');
  if (mapsLink && data.event?.mapUrl) {
    mapsLink.href = data.event.mapUrl;
  }

  const calLink = document.getElementById('link-google-calendar');
  if (calLink && data.event?.isoDate) {
    const start = new Date(data.event.isoDate);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start.getTime() + 3.0 * 60 * 60 * 1000);
      const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
      const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: data.event.calendarTitle || data.tablet?.headline || 'Lễ Kỷ Yếu',
        dates: `${fmt(start)}/${fmt(end)}`,
        location: data.event.calendarLocation || data.event.venueAddress || '',
        details: data.event.calendarDetails || '',
      });
      calLink.href = `https://calendar.google.com/calendar/render?${params.toString()}`;
    }
  }

  renderStandRadar(data.standProfile);
  renderPoseGuide(data.poseGuide);
  startCountdown(data.event?.isoDate);
  setupScrollAnimations();
  setupTabletTilt();
  setupRsvpForm(data.rsvp);
}

/**
 * Renders JoJo Pose & DISC photo suggestions inside Section 04 right column
 */
function renderPoseGuide(poseGuide) {
  const listEl = document.getElementById('pose-guide-list');
  if (!listEl || !Array.isArray(poseGuide?.items)) return;

  listEl.innerHTML = '';
  for (const item of poseGuide.items) {
    const li = document.createElement('li');
    li.className = 'pose-guide-item';

    const title = document.createElement('strong');
    title.className = 'pose-guide-item__title';
    title.textContent = item.title;

    const desc = document.createElement('p');
    desc.className = 'pose-guide-item__desc';
    desc.textContent = item.desc;

    li.append(title, desc);
    listEl.appendChild(li);
  }
}

/**
 * Interactive 6-Axis SVG Stand Stats Radar Chart
 */
function renderStandRadar(standProfile) {
  const svg = document.getElementById('stand-radar-svg');
  const badgesWrap = document.getElementById('stand-stat-badges');
  const noteEl = document.getElementById('stand-stat-note');
  if (!svg || !standProfile?.stats?.length) return;

  const stats = standProfile.stats.slice(0, 6);
  const cx = 250;
  const cy = 190;
  const maxR = 104;
  const n = stats.length;
  const ns = 'http://www.w3.org/2000/svg';

  svg.innerHTML = '';

  const createSvgEl = (tag, attrs) => {
    const el = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, String(v));
    }
    return el;
  };

  // Concentric hexagonal/circular rings
  [0.25, 0.5, 0.75, 1.0].forEach((ratio) => {
    const pts = stats
      .map((_, i) => {
        const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
        return `${(cx + Math.cos(ang) * maxR * ratio).toFixed(1)},${(cy + Math.sin(ang) * maxR * ratio).toFixed(1)}`;
      })
      .join(' ');
    svg.appendChild(createSvgEl('polygon', { points: pts, class: 'radar-ring' }));
  });

  // Axes & Labels
  const polyPoints = [];
  stats.forEach((st, i) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    const xEnd = cx + Math.cos(ang) * maxR;
    const yEnd = cy + Math.sin(ang) * maxR;
    svg.appendChild(
      createSvgEl('line', {
        x1: cx,
        y1: cy,
        x2: xEnd.toFixed(1),
        y2: yEnd.toFixed(1),
        class: 'radar-axis',
      })
    );

    const valRatio = Math.max(0.18, Math.min(1.0, (st.value || 80) / 100));
    polyPoints.push(
      `${(cx + Math.cos(ang) * maxR * valRatio).toFixed(1)},${(cy + Math.sin(ang) * maxR * valRatio).toFixed(1)}`
    );

    const labelR = maxR + 28;
    const lx = cx + Math.cos(ang) * labelR;
    const ly = cy + Math.sin(ang) * labelR;
    let anchor = 'middle';
    if (Math.cos(ang) > 0.25) anchor = 'start';
    else if (Math.cos(ang) < -0.25) anchor = 'end';

    const rankText = createSvgEl('text', {
      x: lx.toFixed(1),
      y: (ly - 4).toFixed(1),
      'text-anchor': anchor,
      class: 'radar-rank',
    });
    rankText.textContent = `[${st.rank}]`;
    svg.appendChild(rankText);

    const labelText = createSvgEl('text', {
      x: lx.toFixed(1),
      y: (ly + 12).toFixed(1),
      'text-anchor': anchor,
      class: 'radar-label',
    });
    labelText.textContent = st.shortLabel || st.label;
    svg.appendChild(labelText);
  });

  const statPoly = createSvgEl('polygon', {
    points: polyPoints.join(' '),
    class: 'radar-poly',
  });
  svg.appendChild(statPoly);

  const formatStatNote = (st) => (st?.note ? `${st.label} (${st.rank}): ${st.note}` : '');

  // Interactive Stat Pills
  if (badgesWrap) {
    badgesWrap.innerHTML = '';
    if (noteEl) noteEl.textContent = formatStatNote(stats[0]);
    stats.forEach((st, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'stat-pill' + (idx === 0 ? ' is-active' : '');
      const rank = document.createElement('span');
      rank.className = 'stat-pill__rank';
      rank.textContent = st.rank;
      const lbl = document.createElement('span');
      lbl.textContent = st.label;
      btn.append(rank, lbl);

      btn.addEventListener('click', () => {
        badgesWrap.querySelectorAll('.stat-pill').forEach((p) => p.classList.remove('is-active'));
        btn.classList.add('is-active');
        if (noteEl) noteEl.textContent = formatStatNote(st);
      });
      badgesWrap.appendChild(btn);
    });
  }
}

/**
 * Live Countdown in tabular-nums
 */
function startCountdown(isoDate) {
  const daysEl = document.getElementById('cd-days');
  const hoursEl = document.getElementById('cd-hours');
  const minsEl = document.getElementById('cd-mins');
  const secsEl = document.getElementById('cd-secs');
  if (!daysEl || !isoDate) return;

  const targetMs = new Date(isoDate).getTime();
  if (Number.isNaN(targetMs)) return;

  const pad = (v) => String(Math.max(0, v)).padStart(2, '0');

  const update = () => {
    const diff = Math.max(0, targetMs - Date.now());
    const totalSec = Math.floor(diff / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    daysEl.textContent = pad(d);
    hoursEl.textContent = pad(h);
    minsEl.textContent = pad(m);
    secsEl.textContent = pad(s);
  };

  update();
  setInterval(update, 1000);
}

/**
 * Smooth entrance reveals for Invitation Sections 1–4 using scoped gsap.context()
 */
function setupScrollAnimations() {
  const mainScope = document.getElementById('invitation-main');
  const cards = document.querySelectorAll('#invitation-main .chamfer-card');
  if (!mainScope || !cards.length || !('IntersectionObserver' in window)) return;

  const ctx = gsap.context(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            gsap.fromTo(
              entry.target,
              { y: 18, opacity: 0.72 },
              { y: 0, opacity: 1, duration: 0.55, ease: 'power2.out', clearProps: 'transform,opacity' }
            );
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.14 }
    );
    cards.forEach((card) => io.observe(card));
  }, mainScope);

  window.addEventListener('pagehide', () => ctx.revert(), { once: true });
}

/**
 * Subtle 3D Tilt on the Stone Tablet Invitation Card (reads rect on enter only — zero per-frame layout reads)
 */
function setupTabletTilt() {
  const card = document.getElementById('stone-tablet-card');
  if (!card) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  if (reduced || !finePointer) return;

  let cachedRect = null;

  card.addEventListener('pointerenter', () => {
    cachedRect = card.getBoundingClientRect();
  });

  card.addEventListener('pointermove', (e) => {
    if (!cachedRect) cachedRect = card.getBoundingClientRect();
    if (!cachedRect.width || !cachedRect.height) return;
    const nx = (e.clientX - cachedRect.left) / cachedRect.width - 0.5;
    const ny = (e.clientY - cachedRect.top) / cachedRect.height - 0.5;
    card.style.setProperty('--tilt-x', `${(nx * 5.5).toFixed(2)}deg`);
    card.style.setProperty('--tilt-y', `${(-ny * 4.5).toFixed(2)}deg`);
  });

  card.addEventListener('pointerleave', () => {
    cachedRect = null;
    card.style.setProperty('--tilt-x', '0deg');
    card.style.setProperty('--tilt-y', '0deg');
  });
}

/**
 * Accessible RSVP Form + LocalStorage Guestbook + Spin Particle Celebration (< 1.3s)
 */
function setupRsvpForm(rsvpConfig) {
  const form = document.getElementById('rsvp-form');
  const nameInput = document.getElementById('rsvp-name');
  const nameErr = document.getElementById('err-rsvp-name');
  const feedbackEl = document.getElementById('rsvp-feedback');
  const submitBtn = document.getElementById('rsvp-submit-btn');

  renderGuestbook();
  if (!form || !nameInput) return;

  const clearError = () => {
    nameInput.removeAttribute('aria-invalid');
    if (nameErr) nameErr.hidden = true;
  };

  nameInput.addEventListener('input', clearError);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();
    if (feedbackEl) feedbackEl.hidden = true;

    const nameVal = nameInput.value.trim();
    if (!nameVal) {
      nameInput.setAttribute('aria-invalid', 'true');
      if (nameErr) {
        nameErr.querySelector('.error-text').textContent = 'Vui lòng nhập họ tên để mình nhận diện bạn trong sổ lưu bút.';
        nameErr.hidden = false;
      }
      nameInput.focus();
      return;
    }

    const attending = form.querySelector('input[name="attending"]:checked')?.value || 'yes';
    const guests = Number(document.getElementById('rsvp-guests')?.value || 1);
    const wish = document.getElementById('rsvp-wish')?.value.trim() || '';

    submitBtn.disabled = true;
    const btnSpan = submitBtn.querySelector('span');
    const prevBtnText = btnSpan ? btnSpan.textContent : submitBtn.textContent;
    if (btnSpan) btnSpan.textContent = 'Đang lưu xác nhận…';
    else submitBtn.textContent = 'Đang lưu xác nhận…';

    const entry = {
      name: nameVal,
      attending,
      guests,
      wish,
      timestamp: new Date().toISOString(),
    };

    try {
      if (rsvpConfig?.webhookUrl) {
        await fetch(rsvpConfig.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });
      }
    } catch (err) {
      console.warn('RSVP webhook failed, saved locally instead:', err);
    }

    const existing = loadGuestbook();
    existing.unshift(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, 30)));
    renderGuestbook();

    submitBtn.disabled = false;
    if (btnSpan) btnSpan.textContent = prevBtnText;
    else submitBtn.textContent = prevBtnText;
    form.reset();

    if (feedbackEl) {
      feedbackEl.innerHTML = '';
      const icon = document.createElement('span');
      icon.className = 'status-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '✓';
      const msg = document.createElement('span');
      msg.textContent = `Đã ghi nhận lời nhắn từ ${nameVal}! Hẹn gặp bạn tại buổi lễ kỷ yếu.`;
      feedbackEl.append(icon, msg);
      feedbackEl.hidden = false;
    }

    triggerSpinBurst();
  });
}

function loadGuestbook() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function renderGuestbook() {
  const listEl = document.getElementById('guestbook-list');
  const emptyEl = document.getElementById('guestbook-empty');
  const countEl = document.getElementById('guestbook-count');
  if (!listEl) return;

  const entries = loadGuestbook();
  if (countEl) countEl.textContent = `${entries.length} lời nhắn`;

  listEl.innerHTML = '';
  if (entries.length === 0) {
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;

  const labelMap = {
    yes: 'Tham dự',
    maybe: 'Dự kiến',
    no: 'Gửi lời chúc',
  };

  for (const item of entries) {
    const li = document.createElement('li');
    li.className = 'guestbook-item';

    const top = document.createElement('div');
    top.className = 'guestbook-item__top';

    const nSpan = document.createElement('span');
    nSpan.className = 'guestbook-item__name';
    nSpan.textContent = item.name;

    const sSpan = document.createElement('span');
    sSpan.className = 'guestbook-item__status';
    const guestSuffix = item.attending !== 'no' && item.guests > 1 ? ` · ${item.guests} người` : '';
    sSpan.textContent = `${labelMap[item.attending] || 'Tham dự'}${guestSuffix}`;

    top.append(nSpan, sSpan);
    li.appendChild(top);

    if (item.wish) {
      const wP = document.createElement('p');
      wP.className = 'guestbook-item__wish';
      wP.textContent = item.wish;
      li.appendChild(wP);
    }
    listEl.appendChild(li);
  }
}

/**
 * Celebratory Golden Spin Particle Burst (< 1.3s, respects reduced motion)
 */
function triggerSpinBurst() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.getElementById('rsvp-burst-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const cx = canvas.width / 2;
  const cy = canvas.height * 0.65;
  const particles = Array.from({ length: 48 }, (_, i) => {
    const ang = (i / 48) * Math.PI * 2 + Math.random() * 0.25;
    const spd = 2.5 + Math.random() * 6.5;
    return {
      x: cx,
      y: cy,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      r: 2 + Math.random() * 3,
      color: i % 3 === 0 ? '#E8C56E' : i % 3 === 1 ? '#9D7FEA' : '#5CE1E6',
    };
  });

  const start = performance.now();
  const dur = 1200;

  const draw = (now) => {
    const elapsed = now - start;
    const p = Math.min(1, elapsed / dur);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const pt of particles) {
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
      ctx.globalAlpha = 1 - p;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (p < 1) {
      requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
  requestAnimationFrame(draw);
}
