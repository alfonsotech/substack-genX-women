const rssService = require("../../src/services/rssService");
const fs = require("fs-extra");
const path = require("path");

exports.handler = async function (event, context) {
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
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to load philosophers data" }),
      };
    }

    // Refresh feeds
    const result = await rssService.refreshAllFeeds(philosophers);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Feeds refreshed successfully",
        result,
      }),
    };
  } catch (error) {
    console.error("Error refreshing feeds:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to refresh feeds" }),
    };
  }
};
