const { MongoClient } = require("mongodb");

// Connection URI (from MongoDB Atlas)
const uri = process.env.MONGODB_URI;

// Cache the database connection
let cachedDb = null;

async function connectToDatabase() {
  // If the database connection is cached, use it
  if (cachedDb) {
    return cachedDb;
  }

  // If no connection is cached, create a new one
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    // Connect to the MongoDB cluster
    await client.connect();

    // Specify which database we want to use
    const db = client.db("philosophers-alliance");

    // Cache the database connection and return it
    cachedDb = db;
    return db;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
}

module.exports = { connectToDatabase };
