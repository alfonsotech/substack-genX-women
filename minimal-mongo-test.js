// minimal-mongo-test.js
require("dotenv").config();
const { MongoClient } = require("mongodb");

async function testConnection() {
  // Get the URI from environment variable
  const uri = process.env.MONGODB_URI;

  // Print the URI (with password hidden)
  const maskedUri = uri.replace(/:[^:]*@/, ":****@");
  console.log("Connecting with URI:", maskedUri);

  // Create a new MongoClient
  const client = new MongoClient(uri);

  try {
    // Connect to the MongoDB server
    console.log("Attempting to connect...");
    await client.connect();
    console.log("Connected successfully to MongoDB!");

    // List databases
    const adminDb = client.db().admin();
    const result = await adminDb.listDatabases();
    console.log("Databases:");
    result.databases.forEach((db) => {
      console.log(` - ${db.name}`);
    });
  } catch (err) {
    console.error("Connection error:", err);
  } finally {
    // Close the connection
    await client.close();
    console.log("Connection closed");
  }
}

testConnection().catch(console.error);
