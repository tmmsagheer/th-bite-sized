require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');

async function createReportsTable() {
  const dbClient = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  
  try {
    await dbClient.connect();
    console.log("Connected to Supabase.");

    const query = `
      CREATE TABLE IF NOT EXISTS bug_reports (
        id SERIAL PRIMARY KEY,
        article_id BIGINT,
        user_comment TEXT,
        screenshot_base64 TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
      );
    `;
    
    await dbClient.query(query);
    console.log("✅ Successfully created 'bug_reports' table.");

  } catch (error) {
    console.error("❌ Failed to create table:", error.message);
  } finally {
    await dbClient.end();
  }
}

createReportsTable();
