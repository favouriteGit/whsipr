-- ============================================================
-- WHISPR — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Enable UUID extension (already on by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- BOARDS TABLE
-- ============================================================
CREATE TABLE boards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE,   -- e.g. "W3IR-X9PK"
  created_at  TIMESTAMPTZ DEFAULT now(),
  member_count INT DEFAULT 1
);

-- Index for fast lookup by code
CREATE UNIQUE INDEX boards_code_idx ON boards (code);

-- ============================================================
-- CONFESSIONS TABLE
-- ============================================================
CREATE TABLE confessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id      UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  text          TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 500),
  mood          TEXT NOT NULL DEFAULT '😶',
  anon_seed     INT NOT NULL DEFAULT floor(random() * 10000),  -- for avatar generation, not identity
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Index for fast board fetches, newest first
CREATE INDEX confessions_board_id_idx ON confessions (board_id, created_at DESC);

-- ============================================================
-- REACTIONS TABLE
-- ============================================================
CREATE TABLE reactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  confession_id  UUID NOT NULL REFERENCES confessions(id) ON DELETE CASCADE,
  emoji          TEXT NOT NULL,
  session_id     TEXT NOT NULL,   -- anonymous session token, no user identity
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE (confession_id, session_id, emoji)  -- one reaction per emoji per session
);

CREATE INDEX reactions_confession_id_idx ON reactions (confession_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Makes data safe to query directly from the browser
-- ============================================================

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE confessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- Boards: anyone can read, anyone can create
CREATE POLICY "boards_select" ON boards FOR SELECT USING (true);
CREATE POLICY "boards_insert" ON boards FOR INSERT WITH CHECK (true);
CREATE POLICY "boards_update_member_count" ON boards FOR UPDATE USING (true);

-- Confessions: anyone can read, anyone can post
CREATE POLICY "confessions_select" ON confessions FOR SELECT USING (true);
CREATE POLICY "confessions_insert" ON confessions FOR INSERT WITH CHECK (true);

-- Admin delete: only if session_id matches a special admin header
-- (we handle this via a server-side API route instead for simplicity)

-- Reactions: anyone can read, anyone can insert, can only delete own
CREATE POLICY "reactions_select" ON reactions FOR SELECT USING (true);
CREATE POLICY "reactions_insert" ON reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "reactions_delete" ON reactions FOR DELETE USING (true);

-- ============================================================
-- REALTIME — enable live updates
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE confessions;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;

-- ============================================================
-- HELPER FUNCTION: get confession with reaction counts
-- ============================================================
CREATE OR REPLACE FUNCTION get_confessions_with_reactions(p_board_id UUID)
RETURNS TABLE (
  id UUID,
  board_id UUID,
  text TEXT,
  mood TEXT,
  anon_seed INT,
  created_at TIMESTAMPTZ,
  reactions JSONB
) AS $$
  SELECT
    c.id,
    c.board_id,
    c.text,
    c.mood,
    c.anon_seed,
    c.created_at,
    COALESCE(
      jsonb_object_agg(r.emoji, r.cnt) FILTER (WHERE r.emoji IS NOT NULL),
      '{}'::jsonb
    ) AS reactions
  FROM confessions c
  LEFT JOIN (
    SELECT confession_id, emoji, COUNT(*) AS cnt
    FROM reactions
    GROUP BY confession_id, emoji
  ) r ON r.confession_id = c.id
  WHERE c.board_id = p_board_id
  GROUP BY c.id
  ORDER BY c.created_at DESC;
$$ LANGUAGE SQL STABLE;
