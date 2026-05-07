import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth, AuthRequest } from "../middleware/auth";
import bcrypt from "bcryptjs";

const router = Router();
const ALLOWED_STAFF_PAGES = new Set([
  "dashboard",
  "transactions",
  "masters",
  "users",
  "wallet",
  "reconciliation",
  "qr_codes",
  "settlements",
  "fund_requests",
  "ledger",
  "reports",
  "callbacks",
  "support",
  "charges",
  "settings",
]);

function sanitizePageAccess(pageAccess: unknown) {
  if (!Array.isArray(pageAccess)) return [];
  return Array.from(
    new Set(
      pageAccess
        .map((page) => String(page))
        .filter((page) => ALLOWED_STAFF_PAGES.has(page))
    )
  );
}

async function getStoredPageAccess(userId: string) {
  const setting = await prisma.appSetting.findUnique({
    where: { key: `staff_page_access_${userId}` },
    select: { value: true },
  });

  try {
    return sanitizePageAccess(setting?.value ? JSON.parse(setting.value) : []);
  } catch {
    return [];
  }
}

function canManageStaff(req: AuthRequest, role?: string | null) {
  if (role === "admin") return true;
  if (role !== "staff") return false;
  return !!req.permissions?.canManageSecurity;
}

// GET /api/staff - List all staff members
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const callerId = req.userId!;
    const myRole = await prisma.userRole.findFirst({ where: { userId: callerId } });
    if (!canManageStaff(req, myRole?.role)) return res.status(403).json({ error: "Forbidden" });

    const staff = await prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: "staff"
          }
        }
      },
      include: {
        profile: true,
        roles: true,
        staffPermission: true
      },
      orderBy: { createdAt: "desc" }
    });

    const result = await Promise.all(staff.map(async (s) => ({
      id: s.id,
      email: s.email,
      fullName: s.profile?.fullName,
      phone: s.profile?.phone,
      status: s.profile?.status,
      permissions: {
        canManageUsers: s.staffPermission?.canManageUsers ?? false,
        canManageFinances: s.staffPermission?.canManageFinances ?? false,
        canManageCommissions: s.staffPermission?.canManageCommissions ?? false,
        canManageServices: s.staffPermission?.canManageServices ?? false,
        canManageSettings: s.staffPermission?.canManageSettings ?? false,
        canManageSecurity: s.staffPermission?.canManageSecurity ?? false,
        canViewReports: s.staffPermission?.canViewReports ?? false,
      },
      pageAccess: await getStoredPageAccess(s.id),
      createdAt: s.createdAt
    })));

    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/staff - Create a new staff member
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { email, password, fullName, phone, permissions, pageAccess } = req.body;
  
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const callerId = req.userId!;
    const myRole = await prisma.userRole.findFirst({ where: { userId: callerId } });
    if (!canManageStaff(req, myRole?.role)) return res.status(403).json({ error: "Forbidden" });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ error: "Email already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const sanitizedPageAccess = sanitizePageAccess(pageAccess);
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          profile: {
            create: {
              fullName,
              phone,
              status: "active",
              kycStatus: "approved", // Staff doesn't need KYC usually
              isMasterAdmin: false
            }
          },
          roles: {
            create: {
              role: "staff"
            }
          },
          staffPermission: {
            create: {
              canManageUsers: permissions?.canManageUsers ?? false,
              canManageFinances: permissions?.canManageFinances ?? false,
              canManageCommissions: permissions?.canManageCommissions ?? false,
              canManageServices: permissions?.canManageServices ?? false,
              canManageSettings: permissions?.canManageSettings ?? false,
              canManageSecurity: permissions?.canManageSecurity ?? false,
              canViewReports: permissions?.canViewReports ?? false,
              grantedBy: callerId
            }
          },
          wallet: {
            create: {
              balance: 0
            }
          }
        },
        include: {
          profile: true,
          staffPermission: true
        }
      });

      await tx.appSetting.upsert({
        where: { key: `staff_page_access_${user.id}` },
        update: { value: JSON.stringify(sanitizedPageAccess) },
        create: {
          key: `staff_page_access_${user.id}`,
          value: JSON.stringify(sanitizedPageAccess),
        },
      });

      return user;
    });

    res.json({ success: true, user: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/staff/:id - Update staff permissions or profile
router.patch("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { fullName, phone, status, permissions, pageAccess } = req.body;

  try {
    const callerId = req.userId!;
    const myRole = await prisma.userRole.findFirst({ where: { userId: callerId } });
    if (!canManageStaff(req, myRole?.role)) return res.status(403).json({ error: "Forbidden" });

    const updated = await prisma.$transaction(async (tx) => {
      const sanitizedPageAccess = sanitizePageAccess(pageAccess);
      // Update profile if needed
      if (fullName || phone || status) {
        await tx.profile.update({
          where: { userId: id },
          data: {
            fullName,
            phone,
            status
          }
        });
      }

      // Update permissions if provided
      if (permissions) {
        await tx.staffPermission.upsert({
          where: { userId: id },
          update: {
            canManageUsers: permissions.canManageUsers,
            canManageFinances: permissions.canManageFinances,
            canManageCommissions: permissions.canManageCommissions,
            canManageServices: permissions.canManageServices,
            canManageSettings: permissions.canManageSettings,
            canManageSecurity: permissions.canManageSecurity,
            canViewReports: permissions.canViewReports,
            updatedAt: new Date()
          },
          create: {
            userId: id,
            canManageUsers: permissions.canManageUsers ?? false,
            canManageFinances: permissions.canManageFinances ?? false,
            canManageCommissions: permissions.canManageCommissions ?? false,
            canManageServices: permissions.canManageServices ?? false,
            canManageSettings: permissions.canManageSettings ?? false,
            canManageSecurity: permissions.canManageSecurity ?? false,
            canViewReports: permissions.canViewReports ?? false,
            grantedBy: callerId
          }
        });
      }

      if (pageAccess !== undefined) {
        await tx.appSetting.upsert({
          where: { key: `staff_page_access_${id}` },
          update: { value: JSON.stringify(sanitizedPageAccess) },
          create: {
            key: `staff_page_access_${id}`,
            value: JSON.stringify(sanitizedPageAccess),
          },
        });
      }

      return await tx.user.findUnique({
        where: { id },
        include: { profile: true, staffPermission: true }
      });
    });

    res.json({ success: true, user: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/staff/:id - Delete staff member
router.delete("/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const callerId = req.userId!;
    const myRole = await prisma.userRole.findFirst({ where: { userId: callerId } });
    if (!canManageStaff(req, myRole?.role)) return res.status(403).json({ error: "Forbidden" });

    await prisma.$transaction(async (tx) => {
      // Check if user is actually a staff
      const userRole = await tx.userRole.findFirst({
        where: { userId: id, role: "staff" }
      });
      if (!userRole) throw new Error("User is not a staff member or not found");

      // Delete dependencies
      await tx.staffPermission.deleteMany({ where: { userId: id } });
      await tx.appSetting.deleteMany({ where: { key: `staff_page_access_${id}` } });
      await tx.notification.deleteMany({ where: { userId: id } });
      
      // Delete user (cascades to profile, wallet, userRole)
      await tx.user.delete({ where: { id } });
    });

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
