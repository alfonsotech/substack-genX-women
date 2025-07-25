// seed-database.js
const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

async function seedDatabase() {
  const uri = process.env.MONGODB_URI;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("philosophers-alliance");
    
    // Read philosophers from JSON file
    const philosophersPath = path.join(__dirname, "src/data/philosophers.json");
    const philosophersData = JSON.parse(fs.readFileSync(philosophersPath, "utf8"));
    
    console.log(`Found ${philosophersData.length} philosophers to seed`);
    
    // Clear existing philosophers collection
    await db.collection("philosophers").deleteMany({});
    console.log("Cleared existing philosophers");
    
    // Insert philosophers
    const result = await db.collection("philosophers").insertMany(philosophersData);
    console.log(`Inserted ${result.insertedCount} philosophers`);
    
    // Verify
    const count = await db.collection("philosophers").countDocuments();
    console.log(`Total philosophers in database: ${count}`);
    
  } catch (error) {
    console.error("Error seeding database:", error);
  } finally {
    await client.close();
  }
}

seedDatabase().catch(console.error);
