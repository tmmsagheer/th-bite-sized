# Bite-Sized News 📰⚡

A TikTok-style, vertical-scrolling news aggregator that uses AI to summarize lengthy news articles into digestible, bite-sized cards.

## 🌟 Features
- **Infinite Vertical Feed:** Seamlessly swipe through news articles with a smooth, native-feeling UI.
- **AI Summarization:** A custom Node.js scraper fetches daily news and uses the **Google Gemini AI API** to condense them into bite-sized summaries.
- **Library & Bookmarks:** Save your favorite articles to a dedicated library and revisit them in a gorgeous standalone reading view.
- **Haptic Feedback & Dark Mode:** A premium user experience featuring native haptics, dark-mode-first design, and fluid animations.
- **Live Bug Reporting:** Built-in screen capturing via `react-native-view-shot` allows users to capture and submit bug reports directly to the database.
- **Automated Pipeline:** Fully automated via **GitHub Actions** to scrape, summarize, and publish new articles every 6 hours.

## 🛠️ Tech Stack
- **Frontend:** React Native, Expo, Expo Router
- **Backend/Database:** Supabase (PostgreSQL)
- **Scraper Pipeline:** Node.js, Playwright
- **AI Engine:** Google Gemini (gemini-1.5-flash)
- **Automation:** GitHub Actions

---

## 🚀 Getting Started

### 1. Database Setup (Supabase)
1. Create a new Supabase project and obtain your Postgres Connection String.
2. The `database/` directory contains Node.js helper scripts to programmatically apply schema changes. To set up your tables, install dependencies and run the scripts:
   ```bash
   cd database
   npm install
   node update_schema.js
   node update_schema_date.js
   node create_reports_table.js
   ```
   *These helper scripts automatically execute the necessary SQL to create the `articles`, `user_interactions`, and `bug_reports` tables.*

3. **Analytics Dashboard:** You can generate a local HTML dashboard detailing your database statistics (successful articles, blocked bots, bug reports, and a timeline) by running:
   ```bash
   node generate_dashboard.js
   ```

### 2. Environment Variables
Create a `.env` file in the root of the project with the following keys:
```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_DB_URL=your_postgresql_connection_string

# Gemini API Keys (Supports up to 10 keys for rate-limit rotation)
GEMINI_KEY_1=your_first_gemini_api_key
GEMINI_KEY_2=your_second_gemini_api_key
```

### 3. Running the Scraper Locally
To fetch the latest news and populate your Supabase database:
```bash
cd scraper
npm install
npx playwright install chromium
node index.js
```

### 4. Running the Mobile App
```bash
cd frontend
npm install
npx expo start
```
Scan the QR code with the **Expo Go** app on your iOS or Android device to preview the app.

---

## 🧪 AI Evaluation Pipeline
To ensure the Gemini AI is consistently producing high-quality summaries, we have a custom evaluation suite built with `@xenova/transformers`.

Located in the `eval/` directory, the script (`index.js`) processes a `golden_dataset.js` of news articles and asserts three strict conditions:
1. **Schema Validation:** Ensures the AI outputs strictly parsable JSON matching the `summary`, `category`, and `tags` schema.
2. **Word Count Assertion:** The summary must strictly fall between **60 and 80 words**.
3. **Semantic Similarity:** Uses a local `all-MiniLM-L6-v2` embedding model to calculate the Cosine Similarity between the original article and the AI summary (must be `>= 0.55`).

To run the evaluations locally:
```bash
cd eval
npm install
node index.js
```
*Results are logged to `eval/eval_log.txt`.*

---

## 🤖 GitHub Actions Automation
The scraper is configured to run automatically every 6 hours. To enable this:
1. Push this repository to GitHub.
2. Go to your repository **Settings > Secrets and variables > Actions**.
3. Add your `SUPABASE_DB_URL` and `GEMINI_KEY_*` variables as Repository Secrets.
4. The workflow in `.github/workflows/daily_run.yml` will handle the rest!

## 📜 License
MIT
