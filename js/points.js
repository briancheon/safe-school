import {
  POINTS_BASE,
  POINTS_SAFE_PATH,
  POINTS_NO_SMOMBIE,
  CERTIFICATE_THRESHOLD,
  LS_KEY_SESSIONS,
} from './config.js';

let _smombieCount = 0;
let _deviationFlagged = false;
let _sessionFinalized = false;

export function initPoints() {
  _smombieCount = 0;
  _deviationFlagged = false;
  _sessionFinalized = false;

  document.addEventListener('motionStateChange', _onMotionChange);
  document.addEventListener('routeDeviated', _onDeviated);
}

export function cleanupPoints() {
  document.removeEventListener('motionStateChange', _onMotionChange);
  document.removeEventListener('routeDeviated', _onDeviated);
}

function _onMotionChange(e) {
  if (e.detail.state === 'WALKING') _smombieCount++;
}

function _onDeviated() {
  _deviationFlagged = true;
}

export function getSessionScore() {
  const base       = POINTS_BASE;
  const safePath   = _deviationFlagged ? 0 : POINTS_SAFE_PATH;
  const noSmombie  = _smombieCount === 0 ? POINTS_NO_SMOMBIE : 0;
  return {
    base,
    safePath,
    noSmombie,
    total: base + safePath + noSmombie,
    smombieCount: _smombieCount,
    deviated: _deviationFlagged,
  };
}

export function finalizeSession() {
  if (_sessionFinalized) return getSessionScore();
  _sessionFinalized = true;

  const score = getSessionScore();
  const sessions = _loadSessions();
  sessions.push({ date: new Date().toISOString(), ...score });
  _saveSessions(sessions);
  return score;
}

export function getCumulativeScore() {
  return _loadSessions().reduce((sum, s) => sum + (s.total || 0), 0);
}

export function getCertificateUnlocked() {
  return getCumulativeScore() >= CERTIFICATE_THRESHOLD;
}

function _loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY_SESSIONS) || '[]');
  } catch {
    return [];
  }
}

function _saveSessions(sessions) {
  try {
    localStorage.setItem(LS_KEY_SESSIONS, JSON.stringify(sessions));
  } catch {
    // storage unavailable — continue without persistence
  }
}
