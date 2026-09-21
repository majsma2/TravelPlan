// 共享领域类型（后端）

export interface NodeData {
  id: string;
  day_id: string;
  order: number;
  type: string;
  name: string;
  address: string;
  lng: number | null;
  lat: number | null;
  arrive_time: string | null;
  leave_time: string | null;
  play_duration: number;
  note: string;
  images: string[];
  manual_time: number;
}

export interface DayData {
  id: string;
  trip_id?: string;
  date: string;
  order: number;
  departure_time: string | null;
  nodes: NodeData[];
}

export interface TripPayload {
  id: string;
  token: string;
  title: string;
  route_preference: number;
  auto_link: number;
  locked: number; // 0/1 是否锁定
  start_date: string;
  days: DayData[];
}

export interface DrivingResult {
  distance: number; // 米
  duration: number; // 秒
  polyline: string; // 高德原始 polyline 串（分号分隔 lng,lat）
  status: 'ok' | 'no_route' | 'error' | 'rest';
  source: 'cache' | 'amap';
}

export interface DrivingResponse extends DrivingResult {
  message?: string;
}

// 扩展 Express Request，挂载行程 ID
declare global {
  namespace Express {
    interface Request {
      tripId?: string;
      tripToken?: string;
    }
  }
}
