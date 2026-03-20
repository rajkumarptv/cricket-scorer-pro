import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { google } from 'googleapis';
import cookieParser from 'cookie-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database('cricket.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER,
    name TEXT NOT NULL,
    FOREIGN KEY(team_id) REFERENCES teams(id)
  );
  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team1_id INTEGER,
    team2_id INTEGER,
    toss_winner_id INTEGER,
    toss_decision TEXT,
    overs_per_innings INTEGER DEFAULT 20,
    youtube_url TEXT,
    youtube_broadcast_id TEXT,
    facebook_live_id TEXT,
    status TEXT DEFAULT 'scheduled',
    winner_id INTEGER,
    result_note TEXT,
    FOREIGN KEY(team1_id) REFERENCES teams(id),
    FOREIGN KEY(team2_id) REFERENCES teams(id)
  );
  CREATE TABLE IF NOT EXISTS innings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER,
    batting_team_id INTEGER,
    innings_number INTEGER,
    total_runs INTEGER DEFAULT 0,
    total_wickets INTEGER DEFAULT 0,
    total_balls INTEGER DEFAULT 0,
    is_completed INTEGER DEFAULT 0,
    FOREIGN KEY(match_id) REFERENCES matches(id)
  );
  CREATE TABLE IF NOT EXISTS balls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    innings_id INTEGER,
    over_number INTEGER,
    ball_number INTEGER,
    batsman_id INTEGER,
    non_striker_id INTEGER,
    bowler_id INTEGER,
    runs_batter INTEGER DEFAULT 0,
    extras_runs INTEGER DEFAULT 0,
    extras_type TEXT,
    is_wicket INTEGER DEFAULT 0,
    wicket_type TEXT,
    wicket_player_id INTEGER,
    is_free_hit INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(innings_id) REFERENCES innings(id)
  );
`);

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.APP_URL}/auth/google/callback`
);

const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl'
];

