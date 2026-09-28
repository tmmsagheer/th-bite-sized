require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');

async function fixCategories() {
  const dbClient = new Client({ 
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await dbClient.connect();
    console.log("Connected to Supabase. Updating legacy categories...");

    const updates = [
      { name: 'National', urlLike: 'https://www.thehindu.com/news/national/%' },
      { name: 'International', urlLike: 'https://www.thehindu.com/news/international/%' },
      { name: 'Editorial', urlLike: 'https://www.thehindu.com/opinion/editorial/%' },
      { name: 'Economy', urlLike: 'https://www.thehindu.com/business/Economy/%' },
      { name: 'Science', urlLike: 'https://www.thehindu.com/sci-tech/science/%' },
      { name: 'Technology', urlLike: 'https://www.thehindu.com/sci-tech/technology/%' },
      // Important: Sport is shorter, run it last or specific so it doesn't overlap, 
      // though none of the others overlap with /sport/
      { name: 'Sport', urlLike: 'https://www.thehindu.com/sport/%' },
    ];

    let totalUpdated = 0;

    for (const update of updates) {
      const result = await dbClient.query(
        `UPDATE articles SET category = $1 WHERE original_url LIKE $2 AND category != $1`,
        [update.name, update.urlLike]
      );
      console.log(`Updated ${result.rowCount} articles to category: ${update.name}`);
      totalUpdated += result.rowCount;
    }
    
    console.log(`\n✅ Successfully backfilled ${totalUpdated} total articles based on their URL structure!`);

  } catch (error) {
    console.error("❌ Failed to update categories:", error.message);
  } finally {
    await dbClient.end();
  }
}

fixCategories();
