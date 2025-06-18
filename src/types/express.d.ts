import { JWTPayload } from 'jose';

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload & { _id: string };
    }
  }
}

export {};