async function updateYouTubeTitle(tokens: any, broadcastId: string, scoreText: string) {
  try {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.APP_URL}/auth/google/callback`
    );
    client.setCredentials(tokens);
    const youtube = google.youtube({ version: 'v3', auth: client });
    await youtube.liveBroadcasts.update({
      part: ['snippet'],
      requestBody: {
        id: broadcastId,
        snippet: { title: scoreText, scheduledStartTime: new Date().toISOString() }
      }
    });
  } catch (err: any) {
    console.error('YouTube update error:', err.message);
  }
}

async function postFacebookComment(liveVideoId: string, message: string) {
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!token || !liveVideoId) return;
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${liveVideoId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, access_token: token })
    });
    const data = await res.json() as any;
    if (data.error) console.error('FB error:', data.error.message);
  } catch (err: any) {
    console.error('Facebook post error:', err.message);
  }
}

function buildScoreText(match: any) {
  const overs = `${Math.floor(match.total_balls / 6)}.${match.total_balls % 6}`;
  return `${match.team1_name} vs ${match.team2_name} | ${match.total_runs}/${match.total_wickets} (${overs} ov)`;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/auth/google/url', (req, res) => {
    const url = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: YOUTUBE_SCOPES, prompt: 'consent' });
    res.json({ url });
  });

  app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    try {
      const { tokens } = await oauth2Client.getToken(code as string);
      res.cookie('google_tokens', JSON.stringify(tokens), {
        httpOnly: true, secure: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000
      });
      res.send(`<html><body><script>
        if (window.opener) { window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*'); window.close(); }
        else { window.location.href = '/'; }
      </script><p style="font-family:sans-serif;text-align:center;margin-top:40px;color:#16a34a">YouTube connected! Close this window.</p></body></html>`);
    } catch (err) {
      res.status(500).send('Authentication failed');
    }
  });

  app.get('/api/youtube/broadcasts', async (req, res) => {
    const tokensStr = req.cookies.google_tokens;
    if (!tokensStr) return res.status(401).json({ error: 'Not connected' });
    try {
      oauth2Client.setCredentials(JSON.parse(tokensStr));
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      const response = await youtube.liveBroadcasts.list({ part: ['snippet', 'status'], broadcastStatus: 'active', maxResults: 10 });
      res.json(response.data.items || []);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch broadcasts' });
    }
  });

  app.post('/api/facebook/update', async (req, res) => {
    await postFacebookComment(req.body.live_id, req.body.text);
    res.json({ success: true });
  });

  app.get('/api/teams', (req, res) => res.json(db.prepare('SELECT * FROM teams ORDER BY id DESC').all()));

  app.post('/api/teams', (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    const result = db.prepare('INSERT INTO teams (name) VALUES (?)').run(name.trim());
    res.json({ id: result.lastInsertRowid, name });
  });

  app.get('/api/teams/:id/players', (req, res) => {
    res.json(db.prepare('SELECT * FROM players WHERE team_id = ? ORDER BY name').all(req.params.id));
  });

  app.post('/api/players', (req, res) => {
    const { team_id, name } = req.body;
    const result = db.prepare('INSERT INTO players (team_id, name) VALUES (?, ?)').run(team_id, name);
    res.json({ id: result.lastInsertRowid, team_id, name });
  });

  app.post('/api/matches', (req, res) => {
    const { team1_id, team2_id, overs_per_innings, youtube_url, facebook_live_id } = req.body;
    const result = db.prepare(
      'INSERT INTO matches (team1_id, team2_id, overs_per_innings, youtube_url, facebook_live_id) VALUES (?, ?, ?, ?, ?)'
    ).run(team1_id, team2_id, overs_per_innings, youtube_url, facebook_live_id || null);
    res.json({ id: result.lastInsertRowid });
  });

  app.get('/api/matches/:id', (req, res) => {
    const match: any = db.prepare(`
      SELECT m.*, t1.name as team1_name, t2.name as team2_name
      FROM matches m JOIN teams t1 ON m.team1_id = t1.id JOIN teams t2 ON m.team2_id = t2.id
      WHERE m.id = ?
    `).get(req.params.id);
    if (!match) return res.status(404).json({ error: 'Not found' });
    const innings = db.prepare('SELECT * FROM innings WHERE match_id = ? ORDER BY innings_number').all(req.params.id);
    res.json({ ...match, innings });
  });

  app.post('/api/matches/:id/toss', (req, res) => {
    const { toss_winner_id, toss_decision } = req.body;
    db.prepare("UPDATE matches SET toss_winner_id = ?, toss_decision = ?, status = 'live' WHERE id = ?")
      .run(toss_winner_id, toss_decision, req.params.id);
    const match: any = db.prepare('SELECT * FROM matches WHERE id = ?').get(req.params.id);
    const batting_team_id = toss_decision === 'bat' ? toss_winner_id
      : (match.team1_id === toss_winner_id ? match.team2_id : match.team1_id);
    db.prepare('INSERT INTO innings (match_id, batting_team_id, innings_number) VALUES (?, ?, 1)').run(req.params.id, batting_team_id);
    res.json({ success: true });
  });

  app.post('/api/matches/:id/youtube', (req, res) => {
    db.prepare('UPDATE matches SET youtube_broadcast_id = ? WHERE id = ?').run(req.body.broadcast_id, req.params.id);
    res.json({ success: true });
  });

  app.post('/api/matches/:id/complete', (req, res) => {
    const { winner_id, result_note } = req.body;
    db.prepare("UPDATE matches SET winner_id = ?, result_note = ?, status = 'completed' WHERE id = ?").run(winner_id, result_note, req.params.id);
    res.json({ success: true });
  });

  app.post('/api/innings', (req, res) => {
    const { match_id, batting_team_id, innings_number } = req.body;
    const result = db.prepare('INSERT INTO innings (match_id, batting_team_id, innings_number) VALUES (?, ?, ?)').run(match_id, batting_team_id, innings_number);
    res.json({ id: result.lastInsertRowid });
  });

  app.get('/api/innings/:id/balls', (req, res) => {
    res.json(db.prepare('SELECT * FROM balls WHERE innings_id = ? ORDER BY id DESC').all(req.params.id));
  });

  app.post('/api/balls', async (req, res) => {
    try {
      const { innings_id, over_number, ball_number, batsman_id, non_striker_id, bowler_id, runs_batter, extras_runs, extras_type, is_wicket, is_free_hit } = req.body;
      const result = db.prepare(`
        INSERT INTO balls (innings_id, over_number, ball_number, batsman_id, non_striker_id, bowler_id, runs_batter, extras_runs, extras_type, is_wicket, is_free_hit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(innings_id, over_number, ball_number, batsman_id, non_striker_id, bowler_id, runs_batter, extras_runs, extras_type, is_wicket, is_free_hit);

      const total_runs = (runs_batter || 0) + (extras_runs || 0);
      const is_valid = !['wide', 'no_ball'].includes(extras_type);
      db.prepare('UPDATE innings SET total_runs = total_runs + ?, total_wickets = total_wickets + ?, total_balls = total_balls + ? WHERE id = ?')
        .run(total_runs, is_wicket ? 1 : 0, is_valid ? 1 : 0, innings_id);

      const innings: any = db.prepare('SELECT match_id FROM innings WHERE id = ?').get(innings_id);
      if (innings) {
        const match: any = db.prepare(`
          SELECT m.*, t1.name as team1_name, t2.name as team2_name, i.total_runs, i.total_wickets, i.total_balls
          FROM matches m JOIN teams t1 ON m.team1_id = t1.id JOIN teams t2 ON m.team2_id = t2.id JOIN innings i ON i.id = ?
          WHERE m.id = ?
        `).get(innings_id, innings.match_id);
        if (match) {
          const scoreText = buildScoreText(match);
          if (match.youtube_broadcast_id && req.cookies.google_tokens) {
            updateYouTubeTitle(JSON.parse(req.cookies.google_tokens), match.youtube_broadcast_id, scoreText).catch(console.error);
          }
          if (match.facebook_live_id && (is_wicket || (is_valid && ball_number === 6))) {
            const fbMsg = is_wicket ? `WICKET! ${scoreText}` : `Over ${over_number + 1}: ${scoreText}`;
            postFacebookComment(match.facebook_live_id, fbMsg).catch(console.error);
          }
        }
      }
      res.json({ id: result.lastInsertRowid });
    } catch (err) {
      console.error('Record ball error:', err);
      res.status(500).json({ error: 'Failed to record ball' });
    }
  });

  app.delete('/api/balls/:id', (req, res) => {
    const ball: any = db.prepare('SELECT * FROM balls WHERE id = ?').get(req.params.id);
    if (!ball) return res.status(404).json({ error: 'Not found' });
    const total_runs = (ball.runs_batter || 0) + (ball.extras_runs || 0);
    const is_valid = !['wide', 'no_ball'].includes(ball.extras_type);
    db.prepare('UPDATE innings SET total_runs = total_runs - ?, total_wickets = total_wickets - ?, total_balls = total_balls - ? WHERE id = ?')
      .run(total_runs, ball.is_wicket ? 1 : 0, is_valid ? 1 : 0, ball.innings_id);
    db.prepare('DELETE FROM balls WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.get('/api/matches/:id/scorecard', (req, res) => {
    const innings: any[] = db.prepare('SELECT * FROM innings WHERE match_id = ? ORDER BY innings_number').all(req.params.id);
    const scorecard = innings.map(inn => {
      const battingStats = db.prepare(`
        SELECT p.name, SUM(b.runs_batter) as runs,
          COUNT(CASE WHEN b.extras_type IS NULL OR b.extras_type NOT IN ('wide','no_ball') THEN 1 END) as balls,
          COUNT(CASE WHEN b.runs_batter = 4 THEN 1 END) as fours,
          COUNT(CASE WHEN b.runs_batter = 6 THEN 1 END) as sixes,
          MAX(CASE WHEN b.is_wicket = 1 THEN 1 ELSE 0 END) as is_out
        FROM balls b JOIN players p ON b.batsman_id = p.id WHERE b.innings_id = ? GROUP BY b.batsman_id
      `).all(inn.id);
      const bowlingStats = db.prepare(`
        SELECT p.name,
          COUNT(CASE WHEN b.extras_type IS NULL OR b.extras_type NOT IN ('wide','no_ball') THEN 1 END) as balls,
          SUM(b.runs_batter + b.extras_runs) as runs, SUM(b.is_wicket) as wickets
        FROM balls b JOIN players p ON b.bowler_id = p.id WHERE b.innings_id = ? GROUP BY b.bowler_id
      `).all(inn.id);
      const extras: any = db.prepare(`
        SELECT SUM(extras_runs) as total,
          SUM(CASE WHEN extras_type='wide' THEN extras_runs ELSE 0 END) as wides,
          SUM(CASE WHEN extras_type='no_ball' THEN extras_runs ELSE 0 END) as no_balls,
          SUM(CASE WHEN extras_type='bye' THEN extras_runs ELSE 0 END) as byes,
          SUM(CASE WHEN extras_type='leg_bye' THEN extras_runs ELSE 0 END) as leg_byes
        FROM balls WHERE innings_id = ?
      `).get(inn.id);
      return { innings_number: inn.innings_number, batting_team_id: inn.batting_team_id, total_runs: inn.total_runs, total_wickets: inn.total_wickets, total_balls: inn.total_balls, battingStats, bowlingStats, extras: extras || { total: 0, wides: 0, no_balls: 0, byes: 0, leg_byes: 0 } };
    });
    res.json(scorecard);
  });

  // Always serve built React app
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cricket Scorer Pro running on port ${PORT}`);
  });
}

startServer().catch(console.error);
