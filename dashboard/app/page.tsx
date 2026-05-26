"use client";

import {
  BarChart3,
  BookOpen,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Database,
  FileText,
  Headphones,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  AlertCircle,
  Clock,
  Play,
  Trash2,
  Pause,
  Volume2,
  RefreshCw,
  Key,
  Sliders,
  Calendar,
  X,
  ChevronRight,
  Edit3,
  Star
} from "lucide-react";
import { useState, useEffect, useTransition } from "react";

// --- NAVIGATION ---
const navGroups = [
  {
    label: "Observe",
    items: [
      { id: "dashboard", label: "Dashboard", icon: BarChart3 },
      { id: "calls", label: "Call Logs", icon: Phone },
      { id: "logs", label: "System Logs", icon: ClipboardList },
    ],
  },
  {
    label: "Build",
    items: [
      { id: "agents", label: "Agents", icon: Bot },
      { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
      { id: "prompt", label: "AI Prompt", icon: FileText },
    ],
  },
  {
    label: "Engage",
    items: [
      { id: "single", label: "Single Call", icon: Headphones },
      { id: "campaigns", label: "Campaigns", icon: Users },
      { id: "appointments", label: "Appointments", icon: CalendarCheck },
    ],
  },
  {
    label: "Admin",
    items: [{ id: "settings", label: "Settings", icon: Settings }],
  },
];

// --- UTILITY FOR DATES ---
function fmtDate(isoStr?: string) {
  if (!isoStr) return "Never";
  try {
    const d = new Date(isoStr);
    return d.toLocaleString();
  } catch (e) {
    return isoStr;
  }
}

// --- API CLIENT ---
const apiFetch = async (path: string, opts?: RequestInit) => {
  const res = await fetch(path, opts);
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const errData = await res.json();
      msg = errData.detail || errData.error || msg;
    } catch (e) {}
    throw new Error(msg);
  }
  return res.json();
};

