const RssParser = require("rss-parser");
const fs = require("fs-extra");
const path = require("path");

// Configure the RSS parser to capture enclosure tags
const parser = new RssParser({
  customFields: {
    item: [
      ["content:encoded", "content"],
      ["description", "description"],
      ["enclosure", "enclosure"],
    ],
    image: ["url", "title", "link"],
  },
});

// Define the cache directories - use /tmp for Netlify Functions
const isNetlify = process.env.NETLIFY === "true";
const CACHE_DIR = isNetlify
  ? path.join("/tmp", "cache")
  : path.join(__dirname, "../data/cache");

const POSTS_FILE = path.join(CACHE_DIR, "all-posts.json");

// Ensure the cache directory exists, with error handling
try {
  fs.ensureDirSync(CACHE_DIR);
  console.log(`Cache directory created at: ${CACHE_DIR}`);
} catch (error) {
  console.error(`Error creating cache directory: ${error.message}`);
  // Fallback to a different location if needed
  if (isNetlify) {
    console.log("Falling back to /tmp directory");
    CACHE_DIR = "/tmp";
    POSTS_FILE = path.join(CACHE_DIR, "all-posts.json");
    try {
      fs.ensureDirSync(CACHE_DIR);
    } catch (innerError) {
      console.error(`Error creating fallback directory: ${innerError.message}`);
    }
  }
}

// Track the latest posts for change detection
let latestPostsTimestamps = {};

// Extract subtitle from content or description
function extractSubtitle(content, description) {
  // Try to extract from content first
  if (content) {
    // Look for the first paragraph after removing HTML tags
    const contentText = content.replace(/<[^>]+>/g, " ").trim();
    const firstParagraph = contentText.split(/\n\s*\n/)[0];
    if (firstParagraph && firstParagraph.length > 0) {
      // Limit to a reasonable length for a subtitle
      return firstParagraph.length > 150
        ? firstParagraph.substring(0, 147) + "..."
        : firstParagraph;
    }
  }

  // Fall back to description
  if (description) {
    // Remove HTML tags and trim
    const descText = description.replace(/<[^>]+>/g, " ").trim();
    // Limit to a reasonable length for a subtitle
    return descText.length > 150
      ? descText.substring(0, 147) + "..."
      : descText;
  }

  return ""; // Return empty string if no subtitle found
}

// Extract the first image from content, description, or enclosure
function extractImage(item) {
  // 1. Check for enclosure tag first (this is where Substack puts the images)
  if (
    item.enclosure &&
    item.enclosure.url &&
    item.enclosure.type &&
    item.enclosure.type.startsWith("image/")
  ) {
    return item.enclosure.url;
  }

  // 2. Try content:encoded field
  if (item.content) {
    const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }

  // 3. Try description as fallback
  if (item.description) {
    const descImgMatch = item.description.match(/<img[^>]+src="([^">]+)"/);
    if (descImgMatch && descImgMatch[1]) {
      return descImgMatch[1];
    }
  }

  return null;
}

// Function to save posts to storage
function savePosts(philosopherId, posts) {
  try {
    // Ensure the cache directory exists
    fs.ensureDirSync(CACHE_DIR);

    // Save the posts for this philosopher
    const cacheFile = path.join(CACHE_DIR, `${philosopherId}.json`);
    fs.writeJsonSync(cacheFile, posts);

    // Update the all-posts file
    const allPosts = getAllPosts();

    // Remove existing posts from this philosopher
    const filteredPosts = allPosts.filter(
      (post) => post.philosopherId !== philosopherId
    );

    // Add the new posts
    const updatedPosts = [...filteredPosts, ...posts];

    // Sort by publish date (newest first)
    updatedPosts.sort(
      (a, b) => new Date(b.publishDate) - new Date(a.publishDate)
    );

    // Save the updated all-posts file
    fs.writeJsonSync(POSTS_FILE, updatedPosts);

    console.log(`Saved ${posts.length} posts for ${philosopherId}`);
  } catch (error) {
    console.error(`Error saving posts for ${philosopherId}:`, error);
  }
}

