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

// start/end set dynamically from setup screen; fall back to config defaults
let _startCoord = null;
let _endCoord   = null;
let _routePoints = null; // computed polyline

export function setRouteCoords(start, end, realPoints = null) {
  _startCoord  = start;
  _endCoord    = end;
  // Use real Tmap pedestrian route if available, else interpolate straight line
  _routePoints = (realPoints && realPoints.length > 1)
    ? realPoints
    : _interpolateRoute(start, end, 6);
}

export function getRoutePoints() {
  return _routePoints || SAFE_ROUTE;
}

export function getEndCoord() {
  return _endCoord || SCHOOL_GATE;
}

// Generate 3 danger zones evenly spaced along the route
export function generateRouteZones() {
  const route = getRoutePoints();
  const total = route.length - 1;
  const positions = [
    Math.round(total * 0.25),
    Math.round(total * 0.5),
    Math.round(total * 0.75),
  ];
  const templates = [
    {
      id: 'route-dz-1', type: 'illegal-parking',
      title: '불법 주차 다발 구역',
      description: '이곳은 불법 주차된 차량이 많아 운전자가 여러분을 보기 힘든 곳입니다.',
      tip: '주차된 차량 사이를 지날 때는 반드시 멈추고 앞쪽을 확인하세요.',
      voiceAlert: '잠시 후 불법 주차 다발 구역입니다. 천천히 걸으며 주차 차량을 주의하세요.',
      radius: 30,
    },
    {
      id: 'route-dz-2', type: 'unsignaled-crossing',
      title: '신호등 없는 횡단보도',
      description: '이 횡단보도에는 신호등이 없어 차가 먼저 지나갈 수 있습니다.',
      tip: '반드시 멈춰서 좌우를 두 번 확인한 뒤 건너세요.',
      voiceAlert: '잠시 후 신호등 없는 횡단보도입니다. 멈춰 서서 좌우를 두 번 확인하세요.',
      radius: 30,
    },
    {
      id: 'route-dz-3', type: 'blind-corner',
      title: '사각지대 모퉁이',
      description: '이 모퉁이에서 회전하는 차량은 보행자를 갑자기 만날 수 있습니다.',
      tip: '모퉁이를 돌기 전 반드시 멈추어 서서 차량 소리를 들어보세요.',
      voiceAlert: '잠시 후 사각지대 위험 모퉁이입니다. 속도를 늦추고 다가오는 차량 소리를 잘 들어보세요.',
      radius: 30,
    },
  ];

  return templates.map((tmpl, i) => {
    const pt = route[positions[i]] || route[Math.floor(route.length / 2)];
    return { ...tmpl, lat: pt.lat, lng: pt.lng };
  });
}

export function initMap(containerId, zones, onMarkerClick) {
  _dangerZones = zones;

  if (typeof kakao === 'undefined' || !kakao.maps) {
    _renderFallbackMap(containerId, zones, onMarkerClick);
    return;
  }

  kakao.maps.load(() => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const end = getEndCoord();
    const center = new kakao.maps.LatLng(end.lat, end.lng);
    _map = new kakao.maps.Map(container, { center, level: 5 });

    setTimeout(() => { if (_map) _map.relayout(); }, 300);

    _drawSafeRoute();
    _addStartMarker();
    _addSchoolMarker();
    _addDangerMarkers(zones, onMarkerClick);
    _fitBoundsToRoute();
    _listenPositionUpdates();
  });
}

export function highlightZone(zoneId) {
  const overlay = _markers[zoneId];
  if (!overlay) return;
  const el = overlay.__el;
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

// ── Private ───────────────────────────────────────────────

function _interpolateRoute(start, end, numSegments) {
  const pts = [];
  for (let i = 0; i <= numSegments; i++) {
    const t = i / numSegments;
    pts.push({
      lat: start.lat + t * (end.lat - start.lat),
      lng: start.lng + t * (end.lng - start.lng),
    });
  }
  return pts;
}

function _drawSafeRoute() {
  const route = getRoutePoints();
  console.log('[map] _drawSafeRoute points:', route.length, route[0], route[route.length - 1]);
  const path = route.map(p => new kakao.maps.LatLng(p.lat, p.lng));
  new kakao.maps.Polyline({
    path,
    strokeWeight: 6,
    strokeColor: '#40916C',
    strokeOpacity: 0.85,
    strokeStyle: 'solid',
    map: _map,
  });
}

function _addStartMarker() {
  if (!_startCoord) return;
  const pos = new kakao.maps.LatLng(_startCoord.lat, _startCoord.lng);
  const content = _buildMarkerHTML('🏠', '#1B4332', '출발');
  const overlay = new kakao.maps.CustomOverlay({ content, position: pos, yAnchor: 1 });
  overlay.setMap(_map);
}

function _addSchoolMarker() {
  const end = getEndCoord();
  const pos = new kakao.maps.LatLng(end.lat, end.lng);
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

    // Attach click handler to the DOM element
    // CustomOverlay.getContent() returns the element after setMap
    requestAnimationFrame(() => {
      const el = overlay.getContent();
      if (el && el.addEventListener) {
        el.style.transition = 'transform 0.2s ease';
        el.style.cursor = 'pointer';
        overlay.__el = el;
        el.addEventListener('click', () => onMarkerClick && onMarkerClick(zone));
      }
    });

    _markers[zone.id] = overlay;
  }
}

function _fitBoundsToRoute() {
  const route = getRoutePoints();
  if (!route || route.length < 2) return;
  const bounds = new kakao.maps.LatLngBounds();
  route.forEach(p => bounds.extend(new kakao.maps.LatLng(p.lat, p.lng)));
  _map.setBounds(bounds);
}

function _buildMarkerHTML(emoji, color, label) {
  return `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;transition:transform 0.2s ease;">
    <svg width="40" height="52" viewBox="0 0 40 52" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 0C9 0 0 9 0 20C0 32 20 52 20 52C20 52 40 32 40 20C40 9 31 0 20 0Z"
            fill="${color}" stroke="#1A1A2E" stroke-width="2"/>
      <text x="20" y="26" text-anchor="middle" font-size="18" fill="white">${emoji}</text>
    </svg>
    ${label ? `<div class="map-marker-label">${label}</div>` : ''}
  </div>`;
}

function _listenPositionUpdates() {
  document.addEventListener('positionUpdate', (e) => {
    const { lat, lng } = e.detail;
    updateUserPosition(lat, lng);
    if (_map) _map.panTo(new kakao.maps.LatLng(lat, lng));
  });
}

// ── Fallback map (no Kakao SDK) ───────────────────────────

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
        <p>실제 기기에서는 카카오 지도가 표시됩니다.</p>
      </div>
      <div class="demo-map__zones">${zoneCards}</div>
    </div>
  `;

  container.querySelectorAll('.demo-zone-card').forEach(card => {
    card.addEventListener('click', () => {
      const zone = zones.find(z => z.id === card.dataset.zoneId);
      if (zone) onMarkerClick && onMarkerClick(zone);
    });
  });
}
