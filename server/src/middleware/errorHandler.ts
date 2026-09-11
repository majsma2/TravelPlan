import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error('http', err.message, err.stack);
  res.status(500).json({ error: 'internal_error', message: err.message });
}
