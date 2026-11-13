-- ====================================================================
-- MULTI-GAME SCOREBOARD: SUPABASE COMPLETE DATABASE SCHEMA
-- Run this script in the Supabase SQL Editor to set up all tables.
-- ====================================================================

-- ── 1. ROBOT SOCCER (soccer_teams & soccer_matches) ──────────────────

-- 1.1 Soccer Teams table
CREATE TABLE IF NOT EXISTS public.soccer_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    team_name TEXT,
    logo TEXT,
    points INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    goals_scored INTEGER DEFAULT 0,
    student1 JSONB DEFAULT '{}'::jsonb,
    student2 JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.soccer_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all on soccer_teams" ON public.soccer_teams;
CREATE POLICY "Allow public all on soccer_teams" ON public.soccer_teams FOR ALL USING (true) WITH CHECK (true);

-- 1.2 Soccer Matches table
CREATE TABLE IF NOT EXISTS public.soccer_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team1_id UUID REFERENCES public.soccer_teams(id) ON DELETE SET NULL,
    team2_id UUID REFERENCES public.soccer_teams(id) ON DELETE SET NULL,
    team1_name TEXT,
    team2_name TEXT,
    team1_goals INTEGER DEFAULT 0,
    team2_goals INTEGER DEFAULT 0,
    team1_penalties INTEGER DEFAULT 0,
    team2_penalties INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ready',
    match_events JSONB DEFAULT '[]'::jsonb,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.soccer_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all on soccer_matches" ON public.soccer_matches;
CREATE POLICY "Allow public all on soccer_matches" ON public.soccer_matches FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_soccer_teams_points ON public.soccer_teams (points DESC, goals_scored DESC);
CREATE INDEX IF NOT EXISTS idx_soccer_matches_status ON public.soccer_matches (status);


-- ── 2. BALLOON POPPING GAME ──────────────────────────────────────────

-- 2.1 Players table
CREATE TABLE IF NOT EXISTS public.balloon_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    grade TEXT,
    "group" TEXT,
    city TEXT,
    avatar TEXT,
    balloons_lost INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.balloon_players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all on balloon_players" ON public.balloon_players;
CREATE POLICY "Allow public all on balloon_players" ON public.balloon_players FOR ALL USING (true) WITH CHECK (true);

-- 2.2 Matches table
CREATE TABLE IF NOT EXISTS public.balloon_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_ids UUID[] DEFAULT '{}'::UUID[],
    players JSONB DEFAULT '[]'::jsonb,
    scores JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'ready',
    duration INTEGER DEFAULT 360,
    match_events JSONB DEFAULT '[]'::jsonb,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.balloon_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all on balloon_matches" ON public.balloon_matches;
CREATE POLICY "Allow public all on balloon_matches" ON public.balloon_matches FOR ALL USING (true) WITH CHECK (true);


-- ── 3. BATTLE BOTS (SUMO) ────────────────────────────────────────────

-- 3.1 Players table
CREATE TABLE IF NOT EXISTS public.battlebots_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    grade TEXT,
    "group" TEXT,
    city TEXT,
    avatar TEXT,
    falls INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.battlebots_players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all on battlebots_players" ON public.battlebots_players;
CREATE POLICY "Allow public all on battlebots_players" ON public.battlebots_players FOR ALL USING (true) WITH CHECK (true);

-- 3.2 Matches table
CREATE TABLE IF NOT EXISTS public.battlebots_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_ids UUID[] DEFAULT '{}'::UUID[],
    players JSONB DEFAULT '[]'::jsonb,
    scores JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'ready',
    duration INTEGER DEFAULT 600,
    match_events JSONB DEFAULT '[]'::jsonb,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.battlebots_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all on battlebots_matches" ON public.battlebots_matches;
CREATE POLICY "Allow public all on battlebots_matches" ON public.battlebots_matches FOR ALL USING (true) WITH CHECK (true);


-- ── 4. DRONE RACING GAME ─────────────────────────────────────────────

-- 4.1 Players table
CREATE TABLE IF NOT EXISTS public.drone_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    grade TEXT,
    "group" TEXT,
    city TEXT,
    avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.drone_players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all on drone_players" ON public.drone_players;
CREATE POLICY "Allow public all on drone_players" ON public.drone_players FOR ALL USING (true) WITH CHECK (true);

-- 4.2 Matches table
CREATE TABLE IF NOT EXISTS public.drone_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_ids UUID[] DEFAULT '{}'::UUID[],
    players JSONB DEFAULT '[]'::jsonb,
    scores JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'ready',
    duration INTEGER DEFAULT 300,
    match_events JSONB DEFAULT '[]'::jsonb,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.drone_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all on drone_matches" ON public.drone_matches;
CREATE POLICY "Allow public all on drone_matches" ON public.drone_matches FOR ALL USING (true) WITH CHECK (true);
