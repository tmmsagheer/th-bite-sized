const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const client = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
});

const updateSchema = async () => {
  try {
    await client.connect();
    console.log("Connected to Supabase.");

    const query = `
      ALTER TABLE articles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success';
      ALTER TABLE articles ADD COLUMN IF NOT EXISTS error_message TEXT;
    `;

    await client.query(query);
    console.log("Schema updated with status and error_message columns.");
  } catch (err) {
    console.error("Error updating schema:", err);
  } finally {
    await client.end();
  }
};

updateSchema();
