const RssParser = require("rss-parser");
const { connectToDatabase } = require("./utils/mongodb");

// Configure the RSS parser
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

// Extract subtitle from content or description
function extractSubtitle(content, description) {
  if (content) {
    const contentText = content.replace(/<[^>]+>/g, " ").trim();
    const firstParagraph = contentText.split(/\n\s*\n/)[0];
    if (firstParagraph && firstParagraph.length > 0) {
      return firstParagraph.length > 150
        ? firstParagraph.substring(0, 147) + "..."
        : firstParagraph;
    }
  }

  if (description) {
    const descText = description.replace(/<[^>]+>/g, " ").trim();
    return descText.length > 150
      ? descText.substring(0, 147) + "..."
      : descText;
  }

  return "";
}

// Extract image from item
function extractImage(item) {
  if (
    item.enclosure &&
    item.enclosure.url &&
    item.enclosure.type &&
    item.enclosure.type.startsWith("image/")
  ) {
    return item.enclosure.url;
  }

  if (item.content) {
    const imgMatch = item.content.match(/<img[^>]+src="([^">]+)"/);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }

  if (item.description) {
    const descImgMatch = item.description.match(/<img[^>]+src="([^">]+)"/);
    if (descImgMatch && descImgMatch[1]) {
      return descImgMatch[1];
    }
  }

  return null;
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
    }

    // Map feed items to our simplified format
    return feed.items.map((item) => {
      const coverImage = extractImage(item);

      return {
        id: item.guid || item.link,
        title: item.title,
        subtitle: extractSubtitle(item.content, item.description),
        author: philosopher.name,
        publicationName: philosopher.publicationName || feed.title,
        publishDate: new Date(item.pubDate),
        link: item.link,
        philosopherId: philosopher.id,
        coverImage: coverImage,
        logoUrl: logoUrl,
        lastUpdated: new Date(),
      };
    });
  } catch (error) {
    console.error(`Error fetching feed for ${philosopher.name}:`, error);
    return [];
  }
}

// Handler for the serverless function
exports.handler = async function (event, context) {
  try {
    // Load philosophers data
    const philosophers = require("../../src/data/philosophers.json");

    // Connect to MongoDB
    const db = await connectToDatabase();
    const postsCollection = db.collection("posts");

    // Create index for faster searches
    await postsCollection.createIndex({
      title: "text",
      subtitle: "text",
      author: "text",
    });
    await postsCollection.createIndex({ philosopherId: 1 });
    await postsCollection.createIndex({ publishDate: -1 });

    // Process philosophers in batches to avoid timeout
    // For Netlify, we'll process just a few at a time
    const batchSize = 5;
    const philosopherBatch = philosophers.slice(0, batchSize);

    let totalPosts = 0;

    for (const philosopher of philosopherBatch) {
      const posts = await fetchFeed(philosopher);

      if (posts.length > 0) {
        // Use bulk operations for efficiency
        const operations = posts.map((post) => ({
          updateOne: {
            filter: { id: post.id },
            update: { $set: post },
            upsert: true,
          },
        }));

        const result = await postsCollection.bulkWrite(operations);
        console.log(
          `Updated ${result.upsertedCount + result.modifiedCount} posts for ${
            philosopher.name
          }`
        );
        totalPosts += posts.length;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully processed ${philosopherBatch.length} philosophers and found ${totalPosts} posts`,
        processedPhilosophers: philosopherBatch.map((p) => p.name),
      }),
    };
  } catch (error) {
    console.error("Error in fetch-feeds function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
