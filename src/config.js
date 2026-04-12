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
  metaAppId: required('META_APP_ID'),
  metaAppSecret: required('META_APP_SECRET'),
  metaRedirectPath: process.env.META_REDIRECT_PATH || '/auth/instagram/callback'
};

export function getRedirectUri() {
  return new URL(config.metaRedirectPath, config.appBaseUrl).toString();
}

