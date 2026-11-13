require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dataStore = require('./supabaseClient');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  pingTimeout: 60000,
  pingInterval: 25000
});

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'robot2026';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// ── Session middleware ──────────────────────────────────────────────
const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
});

app.use(sessionMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Share session with Socket.IO
const wrap = mid => (socket, next) => mid(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// ── File uploads (logos and avatars) ─────────────────────────────────
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /jpeg|jpg|png|gif|svg|webp/.test(path.extname(file.originalname).toLowerCase());
    cb(null, ok);
  }
});

// ════════════════════════════════════════════════════════════════════
// ── GAME STATE (In-Memory Live Match State) ─────────────────────────
// ════════════════════════════════════════════════════════════════════

// ── Robot Soccer State ───────────────────────────────────────────────
const DEFAULT_STATE = {
  eventTitle: 'Robot Soccer Championship',
  teamA: { name: 'Team Alpha', score: 0, logo: null, id: null, penalties: 0 },
  teamB: { name: 'Team Beta', score: 0, logo: null, id: null, penalties: 0 },
  timer: {
    duration: 600,   // 10 minutes
    remaining: 600,
    running: false,
    lastUpdated: null
  },
  matchStatus: 'ready',  // ready | live | paused | ended
  currentMatchId: null,
  currentMatch: null
};

let gameState = deepClone(DEFAULT_STATE);
let history = [];
let timerTimeout = null;

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function pushHistory() {
  const snap = deepClone(gameState);
  if (snap.timer.running && snap.timer.lastUpdated) {
    const elapsed = (Date.now() - snap.timer.lastUpdated) / 1000;
    snap.timer.remaining = Math.max(0, snap.timer.remaining - elapsed);
    snap.timer.lastUpdated = Date.now();
  }
  history.push(snap);
  if (history.length > 50) history.shift();
}

function getCurrentRemaining() {
  if (!gameState.timer.running || !gameState.timer.lastUpdated) {
    return gameState.timer.remaining;
  }
  const elapsed = (Date.now() - gameState.timer.lastUpdated) / 1000;
  return Math.max(0, gameState.timer.remaining - elapsed);
}

function getClientState() {
  const s = deepClone(gameState);
  s.timer.remaining = getCurrentRemaining();
  s.timer.serverTime = Date.now();
  return s;
}

function broadcastState() {
  io.emit('state', getClientState());
}

function startTimerCountdown() {
  clearTimeout(timerTimeout);
  const remaining = getCurrentRemaining();
  if (remaining <= 0) {
    gameState.timer.remaining = 0;
    gameState.timer.running = false;
    gameState.timer.lastUpdated = null;
    gameState.matchStatus = 'ended';
    broadcastState();
    io.emit('timerEnd');
    return;
  }
  timerTimeout = setTimeout(() => {
    gameState.timer.remaining = 0;
    gameState.timer.running = false;
    gameState.timer.lastUpdated = null;
    gameState.matchStatus = 'ended';
    broadcastState();
    io.emit('timerEnd');
  }, remaining * 1000 + 100);
}

// ── Ensure active match helper (Soccer) ──────────────────────────────
async function ensureActiveMatch() {
  if (gameState.currentMatchId) {
    return { match_id: gameState.currentMatchId, id: gameState.currentMatchId };
  }
  const ongoing = await dataStore.getCurrentMatch();
  if (ongoing && ongoing.status === 'ongoing') {
    gameState.currentMatchId = ongoing.match_id || ongoing.id;
    gameState.currentMatch = ongoing;
    return ongoing;
  }
  const created = await dataStore.createMatch({
    team1_id: gameState.teamA.id || null,
    team2_id: gameState.teamB.id || null,
    team1_name: gameState.teamA.name || 'Team 1',
    team2_name: gameState.teamB.name || 'Team 2'
  });
  gameState.currentMatchId = created.match_id || created.id;
  gameState.currentMatch = created;
  return created;
}

// ── Auth middleware ──────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/login');
}

// ════════════════════════════════════════════════════════════════════
// ── BALLOON GAME IN-MEMORY STATE ────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
let balloonState = {
  eventTitle: 'Balloon Popping Championship',
  matchId: null,
  matchStatus: 'ready', // ready | live | paused | ended
  timer: {
    duration: 360, // 6 minutes default
    remaining: 360,
    running: false,
    lastUpdated: null
  },
  players: [], // [ { id, name, grade, group, city, avatar, score: 0 }, ... ]
  showSummary: false
};
let balloonTimerTimeout = null;

function getCurrentBalloonRemaining() {
  if (!balloonState.timer.running || !balloonState.timer.lastUpdated) {
    return balloonState.timer.remaining;
  }
  const elapsed = (Date.now() - balloonState.timer.lastUpdated) / 1000;
  return Math.max(0, balloonState.timer.remaining - elapsed);
}

function getBalloonClientState() {
  const s = JSON.parse(JSON.stringify(balloonState));
  s.timer.remaining = getCurrentBalloonRemaining();
  s.timer.serverTime = Date.now();
  return s;
}

function broadcastBalloonState() {
  io.emit('balloonState', getBalloonClientState());
}

function startBalloonTimerCountdown() {
  clearTimeout(balloonTimerTimeout);
  const remaining = getCurrentBalloonRemaining();
  if (remaining <= 0) {
    balloonState.timer.remaining = 0;
    balloonState.timer.running = false;
    balloonState.timer.lastUpdated = null;
    balloonState.matchStatus = 'ended';
    broadcastBalloonState();
    io.emit('balloon_timerEnd');
    return;
  }
  balloonTimerTimeout = setTimeout(() => {
    balloonState.timer.remaining = 0;
    balloonState.timer.running = false;
    balloonState.timer.lastUpdated = null;
    balloonState.matchStatus = 'ended';
    balloonState.showSummary = true;
    broadcastBalloonState();
    io.emit('balloon_timerEnd');
    io.emit('balloon_timeUp');
  }, remaining * 1000 + 100);
}

// ════════════════════════════════════════════════════════════════════
// ── BATTLE BOTS IN-MEMORY STATE ─────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
let battlebotsState = {
  eventTitle: 'Battle Bots (Sumo) Championship',
  matchId: null,
  matchStatus: 'ready', // ready | live | paused | ended
  timer: {
    duration: 600, // 10 minutes default
    remaining: 600,
    running: false,
    lastUpdated: null
  },
  players: [], // [ { id, name, grade, group, city, avatar, score: 0 }, ... ]
  showSummary: false
};
let battlebotsTimerTimeout = null;

function getCurrentBattleBotsRemaining() {
  if (!battlebotsState.timer.running || !battlebotsState.timer.lastUpdated) {
    return battlebotsState.timer.remaining;
  }
  const elapsed = (Date.now() - battlebotsState.timer.lastUpdated) / 1000;
  return Math.max(0, battlebotsState.timer.remaining - elapsed);
}

