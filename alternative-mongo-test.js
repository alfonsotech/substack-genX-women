// alternative-mongo-test.js
require("dotenv").config();
const { MongoClient } = require("mongodb");

async function testConnection() {
  // Get the URI from environment variable
  const uri = process.env.MONGODB_URI;

  // Create a new MongoClient with explicit options
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // 5 second timeout
    connectTimeoutMS: 10000, // 10 second timeout
  });

  try {
    console.log("Attempting to connect...");
    await client.connect();
    console.log("Connected successfully to MongoDB!");

    // Just try to ping the database
    await client.db("admin").command({ ping: 1 });
    console.log("Ping successful!");
  } catch (err) {
    console.error("Connection error:", err);
  } finally {
    await client.close();
    console.log("Connection closed");
  }
}

testConnection().catch(console.error);
