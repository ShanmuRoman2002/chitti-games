const crypto = require('crypto');
const { supabase } = require('./config/supabase');

function isValidUUID(str) {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

function ensureUUID(id) {
  if (id && isValidUUID(id)) return id;
  return crypto.randomUUID();
}

// ════════════════════════════════════════════════════════════════════
// ── ROBOT SOCCER (Tables: soccer_teams, soccer_matches) ─────────────
// ════════════════════════════════════════════════════════════════════

async function getTeams() {
  const { data, error } = await supabase
    .from('soccer_teams')
    .select('*')
    .order('points', { ascending: false });

  if (error) {
    console.error('Supabase getTeams error (soccer_teams):', error.message);
    throw error;
  }

  return (data || []).map(t => ({
    id: t.id,
    teamName: t.team_name || t.name,
    name: t.name || t.team_name,
    logo: t.logo,
    points: t.points || 0,
    wins: t.wins || 0,
    losses: t.losses || 0,
    goals_scored: t.goals_scored || 0,
    student1: t.student1 || {},
    student2: t.student2 || {},
    createdAt: t.created_at
  }));
}

async function getTeamById(id) {
  if (!id || !isValidUUID(id)) return null;
  const { data, error } = await supabase
    .from('soccer_teams')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    teamName: data.team_name || data.name,
    name: data.name || data.team_name,
    logo: data.logo,
    points: data.points || 0,
    wins: data.wins || 0,
    losses: data.losses || 0,
    goals_scored: data.goals_scored || 0,
    student1: data.student1 || {},
    student2: data.student2 || {},
    createdAt: data.created_at
  };
}

async function saveTeam(teamData) {
  const finalName = (teamData.teamName || teamData.name || 'Unnamed Team').trim();
  const teamId = ensureUUID(teamData.id);

  const payload = {
    id: teamId,
    name: finalName,
    logo: teamData.logo || null,
    points: teamData.points || 0,
    wins: teamData.wins || 0,
    losses: teamData.losses || 0,
    goals_scored: teamData.goals_scored || 0
  };
  if (teamData.student1) payload.student1 = teamData.student1;
  if (teamData.student2) payload.student2 = teamData.student2;

  let { data, error } = await supabase
    .from('soccer_teams')
    .upsert(payload)
    .select()
    .single();

  // If student1 or student2 columns do not exist in the table, retry without them
  if (error && error.message && (error.message.includes('student1') || error.message.includes('student2'))) {
    delete payload.student1;
    delete payload.student2;
    const retry = await supabase.from('soccer_teams').upsert(payload).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error('Supabase saveTeam error (soccer_teams):', error.message);
    throw error;
  }

  return {
    id: data.id,
    teamName: data.team_name || data.name,
    name: data.name || data.team_name,
    logo: data.logo,
    points: data.points || 0,
    wins: data.wins || 0,
    losses: data.losses || 0,
    goals_scored: data.goals_scored || 0,
    student1: data.student1 || teamData.student1 || {},
    student2: data.student2 || teamData.student2 || {},
    createdAt: data.created_at
  };
}

async function updateTeam(id, updateData) {
  if (!isValidUUID(id)) return null;
  const payload = {};
  if (updateData.name || updateData.teamName) {
    const n = (updateData.name || updateData.teamName).trim();
    payload.name = n;
  }
  if (updateData.logo !== undefined) payload.logo = updateData.logo;
  if (updateData.points !== undefined) payload.points = updateData.points;
  if (updateData.wins !== undefined) payload.wins = updateData.wins;
  if (updateData.losses !== undefined) payload.losses = updateData.losses;
  if (updateData.goals_scored !== undefined) payload.goals_scored = updateData.goals_scored;
  if (updateData.student1 !== undefined) payload.student1 = updateData.student1;
  if (updateData.student2 !== undefined) payload.student2 = updateData.student2;

  let { data, error } = await supabase
    .from('soccer_teams')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error && error.message && (error.message.includes('student1') || error.message.includes('student2'))) {
    delete payload.student1;
    delete payload.student2;
    const retry = await supabase.from('soccer_teams').update(payload).eq('id', id).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error('Supabase updateTeam error (soccer_teams):', error.message);
    throw error;
  }
  return data;
}

async function deleteTeam(id) {
  if (!isValidUUID(id)) return false;
  const { error } = await supabase
    .from('soccer_teams')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Supabase deleteTeam error (soccer_teams):', error.message);
    throw error;
  }
  return true;
}

