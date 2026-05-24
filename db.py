import json
import os
import uuid
from datetime import datetime, timedelta
from typing import Optional
from collections import defaultdict

# ---------------------------------------------------------------------------
# DEFAULTS — all loaded from environment variables only.
# Never hardcode real credentials here. Use Coolify env vars or .env file.
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
    "SUPABASE_URL":            os.getenv("SUPABASE_URL", ""),
    "SUPABASE_SERVICE_KEY":    os.getenv("SUPABASE_SERVICE_KEY", ""),
    "DEEPGRAM_API_KEY":        os.getenv("DEEPGRAM_API_KEY", ""),
}


def _default(key: str) -> str:
    return os.getenv(key, DEFAULTS.get(key, ""))


SUPABASE_URL = _default("SUPABASE_URL")
SUPABASE_KEY = _default("SUPABASE_SERVICE_KEY")

SENSITIVE_KEYS = {
    "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "GOOGLE_API_KEY",
    "VOBIZ_PASSWORD", "TWILIO_AUTH_TOKEN", "SUPABASE_SERVICE_KEY",
    "AWS_SECRET_ACCESS_KEY", "S3_SECRET_ACCESS_KEY", "CALCOM_API_KEY",
    "DEEPGRAM_API_KEY",
}


def _sdb():
    from supabase import create_client
    return create_client(_default("SUPABASE_URL"), _default("SUPABASE_SERVICE_KEY"))


async def _adb():
    from supabase._async.client import create_client
    return await create_client(_default("SUPABASE_URL"), _default("SUPABASE_SERVICE_KEY"))


def init_db() -> None:
    url = os.getenv("SUPABASE_URL", SUPABASE_URL)
    key = os.getenv("SUPABASE_SERVICE_KEY", SUPABASE_KEY)
    if not url or not key:
        print("⚠️  SUPABASE_URL or SUPABASE_SERVICE_KEY not set.")
        return
    try:
        db = _sdb()
        db.table("settings").select("key").limit(1).execute()
        print("✅ Supabase connected")
    except Exception as exc:
        print(f"⚠️  Supabase connection failed: {exc}")
        print("   Run supabase_schema.sql in your Supabase Dashboard → SQL Editor")


# ── Settings ─────────────────────────────────────────────────────────────────

