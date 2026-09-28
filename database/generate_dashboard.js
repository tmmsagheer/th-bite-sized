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

    // 4. Articles processed recently (last 6 and 24 hours)
    const recent6hRes = await dbClient.query("SELECT COUNT(*) FROM articles WHERE created_at > NOW() - INTERVAL '6 hours' AND status = 'success'");
    const recent6h = recent6hRes.rows[0].count;

    const recent24hRes = await dbClient.query("SELECT COUNT(*) FROM articles WHERE created_at > NOW() - INTERVAL '24 hours' AND status = 'success'");
    const recent24h = recent24hRes.rows[0].count;

    // 5. Category Breakdown
    const categoryRes = await dbClient.query("SELECT category, COUNT(*) FROM articles WHERE status = 'success' AND category IS NOT NULL GROUP BY category ORDER BY count DESC");

    // 6. Recent Bugs
    const recentBugsRes = await dbClient.query("SELECT created_at, user_comment FROM bug_reports ORDER BY created_at DESC LIMIT 5");

    // 7. Article count by publish date
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
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-box { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); text-align: center; border-bottom: 4px solid #007aff; }
        .stat-box.success-border { border-bottom-color: #34c759; }
        .stat-box.warning-border { border-bottom-color: #ffcc00; }
        .stat-box.error-border { border-bottom-color: #ff3b30; }
        .stat-box.recent-border { border-bottom-color: #5856d6; }
        .stat-title { font-size: 13px; text-transform: uppercase; color: #666; letter-spacing: 0.5px; font-weight: 600; }
        .stat-num { font-size: 38px; font-weight: bold; margin-top: 10px; color: #333; }
        .error { color: #ff3b30; }
        .success { color: #34c759; }
        .warning { color: #d4a000; }
        .grid-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .bug-item { padding: 12px; background: #fff5f5; border-left: 4px solid #ff3b30; margin-bottom: 10px; border-radius: 4px; }
        .bug-date { font-size: 12px; color: #666; margin-bottom: 4px; }
      </style>
    </head>
    <body>
      <h1>📊 Bite-Sized News Dashboard</h1>
      <p style="color: #666; margin-bottom: 30px;">Generated at: ${new Date().toLocaleString()}</p>
      
      <div class="stat-grid">
        <div class="stat-box success-border">
          <div class="stat-title">Total Processed URLs</div>
          <div class="stat-num">${totalArticles}</div>
        </div>
        <div class="stat-box recent-border">
          <div class="stat-title">New Articles (Last 6h)</div>
          <div class="stat-num">${recent6h}</div>
        </div>
        <div class="stat-box recent-border">
          <div class="stat-title">New Articles (Last 24h)</div>
          <div class="stat-num">${recent24h}</div>
        </div>
        <div class="stat-box error-border">
          <div class="stat-title">Errors / Blocked</div>
          <div class="stat-num error">${errored} / ${premium}</div>
        </div>
      </div>

      <div class="grid-2col">
        <div class="card">
          <h2>🏷️ Article Breakdown by Category</h2>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Total Articles</th>
              </tr>
            </thead>
            <tbody>
              ${categoryRes.rows.map(r => `
                <tr>
                  <td><strong>${r.category}</strong></td>
                  <td>${r.count}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div>
          <div class="card">
            <h2>📅 Daily Publish Timeline</h2>
            <table>
              <thead>
                <tr>
                  <th>Publish Date</th>
                  <th>Articles Sourced</th>
                </tr>
              </thead>
              <tbody>
                ${dateRes.rows.map(r => `
                  <tr>
                    <td>${new Date(r.pub_date).toLocaleDateString()}</td>
                    <td>${r.count}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="card">
            <h2>🐛 Recent Bug Reports (${totalBugs} total)</h2>
            ${recentBugsRes.rows.length === 0 ? '<p>No bug reports yet! 🎉</p>' : recentBugsRes.rows.map(bug => `
              <div class="bug-item">
                <div class="bug-date">${new Date(bug.created_at).toLocaleString()}</div>
                <div>${bug.user_comment || '<em>No description provided</em>'}</div>
              </div>
            `).join('')}
          </div>
        </div>
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
