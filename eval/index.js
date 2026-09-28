const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { pipeline, cos_sim } = require('@xenova/transformers');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

function getWordCount(str) {
  return str.trim().split(/\s+/).length;
}

function validateSchema(data) {
  if (typeof data !== 'object' || data === null) return false;
  if (typeof data.summary !== 'string') return false;
  if (!Array.isArray(data.tags)) return false;
  return true;
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetryBackoff(operationName, fn) {
  let attempt = 0;
  let delayMs = 15000;
  const maxDelayMs = 135000;
  const incrementMs = 30000;

  while (true) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      console.error(`[Attempt ${attempt} failed] ${operationName}: ${error.message}`);
      
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

async function runEval() {
  if (!fs.existsSync('golden_dataset.js')) {
    console.error("golden_dataset.js not found!");
    return;
  }

  const dataset = require('./golden_dataset.js');
  const logStream = fs.createWriteStream('eval_log.txt', { flags: 'w' });

  console.log("Loading local embedding model (@xenova/transformers)...");
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log("Model loaded.");

  let passCount = 0;
  let totalCount = dataset.length;

  for (let i = 0; i < dataset.length; i++) {
    const article = dataset[i];
    console.log(`\nEvaluating Article ${i + 1}/${dataset.length}: ${article.title}`);
    logStream.write(`\n--- Evaluating Article: ${article.title} ---\n`);

    try {
      // 15 seconds natural pacing between articles
      console.log("Pacing... waiting 15s to respect Gemini Free Tier...");
      await wait(15000);

      // 1. Generate Summary using Gemini with Backoff
      const result = await withRetryBackoff("Gemini Summary Generation", async () => {
        const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
        const prompt = `You are a strict summarizer. 
Provide a summary of the following text.
Constraints:
- Return ONLY a raw JSON object with keys: "summary" (string), "tags" (array of strings). Do not include markdown blocks.
- The "summary" MUST be strictly between 60 and 80 words long.

Text:
${article.original_text.substring(0, 3000)}`;
        return await model.generateContent(prompt);
      });
      
      const cleanedText = result.response.text().replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
      let outputJson;
      let schemaPass = false;

      // Assert 1: Schema Validation
      try {
        outputJson = JSON.parse(cleanedText);
        schemaPass = validateSchema(outputJson);
      } catch (e) {
        schemaPass = false;
      }
      logStream.write(`Schema Pass: ${schemaPass}\n`);

      if (!schemaPass) {
        logStream.write(`Failed to parse valid JSON. Raw output: ${cleanedText}\n`);
        continue;
      }

      // Assert 2: Word Count
      const wordCount = getWordCount(outputJson.summary);
      const wordCountPass = wordCount >= 60 && wordCount <= 80;
      logStream.write(`Word Count: ${wordCount} (Pass: ${wordCountPass})\n`);

      // Assert 3: Semantic Similarity
      const originalEmbed = await extractor(article.original_text.substring(0, 2000), { pooling: 'mean', normalize: true });
      const summaryEmbed = await extractor(outputJson.summary, { pooling: 'mean', normalize: true });
      
      const similarity = cos_sim(originalEmbed.data, summaryEmbed.data);
      const similarityPass = similarity >= 0.55;
      logStream.write(`Semantic Similarity (Cosine): ${similarity.toFixed(4)} (Pass: ${similarityPass})\n`);

      // Overall result
      const overallPass = schemaPass && wordCountPass && similarityPass;
      if (overallPass) passCount++;

      logStream.write(`Overall Result: ${overallPass ? 'PASS' : 'FAIL'}\n`);
      
    } catch (err) {
      console.error(`Error processing article ${i + 1}:`, err.message);
      logStream.write(`Error: ${err.message}\n`);
    }
  }

  const summaryStr = `\n=== Evaluation Complete ===\nTotal: ${totalCount}\nPassed: ${passCount}\nFailed: ${totalCount - passCount}\n`;
  console.log(summaryStr);
  logStream.write(summaryStr);
  logStream.end();
}

runEval();
