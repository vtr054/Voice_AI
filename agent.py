import asyncio
import json
import logging
import os
import ssl
import certifi
from typing import Optional

from dotenv import load_dotenv

# Patch SSL before any network import
_orig_ssl = ssl.create_default_context
def _certifi_ssl(purpose=ssl.Purpose.SERVER_AUTH, **kwargs):
    if not kwargs.get("cafile") and not kwargs.get("capath") and not kwargs.get("cadata"):
        kwargs["cafile"] = certifi.where()
    return _orig_ssl(purpose, **kwargs)
ssl.create_default_context = _certifi_ssl

from livekit import agents, api, rtc
from livekit.agents import Agent, AgentSession, RoomInputOptions, llm
try:
    from livekit.agents import RoomOptions as _RoomOptions
    _HAS_ROOM_OPTIONS = True
except ImportError:
    _HAS_ROOM_OPTIONS = False
from livekit.plugins import noise_cancellation, silero

from db import init_db, log_error, get_enabled_tools, get_agent_knowledge_bases, search_knowledge
from prompts import build_prompt
from tools import AppointmentTools

load_dotenv(".env")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("outbound-agent")

SIP_DOMAIN = os.getenv("VOBIZ_SIP_DOMAIN", "")


async def _log(level: str, msg: str, detail: str = "") -> None:
    if level == "info":      logger.info(msg)
    elif level == "warning": logger.warning(msg)
    else:                    logger.error(msg)
    try:
        await log_error("agent", msg, detail, level)
    except Exception:
        pass


def load_db_settings_to_env() -> None:
    """Load Supabase settings table into os.environ before worker starts."""
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        return
    try:
        from supabase import create_client
        client = create_client(url, key)
        result = client.table("settings").select("key, value").execute()
        for row in (result.data or []):
            if row.get("value"):
                os.environ[row["key"]] = row["value"]
    except Exception as exc:
        logger.warning("Could not load settings from Supabase: %s", exc)


# ── Import Google plugin paths ───────────────────────────────────────────────
_google_realtime = None
_google_beta_realtime = None
_google_llm = None
_google_tts = None

try:
    from livekit.plugins import google as _gp
    try:
        _google_realtime = _gp.realtime.RealtimeModel
        logger.info("Loaded google.realtime.RealtimeModel (stable path)")
    except AttributeError:
        pass
    try:
        _google_beta_realtime = _gp.beta.realtime.RealtimeModel
        logger.info("Loaded google.beta.realtime.RealtimeModel (beta path)")
    except AttributeError:
        pass
    try:
        _google_llm = _gp.LLM
        _google_tts = _gp.TTS
    except AttributeError:
        pass
except ImportError:
    logger.warning("livekit-plugins-google not installed")

_deepgram_stt = None
try:
    from livekit.plugins import deepgram as _dg
    _deepgram_stt = _dg.STT
except ImportError:
    pass


# ── Session factory ──────────────────────────────────────────────────────────

def _build_session(tools: list, system_prompt: str) -> AgentSession:
    """
    Build AgentSession with Gemini Live or pipeline fallback.
    """
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-live-preview")
    gemini_voice = os.getenv("GEMINI_TTS_VOICE", "Aoede")
    use_realtime = os.getenv("USE_GEMINI_REALTIME", "true").lower() != "false"

    RealtimeClass = _google_realtime or (_google_beta_realtime if use_realtime else None)

    if use_realtime and RealtimeClass is not None:
        logger.info("SESSION MODE: Gemini Live realtime (%s, voice=%s)", gemini_model, gemini_voice)
        try:
            from google.genai import types as _gt
            _realtime_input_cfg = _gt.RealtimeInputConfig(
                automatic_activity_detection=_gt.AutomaticActivityDetection(
                    end_of_speech_sensitivity=_gt.EndSensitivity.END_SENSITIVITY_LOW,
                    silence_duration_ms=2000,
                    prefix_padding_ms=200,
                ),
            )
            _session_resumption_cfg = _gt.SessionResumptionConfig(transparent=True)
            _ctx_compression_cfg = _gt.ContextWindowCompressionConfig(
                trigger_tokens=25600,
                sliding_window=_gt.SlidingWindow(target_tokens=12800),
            )
        except Exception as _cfg_err:
            logger.warning("Could not build silence-prevention config: %s", _cfg_err)
            _realtime_input_cfg = None
            _session_resumption_cfg = None
            _ctx_compression_cfg = None

        realtime_kwargs: dict = dict(model=gemini_model, voice=gemini_voice, instructions=system_prompt)
        if _realtime_input_cfg is not None:
            realtime_kwargs["realtime_input_config"]      = _realtime_input_cfg
            realtime_kwargs["session_resumption"]         = _session_resumption_cfg
            realtime_kwargs["context_window_compression"] = _ctx_compression_cfg

        return AgentSession(llm=RealtimeClass(**realtime_kwargs), tools=tools)

    if _google_llm is None:
        raise RuntimeError("No Google AI backend. Run: pip install 'livekit-plugins-google>=1.0'")

    logger.info("SESSION MODE: pipeline (Deepgram STT + Gemini LLM + Google TTS)")
    stt = _deepgram_stt(model="nova-3", language="multi") if _deepgram_stt else None
    tts = _google_tts() if _google_tts else None
    vad = silero.VAD.load(min_speech_duration=0.2, min_silence_duration=0.5)
    return AgentSession(stt=stt, llm=_google_llm(model="gemini-2.0-flash"), tts=tts, vad=vad, tools=tools)


