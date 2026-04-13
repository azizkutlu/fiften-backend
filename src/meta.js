import crypto from 'node:crypto';

import { config, getRedirectUri } from './config.js';

const INSTAGRAM_OAUTH_URL = 'https://www.instagram.com/oauth/authorize';
const INSTAGRAM_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const GRAPH_API_BASE_URL = 'https://graph.facebook.com/v23.0';

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
      'instagram_business_manage_comments'
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

export async function searchInstagramBusinessProfile(username) {
  if (!config.instagramAccessToken || !config.instagramBusinessAccountId) {
    throw new Error(
      'INSTAGRAM_ACCESS_TOKEN ve INSTAGRAM_BUSINESS_ACCOUNT_ID tanimlanmali.'
    );
  }

  const url = new URL(
    `${GRAPH_API_BASE_URL}/${config.instagramBusinessAccountId}`
  );
  url.searchParams.set(
    'fields',
    `business_discovery.username(${username}){username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website}`
  );
  url.searchParams.set('access_token', config.instagramAccessToken);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      data?.error?.message || 'Instagram business discovery request failed';
    throw new Error(message);
  }

  return data?.business_discovery || null;
}
