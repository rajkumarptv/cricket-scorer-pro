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
  CREATE TABLE IF NOT EXISTS facebook_streams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    page_name TEXT NOT NULL,
    access_token TEXT NOT NULL,
    live_video_id TEXT NOT NULL,
    FOREIGN KEY(match_id) REFERENCES matches(id)
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
    wicket_taker_id INTEGER,
    player_out_id INTEGER,
    is_free_hit INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(innings_id) REFERENCES innings(id)
  );
`);

// Add columns if missing (for existing DBs)
try { db.exec('ALTER TABLE balls ADD COLUMN wicket_taker_id INTEGER'); } catch {}
try { db.exec('ALTER TABLE balls ADD COLUMN player_out_id INTEGER'); } catch {}
try { db.exec('ALTER TABLE balls ADD COLUMN wicket_type TEXT'); } catch {}

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
      process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.APP_URL}/auth/google/callback`
    );
    client.setCredentials(tokens);
    const youtube = google.youtube({ version: 'v3', auth: client });
    await youtube.liveBroadcasts.update({
      part: ['snippet'],
      requestBody: { id: broadcastId, snippet: { title: scoreText, scheduledStartTime: new Date().toISOString() } }
    });
    console.log('YouTube title updated:', scoreText);
  } catch (err: any) { console.error('YouTube update error:', err.message); }
}

async function postFacebookComment(liveVideoId: string, message: string, token?: string) {
  const accessToken = token || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!accessToken || !liveVideoId) return;
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/${liveVideoId}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, access_token: accessToken })
    });
    const data = await res.json() as any;
    if (data.error) console.error('FB error:', data.error.message);
  } catch (err: any) { console.error('Facebook post error:', err.message); }
}

async function postToAllFacebookStreams(matchId: number, message: string) {
  const streams: any[] = db.prepare('SELECT * FROM facebook_streams WHERE match_id = ?').all(matchId);
  await Promise.allSettled(streams.map(s => postFacebookComment(s.live_video_id, message, s.access_token)));
  // Also post to legacy single facebook_live_id if set
  const match: any = db.prepare('SELECT facebook_live_id FROM matches WHERE id = ?').get(matchId);
  if (match?.facebook_live_id) {
    await postFacebookComment(match.facebook_live_id, message);
  }
}

function buildScoreText(match: any) {
  const overs = `${Math.floor(match.total_balls / 6)}.${match.total_balls % 6}`;
  return `${match.team1_name} vs ${match.team2_name} | ${match.total_runs}/${match.total_wickets} (${overs} ov)`;
}