// Fetch feed for a philosopher
async function fetchFeed(philosopher) {
  try {
    console.log(`Fetching feed for ${philosopher.name}...`);
    const feed = await parser.parseURL(philosopher.rssUrl);

    console.log(`Feed for ${philosopher.name} has ${feed.items.length} items`);

    // Extract publication logo from feed
    let logoUrl = null;
    if (feed.image && feed.image.url) {
      logoUrl = feed.image.url;
      console.log(`Found logo for ${philosopher.name}: ${logoUrl}`);

      // Store the logo URL for this philosopher
      const logosDir = path.join(__dirname, "../data/logos");
      fs.ensureDirSync(logosDir);
      fs.writeJsonSync(path.join(logosDir, `${philosopher.id}.json`), {
        logoUrl,
      });
    }

    // Map feed items to our simplified format
    const posts = feed.items.map((item) => {
      // Extract cover image from enclosure, content, or description
      const coverImage = extractImage(item);

      return {
        id: item.guid || item.link,
        title: item.title,
        subtitle: extractSubtitle(item.content, item.description),
        author: philosopher.name,
        publicationName: philosopher.publicationName || feed.title,
        publishDate: new Date(item.pubDate).toISOString(),
        link: item.link,
        philosopherId: philosopher.id,
        coverImage: coverImage,
        logoUrl: logoUrl,
      };
    });

    return posts;
  } catch (error) {
    console.error(`Error fetching feed for ${philosopher.name}:`, error);
    return [];
  }
}

// Get philosopher logo
function getPhilosopherLogo(philosopherId) {
  const logoFile = path.join(__dirname, `../data/logos/${philosopherId}.json`);

  if (fs.existsSync(logoFile)) {
    try {
      const data = fs.readJsonSync(logoFile);
      return data.logoUrl;
    } catch (error) {
      console.error(`Error reading logo for ${philosopherId}:`, error);
    }
  }

  return null;
}

// Refresh all feeds
async function refreshAllFeeds(philosophers) {
  console.log(
    `Starting feed refresh for ${philosophers.length} philosophers...`
  );

  let newContentFound = false;
  let updatedFeeds = 0;
  let newPosts = [];

  for (const philosopher of philosophers) {
    try {
      // Make sure we have a valid RSS URL before trying to fetch
      if (!philosopher || !philosopher.rssUrl) {
        console.error(`Missing RSS URL for philosopher:`, philosopher);
        continue; // Skip this philosopher and continue with the next one
      }

      console.log(`Fetching feed for ${philosopher.name}...`);
      const posts = await fetchFeed(philosopher);

      // Check if we have new content
      if (posts.length > 0) {
        const latestPostDate = new Date(posts[0].publishDate).getTime();
        const previousLatestPostDate =
          latestPostsTimestamps[philosopher.id] || 0;

        if (latestPostDate > previousLatestPostDate) {
          // We found new content!
          newContentFound = true;
          updatedFeeds++;

          // Store the new posts that weren't there before
          const newPostsFromThisFeed = posts.filter(
            (post) =>
              new Date(post.publishDate).getTime() > previousLatestPostDate
          );

          newPosts.push(
            ...newPostsFromThisFeed.map((post) => ({
              ...post,
              philosopherId: philosopher.id,
              philosopherName: philosopher.name,
            }))
          );

          // Update our timestamp record
          latestPostsTimestamps[philosopher.id] = latestPostDate;
        }

        // Save the posts to your storage
        savePosts(philosopher.id, posts);
      }
    } catch (error) {
      console.error(`Error refreshing feed for ${philosopher.name}:`, error);
    }
  }

  if (newContentFound) {
    // Emit an event or trigger a notification
    emitNewContentEvent(newPosts);
  }

  return {
    updated: updatedFeeds,
    newContentFound,
    newPosts,
  };
}

// Function to emit events when new content is found
function emitNewContentEvent(newPosts) {
  // If you're using Socket.IO or a similar library
  if (global.io) {
    global.io.emit("newContent", {
      count: newPosts.length,
      posts: newPosts.slice(0, 5), // Send only the first 5 new posts to avoid large payloads
    });
  }

  // Store the latest posts for API access
  global.latestNewPosts = newPosts;
}

// Get all posts
function getAllPosts() {
  if (fs.existsSync(POSTS_FILE)) {
    try {
      return fs.readJsonSync(POSTS_FILE);
    } catch (error) {
      console.error("Error reading posts file:", error);
      return [];
    }
  }
  return [];
}

// Get posts for a specific philosopher
function getPostsByPhilosopher(philosopherId) {
  const cacheFile = path.join(CACHE_DIR, `${philosopherId}.json`);

  if (fs.existsSync(cacheFile)) {
    try {
      return fs.readJsonSync(cacheFile);
    } catch (error) {
      console.error(`Error reading posts for ${philosopherId}:`, error);
      return [];
    }
  }
  return [];
}

module.exports = {
  refreshAllFeeds,
  getAllPosts,
  getPostsByPhilosopher,
  getPhilosopherLogo,
  getLatestNewPosts: () => global.latestNewPosts || [],
};
