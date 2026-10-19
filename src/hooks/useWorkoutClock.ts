import { useEffect, useState } from 'react';

/** UI clock only. Rest completion remains based on absolute timestamps/Web Push. */
export function useWorkoutClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let interval: number | undefined;
    const update = () => setNow(Date.now());
    const sync = () => {
      window.clearInterval(interval);
      update();
      if (document.visibilityState === 'visible') interval = window.setInterval(update, 1000);
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', sync); };
  }, []);
  return now;
}
