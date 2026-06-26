import { useEffect, useRef } from "react";

type NoteOptions = {
  attack?: number;
  decay?: number;
  duration?: number;
  gain?: number;
  pan?: number;
  type?: OscillatorType;
};

type BgmLoop = {
  timer: number | null;
  step: number;
};

export type ArcadeAudio = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  arm: () => void;
  playGrab: () => void;
  playThrow: () => void;
  playDenied: () => void;
  playSpin: (intensity?: number) => void;
  playResult: () => void;
};

const SOUND_KEY = "lunch-dart:sound-enabled";

const readStoredEnabled = () => {
  if (typeof window === "undefined") {
    return true;
  }

  return localStorage.getItem(SOUND_KEY) !== "off";
};

export const useArcadeAudio = (
  enabled: boolean,
  setEnabled: (enabled: boolean) => void,
  playingActive: boolean,
): ArcadeAudio => {
  const contextRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const bgmRef = useRef<BgmLoop>({ timer: null, step: 0 });

  const ensureContext = () => {
    if (typeof window === "undefined") {
      return null;
    }

    if (!contextRef.current) {
      const context = new window.AudioContext();
      const master = context.createGain();
      master.gain.value = 0.18;
      master.connect(context.destination);
      contextRef.current = context;
      masterRef.current = master;
    }

    return contextRef.current;
  };

  const arm = () => {
    const context = ensureContext();
    if (context?.state === "suspended") {
      void context.resume();
    }
  };

  const playNote = (frequency: number, options: NoteOptions = {}) => {
    if (!enabled) {
      return;
    }

    const context = ensureContext();
    const master = masterRef.current;
    if (!context || !master) {
      return;
    }

    if (context.state === "suspended") {
      void context.resume();
    }

    const now = context.currentTime;
    const attack = options.attack ?? 0.01;
    const decay = options.decay ?? 0.16;
    const duration = options.duration ?? 0.18;
    const gainValue = options.gain ?? 0.14;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const panner = context.createStereoPanner();

    oscillator.type = options.type ?? "triangle";
    oscillator.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration + decay);
    panner.pan.value = options.pan ?? 0;

    oscillator.connect(gain);
    gain.connect(panner);
    panner.connect(master);
    oscillator.start(now);
    oscillator.stop(now + duration + decay + 0.03);
  };

  const stopBgm = () => {
    if (bgmRef.current.timer) {
      window.clearTimeout(bgmRef.current.timer);
      bgmRef.current.timer = null;
    }
  };

  const startBgm = () => {
    if (!enabled || bgmRef.current.timer) {
      return;
    }

    arm();
    const phrase = [261.63, 329.63, 392.0, 329.63, 293.66, 349.23, 440.0, 349.23];

    const tick = () => {
      const index = bgmRef.current.step % phrase.length;
      const base = phrase[index];
      playNote(base, { duration: 0.12, decay: 0.12, gain: 0.05, pan: index % 2 === 0 ? -0.18 : 0.18, type: "sine" });
      if (index % 2 === 0) {
        playNote(base / 2, { duration: 0.08, decay: 0.08, gain: 0.035, pan: 0, type: "triangle" });
      }
      bgmRef.current.step += 1;
      bgmRef.current.timer = window.setTimeout(tick, 420);
    };

    bgmRef.current.step = 0;
    bgmRef.current.timer = window.setTimeout(tick, 120);
  };

  useEffect(() => {
    localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
    if (!enabled) {
      stopBgm();
    }
  }, [enabled]);

  useEffect(() => {
    if (playingActive && enabled) {
      startBgm();
      return;
    }

    stopBgm();
  }, [enabled, playingActive]);

  useEffect(() => {
    return () => {
      stopBgm();
      contextRef.current?.close().catch(() => {});
    };
  }, []);

  return {
    enabled,
    setEnabled,
    arm,
    playGrab: () => {
      playNote(620, { duration: 0.05, decay: 0.08, gain: 0.08, pan: -0.12 });
      playNote(780, { duration: 0.05, decay: 0.08, gain: 0.06, pan: 0.12 });
    },
    playThrow: () => {
      playNote(540, { duration: 0.06, decay: 0.09, gain: 0.08, pan: -0.16, type: "sawtooth" });
      playNote(860, { duration: 0.08, decay: 0.14, gain: 0.1, pan: 0.18, type: "triangle" });
    },
    playDenied: () => {
      playNote(220, { duration: 0.06, decay: 0.14, gain: 0.06, pan: 0, type: "square" });
      playNote(196, { duration: 0.05, decay: 0.12, gain: 0.04, pan: 0, type: "square" });
    },
    playSpin: (intensity = 1) => {
      const clamped = Math.max(0.8, Math.min(1.8, intensity));
      playNote(320 * clamped, { duration: 0.08, decay: 0.12, gain: 0.07, pan: -0.24, type: "triangle" });
      playNote(420 * clamped, { duration: 0.1, decay: 0.15, gain: 0.08, pan: 0.24, type: "sine" });
    },
    playResult: () => {
      playNote(392.0, { duration: 0.12, decay: 0.16, gain: 0.08, pan: -0.2 });
      window.setTimeout(() => playNote(523.25, { duration: 0.14, decay: 0.18, gain: 0.1, pan: 0 }), 80);
      window.setTimeout(() => playNote(659.25, { duration: 0.16, decay: 0.2, gain: 0.11, pan: 0.2 }), 160);
    },
  };
};

export const createInitialSoundEnabled = () => readStoredEnabled();
