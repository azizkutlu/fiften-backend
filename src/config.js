import dotenv from 'dotenv';

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  appBaseUrl: required('APP_BASE_URL'),
  frontendSuccessUrl: required('FRONTEND_SUCCESS_URL'),
  metaAppId: process.env.META_APP_ID || '',
  metaAppSecret: process.env.META_APP_SECRET || '',
  metaRedirectPath: process.env.META_REDIRECT_PATH || '/auth/instagram/callback',
  instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN || '',
  instagramBusinessAccountId: process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '',
  searchApiKey: process.env.SEARCHAPI_API_KEY || ''
};

export function getRedirectUri() {
  return new URL(config.metaRedirectPath, config.appBaseUrl).toString();
}
