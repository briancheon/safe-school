import { SAFE_ROUTE, SCHOOL_GATE } from './config.js';

let _map = null;
let _markers = {};
let _userMarker = null;
let _dangerZones = [];

const MARKER_ICONS = {
  'illegal-parking':    { color: '#F72585', emoji: '🚗' },
  'unsignaled-crossing':{ color: '#4361EE', emoji: '🚶' },
  'blind-corner':       { color: '#FB8500', emoji: '⚠️' },
};

export function initMap(containerId, zones, onMarkerClick) {
  _dangerZones = zones;

  if (typeof kakao === 'undefined' || !kakao.maps) {
    _renderFallbackMap(containerId, zones, onMarkerClick);
    return;
  }

  kakao.maps.load(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const center = new kakao.maps.LatLng(SCHOOL_GATE.lat, SCHOOL_GATE.lng);
    _map = new kakao.maps.Map(container, {
      center,
      level: 4,
    });

    _drawSafeRoute();
    _addSchoolMarker();
    _addDangerMarkers(zones, onMarkerClick);
    _startUserPositionWatch();
  });
}

export function highlightZone(zoneId) {
  if (!_markers[zoneId]) return;
  // Bounce animation via scale — re-draw the marker overlay element
  const el = _markers[zoneId].__el;
  if (el) {
    el.style.transform = 'scale(1.4)';
    setTimeout(() => { el.style.transform = 'scale(1)'; }, 600);
  }
}

export function updateUserPosition(lat, lng) {
  if (!_map) return;
  const pos = new kakao.maps.LatLng(lat, lng);
  if (!_userMarker) {
    const content = '<div class="user-position-marker"></div>';
    _userMarker = new kakao.maps.CustomOverlay({ content, position: pos, zIndex: 20 });
    _userMarker.setMap(_map);
  } else {
    _userMarker.setPosition(pos);
  }
}

// ── Private helpers ──────────────────────────────────────

function _drawSafeRoute() {
  const path = SAFE_ROUTE.map(p => new kakao.maps.LatLng(p.lat, p.lng));
  const polyline = new kakao.maps.Polyline({
    path,
    strokeWeight: 6,
    strokeColor: '#40916C',
    strokeOpacity: 0.85,
    strokeStyle: 'solid',
  });
  polyline.setMap(_map);
}

function _addSchoolMarker() {
  const pos = new kakao.maps.LatLng(SCHOOL_GATE.lat, SCHOOL_GATE.lng);
  const content = _buildMarkerHTML('🏫', '#1B4332', '학교');
  const overlay = new kakao.maps.CustomOverlay({ content, position: pos, yAnchor: 1 });
  overlay.setMap(_map);
}

function _addDangerMarkers(zones, onMarkerClick) {
  for (const zone of zones) {
    const { color, emoji } = MARKER_ICONS[zone.type] || { color: '#999', emoji: '❗' };
    const pos = new kakao.maps.LatLng(zone.lat, zone.lng);
    const content = _buildMarkerHTML(emoji, color, '');
    const overlay = new kakao.maps.CustomOverlay({ content, position: pos, yAnchor: 1 });
    overlay.setMap(_map);

    const el = overlay.getContent();
    if (typeof el === 'object') {
      el.style.transition = 'transform 0.2s ease';
      el.style.cursor = 'pointer';
      overlay.__el = el;
      el.addEventListener('click', () => onMarkerClick && onMarkerClick(zone));
    }
    _markers[zone.id] = overlay;
  }
}

function _buildMarkerHTML(emoji, color, label) {
  return `<div style="
    display:flex; flex-direction:column; align-items:center; cursor:pointer;
    transition: transform 0.2s ease;
  ">
    <svg width="40" height="52" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 0C9 0 0 9 0 20C0 32 20 52 20 52C20 52 40 32 40 20C40 9 31 0 20 0Z"
            fill="${color}" stroke="#1A1A2E" stroke-width="2"/>
      <text x="20" y="26" text-anchor="middle" font-size="18" fill="white">${emoji}</text>
    </svg>
    ${label ? `<div class="map-marker-label">${label}</div>` : ''}
  </div>`;
}

function _startUserPositionWatch() {
  document.addEventListener('positionUpdate', (e) => {
    const { lat, lng } = e.detail;
    updateUserPosition(lat, lng);
    // Keep map centered near user
    if (_map) {
      const pos = new kakao.maps.LatLng(lat, lng);
      _map.panTo(pos);
    }
  });
}

// ── Fallback map (no Kakao key) ───────────────────────────

function _renderFallbackMap(containerId, zones, onMarkerClick) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const colorMap = {
    'illegal-parking':    { color: '#F72585', emoji: '🚗' },
    'unsignaled-crossing':{ color: '#4361EE', emoji: '🚶' },
    'blind-corner':       { color: '#FB8500', emoji: '⚠️' },
  };

  const zoneCards = zones.map(zone => {
    const { color, emoji } = colorMap[zone.type] || { color: '#999', emoji: '❗' };
    return `<button class="demo-zone-card" data-zone-id="${zone.id}">
      <div class="demo-zone-card__dot" style="background:${color}"></div>
      <div>
        <div class="demo-zone-card__title">${emoji} ${zone.title}</div>
        <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:2px">탭하여 정보 보기</div>
      </div>
    </button>`;
  }).join('');

  container.innerHTML = `
    <div class="demo-map">
      <div class="demo-map__notice">
        <h3>🗺 지도 API 키 필요</h3>
        <p>실제 기기에서는 카카오 지도가 표시됩니다.<br>
           <code>js/config.js</code>에 Kakao API 키를 입력하세요.</p>
      </div>
      <div class="demo-map__zones">${zoneCards}</div>
    </div>
  `;

  container.querySelectorAll('.demo-zone-card').forEach(card => {
    card.addEventListener('click', () => {
      const zoneId = card.dataset.zoneId;
      const zone = zones.find(z => z.id === zoneId);
      if (zone) onMarkerClick && onMarkerClick(zone);
    });
  });
}
