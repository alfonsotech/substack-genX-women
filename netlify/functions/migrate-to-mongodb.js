// netlify/functions/migrate-to-mongodb.js
const fs = require("fs-extra");
const path = require("path");
const { MongoClient } = require("mongodb");

exports.handler = async function (event, context) {
  try {
    // Try to load posts from various possible locations
    const possiblePaths = [
      path.join(__dirname, "../../src/data/cache/all-posts.json"),
      path.join(__dirname, "../src/data/cache/all-posts.json"),
      "/opt/build/repo/src/data/cache/all-posts.json",
      "/tmp/cache/all-posts.json",
    ];

    let posts = [];
    let loaded = false;

    for (const filePath of possiblePaths) {
      try {
        if (fs.existsSync(filePath)) {
          posts = fs.readJsonSync(filePath);
          console.log(`Loaded ${posts.length} posts from ${filePath}`);
          loaded = true;
          break;
        }
      } catch (pathError) {
        console.log(`Failed to load from ${filePath}: ${pathError.message}`);
      }
    }

    if (!loaded) {
      throw new Error("Could not find all-posts.json in any location");
    }

    // Connect to MongoDB
    const client = new MongoClient(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await client.connect();
    const db = client.db("philosophers-alliance");
    const postsCollection = db.collection("posts");

    // Create indexes for better performance
    await postsCollection.createIndex({ id: 1 }, { unique: true });
    await postsCollection.createIndex({
      title: "text",
      subtitle: "text",
      author: "text",
    });
    await postsCollection.createIndex({ philosopherId: 1 });
    await postsCollection.createIndex({ publishDate: -1 });

    // Use bulk operations for efficiency
    const operations = posts.map((post) => ({
      updateOne: {
        filter: { id: post.id },
        update: {
          $set: {
            ...post,
            // Ensure dates are proper Date objects
            publishDate: new Date(post.publishDate),
            lastUpdated: new Date(),
          },
        },
        upsert: true,
      },
    }));

    const result = await postsCollection.bulkWrite(operations);
    console.log(
      `Updated ${result.modifiedCount} and inserted ${result.upsertedCount} posts in MongoDB`
    );

    await client.close();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Successfully migrated ${posts.length} posts to MongoDB`,
        updated: result.modifiedCount,
        inserted: result.upsertedCount,
      }),
    };
  } catch (error) {
    console.error("Error migrating posts:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
