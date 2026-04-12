import crypto from 'node:crypto';

import { config, getRedirectUri } from './config.js';

const META_OAUTH_URL = 'https://www.facebook.com/v23.0/dialog/oauth';
const META_TOKEN_URL = 'https://graph.facebook.com/v23.0/oauth/access_token';

export function buildInstagramLoginUrl() {
  const state = crypto.randomUUID();
  const redirectUri = getRedirectUri();

  const url = new URL(META_OAUTH_URL);
  url.searchParams.set('client_id', config.metaAppId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set(
    'scope',
    [
      'instagram_business_basic',
      'instagram_business_manage_messages',
      'instagram_business_manage_comments',
      'instagram_business_content_publish'
    ].join(',')
  );

  return { url: url.toString(), state };
}

export async function exchangeCodeForAccessToken(code) {
  const url = new URL(META_TOKEN_URL);
  url.searchParams.set('client_id', config.metaAppId);
  url.searchParams.set('client_secret', config.metaAppSecret);
  url.searchParams.set('redirect_uri', getRedirectUri());
  url.searchParams.set('code', code);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || 'Meta token exchange failed';
    throw new Error(message);
  }

  return data;
}