// Helper
function groupBy(arr: any[], key: string) {
  return arr.reduce((g, item) => { (g[item[key]] = g[item[key]] || []).push(item); return g; }, {});
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  app.use(express.json());
  app.use(cookieParser());

  // ── YouTube OAuth ─────────────────────────────────────────────────────────────
  app.get('/api/auth/google/url', (req, res) => {
    const url = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: YOUTUBE_SCOPES, prompt: 'consent' });
    res.json({ url });
  });

  app.post('/api/auth/google/disconnect', (req, res) => {
    res.clearCookie('google_tokens');
    res.json({ success: true });
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
      console.error('OAuth error:', err);
      res.status(500).send('Authentication failed');
    }
  });

  app.get('/api/youtube/broadcasts', async (req, res) => {
    const tokensStr = req.cookies.google_tokens;
    if (!tokensStr) return res.status(401).json({ error: 'Not connected' });
    try {
      oauth2Client.setCredentials(JSON.parse(tokensStr));
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      const response = await youtube.liveBroadcasts.list({
        part: ['snippet', 'status'], broadcastStatus: 'active', maxResults: 10
      });
      res.json(response.data.items || []);
    } catch (err) { res.status(500).json({ error: 'Failed to fetch broadcasts' }); }
  });

  // ── Facebook ──────────────────────────────────────────────────────────────────
  app.post('/api/facebook/update', async (req, res) => {
    await postFacebookComment(req.body.live_id, req.body.text);
    res.json({ success: true });
  });

  app.get('/api/matches/:id/facebook-streams', (req, res) => {
    const streams = db.prepare('SELECT id, match_id, page_name, live_video_id FROM facebook_streams WHERE match_id = ?').all(req.params.id);
    res.json(streams);
  });

  app.post('/api/matches/:id/facebook-streams', (req, res) => {
    const { page_name, access_token, live_video_id } = req.body;
    if (!page_name?.trim() || !access_token?.trim() || !live_video_id?.trim())
      return res.status(400).json({ error: 'page_name, access_token and live_video_id are required' });
    const existing = db.prepare('SELECT COUNT(*) as cnt FROM facebook_streams WHERE match_id = ?').get(req.params.id) as any;
    if (existing.cnt >= 3) return res.status(400).json({ error: 'Maximum 3 Facebook streams per match' });
    const result = db.prepare(
      'INSERT INTO facebook_streams (match_id, page_name, access_token, live_video_id) VALUES (?, ?, ?, ?)'
    ).run(req.params.id, page_name.trim(), access_token.trim(), live_video_id.trim());
    res.json({ id: result.lastInsertRowid, match_id: Number(req.params.id), page_name, live_video_id });
  });

  app.delete('/api/facebook-streams/:id', (req, res) => {
    db.prepare('DELETE FROM facebook_streams WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // ── Teams ─────────────────────────────────────────────────────────────────────
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

  // ── Players ───────────────────────────────────────────────────────────────────
  app.post('/api/players', (req, res) => {
    const { team_id, name } = req.body;
    const result = db.prepare('INSERT INTO players (team_id, name) VALUES (?, ?)').run(team_id, name);
    res.json({ id: result.lastInsertRowid, team_id, name });
  });

  // ── Matches ───────────────────────────────────────────────────────────────────
  app.post('/api/matches', (req, res) => {
    const { team1_id, team2_id, overs_per_innings, youtube_url, facebook_live_id } = req.body;
    const result = db.prepare(
      'INSERT INTO matches (team1_id, team2_id, overs_per_innings, youtube_url, facebook_live_id) VALUES (?, ?, ?, ?, ?)'
    ).run(team1_id, team2_id, overs_per_innings, youtube_url || null, facebook_live_id || null);
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

  // ── Innings ───────────────────────────────────────────────────────────────────
  app.post('/api/innings', (req, res) => {
    const { match_id, batting_team_id, innings_number } = req.body;
    const result = db.prepare('INSERT INTO innings (match_id, batting_team_id, innings_number) VALUES (?, ?, ?)').run(match_id, batting_team_id, innings_number);
    res.json({ id: result.lastInsertRowid });
  });

  app.get('/api/innings/:id/balls', (req, res) => {
    res.json(db.prepare('SELECT * FROM balls WHERE innings_id = ? ORDER BY id DESC').all(req.params.id));
  });

  // ── Balls ─────────────────────────────────────────────────────────────────────
  app.post('/api/balls', async (req, res) => {
    try {
      const { innings_id, over_number, ball_number, batsman_id, non_striker_id, bowler_id,
        runs_batter, extras_runs, extras_type, is_wicket, is_free_hit,
        wicket_type, wicket_taker_id, player_out_id } = req.body;

      const result = db.prepare(`
        INSERT INTO balls (innings_id, over_number, ball_number, batsman_id, non_striker_id, bowler_id,
          runs_batter, extras_runs, extras_type, is_wicket, is_free_hit, wicket_type, wicket_taker_id, player_out_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(innings_id, over_number, ball_number, batsman_id, non_striker_id, bowler_id,
        runs_batter, extras_runs, extras_type, is_wicket, is_free_hit,
        wicket_type || null, wicket_taker_id || null, player_out_id || null);

      const total_runs = (runs_batter || 0) + (extras_runs || 0);
      // penalty runs count in total but NOT as valid ball
      const is_valid = !['wide', 'no_ball', 'penalty'].includes(extras_type);
      const is_valid_for_balls = !['wide', 'no_ball'].includes(extras_type);

      db.prepare(`UPDATE innings SET total_runs = total_runs + ?, total_wickets = total_wickets + ?, total_balls = total_balls + ? WHERE id = ?`)
        .run(total_runs, is_wicket ? 1 : 0, is_valid_for_balls ? 1 : 0, innings_id);

      // Async live updates
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
          let fbMsg = '';
          if (is_wicket) fbMsg = `WICKET! (${wicket_type?.replace('_', ' ') || 'out'}) ${scoreText}`;
          else if (is_valid_for_balls && ball_number === 6) fbMsg = `Over ${over_number + 1} complete: ${scoreText}`;
          if (fbMsg) postToAllFacebookStreams(innings.match_id, fbMsg).catch(console.error);
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

  // ── Scorecard ─────────────────────────────────────────────────────────────────
  app.get('/api/matches/:id/scorecard', (req, res) => {
    const innings: any[] = db.prepare('SELECT * FROM innings WHERE match_id = ? ORDER BY innings_number').all(req.params.id);
    const scorecard = innings.map(inn => {
      const battingStats = db.prepare(`
        SELECT p.name, SUM(b.runs_batter) as runs,
          COUNT(CASE WHEN b.extras_type IS NULL OR b.extras_type NOT IN ('wide','no_ball') THEN 1 END) as balls,
          COUNT(CASE WHEN b.runs_batter = 4 THEN 1 END) as fours,
          COUNT(CASE WHEN b.runs_batter = 6 THEN 1 END) as sixes,
          MAX(CASE WHEN b.is_wicket = 1 THEN 1 ELSE 0 END) as is_out,
          MAX(b.wicket_type) as wicket_type
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
          SUM(CASE WHEN extras_type='leg_bye' THEN extras_runs ELSE 0 END) as leg_byes,
          SUM(CASE WHEN extras_type='penalty' THEN extras_runs ELSE 0 END) as penalty
        FROM balls WHERE innings_id = ?
      `).get(inn.id);
      return { innings_number: inn.innings_number, batting_team_id: inn.batting_team_id,
        total_runs: inn.total_runs, total_wickets: inn.total_wickets, total_balls: inn.total_balls,
        battingStats, bowlingStats, extras: extras || { total: 0, wides: 0, no_balls: 0, byes: 0, leg_byes: 0, penalty: 0 } };
    });
    res.json(scorecard);
  });

  // ── Partnership stats ─────────────────────────────────────────────────────────
  app.get('/api/innings/:id/partnership', (req, res) => {
    const balls: any[] = db.prepare('SELECT * FROM balls WHERE innings_id = ? ORDER BY id ASC').all(req.params.id);
    const partnerships: any[] = [];
    let currentPartnership = { batsman1: 0, batsman2: 0, runs: 0, balls: 0, b1Runs: 0, b2Runs: 0 };

    balls.forEach(b => {
      if (b.is_wicket) {
        partnerships.push({ ...currentPartnership });
        currentPartnership = { batsman1: b.non_striker_id, batsman2: 0, runs: 0, balls: 0, b1Runs: 0, b2Runs: 0 };
      } else {
        if (!currentPartnership.batsman1) currentPartnership.batsman1 = b.batsman_id;
        if (!currentPartnership.batsman2) currentPartnership.batsman2 = b.non_striker_id;
        const total = (b.runs_batter || 0) + (b.extras_runs || 0);
        currentPartnership.runs += total;
        if (!['wide', 'no_ball'].includes(b.extras_type || '')) currentPartnership.balls++;
        if (b.batsman_id === currentPartnership.batsman1) currentPartnership.b1Runs += b.runs_batter;
        else currentPartnership.b2Runs += b.runs_batter;
      }
    });
    if (currentPartnership.batsman1) partnerships.push(currentPartnership);
    res.json(partnerships);
  });

  // ── Player career stats ───────────────────────────────────────────────────────
  app.get('/api/players/:id/stats', (req, res) => {
    const playerId = req.params.id;
    const battingBalls: any[] = db.prepare('SELECT * FROM balls WHERE batsman_id = ?').all(playerId);
    const bowlingBalls: any[] = db.prepare('SELECT * FROM balls WHERE bowler_id = ?').all(playerId);

    // Batting
    const runs = battingBalls.reduce((s, b) => s + (b.runs_batter || 0), 0);
    const ballsFaced = battingBalls.filter(b => !['wide'].includes(b.extras_type || '')).length;
    const fours = battingBalls.filter(b => b.runs_batter === 4).length;
    const sixes = battingBalls.filter(b => b.runs_batter === 6).length;
    const dismissals = battingBalls.filter(b => b.is_wicket).length;

    // Group by innings for 50s/100s
    const inningsGroups: { [k: string]: any[] } = {};
    battingBalls.forEach(b => { if (!inningsGroups[b.innings_id]) inningsGroups[b.innings_id] = []; inningsGroups[b.innings_id].push(b); });
    let fifties = 0, hundreds = 0, ducks = 0;
    Object.values(inningsGroups).forEach(innBalls => {
      const innRuns = innBalls.reduce((s, b) => s + b.runs_batter, 0);
      if (innRuns >= 100) hundreds++;
      else if (innRuns >= 50) fifties++;
      if (innRuns === 0 && innBalls.some(b => b.is_wicket)) ducks++;
    });

    // Bowling
    const wickets = bowlingBalls.filter(b => b.is_wicket && !['retired', 'retired_hurt', 'timed_out'].includes(b.wicket_type || '')).length;
    const validBowlingBalls = bowlingBalls.filter(b => !['wide', 'no_ball'].includes(b.extras_type || '')).length;
    const runsConceded = bowlingBalls.reduce((s, b) => s + b.runs_batter + (b.extras_runs || 0), 0);
    const wides = bowlingBalls.filter(b => b.extras_type === 'wide').length;
    const noBalls = bowlingBalls.filter(b => b.extras_type === 'no_ball').length;

    res.json({
      batting: { innings: Object.keys(inningsGroups).length, runs, ballsFaced, fours, sixes, dismissals, average: dismissals ? (runs / dismissals).toFixed(1) : runs, strikeRate: ballsFaced ? ((runs / ballsFaced) * 100).toFixed(1) : '0.0', fifties, hundreds, ducks },
      bowling: { innings: Object.keys(groupBy(bowlingBalls, 'innings_id')).length, wickets, balls: validBowlingBalls, runsConceded, average: wickets ? (runsConceded / wickets).toFixed(1) : '-', economy: validBowlingBalls ? ((runsConceded / validBowlingBalls) * 6).toFixed(1) : '0.0', wides, noBalls }
    });
  });

  app.get('/api/teams/:id/stats', (req, res) => {
    const players: any[] = db.prepare('SELECT * FROM players WHERE team_id = ?').all(req.params.id);
    res.json(players);
  });

  // ── Sample Data Seed ──────────────────────────────────────────────────────────
  app.post('/api/seed', (req, res) => {
    try {
      const t1p = ['Rohit Sharma','Virat Kohli','Shubman Gill','KL Rahul','Hardik Pandya','Ravindra Jadeja','MS Dhoni','Jasprit Bumrah','Mohammed Shami','Kuldeep Yadav','Arshdeep Singh'];
      const t2p = ['David Warner','Steve Smith','Marnus Labuschagne','Travis Head','Mitchell Marsh','Glenn Maxwell','Pat Cummins','Mitchell Starc','Josh Hazlewood','Adam Zampa','Cameron Green'];
      let t1: any = db.prepare("SELECT id FROM teams WHERE name='India XI'").get();
      let t2: any = db.prepare("SELECT id FROM teams WHERE name='Australia XI'").get();
      if (!t1) { const r = db.prepare('INSERT INTO teams (name) VALUES (?)').run('India XI'); t1 = { id: r.lastInsertRowid }; }
      if (!t2) { const r = db.prepare('INSERT INTO teams (name) VALUES (?)').run('Australia XI'); t2 = { id: r.lastInsertRowid }; }
      t1p.forEach(n => { if (!db.prepare('SELECT id FROM players WHERE team_id=? AND name=?').get(t1.id, n)) db.prepare('INSERT INTO players (team_id, name) VALUES (?, ?)').run(t1.id, n); });
      t2p.forEach(n => { if (!db.prepare('SELECT id FROM players WHERE team_id=? AND name=?').get(t2.id, n)) db.prepare('INSERT INTO players (team_id, name) VALUES (?, ?)').run(t2.id, n); });
      res.json({ success: true, message: 'India XI & Australia XI added with 11 players each!' });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));

  app.listen(PORT, '0.0.0.0', () => console.log(`Cricket Scorer Pro running on port ${PORT}`));
}

startServer().catch(console.error);
