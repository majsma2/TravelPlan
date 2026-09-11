import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 行/集合 类型
export interface TripRow {
  id: string;
  token: string;
  title: string;
  route_preference: number;
  auto_link: number;
  start_date: string;
  created_at: string;
  updated_at: string;
}
export interface DayRow {
  id: string;
  trip_id: string;
  date: string;
  order: number;
  departure_time: string | null;
}
export interface NodeRow {
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
export interface SegmentRow {
  cache_key: string;
  distance: number;
  duration: number;
  polyline: string;
  strategy: number;
  status: string;
  created_at: string;
}
export interface LogRow {
  id: number;
  called_at: string;
  origin: string;
  destination: string;
  strategy: number;
  status: string;
  source: string;
}

export interface DB {
  trips: TripRow[];
  days: DayRow[];
  nodes: NodeRow[];
  segments: SegmentRow[];
  logs: LogRow[];
  _logSeq: number;
}

const DB_FILE = path.resolve(__dirname, '../../data/travelplan.json');

let db: DB;

function emptyDb(): DB {
  return { trips: [], days: [], nodes: [], segments: [], logs: [], _logSeq: 0 };
}

/** 初始化：加载 JSON 文件，不存在则创建空库 */
export function initDb(): void {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      db = { ...emptyDb(), ...JSON.parse(raw) };
    } catch (e) {
      logger.error('db', `parse failed, starting fresh: ${(e as Error).message}`);
      db = emptyDb();
    }
  } else {
    db = emptyDb();
  }
  persist();
  logger.info('db', `opened ${DB_FILE}`);
}

export function getDb(): DB {
  if (!db) throw new Error('DB not initialized. Call initDb() first.');
  return db;
}

/** 同步持久化（个人单用户工具，写量低，同步写安全） */
export function persist(): void {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}