// ── Matches Operations (soccer_matches) ──────────────────────────────
async function getMatches() {
  const { data: matches, error } = await supabase
    .from('soccer_matches')
    .select('*')
    .order('start_time', { ascending: false });

  if (error) {
    console.error('Supabase getMatches error (soccer_matches):', error.message);
    throw error;
  }

  // Pre-load teams so we can dynamically map team1_name and team2_name
  const teams = await getTeams().catch(() => []);
  const teamMap = {};
  teams.forEach(t => { teamMap[t.id] = t.name || t.teamName; });

  return (matches || []).map(m => ({
    match_id: m.id,
    id: m.id,
    team1_id: m.team1_id,
    team2_id: m.team2_id,
    team1_name: teamMap[m.team1_id] || 'Team 1',
    team2_name: teamMap[m.team2_id] || 'Team 2',
    team1_score: m.team1_goals || 0,
    team2_score: m.team2_goals || 0,
    team1_goals: m.team1_goals || 0,
    team2_goals: m.team2_goals || 0,
    team1_penalties: m.team1_penalties || 0,
    team2_penalties: m.team2_penalties || 0,
    status: m.status || 'ready',
    events: m.match_events || [],
    match_events: m.match_events || [],
    startTime: m.start_time,
    endTime: m.end_time
  }));
}

async function getMatchById(matchId) {
  if (!matchId || !isValidUUID(matchId)) return null;
  const { data, error } = await supabase
    .from('soccer_matches')
    .select('*')
    .eq('id', matchId)
    .single();

  if (error || !data) return null;

  let t1Name = 'Team 1';
  let t2Name = 'Team 2';
  if (data.team1_id) {
    const t1 = await getTeamById(data.team1_id).catch(() => null);
    if (t1) t1Name = t1.name || t1.teamName;
  }
  if (data.team2_id) {
    const t2 = await getTeamById(data.team2_id).catch(() => null);
    if (t2) t2Name = t2.name || t2.teamName;
  }

  return {
    match_id: data.id,
    id: data.id,
    team1_id: data.team1_id,
    team2_id: data.team2_id,
    team1_name: t1Name,
    team2_name: t2Name,
    team1_score: data.team1_goals || 0,
    team2_score: data.team2_goals || 0,
    team1_goals: data.team1_goals || 0,
    team2_goals: data.team2_goals || 0,
    team1_penalties: data.team1_penalties || 0,
    team2_penalties: data.team2_penalties || 0,
    status: data.status,
    events: data.match_events || [],
    match_events: data.match_events || [],
    startTime: data.start_time,
    endTime: data.end_time
  };
}