function getBattleBotsClientState() {
  const s = JSON.parse(JSON.stringify(battlebotsState));
  s.timer.remaining = getCurrentBattleBotsRemaining();
  s.timer.serverTime = Date.now();
  return s;
}

function broadcastBattleBotsState() {
  io.emit('battlebotsState', getBattleBotsClientState());
}

function startBattleBotsTimerCountdown() {
  clearTimeout(battlebotsTimerTimeout);
  const remaining = getCurrentBattleBotsRemaining();
  if (remaining <= 0) {
    battlebotsState.timer.remaining = 0;
    battlebotsState.timer.running = false;
    battlebotsState.timer.lastUpdated = null;
    battlebotsState.matchStatus = 'ended';
    battlebotsState.showSummary = true;
    broadcastBattleBotsState();
    io.emit('battlebots_timerEnd');
    io.emit('battlebots_timeUp');
    return;
  }
  battlebotsTimerTimeout = setTimeout(() => {
    battlebotsState.timer.remaining = 0;
    battlebotsState.timer.running = false;
    battlebotsState.timer.lastUpdated = null;
    battlebotsState.matchStatus = 'ended';
    battlebotsState.showSummary = true;
    broadcastBattleBotsState();
    io.emit('battlebots_timerEnd');
    io.emit('battlebots_timeUp');
  }, remaining * 1000 + 100);
}

// ════════════════════════════════════════════════════════════════════
// ── DRONE IN-MEMORY STATE ───────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════
let droneState = {
  eventTitle: 'Drone Racing Championship',
  matchId: null,
  matchStatus: 'ready', // ready | live | paused | ended
  timer: {
    duration: 300, // 5 minutes default
    remaining: 300,
    running: false,
    lastUpdated: null
  },
  players: [], // [ { id, name, grade, group, city, avatar, score: 0 }, ... ]
  showSummary: false
};
let droneTimerTimeout = null;

function getCurrentDroneRemaining() {
  if (!droneState.timer.running || !droneState.timer.lastUpdated) {
    return droneState.timer.remaining;
  }
  const elapsed = (Date.now() - droneState.timer.lastUpdated) / 1000;
  return Math.max(0, droneState.timer.remaining - elapsed);
}

function getDroneClientState() {
  const s = JSON.parse(JSON.stringify(droneState));
  s.timer.remaining = getCurrentDroneRemaining();
  s.timer.serverTime = Date.now();
  return s;
}

function broadcastDroneState() {
  io.emit('droneState', getDroneClientState());
}

function startDroneTimerCountdown() {
  clearTimeout(droneTimerTimeout);
  const remaining = getCurrentDroneRemaining();
  if (remaining <= 0) {
    droneState.timer.remaining = 0;
    droneState.timer.running = false;
    droneState.timer.lastUpdated = null;
    droneState.matchStatus = 'ended';
    broadcastDroneState();
    io.emit('drone_timerEnd');
    return;
  }
  droneTimerTimeout = setTimeout(() => {
    droneState.timer.remaining = 0;
    droneState.timer.running = false;
    droneState.timer.lastUpdated = null;
    droneState.matchStatus = 'ended';
    droneState.showSummary = true;
    broadcastDroneState();
    io.emit('drone_timerEnd');
    io.emit('drone_timeUp');
  }, remaining * 1000 + 100);
}

// ════════════════════════════════════════════════════════════════════
// ── STATIC PAGE ROUTES ──────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════

// ── Balloon Game static routes
app.get('/balloon/dashboard', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'balloon', 'dashboard.html'));
});
app.get('/balloon/match', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'balloon', 'match.html'));
});
app.get('/balloon/control', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'balloon', 'control.html'));
});
app.get('/balloon/leaderboard', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'balloon', 'leaderboard.html'));
});
app.get('/balloon/display', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'balloon', 'display.html'));
});

// ── Battle Bots static routes
app.get('/battlebots/dashboard', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'battlebots', 'dashboard.html'));
});
app.get('/battlebots/match', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'battlebots', 'match.html'));
});
app.get('/battlebots/control', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'battlebots', 'control.html'));
});
app.get('/battlebots/leaderboard', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'battlebots', 'leaderboard.html'));
});
app.get('/battlebots/display', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'battlebots', 'display.html'));
});

// ── Drone Game static routes
app.get('/drone/dashboard', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'drone', 'dashboard.html'));
});
app.get('/drone/match', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'drone', 'match.html'));
});
app.get('/drone/control', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'drone', 'control.html'));
});
app.get('/drone/leaderboard', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'drone', 'leaderboard.html'));
});
app.get('/drone/display', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'drone', 'display.html'));
});

// ── Auth routes
app.get('/login', (req, res) => {
  if (req.session && req.session.authenticated) return res.redirect('/dashboard');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    res.redirect('/dashboard');
  } else {
    res.redirect('/login?error=1');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// ── Robot Soccer static routes
app.get('/dashboard', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});
app.get('/match', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'match.html'));
});
app.get('/leaderboard', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'leaderboard.html'));
});
app.get('/control', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'control.html'));
});
app.get('/display', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display.html'));
});
app.get('/', (_req, res) => res.redirect('/dashboard'));

// ════════════════════════════════════════════════════════════════════
// ── ROBOT SOCCER REST APIS (STRICTLY SUPABASE) ───────────────────────
// ════════════════════════════════════════════════════════════════════

app.get('/api/state', (_req, res) => res.json(getClientState()));

