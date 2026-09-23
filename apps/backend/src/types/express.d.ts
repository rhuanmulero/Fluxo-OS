import { AuthenticatedUser } from '../common/authorization/authenticated-user';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
