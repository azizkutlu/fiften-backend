import cors from 'cors';
import express from 'express';

import { config, getRedirectUri } from './config.js';
import {
  buildInstagramLoginUrl,
  exchangeCodeForAccessToken,
  searchInstagramBusinessProfile
} from './meta.js';
import {
  generateInstagramComment,
  generateWhatsAppComment
} from './ai.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    app: 'FifTen backend',
    status: 'ok',
    redirectUri: getRedirectUri()
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/instagram/search', async (req, res) => {
  const query = req.query.query?.toString().trim().replace('@', '');

  if (!query) {
    return res.status(400).json({
      error: 'query parametresi gerekli'
    });
  }

  try {
    const profile = await searchInstagramBusinessProfile(query);

    if (!profile) {
      return res.json({ results: [] });
    }

    return res.json({
      results: [
        {
          username: profile.username || query,
          full_name: profile.name || '',
          is_private: profile.is_private === true,
          profile_pic_url: profile.profile_picture_url || '',
          biography: profile.biography || '',
          website: profile.website || '',
          followers_count: profile.followers_count || 0,
          follows_count: profile.follows_count || 0,
          media_count: profile.media_count || 0,
          post_thumbnails: profile.post_thumbnails || []
        }
      ]
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Bilinmeyen hata'
    });
  }
});

app.post('/ai/instagram-comment', async (req, res) => {
  try {
    const comment = await generateInstagramComment(req.body);
    return res.json({ comment });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'AI hatası'
    });
  }
});

app.post('/ai/whatsapp-comment', async (req, res) => {
  try {
    const comment = await generateWhatsAppComment(req.body);
    return res.json({ comment });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'AI hatası'
    });
  }
});

app.get('/auth/instagram/start', (_req, res) => {
  const { url, state } = buildInstagramLoginUrl();
  res.json({
    loginUrl: url,
    state
  });
});

app.get('/auth/instagram/callback', async (req, res) => {
  const code = req.query.code?.toString();
  const errorReason = req.query.error_reason?.toString();
  const errorDescription = req.query.error_description?.toString();

  if (errorReason || errorDescription) {
    return res.status(400).send(`
      <html>
        <body style="font-family: Arial; background:#0e0a17; color:#fff; padding:40px;">
          <h1>Giriş tamamlanamadı</h1>
          <p>${errorDescription || errorReason}</p>
        </body>
      </html>
    `);
  }

  if (!code) {
    return res.status(400).send(`
      <html>
        <body style="font-family: Arial; background:#0e0a17; color:#fff; padding:40px;">
          <h1>Kod alınamadı</h1>
          <p>Meta callback isteğinde code parametresi yok.</p>
        </body>
      </html>
    `);
  }

  try {
    const tokenData = await exchangeCodeForAccessToken(code);
    const destination = new URL(config.frontendSuccessUrl);
    destination.searchParams.set('access_token', tokenData.access_token || '');
    if (tokenData.token_type) {
      destination.searchParams.set('token_type', tokenData.token_type);
    }
    if (tokenData.expires_in) {
      destination.searchParams.set(
        'expires_in',
        String(tokenData.expires_in)
      );
    }

    return res.redirect(destination.toString());
  } catch (error) {
    return res.status(500).send(`
      <html>
        <body style="font-family: Arial; background:#0e0a17; color:#fff; padding:40px;">
          <h1>Token alınamadı</h1>
          <p>${error instanceof Error ? error.message : 'Bilinmeyen hata'}</p>
        </body>
      </html>
    `);
  }
});

app.listen(config.port, () => {
  console.log(`FifTen backend listening on http://localhost:${config.port}`);
});
