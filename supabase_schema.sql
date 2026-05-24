-- ═══════════════════════════════════════════════════════
-- OutboundAI — Complete Database Schema
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    service TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'booked',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS call_logs (
    id TEXT PRIMARY KEY,
    phone_number TEXT NOT NULL,
    lead_name TEXT,
    outcome TEXT,
    reason TEXT,
    duration_seconds INTEGER,
    timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS error_logs (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'error',
    message TEXT NOT NULL,
    detail TEXT,
    timestamp TEXT NOT NULL
);

ALTER TABLE appointments  DISABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs     DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings      DISABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs    DISABLE ROW LEVEL SECURITY;

ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    contacts_json TEXT NOT NULL DEFAULT '[]',
    schedule_type TEXT NOT NULL DEFAULT 'once',
    schedule_time TEXT DEFAULT '09:00',
    call_delay_seconds INTEGER DEFAULT 3,
    system_prompt TEXT,
    created_at TEXT NOT NULL,
    last_run_at TEXT,
    total_dispatched INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0
);
ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS calcom_booking_uid TEXT;

CREATE TABLE IF NOT EXISTS contact_memory (
    id TEXT PRIMARY KEY,
    phone_number TEXT NOT NULL,
    insight TEXT NOT NULL,
    created_at TEXT NOT NULL
);
ALTER TABLE contact_memory DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_contact_memory_phone ON contact_memory (phone_number);

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS agent_profile_id TEXT;

CREATE TABLE IF NOT EXISTS agent_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    voice TEXT NOT NULL DEFAULT 'Aoede',
    model TEXT NOT NULL DEFAULT 'gemini-3.1-flash-live-preview',
    system_prompt TEXT,
    enabled_tools TEXT DEFAULT '[]',
    is_default INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
);
ALTER TABLE agent_profiles DISABLE ROW LEVEL SECURITY;

ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS conversation_initiation TEXT DEFAULT 'agent';
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS first_message TEXT;
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS channel_mode TEXT DEFAULT 'voice';
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS voice_prompt_override TEXT;
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS text_prompt_override TEXT;
ALTER TABLE agent_profiles ADD COLUMN IF NOT EXISTS knowledge_confidence_threshold REAL DEFAULT 0.55;

CREATE TABLE IF NOT EXISTS knowledge_bases (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
ALTER TABLE knowledge_bases DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS knowledge_entries (
    id TEXT PRIMARY KEY,
    knowledge_base_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'business_info',
    category TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active',
    source_type TEXT DEFAULT 'manual',
    source_file_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
ALTER TABLE knowledge_entries DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_kb ON knowledge_entries (knowledge_base_id);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id TEXT PRIMARY KEY,
    knowledge_entry_id TEXT NOT NULL,
    knowledge_base_id TEXT NOT NULL,
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER DEFAULT 0,
    token_count INTEGER DEFAULT 0,
    embedding TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL
);
ALTER TABLE knowledge_chunks DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_kb ON knowledge_chunks (knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_entry ON knowledge_chunks (knowledge_entry_id);

CREATE TABLE IF NOT EXISTS agent_knowledge_bases (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    knowledge_base_id TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 1,
    created_at TEXT NOT NULL
);
ALTER TABLE agent_knowledge_bases DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_agent_kb_agent ON agent_knowledge_bases (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_kb_kb ON agent_knowledge_bases (knowledge_base_id);
