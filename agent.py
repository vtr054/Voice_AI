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

from db import init_db, log_error, get_enabled_tools, get_agent_knowledge_bases, search_knowledge, get_setting, load_mysql_settings_to_env, get_agent_profile, get_all_agent_profiles
from prompts import build_prompt
from tools import AppointmentTools

load_dotenv(".env")
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("outbound-agent")
logging.getLogger("livekit").setLevel(logging.ERROR)

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
    """Load MySQL settings table into os.environ before worker starts."""
    try:
        load_mysql_settings_to_env()
    except Exception as exc:
        logger.warning("Could not load settings from MySQL: %s", exc)


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


async def record_mixer(mixer: rtc.AudioMixer, filepath: str) -> None:
    """Stream mixed audio frames from rtc.AudioMixer to a local WAV file."""
    import wave
    try:
        with wave.open(filepath, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2) # 16-bit PCM (2 bytes)
            wav_file.setframerate(16000)
            
            async for frame in mixer:
                wav_file.writeframes(frame.data)
    except Exception as exc:
        logger.error(f"Error in record_mixer: {exc}")


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

    is_inbound: bool = False

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
            is_inbound = data.get("inbound", False)
        except (json.JSONDecodeError, AttributeError):
            await _log("warning", "Invalid JSON in job metadata")

    # Load agent profile if available, or fetch the default profile
    profile = None
    if agent_profile_id:
        try:
            profile = await get_agent_profile(agent_profile_id)
        except Exception as exc:
            await _log("warning", f"Failed to fetch agent profile {agent_profile_id}: {exc}")
            
    if not profile:
        try:
            profiles = await get_all_agent_profiles()
            profile = next((p for p in profiles if p.get("is_default") == 1), None)
            if profile:
                agent_profile_id = profile["id"]
                await _log("info", f"Using default agent profile for call: {profile['name']} ({agent_profile_id})")
        except Exception as exc:
            await _log("warning", f"Failed to load default agent profile: {exc}")

    # Apply profile settings if present
    if profile:
        if not custom_prompt and profile.get("system_prompt"):
            custom_prompt = profile["system_prompt"]
        if profile.get("voice_prompt_override"):
            custom_prompt = ((custom_prompt or "") + "\n\n" + profile["voice_prompt_override"]).strip()
        if not voice_override and profile.get("voice"):
            voice_override = profile["voice"]
        if not model_override and profile.get("model"):
            model_override = profile["model"]
        if not tools_override and profile.get("enabled_tools"):
            tools_override = profile["enabled_tools"]
        if not first_message and profile.get("first_message"):
            first_message = profile["first_message"]
        if initiation == "agent" and profile.get("conversation_initiation"):
            initiation = profile["conversation_initiation"]
        if channel_mode == "voice" and profile.get("channel_mode"):
            channel_mode = profile["channel_mode"]

    agent_name = "Priya"
    if profile and profile.get("name"):
        agent_name = profile["name"].split()[0]

    await _log("info", f"Call job received — phone={phone_number} lead={lead_name} is_inbound={is_inbound} agent={agent_name}")

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

    # If phone_number is not set via metadata, try to extract it from remote participants (inbound call case)
    if not phone_number:
        for identity, participant in ctx.room.remote_participants.items():
            if identity.startswith("sip_"):
                phone_number = identity[4:]
                is_inbound = True
                await _log("info", f"Detected Inbound SIP call from {phone_number}")
                break

    # Enforce Inbound/Outbound enabling settings
    if is_inbound:
        enable_inbound = await get_setting("ENABLE_INBOUND", "true")
        if enable_inbound.lower() == "false":
            await _log("warning", f"Inbound call from {phone_number or 'unknown'} rejected: Inbound calling is disabled.")
            ctx.shutdown()
            return
    else:
        enable_outbound = await get_setting("ENABLE_OUTBOUND", "true")
        if enable_outbound.lower() == "false":
            await _log("warning", f"Outbound call to {phone_number or 'unknown'} rejected: Outbound calling is disabled.")
            ctx.shutdown()
            return

    # If it is an inbound call, try to resolve the caller's name from CRM/appointments
    if is_inbound and phone_number:
        try:
            from db import get_calls_by_phone, get_appointments_by_phone
            resolved_name = None
            appointments = await get_appointments_by_phone(phone_number)
            if appointments:
                resolved_name = appointments[0].get("name")
            if not resolved_name:
                calls = await get_calls_by_phone(phone_number)
                for call in calls:
                    if call.get("lead_name") and call.get("lead_name") != "there":
                        resolved_name = call.get("lead_name")
                        break
            if resolved_name:
                lead_name = resolved_name
                await _log("info", f"Resolved inbound caller name: {lead_name}")
        except Exception as exc:
            await _log("warning", f"Failed caller name lookup: {exc}")

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
                                  channel=channel_mode, knowledge_context=knowledge_context,
                                  is_inbound=is_inbound, agent_name=agent_name)
    
    # ── Option 2 Implementation: Inject dynamic greeting before session starts ──
    if is_inbound:
        if first_message:
            _fm = first_message.replace("{lead_name}", lead_name).replace("{business_name}", business_name).replace("{service_type}", service_type).replace("{agent_name}", agent_name)
        else:
            inbound_greeting_template = os.getenv("INBOUND_GREETING") or "Thank you for calling {business_name}! This is {agent_name}. How can I help you today?"
            greeting_template = inbound_greeting_template.replace("{agent_name}", agent_name)
            _fm = greeting_template.replace("{lead_name}", lead_name).replace("{business_name}", business_name).replace("{service_type}", service_type)
        system_prompt += (
            f"\n\nCRITICAL INSTRUCTION: You are a receptionist answering an incoming call. "
            f"You MUST greet the caller immediately upon connection. Speak first. "
            f"Your very first sentence must be exactly: '{_fm}'"
        )
    elif initiation == "user":
        system_prompt += "\n\nIMPORTANT INSTRUCTION: DO NOT SPEAK FIRST. The call has just connected. Wait silently until the user says something before you begin speaking."
    elif initiation == "agent" and is_native_audio:
        if first_message:
            _fm = first_message.replace("{lead_name}", lead_name).replace("{business_name}", business_name).replace("{service_type}", service_type).replace("{agent_name}", agent_name)
        else:
            _fm = f"Ah, hello! Am I speaking with {lead_name}?"
        system_prompt += (
            f"\n\nCRITICAL INSTRUCTION: You are an outbound dialer. The user does not know you are calling. "
            f"You MUST initiate the conversation. Speak immediately upon connection. Do not wait for a prompt or greeting from the user. "
            f"Your very first sentence must be exactly: '{_fm}'"
        )

    tool_ctx = AppointmentTools(ctx, phone_number, lead_name, agent_profile_id=agent_profile_id, is_inbound=is_inbound)

    # ── Local call recording ──────────────────────────────────────────────────
    audio_mixer = rtc.AudioMixer(sample_rate=16000, num_channels=1)
    local_filepath = f"temp_{tool_ctx.call_id}.wav"
    recording_task = asyncio.create_task(record_mixer(audio_mixer, local_filepath))
    
    # Silence generator keeps the AudioMixer running in real-time even during silent phases
    async def silence_generator():
        samples_per_frame = 320 # 16000Hz * 20ms = 320 samples
        silent_data = bytes(samples_per_frame * 2) # 16-bit PCM (2 bytes/sample)
        try:
            while True:
                frame = rtc.AudioFrame(
                    data=silent_data,
                    sample_rate=16000,
                    num_channels=1,
                    samples_per_channel=samples_per_frame
                )
                yield frame
                await asyncio.sleep(0.02)
        except asyncio.CancelledError:
            pass

    audio_mixer.add_stream(silence_generator())

    # Agent audio queue and generator to capture outgoing agent speech frames
    agent_audio_queue = asyncio.Queue()

    async def agent_frame_generator():
        try:
            while True:
                frame = await agent_audio_queue.get()
                if frame is None:
                    break
                yield frame
        except asyncio.CancelledError:
            pass

    audio_mixer.add_stream(agent_frame_generator())

    added_tracks = {}

    async def frame_generator(track: rtc.Track):
        stream = rtc.AudioStream(track, sample_rate=16000, num_channels=1)
        try:
            async for event in stream:
                yield event.frame
        finally:
            await stream.aclose()

    def add_track_to_mixer(track: rtc.Track):
        if not track:
            return
        if track.sid in added_tracks:
            return
        # Skip local participant track since we record it via audio_output patch
        local_part = ctx.room.local_participant
        if local_part and (track.sid == local_part.sid or any(pub.track and pub.track.sid == track.sid for pub in local_part.track_publications.values())):
            return
        logger.info(f"🎙️ Creating audio stream wrapper for track {track.sid}")
        gen = frame_generator(track)
        added_tracks[track.sid] = gen
        audio_mixer.add_stream(gen)
        logger.info(f"🎙️ Added audio track {track.sid} wrapper to mixer.")

    def remove_track_from_mixer(track: rtc.Track):
        if not track:
            return
        gen = added_tracks.pop(track.sid, None)
        if gen:
            audio_mixer.remove_stream(gen)
            logger.info(f"🎙️ Removed audio track {track.sid} wrapper from mixer.")

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track: rtc.Track, publication: rtc.TrackPublication, participant: rtc.RemoteParticipant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            add_track_to_mixer(track)

    @ctx.room.on("track_unsubscribed")
    def on_track_unsubscribed(track: rtc.Track, publication: rtc.RemoteTrackPublication, participant: rtc.RemoteParticipant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            remove_track_from_mixer(track)

    @ctx.room.on("local_track_published")
    def on_local_track_published(publication: rtc.LocalTrackPublication, participant: rtc.LocalParticipant):
        if publication.track and publication.track.kind == rtc.TrackKind.KIND_AUDIO:
            add_track_to_mixer(publication.track)

    @ctx.room.on("local_track_unpublished")
    def on_local_track_unpublished(publication: rtc.LocalTrackPublication, participant: rtc.LocalParticipant = None):
        if publication.track and publication.track.kind == rtc.TrackKind.KIND_AUDIO:
            remove_track_from_mixer(publication.track)

    # Add any existing subscribed remote tracks
    for participant in ctx.room.remote_participants.values():
        for publication in participant.track_publications.values():
            if publication.subscribed and publication.track and publication.track.kind == rtc.TrackKind.KIND_AUDIO:
                add_track_to_mixer(publication.track)

    # Add existing local participant tracks
    for publication in ctx.room.local_participant.track_publications.values():
        if publication.track and publication.track.kind == rtc.TrackKind.KIND_AUDIO:
            add_track_to_mixer(publication.track)

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

    # Patch the agent's audio output to capture outgoing audio frames
    agent_resampler = None
    resampler_input_rate = 0

    if session.room_io and session.room_io.audio_output:
        original_capture_frame = session.room_io.audio_output.capture_frame
        async def patched_capture_frame(frame: rtc.AudioFrame):
            nonlocal agent_resampler, resampler_input_rate
            if frame.sample_rate != 16000:
                if agent_resampler is None or resampler_input_rate != frame.sample_rate:
                    agent_resampler = rtc.AudioResampler(
                        input_rate=frame.sample_rate,
                        output_rate=16000,
                        num_channels=1,
                    )
                    resampler_input_rate = frame.sample_rate
                for resampled_frame in agent_resampler.push(frame):
                    agent_audio_queue.put_nowait(resampled_frame)
            else:
                agent_audio_queue.put_nowait(frame)
            await original_capture_frame(frame)
        session.room_io.audio_output.capture_frame = patched_capture_frame
        logger.info("🎙️ Patched agent audio_output.capture_frame for recording.")

    # Listen to playback finished event for auto-hangup
    if session.room_io and session.room_io.audio_output:
        @session.room_io.audio_output.on("playback_finished")
        def on_playback_finished(ev):
            logger.info("🎙️ Agent audio playback finished event received.")
            if getattr(tool_ctx, "call_ending", False) == "goodbye_speaking":
                logger.info("🎙️ Agent finished speaking final goodbye. Scheduling deferred disconnect.")
                async def deferred_disconnect():
                    await asyncio.sleep(1.5)
                    try:
                        await ctx.room.disconnect()
                    except Exception as e:
                        logger.error(f"Error disconnecting room in deferred_disconnect: {e}")
                asyncio.create_task(deferred_disconnect())

        @session.on("agent_state_changed")
        def on_agent_state_changed(ev):
            if ev.new_state == "speaking":
                if getattr(tool_ctx, "call_ending", False) == "scheduled":
                    tool_ctx.call_ending = "goodbye_speaking"
                    logger.info("🎙️ Agent started speaking final goodbye.")

    # ── Greeting ─────────────────────────────────────────────────────────────
    if initiation == "agent":
        if is_native_audio:
            if not is_gemini_3_1:
                # Tell the RealtimeModel to generate the initial greeting turn autonomously
                await _log("info", "Gemini native-audio: Generating initial greeting turn autonomously.")
                try:
                    await session.generate_reply()
                except Exception as _gr_exc:
                    await _log("warning", f"generate_reply (native-audio) failed: {_gr_exc}")
            else:
                await _log("info", "Gemini 3.1 native-audio: Initial greeting turn triggered via initial_chat_ctx.")
        else:
            # Fallback logic for older pipeline models that still need to be "poked"
            if first_message:
                _fm_text = first_message.replace("{lead_name}", lead_name).replace("{business_name}", business_name).replace("{service_type}", service_type).replace("{agent_name}", agent_name)
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

    # ── Stop recording and write to MySQL DB ──────────────────────────────────
    import contextlib
    try:
        if agent_resampler:
            for resampled_frame in agent_resampler.flush():
                agent_audio_queue.put_nowait(resampled_frame)
        # Signal agent frame generator to stop
        agent_audio_queue.put_nowait(None)
        
        recording_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await recording_task
        await audio_mixer.aclose()
    except Exception as cleanup_exc:
        logger.error(f"Error closing recording mixer: {cleanup_exc}")

    if os.path.exists(local_filepath):
        try:
            with open(local_filepath, "rb") as f:
                wav_bytes = f.read()
            if wav_bytes:
                from db import save_call_recording
                await save_call_recording(tool_ctx.call_id, wav_bytes, f"{tool_ctx.call_id}.wav", "audio/wav")
                await _log("info", f"Successfully saved call recording to MySQL: call_id={tool_ctx.call_id}")
        except Exception as save_exc:
            logger.error(f"Failed to save recording to MySQL: {save_exc}")
        finally:
            try:
                os.remove(local_filepath)
            except Exception:
                pass

    # ── Format and save transcript to MySQL DB ────────────────────────────────
    try:
        transcript_text = ""
        for msg in session.history.messages():
            role = msg.role
            if role == "system":
                continue
            
            content = ""
            if isinstance(msg.content, list):
                parts = []
                for part in msg.content:
                    if isinstance(part, str):
                        parts.append(part)
                    elif hasattr(part, "text"):
                        parts.append(part.text)
                    else:
                        parts.append(str(part))
                content = " ".join(parts).strip()
            elif isinstance(msg.content, str):
                content = msg.content.strip()
            
            if not content:
                continue
                
            # Filter out placeholder dot message
            if content == ".":
                continue
                
            role_label = "Agent" if role == "assistant" else "User"
            transcript_text += f"{role_label}: {content}\n\n"
            
        if transcript_text:
            from db import save_call_transcript
            await save_call_transcript(tool_ctx.call_id, transcript_text.strip())
            await _log("info", f"Successfully saved call transcript to MySQL: call_id={tool_ctx.call_id}")
    except Exception as trans_exc:
        logger.error(f"Failed to save transcript to MySQL: {trans_exc}")


if __name__ == "__main__":
    init_db()
    load_db_settings_to_env()
    agents.cli.run_app(
        agents.WorkerOptions(entrypoint_fnc=entrypoint, agent_name="outbound-caller")
    )
