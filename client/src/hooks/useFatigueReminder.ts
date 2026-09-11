import { useEffect, useRef } from 'react';
import { useTripStore, selectDayTotals } from '../stores/tripStore';
import { useUIStore } from '../stores/uiStore';
import { humanDuration } from '../utils/format';

const FATIGUE_THRESHOLD = 6 * 3600; // 6 小时（秒）

/** 当日累计驾驶时长 > 6 小时，弹窗提醒增加休息/驻车节点 */
export function useFatigueReminder() {
  const trip = useTripStore((s) => s.trip);
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!trip) return;
    for (const day of trip.days) {
      const totals = selectDayTotals(useTripStore.getState(), day.id);
      if (
        totals.duration > FATIGUE_THRESHOLD &&
        !notifiedRef.current.has(day.id)
      ) {
        notifiedRef.current.add(day.id);
        useUIStore
          .getState()
          .pushToast(
            'warn',
            `${day.date} 累计驾驶 ${humanDuration(totals.duration)}，建议增加休息/驻车节点`
          );
      }
    }
    // 清理已删除的 day 记录
    const dayIds = new Set(trip.days.map((d) => d.id));
    for (const id of [...notifiedRef.current]) {
      if (!dayIds.has(id)) notifiedRef.current.delete(id);
    }
  }, [trip]);
}