async function getCurrentMatch() {
  const { data, error } = await supabase
    .from('soccer_matches')
    .select('*')
    .order('start_time', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  const m = data[0];

  let t1Name = 'Team 1';
  let t2Name = 'Team 2';
  if (m.team1_id) {
    const t1 = await getTeamById(m.team1_id).catch(() => null);
    if (t1) t1Name = t1.name || t1.teamName;
  }
  if (m.team2_id) {
    const t2 = await getTeamById(m.team2_id).catch(() => null);
    if (t2) t2Name = t2.name || t2.teamName;
  }

  return {
    match_id: m.id,
    id: m.id,
    team1_id: m.team1_id,
    team2_id: m.team2_id,
    team1_name: t1Name,
    team2_name: t2Name,
    team1_score: m.team1_goals || 0,
    team2_score: m.team2_goals || 0,
    team1_goals: m.team1_goals || 0,
    team2_goals: m.team2_goals || 0,
    team1_penalties: m.team1_penalties || 0,
    team2_penalties: m.team2_penalties || 0,
    status: m.status,
    events: m.match_events || [],
    match_events: m.match_events || [],
    startTime: m.start_time,
    endTime: m.end_time
  };
}

async function createMatch(matchData) {
  const matchId = ensureUUID(matchData.match_id || matchData.id);

  // 1. Resolve team1_id
  let t1Id = (matchData.team1_id && isValidUUID(matchData.team1_id)) ? matchData.team1_id : null;
  const t1Name = (matchData.team1_name || 'Team 1').trim();
  if (!t1Id && t1Name) {
    try {
      const { data: found } = await supabase
        .from('soccer_teams')
        .select('id')
        .ilike('name', t1Name)
        .limit(1);
      if (found && found.length > 0) {
        t1Id = found[0].id;
      } else {
        const { data: created } = await supabase
          .from('soccer_teams')
          .insert({ id: crypto.randomUUID(), name: t1Name })
          .select('id')
          .single();
        if (created) t1Id = created.id;
      }
    } catch (e) {
      console.warn('Could not auto-resolve team1_id:', e.message);
    }
  }

  // 2. Resolve team2_id
  let t2Id = (matchData.team2_id && isValidUUID(matchData.team2_id)) ? matchData.team2_id : null;
  const t2Name = (matchData.team2_name || 'Team 2').trim();
  if (!t2Id && t2Name) {
    try {
      const { data: found } = await supabase
        .from('soccer_teams')
        .select('id')
        .ilike('name', t2Name)
        .limit(1);
      if (found && found.length > 0) {
        t2Id = found[0].id;
      } else {
        const { data: created } = await supabase
          .from('soccer_teams')
          .insert({ id: crypto.randomUUID(), name: t2Name })
          .select('id')
          .single();
        if (created) t2Id = created.id;
      }
    } catch (e) {
      console.warn('Could not auto-resolve team2_id:', e.message);
    }
  }

  // 3. Strictly insert only the schema-defined columns of soccer_matches:
  //    (id, team1_id, team2_id, team1_goals, team2_goals, team1_penalties, team2_penalties, status, match_events, start_time)
  const payload = {
    id: matchId,
    team1_id: t1Id,
    team2_id: t2Id,
    team1_goals: 0,
    team2_goals: 0,
    team1_penalties: 0,
    team2_penalties: 0,
    status: 'ready',
    match_events: [{
      type: 'match_start',
      timestamp: new Date().toISOString(),
      details: 'Match started'
    }],
    start_time: matchData.startTime ? new Date(matchData.startTime).toISOString() : new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('soccer_matches')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('Supabase createMatch error (soccer_matches):', error.message);
    throw error;
  }

  return {
    match_id: data.id,
    id: data.id,
    team1_id: data.team1_id,
    team2_id: data.team2_id,
    team1_name: t1Name,
    team2_name: t2Name,
    team1_score: 0,
    team2_score: 0,
    team1_goals: 0,
    team2_goals: 0,
    team1_penalties: 0,
    team2_penalties: 0,
    status: data.status,
    events: data.match_events,
    match_events: data.match_events,
    startTime: data.start_time
  };
}

async function recordGoal(matchId, team, currentScore) {
  const current = await getMatchById(matchId);
  if (!current) return null;

  const isTeam1 = team === 'team1' || team === 'a';
  let t1Goals = current.team1_goals;
  let t2Goals = current.team2_goals;

  if (currentScore !== undefined) {
    if (isTeam1) t1Goals = Math.max(0, currentScore);
    else t2Goals = Math.max(0, currentScore);
  } else {
    if (isTeam1) t1Goals += 1;
    else t2Goals += 1;
  }

  const events = Array.isArray(current.events) ? [...current.events] : [];
  const eventRecord = {
    type: 'goal',
    team: isTeam1 ? 'team1' : 'team2',
    timestamp: new Date().toISOString(),
    team1_score: t1Goals,
    team2_score: t2Goals
  };
  events.push(eventRecord);

  const { data, error } = await supabase
    .from('soccer_matches')
    .update({
      team1_goals: t1Goals,
      team2_goals: t2Goals,
      match_events: events,
      status: 'live'
    })
    .eq('id', matchId)
    .select()
    .single();

  if (error) {
    console.error('Supabase recordGoal error (soccer_matches):', error.message);
    throw error;
  }

  return { match: data, event: eventRecord };
}

async function recordPenalty(matchId, team, delta = 1) {
  const current = await getMatchById(matchId);
  if (!current) return null;

  const isTeam1 = team === 'team1' || team === 'a';
  let t1Pen = current.team1_penalties;
  let t2Pen = current.team2_penalties;

  if (isTeam1) t1Pen = Math.max(0, t1Pen + delta);
  else t2Pen = Math.max(0, t2Pen + delta);

  const events = Array.isArray(current.events) ? [...current.events] : [];
  const eventRecord = {
    type: 'penalty',
    team: isTeam1 ? 'team1' : 'team2',
    delta,
    timestamp: new Date().toISOString(),
    team1_penalties: t1Pen,
    team2_penalties: t2Pen
  };
  events.push(eventRecord);

  const { data, error } = await supabase
    .from('soccer_matches')
    .update({
      team1_penalties: t1Pen,
      team2_penalties: t2Pen,
      match_events: events
    })
    .eq('id', matchId)
    .select()
    .single();

  if (error) {
    console.error('Supabase recordPenalty error (soccer_matches):', error.message);
    throw error;
  }

  return { match: data, event: eventRecord };
}

async function updateScoreDelta(matchId, team, delta, newScore) {
  const current = await getMatchById(matchId);
  if (!current) return null;

  const isTeam1 = team === 'team1' || team === 'a';
  let t1Goals = current.team1_goals;
  let t2Goals = current.team2_goals;

  if (newScore !== undefined) {
    if (isTeam1) t1Goals = Math.max(0, newScore);
    else t2Goals = Math.max(0, newScore);
  } else {
    if (isTeam1) t1Goals = Math.max(0, t1Goals + delta);
    else t2Goals = Math.max(0, t2Goals + delta);
  }

  const events = Array.isArray(current.events) ? [...current.events] : [];
  const eventRecord = {
    type: delta > 0 ? 'goal' : 'score_correction',
    team: isTeam1 ? 'team1' : 'team2',
    delta,
    timestamp: new Date().toISOString(),
    team1_score: t1Goals,
    team2_score: t2Goals
  };
  events.push(eventRecord);

  const { data, error } = await supabase
    .from('soccer_matches')
    .update({
      team1_goals: t1Goals,
      team2_goals: t2Goals,
      match_events: events
    })
    .eq('id', matchId)
    .select()
    .single();

  if (error) {
    console.error('Supabase updateScoreDelta error (soccer_matches):', error.message);
    throw error;
  }

  return { match: data, event: eventRecord };
}

async function endMatch(matchId) {
  let targetId = matchId;
  if (!targetId) {
    const cur = await getCurrentMatch();
    if (cur) targetId = cur.id;
  }
  if (!targetId || !isValidUUID(targetId)) return null;

  const current = await getMatchById(targetId);
  if (!current) return null;

  const endTime = new Date().toISOString();
  const events = Array.isArray(current.events) ? [...current.events] : [];
  events.push({
    type: 'match_completed',
    timestamp: endTime,
    final_score: { team1: current.team1_goals, team2: current.team2_goals },
    penalties: { team1: current.team1_penalties, team2: current.team2_penalties }
  });

  const { data: updatedMatch, error } = await supabase
    .from('soccer_matches')
    .update({
      status: 'ended',
      end_time: endTime,
      match_events: events
    })
    .eq('id', targetId)
    .select()
    .single();

  if (error) {
    console.error('Supabase endMatch error (soccer_matches):', error.message);
    throw error;
  }

  await updateTeamStandingsAfterMatch(current);
  return updatedMatch;
}

async function updateTeamStandingsAfterMatch(match) {
  const team1Goals = match.team1_goals || match.team1_score || 0;
  const team2Goals = match.team2_goals || match.team2_score || 0;

  const team1Won = team1Goals > team2Goals;
  const team2Won = team2Goals > team1Goals;
  const isDraw = team1Goals === team2Goals;

  const team1PointsDelta = team1Won ? 2 : isDraw ? 1 : 0;
  const team2PointsDelta = team2Won ? 2 : isDraw ? 1 : 0;

  const updateTeamStats = async (teamId, goals, won, lost, points) => {
    if (!teamId || !isValidUUID(teamId)) return;
    const { data: team } = await supabase.from('soccer_teams').select('*').eq('id', teamId).single();
    if (team) {
      await supabase.from('soccer_teams').update({
        goals_scored: (team.goals_scored || 0) + goals,
        wins: (team.wins || 0) + (won ? 1 : 0),
        losses: (team.losses || 0) + (lost ? 1 : 0),
        points: (team.points || 0) + points
      }).eq('id', teamId);
    }
  };

  await updateTeamStats(match.team1_id, team1Goals, team1Won, team2Won, team1PointsDelta);
  await updateTeamStats(match.team2_id, team2Goals, team2Won, team1Won, team2PointsDelta);
}

async function getLeaderboard() {
  const teams = await getTeams();
  const matches = await getMatches();

  const stats = {};
  teams.forEach(t => {
    stats[t.id] = {
      id: t.id,
      name: t.name || t.teamName,
      teamName: t.teamName || t.name,
      logo: t.logo,
      student1: t.student1,
      student2: t.student2,
      played: 0,
      won: 0,
      lost: 0,
      drawn: 0,
      goals_scored: 0,
      penalties: 0,
      points: 0
    };
  });

  matches.forEach(m => {
    if (m.status !== 'completed' && m.status !== 'ended') return;

    const t1Id = m.team1_id;
    const t2Id = m.team2_id;
    const t1Goals = parseInt(m.team1_goals || m.team1_score) || 0;
    const t2Goals = parseInt(m.team2_goals || m.team2_score) || 0;
    const t1Pen = parseInt(m.team1_penalties) || 0;
    const t2Pen = parseInt(m.team2_penalties) || 0;

    if (stats[t1Id]) {
      stats[t1Id].played += 1;
      stats[t1Id].goals_scored += t1Goals;
      stats[t1Id].penalties += t1Pen;
      if (t1Goals > t2Goals) {
        stats[t1Id].won += 1;
        stats[t1Id].points += 2;
      } else if (t1Goals < t2Goals) {
        stats[t1Id].lost += 1;
      } else {
        stats[t1Id].drawn += 1;
        stats[t1Id].points += 1;
      }
    }

    if (stats[t2Id]) {
      stats[t2Id].played += 1;
      stats[t2Id].goals_scored += t2Goals;
      stats[t2Id].penalties += t2Pen;
      if (t2Goals > t1Goals) {
        stats[t2Id].won += 1;
        stats[t2Id].points += 2;
      } else if (t2Goals < t1Goals) {
        stats[t2Id].lost += 1;
      } else {
        stats[t2Id].drawn += 1;
        stats[t2Id].points += 1;
      }
    }
  });

  const sorted = Object.values(stats).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goals_scored !== a.goals_scored) return b.goals_scored - a.goals_scored;
    if (b.won !== a.won) return b.won - a.won;
    return a.penalties - b.penalties;
  });

  return sorted.map((team, idx) => ({
    rank: idx + 1,
    ...team
  }));
}

