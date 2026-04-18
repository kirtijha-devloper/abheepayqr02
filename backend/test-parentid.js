const jwt = require("jsonwebtoken");
require('dotenv').config({ path: './.env' }); // load JWT_SECRET

async function testApi() {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const admin = await prisma.user.findFirst({where: {email: "admin@telering.com"}});
  const token = jwt.sign({ sub: admin.id, email: admin.email }, process.env.JWT_SECRET || "supersecretkey_replace_me_in_prod123!", { expiresIn: "7d" });

  const firstMerchantProfile = await prisma.profile.findFirst({
      where: {
          user: {
              roles: {
                  some: { role: 'merchant' }
              }
          }
      }
  });

  const url = `http://127.0.0.1:4001/api/users?parentId=${firstMerchantProfile.id}`;
  console.log("Fetching url:", url);
  
  const usersRes = await fetch(url, {
    headers: { "Authorization": `Bearer ${token}` }
  });

  if (!usersRes.ok) {
    const errorData = await usersRes.text();
    console.error("Fetch users failed", usersRes.status, errorData);
    return;
  }

  try {
      const usersData = await usersRes.json();
      console.log(`Successfully fetched ${usersData.length} branches.`);
  } catch(e) {
      console.error("Failed to parse json:", e);
  }
}

testApi();
