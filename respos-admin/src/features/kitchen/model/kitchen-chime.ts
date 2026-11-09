/**
 * New-ticket chime via Web Audio (no asset). Browsers block audio until a user gesture,
 * so `unlock()` must be called from a click handler (the "sound on" toggle).
 */
type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;

function getAudioContextCtor(): AudioContextCtor | null {
  const scope = globalThis as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

export async function unlockChime(): Promise<boolean> {
  const Ctor = getAudioContextCtor();
  if (!Ctor) return false;
  try {
    context ??= new Ctor();
    if (context.state === 'suspended') await context.resume();
    return context.state === 'running';
  } catch (error) {
    console.warn('[kds] audio unavailable', error);
    return false;
  }
}

export function playChime(): void {
  if (!context || context.state !== 'running') return;
  const start = context.currentTime;
  [880, 1320].forEach((frequency, index) => {
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const at = start + index * 0.18;
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.4, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + 0.17);
  });
}
