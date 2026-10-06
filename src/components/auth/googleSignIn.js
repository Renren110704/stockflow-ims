// Thin wrapper around Google Identity Services (the official "Sign in with
// Google" browser library, loaded from Google's CDN — no npm package).

const GSI_SRC = 'https://accounts.google.com/gsi/client';

// Loads Google's script once. Call it early (e.g. on page mount) so the
// script is ready by the time the user clicks — browsers only allow the
// sign-in popup to open straight from a click.
export function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    let script = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (!script) {
      script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', () => resolve());
    script.addEventListener('error', () => reject(new Error('Could not load Google sign-in.')));
  });
}

// Opens Google's account-chooser popup and resolves with an access token.
// Rejects with an Error whose `.type` is 'popup_closed' when the user just
// closes the popup (callers should treat that as "cancelled", not an error).
export function requestGoogleAccessToken(clientId) {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google sign-in is still loading. Please try again.'));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || 'Google sign-in failed.'));
        } else {
          resolve(response.access_token);
        }
      },
      error_callback: (err) => {
        const error = new Error(
          err?.type === 'popup_failed_to_open'
            ? 'Your browser blocked the Google sign-in popup.'
            : 'Google sign-in was cancelled.'
        );
        error.type = err?.type;
        reject(error);
      },
    });
    client.requestAccessToken();
  });
}
