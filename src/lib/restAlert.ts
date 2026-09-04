import type { Preferences } from '../types';

type AudioContextConstructor = typeof AudioContext;

let sharedAudioContext: AudioContext | null = null;

function getAudioContext() {
  if (sharedAudioContext) return sharedAudioContext;
  const windowWithWebkit = window as typeof window & { webkitAudioContext?: AudioContextConstructor };
  const Context = window.AudioContext ?? windowWithWebkit.webkitAudioContext;
  if (!Context) return null;
  sharedAudioContext = new Context();
  return sharedAudioContext;
}

export function primeRestAlertAudio(enabled = true) {
  if (!enabled) return;
  const context = getAudioContext();
  if (!context) return;

  const unlock = () => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    gain.gain.value = 0.0001;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.025);
  };

  if (context.state === 'suspended') {
    void context.resume().then(unlock).catch(() => undefined);
  } else {
    unlock();
  }
}

export function playRestAlert(sound: Preferences['restAlertSound']) {
  const context = getAudioContext();
  if (!context) return;

  const start = () => {
    if (sound === 'bell') {
      [0, 0.82, 1.64, 2.46].forEach((delay, index) => {
        const finalTone = index === 3;
        playTone(context, 784, delay, finalTone ? 1.25 : 0.62, 'sine', 0.42);
        playTone(context, 1175, delay + 0.025, finalTone ? 1.15 : 0.72, 'sine', 0.2);
        playTone(context, 1568, delay + 0.05, finalTone ? 0.9 : 0.55, 'sine', 0.09);
      });
      return;
    }

    [0, 0.38, 0.92, 1.3, 1.84, 2.22].forEach((delay, index) => {
      playTone(context, index % 2 === 0 ? 880 : 1175, delay, 0.24, 'square', 0.24);
    });
    playTone(context, 1397, 2.72, 0.72, 'square', 0.28);
  };

  if (context.state === 'suspended') {
    void context.resume().then(start).catch(() => undefined);
  } else {
    start();
  }
}

function playTone(
  context: AudioContext,
  frequency: number,
  delay: number,
  duration: number,
  type: OscillatorType,
  volume: number,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const startsAt = context.currentTime + delay;
  const endsAt = startsAt + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startsAt);
  gain.gain.setValueAtTime(0.0001, startsAt);
  gain.gain.exponentialRampToValueAtTime(volume, startsAt + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startsAt);
  oscillator.stop(endsAt + 0.03);
}
