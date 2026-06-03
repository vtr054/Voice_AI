import json
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional
from collections import defaultdict

# ---------------------------------------------------------------------------
# DEFAULTS — loaded from environment variables and settings.
# ---------------------------------------------------------------------------
DEFAULTS = {
    "LIVEKIT_URL":             os.getenv("LIVEKIT_URL", ""),
    "LIVEKIT_API_KEY":         os.getenv("LIVEKIT_API_KEY", ""),
    "LIVEKIT_API_SECRET":      os.getenv("LIVEKIT_API_SECRET", ""),
    "GOOGLE_API_KEY":          os.getenv("GOOGLE_API_KEY", ""),
    "GEMINI_MODEL":            os.getenv("GEMINI_MODEL", "gemini-3.1-flash-live-preview"),
    "GEMINI_TTS_VOICE":        os.getenv("GEMINI_TTS_VOICE", "Aoede"),
    "USE_GEMINI_REALTIME":     os.getenv("USE_GEMINI_REALTIME", "true"),
    "VOBIZ_SIP_DOMAIN":        os.getenv("VOBIZ_SIP_DOMAIN", ""),
    "VOBIZ_USERNAME":          os.getenv("VOBIZ_USERNAME", ""),
    "VOBIZ_PASSWORD":          os.getenv("VOBIZ_PASSWORD", ""),
    "VOBIZ_OUTBOUND_NUMBER":   os.getenv("VOBIZ_OUTBOUND_NUMBER", ""),
    "OUTBOUND_TRUNK_ID":       os.getenv("OUTBOUND_TRUNK_ID", ""),
    "DEFAULT_TRANSFER_NUMBER": os.getenv("DEFAULT_TRANSFER_NUMBER", ""),
    "DEEPGRAM_API_KEY":        os.getenv("DEEPGRAM_API_KEY", ""),
    "ENABLE_INBOUND":          os.getenv("ENABLE_INBOUND", "true"),
    "ENABLE_OUTBOUND":         os.getenv("ENABLE_OUTBOUND", "true"),
    "MYSQL_HOST":              os.getenv("MYSQL_HOST", "localhost"),
    "MYSQL_PORT":              os.getenv("MYSQL_PORT", "3306"),
    "MYSQL_DATABASE":          os.getenv("MYSQL_DATABASE", "voice_ai"),
    "MYSQL_USER":              os.getenv("MYSQL_USER", "root"),
    "MYSQL_PASSWORD":          os.getenv("MYSQL_PASSWORD", ""),
}

def _default(key: str) -> str:
    return os.getenv(key, DEFAULTS.get(key, ""))

SENSITIVE_KEYS = {
    "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "GOOGLE_API_KEY",
    "VOBIZ_PASSWORD", "TWILIO_AUTH_TOKEN", "SUPABASE_SERVICE_KEY",
    "AWS_SECRET_ACCESS_KEY", "S3_SECRET_ACCESS_KEY", "CALCOM_API_KEY",
    "DEEPGRAM_API_KEY",
}

# ---------------------------------------------------------------------------
# MySQL Async Connection Pool & Query Helpers
# ---------------------------------------------------------------------------
import asyncio
import aiomysql

_pools = {}

async def _init_pool():
    global _pools
    loop = asyncio.get_running_loop()
    # Clean up closed loops to avoid reference accumulation
    for l in list(_pools.keys()):
        if l.is_closed():
            _pools.pop(l, None)
            
    if loop not in _pools:
        _pools[loop] = await aiomysql.create_pool(
            host=_default("MYSQL_HOST"),
            port=int(_default("MYSQL_PORT")),
            user=_default("MYSQL_USER"),
            password=_default("MYSQL_PASSWORD"),
            db=_default("MYSQL_DATABASE"),
            autocommit=True,
            cursorclass=aiomysql.DictCursor,
            loop=loop
        )
    return _pools[loop]

async def execute_query(query: str, args: tuple = ()) -> list:
    pool = await _init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, args)
            return await cur.fetchall()

