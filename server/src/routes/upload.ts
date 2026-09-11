import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve(__dirname, '../../uploads'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('仅支持图片文件'));
  },
});

const router = Router();

/** POST /api/upload — 上传节点图片，返回访问 URL */
router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'no_file', message: '未收到图片文件' });
    return;
  }
  const url = `/uploads/${req.file.filename}`;
  logger.info('upload', `${req.file.filename} ${req.file.size}B`);
  res.json({ url });
});

export default router;