class OutboundAssistant(Agent):
    def __init__(self, instructions: str, chat_ctx: Optional[llm.ChatContext] = None) -> None:
        super().__init__(instructions=instructions, chat_ctx=chat_ctx)


async def entrypoint(ctx: agents.JobContext) -> None:
    await _log("info", f"Job started — room: {ctx.room.name}")

    phone_number: Optional[str] = None
    lead_name = "there"
    business_name = "our company"
    service_type = "our service"
    custom_prompt: Optional[str] = None
    voice_override: Optional[str] = None
    model_override: Optional[str] = None
    tools_override: Optional[str] = None
    initiation: str = "agent"
    first_message: Optional[str] = None
    agent_profile_id: Optional[str] = None
    channel_mode: str = "voice"

    if ctx.job.metadata:
        try:
            data = json.loads(ctx.job.metadata)
            phone_number   = data.get("phone_number")
            lead_name      = data.get("lead_name", lead_name)
            business_name  = data.get("business_name", business_name)
            service_type   = data.get("service_type", service_type)
            custom_prompt  = data.get("system_prompt")
            voice_override = data.get("voice_override")
            model_override = data.get("model_override")
            tools_override = data.get("tools_override")
            initiation     = data.get("conversation_initiation", "agent")
            first_message  = data.get("first_message") or None
            agent_profile_id = data.get("agent_profile_id") or None
            channel_mode = data.get("channel_mode", "voice")
        except (json.JSONDecodeError, AttributeError):
            await _log("warning", "Invalid JSON in job metadata")

    await _log("info", f"Call job received — phone={phone_number} lead={lead_name} biz={business_name}")

    # Apply overrides early so we can check if we are using a native audio model
    if voice_override:
        os.environ["GEMINI_TTS_VOICE"] = voice_override
    if model_override:
        os.environ["GEMINI_MODEL"] = model_override

    _active_model = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-live-preview")
    is_native_audio = "3.1" in _active_model or "2.5" in _active_model
    is_gemini_3_1 = "3.1" in _active_model

    # ── Connect ──────────────────────────────────────────────────────────────
    # Connect early so we can inspect remote participants if the call was placed externally
    await ctx.connect()
    await _log("info", f"Connected to LiveKit room: {ctx.room.name}")

    # Extract dynamic variables passed by the dialer from remote participants if present
    for participant in ctx.room.remote_participants.values():
        if participant.metadata:
            try:
                p_data = json.loads(participant.metadata)
                p_name = p_data.get("name") or p_data.get("lead_name")
                if p_name:
                    await _log("info", f"Extracted lead name from participant metadata: {p_name}")
                    lead_name = p_name
            except Exception as e:
                await _log("warning", f"Failed to parse participant metadata: {e}")

    # Load Knowledge Base
    knowledge_context = ""
    if agent_profile_id:
        try:
            kb_rows = await get_agent_knowledge_bases(agent_profile_id)
            kb_ids = [row["knowledge_base_id"] for row in kb_rows]
            seed_query = f"{business_name} {service_type} pricing services policies appointment rules objections"
            kb_result = await search_knowledge(seed_query, knowledge_base_ids=kb_ids, limit=6)
            if kb_result.get("chunks"):
                knowledge_context = "\n".join(
                    f"- {(chunk.get('metadata') or {}).get('title', 'Knowledge source')}: {chunk.get('chunk_text', '')}"
                    for chunk in kb_result["chunks"]
                )
        except Exception as exc:
            await _log("warning", f"Could not preload knowledge context: {exc}")

    # Build Prompt
    system_prompt = build_prompt(lead_name=lead_name, business_name=business_name,
                                  service_type=service_type, custom_prompt=custom_prompt,
                                  channel=channel_mode, knowledge_context=knowledge_context)
    
    # ── Option 2 Implementation: Inject dynamic greeting before session starts ──
    if initiation == "user":
        system_prompt += "\n\nIMPORTANT INSTRUCTION: DO NOT SPEAK FIRST. The call has just connected. Wait silently until the user says something before you begin speaking."
    elif initiation == "agent" and is_native_audio:
        if first_message:
            _fm = first_message.replace("{lead_name}", lead_name).replace("{business_name}", business_name).replace("{service_type}", service_type)
        else:
            _fm = f"Ah, hello! Am I speaking with {lead_name}?"
        system_prompt += (
            f"\n\nCRITICAL INSTRUCTION: You are an outbound dialer. The user does not know you are calling. "
            f"You MUST initiate the conversation. Speak immediately upon connection. Do not wait for a prompt or greeting from the user. "
            f"Your very first sentence must be exactly: '{_fm}'"
        )

    tool_ctx = AppointmentTools(ctx, phone_number, lead_name, agent_profile_id=agent_profile_id)

    if tools_override:
        try:
            enabled_tools = json.loads(tools_override)
        except Exception:
            enabled_tools = await get_enabled_tools()
    else:
        enabled_tools = await get_enabled_tools()

    # ── Dial — MUST come after session.start() ──────────────────────────────
    if phone_number:
        trunk_id = os.getenv("OUTBOUND_TRUNK_ID")
        if not trunk_id:
            await _log("error", "OUTBOUND_TRUNK_ID not set — cannot place outbound call")
            ctx.shutdown()
            return
        await _log("info", f"Dialing {phone_number} via SIP trunk {trunk_id}")
        try:
            await ctx.api.sip.create_sip_participant(
                api.CreateSIPParticipantRequest(
                    room_name=ctx.room.name,
                    sip_trunk_id=trunk_id,
                    sip_call_to=phone_number,
                    participant_identity=f"sip_{phone_number}",
                    wait_until_answered=True,
                )
            )
        except Exception as exc:
            await _log("error", f"SIP dial FAILED for {phone_number}: {exc}")
            ctx.shutdown()
            return
        await _log("info", f"Call ANSWERED — {phone_number} picked up, starting AI session now")

    # ── Build and start Gemini Live ──────────────────────────────────────────
    await _log("info", f"Building AI session — model={_active_model}")
    active_tools = tool_ctx.build_tool_list(enabled_tools)
    await _log("info", f"Tools loaded: {[t.__name__ for t in active_tools]}")
    session = _build_session(tools=active_tools, system_prompt=system_prompt)

    initial_chat_ctx = None
    if initiation == "agent" and is_gemini_3_1:
        initial_chat_ctx = llm.ChatContext(
            items=[
                llm.ChatMessage(role="user", content=["."])
            ]
        )

    if _HAS_ROOM_OPTIONS:
        from livekit.agents import RoomOptions as _RO
        _session_kwargs = dict(
            room=ctx.room,
            agent=OutboundAssistant(instructions=system_prompt, chat_ctx=initial_chat_ctx),
            room_options=_RO(input_options=RoomInputOptions(noise_cancellation=noise_cancellation.BVCTelephony())),
        )
    else:
        _session_kwargs = dict(
            room=ctx.room,
            agent=OutboundAssistant(instructions=system_prompt, chat_ctx=initial_chat_ctx),
            room_input_options=RoomInputOptions(noise_cancellation=noise_cancellation.BVCTelephony()),
        )

    await session.start(**_session_kwargs)
    await _log("info", "Agent session started — AI ready.")

    # ── Optional S3 recording ────────────────────────────────────────────────
    if phone_number:
        _aws_key    = os.getenv("S3_ACCESS_KEY_ID") or os.getenv("AWS_ACCESS_KEY_ID", "")
        _aws_secret = os.getenv("S3_SECRET_ACCESS_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY", "")
        _aws_bucket = os.getenv("S3_BUCKET") or os.getenv("AWS_BUCKET_NAME", "")
        _s3_endpoint = os.getenv("S3_ENDPOINT_URL") or os.getenv("S3_ENDPOINT", "")
        _s3_region  = os.getenv("S3_REGION") or os.getenv("AWS_REGION", "ap-northeast-1")
        if _aws_key and _aws_secret and _aws_bucket:
            try:
                _recording_path = f"recordings/{ctx.room.name}.ogg"
                _egress_req = api.RoomCompositeEgressRequest(
                    room_name=ctx.room.name, audio_only=True,
                    file_outputs=[api.EncodedFileOutput(
                        file_type=api.EncodedFileType.OGG, filepath=_recording_path,
                        s3=api.S3Upload(access_key=_aws_key, secret=_aws_secret,
                                        bucket=_aws_bucket, region=_s3_region, endpoint=_s3_endpoint),
                    )],
                )
                _egress = await ctx.api.egress.start_room_composite_egress(_egress_req)
                _s3_ep = _s3_endpoint.rstrip("/")
                tool_ctx.recording_url = (f"{_s3_ep}/{_aws_bucket}/{_recording_path}"
                                           if _s3_ep else f"s3://{_aws_bucket}/{_recording_path}")
                await _log("info", f"Recording started: egress={_egress.egress_id}")
            except Exception as _exc:
                await _log("warning", f"Recording start failed (non-fatal): {_exc}")

    # ── Greeting ─────────────────────────────────────────────────────────────
    if initiation == "agent":
        if is_native_audio:
            if is_gemini_3_1:
                # Greeting is triggered autonomously via pre-populated user turn in initial_chat_ctx
                await _log("info", "Gemini 3.1 native-audio: Greeting triggered autonomously via initial history.")
            else:
                # Tell the RealtimeModel to generate the initial greeting turn autonomously
                await _log("info", "Gemini native-audio: Generating initial greeting turn autonomously.")
                try:
                    await session.generate_reply()
                except Exception as _gr_exc:
                    await _log("warning", f"generate_reply (native-audio) failed: {_gr_exc}")
        else:
            # Fallback logic for older pipeline models that still need to be "poked"
            if first_message:
                _fm_text = first_message.replace("{lead_name}", lead_name).replace("{business_name}", business_name).replace("{service_type}", service_type)
            else:
                _fm_text = f"Ah, hello! Am I speaking with {lead_name}?"
            try:
                await session.generate_reply(instructions=f"Say EXACTLY this as your first words: {_fm_text}")
            except Exception as _gr_exc:
                await _log("warning", f"generate_reply failed: {_gr_exc}")
    else:
        await _log("info", "User Speaks First configured: skipping initial AI greeting.")

    # ── Keep session alive until SIP participant actually leaves ─────────────
    if phone_number:
        _sip_identity = f"sip_{phone_number}"
        _disconnect_event = asyncio.Event()

        def _on_participant_disconnected(participant: rtc.RemoteParticipant):
            if participant.identity == _sip_identity:
                _disconnect_event.set()
        def _on_disconnected():
            _disconnect_event.set()

        ctx.room.on("participant_disconnected", _on_participant_disconnected)
        ctx.room.on("disconnected", _on_disconnected)

        try:
            await asyncio.wait_for(_disconnect_event.wait(), timeout=3600)
        except asyncio.TimeoutError:
            await _log("warning", "Call reached 1-hour safety timeout — shutting down")

        await _log("info", f"SIP participant disconnected — ending session for {phone_number}")
        await session.aclose()
    else:
        _done = asyncio.Event()
        ctx.room.on("disconnected", lambda: _done.set())
        try:
            await asyncio.wait_for(_done.wait(), timeout=3600)
        except asyncio.TimeoutError:
            pass


if __name__ == "__main__":
    init_db()
    load_db_settings_to_env()
    agents.cli.run_app(
        agents.WorkerOptions(entrypoint_fnc=entrypoint, agent_name="outbound-caller")
    )
