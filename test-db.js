const { Client } = require('pg');
const client = new Client({
  connectionString: "postgresql://neondb_owner:npg_nBgLbO0P9RDv@ep-bold-water-anmm6h11.us-east-1.aws.neon.tech/neondb?sslmode=require",
});

client.connect()
  .then(() => {
    console.log('Connected successfully');
    return client.query('SELECT NOW()');
  })
  .then(res => {
    console.log('Result:', res.rows[0]);
    return client.end();
  })
  .catch(err => {
    console.error('Connection error:', err);
    process.exit(1);
  });
