export const RACE_TRACK_STACK_Z_OFFSET = 0.012;
export const RACE_EVENT_STACK_Y_OFFSET = 0.7;
export const RACE_TRACK_START_X = -4.25;
export const RACE_TRACK_END_X = 3.55;
export const RACE_TRACK_RAIL_ZS = [-1.62, 1.72] as const;
export const RACE_TRACK_RAIL_Y_OFFSETS = [-0.02, 0] as const;
export const RACE_TRACK_SHADOW_Y_OFFSETS = [-0.02, 0] as const;
export const RACE_TRACK_RAIL_WIDTH = RACE_TRACK_END_X - RACE_TRACK_START_X + 0.9;
export const RACE_TRACK_RAIL_DEPTH = 0.82;
export const RACE_TRACK_FINISH_WIDTH = 0.18;
export const RACE_PLATE_SPRITE_WIDTH = 0.58;
export const RACE_PLATE_SPRITE_HEIGHT = 0.87;
export const RACE_PLATE_ENTRY_X = RACE_TRACK_END_X + 0.92;
export const RACE_PLATE_RAIL_BOTTOM_Y = 0.035;
export const RACE_PLATE_RAIL_FRONT_Z_OFFSET = 0.025;

export const CHOPSTICK_CONTACT_PROGRESS = 0.42;
export const CHOPSTICK_VISIBLE_END_PROGRESS = 0.96;

export const getChopstickGrabPhase = (progress: number) => {
  const approachProgress = Math.min(1, progress / CHOPSTICK_CONTACT_PROGRESS);
  const carryProgress = Math.min(
    1,
    Math.max(0, (progress - CHOPSTICK_CONTACT_PROGRESS) / (1 - CHOPSTICK_CONTACT_PROGRESS)),
  );

  return {
    approachProgress,
    carryProgress,
    isContacted: progress >= CHOPSTICK_CONTACT_PROGRESS,
  };
};
