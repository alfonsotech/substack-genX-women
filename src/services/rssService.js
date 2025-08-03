const RssParser = require("rss-parser");
const fs = require("fs-extra");
const path = require("path");
const { connectToDatabase } = require("../../lib/mongodb");

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

// Define the cache directories - use /tmp for serverless environments (Netlify/Vercel)
const isNetlify = process.env.NETLIFY === "true";
const isVercel = process.env.VERCEL === "1";
const isServerless = isNetlify || isVercel;
let CACHE_DIR = isServerless
  ? path.join("/tmp", "cache")
  : path.join(__dirname, "../data/cache");

let POSTS_FILE = path.join(CACHE_DIR, "all-posts.json");

// Ensure the cache directory exists, with error handling
try {
  fs.ensureDirSync(CACHE_DIR);
  console.log(`Cache directory created at: ${CACHE_DIR}`);
} catch (error) {
  console.error(`Error creating cache directory: ${error.message}`);
  // Fallback to a different location if needed
  if (isServerless) {
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

// Function to save posts to MongoDB
async function savePosts(philosopherId, posts) {
  try {
    const db = await connectToDatabase();
    const postsCollection = db.collection("posts");

    // Remove existing posts from this philosopher
    await postsCollection.deleteMany({ philosopherId });

    // Insert new posts if any exist
    if (posts.length > 0) {
      // Add philosopherId to each post and ensure uniqueness
      const postsWithId = posts.map(post => ({
        ...post,
        philosopherId,
        _id: post.id, // Use the RSS item id as MongoDB _id for uniqueness
        createdAt: new Date(),
        updatedAt: new Date()
      }));

      // Use upsert to handle potential duplicates
      const bulkOps = postsWithId.map(post => ({
        updateOne: {
          filter: { _id: post._id },
          update: { $set: post },
          upsert: true
        }
      }));

      await postsCollection.bulkWrite(bulkOps);
    }

    console.log(`Saved ${posts.length} posts for ${philosopherId} to MongoDB`);
  } catch (error) {
    console.error(`Error saving posts for ${philosopherId}:`, error);
  }
}

// Fetch feed for a philosopher
async function fetchFeed(philosopher) {
  try {
    console.log(`Fetching feed for ${philosopher.name} from ${philosopher.rssUrl}...`);
    const feed = await parser.parseURL(philosopher.rssUrl);

    console.log(`Feed for ${philosopher.name} has ${feed.items.length} items`);
    
    if (feed.items.length > 0) {
      console.log(`First item: ${feed.items[0].title} (${feed.items[0].pubDate})`);
    }

    // Extract publication logo from feed
    let logoUrl = null;
    if (feed.image && feed.image.url) {
      logoUrl = feed.image.url;
      console.log(`Found logo for ${philosopher.name}: ${logoUrl}`);

      // Try to store the logo URL (skip if filesystem is read-only)
      try {
        const isServerless = process.env.NETLIFY === "true" || process.env.VERCEL === "1";
        const logosDir = isServerless 
          ? path.join("/tmp", "logos")
          : path.join(__dirname, "../data/logos");
        fs.ensureDirSync(logosDir);
        fs.writeJsonSync(path.join(logosDir, `${philosopher.id}.json`), {
          logoUrl,
        });
        console.log(`Saved logo for ${philosopher.name}`);
      } catch (logoError) {
        console.log(`Could not save logo for ${philosopher.name}, continuing without it:`, logoError.message);
        // Don't throw - continue processing posts
      }
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
  const isServerless = process.env.NETLIFY === "true" || process.env.VERCEL === "1";
  const logoFile = isServerless
    ? path.join("/tmp", "logos", `${philosopherId}.json`)
    : path.join(__dirname, `../data/logos/${philosopherId}.json`);

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
      console.log(`Processing ${posts.length} posts for ${philosopher.name}`);
      const latestPostDate = new Date(posts[0].publishDate).getTime();
      const previousLatestPostDate =
            latestPostsTimestamps[philosopher.id] || 0;

      console.log(`Latest post date: ${new Date(latestPostDate)}, Previous: ${new Date(previousLatestPostDate)}`);

      if (latestPostDate > previousLatestPostDate) {
            // We found new content!
      console.log(`New content found for ${philosopher.name}!`);
      newContentFound = true;
      updatedFeeds++;

      // Store the new posts that weren't there before
            const newPostsFromThisFeed = posts.filter(
        (post) =>
        new Date(post.publishDate).getTime() > previousLatestPostDate
      );

      console.log(`${newPostsFromThisFeed.length} new posts from ${philosopher.name}`);

      newPosts.push(
              ...newPostsFromThisFeed.map((post) => ({
          ...post,
          philosopherId: philosopher.id,
            philosopherName: philosopher.name,
              }))
        );

          // Update our timestamp record
            latestPostsTimestamps[philosopher.id] = latestPostDate;
          } else {
            console.log(`No new content for ${philosopher.name} (latest: ${new Date(latestPostDate)} vs previous: ${new Date(previousLatestPostDate)})`);
          }

          // Save the posts to MongoDB
          console.log(`Saving ${posts.length} posts to MongoDB for ${philosopher.name}`);
          await savePosts(philosopher.id, posts);
        } else {
          console.log(`No posts found for ${philosopher.name}`);
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

// Get all posts from MongoDB
async function getAllPosts() {
  try {
    const db = await connectToDatabase();
    const postsCollection = db.collection("posts");
    
    const posts = await postsCollection
      .find({})
      .sort({ publishDate: -1 })
      .toArray();
    
    return posts;
  } catch (error) {
    console.error("Error reading posts from MongoDB:", error);
    return [];
  }
}

// Get posts for a specific philosopher from MongoDB
async function getPostsByPhilosopher(philosopherId) {
  try {
    const db = await connectToDatabase();
    const postsCollection = db.collection("posts");
    
    const posts = await postsCollection
      .find({ philosopherId })
      .sort({ publishDate: -1 })
      .toArray();
    
    return posts;
  } catch (error) {
    console.error(`Error reading posts for ${philosopherId} from MongoDB:`, error);
    return [];
  }
}

module.exports = {
  refreshAllFeeds,
  getAllPosts,
  getPostsByPhilosopher,
  getPhilosopherLogo,
  getLatestNewPosts: () => global.latestNewPosts || [],
};
