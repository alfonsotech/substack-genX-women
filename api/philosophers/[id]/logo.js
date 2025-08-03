const fs = require("fs-extra");
const path = require("path");
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
    // Load philosophers data
    const philosophers = fs.readJsonSync(
      path.join(__dirname, "../../../src/data/philosophers.json")
    );
    
    const philosopher = philosophers.find(p => p.id === id);
    
    if (!philosopher) {
      return res.status(404).json({ error: "Philosopher not found" });
    }
    
    // Try to get cached logo first
    const logoUrl = rssService.getPhilosopherLogo(id);
    if (logoUrl) {
      return res.redirect(logoUrl);
    }
    
    // Fallback to Substack favicon
    const substackDomain = new URL(philosopher.substackUrl).hostname;
    res.redirect(`https://${substackDomain}/favicon.ico`);
    
  } catch (error) {
    console.error(`Error fetching logo for philosopher ${id}:`, error);
    res.status(500).json({ error: "Failed to fetch logo" });
  }
};
