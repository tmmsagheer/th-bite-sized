const { chromium } = require('playwright');
const { Client } = require('pg');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');

// --- Custom Logger with Rotation ---
const LOG_FILE = path.join(__dirname, 'scraper.log');
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB

function logToFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  try {
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > MAX_LOG_SIZE) {
        fs.renameSync(LOG_FILE, `${LOG_FILE}.old`);
      }
    }
    fs.appendFileSync(LOG_FILE, logMessage);
  } catch (err) {
    // Fail silently if we can't write to the log so we don't crash the scraper
  }
}

const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
  originalLog.apply(console, args);
  logToFile(args.join(' '));
};

console.error = function(...args) {
  originalError.apply(console, args);
  logToFile('[ERROR] ' + args.join(' '));
};
// -----------------------------------

const urls = [
  "https://www.thehindu.com/news/national/andhra-pradesh/debt-trap-looms-large-over-ap-weavers/article71505671.ece",
  "https://www.thehindu.com/education/foundational-literacy-does-not-end-at-grade-2-neither-should-our-attention/article71507614.ece",
  "https://www.thehindu.com/news/national/the-quest-to-be-a-science-superpower-where-indias-research-is-and-what-it-will-take-to-get-ahead/article71507895.ece",
  "https://www.thehindu.com/opinion/editorial/a-nations-song-on-vande-matarams-rendition/article71504906.ece",
  "https://www.thehindu.com/news/national/assam/inputs-from-ashas-to-shape-ai-enabled-training-platform-for-cervical-cancer-screening-in-assam/article71504049.ece",
  "https://www.thehindu.com/data/the-paradox-of-self-reliance-india-china-trade-dynamics/article71488833.ece",
  "https://www.thehindu.com/business/Industry/coffee-board-brews-sustainability-push-with-new-certification-framework/article71509209.ece",
  "https://www.thehindu.com/news/national/plea-in-supreme-court-says-cec-gyanesh-kumar-can-be-probed-and-tried-like-an-ordinary-accused/article71507762.ece",
  "https://www.thehindu.com/sport/asian-games-2026-kamaljeet-suruchi-shoot-india-to-gold-in-10m-air-pistol-mixed-team-event/article71507089.ece",
  "https://www.thehindu.com/news/international/italy-decrees-limits-on-non-italian-speakers-veils-in-school-classrooms/article71508286.ece"
];

const config = require('./config.js');

// --- API Key Rotation Setup ---
const geminiKeys = Object.keys(process.env)
  .filter(k => k.startsWith('GEMINI_KEY'))
  .map(k => process.env[k])
  .filter(Boolean); // Filter out empties

if (geminiKeys.length === 0) {
  throw new Error("No GEMINI_KEY variables found in .env");
}

let currentKeyIndex = 0;
let genAI = new GoogleGenerativeAI(geminiKeys[currentKeyIndex]);

console.log(`Initialized Gemini with ${geminiKeys.length} API key(s) for rotation.`);

function rotateApiKey() {
  currentKeyIndex = (currentKeyIndex + 1) % geminiKeys.length;
  genAI = new GoogleGenerativeAI(geminiKeys[currentKeyIndex]);
  console.log(`🔄 Rotated to Gemini API Key #${currentKeyIndex + 1}`);
}
// ------------------------------

const dbClient = new Client({ connectionString: process.env.SUPABASE_DB_URL });

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retry mechanism using config
async function withRetryBackoff(operationName, fn) {
  let attempt = 0;
  let delayMs = config.backoff.initialDelayMs;
  const maxDelayMs = config.backoff.maxDelayMs;
  const incrementMs = config.backoff.incrementMs;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      console.error(`[Attempt ${attempt} failed] ${operationName}: ${error.message}`);
      
      // Bail out immediately for 404 Not Found (retrying won't bring the article back)
      if (error.message.includes('HTTP 404')) {
        console.error(`Bailing out of retries for 404 error.`);
        throw error;
      }

      // Cool-off for Gemini API Rate Limits (429)
      if (error.message.includes('429') || error.message.includes('Quota exceeded') || error.message.includes('Too Many Requests')) {
        if (geminiKeys.length > 1) {
          rotateApiKey();
          // If we wrapped all the way back to the first key, all keys are exhausted. Sleep.
          if (currentKeyIndex === 0) {
            console.log(`🚨 ALL GEMINI QUOTAS HIT! Initiating 60-second cool-off...`);
            await wait(60000);
            console.log(`Cool-off complete. Resuming...`);
          } else {
            console.log(`Instantly retrying with new API key...`);
          }
        } else {
          console.log(`🚨 GEMINI QUOTA LIMIT HIT! Initiating 60-second cool-off...`);
          await wait(60000);
          console.log(`Cool-off complete. Resuming...`);
        }
        continue; // Retry without incrementing the attempt counter
      }

      if (delayMs > maxDelayMs) {
        console.error(`Max retries reached for ${operationName}. Aborting.`);
        throw error;
      }

      console.log(`Waiting ${delayMs / 1000} seconds before retrying...`);
      await wait(delayMs);
      
      delayMs += incrementMs;
    }
  }
}

