const rssService = require("../../src/services/rssService");
const fs = require("fs-extra");
const path = require("path");

async function refreshFeeds() {
  try {
    // Load philosophers data
    let philosophers = [];
    try {
      philosophers = fs.readJsonSync(
        path.join(__dirname, "../../src/data/philosophers.json")
      );
      console.log(
        `Loaded ${philosophers.length} philosophers from philosophers.json`
      );
    } catch (error) {
      console.error("Error loading philosophers data:", error);
      throw new Error("Failed to load philosophers data");
    }

    // Refresh feeds using the existing RSS service
    console.log(`Starting refresh for ${philosophers.length} philosophers...`);
    const result = await rssService.refreshAllFeeds(philosophers);
    console.log(`Refresh completed:`, result);

    return {
      success: true,
      message: "Feeds refreshed successfully",
      updated: result.updated,
      newContentFound: result.newContentFound,
      newPosts: result.newPosts?.length || 0,
      totalPhilosophers: philosophers.length
    };
  } catch (error) {
    console.error("Error refreshing feeds:", error);
    throw error;
  }
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    const result = await refreshFeeds();
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in refresh-feeds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh feeds',
      message: error.message
    });
  }
};
