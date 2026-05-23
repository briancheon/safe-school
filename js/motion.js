import {
  WALK_THRESHOLD,
  STOP_THRESHOLD,
  STOP_DURATION,
  WALK_CONFIRM_STEPS,
  MOTION_BUFFER_MS,
} from './config.js';
import { rollingStdDev } from './utils.js';

let _state = 'STOPPED';
let _walkCount = 0;
let _stopTimer = null;
let _buffer = []; // { t: ms, v: amag }
let _handler = null;
let _active = false;

export function getMotionState() {
  return _state;
}

export async function requestMotionPermission() {
  if (typeof DeviceMotionEvent === 'undefined') return 'unavailable';
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const result = await DeviceMotionEvent.requestPermission();
      return result; // 'granted' | 'denied'
    } catch {
      return 'denied';
    }
  }
  return 'granted'; // Android / non-iOS — no permission prompt needed
}

export function startMotionDetection() {
  if (!('DeviceMotionEvent' in window)) {
    document.dispatchEvent(new CustomEvent('motionUnavailable'));
    return false;
  }
  if (_active) return true;
  _active = true;
  _handler = _handleMotion;
  window.addEventListener('devicemotion', _handler);
  return true;
}

export function stopMotionDetection() {
  if (_handler) window.removeEventListener('devicemotion', _handler);
  _active = false;
  _buffer = [];
  _walkCount = 0;
  clearTimeout(_stopTimer);
  _stopTimer = null;
}

// Simulate walking for demo/testing (call from console: motionSimulate('WALKING'))
export function simulateState(targetState) {
  _applyStateChange(targetState);
}

function _handleMotion(event) {
  const { x, y, z } = event.accelerationIncludingGravity || {};
  if (x == null) return;

  // Remove gravity (9.8 m/s²) using simple magnitude subtraction
  const amag = Math.sqrt(x * x + y * y + z * z) - 9.8;
  const now = Date.now();

  _buffer.push({ t: now, v: amag });

  // Prune samples older than rolling window
  const cutoff = now - MOTION_BUFFER_MS;
  while (_buffer.length > 0 && _buffer[0].t < cutoff) _buffer.shift();

  if (_buffer.length < 5) return;

  const sigma = rollingStdDev(_buffer.map(b => b.v));
  _updateFSM(sigma);
}

function _updateFSM(sigma) {
  if (_state === 'STOPPED') {
    if (sigma > WALK_THRESHOLD) {
      _walkCount++;
      if (_walkCount >= WALK_CONFIRM_STEPS) {
        _walkCount = 0;
        _applyStateChange('WALKING');
      }
    } else {
      _walkCount = 0;
    }
  } else {
    if (sigma < STOP_THRESHOLD) {
      if (!_stopTimer) {
        _stopTimer = setTimeout(() => {
          _stopTimer = null;
          _applyStateChange('STOPPED');
        }, STOP_DURATION);
      }
    } else {
      clearTimeout(_stopTimer);
      _stopTimer = null;
    }
  }
}

function _applyStateChange(newState) {
  if (_state === newState) return;
  _state = newState;
  document.dispatchEvent(
    new CustomEvent('motionStateChange', { detail: { state: newState } })
  );
}