// ════════════════════════════════════════════════════════════════════
// ── BALLOON GAME (Tables: balloon_players, balloon_matches) ─────────
// ════════════════════════════════════════════════════════════════════

async function getBalloonPlayers() {
  const { data, error } = await supabase
    .from('balloon_players')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Supabase getBalloonPlayers error:', error.message);
    throw error;
  }
  return data || [];
}

async function saveBalloonPlayer(player) {
  const id = ensureUUID(player.id);
  const payload = {
    id,
    name: player.name,
    grade: player.grade || '',
    group: player.group || '',
    city: player.city || '',
    avatar: player.avatar || '🎈',
    balloons_lost: player.balloons_lost || 0,
    created_at: new Date().toISOString()
  };
  const { data, error } = await supabase.from('balloon_players').insert(payload).select().single();
  if (error) {
    console.error('Supabase saveBalloonPlayer error:', error.message);
    throw error;
  }
  return data;
}

async function updateBalloonPlayer(id, updateData) {
  if (!isValidUUID(id)) return null;
  const { data, error } = await supabase
    .from('balloon_players')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('Supabase updateBalloonPlayer error:', error.message);
    throw error;
  }
  return data;
}

async function deleteBalloonPlayer(id) {
  if (!isValidUUID(id)) return false;
  const { error } = await supabase.from('balloon_players').delete().eq('id', id);
  if (error) {
    console.error('Supabase deleteBalloonPlayer error:', error.message);
    throw error;
  }
  return true;
}

