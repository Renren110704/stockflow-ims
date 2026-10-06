// Verifies a Google OAuth access token (obtained in the browser through
// Google Identity Services) and returns the Google profile behind it.
//
// Two checks matter:
//   1. The token was issued to OUR Google client id (`aud`), so a token
//      minted for some other app can't be replayed against this API.
//   2. Google says the email address is verified.
//
// Uses Node's built-in fetch — no extra dependency.

const TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

function fail(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function getJson(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch {
    throw fail(502, 'Could not reach Google. Please try again.');
  }
  if (!res.ok) throw fail(400, 'Invalid Google sign-in. Please try again.');
  return res.json();
}

export async function verifyGoogleAccessToken(accessToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw fail(503, 'Google sign-in is not configured on the server.');
  }

  const info = await getJson(`${TOKENINFO_URL}?access_token=${encodeURIComponent(accessToken)}`);
  if (info.aud !== clientId) {
    throw fail(400, 'Invalid Google sign-in. Please try again.');
  }

  const profile = await getJson(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const emailVerified = profile.email_verified === true || profile.email_verified === 'true';
  if (!profile.sub || !profile.email || !emailVerified) {
    throw fail(403, 'Your Google account email is not verified.');
  }

  return {
    googleId: profile.sub,
    email: String(profile.email).toLowerCase(),
    name: profile.name || profile.email,
  };
}
