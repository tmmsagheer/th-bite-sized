require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');

async function showErrors() {
  const dbClient = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  
  try {
    await dbClient.connect();
    console.log("Connected to Supabase. Fetching failed articles...\n");

    const query = `
      SELECT id, title, original_url, status, error_message, created_at 
      FROM articles 
      WHERE status != 'success' 
      ORDER BY created_at DESC
      LIMIT 50;
    `;
    
    const result = await dbClient.query(query);
    
    if (result.rows.length === 0) {
      console.log("🎉 Great news! No errors or premium blocks found in the last 50 entries.");
    } else {
      console.log(`Found ${result.rows.length} problematic articles:\n`);
      
      let premiumCount = 0;
      let actualErrors = 0;

      result.rows.forEach(row => {
        if (row.status === 'premium_blocked') premiumCount++;
        if (row.status === 'error') actualErrors++;

        console.log(`[${new Date(row.created_at).toLocaleString()}]`);
        console.log(`Title:  ${row.title}`);
        console.log(`URL:    ${row.original_url}`);
        console.log(`Status: ${row.status.toUpperCase()}`);
        console.log(`Error:  ${row.error_message}`);
        console.log("-".repeat(60) + "\n");
      });
      
      console.log(`Summary: ${premiumCount} Premium Blocks | ${actualErrors} System Errors`);
    }

  } catch (error) {
    console.error("Failed to fetch errors:", error.message);
  } finally {
    await dbClient.end();
  }
}

showErrors();
