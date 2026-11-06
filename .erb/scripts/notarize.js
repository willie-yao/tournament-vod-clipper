const { notarize } = require('@electron/notarize');

exports.default = async function notarizeMacos(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') {
    return;
  }

  if (process.env.CI !== 'true') {
    console.warn('Skipping notarizing step. Packaging is not running in CI');
    return;
  }

  const { APPLE_ID, APPLE_ID_PASS, APPLE_TEAM_ID, CSC_LINK } = process.env;
  if (!CSC_LINK || !APPLE_ID || !APPLE_ID_PASS || !APPLE_TEAM_ID) {
    console.warn(
      'Skipping notarizing step. CSC_LINK, APPLE_ID, APPLE_ID_PASS and APPLE_TEAM_ID must be set'
    );
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  await notarize({
    appPath: `${appOutDir}/${appName}.app`,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_ID_PASS,
    teamId: APPLE_TEAM_ID,
  });
};
