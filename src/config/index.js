require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  lightspeed: {
    apiUrl: process.env.LIGHTSPEED_API_URL || 'https://api.lightspeedapp.com/API/V3',
    accountId: process.env.LIGHTSPEED_ACCOUNT_ID,
    clientId: process.env.LIGHTSPEED_CLIENT_ID,
    clientSecret: process.env.LIGHTSPEED_CLIENT_SECRET,
    refreshToken: process.env.LIGHTSPEED_REFRESH_TOKEN,
  },

  highlevel: {
    apiUrl: process.env.HIGHLEVEL_API_URL || 'https://services.leadconnectorhq.com',
    apiKey: process.env.HIGHLEVEL_API_KEY,
    locationId: process.env.HIGHLEVEL_LOCATION_ID,
  },

  sync: {
    intervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES, 10) || 15,
  },
};

module.exports = config;
