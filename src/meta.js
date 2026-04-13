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

  const profile = data?.profile || {};
  const profilePictureUrl = firstNonEmptyString([
    profile?.profile_picture_url,
    profile?.hd_profile_picture_url,
    profile?.profile_pic_url,
    profile?.profile_pic_url_hd,
    profile?.profile_picture,
    profile?.avatar_url,
    profile?.avatar,
    profile?.image,
    profile?.thumbnail,
    profile?.thumbnail_url
  ]);

  return {
    username: profile?.username || username,
    name: profile?.name || profile?.full_name || '',
    profile_picture_url: profilePictureUrl,
    biography: profile?.biography || '',
    website: profile?.external_url || profile?.website || '',
    followers_count: profile?.followers || profile?.followers_count || 0,
    follows_count: profile?.following || profile?.following_count || 0,
    media_count: profile?.posts || profile?.media_count || 0,
    is_private: profile?.is_private === true,
    is_verified: profile?.is_verified === true
  };
}

function firstNonEmptyString(values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
}
