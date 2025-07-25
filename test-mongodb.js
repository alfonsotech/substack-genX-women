// test-mongodb.js
const { MongoClient } = require("mongodb");

async function testConnection() {
  // Use the environment variable
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error("MONGODB_URI environment variable is not set");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Successfully connected to MongoDB");

    // List databases to verify connection
    const dbs = await client.db().admin().listDatabases();
    console.log("Available databases:");
    dbs.databases.forEach((db) => console.log(` - ${db.name}`));
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
  } finally {
    await client.close();
  }
}

// If using dotenv
require("dotenv").config();

testConnection().catch(console.error);
