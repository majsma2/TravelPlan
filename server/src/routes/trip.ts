import { Router } from 'express';
import crypto from 'node:crypto';
import { getDb, persist } from '../db/store.js';
import { tokenAuth } from '../middleware/tokenAuth.js';
import { logger } from '../utils/logger.js';
import type { TripPayload, DayData, NodeData } from '../types.js';
import type { TripRow } from '../db/store.js';

const router = Router();

function loadTrip(token: string): TripPayload | null {
  const db = getDb();
  const trip = db.trips.find((t) => t.token === token);
  if (!trip) return null;

  const days = db.days
    .filter((d) => d.trip_id === trip.id)
    .sort((a, b) => a.order - b.order);

  const daysPayload: DayData[] = days.map((d) => {
    const nodes = db.nodes
      .filter((n) => n.day_id === d.id)
      .sort((a, b) => a.order - b.order);
    return {
      id: d.id,
      trip_id: d.trip_id,
      date: d.date,
      order: d.order,
      departure_time: d.departure_time ?? null,
      nodes,
    };
  });

  return {
    id: trip.id,
    token: trip.token,
    title: trip.title,
    route_preference: trip.route_preference,
    auto_link: trip.auto_link,
    start_date: trip.start_date,
    days: daysPayload,
  };
}

/** GET /api/trips — 列出所有行程（摘要） */
router.get('/', (_req, res) => {
  const db = getDb();
  const list = db.trips
    .slice()
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .map((t) => ({
      id: t.id,
      token: t.token,
      title: t.title,
      start_date: t.start_date,
      days_count: db.days.filter((d) => d.trip_id === t.id).length,
      nodes_count: db.days
        .filter((d) => d.trip_id === t.id)
        .reduce(
          (sum, d) => sum + db.nodes.filter((n) => n.day_id === d.id).length,
          0
        ),
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));
  res.json(list);
});

/** DELETE /api/trip/:token — 删除行程及其所有天与节点 */
router.delete('/:token', tokenAuth, (req, res) => {
  const db = getDb();
  const trip = db.trips.find((t) => t.token === req.tripToken);
  if (!trip) {
    res.status(404).json({ error: 'trip_not_found' });
    return;
  }
  const dayIds = new Set(
    db.days.filter((d) => d.trip_id === trip.id).map((d) => d.id)
  );
  db.days = db.days.filter((d) => d.trip_id !== trip.id);
  db.nodes = db.nodes.filter((n) => !dayIds.has(n.day_id));
  db.trips = db.trips.filter((t) => t.id !== trip.id);
  persist();
  logger.info('trip', `deleted ${trip.id}`);
  res.json({ ok: true });
});

/** POST /api/trip — 创建行程，返回 token */
router.post('/', (req, res) => {
  const db = getDb();
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(16).toString('hex');
  const now = new Date().toISOString();
  const title = (req.body?.title as string) || '我的自驾行程';

  const row: TripRow = {
    id,
    token,
    title,
    route_preference: 32,
    auto_link: 1,
    start_date: now.slice(0, 10),
    created_at: now,
    updated_at: now,
  };
  db.trips.push(row);
  persist();
  logger.info('trip', `created ${id} token=${token.slice(0, 8)}…`);
  res.json({ id, token });
});

/** GET /api/trip/:token — 拉取整条行程 */
router.get('/:token', tokenAuth, (req, res) => {
  const payload = loadTrip(req.tripToken!);
  if (!payload) {
    res.status(404).json({ error: 'trip_not_found' });
    return;
  }
  res.json(payload);
});

/** PUT /api/trip/:token — 整体保存（更新行程字段 + 全量重建 days/nodes） */
router.put('/:token', tokenAuth, (req, res) => {
  const payload = req.body as Partial<TripPayload>;
  const db = getDb();
  const now = new Date().toISOString();

  const trip = db.trips.find((t) => t.id === req.tripId);
  if (!trip) {
    res.status(404).json({ error: 'trip_not_found' });
    return;
  }

  trip.title = payload.title ?? trip.title;
  trip.route_preference = payload.route_preference ?? trip.route_preference;
  trip.auto_link = payload.auto_link ?? trip.auto_link;
  trip.start_date = payload.start_date ?? trip.start_date;
  trip.updated_at = now;

  // 全量重建：先删旧 days（及其节点），再插新
  const oldDayIds = new Set(
    db.days.filter((d) => d.trip_id === req.tripId).map((d) => d.id)
  );
  db.days = db.days.filter((d) => d.trip_id !== req.tripId);
  db.nodes = db.nodes.filter((n) => !oldDayIds.has(n.day_id));

  for (const day of payload.days ?? []) {
    const dayId = day.id || crypto.randomUUID();
    db.days.push({
      id: dayId,
      trip_id: req.tripId!,
      date: day.date,
      order: day.order,
      departure_time: day.departure_time ?? null,
    });

    for (const n of day.nodes ?? []) {
      db.nodes.push({
        id: n.id || crypto.randomUUID(),
        day_id: dayId,
        order: n.order,
        type: n.type,
        name: n.name,
        address: n.address,
        lng: n.lng,
        lat: n.lat,
        arrive_time: n.arrive_time,
        leave_time: n.leave_time,
        play_duration: n.play_duration,
        note: n.note,
        images: n.images ?? [],
        manual_time: n.manual_time ?? 0,
      });
    }
  }

  persist();
  logger.info('trip', `saved ${req.tripId} days=${payload.days?.length ?? 0}`);
  res.json({ ok: true });
});

export default router;
