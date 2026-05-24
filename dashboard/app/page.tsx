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
} from "lucide-react";
import { useMemo, useState } from "react";

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

const knowledgeBases = [
  {
    name: "Company Sales Knowledge",
    description: "Pricing, services, objections, and qualification rules.",
    entries: 18,
    agents: 3,
    updated: "Today",
    active: true,
  },
  {
    name: "Appointment Rules",
    description: "Availability, booking requirements, reminders, and fallback rules.",
    entries: 9,
    agents: 5,
    updated: "Yesterday",
    active: true,
  },
  {
    name: "Support FAQ",
    description: "Common customer questions for chat and WhatsApp-style support.",
    entries: 24,
    agents: 2,
    updated: "May 18",
    active: true,
  },
];

const contentTypes = [
  "FAQ",
  "Business Info",
  "Services",
  "Pricing",
  "Policies",
  "Scripts",
  "Objection Handling",
  "Appointment Rules",
];

const agents = [
  {
    name: "Priya Appointment Setter",
    channel: "Voice + Text",
    knowledge: "Sales Knowledge, Appointment Rules",
    confidence: 86,
    status: "Ready",
  },
  {
    name: "Support Chat Agent",
    channel: "Text Only",
    knowledge: "Support FAQ",
    confidence: 78,
    status: "Testing",
  },
  {
    name: "Outbound Qualifier",
    channel: "Voice Only",
    knowledge: "Sales Knowledge",
    confidence: 72,
    status: "Ready",
  },
];

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "green" | "amber" | "blue" }) {
  const classes = {
    default: "border-white/10 bg-white/[0.04] text-slate-300",
    green: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-400/20 bg-amber-400/10 text-amber-200",
    blue: "border-sky-400/20 bg-sky-400/10 text-sky-200",
  };

  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${classes[tone]}`}>
      {children}
    </span>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">{eyebrow}</div>
        <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
      </div>
      {action}
    </div>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.035] p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{helper}</div>
    </div>
  );
}

function DashboardPanel() {
  return (
    <div>
      <SectionTitle
        eyebrow="Command Center"
        title="OutboundAI is now a multi-channel agent platform"
        description="Manage voice calls, text agents, shared knowledge, appointments, and campaign workflows from one operational console."
        action={
          <button className="inline-flex items-center gap-2 bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950">
            <Sparkles className="h-4 w-4" /> Create Agent
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active Agents" value="7" helper="3 hybrid, 2 voice, 2 text" />
        <MetricCard label="Knowledge Entries" value="51" helper="Across 3 active bases" />
        <MetricCard label="Grounded Replies" value="84%" helper="Answered from retrieved knowledge" />
        <MetricCard label="Fallback Rate" value="6%" helper="Low-confidence responses blocked" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="border border-white/10 bg-white/[0.035] p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Agent Readiness</h3>
              <p className="text-sm text-slate-400">Channel mode, knowledge coverage, and confidence health.</p>
            </div>
            <Badge tone="green">Live</Badge>
          </div>
          <div className="space-y-4">
            {agents.map((agent) => (
              <div key={agent.name} className="grid gap-4 border border-white/10 bg-black/20 p-4 md:grid-cols-[1fr_150px_140px] md:items-center">
                <div>
                  <div className="font-medium text-white">{agent.name}</div>
                  <div className="mt-1 text-sm text-slate-400">{agent.knowledge}</div>
                </div>
                <Badge tone={agent.channel === "Text Only" ? "blue" : agent.channel === "Voice Only" ? "default" : "green"}>{agent.channel}</Badge>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-400">
                    <span>Confidence</span>
                    <span>{agent.confidence}%</span>
                  </div>
                  <div className="h-2 bg-white/10">
                    <div className="h-full bg-amber-400" style={{ width: `${agent.confidence}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-white/10 bg-white/[0.035] p-6">
          <h3 className="font-semibold text-white">Quick Wins</h3>
          <div className="mt-5 space-y-4">
            {["Add pricing entries", "Attach KBs to all agents", "Test voice and text behavior", "Review fallback questions"].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-slate-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KnowledgePanel() {
  const [selected, setSelected] = useState(knowledgeBases[0].name);
  const current = knowledgeBases.find((kb) => kb.name === selected) ?? knowledgeBases[0];

  return (
    <div>
      <SectionTitle
        eyebrow="Business Truth Layer"
        title="Knowledge Base"
        description="Upload later, manual entry now: organize FAQs, pricing, policies, scripts, objections, services, and appointment rules into reusable agent knowledge."
        action={
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white">
              <Upload className="h-4 w-4" /> Upload Later
            </button>
            <button className="inline-flex items-center gap-2 bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950">
              <Plus className="h-4 w-4" /> New Knowledge Base
            </button>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Knowledge Bases" value="3" helper="Reusable across agents" />
        <MetricCard label="Searchable Chunks" value="126" helper="Small retrieval-ready sections" />
        <MetricCard label="Connected Agents" value="5" helper="One-to-many mapping enabled" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="border border-white/10 bg-white/[0.035]">
          <div className="border-b border-white/10 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Database className="h-4 w-4 text-amber-300" /> Libraries
            </div>
            <div className="mt-2 text-sm text-slate-400">Select a knowledge base to edit and connect.</div>
          </div>
          <div>
            {knowledgeBases.map((kb) => (
              <button
                key={kb.name}
                onClick={() => setSelected(kb.name)}
                className={`w-full border-b border-white/10 p-5 text-left transition hover:bg-white/[0.04] ${
                  selected === kb.name ? "border-l-2 border-l-amber-400 bg-amber-400/10" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{kb.name}</div>
                    <div className="mt-1 text-sm leading-5 text-slate-400">{kb.description}</div>
                    <div className="mt-3 flex gap-2">
                      <Badge tone="green">{kb.entries} entries</Badge>
                      <Badge>{kb.agents} agents</Badge>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="border border-white/10 bg-white/[0.035]">
          <div className="border-b border-white/10 p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white">{current.name}</h3>
                <p className="mt-2 text-sm text-slate-400">{current.description}</p>
              </div>
              <Badge tone="green">Active</Badge>
            </div>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <div className="mb-4 flex flex-wrap gap-2">
                {["FAQ", "Pricing", "Objection", "Appointment Rule"].map((template) => (
                  <button key={template} className="border border-white/10 bg-black/20 px-3 py-2 text-xs font-semibold text-slate-200">
                    {template}
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Entry Title</span>
                  <input className="w-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-amber-300" placeholder="Pricing: Growth Plan" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Type</span>
                  <select className="w-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-amber-300">
                    {contentTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Content</span>
                  <textarea
                    className="min-h-40 w-full resize-y border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-amber-300"
                    placeholder="Add the exact business answer the agent should use..."
                  />
                </label>
                <button className="inline-flex items-center gap-2 bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950">
                  <Plus className="h-4 w-4" /> Add Entry
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {["Refund Policy", "Growth Plan Pricing", "Callback Objection"].map((entry) => (
                <div key={entry} className="border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-white">{entry}</div>
                    <Badge>Chunked</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Searchable knowledge entry with title, tags, category, source metadata, and fallback-safe retrieval.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentsPanel() {
  const [channel, setChannel] = useState("Voice + Text");
  const selectedKb = useMemo(() => ["Company Sales Knowledge", "Appointment Rules"], []);

  return (
    <div>
      <SectionTitle
        eyebrow="Agent Builder"
        title="Build once. Deploy by channel."
        description="Each agent has a base prompt, selected channels, attached knowledge bases, tools, and a test interface for voice or text behavior."
        action={
          <button className="inline-flex items-center gap-2 bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950">
            <Plus className="h-4 w-4" /> New Agent
          </button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <div className="border border-white/10 bg-white/[0.035] p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-semibold text-white">Channel Mode</h3>
              <Badge tone="green">{channel}</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                { name: "Voice Only", icon: Phone, text: "Short, spoken, interruption-friendly replies." },
                { name: "Text Only", icon: MessageSquare, text: "Formatted chat, SMS, WhatsApp, and web support." },
                { name: "Voice + Text", icon: Bot, text: "Shared knowledge with adaptive response style." },
              ].map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.name}
                    onClick={() => setChannel(option.name)}
                    className={`border p-4 text-left transition hover:border-amber-300 ${
                      channel === option.name ? "border-amber-300 bg-amber-400/10" : "border-white/10 bg-black/20"
                    }`}
                  >
                    <Icon className="mb-3 h-5 w-5 text-amber-300" />
                    <div className="font-medium text-white">{option.name}</div>
                    <div className="mt-2 text-sm leading-5 text-slate-400">{option.text}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border border-white/10 bg-white/[0.035] p-6">
            <h3 className="font-semibold text-white">Attached Knowledge</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {knowledgeBases.map((kb) => {
                const checked = selectedKb.includes(kb.name);
                return (
                  <label
                    key={kb.name}
                    className={`flex cursor-pointer gap-3 border p-4 ${checked ? "border-amber-300 bg-amber-400/10" : "border-white/10 bg-black/20"}`}
                  >
                    <input type="checkbox" defaultChecked={checked} className="mt-1 accent-amber-400" />
                    <span>
                      <span className="block font-medium text-white">{kb.name}</span>
                      <span className="mt-1 block text-sm text-slate-400">{kb.entries} entries connected to {kb.agents} agents</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="border border-white/10 bg-white/[0.035] p-6">
            <h3 className="font-semibold text-white">Prompt Behavior</h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="border border-white/10 bg-black/20 p-4">
                <div className="mb-2 flex items-center gap-2 font-medium text-white">
                  <Phone className="h-4 w-4 text-amber-300" /> Voice Style
                </div>
                <p className="text-sm leading-6 text-slate-400">1-2 short sentences, one question at a time, appointment-focused, interruption-friendly.</p>
              </div>
              <div className="border border-white/10 bg-black/20 p-4">
                <div className="mb-2 flex items-center gap-2 font-medium text-white">
                  <MessageSquare className="h-4 w-4 text-sky-300" /> Text Style
                </div>
                <p className="text-sm leading-6 text-slate-400">Richer formatting, bullets when useful, longer answers, source-aware fallback behavior.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-white/10 bg-white/[0.035] p-6">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-semibold text-white">Test Agent</h3>
            <Badge tone="blue">Source Trace</Badge>
          </div>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Customer Message</span>
            <input className="w-full border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-amber-300" defaultValue="What are your prices?" />
          </label>
          <div className="mt-4 border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">Retrieved Knowledge</span>
              <Badge tone="green">Confidence 0.86</Badge>
            </div>
            <div className="mt-3 h-2 bg-white/10">
              <div className="h-full bg-amber-400" style={{ width: "86%" }} />
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Our Growth plan starts at the listed monthly rate and includes campaign calling, appointment booking, and CRM memory.
            </p>
            <div className="mt-4 border-l-2 border-amber-300 pl-3 text-xs leading-5 text-slate-400">
              Source: Company Sales Knowledge / Growth Plan Pricing
            </div>
          </div>
          <button className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950">
            <Search className="h-4 w-4" /> Run Voice/Text Test
          </button>
        </div>
      </div>
    </div>
  );
}

function PlaceholderPanel({ title }: { title: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.035] p-8">
      <h2 className="text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
        This module stays available in the navigation while the Knowledge Base and multi-channel agent builder become the main build surfaces.
      </p>
    </div>
  );
}

export default function Home() {
  const [active, setActive] = useState("dashboard");

  const activeLabel =
    navGroups.flatMap((group) => group.items).find((item) => item.id === active)?.label ?? "Dashboard";

  return (
    <main className="min-h-screen bg-[#08111f] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-black/25 p-5 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border border-amber-300/30 bg-amber-300/10">
              <Sparkles className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <div className="font-semibold tracking-wide text-white">OutboundAI</div>
              <div className="text-xs text-slate-500">Multi-channel agents</div>
            </div>
          </div>

          <nav className="space-y-6">
            {navGroups.map((group) => (
              <div key={group.label}>
                <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">{group.label}</div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActive(item.id)}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition ${
                          active === item.id
                            ? "border-l-2 border-amber-300 bg-amber-300/10 text-amber-100"
                            : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-[#08111f]/95 px-4 py-4 backdrop-blur md:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current Module</div>
                <h1 className="mt-1 text-xl font-semibold text-white">{activeLabel}</h1>
              </div>
              <div className="flex gap-2 overflow-x-auto lg:hidden">
                {navGroups.flatMap((group) => group.items).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActive(item.id)}
                    className={`shrink-0 border px-3 py-2 text-xs ${active === item.id ? "border-amber-300 bg-amber-300/10 text-amber-100" : "border-white/10 text-slate-300"}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="hidden items-center gap-3 lg:flex">
                <Badge tone="green">
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Grounding Enabled
                </Badge>
                <Badge tone="blue">Voice + Text Ready</Badge>
              </div>
            </div>
          </header>

          <div className="p-4 md:p-8">
            {active === "dashboard" && <DashboardPanel />}
            {active === "knowledge" && <KnowledgePanel />}
            {active === "agents" && <AgentsPanel />}
            {!["dashboard", "knowledge", "agents"].includes(active) && <PlaceholderPanel title={activeLabel} />}
          </div>
        </section>
      </div>
    </main>
  );
}
