import { requestMotionPermission, startMotionDetection, stopMotionDetection, simulateState } from './motion.js';
import { startGeofencing, stopGeofencing, setDangerZones, simulatePosition, setSchoolGate, setRoutePolyline } from './geofence.js';
import { initMap, highlightZone, setRouteCoords, generateRouteZones, getEndCoord, getRoutePoints } from './map.js';
import { speak } from './speech.js';
import { initPoints, cleanupPoints, finalizeSession, getSessionScore, getCumulativeScore, getCertificateUnlocked } from './points.js';
import { renderCertificate } from './certificate.js';
import { initLocationSearch } from './location-search.js';
import { fetchPedestrianRoute } from './routing.js';
import { LS_KEY_STUDENT, LS_KEY_ROUTE, SCHOOL_GATE, SAFE_ROUTE } from './config.js';

let _dangerZones = [];
let _mapInitialized = false;
let _overlayActive = false;
let _walkStartTime = null;
let _elapsedInterval = null;

// ── Bootstrap ────────────────────────────────────────────

async function _loadDangerZones() {
  try {
    const res = await fetch('data/danger-zones.json');
    _dangerZones = await res.json();
  } catch {
    _dangerZones = [];
  }
}

async function _init() {
  await _loadDangerZones();
  setDangerZones(_dangerZones);

  window.addEventListener('hashchange', _onHashChange);

  const hash = location.hash || '#setup';
  location.hash = hash;
  await _loadPage(hash);

  _listenGlobalEvents();
}

// ── Router ───────────────────────────────────────────────

const PAGE_MAP = {
  '#setup':   'pages/setup.html',
  '#map':     'pages/map.html',
  '#arrival': 'pages/arrival.html',
  '#reward':  'pages/reward.html',
};

async function _onHashChange() {
  await _loadPage(location.hash);
}

async function _loadPage(hash) {
  const url = PAGE_MAP[hash] || PAGE_MAP['#setup'];
  const screen = document.getElementById('screen');
  try {
    const res = await fetch(url);
    const html = await res.text();
    screen.innerHTML = html;
    await _onPageMounted(hash);
  } catch (e) {
    console.error('Page load failed:', e);
  }
}

async function _onPageMounted(hash) {
  if (hash === '#setup')   _mountSetup();
  if (hash === '#map')     await _mountMap();
  if (hash === '#arrival') _mountArrival();
  if (hash === '#reward')  _mountReward();
}

// ── Setup Screen ─────────────────────────────────────────

function _mountSetup() {
  const form = document.getElementById('setup-form');

  // Restore saved student info
  const saved = _loadStudent();
  if (saved) {
    const nameEl  = document.getElementById('student-name');
    const gradeEl = document.getElementById('grade');
    const classEl = document.getElementById('class-num');
    if (nameEl)  nameEl.value  = saved.name     || '';
    if (gradeEl) gradeEl.value = saved.grade    || '3';
    if (classEl) classEl.value = saved.classNum || '1';
  }

  // Restore saved route
  const savedRoute = _loadRoute();

  // Init location search inputs
  const startSearch = initLocationSearch({
    inputId: 'start-input',
    placeholder: '집 주소 또는 장소 검색',
    onSelect: (loc) => {
      document.getElementById('start-chip').style.display = '';
      document.getElementById('start-chip-text').textContent = loc.name;
    },
  });

  const endSearch = initLocationSearch({
    inputId: 'end-input',
    placeholder: '학교 이름 또는 주소 검색',
    onSelect: (loc) => {
      document.getElementById('end-chip').style.display = '';
      document.getElementById('end-chip-text').textContent = loc.name;
    },
  });

  // Restore previously saved route selections
  if (savedRoute?.start) {
    startSearch.setValue(savedRoute.start.name, savedRoute.start.lat, savedRoute.start.lng);
    document.getElementById('start-chip').style.display = '';
    document.getElementById('start-chip-text').textContent = savedRoute.start.name;
  }
  if (savedRoute?.end) {
    endSearch.setValue(savedRoute.end.name, savedRoute.end.lat, savedRoute.end.lng);
    document.getElementById('end-chip').style.display = '';
    document.getElementById('end-chip-text').textContent = savedRoute.end.name;
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const student = {
      name:     document.getElementById('student-name')?.value.trim() || '학생',
      school:   endSearch.getSelected()?.name || savedRoute?.end?.name || '우리 초등학교',
      grade:    document.getElementById('grade')?.value     || '3',
      classNum: document.getElementById('class-num')?.value || '1',
    };
    _saveStudent(student);

    const start = startSearch.getSelected() || savedRoute?.start || null;
    const end   = endSearch.getSelected()   || savedRoute?.end   || null;

    if (start && end) {
      const submitBtn = document.querySelector('button[type=submit]');
      if (submitBtn) { submitBtn.textContent = '경로 계산 중… 🗺'; submitBtn.disabled = true; }

      try {
        const routePoints = await fetchPedestrianRoute(start, end);
        _saveRoute({ start, end, points: routePoints });
      } catch {
        _saveRoute({ start, end, points: null });
      }

      if (submitBtn) { submitBtn.textContent = '🚶 등교 시작하기 →'; submitBtn.disabled = false; }
    }

    _showPermissionModal();
  });
}