async function processArticles() {
  await dbClient.connect();
  console.log("Connected to Supabase.");

  console.log("Launching headless browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const processedUrls = new Set();

  for (const category of config.categories) {
    console.log(`\n=== Fetching latest from ${category.name} ===`);
    
    // 1. Fetch category page
    await page.goto(category.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // 2. Extract article URLs (.ece)
    const categoryUrls = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a'))
        .map(a => a.href)
        .filter(href => href.endsWith('.ece'))
        .filter((value, index, self) => self.indexOf(value) === index); // unique
    });

    let successCount = 0;

    for (const url of categoryUrls) {
      if (successCount >= config.maxArticlesPerCategory) {
        console.log(`Reached max ${config.maxArticlesPerCategory} articles for ${category.name}. Moving to next category.`);
        break;
      }
      
      if (processedUrls.has(url)) continue;
      processedUrls.add(url);

      console.log(`\nProcessing: ${url}`);
      
      try {
        // Check database first
        const { rows } = await dbClient.query('SELECT id FROM articles WHERE original_url = $1', [url]);
        if (rows.length > 0) {
          console.log(`-> Skipping: Already exists in database.`);
          continue;
        }

        await wait(config.articlePacingMs); // Pace requests

        const pageData = await withRetryBackoff("Scraping Article", async () => {
          const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          
          if (response) {
            const status = response.status();
            if (status === 404) throw new Error(`HTTP 404 Not Found.`);
            if (status >= 400) throw new Error(`HTTP Error ${status}.`);
          }
          
          return await page.evaluate((minLen) => {
            let isPremium = false;
            if (window.dataLayer) {
              for (const item of window.dataLayer) {
                if (item.pageDetails && item.pageDetails.articleType === 'Premium') {
                  isPremium = true;
                }
              }
            }
            
            const titleElement = document.querySelector('h1.title, h1');
            const title = titleElement ? titleElement.innerText.trim() : 'Unknown Title';
            
            const dateElement = document.querySelector('meta[property="article:published_time"]');
            const publishedAt = dateElement ? dateElement.content : null;

            let text = '';
            const bodyElement = document.querySelector('[id^="content-body-"], .articlebodycontent, .article-body');
            if (bodyElement) {
                const noiseSelectors = ['.also-read', '.related-article', '.related-topics', '[data-widget-id]', '.ksl-AlsoRead', '.story-related', '#comments', '.comments-container'];
                bodyElement.querySelectorAll(noiseSelectors.join(',')).forEach(el => el.remove());
                
                Array.from(bodyElement.querySelectorAll('div, section, aside, a, span, button')).forEach(el => {
                  const innerText = el.innerText.toUpperCase();
                  if (innerText.includes('ALSO READ') || innerText.includes('READ COMMENTS') || innerText.includes('KEEP TRACK')) {
                    el.remove();
                  }
                });
                text = bodyElement.innerText.trim();
            } else {
                Array.from(document.querySelectorAll('div, section, aside, a, span, button')).forEach(el => {
                  const innerText = el.innerText.toUpperCase();
                  if (innerText.includes('ALSO READ') || innerText.includes('READ COMMENTS') || innerText.includes('KEEP TRACK')) {
                    el.remove();
                  }
                });
                
                text = Array.from(document.querySelectorAll('main p, article p, .paywall p'))
                            .map(p => p.innerText.trim())
                            .filter(t => t.length > 0)
                            .join('\n\n');
            }
            
            if (!isPremium && text.length < minLen) {
                throw new Error("Text too short, possible bot block.");
            }

            return { isPremium, title, text, publishedAt };
          }, config.minArticleLength);
        });

        if (pageData.isPremium) {
          console.log("-> Detected as Premium. Skipping.");
          await insertIntoDb({ title: pageData.title, url, status: 'premium_blocked', error_message: 'Article is behind a premium paywall.', publishedAt: pageData.publishedAt });
          continue; // Does not count towards the 5 successes
        }

        console.log(`-> Free article detected. (Published: ${pageData.publishedAt})`);
        
        const aiMetadata = await withRetryBackoff("Gemini Summary Generation", async () => {
          const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
          const prompt = `Analyze this article. Return ONLY a raw JSON object (no markdown formatting) with these exact keys: "summary" (a 2-sentence summary), "category" (1 word category like Politics, Sports, Tech), "tags" (an array of 3 relevant string tags).\n\nArticle Title: ${pageData.title}\n\n${pageData.text.substring(0, 3000)}`;
          const result = await model.generateContent(prompt);
          const cleanedText = result.response.text().replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
          return JSON.parse(cleanedText);
        });

        const embeddingArray = await withRetryBackoff("Gemini Embedding Generation", async () => {
          const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
          const embeddingResult = await embeddingModel.embedContent(aiMetadata.summary + " " + pageData.text.substring(0, 1000));
          return embeddingResult.embedding.values.slice(0, 768);
        });

        console.log("-> Inserting into DB...");
        await insertIntoDb({
          title: pageData.title,
          url,
          summary: aiMetadata.summary,
          category: aiMetadata.category,
          tags: aiMetadata.tags,
          embedding: JSON.stringify(embeddingArray),
          status: 'success',
          error_message: null,
          publishedAt: pageData.publishedAt
        });

        console.log("-> Successfully inserted.");
        successCount++; // Increment only for successful free articles
      } catch (error) {
        console.error(`-> Final Error processing ${url}: ${error.message}`);
        await insertIntoDb({ title: 'Error Loading Page', url, status: 'error', error_message: error.message });
      }
    }
  }

  await browser.close();
  await dbClient.end();
  console.log("\nFinished processing all categories.");
}

async function insertIntoDb(data) {
  const query = `
    INSERT INTO articles (title, original_url, summary, category, tags, embedding, status, error_message, published_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `;
  const values = [
    data.title, data.url, data.summary || null, data.category || null, data.tags || null, 
    data.embedding || null, data.status, data.error_message, data.publishedAt || null
  ];
  await dbClient.query(query, values);
}

processArticles();
