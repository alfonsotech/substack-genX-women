const axios = require("axios");

exports.handler = async function (event, context) {
  try {
    // Call our fetch-feeds function
    const response = await axios.post(
      `${process.env.URL}/.netlify/functions/fetch-feeds`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Scheduled fetch completed successfully",
        result: response.data,
      }),
    };
  } catch (error) {
    console.error("Error in scheduled fetch:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
