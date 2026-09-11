import { useEffect, useRef } from 'react';
import { useTripStore } from '../stores/tripStore';

/** 行程变化后防抖 2s 自动保存到后端 */
export function useAutoSave() {
  const trip = useTripStore((s) => s.trip);
  const status = useTripStore((s) => s.status);
  const persistTrip = useTripStore((s) => s.persistTrip);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (status !== 'ready' || !trip) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void persistTrip();
    }, 2000);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [trip, status, persistTrip]);
}