async def get_all_settings() -> dict:
    db = await _adb()
    result = await db.table("settings").select("key, value").execute()
    KNOWN_KEYS = [
        "LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET",
        "GOOGLE_API_KEY", "GEMINI_MODEL", "GEMINI_TTS_VOICE", "USE_GEMINI_REALTIME",
        "VOBIZ_SIP_DOMAIN", "VOBIZ_USERNAME", "VOBIZ_PASSWORD",
        "VOBIZ_OUTBOUND_NUMBER", "OUTBOUND_TRUNK_ID", "DEFAULT_TRANSFER_NUMBER",
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
    for row in (result.data or []):
        k, v = row["key"], row["value"]
        if k == "TEST_KEY":
            continue
        if k in SENSITIVE_KEYS:
            out[k] = {"value": "", "configured": bool(v)}
        else:
            out[k] = {"value": v, "configured": bool(v)}
    return out


async def save_settings(data: dict) -> None:
    db = await _adb()
    updated_at = datetime.now().isoformat()
    rows = [
        {"key": k, "value": str(v), "updated_at": updated_at}
        for k, v in data.items()
        if v is not None and v != ""
    ]
    if rows:
        await db.table("settings").upsert(rows, on_conflict="key").execute()


async def get_setting(key: str, default: str = "") -> str:
    db = await _adb()
    result = await db.table("settings").select("value").eq("key", key).maybe_single().execute()
    if result and result.data:
        return result.data["value"]
    return _default(key) or default


async def set_setting(key: str, value: str) -> None:
    db = await _adb()
    await db.table("settings").upsert(
        {"key": key, "value": value, "updated_at": datetime.now().isoformat()},
        on_conflict="key",
    ).execute()


async def get_enabled_tools() -> list:
    raw = await get_setting("ENABLED_TOOLS", "")
    if not raw:
        return []
    try:
        import json
        result = json.loads(raw)
        return result if isinstance(result, list) else []
    except Exception:
        return []


def chunk_text(text: str, max_chars: int = 900) -> list:
    """Split business knowledge into small searchable chunks."""
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


# ── Knowledge Base ────────────────────────────────────────────────────────────

async def get_knowledge_bases() -> list:
    db = await _adb()
    result = await db.table("knowledge_bases").select("*").order("created_at", desc=True).execute()
    return result.data or []


async def get_knowledge_base(kb_id: str) -> Optional[dict]:
    db = await _adb()
    result = await db.table("knowledge_bases").select("*").eq("id", kb_id).maybe_single().execute()
    return result.data if result else None


async def create_knowledge_base(name: str, description: str = "") -> str:
    kb_id = str(uuid.uuid4())
    db = await _adb()
    await db.table("knowledge_bases").insert({
        "id": kb_id, "name": name, "description": description,
        "status": "active", "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }).execute()
    return kb_id


async def update_knowledge_base(kb_id: str, updates: dict) -> bool:
    db = await _adb()
    updates["updated_at"] = datetime.now().isoformat()
    result = await db.table("knowledge_bases").update(updates).eq("id", kb_id).execute()
    return len(result.data or []) > 0


async def delete_knowledge_base(kb_id: str) -> bool:
    db = await _adb()
    await db.table("agent_knowledge_bases").delete().eq("knowledge_base_id", kb_id).execute()
    await db.table("knowledge_chunks").delete().eq("knowledge_base_id", kb_id).execute()
    await db.table("knowledge_entries").delete().eq("knowledge_base_id", kb_id).execute()
    result = await db.table("knowledge_bases").delete().eq("id", kb_id).execute()
    return len(result.data or []) > 0


async def get_knowledge_entries(kb_id: str) -> list:
    db = await _adb()
    result = await db.table("knowledge_entries").select("*").eq("knowledge_base_id", kb_id).order("updated_at", desc=True).execute()
    return result.data or []


async def create_knowledge_entry(
    knowledge_base_id: str, title: str, content: str,
    content_type: str = "business_info", category: str = "", tags: Optional[list] = None,
) -> str:
    entry_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    db = await _adb()
    tag_data = tags or []
    await db.table("knowledge_entries").insert({
        "id": entry_id, "knowledge_base_id": knowledge_base_id, "title": title,
        "content": content, "content_type": content_type, "category": category,
        "tags": json.dumps(tag_data), "status": "active", "source_type": "manual",
        "created_at": now, "updated_at": now,
    }).execute()
    rows = []
    for idx, chunk in enumerate(chunk_text(content)):
        rows.append({
            "id": str(uuid.uuid4()), "knowledge_entry_id": entry_id,
            "knowledge_base_id": knowledge_base_id, "chunk_text": chunk,
            "chunk_index": idx, "token_count": max(1, len(chunk) // 4),
            "metadata": json.dumps({"title": title, "category": category, "tags": tag_data, "content_type": content_type}),
            "created_at": now,
        })
    if rows:
        await db.table("knowledge_chunks").insert(rows).execute()
    await update_knowledge_base(knowledge_base_id, {})
    return entry_id


async def delete_knowledge_entry(entry_id: str) -> bool:
    db = await _adb()
    await db.table("knowledge_chunks").delete().eq("knowledge_entry_id", entry_id).execute()
    result = await db.table("knowledge_entries").delete().eq("id", entry_id).execute()
    return len(result.data or []) > 0


async def get_agent_knowledge_bases(agent_id: str) -> list:
    db = await _adb()
    result = await db.table("agent_knowledge_bases").select("*").eq("agent_id", agent_id).eq("enabled", 1).order("priority").execute()
    return result.data or []


async def set_agent_knowledge_bases(agent_id: str, knowledge_base_ids: list) -> None:
    db = await _adb()
    await db.table("agent_knowledge_bases").delete().eq("agent_id", agent_id).execute()
    rows = [
        {"id": str(uuid.uuid4()), "agent_id": agent_id, "knowledge_base_id": kb_id, "priority": i, "enabled": 1, "created_at": datetime.now().isoformat()}
        for i, kb_id in enumerate(knowledge_base_ids or [])
    ]
    if rows:
        await db.table("agent_knowledge_bases").insert(rows).execute()


async def search_knowledge(query: str, knowledge_base_ids: Optional[list] = None, agent_id: Optional[str] = None, limit: int = 5) -> dict:
    if agent_id and not knowledge_base_ids:
        knowledge_base_ids = [r["knowledge_base_id"] for r in await get_agent_knowledge_bases(agent_id)]
    knowledge_base_ids = knowledge_base_ids or []
    if not query or not knowledge_base_ids:
        return {"chunks": [], "confidence": 0.0, "source": "none"}

    db = await _adb()
    result = await db.table("knowledge_chunks").select("*").in_("knowledge_base_id", knowledge_base_ids).limit(500).execute()
    scored = []
    for row in (result.data or []):
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


# ── Error logs ────────────────────────────────────────────────────────────────

async def log_error(source: str, message: str, detail: str = "", level: str = "error") -> None:
    try:
        db = await _adb()
        await db.table("error_logs").insert({
            "id": str(uuid.uuid4()),
            "source": source,
            "level": level,
            "message": message[:500],
            "detail": detail[:2000],
            "timestamp": datetime.now().isoformat(),
        }).execute()
    except Exception:
        pass


async def get_errors(limit: int = 100) -> list:
    db = await _adb()
    result = await db.table("error_logs").select("*").order("timestamp", desc=True).limit(limit).execute()
    return result.data or []


async def get_logs(level: Optional[str] = None, source: Optional[str] = None, limit: int = 200) -> list:
    db = await _adb()
    query = db.table("error_logs").select("*").order("timestamp", desc=True).limit(limit)
    if level:
        query = query.eq("level", level)
    if source:
        query = query.eq("source", source)
    result = await query.execute()
    return result.data or []


async def clear_errors() -> None:
    db = await _adb()
    await db.table("error_logs").delete().neq("id", "").execute()


# ── Appointments ──────────────────────────────────────────────────────────────

async def insert_appointment(name: str, phone: str, date: str, time: str, service: str) -> str:
    full_id = str(uuid.uuid4())
    booking_id = full_id[:8].upper()
    db = await _adb()
    await db.table("appointments").insert({
        "id": full_id, "name": name, "phone": phone,
        "date": date, "time": time, "service": service,
        "status": "booked", "created_at": datetime.now().isoformat(),
    }).execute()
    return booking_id


async def check_slot(date: str, time: str) -> bool:
    """Returns True if slot is available (no existing booking)."""
    db = await _adb()
    result = await (
        db.table("appointments").select("id")
        .eq("date", date).eq("time", time).eq("status", "booked")
        .maybe_single().execute()
    )
    return result.data is None


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
    db = await _adb()
    query = db.table("appointments").select("*").order("date").order("time")
    if date_filter:
        query = query.eq("date", date_filter)
    result = await query.execute()
    return result.data or []


async def cancel_appointment(appointment_id: str) -> bool:
    db = await _adb()
    result = await (
        db.table("appointments").update({"status": "cancelled"})
        .eq("id", appointment_id).eq("status", "booked").execute()
    )
    return len(result.data or []) > 0


async def get_appointments_by_phone(phone: str) -> list:
    db = await _adb()
    result = await db.table("appointments").select("*").eq("phone", phone).order("date", desc=True).execute()
    return result.data or []


# ── Call logs ─────────────────────────────────────────────────────────────────

async def log_call(
    phone_number: str, lead_name: Optional[str], outcome: str, reason: str,
    duration_seconds: int, recording_url: Optional[str] = None, notes: Optional[str] = None,
) -> None:
    db = await _adb()
    row: dict = {
        "id": str(uuid.uuid4()), "phone_number": phone_number, "lead_name": lead_name,
        "outcome": outcome, "reason": reason, "duration_seconds": duration_seconds,
        "timestamp": datetime.now().isoformat(),
    }
    if recording_url:
        row["recording_url"] = recording_url
    if notes:
        row["notes"] = notes
    await db.table("call_logs").insert(row).execute()


async def get_all_calls(page: int = 1, limit: int = 20) -> list:
    db = await _adb()
    offset = (page - 1) * limit
    result = await db.table("call_logs").select("*").order("timestamp", desc=True).range(offset, offset + limit - 1).execute()
    return result.data or []


async def get_calls_by_phone(phone: str) -> list:
    db = await _adb()
    result = await db.table("call_logs").select("*").eq("phone_number", phone).order("timestamp", desc=True).execute()
    return result.data or []


async def update_call_notes(call_id: str, notes: str) -> bool:
    db = await _adb()
    result = await db.table("call_logs").update({"notes": notes}).eq("id", call_id).execute()
    return len(result.data or []) > 0


async def get_contacts() -> list:
    db = await _adb()
    result = await db.table("call_logs").select("*").order("timestamp", desc=True).execute()
    rows = result.data or []
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


# ── Stats ─────────────────────────────────────────────────────────────────────

async def get_stats() -> dict:
    db = await _adb()
    rows = (await db.table("call_logs").select("outcome, duration_seconds, timestamp").execute()).data or []
    total_calls    = len(rows)
    booked         = sum(1 for r in rows if r.get("outcome") == "booked")
    not_interested = sum(1 for r in rows if r.get("outcome") == "not_interested")
    durations      = [r["duration_seconds"] for r in rows if r.get("duration_seconds")]
    avg_dur        = sum(durations) / len(durations) if durations else 0
    booking_rate   = round((booked / total_calls * 100) if total_calls else 0, 1)
    # Outcomes breakdown
    outcomes: dict = {}
    for r in rows:
        o = r.get("outcome") or "unknown"
        outcomes[o] = outcomes.get(o, 0) + 1
    # Timeline: calls per day last 14 days
    daily: dict = defaultdict(int)
    for r in rows:
        ts = (r.get("timestamp") or "")[:10]
        if ts:
            daily[ts] += 1
    today = datetime.now().date()
    timeline = [{"date": (today - timedelta(days=i)).isoformat(), "count": daily.get((today - timedelta(days=i)).isoformat(), 0)} for i in range(13, -1, -1)]
    # Avg duration by outcome
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
        "outcomes": outcomes, "timeline": timeline, "duration_by_outcome": duration_by_outcome,
    }


# ── Campaigns ─────────────────────────────────────────────────────────────────

async def create_campaign(
    name: str, contacts_json: str, schedule_type: str = "once",
    schedule_time: str = "09:00", call_delay_seconds: int = 3,
    system_prompt: Optional[str] = None, agent_profile_id: Optional[str] = None,
) -> str:
    campaign_id = str(uuid.uuid4())
    db = await _adb()
    row: dict = {
        "id": campaign_id, "name": name, "status": "active",
        "contacts_json": contacts_json, "schedule_type": schedule_type,
        "schedule_time": schedule_time, "call_delay_seconds": call_delay_seconds,
        "created_at": datetime.now().isoformat(), "total_dispatched": 0, "total_failed": 0,
    }
    if system_prompt:
        row["system_prompt"] = system_prompt
    if agent_profile_id:
        row["agent_profile_id"] = agent_profile_id
    await db.table("campaigns").insert(row).execute()
    return campaign_id


async def get_all_campaigns() -> list:
    db = await _adb()
    result = await db.table("campaigns").select("*").order("created_at", desc=True).execute()
    return result.data or []


async def get_campaign(campaign_id: str) -> Optional[dict]:
    db = await _adb()
    result = await db.table("campaigns").select("*").eq("id", campaign_id).maybe_single().execute()
    return result.data if result else None


async def update_campaign_status(campaign_id: str, status: str) -> bool:
    db = await _adb()
    result = await db.table("campaigns").update({"status": status}).eq("id", campaign_id).execute()
    return len(result.data or []) > 0


async def update_campaign_run_stats(campaign_id: str, dispatched: int, failed: int) -> None:
    db = await _adb()
    await db.table("campaigns").update({
        "last_run_at": datetime.now().isoformat(),
        "total_dispatched": dispatched, "total_failed": failed, "status": "completed",
    }).eq("id", campaign_id).execute()


async def delete_campaign(campaign_id: str) -> bool:
    db = await _adb()
    result = await db.table("campaigns").delete().eq("id", campaign_id).execute()
    return len(result.data or []) > 0


# ── Contact Memory ────────────────────────────────────────────────────────────

async def add_contact_memory(phone: str, insight: str) -> None:
    db = await _adb()
    await db.table("contact_memory").insert({
        "id": str(uuid.uuid4()), "phone_number": phone,
        "insight": insight[:1000], "created_at": datetime.now().isoformat(),
    }).execute()


async def get_contact_memory(phone: str) -> list:
    db = await _adb()
    result = await (
        db.table("contact_memory").select("insight, created_at")
        .eq("phone_number", phone).order("created_at", desc=True).limit(20).execute()
    )
    return result.data or []


async def compress_contact_memory(phone: str, compressed: str) -> None:
    db = await _adb()
    await db.table("contact_memory").delete().eq("phone_number", phone).execute()
    await db.table("contact_memory").insert({
        "id": str(uuid.uuid4()), "phone_number": phone,
        "insight": compressed[:2000], "created_at": datetime.now().isoformat(),
    }).execute()


# ── Agent Profiles ────────────────────────────────────────────────────────────

async def get_all_agent_profiles() -> list:
    db = await _adb()
    result = await db.table("agent_profiles").select("*").order("created_at").execute()
    return result.data or []


async def get_agent_profile(profile_id: str) -> Optional[dict]:
    db = await _adb()
    result = await db.table("agent_profiles").select("*").eq("id", profile_id).maybe_single().execute()
    return result.data if result else None


async def create_agent_profile(
    name: str, voice: str = "Aoede", model: str = "gemini-3.1-flash-live-preview",
    system_prompt: Optional[str] = None, enabled_tools: str = "[]", is_default: bool = False,
    conversation_initiation: str = "agent", first_message: Optional[str] = None,
    channel_mode: str = "voice", voice_prompt_override: Optional[str] = None,
    text_prompt_override: Optional[str] = None, knowledge_confidence_threshold: float = 0.55,
) -> str:
    profile_id = str(uuid.uuid4())
    db = await _adb()
    if is_default:
        await db.table("agent_profiles").update({"is_default": 0}).neq("id", "placeholder").execute()
    await db.table("agent_profiles").insert({
        "id": profile_id, "name": name, "voice": voice, "model": model,
        "system_prompt": system_prompt, "enabled_tools": enabled_tools,
        "is_default": 1 if is_default else 0, "created_at": datetime.now().isoformat(),
        "conversation_initiation": conversation_initiation,
        "first_message": first_message,
        "channel_mode": channel_mode,
        "voice_prompt_override": voice_prompt_override,
        "text_prompt_override": text_prompt_override,
        "knowledge_confidence_threshold": knowledge_confidence_threshold,
    }).execute()
    return profile_id


async def update_agent_profile(profile_id: str, updates: dict) -> bool:
    db = await _adb()
    result = await db.table("agent_profiles").update(updates).eq("id", profile_id).execute()
    return len(result.data or []) > 0


async def delete_agent_profile(profile_id: str) -> bool:
    db = await _adb()
    result = await db.table("agent_profiles").delete().eq("id", profile_id).execute()
    return len(result.data or []) > 0


async def set_default_agent_profile(profile_id: str) -> None:
    db = await _adb()
    await db.table("agent_profiles").update({"is_default": 0}).neq("id", "placeholder").execute()
    await db.table("agent_profiles").update({"is_default": 1}).eq("id", profile_id).execute()