async function getBalloonMatches() {
  const { data, error } = await supabase
    .from('balloon_matches')
    .select('*')
    .order('start_time', { ascending: false });
  if (error) {
    console.error('Supabase getBalloonMatches error:', error.message);
    throw error;
  }
  return (data || []).map(m => ({
    id: m.id,
    playerIds: m.player_ids,
    players: m.players || [],
    scores: m.scores || {},
    status: m.status,
    duration: m.duration || 360,
    events: m.match_events || [],
    startTime: m.start_time,
    endTime: m.end_time
  }));
}

async function createBalloonMatch(match) {
  const matchId = ensureUUID(match.id);
  const pIds = (match.playerIds || match.player_ids || []).map(ensureUUID);
  const payload = {
    id: matchId,
    player_ids: pIds,
    scores: match.scores || {},
    status: 'ready',
    match_events: match.events || [],
    start_time: match.startTime ? new Date(match.startTime).toISOString() : new Date().toISOString()
  };
  const { data, error } = await supabase.from('balloon_matches').insert(payload).select().single();
  if (error) {
    console.error('Supabase createBalloonMatch error:', error.message);
    throw error;
  }
  return {
    ...data,
    playerIds: data.player_ids,
    players: match.players || [],
    duration: match.duration || 360
  };
}

