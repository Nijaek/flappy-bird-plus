// Flappy Bird Plus - Game Constants and Configuration

// =============================================================================
// COLOR PALETTE (from UI Style Guide)
// =============================================================================

export const COLORS = {
  // Sky & Background
  sky: '#70C5CE',
  skyLight: '#87CEEB',
  cloudWhite: '#FFFFFF',

  // Ground & Environment
  grassGreen: '#80B038',
  grassDark: '#5A8028',
  groundTan: '#d8d393',
  groundDark: '#bcb780',  // Second ground grid color

  // Pipes
  pipeGreen: '#73BF2E',
  pipeLight: '#8CD038',
  pipeDark: '#557B1F',
  pipeCapGreen: '#58A020',
  pipeCapLight: '#6DC030',
  pipeCapDark: '#3D7010',

  // Bird (Default Yellow)
  birdYellow: '#F8E848',
  birdDark: '#e6c91d',  // Secondary bird color (10% darker)
  beakOrange: '#F88028',
  beakRed: '#D85020',
  eyeWhite: '#FFFFFF',
  eyeBlack: '#000000',
  wingTip: '#E85048',

  // Bird Variants
  birdBlue: '#68C8D8',
  birdBlueDark: '#4898A8',
  birdRed: '#E85858',
  birdRedDark: '#B83838',

  // UI Elements
  panelTan: '#DEB858',
  panelLight: '#F8E8A8',
  panelDark: '#8B6914',
  buttonCream: '#F8F0D8',
  buttonBorder: '#8B6914',

  // Text Colors
  textWhite: '#FFFFFF',
  textOrange: '#F87820',
  textOutline: '#543810',
  textShadow: '#000000',

  // Accent Colors
  playGreen: '#58A028',
  medalBronze: '#CD7F32',
  medalSilver: '#C0C0C0',
  medalGold: '#FFD700',
  medalPlatinum: '#E5E4E2',
  newSparkle: '#F85858',
  coinGold: '#FFD700',

  // City/Background
  cityGreen: '#A0D838',
  bushGreen: '#80C020',
} as const;

// =============================================================================
// GAME DIMENSIONS
// =============================================================================

export const GAME = {
  // Base canvas dimensions (will be scaled)
  WIDTH: 288,
  HEIGHT: 512,

  // Ground
  GROUND_HEIGHT: 112,
  GRASS_HEIGHT: 12,

  // Bird
  BIRD_WIDTH: 34,
  BIRD_HEIGHT: 24,
  BIRD_X: 80, // Fixed X position for bird

  // Pipes
  PIPE_WIDTH: 52,
  PIPE_GAP: 100,
  PIPE_CAP_HEIGHT: 26,

  // Physics
  GRAVITY: 0.5,
  FLAP_VELOCITY: -8,
  PIPE_SPEED: 2,

  // Timing
  FIXED_TIMESTEP: 1000 / 60, // 60 FPS
  BIRD_ANIMATION_SPEED: 150, // ms per frame
} as const;

// =============================================================================
// ANIMATION CONSTANTS
// =============================================================================

export const ANIMATION = {
  // Title bounce
  TITLE_BOUNCE_AMPLITUDE: 8,
  TITLE_BOUNCE_SPEED: 0.003,

  // Bird hover (on home screen)
  BIRD_HOVER_AMPLITUDE: 8,
  BIRD_HOVER_SPEED: 0.004,

  // UI transitions
  BUTTON_PRESS_SCALE: 0.95,
  MODAL_FADE_DURATION: 200,
} as const;

// =============================================================================
// SPRITE DEFINITIONS (for drawing without images)
// =============================================================================

// Bird wing positions for animation
export const BIRD_FRAMES = {
  UP: 0,
  MID: 1,
  DOWN: 2,
} as const;

// Ground pattern
export const GROUND_PATTERN = {
  gridSize: 16,
  gridColors: [COLORS.groundTan, COLORS.groundDark],
} as const;
