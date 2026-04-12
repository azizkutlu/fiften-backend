import crypto from 'node:crypto';

import { config, getRedirectUri } from './config.js';

const INSTAGRAM_OAUTH_URL = 'https://www.instagram.com/oauth/authorize';
const INSTAGRAM_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';

export function buildInstagramLoginUrl() {
  const state = crypto.randomUUID();
  const redirectUri = getRedirectUri();

  const url = new URL(INSTAGRAM_OAUTH_URL);
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
  const body = new URLSearchParams({
    client_id: config.metaAppId,
    client_secret: config.metaAppSecret,
    grant_type: 'authorization_code',
    redirect_uri: getRedirectUri(),
    code
  });

  const response = await fetch(INSTAGRAM_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json'
    },
    body
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || 'Meta token exchange failed';
    throw new Error(message);
  }

  return data;
}
