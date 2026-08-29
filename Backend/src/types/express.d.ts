import type { Types } from "mongoose";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        sessionId: Types.ObjectId;
        user: {
          id: string;
          name: string;
          email: string;
          role: "hr";
        };
      };
    }
  }
}

export {};
