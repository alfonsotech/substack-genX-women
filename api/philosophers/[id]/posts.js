const rssService = require("../../../src/services/rssService");

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { id } = req.query;
  
  try {
    const posts = await rssService.getPostsByPhilosopher(id);
    res.status(200).json(posts);
  } catch (error) {
    console.error(`Error fetching posts for philosopher ${id}:`, error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
};
