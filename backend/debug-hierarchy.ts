import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function debug() {
  const branch = await prisma.profile.findFirst({
    where: { fullName: { contains: "Branch 4-4-4" } },
    include: { user: { include: { roles: true } } }
  });

  if (!branch) {
    console.log("Branch not found");
    return;
  }

  console.log("Branch:", branch.userId, branch.fullName);
  console.log("Role:", branch.user.roles[0]?.role);
  console.log("Parent ID (Profile ID):", branch.parentId);

  if (branch.parentId) {
    const parent = await prisma.profile.findUnique({
      where: { id: branch.parentId },
      include: { user: { include: { roles: true } } }
    });
    console.log("Parent:", parent?.userId, parent?.fullName, parent?.user.roles[0]?.role);
    
    if (parent?.parentId) {
        const grandParent = await prisma.profile.findUnique({
            where: { id: parent.parentId },
            include: { user: { include: { roles: true } } }
        });
        console.log("Grandparent:", grandParent?.userId, grandParent?.fullName, grandParent?.user.roles[0]?.role);
        
        if (grandParent?.parentId) {
            const greatGrandParent = await prisma.profile.findUnique({
                where: { id: grandParent.parentId },
                include: { user: { include: { roles: true } } }
            });
            console.log("Great Grandparent:", greatGrandParent?.userId, greatGrandParent?.fullName, greatGrandParent?.user.roles[0]?.role);
        }
    }
  }

  const slabs = await prisma.commissionSlab.findMany({
    where: { serviceKey: "payout", isActive: true }
  });
  console.log("\nGlobal Slabs (Payout):");
  console.table(slabs.map(s => ({ role: s.role, type: s.chargeType, value: s.chargeValue })));

  const overrides = await prisma.userCommissionOverride.findMany({
    where: { serviceKey: "payout", isActive: true }
  });
  console.log("\nOverrides (Payout):");
  console.table(overrides.map(o => ({ target: o.targetUserId, type: o.chargeType, value: o.chargeValue })));

  const defaults = await prisma.downlineChargeDefault.findMany({
    where: { serviceKey: "payout", isActive: true }
  });
  console.log("\nDownline Defaults (Payout):");
  console.table(defaults.map(d => ({ owner: d.ownerUserId, targetRole: d.targetRole, type: d.chargeType, value: d.chargeValue })));
}

debug();