async def execute_write(query: str, args: tuple = ()) -> int:
    pool = await _init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(query, args)
            return cur.rowcount

# ---------------------------------------------------------------------------
# Synchronous MySQL Schema Setup (Runs at startup)
# ---------------------------------------------------------------------------
def init_db() -> None:
    import pymysql
    try:
        conn = pymysql.connect(
            host=_default("MYSQL_HOST"),
            port=int(_default("MYSQL_PORT")),
            user=_default("MYSQL_USER"),
            password=_default("MYSQL_PASSWORD"),
            database=_default("MYSQL_DATABASE"),
            autocommit=True
        )
        with conn.cursor() as cur:
            try:
                cur.execute("SET GLOBAL max_allowed_packet=67108864;")
            except Exception as e:
                print(f"⚠️  Could not set global max_allowed_packet: {e}")
            cur.execute("""
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
            """)
            
            cur.execute("""
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
            """)
            try:
                cur.execute("ALTER TABLE call_logs ADD COLUMN transcript TEXT;")
            except Exception:
                pass

            cur.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                `key` VARCHAR(255) PRIMARY KEY,
                `value` TEXT NOT NULL,
                updated_at VARCHAR(255) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            cur.execute("""
            CREATE TABLE IF NOT EXISTS error_logs (
                id VARCHAR(255) PRIMARY KEY,
                source VARCHAR(255) NOT NULL,
                level VARCHAR(255) NOT NULL DEFAULT 'error',
                message TEXT NOT NULL,
                detail TEXT,
                timestamp VARCHAR(255) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            cur.execute("""
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
            """)

            cur.execute("""
            CREATE TABLE IF NOT EXISTS contact_memory (
                id VARCHAR(255) PRIMARY KEY,
                phone_number VARCHAR(255) NOT NULL,
                insight TEXT NOT NULL,
                created_at VARCHAR(255) NOT NULL,
                KEY idx_contact_memory_phone (phone_number)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            cur.execute("""
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
            """)

            cur.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_bases (
                id VARCHAR(255) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                status VARCHAR(255) NOT NULL DEFAULT 'active',
                created_at VARCHAR(255) NOT NULL,
                updated_at VARCHAR(255) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)

            cur.execute("""
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
            """)

            cur.execute("""
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
            """)

            cur.execute("""
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
            """)

            cur.execute("""
            CREATE TABLE IF NOT EXISTS call_recordings (
                call_id VARCHAR(255) PRIMARY KEY,
                audio_data LONGBLOB NOT NULL,
                filename VARCHAR(255) NOT NULL,
                mime_type VARCHAR(255) NOT NULL,
                created_at VARCHAR(255) NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """)
        conn.close()
        print("✅ MySQL connected and schema verified")
    except Exception as exc:
        print(f"⚠️  MySQL connection failed: {exc}")

def load_mysql_settings_to_env() -> None:
    """Load MySQL settings table into os.environ before worker starts."""
    import pymysql
    try:
        conn = pymysql.connect(
            host=_default("MYSQL_HOST"),
            port=int(_default("MYSQL_PORT")),
            user=_default("MYSQL_USER"),
            password=_default("MYSQL_PASSWORD"),
            database=_default("MYSQL_DATABASE"),
            autocommit=True
        )
        with conn.cursor() as cur:
            cur.execute("SHOW TABLES LIKE 'settings'")
            if cur.fetchone():
                cur.execute("SELECT `key`, `value` FROM settings")
                for row in cur.fetchall():
                    key, value = row[0], row[1]
                    if value is not None:
                        os.environ[key] = str(value)
        conn.close()
        print("✅ Settings loaded from MySQL database into environment.")
    except Exception as exc:
        print(f"⚠️  Could not load settings from MySQL: {exc}")

# ---------------------------------------------------------------------------
# Settings CRUD
# ---------------------------------------------------------------------------
async def get_all_settings() -> dict:
    rows = await execute_query("SELECT `key`, `value` FROM settings")
    KNOWN_KEYS = [
        "LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET",
        "GOOGLE_API_KEY", "GEMINI_MODEL", "GEMINI_TTS_VOICE", "USE_GEMINI_REALTIME",
        "VOBIZ_SIP_DOMAIN", "VOBIZ_USERNAME", "VOBIZ_PASSWORD",
        "VOBIZ_OUTBOUND_NUMBER", "OUTBOUND_TRUNK_ID", "INBOUND_TRUNK_ID", 
        "SIP_DISPATCH_RULE_ID", "ENABLE_INBOUND", "ENABLE_OUTBOUND", "INBOUND_GREETING",
        "DEFAULT_TRANSFER_NUMBER",
        "DEEPGRAM_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER",
        "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_ENDPOINT_URL", "S3_REGION", "S3_BUCKET",
        "CALCOM_API_KEY", "CALCOM_EVENT_TYPE_ID", "CALCOM_TIMEZONE",
        "ENABLED_TOOLS", "CONVERSATION_INITIATION",
    ]
    out: dict = {}
    for k in KNOWN_KEYS:
        env_val = _default(k)
        if k in SENSITIVE_KEYS:
            out[k] = {"value": "", "configured": bool(env_val)}
        else:
            out[k] = {"value": env_val, "configured": bool(env_val)}
    for row in rows:
        k, v = row["key"], row["value"]
        if k == "TEST_KEY":
            continue
        if k in SENSITIVE_KEYS:
            out[k] = {"value": "", "configured": bool(v)}
        else:
            out[k] = {"value": v, "configured": bool(v)}
    return out

async def save_settings(data: dict) -> None:
    updated_at = datetime.now().isoformat()
    for k, v in data.items():
        if v is not None and v != "":
            await execute_write(
                "INSERT INTO settings (`key`, `value`, `updated_at`) VALUES (%s, %s, %s) "
                "ON DUPLICATE KEY UPDATE `value`=%s, `updated_at`=%s",
                (k, str(v), updated_at, str(v), updated_at)
            )

async def get_setting(key: str, default: str = "") -> str:
    rows = await execute_query("SELECT `value` FROM settings WHERE `key`=%s", (key,))
    if rows:
        return rows[0]["value"]
    return _default(key) or default

async def set_setting(key: str, value: str) -> None:
    updated_at = datetime.now().isoformat()
    await execute_write(
        "INSERT INTO settings (`key`, `value`, `updated_at`) VALUES (%s, %s, %s) "
        "ON DUPLICATE KEY UPDATE `value`=%s, `updated_at`=%s",
        (key, value, updated_at, value, updated_at)
    )

async def get_enabled_tools() -> list:
    raw = await get_setting("ENABLED_TOOLS", "")
    if not raw:
        return []
    try:
        result = json.loads(raw)
        return result if isinstance(result, list) else []
    except Exception:
        return []

# ---------------------------------------------------------------------------
# Text Chunking Helpers
# ---------------------------------------------------------------------------
def chunk_text(text: str, max_chars: int = 900) -> list:
    clean = " ".join((text or "").split())
    if not clean:
        return []
    chunks = []
    start = 0
    while start < len(clean):
        end = min(start + max_chars, len(clean))
        if end < len(clean):
            boundary = max(clean.rfind(". ", start, end), clean.rfind("\n", start, end))
            if boundary > start + 250:
                end = boundary + 1
        chunks.append(clean[start:end].strip())
        start = end
    return [c for c in chunks if c]

def _score_text(query: str, text: str) -> float:
    q_terms = {t.lower().strip(".,!?;:()[]{}") for t in query.split() if len(t.strip()) > 2}
    if not q_terms:
        return 0.0
    haystack = (text or "").lower()
    hits = sum(1 for term in q_terms if term in haystack)
    return round(hits / max(len(q_terms), 1), 3)

# ---------------------------------------------------------------------------
# Knowledge Base CRUD
# ---------------------------------------------------------------------------
async def get_knowledge_bases() -> list:
    return await execute_query("SELECT * FROM knowledge_bases ORDER BY created_at DESC")

async def get_knowledge_base(kb_id: str) -> Optional[dict]:
    rows = await execute_query("SELECT * FROM knowledge_bases WHERE id=%s", (kb_id,))
    return rows[0] if rows else None

async def create_knowledge_base(name: str, description: str = "") -> str:
    kb_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    await execute_write(
        "INSERT INTO knowledge_bases (id, name, description, status, created_at, updated_at) VALUES (%s, %s, %s, %s, %s, %s)",
        (kb_id, name, description, "active", now, now)
    )
    return kb_id

async def update_knowledge_base(kb_id: str, updates: dict) -> bool:
    updates["updated_at"] = datetime.now().isoformat()
    fields = []
    args = []
    for k, v in updates.items():
        fields.append(f"`{k}`=%s")
        args.append(v)
    args.append(kb_id)
    query = f"UPDATE knowledge_bases SET {', '.join(fields)} WHERE id=%s"
    affected = await execute_write(query, tuple(args))
    return affected > 0

async def delete_knowledge_base(kb_id: str) -> bool:
    await execute_write("DELETE FROM agent_knowledge_bases WHERE knowledge_base_id=%s", (kb_id,))
    await execute_write("DELETE FROM knowledge_chunks WHERE knowledge_base_id=%s", (kb_id,))
    await execute_write("DELETE FROM knowledge_entries WHERE knowledge_base_id=%s", (kb_id,))
    affected = await execute_write("DELETE FROM knowledge_bases WHERE id=%s", (kb_id,))
    return affected > 0

async def get_knowledge_entries(kb_id: str) -> list:
    rows = await execute_query("SELECT * FROM knowledge_entries WHERE knowledge_base_id=%s ORDER BY updated_at DESC", (kb_id,))
    for r in rows:
        if r.get("tags"):
            try:
                r["tags"] = json.loads(r["tags"])
            except Exception:
                r["tags"] = []
    return rows

async def create_knowledge_entry(
    knowledge_base_id: str, title: str, content: str,
    content_type: str = "business_info", category: str = "", tags: Optional[list] = None,
) -> str:
    entry_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    tag_data = tags or []
    await execute_write(
        "INSERT INTO knowledge_entries (id, knowledge_base_id, title, content, content_type, category, tags, status, source_type, created_at, updated_at) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
        (entry_id, knowledge_base_id, title, content, content_type, category, json.dumps(tag_data), "active", "manual", now, now)
    )
    for idx, chunk in enumerate(chunk_text(content)):
        await execute_write(
            "INSERT INTO knowledge_chunks (id, knowledge_entry_id, knowledge_base_id, chunk_text, chunk_index, token_count, metadata, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (str(uuid.uuid4()), entry_id, knowledge_base_id, chunk, idx, max(1, len(chunk) // 4), json.dumps({"title": title, "category": category, "tags": tag_data, "content_type": content_type}), now)
        )
    await update_knowledge_base(knowledge_base_id, {})
    return entry_id

async def delete_knowledge_entry(entry_id: str) -> bool:
    await execute_write("DELETE FROM knowledge_chunks WHERE knowledge_entry_id=%s", (entry_id,))
    affected = await execute_write("DELETE FROM knowledge_entries WHERE id=%s", (entry_id,))
    return affected > 0

async def get_agent_knowledge_bases(agent_id: str) -> list:
    return await execute_query("SELECT * FROM agent_knowledge_bases WHERE agent_id=%s AND enabled=1 ORDER BY priority", (agent_id,))

async def set_agent_knowledge_bases(agent_id: str, knowledge_base_ids: list) -> None:
    await execute_write("DELETE FROM agent_knowledge_bases WHERE agent_id=%s", (agent_id,))
    for i, kb_id in enumerate(knowledge_base_ids or []):
        await execute_write(
            "INSERT INTO agent_knowledge_bases (id, agent_id, knowledge_base_id, priority, enabled, created_at) VALUES (%s, %s, %s, %s, %s, %s)",
            (str(uuid.uuid4()), agent_id, kb_id, i, 1, datetime.now().isoformat())
        )

async def search_knowledge(query: str, knowledge_base_ids: Optional[list] = None, agent_id: Optional[str] = None, limit: int = 5) -> dict:
    if agent_id and not knowledge_base_ids:
        knowledge_base_ids = [r["knowledge_base_id"] for r in await get_agent_knowledge_bases(agent_id)]
    knowledge_base_ids = knowledge_base_ids or []
    if not query or not knowledge_base_ids:
        return {"chunks": [], "confidence": 0.0, "source": "none"}
    
    in_placeholders = ", ".join(["%s"] * len(knowledge_base_ids))
    rows = await execute_query(
        f"SELECT * FROM knowledge_chunks WHERE knowledge_base_id IN ({in_placeholders})",
        tuple(knowledge_base_ids)
    )
    scored = []
    for row in rows:
        metadata = row.get("metadata") or "{}"
        try:
            meta = json.loads(metadata) if isinstance(metadata, str) else metadata
        except Exception:
            meta = {}
        score = _score_text(query, " ".join([row.get("chunk_text", ""), meta.get("title", ""), meta.get("category", ""), " ".join(meta.get("tags", []))]))
        if score > 0:
            row["score"] = score
            row["metadata"] = meta
            scored.append(row)
    scored.sort(key=lambda r: r["score"], reverse=True)
    top = scored[:limit]
    confidence = top[0]["score"] if top else 0.0
    return {"chunks": top, "confidence": confidence, "source": "retrieved_knowledge" if top else "none"}

# ---------------------------------------------------------------------------
# Error Logs CRUD
# ---------------------------------------------------------------------------
async def log_error(source: str, message: str, detail: str = "", level: str = "error") -> None:
    try:
        await execute_write(
            "INSERT INTO error_logs (id, source, level, message, detail, timestamp) VALUES (%s, %s, %s, %s, %s, %s)",
            (str(uuid.uuid4()), source, level, message[:500], detail[:2000], datetime.now().isoformat())
        )
    except Exception:
        pass

async def get_errors(limit: int = 100) -> list:
    return await execute_query("SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT %s", (limit,))

async def get_logs(level: Optional[str] = None, source: Optional[str] = None, limit: int = 200) -> list:
    query = "SELECT * FROM error_logs"
    conditions = []
    args = []
    if level:
        conditions.append("level = %s")
        args.append(level)
    if source:
        conditions.append("source = %s")
        args.append(source)
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY timestamp DESC LIMIT %s"
    args.append(limit)
    return await execute_query(query, tuple(args))

async def clear_errors() -> None:
    await execute_write("DELETE FROM error_logs WHERE id != ''")

# ---------------------------------------------------------------------------
# Appointments CRUD
# ---------------------------------------------------------------------------
async def insert_appointment(name: str, phone: str, date: str, time: str, service: str) -> str:
    full_id = str(uuid.uuid4())
    booking_id = full_id[:8].upper()
    await execute_write(
        "INSERT INTO appointments (id, name, phone, date, time, service, status, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
        (full_id, name, phone, date, time, service, "booked", datetime.now().isoformat())
    )
    return booking_id

async def check_slot(date: str, time: str) -> bool:
    rows = await execute_query("SELECT id FROM appointments WHERE date=%s AND time=%s AND status='booked'", (date, time))
    return len(rows) == 0

async def get_next_available(date: str, time: str) -> str:
    try:
        dt = datetime.strptime(f"{date} {time}", "%Y-%m-%d %H:%M")
    except ValueError:
        dt = datetime.now().replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    for _ in range(7 * 24):
        dt += timedelta(hours=1)
        if 9 <= dt.hour < 18:
            if await check_slot(dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")):
                return f"{dt.strftime('%Y-%m-%d')} at {dt.strftime('%H:%M')}"
    return "no open slots found in the next 7 days"

async def get_all_appointments(date_filter: Optional[str] = None) -> list:
    if date_filter:
        return await execute_query("SELECT * FROM appointments WHERE date=%s ORDER BY date, time", (date_filter,))
    return await execute_query("SELECT * FROM appointments ORDER BY date, time")

async def cancel_appointment(appointment_id: str) -> bool:
    affected = await execute_write(
        "UPDATE appointments SET status='cancelled' WHERE id=%s AND status='booked'",
        (appointment_id,)
    )
    return affected > 0

async def get_appointments_by_phone(phone: str) -> list:
    return await execute_query("SELECT * FROM appointments WHERE phone=%s ORDER BY date DESC", (phone,))

# ---------------------------------------------------------------------------
# Call Logs CRUD
# ---------------------------------------------------------------------------
async def log_call(
    phone_number: str, lead_name: Optional[str], outcome: str, reason: str,
    duration_seconds: int, recording_url: Optional[str] = None, notes: Optional[str] = None,
    direction: str = "outbound", call_id: Optional[str] = None,
) -> None:
    row: dict = {
        "id": call_id or str(uuid.uuid4()), "phone_number": phone_number, "lead_name": lead_name,
        "outcome": outcome, "reason": reason, "duration_seconds": duration_seconds,
        "timestamp": datetime.now().isoformat(), "recording_url": recording_url,
        "notes": notes, "direction": direction,
    }
    await execute_write(
        "INSERT INTO call_logs (id, phone_number, lead_name, outcome, reason, duration_seconds, timestamp, recording_url, notes, direction) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
        (row["id"], row["phone_number"], row["lead_name"], row["outcome"], row["reason"], row["duration_seconds"], row["timestamp"], row["recording_url"], row["notes"], row["direction"])
    )

async def save_call_recording(call_id: str, audio_data: bytes, filename: str, mime_type: str) -> None:
    now = datetime.now().isoformat()
    await execute_write(
        "INSERT INTO call_recordings (call_id, audio_data, filename, mime_type, created_at) "
        "VALUES (%s, %s, %s, %s, %s) ON DUPLICATE KEY UPDATE audio_data=%s, filename=%s, mime_type=%s",
        (call_id, audio_data, filename, mime_type, now, audio_data, filename, mime_type)
    )
    rec_url = f"/api/calls/{call_id}/recording"
    await execute_write("UPDATE call_logs SET recording_url=%s WHERE id=%s", (rec_url, call_id))

async def save_call_transcript(call_id: str, transcript: str) -> None:
    await execute_write("UPDATE call_logs SET transcript=%s WHERE id=%s", (transcript, call_id))

async def get_call_recording(call_id: str) -> Optional[dict]:
    rows = await execute_query("SELECT * FROM call_recordings WHERE call_id=%s", (call_id,))
    return rows[0] if rows else None

async def get_all_calls(page: int = 1, limit: int = 20) -> list:
    offset = (page - 1) * limit
    return await execute_query("SELECT * FROM call_logs ORDER BY timestamp DESC LIMIT %s OFFSET %s", (limit, offset))

async def get_calls_by_phone(phone: str) -> list:
    return await execute_query("SELECT * FROM call_logs WHERE phone_number=%s ORDER BY timestamp DESC", (phone,))

async def update_call_notes(call_id: str, notes: str) -> bool:
    affected = await execute_write("UPDATE call_logs SET notes=%s WHERE id=%s", (notes, call_id))
    return affected > 0

async def get_contacts() -> list:
    rows = await execute_query("SELECT * FROM call_logs ORDER BY timestamp DESC")
    contacts: dict = {}
    for row in rows:
        phone = row["phone_number"]
        if phone not in contacts:
            contacts[phone] = {
                "phone_number": phone, "lead_name": row.get("lead_name"),
                "total_calls": 0, "booked": 0,
                "last_call": row["timestamp"], "last_outcome": row.get("outcome"),
            }
        contacts[phone]["total_calls"] += 1
        if row.get("outcome") == "booked":
            contacts[phone]["booked"] += 1
    return sorted(contacts.values(), key=lambda c: c["last_call"], reverse=True)

async def get_stats() -> dict:
    rows = await execute_query("SELECT outcome, duration_seconds, timestamp, direction FROM call_logs")
    total_calls    = len(rows)
    booked         = sum(1 for r in rows if r.get("outcome") == "booked")
    not_interested = sum(1 for r in rows if r.get("outcome") == "not_interested")
    inbound_calls  = sum(1 for r in rows if r.get("direction") == "inbound")
    outbound_calls = sum(1 for r in rows if r.get("direction") == "outbound" or not r.get("direction"))
    
    durations      = [r["duration_seconds"] for r in rows if r.get("duration_seconds")]
    avg_dur        = sum(durations) / len(durations) if durations else 0
    booking_rate   = round((booked / total_calls * 100) if total_calls else 0, 1)
    outcomes: dict = {}
    for r in rows:
        o = r.get("outcome") or "unknown"
        outcomes[o] = outcomes.get(o, 0) + 1
    daily: dict = defaultdict(int)
    for r in rows:
        ts = (r.get("timestamp") or "")[:10]
        if ts:
            daily[ts] += 1
    today = datetime.now().date()
    timeline = [{"date": (today - timedelta(days=i)).isoformat(), "count": daily.get((today - timedelta(days=i)).isoformat(), 0)} for i in range(13, -1, -1)]
    dur_sum: dict = defaultdict(float)
    dur_cnt: dict = defaultdict(int)
    for r in rows:
        o = r.get("outcome") or "unknown"
        sec = r.get("duration_seconds")
        if sec:
            dur_sum[o] += sec
            dur_cnt[o] += 1
    duration_by_outcome = {o: dur_sum[o] / dur_cnt[o] for o in dur_sum}
    return {
        "total_calls": total_calls, "booked": booked, "not_interested": not_interested,
        "avg_duration_seconds": round(avg_dur, 1), "booking_rate_percent": booking_rate,
        "inbound_calls": inbound_calls, "outbound_calls": outbound_calls,
        "outcomes": outcomes, "timeline": timeline, "duration_by_outcome": duration_by_outcome,
    }

# ---------------------------------------------------------------------------
# Campaigns CRUD
# ---------------------------------------------------------------------------
async def create_campaign(
    name: str, contacts_json: str, schedule_type: str = "once",
    schedule_time: str = "09:00", call_delay_seconds: int = 3,
    system_prompt: Optional[str] = None, agent_profile_id: Optional[str] = None,
) -> str:
    campaign_id = str(uuid.uuid4())
    await execute_write(
        "INSERT INTO campaigns (id, name, status, contacts_json, schedule_type, schedule_time, call_delay_seconds, system_prompt, agent_profile_id, created_at, total_dispatched, total_failed) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
        (campaign_id, name, "active", contacts_json, schedule_type, schedule_time, call_delay_seconds, system_prompt, agent_profile_id, datetime.now().isoformat(), 0, 0)
    )
    return campaign_id

async def get_all_campaigns() -> list:
    return await execute_query("SELECT * FROM campaigns ORDER BY created_at DESC")

async def get_campaign(campaign_id: str) -> Optional[dict]:
    rows = await execute_query("SELECT * FROM campaigns WHERE id=%s", (campaign_id,))
    return rows[0] if rows else None

async def update_campaign_status(campaign_id: str, status: str) -> bool:
    affected = await execute_write("UPDATE campaigns SET status=%s WHERE id=%s", (status, campaign_id))
    return affected > 0

async def update_campaign_run_stats(campaign_id: str, dispatched: int, failed: int) -> None:
    await execute_write(
        "UPDATE campaigns SET last_run_at=%s, total_dispatched=%s, total_failed=%s, status='completed' WHERE id=%s",
        (datetime.now().isoformat(), dispatched, failed, campaign_id)
    )

async def delete_campaign(campaign_id: str) -> bool:
    affected = await execute_write("DELETE FROM campaigns WHERE id=%s", (campaign_id,))
    return affected > 0

# ---------------------------------------------------------------------------
# Contact Memory CRUD
# ---------------------------------------------------------------------------
async def add_contact_memory(phone: str, insight: str) -> None:
    await execute_write(
        "INSERT INTO contact_memory (id, phone_number, insight, created_at) VALUES (%s, %s, %s, %s)",
        (str(uuid.uuid4()), phone, insight[:1000], datetime.now().isoformat())
    )

async def get_contact_memory(phone: str) -> list:
    return await execute_query("SELECT insight, created_at FROM contact_memory WHERE phone_number=%s ORDER BY created_at DESC LIMIT 20", (phone,))

async def compress_contact_memory(phone: str, compressed: str) -> None:
    await execute_write("DELETE FROM contact_memory WHERE phone_number=%s", (phone,))
    await execute_write(
        "INSERT INTO contact_memory (id, phone_number, insight, created_at) VALUES (%s, %s, %s, %s)",
        (str(uuid.uuid4()), phone, compressed[:2000], datetime.now().isoformat())
    )

# ---------------------------------------------------------------------------
# Agent Profiles CRUD
# ---------------------------------------------------------------------------
async def get_all_agent_profiles() -> list:
    return await execute_query("SELECT * FROM agent_profiles ORDER BY created_at")

async def get_agent_profile(profile_id: str) -> Optional[dict]:
    rows = await execute_query("SELECT * FROM agent_profiles WHERE id=%s", (profile_id,))
    return rows[0] if rows else None

async def create_agent_profile(
    name: str, voice: str = "Aoede", model: str = "gemini-3.1-flash-live-preview",
    system_prompt: Optional[str] = None, enabled_tools: str = "[]", is_default: bool = False,
    conversation_initiation: str = "agent", first_message: Optional[str] = None,
    channel_mode: str = "voice", voice_prompt_override: Optional[str] = None,
    text_prompt_override: Optional[str] = None, knowledge_confidence_threshold: float = 0.55,
) -> str:
    profile_id = str(uuid.uuid4())
    if is_default:
        await execute_write("UPDATE agent_profiles SET is_default=0 WHERE id != 'placeholder'")
    await execute_write(
        "INSERT INTO agent_profiles (id, name, voice, model, system_prompt, enabled_tools, is_default, created_at, conversation_initiation, first_message, channel_mode, voice_prompt_override, text_prompt_override, knowledge_confidence_threshold) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
        (profile_id, name, voice, model, system_prompt, enabled_tools, 1 if is_default else 0, datetime.now().isoformat(), conversation_initiation, first_message, channel_mode, voice_prompt_override, text_prompt_override, knowledge_confidence_threshold)
    )
    return profile_id

async def update_agent_profile(profile_id: str, updates: dict) -> bool:
    if updates.get("is_default") == 1:
        await execute_write("UPDATE agent_profiles SET is_default=0 WHERE id != 'placeholder'")
    fields = []
    args = []
    for k, v in updates.items():
        fields.append(f"`{k}`=%s")
        args.append(v)
    args.append(profile_id)
    query = f"UPDATE agent_profiles SET {', '.join(fields)} WHERE id=%s"
    affected = await execute_write(query, tuple(args))
    return affected > 0

async def delete_agent_profile(profile_id: str) -> bool:
    affected = await execute_write("DELETE FROM agent_profiles WHERE id=%s", (profile_id,))
    return affected > 0

async def set_default_agent_profile(profile_id: str) -> None:
    await execute_write("UPDATE agent_profiles SET is_default=0 WHERE id != 'placeholder'")
    await execute_write("UPDATE agent_profiles SET is_default=1 WHERE id=%s", (profile_id,))