function _showPermissionModal() {
  const container = document.getElementById('permission-modal-container');
  container.innerHTML = `
    <div class="permission-modal-backdrop" id="perm-backdrop">
      <div class="permission-modal" role="dialog" aria-modal="true" aria-labelledby="perm-title">
        <div>
          <div class="permission-modal__title" id="perm-title">🔐 권한이 필요해요</div>
        </div>
        <p class="permission-modal__body">
          안전하게 학교까지 안내하기 위해 다음 권한이 필요합니다:
        </p>
        <ul class="permission-modal__list">
          <li><span>📍</span> 위치 정보 — 경로 안내 및 도착 확인</li>
          <li><span>📱</span> 기기 동작 — 보행 감지 (스몸비 방지)</li>
        </ul>
        <button class="btn btn-primary btn--full" id="perm-allow-btn">
          ✅ 권한 허용하고 시작하기
        </button>
      </div>
    </div>
  `;

  document.getElementById('perm-allow-btn').addEventListener('click', async () => {
    // iOS: requestPermission MUST be called synchronously inside this click handler
    const motionResult = await requestMotionPermission();
    if (motionResult === 'denied') {
      alert('동작 센서 권한이 거부되었습니다. 설정에서 권한을 허용해 주세요.');
    }
    container.innerHTML = '';
    location.hash = '#map';
  });
}

// ── Map Screen ───────────────────────────────────────────

async function _mountMap() {
  if (!_mapInitialized) {
    _mapInitialized = true;

    // Apply saved route — real Tmap points if available, else straight-line fallback
    const savedRoute = _loadRoute();
    if (savedRoute?.start && savedRoute?.end) {
      setRouteCoords(savedRoute.start, savedRoute.end, savedRoute.points || null);
    }

    // Generate danger zones along the actual route
    const zones = generateRouteZones();
    _dangerZones = zones;
    setDangerZones(zones);

    // Update geofencing to use the real school gate coord
    const endCoord = getEndCoord();
    setSchoolGate(endCoord);
    setRoutePolyline(getRoutePoints());

    initMap('kakao-map', zones, _openZoneModal);
    startMotionDetection();
    startGeofencing();
    initPoints();
  }

  _walkStartTime = Date.now();
  _startElapsedTimer();
  _renderSimPanel();
}

