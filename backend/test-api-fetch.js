const http = require('http');

async function testApi() {
  const loginRes = await fetch("http://127.0.0.1:4001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@telering.com", password: "password123" }) // assuming default password
  });

  const loginData = await loginRes.json();
  if (!loginData.token) {
    console.error("Login failed", loginData);
    return;
  }

  const usersRes = await fetch("http://127.0.0.1:4001/api/users", {
    headers: { "Authorization": `Bearer ${loginData.token}` }
  });

  if (!usersRes.ok) {
    const errorData = await usersRes.text();
    console.error("Fetch users failed", usersRes.status, errorData);
    return;
  }

  const usersData = await usersRes.json();
  console.log(`Successfully fetched ${usersData.length} users.`);
  console.log("First 2 users:", usersData.slice(0, 2));
}

testApi();
