const { MongoClient } = require("mongodb");

class DatabaseService {
  constructor() {
    this.client = null;
    this.db = null;
  }

  async connect() {
    try {
      if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI environment variable is not set");
      }
      
      this.client = new MongoClient(process.env.MONGODB_URI);
      await this.client.connect();
      this.db = this.client.db("philosophers-alliance");
      console.log("Connected to MongoDB");
    } catch (error) {
      console.error("Error connecting to MongoDB:", error);
      throw error;
    }
  }

  async getPhilosophers() {
    try {
      // Read philosophers from JSON file (they're not stored in MongoDB)
      const fs = require("fs-extra");
      const path = require("path");
      const philosophers = fs.readJsonSync(
        path.join(__dirname, "../data/philosophers.json")
      );
      return philosophers;
    } catch (error) {
      console.error("Error fetching philosophers:", error);
      return [];
    }
  }

  async getPosts() {
    try {
      if (!this.db) await this.connect();
      const posts = await this.db.collection("posts").find({}).sort({ publishDate: -1 }).toArray();
      return posts;
    } catch (error) {
      console.error("Error fetching posts:", error);
      return [];
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
      console.log("Disconnected from MongoDB");
    }
  }
}

module.exports = new DatabaseService();
