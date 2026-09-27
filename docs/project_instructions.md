## Phase 1: Initial Setup & Environment

1. **Install Google Antigravity:** Download and install Antigravity 2.0 for your operating system. Launch the application and sign in with your Google Account.
2. **Create the Workspace:** Open the Antigravity Agent Manager, click "+ Open Workspace," and create a new folder on your machine named `in-shorts-clone`.
3. **Initialize Environment:** In the Antigravity chat panel, paste this prompt:
> "Verify if Git and Node.js are installed on this system. If they are not, install them using the optimal method for my OS. Ask for permission before running any installation commands. Once verified, initialize a new Node.js project in this directory."


4. **Account Setup:**
* **Supabase:** Go to Supabase.com and create a free project. Save your `Project URL` and `anon public` API key.
* **Google AI Studio:** Go to aistudio.google.com and generate a free API key for Gemini 1.5 Flash.
* **GitHub:** Create a new private repository for this project.



## Phase 2: Database Initialization (Supabase)

You need to configure your backend to store the articles, vector embeddings, and your feedback.

1. In the Antigravity chat panel, provide your Supabase credentials and paste this prompt:
> "Connect to my Supabase project using the provided URL and API key. Generate the SQL commands to create two tables: 'articles' and 'user_interactions'. The 'articles' table must include a `pgvector` column for 768-dimensional embeddings, title, original_url, summary, category, and tags. The 'user_interactions' table will store likes, dislikes, and bookmarks linked to the article ID. Apply the schema directly to my Supabase database."



## Phase 3: Quality Control (The Golden Dataset & Evaluation)

Ensure the LLM accurately condenses complex topics—such as nuanced financial news tracking automotive tickers (M&M, MARUTI, BAJAJ-AUTO) on the National Stock Exchange—without losing critical context or hallucinating.

1. **Create the Dataset:** Create a file named `golden_dataset.json` in your root directory. Populate it with 5 to 10 real articles from The Hindu (include a mix of politics, sports, and complex financial/automotive news) along with your manually written, perfect 60-80 word summaries.
2. **Build the Evaluator:** Paste this prompt into Antigravity:
> "Create a local evaluation script named `eval.js`. This script should process the articles in `golden_dataset.json` using the Gemini 1.5 Flash API with a zero-shot summarization prompt. Programmatically assert the following for each output: 1. The output strictly matches the requested JSON schema. 2. The summary string is strictly between 60 and 80 words. 3. Calculate the semantic similarity between the original text and the generated summary locally using the `@xenova/transformers` library (cosine similarity). Output pass/fail metrics and the similarity scores to the terminal."


3. **Iterate:** Run `node eval.js`. Adjust the system prompt in your code until the outputs consistently pass the word count bounds and achieve high semantic similarity scores.

## Phase 4: The Zero-Cost Backend Pipeline

Automate the extraction and summarization process.

1. **The Authentication Bypass:**
* Run a temporary script in Antigravity to log into The Hindu manually:
> "Write a temporary Playwright script that launches a non-headless browser, navigates to The Hindu, waits 90 seconds for me to log in manually, and then saves the session state to `auth_state.json`."


* Copy the contents of `auth_state.json` and save it as a GitHub Secret named `HINDU_AUTH_STATE` in your repository. Save your Gemini API key and Supabase keys as secrets as well.


2. **The Pipeline Script:** Paste this prompt into Antigravity:
> "Write a Node.js script named `daily_scraper.js` using Playwright and the Google Gen AI SDK. The script must: 1. Load session cookies from the `HINDU_AUTH_STATE` environment variable. 2. Scrape the text from today's top 20 articles on The Hindu website. 3. Pass each article to Gemini 1.5 Flash to extract the category and a 60-80 word summary. 4. Generate a text embedding for the summary using Gemini. 5. Upsert the final JSON data and embedding into my Supabase 'articles' table."


3. **The Automation Automation:** Paste this prompt into Antigravity:
> "Create a GitHub Actions YAML workflow file in `.github/workflows/daily_run.yml`. Configure it to run `daily_scraper.js` automatically every day at 6:00 AM IST. Ensure it maps all the necessary environment variables from GitHub Secrets."



## Phase 5: Frontend Mobile App Generation (React Native)

Generate the swipeable reading interface.

1. **Generate UI:** Paste this prompt into Antigravity:
> "Build a mobile-first app using React Native and Expo. The UI must consist of full-screen cards that the user can swipe vertically. Each card displays an article title, category, and the 60-80 word summary. Include highly visible 'Like', 'Dislike', and 'Bookmark' buttons on each card. Keep the code modular within a `src/` directory."


2. **Connect Backend:** Paste this prompt into Antigravity:
> "Connect the React Native app to my Supabase database. Fetch the daily news summaries from the 'articles' table to populate the swipeable cards. Configure the Like, Dislike, and Bookmark buttons to send the feedback payload (user ID, article ID, action type) back to the 'user_interactions' table."


3. **Test:** Ask Antigravity to start the Expo server. Download Expo Go on your mobile device, scan the terminal QR code, and test the swiping and database connections on your physical phone.

## Phase 6: Daily Usage & Maintenance

1. **Installation:** Once the UI feels right, ask Antigravity to configure the Expo Application Services (EAS) build profile. Run `eas build -p android` (or iOS) to generate the final application file (`.apk` or `.ipa`) for permanent installation on your device.
2. **Session Expiry Protocol:** The Hindu's session cookies will eventually expire. When the GitHub Action logs a scraping failure (due to a paywall or login redirect), repeat the temporary manual login script from Phase 4, Step 1. Copy the new `auth_state.json` contents and update the `HINDU_AUTH_STATE` secret in GitHub. The pipeline will resume normally the next morning.

## Phase 7: Future Expansions & Enhancements

Once the core pipeline is stable, you can leverage the stored data to build advanced features.

1. **Recommendation Engine:** Use the vector embeddings stored in `pgvector`. Modify your Supabase fetch query to return articles that have a high cosine similarity to the embeddings of articles you have previously "Liked", mathematically surfacing your preferred topics.
2. **Specialized Dashboards:** Because you are generating highly structured JSON, you can add custom UI screens. You can instruct Antigravity to build a dedicated tab that aggregates specific categories—for instance, filtering your feed to isolate fiscal updates and tracking sentiment shifts for your automotive investment portfolio.