const apiPost = (path: string, body: any) =>
  apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const apiPut = (path: string, body: any) =>
  apiFetch(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const apiPatch = (path: string, body: any) =>
  apiFetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const apiDel = (path: string) => apiFetch(path, { method: "DELETE" });

// --- BADGE ---
function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "green" | "amber" | "blue" | "red" }) {
  const classes = {
    default: "border-white/10 bg-white/[0.04] text-slate-300",
    green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    blue: "border-sky-400/20 bg-sky-400/10 text-sky-200",
    red: "border-rose-400/20 bg-rose-400/10 text-rose-200",
  };
  return <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${classes[tone]}`}>{children}</span>;
}

function SectionTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">{eyebrow}</div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{description}</p>
      </div>
      {action}
    </div>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 transition-colors hover:bg-white/[0.04]">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{helper}</div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, action }: { icon: any; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.05]">
        <Icon className="h-7 w-7 text-slate-400" />
      </div>
      <h3 className="text-lg font-medium text-white">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

// --- OUTCOME MAP ---
function getOutcomeTone(outcome?: string) {
  if (!outcome) return "default";
  const maps: Record<string, "default" | "green" | "amber" | "blue" | "red"> = {
    booked: "green",
    completed: "green",
    active: "blue",
    not_interested: "red",
    failed: "red",
    wrong_number: "red",
    cancelled: "amber",
    voicemail: "amber",
    no_answer: "amber",
  };
  return maps[outcome] || "default";
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DASHBOARD PANEL
// ─────────────────────────────────────────────────────────────────────────────
function DashboardPanel({ stats, agents, onNavigate }: { stats: any; agents: any[]; onNavigate: (tab: string) => void }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle
        eyebrow="Command Center"
        title="Operational Overview"
        description="Manage voice calls, text agents, shared knowledge, appointments, and campaign workflows from one operational console."
        action={
          <button
            onClick={() => onNavigate("agents")}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Sparkles className="h-4 w-4" /> Create Agent
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Calls Placed" value={stats?.total_calls ?? 0} helper="All-time dial count" />
        <MetricCard label="Appointments Booked" value={stats?.booked ?? 0} helper="Successful schedules" />
        <MetricCard label="Booking Rate" value={`${stats?.booking_rate_percent ?? 0}%`} helper="Total success conversion" />
        <MetricCard label="Avg Duration" value={`${stats?.avg_duration_seconds ?? 0}s`} helper="Average customer talk time" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Agent Readiness</h3>
              <p className="text-sm text-slate-400">Active profiles configured for outbound dialing or chat interactions.</p>
            </div>
            <Badge tone="green">Live</Badge>
          </div>
          <div className="space-y-4">
            {agents.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No agent profiles created yet. Navigate to Agents to configure.</div>
            ) : (
              agents.map((agent) => (
                <div
                  key={agent.id}
                  className="grid gap-4 rounded-lg border border-white/5 bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04] md:grid-cols-[1fr_150px_140px] md:items-center"
                >
                  <div>
                    <div className="font-medium text-white flex items-center gap-2">
                      {agent.name}
                      {agent.is_default === 1 && (
                        <span className="text-[10px] bg-amber-400/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-400/30">Default</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-slate-400 truncate max-w-sm">Prompt: {agent.system_prompt || "Global default prompt"}</div>
                  </div>
                  <div>
                    <Badge tone={agent.channel_mode === "text" ? "blue" : agent.channel_mode === "both" ? "green" : "default"}>
                      {agent.channel_mode === "both" ? "Voice + Text" : agent.channel_mode === "text" ? "Text Only" : "Voice Only"}
                    </Badge>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs text-slate-400">
                      <span>Threshold</span>
                      <span>{Math.round((agent.knowledge_confidence_threshold || 0.55) * 100)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all duration-1000"
                        style={{ width: `${(agent.knowledge_confidence_threshold || 0.55) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <h3 className="font-semibold text-white">System Diagnostics</h3>
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.01] p-3 text-sm text-slate-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              Keep outbound trunk connected in Settings.
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.01] p-3 text-sm text-slate-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              Configure Google Gemini credentials for Live Voice.
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.01] p-3 text-sm text-slate-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              Pre-load FAQs in Knowledge Base to minimize LLM hallucinations.
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.01] p-3 text-sm text-slate-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              Use Single Call console for instant dialing testing.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CALL LOGS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function CallsPanel({ toastOk, toastErr }: { toastOk: (msg: string) => void; toastErr: (msg: string) => void }) {
  const [calls, setCalls] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchCalls = async (p: number) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/calls?page=${p}&limit=20`);
      setCalls(data || []);
      setPage(p);
    } catch (e: any) {
      toastErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls(1);
  }, []);

  const handleNotesChange = async (callId: string, notes: string) => {
    try {
      await apiPatch(`/api/calls/${callId}/notes`, { notes });
      toastOk("Notes updated");
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle
        eyebrow="Call Registry"
        title="Outbound Calls Log"
        description="Review all calls initiated by the AI agents, analyze call outcomes, and download/listen to call recording logs."
        action={
          <button
            onClick={() => fetchCalls(page)}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.06] cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent"></div>
        </div>
      ) : calls.length === 0 ? (
        <EmptyState icon={Phone} title="No calls recorded yet" description="All outbound calls triggered from campaigns or single-call UI will appear here." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Timestamp</th>
                  <th className="px-6 py-4 font-medium">Phone Number</th>
                  <th className="px-6 py-4 font-medium">Lead</th>
                  <th className="px-6 py-4 font-medium">Outcome</th>
                  <th className="px-6 py-4 font-medium">Duration</th>
                  <th className="px-6 py-4 font-medium">Recording</th>
                  <th className="px-6 py-4 font-medium">Reason & Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {calls.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.01]">
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">{fmtDate(c.timestamp)}</td>
                    <td className="px-6 py-4 font-medium text-white">{c.phone_number}</td>
                    <td className="px-6 py-4 text-slate-300">{c.lead_name || "-"}</td>
                    <td className="px-6 py-4">
                      <Badge tone={getOutcomeTone(c.outcome)}>{c.outcome?.replace("_", " ") || "unknown"}</Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{c.duration_seconds ? `${c.duration_seconds}s` : "-"}</td>
                    <td className="px-6 py-4">
                      {c.recording_url ? (
                        <a
                          href={c.recording_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
                        >
                          <Volume2 className="h-3.5 w-3.5" /> Play Audio
                        </a>
                      ) : (
                        <span className="text-xs text-slate-600">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-slate-400 mb-1 max-w-[200px] truncate" title={c.reason}>
                        {c.reason || ""}
                      </div>
                      <textarea
                        defaultValue={c.notes || ""}
                        onBlur={(e) => handleNotesChange(c.id, e.target.value)}
                        placeholder="Add call notes..."
                        className="w-full max-w-[250px] rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-white outline-none focus:border-amber-400"
                        rows={1}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-white/5 bg-white/[0.01] px-6 py-4">
            <button
              onClick={() => page > 1 && fetchCalls(page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.05] disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-slate-400 font-medium">Page {page}</span>
            <button
              onClick={() => fetchCalls(page + 1)}
              disabled={calls.length < 20}
              className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/[0.05] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SYSTEM LOGS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function LogsPanel({ toastOk, toastErr }: { toastOk: (msg: string) => void; toastErr: (msg: string) => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [level, setLevel] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchLogs = async (lvl: string) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/logs?limit=100${lvl ? `&level=${lvl}` : ""}`);
      setLogs(data || []);
      setLevel(lvl);
    } catch (e: any) {
      toastErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to clear system logs?")) return;
    try {
      await apiDel("/api/logs");
      toastOk("Logs cleared");
      fetchLogs(level);
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  useEffect(() => {
    fetchLogs("");
    const interval = setInterval(() => fetchLogs(level), 5000);
    return () => clearInterval(interval);
  }, [level]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle
        eyebrow="Diagnostics"
        title="Live Worker Logs"
        description="Inspect background execution details, webhook notifications, Supabase database connections, and AI pipeline status."
        action={
          <div className="flex gap-2">
            <button
              onClick={handleClearLogs}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-500/20 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" /> Clear Logs
            </button>
            <button
              onClick={() => fetchLogs(level)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/[0.06] cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
          </div>
        }
      />

      <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Severity:</span>
          <select
            value={level}
            onChange={(e) => fetchLogs(e.target.value)}
            className="rounded-lg border border-white/10 bg-black px-3 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none"
          >
            <option value="">All Logs</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
        <div className="text-xs text-slate-500">Auto-refreshing every 5 seconds</div>
      </div>

      {loading && logs.length === 0 ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent"></div>
        </div>
      ) : logs.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Log register is empty" description="Diagnostics details will write here automatically as agents perform operations." />
      ) : (
        <div className="rounded-xl border border-white/10 bg-[#040810] p-4 font-mono text-xs leading-relaxed text-slate-300">
          <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2">
            {logs.map((log) => {
              const logLvl = log.level || "info";
              const lvlColor = logLvl === "error" ? "text-rose-400" : logLvl === "warning" ? "text-amber-400" : "text-sky-400";
              return (
                <div key={log.id} className="border-b border-white/[0.02] pb-1.5 hover:bg-white/[0.01]">
                  <span className="text-slate-500">[{fmtDate(log.timestamp)}]</span>{" "}
                  <span className={`font-semibold uppercase ${lvlColor}`}>[{logLvl}]</span>{" "}
                  <span className="text-amber-400 font-semibold">[{log.source}]</span> {log.message}
                  {log.detail && <div className="mt-1 pl-6 text-[11px] text-slate-500 whitespace-pre-wrap">{log.detail}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. AGENTS PROFILE PANEL
// ─────────────────────────────────────────────────────────────────────────────
function AgentsPanel({
  agentProfiles,
  reloadAgentProfiles,
  knowledgeBases,
  toastOk,
  toastErr,
}: {
  agentProfiles: any[];
  reloadAgentProfiles: () => void;
  knowledgeBases: any[];
  toastOk: (msg: string) => void;
  toastErr: (msg: string) => void;
}) {
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [voice, setVoice] = useState("Aoede");
  const [model, setModel] = useState("gemini-3.1-flash-live-preview");
  const [channelMode, setChannelMode] = useState("voice");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [voicePromptOverride, setVoicePromptOverride] = useState("");
  const [textPromptOverride, setTextPromptOverride] = useState("");
  const [enabledTools, setEnabledTools] = useState(
    '["check_availability", "book_appointment", "end_call", "lookup_contact", "remember_details", "search_knowledge"]'
  );
  const [conversationInitiation, setConversationInitiation] = useState("agent");
  const [firstMessage, setFirstMessage] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [knowledgeBaseIds, setKnowledgeBaseIds] = useState<string[]>([]);
  const [knowledgeConfidenceThreshold, setKnowledgeConfidenceThreshold] = useState(0.55);

  // Test state
  const [testChannel, setTestChannel] = useState("voice");
  const [testMessage, setTestMessage] = useState("");

  const handleOpenForm = (agent?: any) => {
    if (agent) {
      setSelectedAgent(agent);
      setName(agent.name || "");
      setVoice(agent.voice || "Aoede");
      setModel(agent.model || "gemini-3.1-flash-live-preview");
      setChannelMode(agent.channel_mode || "voice");
      setSystemPrompt(agent.system_prompt || "");
      setVoicePromptOverride(agent.voice_prompt_override || "");
      setTextPromptOverride(agent.text_prompt_override || "");
      setEnabledTools(agent.enabled_tools || "[]");
      setConversationInitiation(agent.conversation_initiation || "agent");
      setFirstMessage(agent.first_message || "");
      setIsDefault(agent.is_default === 1);
      setKnowledgeConfidenceThreshold(agent.knowledge_confidence_threshold || 0.55);
      // Fetch knowledge bases assigned to this agent
      apiFetch(`/api/agent-profiles/${agent.id}`).then((res) => {
        setKnowledgeBaseIds(res.knowledge_base_ids || []);
      });
    } else {
      setSelectedAgent(null);
      setName("");
      setVoice("Aoede");
      setModel("gemini-3.1-flash-live-preview");
      setChannelMode("voice");
      setSystemPrompt("");
      setVoicePromptOverride("");
      setTextPromptOverride("");
      setEnabledTools('["check_availability", "book_appointment", "end_call", "lookup_contact", "remember_details", "search_knowledge"]');
      setConversationInitiation("agent");
      setFirstMessage("");
      setIsDefault(false);
      setKnowledgeBaseIds([]);
      setKnowledgeConfidenceThreshold(0.55);
    }
    setTestResult(null);
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return toastErr("Agent name is required");
    const payload = {
      name,
      voice,
      model,
      system_prompt: systemPrompt,
      enabled_tools: enabledTools,
      is_default: isDefault,
      conversation_initiation: conversationInitiation,
      first_message: firstMessage,
      channel_mode: channelMode,
      voice_prompt_override: voicePromptOverride,
      text_prompt_override: textPromptOverride,
      knowledge_base_ids: knowledgeBaseIds,
      knowledge_confidence_threshold: Number(knowledgeConfidenceThreshold),
    };

    try {
      if (selectedAgent) {
        await apiPut(`/api/agent-profiles/${selectedAgent.id}`, payload);
        toastOk("Agent profile updated");
      } else {
        await apiPost("/api/agent-profiles", payload);
        toastOk("Agent profile created");
      }
      setIsFormOpen(false);
      reloadAgentProfiles();
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this agent profile?")) return;
    try {
      await apiDel(`/api/agent-profiles/${id}`);
      toastOk("Agent deleted");
      reloadAgentProfiles();
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await apiPost(`/api/agent-profiles/${id}/set-default`, {});
      toastOk("Default profile set");
      reloadAgentProfiles();
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  const handleTestAgent = async () => {
    if (!selectedAgent) return toastErr("Save the profile first before running diagnostics");
    setTesting(true);
    try {
      const res = await apiPost("/api/agent-test", {
        agent_profile_id: selectedAgent.id,
        channel: testChannel,
        message: testMessage || "Test grounding",
      });
      setTestResult(res);
    } catch (e: any) {
      toastErr(e.message);
    } finally {
      setTesting(false);
    }
  };

  const handleKbToggle = (kbId: string) => {
    setKnowledgeBaseIds((prev) => (prev.includes(kbId) ? prev.filter((id) => id !== kbId) : [...prev, kbId]));
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle
        eyebrow="AI Settings"
        title="Agent Personas"
        description="Configure voice models, system prompt behaviors, TTS personalities, fallback safety thresholds, and active knowledge bases."
        action={
          <button
            onClick={() => handleOpenForm()}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.02] cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Create Agent
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        {/* Profile List */}
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Channel</th>
                  <th className="px-6 py-4 font-medium">Voice</th>
                  <th className="px-6 py-4 font-medium">LLM Model</th>
                  <th className="px-6 py-4 font-medium">Tools</th>
                  <th className="px-6 py-4 font-medium">Default</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {agentProfiles.map((a) => (
                  <tr key={a.id} className="hover:bg-white/[0.01]">
                    <td className="px-6 py-4 font-semibold text-white">{a.name}</td>
                    <td className="px-6 py-4">
                      <Badge tone={a.channel_mode === "text" ? "blue" : a.channel_mode === "both" ? "green" : "default"}>
                        {a.channel_mode === "both" ? "Voice + Text" : a.channel_mode === "text" ? "Text Only" : "Voice Only"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{a.voice}</td>
                    <td className="px-6 py-4 text-xs text-slate-400 font-mono">{a.model}</td>
                    <td className="px-6 py-4 text-xs text-slate-400 max-w-[200px] truncate" title={a.enabled_tools}>
                      {a.enabled_tools || "[]"}
                    </td>
                    <td className="px-6 py-4">
                      {a.is_default === 1 ? <Badge tone="amber">Default</Badge> : <span className="text-xs text-slate-600">No</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleOpenForm(a)}
                          className="p-1.5 rounded bg-white/5 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                          title="Edit"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        {a.is_default !== 1 && (
                          <button
                            onClick={() => handleSetDefault(a.id)}
                            className="p-1.5 rounded bg-white/5 border border-white/10 text-amber-400 hover:text-amber-300 cursor-pointer"
                            title="Set Default"
                          >
                            <Star className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(a.id)}
                          className="p-1.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Editor Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl border border-white/10 bg-[#08111f] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <button onClick={() => setIsFormOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer">
              <X className="h-6 w-6" />
            </button>

            <h3 className="text-xl font-semibold text-white mb-1">{selectedAgent ? "Edit Agent Persona" : "Create Agent Persona"}</h3>
            <p className="text-xs text-slate-400 mb-6">Modify system-level behavior and speech settings for this agent.</p>

            <div className="grid gap-6 md:grid-cols-2 max-h-[70vh] overflow-y-auto pr-2">
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Agent Persona Name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                    placeholder="e.g. Priya Appointment Setter"
                  />
                </label>

                <div className="grid gap-4 grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">TTS Voice ID</span>
                    <select
                      value={voice}
                      onChange={(e) => setVoice(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                    >
                      <option value="Aoede">Aoede (Female)</option>
                      <option value="Charon">Charon (Male)</option>
                      <option value="Fenrir">Fenrir (Deep Male)</option>
                      <option value="Kore">Kore (Soft Female)</option>
                      <option value="Puck">Puck (Cheerful Male)</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">LLM Engine</span>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400 text-xs"
                    >
                      <option value="gemini-3.1-flash-live-preview">Gemini 3.1 Flash Live (Realtime)</option>
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash (Pipeline)</option>
                      <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Groq Pipeline)</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Channel Mode</span>
                    <select
                      value={channelMode}
                      onChange={(e) => setChannelMode(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                    >
                      <option value="voice">Voice Only</option>
                      <option value="text">Text Only</option>
                      <option value="both">Voice + Text</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Speak Initiation</span>
                    <select
                      value={conversationInitiation}
                      onChange={(e) => setConversationInitiation(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                    >
                      <option value="agent">Agent Speaks First</option>
                      <option value="user">Wait For User First</option>
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">First Greeting Msg</span>
                  <input
                    value={firstMessage}
                    onChange={(e) => setFirstMessage(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                    placeholder="Hello! Am I speaking with {lead_name}?"
                    disabled={conversationInitiation === "user"}
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Tool Bindings (JSON Array)</span>
                  <input
                    value={enabledTools}
                    onChange={(e) => setEnabledTools(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                  />
                </label>

                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded bg-black border-white/10" />
                  <span className="text-xs text-slate-300">Default fallback agent for outbound dialing</span>
                </label>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">System Instruction Prompt</span>
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-xs text-white outline-none focus:border-amber-400 min-h-[120px]"
                    placeholder="You are Priya, a customer success agent booking slots..."
                  />
                </label>

                <div className="grid gap-4 grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Voice Prompt Extra</span>
                    <textarea
                      value={voicePromptOverride}
                      onChange={(e) => setVoicePromptOverride(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-[11px] text-white outline-none focus:border-amber-400 min-h-[60px]"
                      placeholder="Add tone guidelines for voice"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Text Prompt Extra</span>
                    <textarea
                      value={textPromptOverride}
                      onChange={(e) => setTextPromptOverride(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-[11px] text-white outline-none focus:border-amber-400 min-h-[60px]"
                      placeholder="Add grammar guidelines for text chat"
                    />
                  </label>
                </div>

                <div>
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Attached Knowledge Bases</span>
                  <div className="max-h-[100px] overflow-y-auto border border-white/10 rounded-lg bg-black/40 p-2 space-y-1">
                    {knowledgeBases.map((kb) => (
                      <label key={kb.id} className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                        <input
                          type="checkbox"
                          checked={knowledgeBaseIds.includes(kb.id)}
                          onChange={() => handleKbToggle(kb.id)}
                          className="rounded border-white/10 bg-black"
                        />
                        {kb.name}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <span>Knowledge Match Threshold</span>
                    <span className="text-amber-400">{Math.round(knowledgeConfidenceThreshold * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={knowledgeConfidenceThreshold}
                    onChange={(e) => setKnowledgeConfidenceThreshold(Number(e.target.value))}
                    className="w-full accent-amber-400 bg-white/10"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-between gap-3 border-t border-white/10 pt-4">
              <div>
                {selectedAgent && (
                  <div className="flex gap-2">
                    <select
                      value={testChannel}
                      onChange={(e) => setTestChannel(e.target.value)}
                      className="rounded-lg border border-white/10 bg-black text-xs text-white px-2 py-1 outline-none"
                    >
                      <option value="voice">Voice test</option>
                      <option value="text">Text test</option>
                    </select>
                    <input
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      placeholder="Ask the agent a question..."
                      className="rounded-lg border border-white/10 bg-black text-xs text-white px-3 py-1 outline-none w-48"
                    />
                    <button
                      onClick={handleTestAgent}
                      disabled={testing}
                      className="rounded-lg bg-amber-400 px-3 py-1 text-xs font-bold text-slate-950 hover:scale-[1.02] cursor-pointer"
                    >
                      {testing ? "Testing..." : "Test KB Grounding"}
                    </button>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.05] cursor-pointer"
                >
                  Cancel
                </button>
                <button onClick={handleSave} className="rounded-lg bg-amber-400 px-5 py-2 text-sm font-bold text-slate-950 hover:scale-[1.02] cursor-pointer">
                  Save Persona
                </button>
              </div>
            </div>

            {testResult && (
              <div className="mt-4 rounded-lg border border-white/10 bg-[#0c1424] p-4 text-xs animate-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
                  <div className="font-semibold text-slate-300">
                    Source: <span className="text-amber-400">{testResult.source}</span>
                  </div>
                  <Badge tone={testResult.fallback_triggered ? "amber" : "green"}>{testResult.fallback_triggered ? "Fallback Wording" : "Grounded Reply"}</Badge>
                </div>
                <div className="text-slate-200 leading-relaxed font-mono whitespace-pre-wrap">{testResult.response}</div>
                <div className="mt-2 text-slate-500 text-[10px]">
                  Confidence Score: {Number(testResult.confidence || 0).toFixed(2)} | Required Threshold: {Number(testResult.threshold || 0).toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. KNOWLEDGE BASE PANEL
// ─────────────────────────────────────────────────────────────────────────────
function KnowledgePanel({
  knowledgeBases,
  reloadKnowledgeBases,
  toastOk,
  toastErr,
}: {
  knowledgeBases: any[];
  reloadKnowledgeBases: () => void;
  toastOk: (msg: string) => void;
  toastErr: (msg: string) => void;
}) {
  const [selectedBaseId, setSelectedBaseId] = useState("");
  const [activeBase, setActiveBase] = useState<any | null>(null);
  const [isBaseFormOpen, setIsBaseFormOpen] = useState(false);

  // New Base Form
  const [baseName, setBaseName] = useState("");
  const [baseDesc, setBaseDesc] = useState("");

  // New Entry Form
  const [entryTitle, setEntryTitle] = useState("");
  const [entryContentType, setEntryContentType] = useState("business_info");
  const [entryCategory, setEntryCategory] = useState("");
  const [entryContent, setEntryContent] = useState("");
  const [entryTags, setEntryTags] = useState("");

  const loadBaseDetails = async (id: string) => {
    try {
      const data = await apiFetch(`/api/knowledge-bases/${id}`);
      setActiveBase(data);
      setSelectedBaseId(id);
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  useEffect(() => {
    if (knowledgeBases.length > 0 && !selectedBaseId) {
      loadBaseDetails(knowledgeBases[0].id);
    }
  }, [knowledgeBases]);

  const handleCreateBase = async () => {
    if (!baseName.trim()) return toastErr("Name is required");
    try {
      await apiPost("/api/knowledge-bases", { name: baseName, description: baseDesc });
      toastOk("Knowledge base created");
      setIsBaseFormOpen(false);
      setBaseName("");
      setBaseDesc("");
      reloadKnowledgeBases();
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  const handleDeleteBase = async (id: string) => {
    if (!confirm("Are you sure you want to delete this library and all its text chunks?")) return;
    try {
      await apiDel(`/api/knowledge-bases/${id}`);
      toastOk("Library deleted");
      setActiveBase(null);
      setSelectedBaseId("");
      reloadKnowledgeBases();
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  const handleAddEntry = async () => {
    if (!entryTitle.trim() || !entryContent.trim()) return toastErr("Title and Content are required");
    try {
      await apiPost(`/api/knowledge-bases/${selectedBaseId}/entries`, {
        title: entryTitle,
        content: entryContent,
        content_type: entryContentType,
        category: entryCategory,
        tags: entryTags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      toastOk("Knowledge chunk saved");
      setEntryTitle("");
      setEntryContent("");
      setEntryCategory("");
      setEntryTags("");
      loadBaseDetails(selectedBaseId);
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm("Delete this knowledge entry?")) return;
    try {
      await apiDel(`/api/knowledge-entries/${id}`);
      toastOk("Entry deleted");
      loadBaseDetails(selectedBaseId);
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  const applyTemplate = (type: string) => {
    const templates: Record<string, { title: string; category: string; content: string; tags: string }> = {
      faq: {
        title: "FAQ: ",
        category: "FAQ",
        content: "Question:\n\nAnswer:\n\nWhen to use this answer:\n",
        tags: "faq",
      },
      pricing: {
        title: "Pricing: ",
        category: "Pricing",
        content: "Plan or service:\nPrice:\nIncludes:\nLimitations:\nBest for:\n",
        tags: "pricing",
      },
      objection: {
        title: "Objection: ",
        category: "Sales",
        content: "Customer objection:\nRecommended response:\nFollow-up question:\nWhen to fallback:\n",
        tags: "sales, objection",
      },
      appointment_rule: {
        title: "Appointment Rule: ",
        category: "Scheduling",
        content: "Rule:\nAvailable days/times:\nRequired customer details:\nConfirmation wording:\n",
        tags: "scheduling, rules",
      },
    };
    const t = templates[type];
    if (t) {
      setEntryContentType(type);
      setEntryTitle(t.title);
      setEntryCategory(t.category);
      setEntryContent(t.content);
      setEntryTags(t.tags);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle
        eyebrow="Business Truth Layer"
        title="Grounded Knowledge"
        description="FAQ sheets, service packages, pricing tables, rules, scripts, objection overrides, and appointment options for AI reference."
        action={
          <button
            onClick={() => setIsBaseFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.02] cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Create Base
          </button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        {/* Libraries List */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="border-b border-white/10 p-5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Database className="h-4 w-4 text-amber-400" /> Libraries
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {knowledgeBases.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">No libraries yet.</div>
            ) : (
              knowledgeBases.map((kb) => (
                <button
                  key={kb.id}
                  onClick={() => loadBaseDetails(kb.id)}
                  className={`w-full border-b border-white/5 p-5 text-left transition-colors hover:bg-white/[0.04] ${
                    selectedBaseId === kb.id ? "border-l-4 border-l-amber-400 bg-amber-400/[0.08]" : ""
                  } cursor-pointer`}
                >
                  <div className="font-semibold text-white">{kb.name}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-400 truncate">{kb.description || "Reusable business knowledge"}</div>
                  <div className="mt-3 flex gap-2">
                    <Badge tone="green">{kb.status || "active"}</Badge>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Selected Base Editor */}
        {activeBase ? (
          <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="border-b border-white/10 bg-white/[0.01] p-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">{activeBase.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{activeBase.description || "No description provided."}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDeleteBase(activeBase.id)}
                  className="inline-flex items-center gap-2 rounded-lg bg-rose-500/10 border border-rose-500/20 px-3.5 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Base
                </button>
              </div>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[1fr_0.9fr]">
              {/* Creator Form */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Add Knowledge Entry</h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => applyTemplate("faq")}
                    className="rounded border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08] cursor-pointer"
                  >
                    FAQ
                  </button>
                  <button
                    onClick={() => applyTemplate("pricing")}
                    className="rounded border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08] cursor-pointer"
                  >
                    Pricing
                  </button>
                  <button
                    onClick={() => applyTemplate("objection")}
                    className="rounded border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08] cursor-pointer"
                  >
                    Objection
                  </button>
                  <button
                    onClick={() => applyTemplate("appointment_rule")}
                    className="rounded border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/[0.08] cursor-pointer"
                  >
                    Booking Rule
                  </button>
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Entry Title</span>
                  <input
                    value={entryTitle}
                    onChange={(e) => setEntryTitle(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                    placeholder="e.g. FAQ: What is your refund policy?"
                  />
                </label>

                <div className="grid gap-4 grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Type</span>
                    <select
                      value={entryContentType}
                      onChange={(e) => setEntryContentType(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                    >
                      <option value="business_info">Business Info</option>
                      <option value="faq">FAQ</option>
                      <option value="services">Services</option>
                      <option value="pricing">Pricing</option>
                      <option value="policies">Policies</option>
                      <option value="scripts">Scripts</option>
                      <option value="objection">Objection Handling</option>
                      <option value="appointment_rule">Appointment Rules</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Category</span>
                    <input
                      value={entryCategory}
                      onChange={(e) => setEntryCategory(e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                      placeholder="e.g. Refund Policy"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Content / Script details</span>
                  <textarea
                    value={entryContent}
                    onChange={(e) => setEntryContent(e.target.value)}
                    className="min-h-36 w-full resize-y rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-xs text-white outline-none focus:border-amber-400"
                    placeholder="Add specific answers, terms, or phrases the agent should state..."
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Tags (comma-separated)</span>
                  <input
                    value={entryTags}
                    onChange={(e) => setEntryTags(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-sm text-white outline-none focus:border-amber-400"
                    placeholder="e.g. refunds, policy, money"
                  />
                </label>

                <button
                  onClick={handleAddEntry}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:scale-[1.01] cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Save Grounding Chunk
                </button>
              </div>

              {/* Entries list */}
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Current Grounding Chunks</h4>
                {(!activeBase.entries || activeBase.entries.length === 0) ? (
                  <p className="text-xs text-slate-500">No knowledge entries mapped inside this library yet.</p>
                ) : (
                  activeBase.entries.map((e: any) => (
                    <div key={e.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-4 hover:bg-white/[0.04]">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="font-semibold text-white text-xs">{e.title}</div>
                        <button
                          onClick={() => handleDeleteEntry(e.id)}
                          className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-400 line-clamp-3 mb-2">{e.content}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge>{e.content_type}</Badge>
                        {e.category && <Badge tone="blue">{e.category}</Badge>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState icon={Database} title="Select a Library" description="Create or open a knowledge base library to manage its entries." />
        )}
      </div>

      {/* Create Library modal */}
      {isBaseFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#08111f] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <button onClick={() => setIsBaseFormOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer">
              <X className="h-6 w-6" />
            </button>

            <h3 className="text-lg font-semibold text-white mb-4">Create Knowledge Base</h3>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Library Name</span>
                <input
                  value={baseName}
                  onChange={(e) => setBaseName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                  placeholder="e.g. Pricing Guide"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Description</span>
                <textarea
                  value={baseDesc}
                  onChange={(e) => setBaseDesc(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-xs text-white outline-none focus:border-amber-400"
                  placeholder="Pricing guide for voice support..."
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setIsBaseFormOpen(false)}
                className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.05] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateBase}
                className="rounded-lg bg-amber-400 px-5 py-2 text-sm font-bold text-slate-950 hover:scale-[1.02] cursor-pointer"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. GLOBAL PROMPT PANEL
// ─────────────────────────────────────────────────────────────────────────────
function PromptPanel({ toastOk, toastErr }: { toastOk: (msg: string) => void; toastErr: (msg: string) => void }) {
  const [prompt, setPrompt] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPrompt = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/prompt");
      setPrompt(data.prompt || "");
      setIsCustom(data.is_custom || false);
    } catch (e: any) {
      toastErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await apiPost("/api/prompt", { prompt });
      toastOk("Prompt saved");
      fetchPrompt();
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset the prompt to the system default template?")) return;
    try {
      await apiDel("/api/prompt");
      toastOk("Prompt reset");
      fetchPrompt();
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  useEffect(() => {
    fetchPrompt();
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle
        eyebrow="AI Settings"
        title="Global Base System Prompt"
        description="Set the fallback default personality, core calling script parameters, and agent dialogue instructions when no specific agent profile is selected."
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent"></div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">
              Prompt Status: <Badge tone={isCustom ? "amber" : "default"}>{isCustom ? "Customized Override" : "Default System Template"}</Badge>
            </span>
            <span className="text-xs text-slate-500 font-mono">{prompt.length} characters</span>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[400px] w-full font-mono text-xs leading-relaxed rounded-lg border border-white/10 bg-black/40 p-4 text-white outline-none focus:border-amber-400"
            placeholder="Write core LLM prompts here..."
          />

          <div className="flex justify-between border-t border-white/5 pt-4">
            <button
              onClick={handleReset}
              disabled={!isCustom}
              className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-40 cursor-pointer"
            >
              Reset to Default
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-amber-400 px-6 py-2.5 text-sm font-bold text-slate-950 hover:scale-[1.02] cursor-pointer"
            >
              Save Prompt Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. SINGLE CALL PANEL
// ─────────────────────────────────────────────────────────────────────────────
function SingleCallPanel({ agentProfiles, toastOk, toastErr }: { agentProfiles: any[]; toastOk: (msg: string) => void; toastErr: (msg: string) => void }) {
  const [phone, setPhone] = useState("");
  const [leadName, setLeadName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [agentProfileId, setAgentProfileId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const handleDispatch = async () => {
    if (!phone.trim()) return toastErr("Phone number is required");
    setDispatching(true);
    const payload: any = {
      phone: phone.trim(),
      lead_name: leadName || "there",
      business_name: businessName || "our company",
      service_type: serviceType || "our service",
    };
    if (agentProfileId) payload.agent_profile_id = agentProfileId;
    if (useCustomPrompt && systemPrompt) payload.system_prompt = systemPrompt;

    try {
      await apiPost("/api/call", payload);
      toastOk("Outbound call dispatched successfully!");
      setPhone("");
      setLeadName("");
      setBusinessName("");
      setServiceType("");
      setSystemPrompt("");
      setUseCustomPrompt(false);
    } catch (e: any) {
      toastErr(e.message);
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle
        eyebrow="Direct Dialer"
        title="Initiate Outbound Call"
        description="Perform single outbound calls to test voice pathways, SIP trunk connectivity, prompts, and Cal.com appointment booking tools."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Phone Number (E.164 Format)</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
              placeholder="e.g. +919876543210"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Lead Name</span>
            <input
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
              placeholder="e.g. John Doe"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Business Name</span>
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
              placeholder="e.g. Acme Tech Solutions"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Service Type</span>
            <input
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
              placeholder="e.g. Business Audit Consultation"
            />
          </label>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Select Agent Profile</span>
            <select
              value={agentProfileId}
              onChange={(e) => setAgentProfileId(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
            >
              <option value="">-- None (Use Global Settings) --</option>
              {agentProfiles.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.is_default === 1 ? "(Default)" : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={useCustomPrompt}
                onChange={(e) => setUseCustomPrompt(e.target.checked)}
                className="rounded bg-black border-white/10"
              />
              <span className="text-xs text-slate-300">Override System Instruction Prompt</span>
            </label>

            {useCustomPrompt && (
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="min-h-36 w-full resize-y rounded-lg border border-white/10 bg-black/40 px-4 py-2 text-xs text-white outline-none focus:border-amber-400"
                placeholder="Write specific instructions override for this single call..."
              />
            )}
          </div>

          <button
            onClick={handleDispatch}
            disabled={dispatching}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-3 text-sm font-bold text-slate-950 hover:scale-[1.01] disabled:opacity-50 cursor-pointer"
          >
            {dispatching ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-slate-950 border-t-transparent"></span>
            ) : (
              <Phone className="h-4 w-4" />
            )}
            Initiate Outbound Call
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. CAMPAIGNS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function CampaignsPanel({ agentProfiles, toastOk, toastErr }: { agentProfiles: any[]; toastOk: (msg: string) => void; toastErr: (msg: string) => void }) {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form states
  const [campName, setCampName] = useState("");
  const [scheduleType, setScheduleType] = useState("once");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [callDelay, setCallDelay] = useState(3);
  const [agentProfileId, setAgentProfileId] = useState("");
  const [contacts, setContacts] = useState<any[]>([]);
  const [csvFile, setCsvFile] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/campaigns");
      setCampaigns(data || []);
    } catch (e: any) {
      toastErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvFile(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) return toastErr("CSV is empty or missing content.");

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const pIdx = headers.indexOf("phone");
      if (pIdx === -1) return toastErr('CSV file must contain a "phone" header column.');

      const parsed = lines
        .slice(1)
        .map((l) => {
          const row = l.split(",");
          const record: any = {};
          headers.forEach((h, i) => {
            record[h] = row[i]?.trim();
          });
          return record;
        })
        .filter((r) => r.phone);

      setContacts(parsed);
      toastOk(`Parsed ${parsed.length} contacts successfully.`);
    };
    reader.readAsText(file);
  };

  const handleSaveCampaign = async () => {
    if (!campName.trim()) return toastErr("Campaign name is required");
    if (contacts.length === 0) return toastErr("CSV contact list is required");

    const payload = {
      name: campName,
      contacts: contacts,
      schedule_type: scheduleType,
      schedule_time: scheduleTime,
      call_delay_seconds: Number(callDelay),
      agent_profile_id: agentProfileId || null,
    };

    try {
      await apiPost("/api/campaigns", payload);
      toastOk("Campaign created and queued");
      setIsFormOpen(false);
      setCampName("");
      setContacts([]);
      setCsvFile(null);
      setAgentProfileId("");
      fetchCampaigns();
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  const handleRunNow = async (id: string) => {
    try {
      await apiPost(`/api/campaigns/${id}/run`, {});
      toastOk("Campaign started");
      fetchCampaigns();
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === "active" ? "paused" : "active";
    try {
      await apiPatch(`/api/campaigns/${id}/status`, { status: nextStatus });
      toastOk(`Campaign status changed to ${nextStatus}`);
      fetchCampaigns();
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this campaign?")) return;
    try {
      await apiDel(`/api/campaigns/${id}`);
      toastOk("Campaign deleted");
      fetchCampaigns();
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle
        eyebrow="Mass Outreach"
        title="Outbound Campaigns"
        description="Schedule and dispatch bulk AI voice calls. Upload CSVs of leads and let your agents handle the conversation natively."
        action={
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-transform hover:scale-[1.02] cursor-pointer"
          >
            <Plus className="h-4 w-4" /> New Campaign
          </button>
        }
      />

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent"></div>
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No campaigns running"
          description="You haven't scheduled any bulk outbound calling campaigns yet. Create a campaign to get started."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Campaign</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Schedule</th>
                  <th className="px-6 py-4 font-medium">Progress</th>
                  <th className="px-6 py-4 font-medium">Created</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.01]">
                    <td className="px-6 py-4">
                      <b className="text-white font-semibold">{c.name}</b>
                      <div className="text-[10px] text-slate-500">ID: {c.id?.substring(0, 8)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge tone={getOutcomeTone(c.status)}>{c.status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-300">
                      {c.schedule_type} @ {c.schedule_time}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-300">
                      <div>
                        {c.total_dispatched} dispatched / {c.total_failed} failed
                      </div>
                      <div className="text-[10px] text-slate-500">Last: {fmtDate(c.last_run_at)}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">{fmtDate(c.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleRunNow(c.id)}
                          className="p-1.5 rounded bg-white/5 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                          title="Run Now"
                        >
                          <Play className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(c.id, c.status)}
                          className="p-1.5 rounded bg-white/5 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                          title={c.status === "active" ? "Pause" : "Activate"}
                        >
                          {c.status === "active" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 text-green-400" />}
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="p-1.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Creation Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#08111f] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <button onClick={() => setIsFormOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer">
              <X className="h-6 w-6" />
            </button>

            <h3 className="text-lg font-semibold text-white mb-4">New Campaign Queue</h3>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Campaign Name</span>
                <input
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                  placeholder="e.g. Q2 Customer Outreach"
                />
              </label>

              <div className="grid gap-4 grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Attached Agent Persona</span>
                  <select
                    value={agentProfileId}
                    onChange={(e) => setAgentProfileId(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                  >
                    <option value="">-- Settings default --</option>
                    {agentProfiles.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Delay Between Dials (s)</span>
                  <input
                    type="number"
                    value={callDelay}
                    onChange={(e) => setCallDelay(Number(e.target.value))}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                  />
                </label>
              </div>

              <div className="grid gap-4 grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Trigger Cron Schedule</span>
                  <select
                    value={scheduleType}
                    onChange={(e) => setScheduleType(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400"
                  >
                    <option value="once">Run Immediately (Once)</option>
                    <option value="daily">Daily Cron</option>
                    <option value="weekdays">Weekdays (Mon-Fri) Cron</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Trigger Time (HH:MM)</span>
                  <input
                    value={scheduleTime}
                    disabled={scheduleType === "once"}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400 disabled:opacity-40"
                  />
                </label>
              </div>

              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Upload Leads CSV</span>
                <div className="flex items-center justify-between border border-dashed border-white/10 rounded-lg p-4 bg-black/40">
                  <span className="text-xs text-slate-400">{csvFile || "Must contain phone, lead_name, etc."}</span>
                  <label className="rounded bg-white/10 border border-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 cursor-pointer">
                    <Upload className="inline mr-1.5 h-3.5 w-3.5" /> Upload File
                    <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-4">
              <button
                onClick={() => setIsFormOpen(false)}
                className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2 text-sm font-semibold text-white hover:bg-white/[0.05] cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCampaign}
                className="rounded-lg bg-amber-400 px-5 py-2 text-sm font-bold text-slate-950 hover:scale-[1.02] cursor-pointer"
              >
                Build Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. APPOINTMENTS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function AppointmentsPanel({ toastOk, toastErr }: { toastOk: (msg: string) => void; toastErr: (msg: string) => void }) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [dateFilter, setDateFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchAppointments = async (d?: string) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/appointments${d ? `?date=${d}` : ""}`);
      setAppointments(data || []);
    } catch (e: any) {
      toastErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments(dateFilter);
  }, [dateFilter]);

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this appointment slot?")) return;
    try {
      await apiDel(`/api/appointments/${id}`);
      toastOk("Appointment cancelled successfully");
      fetchAppointments(dateFilter);
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle
        eyebrow="CRM Operations"
        title="Scheduled Appointments"
        description="Monitor live bookings handled autonomously by AI voice integration. Filter by date to review schedules and cancel bookings."
      />

      <div className="mb-4 flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <label className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Filter Date:</span>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-black text-xs text-white px-3 py-1.5 outline-none focus:border-amber-400"
          />
        </label>
        {dateFilter && (
          <button onClick={() => setDateFilter("")} className="text-xs text-amber-400 hover:text-amber-300 font-semibold cursor-pointer">
            Clear Filter
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent"></div>
        </div>
      ) : appointments.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="No appointments scheduled" description="Bookings completed by agents during voice sessions will show up here." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="border-b border-white/10 bg-white/[0.02] text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Time</th>
                  <th className="px-6 py-4 font-medium">Lead Name</th>
                  <th className="px-6 py-4 font-medium">Phone Number</th>
                  <th className="px-6 py-4 font-medium">Service Type</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {appointments.map((a) => (
                  <tr key={a.id} className="hover:bg-white/[0.01]">
                    <td className="px-6 py-4 font-semibold text-white">{a.date}</td>
                    <td className="px-6 py-4 text-slate-300">{a.time}</td>
                    <td className="px-6 py-4 font-medium text-white">{a.name}</td>
                    <td className="px-6 py-4 text-slate-300">{a.phone}</td>
                    <td className="px-6 py-4 text-slate-400">{a.service}</td>
                    <td className="px-6 py-4">
                      <Badge tone={getOutcomeTone(a.status)}>{a.status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {a.status === "booked" && (
                        <button
                          onClick={() => handleCancel(a.id)}
                          className="rounded-lg bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 cursor-pointer"
                        >
                          Cancel Slot
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. SETTINGS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function SettingsPanel({ toastOk, toastErr, reloadChips }: { toastOk: (msg: string) => void; toastErr: (msg: string) => void; reloadChips: () => void }) {
  const [activeSubTab, setActiveSubTab] = useState("livekit");
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/settings");
      const mapped: Record<string, string> = {};
      Object.keys(data).forEach((k) => {
        mapped[k] = data[k].value || "";
      });
      setSettings(mapped);
    } catch (e: any) {
      toastErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveGroup = async (keys: string[]) => {
    const payload: Record<string, string> = {};
    keys.forEach((k) => {
      payload[k] = settings[k] || "";
    });

    try {
      await apiPost("/api/settings", { settings: payload });
      toastOk("Credentials saved");
      fetchSettings();
      reloadChips();
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  const handleCreateTrunk = async () => {
    try {
      const res = await apiPost("/api/setup/trunk", {});
      setSettings((prev) => ({ ...prev, OUTBOUND_TRUNK_ID: res.trunk_id }));
      toastOk(`Outbound trunk generated successfully: ${res.trunk_id}`);
      fetchSettings();
      reloadChips();
    } catch (e: any) {
      toastErr(e.message);
    }
  };

  const handleSaveToolsToggles = async () => {
    try {
      const val = settings["ENABLED_TOOLS"] || "[]";
      JSON.parse(val); // validate json
      await apiPost("/api/settings", { settings: { ENABLED_TOOLS: val } });
      toastOk("Tool bindings updated successfully.");
      fetchSettings();
    } catch (e) {
      toastErr("Invalid JSON list configuration. Must be a valid JSON array.");
    }
  };

  const subTabs = [
    { id: "livekit", label: "LiveKit" },
    { id: "gemini", label: "Gemini / AI" },
    { id: "vobiz", label: "Vobiz SIP" },
    { id: "twilio", label: "Twilio CRM" },
    { id: "calcom", label: "Cal.com" },
    { id: "tools", label: "Enabled Tools" },
  ];

  const updateKey = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <SectionTitle
        eyebrow="Console Config"
        title="Credentials & Providers"
        description="Update secure keys, configure SIP dialing trunk parameters, manage active LLM endpoints, and enable function calling tools."
      />

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        {/* Sub Navigation */}
        <div className="flex flex-col gap-1 border-r border-white/5 pr-4">
          {subTabs.map((st) => (
            <button
              key={st.id}
              onClick={() => setActiveSubTab(st.id)}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.06em] transition-all cursor-pointer ${
                activeSubTab === st.id ? "bg-amber-400/10 text-amber-300" : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              {st.label}
              <ChevronRight className="h-3 w-3" />
            </button>
          ))}
        </div>

        {/* Configuration Box */}
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent"></div>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-6">
            {activeSubTab === "livekit" && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">LiveKit Cloud Workspace</h4>
                <div className="grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">LiveKit Connection URL</span>
                    <input
                      value={settings["LIVEKIT_URL"] || ""}
                      onChange={(e) => updateKey("LIVEKIT_URL", e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                      placeholder="wss://your-project.livekit.cloud"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">LiveKit Access Key ID</span>
                    <input
                      value={settings["LIVEKIT_API_KEY"] || ""}
                      onChange={(e) => updateKey("LIVEKIT_API_KEY", e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                      placeholder="APImkxxxxxxxx"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">LiveKit Api Secret Key</span>
                    <input
                      type="password"
                      value={settings["LIVEKIT_API_SECRET"] || ""}
                      onChange={(e) => updateKey("LIVEKIT_API_SECRET", e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                      placeholder="••••••••••••••••"
                    />
                  </label>
                </div>
                <button
                  onClick={() => handleSaveGroup(["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"])}
                  className="rounded-lg bg-amber-400 px-5 py-2 text-xs font-bold text-slate-950 hover:scale-[1.02] cursor-pointer"
                >
                  Save Connection Settings
                </button>
              </div>
            )}

            {activeSubTab === "gemini" && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Google Gemini & Deepgram STT</h4>
                <div className="grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Google Gemini API Key</span>
                    <input
                      type="password"
                      value={settings["GOOGLE_API_KEY"] || ""}
                      onChange={(e) => updateKey("GOOGLE_API_KEY", e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                      placeholder="AIzaSy••••••••"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Deepgram Voice API Key</span>
                    <input
                      type="password"
                      value={settings["DEEPGRAM_API_KEY"] || ""}
                      onChange={(e) => updateKey("DEEPGRAM_API_KEY", e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                      placeholder="dg_••••••••"
                    />
                  </label>
                  <div className="grid gap-4 grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Gemini model override</span>
                      <input
                        value={settings["GEMINI_MODEL"] || ""}
                        onChange={(e) => updateKey("GEMINI_MODEL", e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                        placeholder="gemini-3.1-flash-live-preview"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Default TTS Voice ID</span>
                      <input
                        value={settings["GEMINI_TTS_VOICE"] || ""}
                        onChange={(e) => updateKey("GEMINI_TTS_VOICE", e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                        placeholder="Aoede"
                      />
                    </label>
                  </div>
                </div>
                <button
                  onClick={() => handleSaveGroup(["GOOGLE_API_KEY", "DEEPGRAM_API_KEY", "GEMINI_MODEL", "GEMINI_TTS_VOICE"])}
                  className="rounded-lg bg-amber-400 px-5 py-2 text-xs font-bold text-slate-950 hover:scale-[1.02] cursor-pointer"
                >
                  Save API Keys
                </button>
              </div>
            )}

            {activeSubTab === "vobiz" && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Vobiz SIP Outbound Dialer</h4>
                <div className="grid gap-4">
                  <div className="grid gap-4 grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">SIP IP / Domain</span>
                      <input
                        value={settings["VOBIZ_SIP_DOMAIN"] || ""}
                        onChange={(e) => updateKey("VOBIZ_SIP_DOMAIN", e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                        placeholder="sip.vobiz.com"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Trunk ID Override</span>
                      <input
                        value={settings["OUTBOUND_TRUNK_ID"] || ""}
                        onChange={(e) => updateKey("OUTBOUND_TRUNK_ID", e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                        placeholder="sot_xxxxxxx"
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">SIP Username</span>
                      <input
                        value={settings["VOBIZ_USERNAME"] || ""}
                        onChange={(e) => updateKey("VOBIZ_USERNAME", e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                        placeholder="SIP User Account ID"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">SIP Password</span>
                      <input
                        type="password"
                        value={settings["VOBIZ_PASSWORD"] || ""}
                        onChange={(e) => updateKey("VOBIZ_PASSWORD", e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                        placeholder="••••••••••••••••"
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Outbound Dial Caller ID Number</span>
                      <input
                        value={settings["VOBIZ_OUTBOUND_NUMBER"] || ""}
                        onChange={(e) => updateKey("VOBIZ_OUTBOUND_NUMBER", e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                        placeholder="+91XXXXXXXXXX"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Call Transfer Agent Number</span>
                      <input
                        value={settings["DEFAULT_TRANSFER_NUMBER"] || ""}
                        onChange={(e) => updateKey("DEFAULT_TRANSFER_NUMBER", e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                        placeholder="e.g. +91XXXXXXXXXX"
                      />
                    </label>
                  </div>
                </div>
                <div className="flex gap-4 border-t border-white/5 pt-4">
                  <button
                    onClick={() =>
                      handleSaveGroup(["VOBIZ_SIP_DOMAIN", "OUTBOUND_TRUNK_ID", "VOBIZ_USERNAME", "VOBIZ_PASSWORD", "VOBIZ_OUTBOUND_NUMBER", "DEFAULT_TRANSFER_NUMBER"])
                    }
                    className="rounded-lg bg-amber-400 px-5 py-2 text-xs font-bold text-slate-950 hover:scale-[1.02] cursor-pointer"
                  >
                    Save SIP Config
                  </button>
                  <button
                    onClick={handleCreateTrunk}
                    className="rounded-lg border border-white/10 bg-white/[0.02] px-5 py-2 text-xs font-bold text-white hover:bg-white/[0.05] cursor-pointer"
                  >
                    Generate LiveKit Outbound Trunk
                  </button>
                </div>
              </div>
            )}

            {activeSubTab === "twilio" && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Twilio Outbound CRM / SMS Override</h4>
                <div className="grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Twilio Account SID</span>
                    <input
                      value={settings["TWILIO_ACCOUNT_SID"] || ""}
                      onChange={(e) => updateKey("TWILIO_ACCOUNT_SID", e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                      placeholder="ACxxxxxxxx"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Twilio Auth Token</span>
                    <input
                      type="password"
                      value={settings["TWILIO_AUTH_TOKEN"] || ""}
                      onChange={(e) => updateKey("TWILIO_AUTH_TOKEN", e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                      placeholder="••••••••••••••••"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Twilio SMS From Number</span>
                    <input
                      value={settings["TWILIO_FROM_NUMBER"] || ""}
                      onChange={(e) => updateKey("TWILIO_FROM_NUMBER", e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                      placeholder="+1XXXXXXXXXX"
                    />
                  </label>
                </div>
                <button
                  onClick={() => handleSaveGroup(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"])}
                  className="rounded-lg bg-amber-400 px-5 py-2 text-xs font-bold text-slate-950 hover:scale-[1.02] cursor-pointer"
                >
                  Save Twilio Account Settings
                </button>
              </div>
            )}

            {activeSubTab === "calcom" && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">Cal.com Scheduling Sync</h4>
                <div className="grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Cal.com API Token</span>
                    <input
                      type="password"
                      value={settings["CALCOM_API_KEY"] || ""}
                      onChange={(e) => updateKey("CALCOM_API_KEY", e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                      placeholder="cal_live_••••••••"
                    />
                  </label>
                  <div className="grid gap-4 grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Cal Event Type ID</span>
                      <input
                        value={settings["CALCOM_EVENT_TYPE_ID"] || ""}
                        onChange={(e) => updateKey("CALCOM_EVENT_TYPE_ID", e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                        placeholder="e.g. 123456"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Target Timezone</span>
                      <input
                        value={settings["CALCOM_TIMEZONE"] || ""}
                        onChange={(e) => updateKey("CALCOM_TIMEZONE", e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white outline-none focus:border-amber-400 font-mono"
                        placeholder="Asia/Kolkata"
                      />
                    </label>
                  </div>
                </div>
                <button
                  onClick={() => handleSaveGroup(["CALCOM_API_KEY", "CALCOM_EVENT_TYPE_ID", "CALCOM_TIMEZONE"])}
                  className="rounded-lg bg-amber-400 px-5 py-2 text-xs font-bold text-slate-950 hover:scale-[1.02] cursor-pointer"
                >
                  Save Calendar Settings
                </button>
              </div>
            )}

            {activeSubTab === "tools" && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white">System Tools Configuration</h4>
                <p className="text-xs text-slate-400">Manage tool bindings allowed globally for the AI calling pipelines.</p>
                <textarea
                  value={settings["ENABLED_TOOLS"] || "[]"}
                  onChange={(e) => updateKey("ENABLED_TOOLS", e.target.value)}
                  className="min-h-36 w-full font-mono text-xs leading-relaxed rounded-lg border border-white/10 bg-black/40 p-4 text-white outline-none focus:border-amber-400"
                />
                <button
                  onClick={handleSaveToolsToggles}
                  className="rounded-lg bg-amber-400 px-5 py-2 text-xs font-bold text-slate-950 hover:scale-[1.02] cursor-pointer"
                >
                  Update Allowed Tools
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HOMEPAGE WRAPPER
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const [active, setActive] = useState("dashboard");
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "error" } | null>(null);

  // Global State
  const [stats, setStats] = useState<any>(null);
  const [agentProfiles, setAgentProfiles] = useState<any[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<any[]>([]);
  const [liveConfig, setLiveConfig] = useState<any>({ livekit: false, gemini: false, trunk: false });
  const [loadingConfig, startTransition] = useTransition();

  const toastOk = (msg: string) => {
    setToast({ msg, type: "ok" });
    setTimeout(() => setToast(null), 3000);
  };

  const toastErr = (msg: string) => {
    setToast({ msg, type: "error" });
    setTimeout(() => setToast(null), 3000);
  };

  // Loaders
  const loadStats = async () => {
    try {
      const data = await apiFetch("/api/stats");
      setStats(data);
    } catch (e) {}
  };

  const loadAgentProfiles = async () => {
    try {
      const data = await apiFetch("/api/agent-profiles");
      setAgentProfiles(data || []);
    } catch (e) {}
  };

  const loadKnowledgeBases = async () => {
    try {
      const data = await apiFetch("/api/knowledge-bases");
      setKnowledgeBases(data || []);
    } catch (e) {}
  };

  const loadChips = () => {
    startTransition(async () => {
      try {
        const s = await apiFetch("/api/settings");
        setLiveConfig({
          livekit: s.LIVEKIT_API_KEY?.configured || false,
          gemini: s.GOOGLE_API_KEY?.configured || false,
          trunk: s.OUTBOUND_TRUNK_ID?.configured || false,
        });
      } catch (e) {}
    });
  };

  useEffect(() => {
    loadStats();
    loadAgentProfiles();
    loadKnowledgeBases();
    loadChips();

    const statsInterval = setInterval(loadStats, 10000);
    return () => clearInterval(statsInterval);
  }, []);

  const activeLabel = navGroups.flatMap((group) => group.items).find((item) => item.id === active)?.label ?? "Dashboard";

  return (
    <main className="min-h-screen bg-[#060c16] text-white selection:bg-amber-400/30 font-sans">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-72 shrink-0 border-r border-white/5 bg-black/40 p-5 lg:flex lg:flex-col">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 shadow-[0_0_15px_rgba(251,191,36,0.15)]">
              <Sparkles className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="font-bold tracking-wide text-white">OutboundAI</div>
              <div className="text-xs font-medium text-slate-400">v2.0 Platform</div>
            </div>
          </div>

          <nav className="flex-1 space-y-8 overflow-y-auto pr-2">
            {navGroups.map((group) => (
              <div key={group.label}>
                <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{group.label}</div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActive(item.id)}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all cursor-pointer ${
                          active === item.id
                            ? "bg-amber-400/10 text-amber-300 shadow-[inset_2px_0_0_0_rgba(251,191,36,1)]"
                            : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                        }`}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-white/5 bg-[#060c16]/80 px-4 py-4 backdrop-blur-md md:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-xl font-semibold text-white">{activeLabel}</h1>
              </div>

              {/* Mobile Navigation */}
              <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden [&::-webkit-scrollbar]:hidden">
                {navGroups
                  .flatMap((group) => group.items)
                  .map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActive(item.id)}
                      className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        active === item.id ? "border-amber-400/30 bg-amber-400/10 text-amber-300" : "border-white/10 bg-white/[0.02] text-slate-300"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
              </div>

              {/* Header Configuration Badges */}
              <div className="hidden items-center gap-3 lg:flex">
                <Badge tone={liveConfig.trunk ? "green" : "default"}>
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> {liveConfig.trunk ? "SIP Trunk Active" : "SIP Offline"}
                </Badge>
                <Badge tone={liveConfig.livekit ? "green" : "default"}>LiveKit {liveConfig.livekit ? "Online" : "Missing"}</Badge>
                <Badge tone={liveConfig.gemini ? "blue" : "default"}>Gemini {liveConfig.gemini ? "Online" : "Missing"}</Badge>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="mx-auto max-w-7xl">
              {active === "dashboard" && <DashboardPanel stats={stats} agents={agentProfiles} onNavigate={setActive} />}
              {active === "calls" && <CallsPanel toastOk={toastOk} toastErr={toastErr} />}
              {active === "logs" && <LogsPanel toastOk={toastOk} toastErr={toastErr} />}
              {active === "agents" && (
                <AgentsPanel
                  agentProfiles={agentProfiles}
                  reloadAgentProfiles={loadAgentProfiles}
                  knowledgeBases={knowledgeBases}
                  toastOk={toastOk}
                  toastErr={toastErr}
                />
              )}
              {active === "knowledge" && (
                <KnowledgePanel
                  knowledgeBases={knowledgeBases}
                  reloadKnowledgeBases={loadKnowledgeBases}
                  toastOk={toastOk}
                  toastErr={toastErr}
                />
              )}
              {active === "prompt" && <PromptPanel toastOk={toastOk} toastErr={toastErr} />}
              {active === "single" && <SingleCallPanel agentProfiles={agentProfiles} toastOk={toastOk} toastErr={toastErr} />}
              {active === "campaigns" && <CampaignsPanel agentProfiles={agentProfiles} toastOk={toastOk} toastErr={toastErr} />}
              {active === "appointments" && <AppointmentsPanel toastOk={toastOk} toastErr={toastErr} />}
              {active === "settings" && <SettingsPanel toastOk={toastOk} toastErr={toastErr} reloadChips={loadChips} />}
            </div>
          </div>
        </section>
      </div>

      {/* Custom Toast System */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-lg border px-5 py-3 text-sm font-semibold shadow-2xl animate-in slide-in-from-bottom-5 duration-300 ${
            toast.type === "ok" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </main>
  );
}