function _startElapsedTimer() {
  clearInterval(_elapsedInterval);
  const el = document.getElementById('elapsed-time');
  if (!el) return;
  _elapsedInterval = setInterval(() => {
    const sec = Math.floor((Date.now() - _walkStartTime) / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    const el2 = document.getElementById('elapsed-time');
    if (el2) el2.textContent = `⏱ ${mm}:${ss}`;
    else clearInterval(_elapsedInterval);
  }, 1000);
}

function _openZoneModal(zone) {
  const container = document.getElementById('modal-container');
  const placeholderClass = {
    'illegal-parking':    'modal__image-placeholder--parking',
    'unsignaled-crossing':'modal__image-placeholder--crossing',
    'blind-corner':       'modal__image-placeholder--corner',
  }[zone.type] || '';

  const placeholderEmoji = {
    'illegal-parking':    '🚗',
    'unsignaled-crossing':'🚶',
    'blind-corner':       '⚠️',
  }[zone.type] || '❗';

  const badgeClass = `modal__type-badge--${zone.type}`;

  container.innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-label="${zone.title}">
        <div class="modal__image-placeholder ${placeholderClass}">
          ${placeholderEmoji}
        </div>
        <div class="modal__body">
          <div class="modal__header">
            <div>
              <span class="modal__type-badge ${badgeClass}">${_typeLabel(zone.type)}</span>
              <h2 class="modal__title" style="margin-top:8px">${zone.title}</h2>
            </div>
          </div>
          <p class="modal__description">${zone.description}</p>
          <div class="modal__tip">
            <div class="modal__tip-label">🛡 안전 행동 요령</div>
            <div class="modal__tip-text">${zone.tip}</div>
          </div>
        </div>
        <button class="modal__close" id="modal-close-btn">✕ 닫기</button>
      </div>
    </div>
  `;

  const close = () => { container.innerHTML = ''; };
  document.getElementById('modal-close-btn').addEventListener('click', close);
  document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') close();
  });

  // Focus trap
  const closeBtn = document.getElementById('modal-close-btn');
  if (closeBtn) setTimeout(() => closeBtn.focus(), 50);
}

function _typeLabel(type) {
  return {
    'illegal-parking':    '🚗 불법 주차',
    'unsignaled-crossing':'🚶 무신호 횡단보도',
    'blind-corner':       '⚠️ 사각지대',
  }[type] || '위험';
}

// ── Arrival Screen ────────────────────────────────────────

function _mountArrival() {
  clearInterval(_elapsedInterval);
  cleanupPoints();

  const score = finalizeSession();
  const cumulative = getCumulativeScore();
  const certified  = getCertificateUnlocked();
  const student    = _loadStudent();

  // Animate confetti
  _spawnConfetti();

  // Score rows
  const rows = [
    { label: '등교 완주 기본',    pts: score.base,       earned: true },
    { label: '안전 경로 준수',    pts: score.safePath,   earned: !score.deviated },
    { label: '스몸비 제로 보너스', pts: score.noSmombie,  earned: score.smombieCount === 0 },
  ];

  const rowsHTML = rows.map((r, i) => `
    <div class="score-row" id="score-row-${i}">
      <div>
        <div class="score-row__label">${r.label}</div>
        <div class="score-row__points" style="${!r.earned ? 'text-decoration:line-through;color:var(--color-text-muted)' : ''}">
          +${r.pts} 포인트
        </div>
      </div>
      <div class="score-row__check ${r.earned ? 'earned' : ''}">${r.earned ? '✅' : '❌'}</div>
    </div>
  `).join('');

  const pct = Math.min(100, (cumulative / 1000) * 100);

  const card = document.getElementById('score-card-body');
  if (card) {
    card.innerHTML = `
      ${rowsHTML}
      <div class="score-total">
        <div class="score-total__label">이번 등교 점수</div>
        <div class="score-total__pts">총 ${score.total} 포인트</div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-label">
            <span>누적 ${cumulative} / 1,000 pt</span>
            <span>${certified ? '🎖 상장 달성!' : '상장까지 ' + (1000 - cumulative) + 'pt'}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-bar__fill" id="progress-fill"></div>
          </div>
        </div>
      </div>
    `;
  }

  const nameEl = document.getElementById('student-name-display');
  if (nameEl) nameEl.textContent = (student?.name || '학생') + ' 학생';

  // Staggered row animations
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      const row = document.getElementById(`score-row-${i}`);
      if (row) row.classList.add('animate-in');
    }, 200 + i * 150);
  }

  // Progress bar fill animation
  setTimeout(() => {
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = pct + '%';
  }, 800);

  // Reward button
  const rewardBtn = document.getElementById('reward-btn');
  if (rewardBtn) {
    if (certified) {
      rewardBtn.style.display = '';
      rewardBtn.addEventListener('click', () => { location.hash = '#reward'; });
    } else {
      rewardBtn.style.display = 'none';
    }
  }

  const homeBtn = document.getElementById('home-btn');
  homeBtn?.addEventListener('click', () => {
    _mapInitialized = false;
    stopMotionDetection();
    stopGeofencing();
    location.hash = '#setup';
  });
}

// ── Reward Screen ─────────────────────────────────────────

function _mountReward() {
  const student   = _loadStudent();
  const cumulative = getCumulativeScore();
  const certified  = getCertificateUnlocked();

  if (!certified) {
    _renderLockedState(cumulative);
    return;
  }

  const frameOuter = document.getElementById('certificate-frame-outer');
  if (frameOuter) {
    const date = new Date().toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const canvas = renderCertificate({
      name:        student?.name     || '홍길동',
      school:      student?.school   || '서울초등학교',
      grade:       student?.grade    || '3',
      classNum:    student?.classNum || '2',
      date,
      totalPoints: cumulative,
    });
    frameOuter.appendChild(canvas);
  }

  document.getElementById('print-btn')?.addEventListener('click', () => window.print());
  document.getElementById('home-btn-reward')?.addEventListener('click', () => {
    _mapInitialized = false;
    stopMotionDetection();
    stopGeofencing();
    location.hash = '#setup';
  });
}

function _renderLockedState(cumulative) {
  const frameOuter = document.getElementById('certificate-frame-outer');
  if (frameOuter) {
    const pct = Math.min(100, (cumulative / 1000) * 100);
    frameOuter.outerHTML = `
      <div class="locked-state">
        <div class="locked-state__icon">🔒</div>
        <div class="locked-state__title">상장 잠금 중</div>
        <div class="locked-state__desc">
          누적 1,000 포인트를 달성하면<br>상장을 받을 수 있어요!
        </div>
        <div class="locked-state__progress">
          <div class="locked-progress-bar">
            <div class="locked-progress-bar__fill" style="width:${pct}%"></div>
          </div>
          <div class="locked-progress-label">${cumulative} / 1,000 pt</div>
        </div>
      </div>
    `;
  }
}

// ── Global Event Listeners ────────────────────────────────

function _listenGlobalEvents() {
  document.addEventListener('motionStateChange', _onMotionStateChange);
  document.addEventListener('dangerZoneEnter',   _onDangerZoneEnter);
  document.addEventListener('dangerZoneExit',    _onDangerZoneExit);
  document.addEventListener('schoolArrival',     _onSchoolArrival);
  document.addEventListener('positionUpdate',    _onPositionUpdate);
}

function _onMotionStateChange(e) {
  const { state } = e.detail;
  if (state === 'WALKING') {
    _showOverlay();
  } else {
    _hideOverlay();
  }
  _updateStatusBadge(state);
}

function _onDangerZoneEnter(e) {
  const { zone } = e.detail;
  speak(zone.voiceAlert);
  highlightZone(zone.id);
  _showHazardChip(zone);
}

function _onDangerZoneExit(e) {
  _hideHazardChip();
}

function _onSchoolArrival() {
  // Brief delay so last GPS ping completes before navigating
  setTimeout(() => { location.hash = '#arrival'; }, 800);
}

function _onPositionUpdate(e) {
  const { lat, lng } = e.detail;
  const { haversine } = _lazyImportUtils();
  const end = getEndCoord();
  const dist = Math.round(haversine(lat, lng, end.lat, end.lng));
  const distEl = document.getElementById('school-distance');
  if (distEl) distEl.textContent = `🏫 학교까지 ${dist}m`;
}

// Lazy-load utils to avoid circular dependency issues at startup
let _utilsCache = null;
function _lazyImportUtils() {
  if (!_utilsCache) {
    // Already imported via static import in geofence.js; re-implement inline for distance display
    _utilsCache = {
      haversine(lat1, lng1, lat2, lng2) {
        const R = 6_371_000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 +
          Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      }
    };
  }
  return _utilsCache;
}

// ── Overlay ───────────────────────────────────────────────

function _showOverlay() {
  if (_overlayActive) return;
  _overlayActive = true;

  const container = document.getElementById('overlay-container');
  container.innerHTML = `
    <div class="overlay" id="walking-overlay">
      <div class="overlay__icon" aria-hidden="true">🚶</div>
      <div class="overlay__warning" aria-live="assertive">
        핸드폰<br>사용을<br>중지하세요
      </div>
      <div class="overlay__sub">걷는 중</div>
      <a class="overlay__emergency" href="tel:112" aria-label="긴급 전화 112">
        📞 긴급 전화
      </a>
    </div>
  `;

  // Trigger reflow then activate (for fade-in)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const overlay = document.getElementById('walking-overlay');
      if (overlay) overlay.classList.add('active');
    });
  });
}

function _hideOverlay() {
  if (!_overlayActive) return;
  _overlayActive = false;

  const overlay = document.getElementById('walking-overlay');
  if (!overlay) return;

  overlay.classList.add('exiting');
  overlay.addEventListener('animationend', () => {
    const container = document.getElementById('overlay-container');
    if (container) container.innerHTML = '';
  }, { once: true });
}

// ── Status bar updates ────────────────────────────────────

function _updateStatusBadge(state) {
  const badge = document.getElementById('status-mode');
  if (!badge) return;
  if (state === 'WALKING') {
    badge.className = 'map-statusbar__mode map-statusbar__mode--warning';
    badge.textContent = '🚶 이동 중';
  } else {
    badge.className = 'map-statusbar__mode map-statusbar__mode--safe';
    badge.textContent = '🛡 안전';
  }
}

function _showHazardChip(zone) {
  const chip = document.getElementById('hazard-chip');
  if (!chip) return;
  const icons = {
    'illegal-parking': '🚗',
    'unsignaled-crossing': '🚶',
    'blind-corner': '⚠️',
  };
  chip.querySelector('.hazard-chip__title').textContent = zone.title;
  chip.querySelector('.hazard-chip__dist').textContent  = '주의 구역 진입!';
  chip.querySelector('.hazard-chip__icon').textContent  = icons[zone.type] || '❗';
  chip.classList.add('visible');
}

function _hideHazardChip() {
  document.getElementById('hazard-chip')?.classList.remove('visible');
}

// ── Demo simulation panel ─────────────────────────────────

function _renderSimPanel() {
  const existing = document.getElementById('sim-panel');
  if (existing) return;

  const panel = document.createElement('div');
  panel.id = 'sim-panel';
  panel.className = 'sim-panel';
  panel.innerHTML = `
    <div class="sim-panel__controls" id="sim-controls">
      <strong style="font-size:0.75rem;color:var(--color-text-muted)">데모 시뮬레이터</strong>
      <button id="sim-walk">🚶 걷기 시작</button>
      <button id="sim-stop">🛑 정지</button>
      <button id="sim-zone">⚠️ 위험 구역 진입</button>
      <button id="sim-arrive">🏫 학교 도착</button>
    </div>
    <button class="sim-panel__toggle" id="sim-toggle" aria-label="시뮬레이터">🔧</button>
  `;
  document.body.appendChild(panel);

  document.getElementById('sim-toggle').addEventListener('click', () => {
    document.getElementById('sim-controls').classList.toggle('open');
  });

  document.getElementById('sim-walk').addEventListener('click', () => {
    simulateState('WALKING');
  });

  document.getElementById('sim-stop').addEventListener('click', () => {
    simulateState('STOPPED');
  });

  document.getElementById('sim-zone').addEventListener('click', () => {
    if (_dangerZones[0]) {
      document.dispatchEvent(new CustomEvent('dangerZoneEnter', { detail: { zone: _dangerZones[0] } }));
    }
  });

  document.getElementById('sim-arrive').addEventListener('click', () => {
    simulatePosition(SCHOOL_GATE.lat, SCHOOL_GATE.lng);
  });
}

// ── LocalStorage helpers ──────────────────────────────────

function _saveStudent(student) {
  try { localStorage.setItem(LS_KEY_STUDENT, JSON.stringify(student)); } catch { /* ignore */ }
}

function _loadStudent() {
  try { return JSON.parse(localStorage.getItem(LS_KEY_STUDENT) || 'null'); } catch { return null; }
}

function _saveRoute(route) {
  try { localStorage.setItem(LS_KEY_ROUTE, JSON.stringify(route)); } catch { /* ignore */ }
}

function _loadRoute() {
  try { return JSON.parse(localStorage.getItem(LS_KEY_ROUTE) || 'null'); } catch { return null; }
}

// ── Confetti ──────────────────────────────────────────────

function _spawnConfetti() {
  const colors = ['#FFD166','#1B4332','#EF233C','#4361EE','#F72585','#FB8500'];
  for (let i = 0; i < 40; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left    = Math.random() * 100 + 'vw';
    piece.style.top     = '-20px';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration  = (2 + Math.random() * 2) + 's';
    piece.style.animationDelay     = (Math.random() * 1.5) + 's';
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    piece.style.width  = (8 + Math.random() * 8) + 'px';
    piece.style.height = (8 + Math.random() * 8) + 'px';
    document.body.appendChild(piece);
    piece.addEventListener('animationend', () => piece.remove());
  }
}

// ── Start ────────────────────────────────────────────────

_init();
