import { prisma } from './src/prisma';

async function debug() {
  const staffEmail = 'mukund@ebazars.in'; // I'll search by name if email is wrong
  const staff = await prisma.user.findFirst({
    where: { profile: { fullName: 'mukund' } },
    include: { staffPermission: true, roles: true, profile: true }
  });

  if (!staff) {
    console.log('Staff not found');
    return;
  }

  const callerId = staff.id;
  const myProfile = staff.profile;
  const myRole = staff.roles[0]?.role;
  const permissions = staff.staffPermission;
  const canManageUsers = myRole === 'staff' && permissions?.canManageUsers;

  console.log('--- Context ---');
  console.log('Caller ID:', callerId);
  console.log('Role:', myRole);
  console.log('Can Manage Users:', canManageUsers);

  let whereClause: any = {};
  if (myRole === 'admin' || canManageUsers) {
    whereClause = {
      user: { roles: { some: { role: 'master' } } }
    };
  } else {
    whereClause = { parentId: myProfile?.id };
  }

  console.log('--- Query ---');
  console.log('Where Clause:', JSON.stringify(whereClause, null, 2));

  const profiles = await prisma.profile.findMany({
    where: whereClause,
    include: {
      user: {
        include: {
          roles: true,
          wallet: true,
          userCommissionOverrides: true
        }
      }
    }
  });

  console.log('--- Results ---');
  console.log('Count:', profiles.length);
  if (profiles.length > 0) {
    console.log('First Result Role:', profiles[0].user?.roles?.[0]?.role);
  }
}

debug();
