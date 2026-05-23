export const KAKAO_API_KEY = 'cc07f9499d84c9f7115d9b39155e00cc';
// Get a free Tmap key at https://openapi.sk.com (1,000 req/day free)
export const TMAP_API_KEY = 'YOUR_TMAP_KEY';

// School gate (destination geofence center)
export const SCHOOL_GATE = { lat: 37.5512, lng: 126.9882 };
export const SCHOOL_GATE_RADIUS = 20; // metres

export const DANGER_ZONE_RADIUS = 30; // metres

// Motion FSM thresholds
export const WALK_THRESHOLD = 0.8;   // m/s² std-dev to enter WALKING
export const STOP_THRESHOLD = 0.3;   // m/s² std-dev to exit WALKING
export const STOP_DURATION  = 1000;  // ms stable below threshold before STOPPED
export const WALK_CONFIRM_STEPS = 3; // std-dev peaks above threshold before flip
export const MOTION_BUFFER_MS = 500; // rolling window duration

// Route deviation
export const ROUTE_DEVIATION_MAX = 50; // metres before safe-path bonus lost

// Safe route polyline (array of {lat, lng})
export const SAFE_ROUTE = [
  { lat: 37.5470, lng: 126.9845 },
  { lat: 37.5476, lng: 126.9850 },
  { lat: 37.5482, lng: 126.9856 },
  { lat: 37.5490, lng: 126.9861 },
  { lat: 37.5498, lng: 126.9868 },
  { lat: 37.5505, lng: 126.9875 },
  { lat: 37.5512, lng: 126.9882 },
];

// Gamification
export const POINTS_BASE       = 100;
export const POINTS_SAFE_PATH  = 50;
export const POINTS_NO_SMOMBIE = 50;
export const CERTIFICATE_THRESHOLD = 1000;

// Emergency call number (customize per family/school)
export const EMERGENCY_NUMBER = '112';

// localStorage keys
export const LS_KEY_STUDENT  = 'ssw_student';
export const LS_KEY_SESSIONS = 'ssw_sessions';
export const LS_KEY_ROUTE    = 'ssw_route';
