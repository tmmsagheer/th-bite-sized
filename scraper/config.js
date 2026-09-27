module.exports = {
  // === Back-off & Pacing Parameters ===
  backoff: {
    initialDelayMs: 15000,
    maxDelayMs: 135000,
    incrementMs: 30000
  },
  
  // Wait between processing each article to avoid rate-limiting
  articlePacingMs: 10000,

  // === Scraping Limits ===
  // Maximum number of successful free articles to scrape per category
  maxArticlesPerCategory: 5,
  
  // If an article is less than this many characters, assume it's blocked or empty
  minArticleLength: 100,

  // === Categories to Scrape ===
  // Uncomment the categories you want to include in the daily run.
  categories: [
    // --- Popular Sections ---
    // { name: 'Elections', url: 'https://www.thehindu.com/elections/' },
    // { name: 'Latest News', url: 'https://www.thehindu.com/latest-news/' },
    { name: 'National', url: 'https://www.thehindu.com/news/national/' },
    { name: 'International', url: 'https://www.thehindu.com/news/international/' },
    // { name: 'Videos', url: 'https://www.thehindu.com/videos/' },
    // { name: 'Life & Style', url: 'https://www.thehindu.com/life-and-style/' },
    // { name: 'Food', url: 'https://www.thehindu.com/food/' },
    // { name: 'Podcast', url: 'https://www.thehindu.com/podcast/' },
    // { name: 'Showcase', url: 'https://www.thehindu.com/showcase/' },
    // { name: 'Visual Story', url: 'https://www.thehindu.com/visual-story/' },

    // --- Opinion ---
    { name: 'Editorial', url: 'https://www.thehindu.com/opinion/editorial/' },
    // { name: 'Columns', url: 'https://www.thehindu.com/opinion/columns/' },
    // { name: 'Comment', url: 'https://www.thehindu.com/opinion/op-ed/' },
    // { name: 'Cartoon', url: 'https://www.thehindu.com/opinion/cartoon/' },
    // { name: 'Letters', url: 'https://www.thehindu.com/opinion/letters/' },
    // { name: 'Interview', url: 'https://www.thehindu.com/opinion/interview/' },
    // { name: 'Lead', url: 'https://www.thehindu.com/opinion/lead/' },

    // --- Business ---
    // { name: 'Agri-Business', url: 'https://www.thehindu.com/business/agri-business/' },
    // { name: 'Industry', url: 'https://www.thehindu.com/business/Industry/' },
    { name: 'Economy', url: 'https://www.thehindu.com/business/Economy/' },
    // { name: 'Markets', url: 'https://www.thehindu.com/business/markets/' },
    // { name: 'Budget', url: 'https://www.thehindu.com/business/budget/' },

    // --- Sport ---
    { name: 'Sport', url: 'https://www.thehindu.com/sport/' },
    // { name: 'Cricket', url: 'https://www.thehindu.com/sport/cricket/' },
    // { name: 'Football', url: 'https://www.thehindu.com/sport/football/' },
    // { name: 'Hockey', url: 'https://www.thehindu.com/sport/hockey/' },
    // { name: 'Tennis', url: 'https://www.thehindu.com/sport/tennis/' },
    // { name: 'Athletics', url: 'https://www.thehindu.com/sport/athletics/' },
    // { name: 'Motorsport', url: 'https://www.thehindu.com/sport/motorsport/' },
    // { name: 'Races', url: 'https://www.thehindu.com/sport/races/' },
    // { name: 'Other Sports', url: 'https://www.thehindu.com/sport/other-sports/' },

    // --- Sci-Tech ---
    { name: 'Science', url: 'https://www.thehindu.com/sci-tech/science/' },
    { name: 'Technology', url: 'https://www.thehindu.com/sci-tech/technology/' },
    // { name: 'Health', url: 'https://www.thehindu.com/sci-tech/health/' },
    // { name: 'Agriculture', url: 'https://www.thehindu.com/sci-tech/agriculture/' },
    // { name: 'Environment', url: 'https://www.thehindu.com/sci-tech/energy-and-environment/' },
    // { name: 'Gadgets', url: 'https://www.thehindu.com/sci-tech/technology/gadgets/' },
    // { name: 'Internet', url: 'https://www.thehindu.com/sci-tech/technology/internet/' }
  ]
};
