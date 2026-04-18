const http = require('http');
const jwt = require("jsonwebtoken");
const fs = require('fs');
require('dotenv').config({ path: './.env' }); // load JWT_SECRET

async function testApi() {
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  const admin = await prisma.user.findFirst({where: {email: "admin@telering.com"}});
  const token = jwt.sign({ sub: admin.id, email: admin.email }, process.env.JWT_SECRET || "supersecretkey_replace_me_in_prod123!", { expiresIn: "7d" });

  const usersRes = await fetch("http://127.0.0.1:4001/api/users", {
    headers: { "Authorization": `Bearer ${token}` }
  });

  if (!usersRes.ok) {
    const errorData = await usersRes.text();
    console.error("Fetch users failed", usersRes.status, errorData);
    return;
  }

  const usersData = await usersRes.json();
  console.log(`Successfully fetched ${usersData.length} users.`);
}

testApi();
