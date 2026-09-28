const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbClient = new Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function generateReport() {
  try {
    console.log("Connecting to the database...");
    await dbClient.connect();
    
    // 1. Total articles
    const totalRes = await dbClient.query('SELECT COUNT(*) FROM articles');
    const totalArticles = totalRes.rows[0].count;

    // 2. Status counts
    const statusRes = await dbClient.query('SELECT status, COUNT(*) FROM articles GROUP BY status');
    let successful = 0;
    let errored = 0;
    let premium = 0;
    statusRes.rows.forEach(row => {
      if (row.status === 'success') successful = row.count;
      else if (row.status === 'error') errored = row.count;
      else if (row.status === 'premium_blocked') premium = row.count;
    });

    // 3. User reported bugs
    const bugsRes = await dbClient.query('SELECT COUNT(*) FROM bug_reports');
    const totalBugs = bugsRes.rows[0].count;

    // 4. Article count by date
    const dateRes = await dbClient.query(`
      SELECT CAST(published_at AS DATE) as pub_date, COUNT(*) 
      FROM articles 
      WHERE published_at IS NOT NULL
      GROUP BY CAST(published_at AS DATE) 
      ORDER BY pub_date DESC
    `);
    
    // Generate HTML
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bite-Sized News Dashboard</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f4f4f9; color: #333; margin: 40px; }
        h1 { color: #222; }
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .stat-box { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; }
        .stat-title { font-size: 14px; text-transform: uppercase; color: #666; letter-spacing: 0.5px; }
        .stat-num { font-size: 38px; font-weight: bold; margin-top: 10px; color: #007aff; }
        .error { color: #ff3b30; }
        .success { color: #34c759; }
        .warning { color: #ffcc00; }
      </style>
    </head>
    <body>
      <h1>📊 Bite-Sized News Dashboard</h1>
      <p style="color: #666;">Generated at: ${new Date().toLocaleString()}</p>
      
      <div class="stat-grid">
        <div class="stat-box">
          <div class="stat-title">Total Processed URLs</div>
          <div class="stat-num">${totalArticles}</div>
        </div>
        <div class="stat-box">
          <div class="stat-title">Successfully Scraped</div>
          <div class="stat-num success">${successful}</div>
        </div>
        <div class="stat-box">
          <div class="stat-title">Errors / Blocked</div>
          <div class="stat-num error">${errored} / ${premium}</div>
        </div>
        <div class="stat-box">
          <div class="stat-title">Reported Bugs</div>
          <div class="stat-num warning">${totalBugs}</div>
        </div>
      </div>

      <div class="card" style="margin-top: 30px;">
        <h2>📅 Articles by Publish Date</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Article Count</th>
            </tr>
          </thead>
          <tbody>
            ${dateRes.rows.map(r => `
              <tr>
                <td><strong>${new Date(r.pub_date).toLocaleDateString()}</strong></td>
                <td>${r.count} articles</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </body>
    </html>
    `;

    const outputPath = path.join(__dirname, 'dashboard.html');
    fs.writeFileSync(outputPath, htmlContent);
    console.log('✅ Dashboard generated successfully!');
    console.log(`\n➡️  Click here to view the report:\nfile:///${outputPath.replace(/\\/g, '/')}\n`);

  } catch (err) {
    console.error('Error generating report:', err);
  } finally {
    await dbClient.end();
  }
}

generateReport();
