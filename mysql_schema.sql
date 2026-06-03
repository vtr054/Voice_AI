-- ═══════════════════════════════════════════════════════
-- OutboundAI — Complete MySQL Database Schema
-- ═══════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS appointments (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(255) NOT NULL,
    date VARCHAR(255) NOT NULL,
    time VARCHAR(255) NOT NULL,
    service VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'booked',
    created_at VARCHAR(255) NOT NULL,
    calcom_booking_uid VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS call_logs (
    id VARCHAR(255) PRIMARY KEY,
    phone_number VARCHAR(255) NOT NULL,
    lead_name VARCHAR(255),
    outcome VARCHAR(255),
    reason VARCHAR(255),
    duration_seconds INT,
    timestamp VARCHAR(255) NOT NULL,
    recording_url TEXT,
    notes TEXT,
    direction VARCHAR(255) DEFAULT 'outbound',
    transcript TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS settings (
    `key` VARCHAR(255) PRIMARY KEY,
    `value` TEXT NOT NULL,
    updated_at VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS error_logs (
    id VARCHAR(255) PRIMARY KEY,
    source VARCHAR(255) NOT NULL,
    level VARCHAR(255) NOT NULL DEFAULT 'error',
    message TEXT NOT NULL,
    detail TEXT,
    timestamp VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS campaigns (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'active',
    contacts_json TEXT NOT NULL,
    schedule_type VARCHAR(255) NOT NULL DEFAULT 'once',
    schedule_time VARCHAR(255) DEFAULT '09:00',
    call_delay_seconds INT DEFAULT 3,
    system_prompt TEXT,
    created_at VARCHAR(255) NOT NULL,
    last_run_at VARCHAR(255),
    total_dispatched INT DEFAULT 0,
    total_failed INT DEFAULT 0,
    agent_profile_id VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contact_memory (
    id VARCHAR(255) PRIMARY KEY,
    phone_number VARCHAR(255) NOT NULL,
    insight TEXT NOT NULL,
    created_at VARCHAR(255) NOT NULL,
    KEY idx_contact_memory_phone (phone_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_profiles (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    voice VARCHAR(255) NOT NULL DEFAULT 'Aoede',
    model VARCHAR(255) NOT NULL DEFAULT 'gemini-3.1-flash-live-preview',
    system_prompt TEXT,
    enabled_tools TEXT,
    is_default INT DEFAULT 0,
    created_at VARCHAR(255) NOT NULL,
    conversation_initiation VARCHAR(255) DEFAULT 'agent',
    first_message TEXT,
    channel_mode VARCHAR(255) DEFAULT 'voice',
    voice_prompt_override TEXT,
    text_prompt_override TEXT,
    knowledge_confidence_threshold DOUBLE DEFAULT 0.55
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS knowledge_bases (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(255) NOT NULL DEFAULT 'active',
    created_at VARCHAR(255) NOT NULL,
    updated_at VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS knowledge_entries (
    id VARCHAR(255) PRIMARY KEY,
    knowledge_base_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(255) DEFAULT 'business_info',
    category VARCHAR(255) DEFAULT '',
    tags TEXT,
    status VARCHAR(255) NOT NULL DEFAULT 'active',
    source_type VARCHAR(255) DEFAULT 'manual',
    source_file_id VARCHAR(255),
    created_at VARCHAR(255) NOT NULL,
    updated_at VARCHAR(255) NOT NULL,
    KEY idx_knowledge_entries_kb (knowledge_base_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id VARCHAR(255) PRIMARY KEY,
    knowledge_entry_id VARCHAR(255) NOT NULL,
    knowledge_base_id VARCHAR(255) NOT NULL,
    chunk_text TEXT NOT NULL,
    chunk_index INT DEFAULT 0,
    token_count INT DEFAULT 0,
    embedding TEXT,
    metadata TEXT,
    created_at VARCHAR(255) NOT NULL,
    KEY idx_knowledge_chunks_kb (knowledge_base_id),
    KEY idx_knowledge_chunks_entry (knowledge_entry_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS agent_knowledge_bases (
    id VARCHAR(255) PRIMARY KEY,
    agent_id VARCHAR(255) NOT NULL,
    knowledge_base_id VARCHAR(255) NOT NULL,
    priority INT DEFAULT 0,
    enabled INT DEFAULT 1,
    created_at VARCHAR(255) NOT NULL,
    KEY idx_agent_kb_agent (agent_id),
    KEY idx_agent_kb_kb (knowledge_base_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS call_recordings (
    call_id VARCHAR(255) PRIMARY KEY,
    audio_data LONGBLOB NOT NULL,
    filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(255) NOT NULL,
    created_at VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
