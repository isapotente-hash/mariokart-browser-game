export const config = {
  title: import.meta.env?.VITE_GAME_TITLE || 'Pocket Circuit',
  simulation: { step: 1 / 60, maxFrame: 0.1, maxSteps: 6 },
  kart: {
    maxSpeed: 27,
    reverseSpeed: 8,
    acceleration: 13,
    braking: 27,
    drag: 0.18,
    grip: 10,
    steering: 1.85,
    offRoadSpeed: 13,
    reverseDelay: 0.3,
    radius: 0.85,
  },
  camera: { distance: 10, height: 5.2, lookAhead: 7, smoothing: 7 },
} as const;
