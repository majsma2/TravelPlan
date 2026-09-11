import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb } from './db/store.js';
import tripRoutes from './routes/trip.js';
import drivingRoutes from './routes/driving.js';
import uploadRoutes from './routes/upload.js';
import configRoutes from './routes/config.js';
import { errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = Number(process.env.PORT) || 8787;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// 初始化数据库
initDb();

// 静态资源：节点图片
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// 路由
app.use('/api/config', configRoutes);
app.use('/api/trip', tripRoutes);
app.use('/api/driving', drivingRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[server] running at http://localhost:${PORT}`);
});
