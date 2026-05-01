import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "../utils/env";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
  permissions?: {
    canManageUsers: boolean;
    canManageFinances: boolean;
    canManageCommissions: boolean;
    canManageServices: boolean;
    canManageSettings: boolean;
    canManageSecurity: boolean;
    canViewReports: boolean;
  };
}

/**
 * Middleware: Verifies local JWT token from the frontend.
 */
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    req.userId = decoded.sub;

    // Fetch role and permissions
    const { prisma } = await import("../index");
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      include: {
        roles: true,
        staffPermission: true
      }
    });

    if (!user) return res.status(401).json({ error: "User not found" });

    req.userRole = user.roles[0]?.role;
    if (req.userRole === "staff" && user.staffPermission) {
      req.permissions = {
        canManageUsers: user.staffPermission.canManageUsers,
        canManageFinances: user.staffPermission.canManageFinances,
        canManageCommissions: user.staffPermission.canManageCommissions,
        canManageServices: user.staffPermission.canManageServices,
        canManageSettings: user.staffPermission.canManageSettings,
        canManageSecurity: user.staffPermission.canManageSecurity,
        canViewReports: user.staffPermission.canViewReports,
      };
    }

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
  if (req.userRole !== "admin") return res.status(403).json({ error: "Admin access required" });
  next();
}

/**
 * Middleware: Verifies user has specific permission OR is admin.
 */
export function requirePermission(permission: keyof NonNullable<AuthRequest["permissions"]>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: "Unauthorized" });
    
    // Admins have all permissions
    if (req.userRole === "admin") return next();
    
    // Staff members check specific permission
    if (req.userRole === "staff") {
      if (req.permissions && req.permissions[permission]) {
        return next();
      }
      return res.status(403).json({ error: `Permission denied: ${permission}` });
    }
    
    return res.status(403).json({ error: "Forbidden" });
  };
}
