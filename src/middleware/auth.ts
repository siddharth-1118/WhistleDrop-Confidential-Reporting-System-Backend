import { Request, Response, NextFunction } from 'express';
import { verifyJwt, JwtPayload } from '../utils/security';
import { AppError } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  moderator?: JwtPayload;
}

export function requireModeratorAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authentication required. Missing or invalid Bearer token.', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyJwt(token);
    req.moderator = decoded;
    next();
  } catch (_err) {
    throw new AppError('Invalid or expired authentication token.', 401);
  }
}
