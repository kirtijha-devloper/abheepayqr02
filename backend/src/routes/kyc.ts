import { Router } from "express";
import { prisma } from "../index";
import { requireAuth, AuthRequest } from "../middleware/auth";

const router = Router();

// GET /api/kyc — get KYC documents (admin sees all, others see their own)
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  try {
    const isAdmin = req.userRole === "admin" || (req.userRole === "staff" && req.permissions?.canManageUsers);
    const where = isAdmin ? {} : { userId: req.userId! };
    const docs = await prisma.kycDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    // Enrich with user names if admin
    if (isAdmin) {
      const userIds = Array.from(new Set(docs.map(d => d.userId)));
      const profiles = await prisma.profile.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, fullName: true },
      });
      const roles = await prisma.userRole.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, role: true },
      });

      const profileMap = new Map(profiles.map(p => [p.userId, p.fullName]));
      const roleMap = new Map(roles.map(r => [r.userId, r.role]));

      const enriched = docs.map(d => ({
        ...d,
        user_name: profileMap.get(d.userId) || "Unknown",
        user_role: roleMap.get(d.userId) || "—",
      }));
      return res.json(enriched);
    }

    res.json(docs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/kyc — create a new KYC document record
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { doc_type, file_path, file_name } = req.body;
  if (!doc_type || !file_path || !file_name) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    const doc = await prisma.kycDocument.create({
      data: {
        userId: req.userId!,
        docType: doc_type,
        filePath: file_path,
        fileName: file_name,
        status: "pending",
      },
    });

    // Update profile kyc_status to pending if it was rejected or NULL
    const profile = await prisma.profile.findUnique({ where: { userId: req.userId! } });
    if (profile && (profile.kycStatus === "rejected" || !profile.kycStatus)) {
      await prisma.profile.update({
        where: { userId: req.userId! },
        data: { kycStatus: "pending" },
      });
    }

    res.json(doc);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/kyc/:id/review — review a KYC document (admin only)
router.patch("/:id/review", requireAuth, async (req: AuthRequest, res) => {
  const { action, note } = req.body; // action: "approved" | "rejected"
  try {
    const canReview = req.userRole === "admin" || (req.userRole === "staff" && req.permissions?.canManageUsers);
    if (!canReview) return res.status(403).json({ error: "Forbidden" });

    const doc = await prisma.kycDocument.findUnique({ where: { id: req.params.id } });
    if (!doc) return res.status(404).json({ error: "Document not found" });

    const updatedDoc = await prisma.kycDocument.update({
      where: { id: req.params.id },
      data: {
        status: action,
        reviewNote: note || null,
        reviewedBy: req.userId!,
        reviewedAt: new Date(),
      },
    });

    // Update overall profile KYC status
    const allDocs = await prisma.kycDocument.findMany({ where: { userId: doc.userId } });
    const allApproved = allDocs.every(d => d.status === "approved" || (d.id === doc.id && action === "approved"));
    const anyRejected = allDocs.some(d => d.status === "rejected" || (d.id === doc.id && action === "rejected"));

    const newKycStatus = anyRejected ? "rejected" : allApproved ? "verified" : "pending";

    await prisma.profile.update({
      where: { userId: doc.userId },
      data: { kycStatus: newKycStatus },
    });

    // Notify user
    await prisma.notification.create({
      data: {
        userId: doc.userId,
        title: action === "approved" ? "Document Approved ✓" : "Document Rejected",
        message: `Your ${doc.docType} document was ${action}. ${note ? `Note: ${note}` : ""}`,
        type: action === "approved" ? "success" : "error",
      },
    });

    res.json(updatedDoc);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