async function updateBalloonMatch(id, updateData) {
  if (!isValidUUID(id)) return null;
  const payload = {};
  if (updateData.status) payload.status = updateData.status;
  if (updateData.scores) payload.scores = updateData.scores;
  if (updateData.events || updateData.match_events) payload.match_events = updateData.events || updateData.match_events;
  if (updateData.endTime) payload.end_time = new Date(updateData.endTime).toISOString();

  const { data, error } = await supabase.from('balloon_matches').update(payload).eq('id', id).select().single();
  if (error) {
    console.error('Supabase updateBalloonMatch error:', error.message);
    throw error;
  }
  return data;
}

// ════════════════════════════════════════════════════════════════════
// ── BATTLE BOTS (Tables: battlebots_players, battlebots_matches) ────
// ════════════════════════════════════════════════════════════════════

async function getBattleBotsPlayers() {
  const { data, error } = await supabase
    .from('battlebots_players')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Supabase getBattleBotsPlayers error:', error.message);
    throw error;
  }
  return data || [];
}

async function saveBattleBotsPlayer(player) {
  const id = ensureUUID(player.id);
  const payload = {
    id,
    name: player.name,
    grade: player.grade || '',
    group: player.group || '',
    city: player.city || '',
    avatar: player.avatar || '🤖',
    falls: player.falls || 0,
    created_at: new Date().toISOString()
  };
  const { data, error } = await supabase.from('battlebots_players').insert(payload).select().single();
  if (error) {
    console.error('Supabase saveBattleBotsPlayer error:', error.message);
    throw error;
  }
  return data;
}

async function updateBattleBotsPlayer(id, updateData) {
  if (!isValidUUID(id)) return null;
  const { data, error } = await supabase
    .from('battlebots_players')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('Supabase updateBattleBotsPlayer error:', error.message);
    throw error;
  }
  return data;
}

async function deleteBattleBotsPlayer(id) {
  if (!isValidUUID(id)) return false;
  const { error } = await supabase.from('battlebots_players').delete().eq('id', id);
  if (error) {
    console.error('Supabase deleteBattleBotsPlayer error:', error.message);
    throw error;
  }
  return true;
}

async function getBattleBotsMatches() {
  const { data, error } = await supabase
    .from('battlebots_matches')
    .select('*')
    .order('start_time', { ascending: false });
  if (error) {
    console.error('Supabase getBattleBotsMatches error:', error.message);
    throw error;
  }
  return (data || []).map(m => ({
    id: m.id,
    playerIds: m.player_ids,
    players: m.players || [],
    scores: m.scores || {},
    status: m.status,
    duration: m.duration || 600,
    events: m.match_events || [],
    startTime: m.start_time,
    endTime: m.end_time
  }));
}

async function createBattleBotsMatch(match) {
  const matchId = ensureUUID(match.id);
  const pIds = (match.playerIds || match.player_ids || []).map(ensureUUID);
  const payload = {
    id: matchId,
    player_ids: pIds,
    scores: match.scores || {},
    status: 'ready',
    match_events: match.events || [],
    start_time: match.startTime ? new Date(match.startTime).toISOString() : new Date().toISOString()
  };
  const { data, error } = await supabase.from('battlebots_matches').insert(payload).select().single();
  if (error) {
    console.error('Supabase createBattleBotsMatch error:', error.message);
    throw error;
  }
  return {
    ...data,
    playerIds: data.player_ids,
    players: match.players || [],
    duration: match.duration || 600
  };
}

async function updateBattleBotsMatch(id, updateData) {
  if (!isValidUUID(id)) return null;
  const payload = {};
  if (updateData.status) payload.status = updateData.status;
  if (updateData.scores) payload.scores = updateData.scores;
  if (updateData.events || updateData.match_events) payload.match_events = updateData.events || updateData.match_events;
  if (updateData.endTime) payload.end_time = new Date(updateData.endTime).toISOString();

  const { data, error } = await supabase.from('battlebots_matches').update(payload).eq('id', id).select().single();
  if (error) {
    console.error('Supabase updateBattleBotsMatch error:', error.message);
    throw error;
  }
  return data;
}

