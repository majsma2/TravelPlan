import { useEffect, useRef, useState } from 'react';
import { loadAmap } from '../../services/amapJs';
import {
  useTripStore,
  getSnapshot,
  selectSegmentResult,
  selectPrevDayHotel,
} from '../../stores/tripStore';
import { useUIStore } from '../../stores/uiStore';
import { parsePolyline } from '../../utils/geo';
import { driveSummary } from '../../utils/format';

const DAY_COLORS = [
  '#2563eb',
  '#16a34a',
  '#db2777',
  '#ea580c',
  '#7c3aed',
  '#0891b2',
];

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化地图
  useEffect(() => {
    let mounted = true;
    loadAmap()
      .then((AMap) => {
        if (!mounted || !containerRef.current) return;
        mapRef.current = new AMap.Map(containerRef.current, {
          zoom: 6,
          viewMode: '2D',
        });
        setMapReady(true);
      })
      .catch((e: Error) => {
        console.error('[MapView] amap load failed', e);
        setError(e.message);
      });
    return () => {
      mounted = false;
      mapRef.current?.destroy?.();
      mapRef.current = null;
    };
  }, []);

  // 行程变化重绘覆盖物
  const snapshot = useTripStore((s) => getSnapshot(s));
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);

  useEffect(() => {
    const map = mapRef.current;
    const AMap = (window as any).AMap;
    if (!map || !AMap || !mapReady) return;

    // 清除旧覆盖物
    overlaysRef.current.forEach((o) => map.remove(o));
    overlaysRef.current = [];

    const fitMarkers: any[] = [];

    snapshot.days.forEach((day, di) => {
      const color = DAY_COLORS[di % DAY_COLORS.length];

      // 节点标记
      day.nodes.forEach((n) => {
        if (n.lng == null || n.lat == null) return;
        const isSel = n.id === selectedNodeId;
        const marker = new AMap.Marker({
          position: [n.lng, n.lat],
          title: n.name || '节点',
          label: {
            content: `<div style="padding:1px 4px;font-size:12px;background:#fff;border:1px solid ${color};border-radius:3px;color:${color}">${di + 1}-${n.order + 1}</div>`,
            direction: 'top',
          },
          ...(isSel ? { icon: undefined } : {}),
        });
        marker.setExtData({ nodeId: n.id });
        marker.on('click', () => {
          useUIStore.getState().selectNode(n.id);
        });
        map.add(marker);
        overlaysRef.current.push(marker);
        fitMarkers.push(marker);
      });

      // 虚拟起点段：前一天酒店 → 当天首节点
      const prevHotel = selectPrevDayHotel(useTripStore.getState(), day.id);
      const firstNode = day.nodes[0];
      if (prevHotel && firstNode && prevHotel.lng != null && prevHotel.lat != null && firstNode.lng != null && firstNode.lat != null) {
        const res = selectSegmentResult(useTripStore.getState(), prevHotel, firstNode);
        if (res && res.polyline) {
          const path = parsePolyline(res.polyline);
          if (path.length > 1) {
            const poly = new AMap.Polyline({
              path,
              strokeColor: color,
              strokeWeight: 4,
              strokeOpacity: 0.85,
              strokeStyle: 'dashed',
              lineJoin: 'round',
            });
            map.add(poly);
            overlaysRef.current.push(poly);
          }
        }
      }

      // 分段路线
      for (let i = 1; i < day.nodes.length; i++) {
        const a = day.nodes[i - 1];
        const b = day.nodes[i];
        if (a.lng == null || b.lng == null) continue;

        const res = selectSegmentResult(useTripStore.getState(), a, b);
        if (res && res.polyline) {
          const path = parsePolyline(res.polyline);
          if (path.length > 1) {
            const poly = new AMap.Polyline({
              path,
              strokeColor: color,
              strokeWeight: 4,
              strokeOpacity: 0.85,
              lineJoin: 'round',
            });
            const info = new AMap.InfoWindow({
              offset: new AMap.Pixel(0, -20),
            });
            poly.on('click', (e: any) => {
              info.setContent(
                `<div style="font-size:13px">${driveSummary(
                  res.distance,
                  res.duration
                )}</div>`
              );
              info.setPosition(e.lnglat);
              info.open(map);
            });
            map.add(poly);
            overlaysRef.current.push(poly);
            continue;
          }
        }
        // 无路线：虚线直连
        const line = new AMap.Polyline({
          path: [
            [a.lng, a.lat],
            [b.lng, b.lat],
          ],
          strokeColor: '#9ca3af',
          strokeWeight: 2,
          strokeStyle: 'dashed',
          strokeOpacity: 0.7,
        });
        map.add(line);
        overlaysRef.current.push(line);
      }
    });

    if (fitMarkers.length) {
      map.setFitView(fitMarkers, false, [50, 50, 50, 50]);
    }
  }, [snapshot, selectedNodeId, mapReady]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-center p-6 text-gray-500 bg-gray-100">
        <div>
          <div className="text-3xl mb-2">🗺️</div>
          <div className="text-sm">{error}</div>
          <div className="text-xs text-gray-400 mt-2">
            请在 server/.env 配置 AMAP_JS_KEY 与 AMAP_JS_SECURITY
          </div>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
