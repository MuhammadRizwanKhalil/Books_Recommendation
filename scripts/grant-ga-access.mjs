/**
 * grant-ga-access.mjs
 *
 * Grants the GA4 service account Viewer access to your GA4 property
 * using OAuth2 (your personal Google account that owns the GA4 property).
 *
 * Prerequisites:
 *   1. In Google Cloud Console → APIs & Services → Credentials
 *      → Create Credentials → OAuth 2.0 Client ID → Desktop app → Create
 *      → Copy the Client ID and Client Secret shown
 *   2. Your real GA4 numeric Property ID
 *      (GA4 → Admin → Property Settings → copy the number, e.g. 412345678)
 *
 * Run:
 *   node scripts/grant-ga-access.mjs
 */

import http from 'http';
import https from 'https';
import { createInterface } from 'readline';
import { exec } from 'child_process';

const SERVICE_ACCOUNT_EMAIL = 'ga-dashboard-reader@thebooktimes.iam.gserviceaccount.com';
const REDIRECT_PORT = 8085;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;
const SCOPE = 'https://www.googleapis.com/auth/analytics.manage.users';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"` :
              process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
}

function waitForCode() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      res.writeHead(200, { 'Content-Type': 'text/html' });
      if (code) {
        res.end('<html><body style="font-family:sans-serif;padding:40px"><h2>✅ Authorized!</h2><p>You can close this tab and return to the terminal.</p></body></html>');
        server.close();
        resolve(code);
      } else {
        res.end('<html><body style="font-family:sans-serif;padding:40px"><h2>❌ Error</h2><p>' + (error || 'Unknown error') + '</p></body></html>');
        server.close();
        reject(new Error(error || 'OAuth2 error'));
      }
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`\n⏳ Waiting for Google sign-in callback on port ${REDIRECT_PORT}...`);
    });

    server.on('error', reject);
  });
}

function httpsPost(hostname, path, data, headers) {
  return new Promise((resolve, reject) => {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    const req = https.request({ hostname, path, method: 'POST', headers: { ...headers, 'Content-Length': Buffer.byteLength(body) } }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function exchangeCodeForToken(clientId, clientSecret, code) {
  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const res = await httpsPost('oauth2.googleapis.com', '/token', params.toString(), {
    'Content-Type': 'application/x-www-form-urlencoded',
  });

  if (!res.body.access_token) {
    throw new Error('Token exchange failed: ' + JSON.stringify(res.body));
  }
  return res.body.access_token;
}

async function grantAccess(accessToken, propertyId) {
  const numericId = String(propertyId).replace('properties/', '');
  const path = `/v1beta/properties/${numericId}/accessBindings`;

  const res = await httpsPost('analyticsadmin.googleapis.com', path, {
    roles: ['predefinedRoles/viewer'],
    user: SERVICE_ACCOUNT_EMAIL,
  }, {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  });

  return res;
}

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  GA4 Service Account Access Granter');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('You need an OAuth2 Client ID (Desktop type) from Cloud Console.');
  console.log('Go to: https://console.cloud.google.com/apis/credentials?project=thebooktimes');
  console.log('→ Create Credentials → OAuth 2.0 Client ID → Desktop app → Create\n');

  const clientId = (await ask('Paste your OAuth2 Client ID:     ')).trim();
  const clientSecret = (await ask('Paste your OAuth2 Client Secret: ')).trim();
  const propertyIdRaw = (await ask('Paste your GA4 numeric Property ID (e.g. 412345678): ')).trim();

  if (!clientId || !clientSecret || !propertyIdRaw) {
    console.error('\n❌ All three values are required.');
    process.exit(1);
  }

  // Build auth URL
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('\n🌐 Opening browser for Google sign-in...');
  console.log('   (Sign in with the account that owns the GA4 property)\n');
  console.log('   If browser does not open, go to:\n');
  console.log('   ' + authUrl.toString() + '\n');

  openBrowser(authUrl.toString());

  let code;
  try {
    code = await waitForCode();
  } catch (err) {
    console.error('\n❌ Failed to get authorization code:', err.message);
    process.exit(1);
  }

  console.log('\n🔄 Exchanging code for access token...');
  let accessToken;
  try {
    accessToken = await exchangeCodeForToken(clientId, clientSecret, code);
    console.log('✅ Got access token');
  } catch (err) {
    console.error('\n❌ Token exchange failed:', err.message);
    process.exit(1);
  }

  console.log(`\n🔄 Granting Viewer access to: ${SERVICE_ACCOUNT_EMAIL}`);
  console.log(`   On property: properties/${propertyIdRaw.replace('properties/', '')}`);

  const result = await grantAccess(accessToken, propertyIdRaw);

  if (result.status === 200 || result.status === 201) {
    console.log('\n✅ SUCCESS! Service account now has Viewer access to your GA4 property.');
    console.log('   Access binding:', JSON.stringify(result.body, null, 2));
    console.log('\nNow update GA_PROPERTY_ID in server/.env to:', propertyIdRaw.replace('properties/', ''));
    console.log('Then restart your backend server.\n');
  } else if (result.status === 409) {
    console.log('\n✅ Service account already has access (409 = already exists). You are good to go!');
    console.log('\nNow update GA_PROPERTY_ID in server/.env to:', propertyIdRaw.replace('properties/', ''));
  } else {
    console.error('\n❌ API call failed with status', result.status);
    console.error('Response:', JSON.stringify(result.body, null, 2));
    console.error('\nCommon causes:');
    console.error('  - Google Analytics Data API not enabled in Cloud Console');
    console.error('    → https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com?project=thebooktimes');
    console.error('  - Google Analytics Admin API not enabled');
    console.error('    → https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com?project=thebooktimes');
  }

  rl.close();
}

main().catch(err => {
  console.error('\n❌ Unexpected error:', err.message);
  rl.close();
  process.exit(1);
});
