export {};

declare global {
  namespace Express {
    interface User {
      id?: string;
      userId: string;
      email: string;
      plan: string;
    }
    interface Request {
      user?: User;
      workspaceId?: string;
      workspaceRole?: string;
      teamRole?: string;
    }
  }
}
