import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../utils/env";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

/**
 * Middleware: Verifies local JWT token from the frontend.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    req.userId = decoded.sub; 
    next();
  } catch (err: any) {
    console.warn(`[Auth] Token verification failed: ${err.message}`);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Middleware: Verifies user is admin role.
 */
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
  const { prisma } = await import("../index");
  const role = await prisma.userRole.findFirst({ where: { userId: req.userId } });
  if (role?.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  next();
}
