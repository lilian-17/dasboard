const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const router = express.Router();

let pendingState = null;

function getStoredTokens() {
  return db.prepare('SELECT * FROM spotify_tokens WHERE id = 1').get();
}

function saveTokens({ access_token, refresh_token, expires_in }) {
  const expiry_date = Date.now() + expires_in * 1000;
  db.prepare(`
    INSERT INTO spotify_tokens (id, access_token, refresh_token, expiry_date)
    VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = COALESCE(excluded.refresh_token, refresh_token),
      expiry_date = excluded.expiry_date
  `).run(access_token, refresh_token || null, expiry_date);
}

async function refreshAccessToken(refresh_token) {
  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token }),
  });
  if (!res.ok) throw new Error('Failed to refresh Spotify token');
  return res.json();
}

async function getValidToken() {
  const tokens = getStoredTokens();
  if (!tokens || !tokens.access_token) return null;
  if (tokens.expiry_date && Date.now() > tokens.expiry_date - 60000) {
    if (!tokens.refresh_token) return null;
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    saveTokens(refreshed);
    return refreshed.access_token;
  }
  return tokens.access_token;
}

router.get('/auth', (req, res) => {
  pendingState = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3001/api/spotify/callback',
    scope: 'user-read-currently-playing',
    state: pendingState,
  });
  res.json({ url: `https://accounts.spotify.com/authorize?${params}` });
});

router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    pendingState = null;
    return res.status(400).json({ error: `Spotify auth denied: ${error}` });
  }
  if (!pendingState || !state || state !== pendingState) {
    pendingState = null;
    return res.status(403).send('Invalid state parameter.');
  }
  pendingState = null;
  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');
  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:3001/api/spotify/callback',
      }),
    });
    if (!tokenRes.ok) throw new Error('Token exchange failed');
    const tokenData = await tokenRes.json();
    saveTokens(tokenData);
    res.send('<script>window.close();</script><p>Spotify connecté ! Vous pouvez fermer cet onglet.</p>');
  } catch {
    res.status(500).send('Erreur OAuth Spotify.');
  }
});

router.get('/status', (req, res) => {
  const tokens = getStoredTokens();
  res.json({ connected: !!(tokens && tokens.access_token) });
});

router.delete('/disconnect', (req, res) => {
  db.prepare('DELETE FROM spotify_tokens WHERE id = 1').run();
  res.json({ ok: true });
});

router.get('/current', async (req, res) => {
  try {
    const token = await getValidToken();
    if (!token) return res.json(null);
    const spotRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (spotRes.status === 204 || spotRes.status === 404) return res.json(null);
    if (spotRes.status === 401) {
      db.prepare('DELETE FROM spotify_tokens WHERE id = 1').run();
      return res.status(401).json({ error: 'token_expired' });
    }
    if (!spotRes.ok) return res.status(spotRes.status).json({ error: 'Spotify API error' });
    const data = await spotRes.json();
    if (!data || !data.item || data.item.type !== 'track') return res.json(null);
    res.json({
      track: data.item.name,
      artist: data.item.artists.map(a => a.name).join(', '),
      album: data.item.album.name,
      art: data.item.album.images[0]?.url || null,
      progress_ms: data.progress_ms,
      duration_ms: data.item.duration_ms,
      is_playing: data.is_playing,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
