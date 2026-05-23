import {
  SCHOOL_GATE,
  SCHOOL_GATE_RADIUS,
  DANGER_ZONE_RADIUS,
  ROUTE_DEVIATION_MAX,
  SAFE_ROUTE,
} from './config.js';
import { haversine, distToPolyline } from './utils.js';

let _watchId = null;
let _dangerZones = [];
let _activeZoneIds = new Set();
let _deviationFlagged = false;
let _arrived = false;
let _lastPosition = null;

export function setDangerZones(zones) {
  _dangerZones = zones;
}

export function getLastPosition() {
  return _lastPosition;
}

export function startGeofencing() {
  if (!('geolocation' in navigator)) {
    document.dispatchEvent(new CustomEvent('gpsUnavailable'));
    return false;
  }
  if (_watchId !== null) return true;

  _watchId = navigator.geolocation.watchPosition(
    _onPosition,
    _onError,
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
  return true;
}

export function stopGeofencing() {
  if (_watchId !== null) {
    navigator.geolocation.clearWatch(_watchId);
    _watchId = null;
  }
}

// Expose deviation percent for points calculation
export function getDeviationFlagged() {
  return _deviationFlagged;
}

// Simulate a position update for demo/testing
export function simulatePosition(lat, lng) {
  _onPosition({ coords: { latitude: lat, longitude: lng, accuracy: 5 } });
}

function _onPosition(pos) {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  _lastPosition = { lat, lng };

  document.dispatchEvent(new CustomEvent('positionUpdate', { detail: { lat, lng } }));

  if (_arrived) return;

  _checkSchoolArrival(lat, lng);
  _checkDangerZones(lat, lng);
  _checkRouteDeviation(lat, lng);
}

function _checkSchoolArrival(lat, lng) {
  const dist = haversine(lat, lng, SCHOOL_GATE.lat, SCHOOL_GATE.lng);
  if (dist <= SCHOOL_GATE_RADIUS) {
    _arrived = true;
    stopGeofencing();
    document.dispatchEvent(new CustomEvent('schoolArrival', { detail: { lat, lng } }));
  }
}

function _checkDangerZones(lat, lng) {
  for (const zone of _dangerZones) {
    const radius = zone.radius || DANGER_ZONE_RADIUS;
    const dist = haversine(lat, lng, zone.lat, zone.lng);
    const inside = dist < radius;
    const hysteresisDist = radius * 1.5;

    if (inside && !_activeZoneIds.has(zone.id)) {
      _activeZoneIds.add(zone.id);
      document.dispatchEvent(new CustomEvent('dangerZoneEnter', { detail: { zone } }));
    } else if (dist > hysteresisDist && _activeZoneIds.has(zone.id)) {
      _activeZoneIds.delete(zone.id);
      document.dispatchEvent(new CustomEvent('dangerZoneExit', { detail: { zoneId: zone.id } }));
    }
  }
}

function _checkRouteDeviation(lat, lng) {
  if (_deviationFlagged) return;
  const distFromRoute = distToPolyline(lat, lng, SAFE_ROUTE);
  if (distFromRoute > ROUTE_DEVIATION_MAX) {
    _deviationFlagged = true;
    document.dispatchEvent(
      new CustomEvent('routeDeviated', { detail: { distanceM: distFromRoute } })
    );
  }
}

function _onError(err) {
  console.warn('Geolocation error:', err.message);
  document.dispatchEvent(new CustomEvent('gpsError', { detail: { code: err.code, message: err.message } }));
}
