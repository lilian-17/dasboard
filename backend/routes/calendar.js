const express = require('express');
const { google } = require('googleapis');
const db = require('../db');
const router = express.Router();

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/calendar/oauth2callback'
  );
}

function getStoredTokens() {
  return db.prepare('SELECT * FROM google_tokens WHERE id = 1').get();
}

function saveTokens(tokens) {
  db.prepare(`
    INSERT INTO google_tokens (id, access_token, refresh_token, expiry_date)
    VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = COALESCE(excluded.refresh_token, refresh_token),
      expiry_date = excluded.expiry_date
  `).run(tokens.access_token, tokens.refresh_token || null, tokens.expiry_date || null);
}

router.get('/auth', (req, res) => {
  const oauth2Client = getOAuth2Client();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.readonly'],
    prompt: 'consent',
  });
  res.json({ url });
});

router.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  const oauth2Client = getOAuth2Client();
  try {
    const { tokens } = await oauth2Client.getToken(code);
    saveTokens(tokens);
    res.send('<script>window.close();</script><p>Authorized! You can close this tab.</p>');
  } catch (err) {
    res.status(500).send('OAuth error: ' + err.message);
  }
});

router.get('/status', (req, res) => {
  const tokens = getStoredTokens();
  res.json({ connected: !!(tokens && tokens.access_token) });
});

router.delete('/disconnect', (req, res) => {
  db.prepare('DELETE FROM google_tokens WHERE id = 1').run();
  res.json({ ok: true });
});

router.get('/events', async (req, res) => {
  const tokens = getStoredTokens();
  if (!tokens || !tokens.access_token) {
    return res.status(401).json({ error: 'not_connected' });
  }
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });
  oauth2Client.on('tokens', (newTokens) => saveTokens(newTokens));

  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    const now = new Date();
    const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: twoWeeksOut.toISOString(),
      maxResults: 20,
      singleEvents: true,
      orderBy: 'startTime',
    });
    res.json(response.data.items || []);
  } catch (err) {
    if (err.code === 401) {
      db.prepare('DELETE FROM google_tokens WHERE id = 1').run();
      return res.status(401).json({ error: 'token_expired' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
