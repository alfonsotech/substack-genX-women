const rssService = require("../src/services/rssService");

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Get all posts from RSS service
    let allPosts = rssService.getAllPosts();
    
    // Apply search filter if provided
    if (search) {
      const searchRegex = new RegExp(search, "i");
      allPosts = allPosts.filter(post => 
        searchRegex.test(post.title) || 
        searchRegex.test(post.subtitle) || 
        searchRegex.test(post.author)
      );
    }

    // Calculate pagination
    const total = allPosts.length;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const posts = allPosts.slice(startIndex, endIndex);

    res.status(200).json({
      total,
      page: pageNum,
      limit: limitNum,
      posts,
      hasMore: endIndex < total,
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
};