// Leaderboard API
app.get('/api/leaderboard', async (_req, res) => {
  try {
    const table = await dataStore.getLeaderboard();
    res.json(table);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teams API
app.get('/api/teams', async (_req, res) => {
  try {
    const teams = await dataStore.getTeams();
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/teams', requireAuth, async (req, res) => {
  try {
    const { teamName, name, logo, student1, student2 } = req.body;
    const finalName = (teamName || name || '').trim();
    if (!finalName) {
      return res.status(400).json({ error: 'Team name is required.' });
    }

    const newTeam = await dataStore.saveTeam({
      teamName: finalName,
      name: finalName,
      logo: logo || null,
      student1,
      student2
    });

    const teams = await dataStore.getTeams();
    res.status(201).json({ success: true, team: newTeam, teams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/teams/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await dataStore.updateTeam(id, req.body);
    const teams = await dataStore.getTeams();
    res.json({ success: true, team: updated, teams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/teams/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await dataStore.deleteTeam(id);
    const teams = await dataStore.getTeams();
    res.json({ success: true, teams });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Matches API
app.get('/api/matches', async (_req, res) => {
  try {
    res.json(await dataStore.getMatches());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/matches/current', async (_req, res) => {
  try {
    const match = gameState.currentMatchId
      ? await dataStore.getMatchById(gameState.currentMatchId)
      : await dataStore.getCurrentMatch();
    res.json(match || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload/team-logo', requireAuth, upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.post('/api/match/start', requireAuth, async (req, res) => {
  try {
    const { teamA, teamB, duration } = req.body;
    if (!teamA || !teamB) {
      return res.status(400).json({ error: 'Both Team 1 and Team 2 are required.' });
    }

    pushHistory();
    clearTimeout(timerTimeout);

    const team1_id = teamA.teamId || teamA.id || null;
    const team2_id = teamB.teamId || teamB.id || null;
    const team1_name = (teamA.teamName || teamA.name || 'Team 1').trim();
    const team2_name = (teamB.teamName || teamB.name || 'Team 2').trim();

    const match = await dataStore.createMatch({
      team1_id,
      team2_id,
      team1_name,
      team2_name
    });

    gameState.currentMatchId = match.match_id || match.id;
    gameState.currentMatch = match;
    gameState.teamA.id = match.team1_id || team1_id;
    gameState.teamA.name = team1_name;
    gameState.teamA.logo = teamA.logo || null;
    gameState.teamA.score = 0;
    gameState.teamA.penalties = 0;

    gameState.teamB.id = match.team2_id || team2_id;
    gameState.teamB.name = team2_name;
    gameState.teamB.logo = teamB.logo || null;
    gameState.teamB.score = 0;
    gameState.teamB.penalties = 0;

    if (duration) {
      const dur = Math.max(30, Math.min(7200, parseInt(duration) || 600));
      gameState.timer.duration = dur;
    }

    gameState.timer.remaining = gameState.timer.duration;
    gameState.timer.running = false;
    gameState.timer.lastUpdated = null;
    gameState.matchStatus = 'ready';

    broadcastState();
    res.json({ success: true, match, redirect: '/control' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/match/end', requireAuth, async (req, res) => {
  try {
    pushHistory();
    clearTimeout(timerTimeout);

    const matchId = req.body.matchId || gameState.currentMatchId;
    const match = await dataStore.endMatch(matchId);

    gameState.matchStatus = 'ended';
    gameState.timer.running = false;
    gameState.timer.lastUpdated = null;

    broadcastState();
    io.emit('timerEnd');

    res.json({ success: true, match });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/upload/:team', requireAuth, upload.single('logo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const team = req.params.team;
  const url = `/uploads/${req.file.filename}`;
  pushHistory();
  if (team === 'a') gameState.teamA.logo = url;
  else if (team === 'b') gameState.teamB.logo = url;
  broadcastState();
  res.json({ url });
});

// ════════════════════════════════════════════════════════════════════
// ── BALLOON GAME REST APIS (STRICTLY SUPABASE) ───────────────────────
// ════════════════════════════════════════════════════════════════════

app.get('/api/balloon/state', (_req, res) => {
  res.json(getBalloonClientState());
});

app.get('/api/balloon/players', async (_req, res) => {
  try {
    const players = await dataStore.getBalloonPlayers();
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/balloon/players', requireAuth, async (req, res) => {
  try {
    const { name, grade, group, city, avatar } = req.body;
    const cleanName = (name || '').trim();
    if (!cleanName) return res.status(400).json({ error: 'Player Name is required.' });

    const newPlayer = await dataStore.saveBalloonPlayer({
      name: cleanName,
      grade: (grade || '').trim(),
      group: (group || '').trim(),
      city: (city || '').trim(),
      avatar: avatar || '🎈'
    });
    const players = await dataStore.getBalloonPlayers();
    res.status(201).json({ success: true, player: newPlayer, players });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/balloon/players/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await dataStore.updateBalloonPlayer(id, req.body);
    const players = await dataStore.getBalloonPlayers();
    res.json({ success: true, player: updated, players });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/balloon/players/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await dataStore.deleteBalloonPlayer(id);
    const players = await dataStore.getBalloonPlayers();
    res.json({ success: true, players });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/balloon/upload-avatar', requireAuth, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No avatar image uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.post('/api/balloon/match/start', requireAuth, async (req, res) => {
  try {
    const { playerIds, players, duration } = req.body;
    const ids = playerIds || (players ? players.map(p => p.id) : null);
    if (!Array.isArray(ids) || ids.length !== 3) {
      return res.status(400).json({ error: 'Exactly 3 players must be selected for 1v1v1 arena.' });
    }

    const allPlayers = await dataStore.getBalloonPlayers();
    const dur = Math.max(30, Math.min(7200, parseInt(duration) || 360));
    const matchId = `bm-${Date.now()}`;

    const resolvedPlayers = ids.map(id => {
      const found = allPlayers.find(p => p.id === id) || (players ? players.find(p => p.id === id) : null);
      return {
        id,
        name: found ? found.name : `Player ${id}`,
        grade: found ? found.grade : '',
        group: found ? found.group : '',
        city: found ? found.city : '',
        avatar: (found && found.avatar) ? found.avatar : '🎈',
        score: 0
      };
    });

    const scores = {};
    ids.forEach(id => { scores[id] = 0; });

    const matchRecord = {
      id: matchId,
      playerIds: ids,
      players: resolvedPlayers,
      status: 'ongoing',
      startTime: Date.now(),
      duration: dur,
      scores,
      events: []
    };

    await dataStore.createBalloonMatch(matchRecord);

    clearTimeout(balloonTimerTimeout);
    balloonState.matchId = matchId;
    balloonState.players = resolvedPlayers;
    balloonState.timer.duration = dur;
    balloonState.timer.remaining = dur;
    balloonState.timer.running = false;
    balloonState.timer.lastUpdated = null;
    balloonState.matchStatus = 'ready';
    balloonState.showSummary = false;

    broadcastBalloonState();
    res.json({ success: true, match: matchRecord, redirect: '/balloon/control' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/balloon/match/end', requireAuth, async (req, res) => {
  try {
    clearTimeout(balloonTimerTimeout);
    balloonState.timer.running = false;
    balloonState.timer.lastUpdated = null;
    balloonState.matchStatus = 'ended';
    balloonState.showSummary = true;

    if (balloonState.matchId) {
      await dataStore.updateBalloonMatch(balloonState.matchId, {
        status: 'completed',
        endTime: Date.now()
      });
    }

    broadcastBalloonState();
    io.emit('balloon_matchEnded');
    res.json({ success: true, state: getBalloonClientState() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/balloon/matches', async (_req, res) => {
  try {
    const matches = await dataStore.getBalloonMatches();
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/balloon/leaderboard', async (_req, res) => {
  try {
    const players = await dataStore.getBalloonPlayers();
    const matches = await dataStore.getBalloonMatches();

    const table = players.map(p => {
      const pMatches = matches.filter(m => m.playerIds && m.playerIds.includes(p.id));
      let matchesPlayed = pMatches.length;
      let wins = 0;
      let totalPoints = 0;

      pMatches.forEach(m => {
        const scores = m.scores || {};
        const myScore = scores[p.id] !== undefined ? scores[p.id] : 0;
        totalPoints += myScore;

        const participantScores = (m.playerIds || []).map(pid => (scores[pid] !== undefined ? scores[pid] : 0));
        if (participantScores.length > 0) {
          const minScore = Math.min(...participantScores);
          if (myScore === minScore) {
            wins += 1;
          }
        }
      });

      return {
        id: p.id,
        name: p.name,
        grade: p.grade || '',
        group: p.group || '',
        city: p.city || '',
        avatar: (p.avatar && p.avatar !== 'null') ? p.avatar : '🎈',
        matchesPlayed,
        wins,
        totalPoints
      };
    });

    table.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.totalPoints !== b.totalPoints) return a.totalPoints - b.totalPoints;
      return b.matchesPlayed - a.matchesPlayed;
    });

    table.forEach((row, idx) => {
      row.rank = idx + 1;
    });

    res.json(table);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// ── BATTLE BOTS REST APIS (STRICTLY SUPABASE) ────────────────────────
// ════════════════════════════════════════════════════════════════════

app.get('/api/battlebots/state', (_req, res) => {
  res.json(getBattleBotsClientState());
});

app.get('/api/battlebots/players', async (_req, res) => {
  try {
    const players = await dataStore.getBattleBotsPlayers();
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/battlebots/players', requireAuth, async (req, res) => {
  try {
    const { name, grade, group, city, avatar } = req.body;
    const cleanName = (name || '').trim();
    if (!cleanName) return res.status(400).json({ error: 'Bot Name is required.' });

    const newPlayer = await dataStore.saveBattleBotsPlayer({
      name: cleanName,
      grade: (grade || '').trim(),
      group: (group || '').trim(),
      city: (city || '').trim(),
      avatar: avatar || '🤖'
    });
    const players = await dataStore.getBattleBotsPlayers();
    res.status(201).json({ success: true, player: newPlayer, players });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/battlebots/players/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await dataStore.updateBattleBotsPlayer(id, req.body);
    const players = await dataStore.getBattleBotsPlayers();
    res.json({ success: true, player: updated, players });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/battlebots/players/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await dataStore.deleteBattleBotsPlayer(id);
    const players = await dataStore.getBattleBotsPlayers();
    res.json({ success: true, players });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/battlebots/upload-avatar', requireAuth, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No avatar image uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.post('/api/battlebots/match/start', requireAuth, async (req, res) => {
  try {
    const { playerIds, players, duration } = req.body;
    const ids = playerIds || (players ? players.map(p => p.id) : null);
    if (!Array.isArray(ids) || ids.length !== 3) {
      return res.status(400).json({ error: 'Exactly 3 bots must be selected for 1v1v1 arena.' });
    }

    const allPlayers = await dataStore.getBattleBotsPlayers();
    const dur = Math.max(30, Math.min(7200, parseInt(duration) || 600));
    const matchId = `bbm-${Date.now()}`;

    const resolvedPlayers = ids.map(id => {
      const found = allPlayers.find(p => p.id === id) || (players ? players.find(p => p.id === id) : null);
      return {
        id,
        name: found ? found.name : `Bot ${id}`,
        grade: found ? found.grade : '',
        group: found ? found.group : '',
        city: found ? found.city : '',
        avatar: (found && found.avatar) ? found.avatar : '🤖',
        score: 0
      };
    });

    const scores = {};
    ids.forEach(id => { scores[id] = 0; });

    const matchRecord = {
      id: matchId,
      playerIds: ids,
      players: resolvedPlayers,
      status: 'ongoing',
      startTime: Date.now(),
      duration: dur,
      scores,
      events: []
    };

    await dataStore.createBattleBotsMatch(matchRecord);

    clearTimeout(battlebotsTimerTimeout);
    battlebotsState.matchId = matchId;
    battlebotsState.players = resolvedPlayers;
    battlebotsState.timer.duration = dur;
    battlebotsState.timer.remaining = dur;
    battlebotsState.timer.running = false;
    battlebotsState.timer.lastUpdated = null;
    battlebotsState.matchStatus = 'ready';
    battlebotsState.showSummary = false;

    broadcastBattleBotsState();
    res.json({ success: true, match: matchRecord, redirect: '/battlebots/control' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/battlebots/match/end', requireAuth, async (req, res) => {
  try {
    clearTimeout(battlebotsTimerTimeout);
    battlebotsState.timer.running = false;
    battlebotsState.timer.lastUpdated = null;
    battlebotsState.matchStatus = 'ended';
    battlebotsState.showSummary = true;

    if (battlebotsState.matchId) {
      await dataStore.updateBattleBotsMatch(battlebotsState.matchId, {
        status: 'completed',
        endTime: Date.now()
      });
    }

    broadcastBattleBotsState();
    io.emit('battlebots_matchEnded');
    io.emit('battlebots_timerEnd');
    io.emit('battlebots_timeUp');
    res.json({ success: true, state: getBattleBotsClientState() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/battlebots/matches', async (_req, res) => {
  try {
    const matches = await dataStore.getBattleBotsMatches();
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/battlebots/leaderboard', async (_req, res) => {
  try {
    const players = await dataStore.getBattleBotsPlayers();
    const matches = await dataStore.getBattleBotsMatches();

    const table = players.map(p => {
      const pMatches = matches.filter(m => m.playerIds && m.playerIds.includes(p.id));
      let matchesPlayed = pMatches.length;
      let wins = 0;
      let totalPoints = 0;

      pMatches.forEach(m => {
        const scores = m.scores || {};
        const myScore = scores[p.id] !== undefined ? scores[p.id] : 0;
        totalPoints += myScore;

        const participantScores = (m.playerIds || []).map(pid => (scores[pid] !== undefined ? scores[pid] : 0));
        if (participantScores.length > 0) {
          const minScore = Math.min(...participantScores);
          if (myScore === minScore) {
            wins += 1;
          }
        }
      });

      return {
        id: p.id,
        name: p.name,
        grade: p.grade || '',
        group: p.group || '',
        city: p.city || '',
        avatar: (p.avatar && p.avatar !== 'null') ? p.avatar : '🤖',
        matchesPlayed,
        wins,
        totalPoints
      };
    });

    table.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.totalPoints !== b.totalPoints) return a.totalPoints - b.totalPoints;
      return b.matchesPlayed - a.matchesPlayed;
    });

    table.forEach((row, idx) => {
      row.rank = idx + 1;
    });

    res.json(table);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// ── DRONE GAME REST APIS (STRICTLY SUPABASE) ─────────────────────────
// ════════════════════════════════════════════════════════════════════

app.get('/api/drone/state', (_req, res) => {
  res.json(getDroneClientState());
});

app.get('/api/drone/players', async (_req, res) => {
  try {
    const players = await dataStore.getDronePlayers();
    res.json(players);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/drone/players', requireAuth, async (req, res) => {
  try {
    const { name, grade, group, city, avatar } = req.body;
    const cleanName = (name || '').trim();
    if (!cleanName) return res.status(400).json({ error: 'Pilot/Drone name is required' });

    const newPlayer = await dataStore.saveDronePlayer({
      name: cleanName,
      grade: (grade || '').trim(),
      group: (group || '').trim(),
      city: (city || '').trim(),
      avatar: (avatar && avatar !== 'null') ? avatar : '🛸'
    });
    res.json({ success: true, player: newPlayer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/drone/players/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await dataStore.updateDronePlayer(id, req.body);
    res.json({ success: true, player: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/drone/players/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await dataStore.deleteDronePlayer(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/drone/upload-avatar', requireAuth, upload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No avatar image uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.post('/api/drone/match/start', requireAuth, async (req, res) => {
  try {
    const { playerIds, players, duration } = req.body;
    const ids = playerIds || (players ? players.map(p => p.id) : null);
    if (!ids || ids.length < 2) {
      return res.status(400).json({ error: 'A 1v1 Drone match requires exactly 2 pilots/drones' });
    }

    const allPlayers = await dataStore.getDronePlayers();
    const selected = ids.slice(0, 2).map(id => {
      const found = allPlayers.find(p => p.id === id);
      return {
        id,
        name: found ? found.name : 'Pilot',
        grade: found ? found.grade : '',
        group: found ? found.group : '',
        city: found ? found.city : '',
        avatar: (found && found.avatar) ? found.avatar : '🛸',
        score: 0
      };
    });

    const dur = Math.max(30, Math.min(7200, parseInt(duration) || 300));
    const newMatchId = `dm-${Date.now()}`;

    const matchRecord = {
      id: newMatchId,
      playerIds: selected.map(p => p.id),
      players: selected,
      duration: dur,
      startTime: Date.now(),
      status: 'ongoing',
      scores: {
        [selected[0].id]: 0,
        [selected[1].id]: 0
      },
      events: []
    };

    await dataStore.createDroneMatch(matchRecord);

    clearTimeout(droneTimerTimeout);
    droneState.matchId = newMatchId;
    droneState.matchStatus = 'ready';
    droneState.timer.duration = dur;
    droneState.timer.remaining = dur;
    droneState.timer.running = false;
    droneState.timer.lastUpdated = null;
    droneState.players = selected;
    droneState.showSummary = false;

    broadcastDroneState();
    res.json({ success: true, match: matchRecord, state: getDroneClientState() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/drone/match/end', requireAuth, async (req, res) => {
  try {
    clearTimeout(droneTimerTimeout);
    droneState.timer.running = false;
    droneState.timer.lastUpdated = null;
    droneState.matchStatus = 'ended';
    droneState.showSummary = true;

    if (droneState.matchId) {
      await dataStore.updateDroneMatch(droneState.matchId, {
        status: 'completed',
        endTime: Date.now()
      });
    }

    broadcastDroneState();
    io.emit('drone_matchEnded');
    io.emit('drone_timerEnd');
    io.emit('drone_timeUp');
    res.json({ success: true, state: getDroneClientState() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/drone/matches', async (_req, res) => {
  try {
    const matches = await dataStore.getDroneMatches();
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/drone/leaderboard', async (_req, res) => {
  try {
    const players = await dataStore.getDronePlayers();
    const matches = await dataStore.getDroneMatches();

    const table = players.map(p => {
      const pMatches = matches.filter(m => m.playerIds && m.playerIds.includes(p.id));
      let matchesPlayed = pMatches.length;
      let wins = 0;
      let totalPoints = 0;

      pMatches.forEach(m => {
        const scores = m.scores || {};
        const myScore = scores[p.id] !== undefined ? scores[p.id] : 0;
        totalPoints += myScore;

        if (m.status === 'completed' && m.scores) {
          const matchScores = Object.values(m.scores);
          const maxScore = Math.max(...matchScores);
          if (myScore === maxScore && myScore > 0) {
            const winners = Object.keys(m.scores).filter(k => m.scores[k] === maxScore);
            if (winners.includes(p.id)) {
              wins += 1 / winners.length;
            }
          }
        }
      });

      wins = Math.round(wins * 10) / 10;

      return {
        id: p.id,
        name: p.name,
        grade: p.grade || '',
        group: p.group || '',
        city: p.city || '',
        avatar: (p.avatar && p.avatar !== 'null') ? p.avatar : '🛸',
        matchesPlayed,
        wins,
        totalPoints
      };
    });

    table.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return b.matchesPlayed - a.matchesPlayed;
    });

    table.forEach((row, idx) => {
      row.rank = idx + 1;
    });

    res.json(table);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════
// ── SOCKET.IO CONTROLS ──────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════

io.on('connection', (socket) => {
  socket.emit('state', getClientState());
  socket.emit('balloonState', getBalloonClientState());
  socket.emit('battlebotsState', getBattleBotsClientState());
  socket.emit('droneState', getDroneClientState());

  const isAdmin = socket.request.session && socket.request.session.authenticated;
  if (!isAdmin) {
    socket.on('disconnect', () => {});
    return;
  }

  // ── BALLOON POPPING CONTROLS
  socket.on('balloon_timerStart', () => {
    if (balloonState.timer.running || balloonState.timer.remaining <= 0) return;
    balloonState.timer.running = true;
    balloonState.timer.lastUpdated = Date.now();
    balloonState.matchStatus = 'live';
    startBalloonTimerCountdown();
    broadcastBalloonState();
  });

  socket.on('balloon_timerPause', () => {
    if (!balloonState.timer.running) return;
    clearTimeout(balloonTimerTimeout);
    const elapsed = (Date.now() - balloonState.timer.lastUpdated) / 1000;
    balloonState.timer.remaining = Math.max(0, balloonState.timer.remaining - elapsed);
    balloonState.timer.running = false;
    balloonState.timer.lastUpdated = null;
    balloonState.matchStatus = 'paused';
    broadcastBalloonState();
  });

  socket.on('balloon_timerReset', () => {
    clearTimeout(balloonTimerTimeout);
    balloonState.timer.remaining = balloonState.timer.duration;
    balloonState.timer.running = false;
    balloonState.timer.lastUpdated = null;
    balloonState.matchStatus = 'ready';
    broadcastBalloonState();
  });

  socket.on('balloon_setDuration', (seconds) => {
    const dur = Math.max(30, Math.min(7200, parseInt(seconds) || 360));
    balloonState.timer.duration = dur;
    if (!balloonState.timer.running) balloonState.timer.remaining = dur;
    broadcastBalloonState();
  });

  socket.on('balloon_point', async ({ playerId, delta }) => {
    const d = parseInt(delta) || 0;
    const player = balloonState.players.find(p => p.id === playerId);
    if (player) {
      player.score = Math.max(0, player.score + d);
    }
    broadcastBalloonState();

    if (balloonState.matchId) {
      try {
        const scores = {};
        balloonState.players.forEach(p => { scores[p.id] = p.score; });
        await dataStore.updateBalloonMatch(balloonState.matchId, { scores });
      } catch (err) {
        console.error('Error syncing balloon points to Supabase:', err.message);
      }
    }
  });

  socket.on('balloon_setScore', async ({ playerId, score }) => {
    const s = Math.max(0, parseInt(score) || 0);
    const player = balloonState.players.find(p => p.id === playerId);
    if (player) {
      player.score = s;
    }
    broadcastBalloonState();

    if (balloonState.matchId) {
      try {
        const scores = {};
        balloonState.players.forEach(p => { scores[p.id] = p.score; });
        await dataStore.updateBalloonMatch(balloonState.matchId, { scores });
      } catch (err) {
        console.error('Error syncing balloon score to Supabase:', err.message);
      }
    }
  });

  socket.on('balloon_endMatch', async () => {
    clearTimeout(balloonTimerTimeout);
    balloonState.timer.running = false;
    balloonState.timer.lastUpdated = null;
    balloonState.matchStatus = 'ended';
    balloonState.showSummary = true;

    if (balloonState.matchId) {
      try {
        await dataStore.updateBalloonMatch(balloonState.matchId, {
          status: 'completed',
          endTime: Date.now()
        });
      } catch (err) {
        console.error('Error ending balloon match in Supabase:', err.message);
      }
    }

    broadcastBalloonState();
    io.emit('balloon_matchEnded');
    io.emit('balloon_timerEnd');
    io.emit('balloon_timeUp');
  });

  socket.on('balloon_showSummary', () => {
    balloonState.showSummary = true;
    broadcastBalloonState();
    io.emit('balloon_showSummary');
  });

  socket.on('balloon_dismissSummary', () => {
    balloonState.showSummary = false;
    broadcastBalloonState();
    io.emit('balloon_hideSummary');
  });

  socket.on('balloon_clearDisplay', () => {
    clearTimeout(balloonTimerTimeout);
    balloonState.showSummary = false;
    balloonState.matchStatus = 'ready';
    balloonState.timer.running = false;
    balloonState.timer.lastUpdated = null;
    balloonState.timer.remaining = balloonState.timer.duration;
    balloonState.players.forEach(p => { p.score = 0; });
    broadcastBalloonState();
    io.emit('balloon_hideSummary');
    io.emit('balloon_clearDisplay');
  });

  socket.on('balloon_resetMatch', () => {
    clearTimeout(balloonTimerTimeout);
    balloonState.players.forEach(p => { p.score = 0; });
    balloonState.timer.remaining = balloonState.timer.duration;
    balloonState.timer.running = false;
    balloonState.timer.lastUpdated = null;
    balloonState.matchStatus = 'ready';
    balloonState.showSummary = false;
    broadcastBalloonState();
    io.emit('balloon_hideSummary');
    io.emit('balloon_clearDisplay');
  });

  // ── BATTLE BOTS CONTROLS
  socket.on('battlebots_timerStart', () => {
    if (battlebotsState.timer.running || battlebotsState.timer.remaining <= 0) return;
    battlebotsState.timer.running = true;
    battlebotsState.timer.lastUpdated = Date.now();
    battlebotsState.matchStatus = 'live';
    startBattleBotsTimerCountdown();
    broadcastBattleBotsState();
  });

  socket.on('battlebots_timerPause', () => {
    if (!battlebotsState.timer.running) return;
    clearTimeout(battlebotsTimerTimeout);
    const elapsed = (Date.now() - battlebotsState.timer.lastUpdated) / 1000;
    battlebotsState.timer.remaining = Math.max(0, battlebotsState.timer.remaining - elapsed);
    battlebotsState.timer.running = false;
    battlebotsState.timer.lastUpdated = null;
    battlebotsState.matchStatus = 'paused';
    broadcastBattleBotsState();
  });

  socket.on('battlebots_timerReset', () => {
    clearTimeout(battlebotsTimerTimeout);
    battlebotsState.timer.remaining = battlebotsState.timer.duration;
    battlebotsState.timer.running = false;
    battlebotsState.timer.lastUpdated = null;
    battlebotsState.matchStatus = 'ready';
    broadcastBattleBotsState();
  });

  socket.on('battlebots_setDuration', (seconds) => {
    const dur = Math.max(30, Math.min(7200, parseInt(seconds) || 600));
    battlebotsState.timer.duration = dur;
    if (!battlebotsState.timer.running) battlebotsState.timer.remaining = dur;
    broadcastBattleBotsState();
  });

  socket.on('battlebots_point', async ({ playerId, delta }) => {
    const d = parseInt(delta) || 0;
    const player = battlebotsState.players.find(p => p.id === playerId);
    if (player) {
      player.score = Math.max(0, player.score + d);
    }
    broadcastBattleBotsState();

    if (battlebotsState.matchId) {
      try {
        const scores = {};
        battlebotsState.players.forEach(p => { scores[p.id] = p.score; });
        await dataStore.updateBattleBotsMatch(battlebotsState.matchId, { scores });
      } catch (err) {
        console.error('Error syncing battlebots point to Supabase:', err.message);
      }
    }
  });

  socket.on('battlebots_setScore', async ({ playerId, score }) => {
    const s = Math.max(0, parseInt(score) || 0);
    const player = battlebotsState.players.find(p => p.id === playerId);
    if (player) {
      player.score = s;
    }
    broadcastBattleBotsState();

    if (battlebotsState.matchId) {
      try {
        const scores = {};
        battlebotsState.players.forEach(p => { scores[p.id] = p.score; });
        await dataStore.updateBattleBotsMatch(battlebotsState.matchId, { scores });
      } catch (err) {
        console.error('Error syncing battlebots score to Supabase:', err.message);
      }
    }
  });

  socket.on('battlebots_endMatch', async () => {
    clearTimeout(battlebotsTimerTimeout);
    battlebotsState.timer.running = false;
    battlebotsState.timer.lastUpdated = null;
    battlebotsState.matchStatus = 'ended';
    battlebotsState.showSummary = true;

    if (battlebotsState.matchId) {
      try {
        await dataStore.updateBattleBotsMatch(battlebotsState.matchId, {
          status: 'completed',
          endTime: Date.now()
        });
      } catch (err) {
        console.error('Error ending battlebots match in Supabase:', err.message);
      }
    }

    broadcastBattleBotsState();
    io.emit('battlebots_matchEnded');
    io.emit('battlebots_timerEnd');
    io.emit('battlebots_timeUp');
  });

  socket.on('battlebots_showSummary', () => {
    battlebotsState.showSummary = true;
    broadcastBattleBotsState();
    io.emit('battlebots_showSummary');
  });

  socket.on('battlebots_dismissSummary', () => {
    battlebotsState.showSummary = false;
    broadcastBattleBotsState();
    io.emit('battlebots_hideSummary');
  });

  socket.on('battlebots_clearDisplay', () => {
    clearTimeout(battlebotsTimerTimeout);
    battlebotsState.showSummary = false;
    battlebotsState.matchStatus = 'ready';
    battlebotsState.timer.running = false;
    battlebotsState.timer.lastUpdated = null;
    battlebotsState.timer.remaining = battlebotsState.timer.duration;
    battlebotsState.players.forEach(p => { p.score = 0; });
    broadcastBattleBotsState();
    io.emit('battlebots_hideSummary');
    io.emit('battlebots_clearDisplay');
  });

  socket.on('battlebots_resetMatch', () => {
    clearTimeout(battlebotsTimerTimeout);
    battlebotsState.players.forEach(p => { p.score = 0; });
    battlebotsState.timer.remaining = battlebotsState.timer.duration;
    battlebotsState.timer.running = false;
    battlebotsState.timer.lastUpdated = null;
    battlebotsState.matchStatus = 'ready';
    battlebotsState.showSummary = false;
    broadcastBattleBotsState();
    io.emit('battlebots_hideSummary');
    io.emit('battlebots_clearDisplay');
  });

  // ── DRONE CONTROLS
  socket.on('drone_timerStart', () => {
    if (droneState.timer.running || droneState.timer.remaining <= 0) return;
    droneState.timer.running = true;
    droneState.timer.lastUpdated = Date.now();
    droneState.matchStatus = 'live';
    startDroneTimerCountdown();
    broadcastDroneState();
  });

  socket.on('drone_timerPause', () => {
    if (!droneState.timer.running) return;
    clearTimeout(droneTimerTimeout);
    const elapsed = (Date.now() - droneState.timer.lastUpdated) / 1000;
    droneState.timer.remaining = Math.max(0, droneState.timer.remaining - elapsed);
    droneState.timer.running = false;
    droneState.timer.lastUpdated = null;
    droneState.matchStatus = 'paused';
    broadcastDroneState();
  });

  socket.on('drone_timerReset', () => {
    clearTimeout(droneTimerTimeout);
    droneState.timer.remaining = droneState.timer.duration;
    droneState.timer.running = false;
    droneState.timer.lastUpdated = null;
    droneState.matchStatus = 'ready';
    broadcastDroneState();
  });

  socket.on('drone_setDuration', (seconds) => {
    const dur = Math.max(30, Math.min(7200, parseInt(seconds) || 300));
    droneState.timer.duration = dur;
    if (!droneState.timer.running) droneState.timer.remaining = dur;
    broadcastDroneState();
  });

  socket.on('drone_point', async ({ playerId, delta }) => {
    const d = parseInt(delta) || 0;
    const player = droneState.players.find(p => p.id === playerId);
    if (player) {
      player.score = Math.max(0, player.score + d);
    }
    broadcastDroneState();

    if (droneState.matchId) {
      try {
        const scores = {};
        droneState.players.forEach(p => { scores[p.id] = p.score; });
        await dataStore.updateDroneMatch(droneState.matchId, { scores });
      } catch (err) {
        console.error('Error syncing drone point to Supabase:', err.message);
      }
    }
  });

  socket.on('drone_setScore', async ({ playerId, score }) => {
    const s = Math.max(0, parseInt(score) || 0);
    const player = droneState.players.find(p => p.id === playerId);
    if (player) {
      player.score = s;
    }
    broadcastDroneState();

    if (droneState.matchId) {
      try {
        const scores = {};
        droneState.players.forEach(p => { scores[p.id] = p.score; });
        await dataStore.updateDroneMatch(droneState.matchId, { scores });
      } catch (err) {
        console.error('Error syncing drone score to Supabase:', err.message);
      }
    }
  });

  socket.on('drone_endMatch', async () => {
    clearTimeout(droneTimerTimeout);
    droneState.timer.running = false;
    droneState.timer.lastUpdated = null;
    droneState.matchStatus = 'ended';
    droneState.showSummary = true;

    if (droneState.matchId) {
      try {
        await dataStore.updateDroneMatch(droneState.matchId, {
          status: 'completed',
          endTime: Date.now()
        });
      } catch (err) {
        console.error('Error ending drone match in Supabase:', err.message);
      }
    }

    broadcastDroneState();
    io.emit('drone_matchEnded');
    io.emit('drone_timerEnd');
    io.emit('drone_timeUp');
  });

  socket.on('drone_showSummary', () => {
    droneState.showSummary = true;
    broadcastDroneState();
    io.emit('drone_showSummary');
  });

  socket.on('drone_dismissSummary', () => {
    droneState.showSummary = false;
    broadcastDroneState();
    io.emit('drone_hideSummary');
  });

  socket.on('drone_clearDisplay', () => {
    clearTimeout(droneTimerTimeout);
    droneState.showSummary = false;
    droneState.matchStatus = 'ready';
    droneState.timer.running = false;
    droneState.timer.lastUpdated = null;
    droneState.timer.remaining = droneState.timer.duration;
    droneState.players.forEach(p => { p.score = 0; });
    broadcastDroneState();
    io.emit('drone_hideSummary');
    io.emit('drone_clearDisplay');
  });

  socket.on('drone_resetMatch', () => {
    clearTimeout(droneTimerTimeout);
    droneState.players.forEach(p => { p.score = 0; });
    droneState.timer.remaining = droneState.timer.duration;
    droneState.timer.running = false;
    droneState.timer.lastUpdated = null;
    droneState.matchStatus = 'ready';
    droneState.showSummary = false;
    broadcastDroneState();
    io.emit('drone_hideSummary');
    io.emit('drone_clearDisplay');
  });

  // ── ROBOT SOCCER SCOREBOARD CONTROLS
  socket.on('updateScore', async ({ team, delta }) => {
    pushHistory();
    const d = parseInt(delta) || 0;
    if (team === 'a') gameState.teamA.score = Math.max(0, gameState.teamA.score + d);
    else gameState.teamB.score = Math.max(0, gameState.teamB.score + d);

    broadcastState();

    try {
      const match = await ensureActiveMatch();
      if (match) {
        const newScore = team === 'a' ? gameState.teamA.score : gameState.teamB.score;
        await dataStore.updateScoreDelta(match.match_id || match.id, team, d, newScore);
      }
    } catch (err) {
      console.error('Error syncing score update to Supabase:', err.message);
    }
  });

  socket.on('setScore', async ({ team, score }) => {
    pushHistory();
    const s = Math.max(0, parseInt(score) || 0);
    if (team === 'a') gameState.teamA.score = s;
    else gameState.teamB.score = s;

    broadcastState();

    try {
      const match = await ensureActiveMatch();
      if (match) {
        await dataStore.updateScoreDelta(match.match_id || match.id, team, 0, s);
      }
    } catch (err) {
      console.error('Error syncing score to Supabase:', err.message);
    }
  });

  socket.on('recordGoal', async ({ team }) => {
    pushHistory();
    if (team === 'a') gameState.teamA.score += 1;
    else gameState.teamB.score += 1;

    broadcastState();

    try {
      const match = await ensureActiveMatch();
      if (match) {
        await dataStore.recordGoal(
          match.match_id || match.id,
          team,
          team === 'a' ? gameState.teamA.score : gameState.teamB.score
        );
      }
    } catch (err) {
      console.error('Error recording goal in Supabase:', err.message);
    }
  });

  socket.on('recordPenalty', async ({ team, delta = 1 }) => {
    pushHistory();
    const d = parseInt(delta) || 1;
    if (team === 'a') gameState.teamA.penalties = Math.max(0, (gameState.teamA.penalties || 0) + d);
    else gameState.teamB.penalties = Math.max(0, (gameState.teamB.penalties || 0) + d);

    broadcastState();

    try {
      const match = await ensureActiveMatch();
      if (match) {
        await dataStore.recordPenalty(match.match_id || match.id, team, d);
      }
    } catch (err) {
      console.error('Error recording penalty in Supabase:', err.message);
    }
  });

  socket.on('endMatch', async () => {
    pushHistory();
    clearTimeout(timerTimeout);
    gameState.timer.running = false;
    gameState.timer.lastUpdated = null;
    gameState.matchStatus = 'ended';

    broadcastState();
    io.emit('timerEnd');

    try {
      if (gameState.currentMatchId) {
        await dataStore.endMatch(gameState.currentMatchId);
      } else {
        await dataStore.endMatch();
      }
    } catch (err) {
      console.error('Error ending match in Supabase:', err.message);
    }
  });

  socket.on('setTeamName', ({ team, name }) => {
    pushHistory();
    if (team === 'a') gameState.teamA.name = (name || '').trim() || 'Team A';
    else gameState.teamB.name = (name || '').trim() || 'Team B';
    broadcastState();
  });

  socket.on('setEventTitle', (title) => {
    pushHistory();
    gameState.eventTitle = (title || '').trim() || 'Robot Soccer';
    broadcastState();
  });

  socket.on('removeLogo', ({ team }) => {
    pushHistory();
    if (team === 'a') gameState.teamA.logo = null;
    else gameState.teamB.logo = null;
    broadcastState();
  });

  socket.on('setDuration', (seconds) => {
    const dur = Math.max(30, Math.min(7200, parseInt(seconds) || 600));
    pushHistory();
    gameState.timer.duration = dur;
    if (!gameState.timer.running) gameState.timer.remaining = dur;
    broadcastState();
  });

  socket.on('timerStart', () => {
    if (gameState.timer.running || gameState.timer.remaining <= 0) return;
    pushHistory();
    gameState.timer.running = true;
    gameState.timer.lastUpdated = Date.now();
    gameState.matchStatus = 'live';
    startTimerCountdown();
    broadcastState();
  });

  socket.on('timerPause', () => {
    if (!gameState.timer.running) return;
    pushHistory();
    clearTimeout(timerTimeout);
    const elapsed = (Date.now() - gameState.timer.lastUpdated) / 1000;
    gameState.timer.remaining = Math.max(0, gameState.timer.remaining - elapsed);
    gameState.timer.running = false;
    gameState.timer.lastUpdated = null;
    gameState.matchStatus = 'paused';
    broadcastState();
  });

  socket.on('timerReset', () => {
    pushHistory();
    clearTimeout(timerTimeout);
    gameState.timer.remaining = gameState.timer.duration;
    gameState.timer.running = false;
    gameState.timer.lastUpdated = null;
    gameState.matchStatus = 'ready';
    broadcastState();
  });

  socket.on('resetMatch', () => {
    pushHistory();
    clearTimeout(timerTimeout);
    gameState.teamA.score = 0;
    gameState.teamA.penalties = 0;
    gameState.teamB.score = 0;
    gameState.teamB.penalties = 0;
    gameState.timer.remaining = gameState.timer.duration;
    gameState.timer.running = false;
    gameState.timer.lastUpdated = null;
    gameState.matchStatus = 'ready';
    broadcastState();
    io.emit('hideOverview');
  });

  socket.on('dismissOverview', () => {
    io.emit('hideOverview');
  });

  socket.on('showOverview', () => {
    io.emit('showOverview');
  });

  socket.on('undo', () => {
    if (history.length === 0) return;
    clearTimeout(timerTimeout);
    gameState = history.pop();
    if (gameState.timer.running) {
      gameState.timer.lastUpdated = Date.now();
      startTimerCountdown();
    }
    broadcastState();
  });

  socket.on('setupMatch', async ({ teamA, teamB, duration }) => {
    pushHistory();
    clearTimeout(timerTimeout);

    const team1_id = teamA?.teamId || teamA?.id || null;
    const team2_id = teamB?.teamId || teamB?.id || null;
    const team1_name = (teamA?.teamName || teamA?.name || 'Team 1').trim();
    const team2_name = (teamB?.teamName || teamB?.name || 'Team 2').trim();

    try {
      const match = await dataStore.createMatch({
        team1_id,
        team2_id,
        team1_name,
        team2_name
      });

      gameState.currentMatchId = match.match_id || match.id;
      gameState.currentMatch = match;
      gameState.teamA.id = match.team1_id || team1_id;
      gameState.teamA.name = team1_name;
      gameState.teamA.logo = teamA?.logo || null;
      gameState.teamA.score = 0;
      gameState.teamA.penalties = 0;

      gameState.teamB.id = match.team2_id || team2_id;
      gameState.teamB.name = team2_name;
      gameState.teamB.logo = teamB?.logo || null;
      gameState.teamB.score = 0;
      gameState.teamB.penalties = 0;

      if (duration) {
        const dur = Math.max(30, Math.min(7200, parseInt(duration) || 600));
        gameState.timer.duration = dur;
      }
      gameState.timer.remaining = gameState.timer.duration;
      gameState.timer.running = false;
      gameState.timer.lastUpdated = null;
      gameState.matchStatus = 'ready';
      broadcastState();
      io.emit('hideOverview');
    } catch (err) {
      console.error('Error creating match in Supabase:', err.message);
    }
  });

  socket.on('disconnect', () => {});
});

// ── Start server ────────────────────────────────────────────────────
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  const hostLabel = HOST === '0.0.0.0' ? 'localhost' : HOST;
  console.log(`Listening on http://${hostLabel}:${PORT}`);
  console.log('');
  console.log('  🤖  Robot Soccer Scoreboard');
  console.log('  ─────────────────────────────────');
  console.log(`  Dashboard:      http://${hostLabel}:${PORT}/dashboard`);
  console.log(`  Matchmaker:     http://${hostLabel}:${PORT}/match`);
  console.log(`  Control panel:  http://${hostLabel}:${PORT}/control`);
  console.log(`  Display (TV):   http://${hostLabel}:${PORT}/display`);
  console.log(`  Password:       ${ADMIN_PASSWORD}`);
  console.log('');
});
