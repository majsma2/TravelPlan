// 前端领域类型（与后端 store 字段保持一致）

export type NodeType = 'scenic' | 'hotel' | 'food' | 'parking' | 'rest' | 'custom';

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  scenic: '景点',
  hotel: '酒店',
  food: '餐饮',
  parking: '驻车',
  rest: '休整',
  custom: '自定义',
};

export const NODE_TYPE_ICONS: Record<NodeType, string> = {
  scenic: '🏛️',
  hotel: '🏨',
  food: '🍜',
  parking: '🅿️',
  rest: '⏸️',
  custom: '📍',
};

// 路线偏好：UI 文案 → 高德 v5 strategy
export const ROUTE_PREFERENCES: { value: number; label: string }[] = [
  { value: 32, label: '默认' },
  { value: 34, label: '优先高速' },
  { value: 35, label: '避开高速' },
];

export interface NodeData {
  id: string;
  day_id: string;
  order: number;
  type: NodeType;
  name: string;
  address: string;
  lng: number | null;
  lat: number | null;
  arrive_time: string | null; // HH:mm
  leave_time: string | null; // HH:mm
  play_duration: number; // 分钟
  note: string;
  images: string[];
  manual_time: number; // 0/1 是否手动覆盖时间
}

export interface DayData {
  id: string;
  trip_id?: string;
  date: string; // yyyy-MM-dd
  order: number;
  departure_time: string | null; // HH:mm 当日有前日酒店虚拟起点时的早晨出发时间
  nodes: NodeData[];
}

export interface TripPayload {
  id: string;
  token: string;
  title: string;
  route_preference: number; // 32/34/35
  auto_link: number; // 0/1
  start_date: string; // yyyy-MM-dd
  days: DayData[];
}

export interface DrivingResponse {
  distance: number; // 米
  duration: number; // 秒
  polyline: string;
  status: 'ok' | 'no_route' | 'error' | 'rest';
  source: 'cache' | 'amap';
  message?: string;
}

/** 行程列表摘要（管理页用） */
export interface TripSummary {
  id: string;
  token: string;
  title: string;
  start_date: string;
  days_count: number;
  nodes_count: number;
  created_at: string;
  updated_at: string;
}
