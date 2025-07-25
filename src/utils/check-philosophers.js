const fs = require("fs-extra");
const path = require("path");

// Path to philosophers.json
const philosophersPath = path.join(__dirname, "../data/philosophers.json");

// Check if file exists
if (fs.existsSync(philosophersPath)) {
  try {
    const philosophers = fs.readJsonSync(philosophersPath);
    console.log("Philosophers data loaded successfully:");
    console.log(`Found ${philosophers.length} philosophers:`);
    philosophers.forEach((p) => {
      console.log(`- ${p.name} (${p.id}): ${p.substackUrl}`);
    });
  } catch (error) {
    console.error("Error parsing philosophers.json:", error);
  }
} else {
  console.error("philosophers.json file not found at:", philosophersPath);
}
