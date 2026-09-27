const { chromium } = require('playwright');
const fs = require('fs');

async function extractSitemap() {
  console.log("Launching headless browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to The Hindu homepage...");
  await page.goto("https://www.thehindu.com/", { waitUntil: 'domcontentloaded', timeout: 60000 });

  console.log("Extracting footer sections...");
  
  const sitemap = await page.evaluate(() => {
    // The Hindu footer usually has columns. We'll look for standard footer link columns.
    const sections = {};
    
    // Find footer columns which usually have a title (h3, h4, or strong) and a list of links
    const columns = document.querySelectorAll('footer .footer-column, footer .nav-column, .footer-menu-container .menu-col');
    
    if (columns.length > 0) {
      columns.forEach(col => {
        const titleEl = col.querySelector('.menu-heading, h2, h3, h4, strong');
        const title = titleEl ? titleEl.innerText.trim() : 'Uncategorized';
        
        const links = Array.from(col.querySelectorAll('a')).map(a => ({
          name: a.innerText.trim(),
          url: a.href
        })).filter(l => l.name.length > 0);
        
        if (links.length > 0) {
          sections[title] = links;
        }
      });
    } else {
      // Fallback: just get all distinct sections if standard selectors fail
      const allHeaders = Array.from(document.querySelectorAll('.footer-section h3, .footer-container h2, .th-footer-menu-head'));
      allHeaders.forEach(header => {
        const title = header.innerText.trim();
        // Assume the next sibling UL or div contains the links
        const listContainer = header.nextElementSibling;
        if (listContainer) {
           const links = Array.from(listContainer.querySelectorAll('a')).map(a => ({
              name: a.innerText.trim(),
              url: a.href
           })).filter(l => l.name.length > 0);
           
           if (links.length > 0) {
             sections[title] = links;
           }
        }
      });
    }
    
    return sections;
  });

  if (Object.keys(sitemap).length === 0) {
      console.log("Failed to extract standard footer. Grabbing all links in the footer element instead...");
      const fallback = await page.evaluate(() => {
          const footer = document.querySelector('footer');
          if (!footer) return {};
          
          return {
              "All Footer Links": Array.from(footer.querySelectorAll('a')).map(a => ({
                  name: a.innerText.trim(),
                  url: a.href
              })).filter(l => l.name.length > 0)
          };
      });
      fs.writeFileSync('sitemap.json', JSON.stringify(fallback, null, 2));
  } else {
      fs.writeFileSync('sitemap.json', JSON.stringify(sitemap, null, 2));
  }
  
  console.log("Saved extracted sitemap to sitemap.json");
  await browser.close();
}

extractSitemap().catch(console.error);
