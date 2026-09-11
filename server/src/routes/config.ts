import { Router } from 'express';
import { config } from '../config.js';

const router = Router();

/** GET /api/config — 下发前端需要的高德 JS API key 与安全密钥 */
router.get('/', (_req, res) => {
  res.json({
    jsKey: config.amapJsKey,
    jsSecurity: config.amapJsSecurity,
  });
});

export default router;
