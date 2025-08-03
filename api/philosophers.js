const fs = require("fs-extra");
const path = require("path");

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Load philosophers data
    const philosophers = fs.readJsonSync(
      path.join(__dirname, "../src/data/philosophers.json")
    );
    
    res.status(200).json(philosophers);
  } catch (error) {
    console.error("Error loading philosophers:", error);
    res.status(500).json({ error: "Failed to load philosophers" });
  }
};
