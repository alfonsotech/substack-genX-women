const axios = require("axios");

exports.handler = async function (event, context) {
  try {
    // Call the refresh-feeds function
    const response = await axios.post(
      `${process.env.URL}/.netlify/functions/refresh-feeds`,
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
        message: "Scheduled refresh completed",
        result: response.data,
      }),
    };
  } catch (error) {
    console.error("Error in scheduled refresh:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to execute scheduled refresh" }),
    };
  }
};
