const express = require("express");
const serverless = require("serverless-http");
const cors = require("cors");
const { connectToDatabase } = require("./utils/mongodb");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Load philosophers data
const philosophers = require("../../src/data/philosophers.json");

// API Routes
app.get("/api/philosophers", (req, res) => {
  res.json(philosophers);
});

// Get posts with MongoDB
app.get("/api/posts", async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Connect to MongoDB
    const db = await connectToDatabase();
    const postsCollection = db.collection("posts");

    // Build query
    let query = {};
    if (search) {
      const searchRegex = new RegExp(search, "i");
      query = {
        $or: [
          { title: searchRegex },
          { subtitle: searchRegex },
          { author: searchRegex },
        ],
      };
    }

    // Get total count
    const total = await postsCollection.countDocuments(query);

    // Get paginated posts
    const posts = await postsCollection
      .find(query)
      .sort({ publishDate: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .toArray();

    res.json({
      total,
      page: pageNum,
      limit: limitNum,
      posts,
      hasMore: pageNum * limitNum < total,
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// Get posts for a specific philosopher
app.get("/api/philosophers/:id/posts", async (req, res) => {
  try {
    const { id } = req.params;

    // Connect to MongoDB
    const db = await connectToDatabase();
    const postsCollection = db.collection("posts");

    // Get posts for this philosopher
    const posts = await postsCollection
      .find({ philosopherId: id })
      .sort({ publishDate: -1 })
      .toArray();

    res.json(posts);
  } catch (error) {
    console.error(
      `Error fetching posts for philosopher ${req.params.id}:`,
      error
    );
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

// Get philosopher logo
app.get("/api/philosophers/:id/logo", (req, res) => {
  const { id } = req.params;

  // Find the philosopher
  const philosopher = philosophers.find((p) => p.id === id);

  if (!philosopher) {
    return res.status(404).json({ error: "Philosopher not found" });
  }

  // For Netlify, we'll use a default approach
  // Just redirect to the Substack URL favicon
  const substackDomain = new URL(philosopher.substackUrl).hostname;
  res.redirect(`https://${substackDomain}/favicon.ico`);
});

// Export the serverless function
module.exports.handler = serverless(app);
