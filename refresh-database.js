// refresh-database.js
const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");
const rssService = require("./src/services/rssService");
require("dotenv").config();

async function refreshDatabase() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("philosophers-alliance");
    
    // 1. Clear all existing data
    console.log("Clearing existing data...");
    await db.collection("philosophers").deleteMany({});
    await db.collection("posts").deleteMany({});
    console.log("✅ Cleared philosophers and posts collections");
    
    // 2. Re-insert philosophers from JSON
    const philosophersPath = path.join(__dirname, "src/data/philosophers.json");
    const philosophersData = JSON.parse(fs.readFileSync(philosophersPath, "utf8"));
    
    const philosophersResult = await db.collection("philosophers").insertMany(philosophersData);
    console.log(`✅ Inserted ${philosophersResult.insertedCount} philosophers`);
    
    // 3. Fetch fresh RSS data
    console.log("Fetching fresh RSS data...");
    
    // Refresh all feeds
    await rssService.refreshAllFeeds(philosophersData);
    
    // 4. Save posts to database
    const allPosts = rssService.getAllPosts();
    if (allPosts.length > 0) {
      await db.collection("posts").insertMany(allPosts);
      console.log(`✅ Inserted ${allPosts.length} posts to database`);
    } else {
      console.log("⚠️  No posts found to insert");
    }
    
    // 5. Verify data
    const philosophersCount = await db.collection("philosophers").countDocuments();
    const postsCount = await db.collection("posts").countDocuments();
    
    console.log("\n🎉 Database refresh complete!");
    console.log(`📊 Final counts:`);
    console.log(`   - Philosophers: ${philosophersCount}`);
    console.log(`   - Posts: ${postsCount}`);
    
  } catch (error) {
    console.error("❌ Error refreshing database:", error);
  } finally {
    await client.close();
  }
}

refreshDatabase().catch(console.error);
