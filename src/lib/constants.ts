// App constants
export const MOTION_ACTIVE_DURATION_MS = 10000;

// Default motion sensitivity settings
export const DEFAULT_DIFF_THRESHOLD = 25;
export const DEFAULT_MOTION_PIXEL_RATIO = 0.01;
export const DEFAULT_INTERVAL_MS = 200;

// Telegram defaults
export const DEFAULT_DEBOUNCE_TIME_MS = 5000;

// Motion detection messages
export const MOTION_DETECTED_MESSAGE_PREFIX = "Movement detected at";

// Status command messages
export const STATUS_COMMAND = "status";
export const STATUS_RESPONSE_PREFIX = "System status: All systems operational 🚀";
export const STATUS_TIMESTAMP_PREFIX = "Captured at";

// Camera settings
export const CAMERA_PERMISSION_ERROR = "Camera permission denied. Please allow camera access.";
export const NO_CAMERAS_FOUND_ERROR = "No cameras found.";
export const FAILED_TO_ACCESS_CAMERAS_ERROR = "Failed to access cameras.";

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  ADD_CAMERA: 'a',
  TOGGLE_THEME: 't',
  TOGGLE_CAMERAS: 'h',
} as const;



// Motion sensitivity ranges
export const MOTION_SENSITIVITY_RANGES = {
  DIFF_THRESHOLD: { MIN: 1, MAX: 100 },
  PIXEL_RATIO: { MIN: 0.001, MAX: 0.1 },
  INTERVAL: { MIN: 50, MAX: 1000 },
} as const;
