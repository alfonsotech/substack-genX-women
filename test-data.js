// test-data.js
const { MongoClient } = require("mongodb");
require("dotenv").config();

async function checkData() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("philosophers-alliance");
    
    // Check philosophers collection
    const philosophersCount = await db.collection("philosophers").countDocuments();
    console.log(`Philosophers count: ${philosophersCount}`);
    
    // Check posts collection
    const postsCount = await db.collection("posts").countDocuments();
    console.log(`Posts count: ${postsCount}`);
    
    // Sample data
    const samplePhilosopher = await db.collection("philosophers").findOne();
    console.log("Sample philosopher:", samplePhilosopher);
    
    const samplePost = await db.collection("posts").findOne();
    console.log("Sample post:", samplePost ? samplePost.title : "No posts found");
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
}

checkData().catch(console.error);
