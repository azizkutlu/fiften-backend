import crypto from 'node:crypto';

import { config, getRedirectUri } from './config.js';

const INSTAGRAM_OAUTH_URL = 'https://www.instagram.com/oauth/authorize';
const INSTAGRAM_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';

export function buildInstagramLoginUrl() {
  if (!config.metaAppId) {
    throw new Error('META_APP_ID tanimli degil.');
  }
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
  if (!config.metaAppId || !config.metaAppSecret) {
    throw new Error('META_APP_ID ve META_APP_SECRET tanimli olmali.');
  }
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
  if (!config.searchApiKey) {
    throw new Error('SEARCHAPI_API_KEY tanimlanmali.');
  }

  const url = new URL('https://www.searchapi.io/api/v1/search');
  url.searchParams.set('engine', 'instagram_profile');
  url.searchParams.set('username', username);
  url.searchParams.set('api_key', config.searchApiKey);

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

  return {
    username: data?.profile?.username || username,
    name: data?.profile?.name || '',
    profile_picture_url:
      data?.profile?.profile_picture_url ||
      data?.profile?.hd_profile_picture_url ||
      '',
    biography: data?.profile?.biography || '',
    website: data?.profile?.external_url || '',
    followers_count: data?.profile?.followers || 0,
    follows_count: data?.profile?.following || 0,
    media_count: data?.profile?.posts || 0,
    is_private: data?.profile?.is_private === true,
    is_verified: data?.profile?.is_verified === true
  };
}