// ════════════════════════════════════════════════════════════════════
// ── DRONE GAME (Tables: drone_players, drone_matches) ───────────────
// ════════════════════════════════════════════════════════════════════

async function getDronePlayers() {
  const { data, error } = await supabase
    .from('drone_players')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Supabase getDronePlayers error:', error.message);
    throw error;
  }
  return data || [];
}

async function saveDronePlayer(player) {
  const id = ensureUUID(player.id);
  const payload = {
    id,
    name: player.name,
    grade: player.grade || '',
    group: player.group || '',
    city: player.city || '',
    avatar: player.avatar || '🛸',
    created_at: new Date().toISOString()
  };
  const { data, error } = await supabase.from('drone_players').insert(payload).select().single();
  if (error) {
    console.error('Supabase saveDronePlayer error:', error.message);
    throw error;
  }
  return data;
}

async function updateDronePlayer(id, updateData) {
  if (!isValidUUID(id)) return null;
  const { data, error } = await supabase
    .from('drone_players')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    console.error('Supabase updateDronePlayer error:', error.message);
    throw error;
  }
  return data;
}

async function deleteDronePlayer(id) {
  if (!isValidUUID(id)) return false;
  const { error } = await supabase.from('drone_players').delete().eq('id', id);
  if (error) {
    console.error('Supabase deleteDronePlayer error:', error.message);
    throw error;
  }
  return true;
}

async function getDroneMatches() {
  const { data, error } = await supabase
    .from('drone_matches')
    .select('*')
    .order('start_time', { ascending: false });
  if (error) {
    console.error('Supabase getDroneMatches error:', error.message);
    throw error;
  }
  return (data || []).map(m => ({
    id: m.id,
    playerIds: m.player_ids,
    players: m.players || [],
    scores: m.scores || {},
    status: m.status,
    duration: m.duration || 300,
    events: m.match_events || [],
    startTime: m.start_time,
    endTime: m.end_time
  }));
}

async function createDroneMatch(match) {
  const matchId = ensureUUID(match.id);
  const pIds = (match.playerIds || match.player_ids || []).map(ensureUUID);
  const payload = {
    id: matchId,
    player_ids: pIds,
    scores: match.scores || {},
    status: 'ready',
    match_events: match.events || [],
    start_time: match.startTime ? new Date(match.startTime).toISOString() : new Date().toISOString()
  };
  const { data, error } = await supabase.from('drone_matches').insert(payload).select().single();
  if (error) {
    console.error('Supabase createDroneMatch error:', error.message);
    throw error;
  }
  return {
    ...data,
    playerIds: data.player_ids,
    players: match.players || [],
    duration: match.duration || 300
  };
}

async function updateDroneMatch(id, updateData) {
  if (!isValidUUID(id)) return null;
  const payload = {};
  if (updateData.status) payload.status = updateData.status;
  if (updateData.scores) payload.scores = updateData.scores;
  if (updateData.events || updateData.match_events) payload.match_events = updateData.events || updateData.match_events;
  if (updateData.endTime) payload.end_time = new Date(updateData.endTime).toISOString();

  const { data, error } = await supabase.from('drone_matches').update(payload).eq('id', id).select().single();
  if (error) {
    console.error('Supabase updateDroneMatch error:', error.message);
    throw error;
  }
  return data;
}

module.exports = {
  supabase,
  // Soccer
  getTeams,
  getTeamById,
  saveTeam,
  updateTeam,
  deleteTeam,
  getMatches,
  getMatchById,
  getCurrentMatch,
  createMatch,
  recordGoal,
  recordPenalty,
  updateScoreDelta,
  endMatch,
  getLeaderboard,
  // Balloon
  getBalloonPlayers,
  saveBalloonPlayer,
  updateBalloonPlayer,
  deleteBalloonPlayer,
  getBalloonMatches,
  createBalloonMatch,
  updateBalloonMatch,
  // Battle Bots
  getBattleBotsPlayers,
  saveBattleBotsPlayer,
  updateBattleBotsPlayer,
  deleteBattleBotsPlayer,
  getBattleBotsMatches,
  createBattleBotsMatch,
  updateBattleBotsMatch,
  // Drone
  getDronePlayers,
  saveDronePlayer,
  updateDronePlayer,
  deleteDronePlayer,
  getDroneMatches,
  createDroneMatch,
  updateDroneMatch
};
