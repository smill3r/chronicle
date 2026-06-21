export default {
  wikipedia: {
    // Contact UA — required by both the Wikipedia API and the WDQS endpoint.
    userAgent: "Chronicle/2.0 (portfolio project; smillerjess@gmail.com)",
  },
  mongo: {
    uri: process.env.MONGO_URI || "mongodb://localhost:27017/chronicle",
  },
};
