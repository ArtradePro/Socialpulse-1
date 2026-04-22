// Re-export from canonical auth middleware so that imports of
// '../middleware/auth' and '../middleware/auth.middleware' both work.
export { authenticate, requireRole, AuthRequest } from './auth.middleware';
