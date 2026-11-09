import { useCallback, useEffect, useState } from 'react';

/** The browser's "this site can be installed" event. Not in the standard DOM types yet. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  return ios && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/**
 * How this device can add the game to its home screen:
 * - `prompt`: the browser offers a one-tap install (Android, desktop Chrome and Edge).
 * - `ios`: Safari on iPhone and iPad has no prompt, so we explain the Share menu route.
 * - `none`: already installed, or the browser does not support it.
 */
export function useInstall(): { mode: 'prompt' | 'ios' | 'none'; install: () => void } {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(() => {
    if (!event) return;
    void event.prompt();
    void event.userChoice.then(() => setEvent(null));
  }, [event]);

  if (installed) return { mode: 'none', install };
  if (event) return { mode: 'prompt', install };
  return { mode: isIosSafari() ? 'ios' : 'none', install };
}

/** A short buzz on phones that support it. Does nothing elsewhere or when the player prefers less motion. */
export function buzz(pattern: number | number[]): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  navigator.vibrate?.(pattern);
}
