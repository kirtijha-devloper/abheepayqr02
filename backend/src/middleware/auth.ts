import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

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
    const secret = process.env.JWT_SECRET || "fallback_secret";
    const decoded = jwt.verify(token, secret) as any;
    req.userId = decoded.sub; 
    console.log(`[Auth] User ID ${req.userId} verified from token.`);
    next();
  } catch (err) {
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
