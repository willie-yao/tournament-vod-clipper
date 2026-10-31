require('ts-node').register({ transpileOnly: true });
require('dotenv').config();
const loadGoogleDesktopClient =
  require('../configs/googleDesktopClient').default;

const googleDesktopClient = loadGoogleDesktopClient();
process.env.GOOGLE_DESKTOP_CLIENT_ID = googleDesktopClient.clientId;
process.env.GOOGLE_DESKTOP_CLIENT_SECRET = googleDesktopClient.clientSecret;
require('../../src/main/main');
