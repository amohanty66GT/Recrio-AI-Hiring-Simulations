// Recrio Slack‑Style Simulation Frontend (React)
// Single-file React app that connects to the provided Express + Socket.IO server
// Features
// - Start modal: create or join a session; choose role (candidate/founder/observer)
// - Slack-like UI: channel list (left), threaded chat (center), insights panel (right)
// - Candidate compose box; Founder co-pilot injection; message highlighting
// - Score run + display; highlights viewer; optional TTS/STT toggles
// - Tailwind for styling; shadcn/ui for components; lucide-react icons
// - Config: set VITE_API_BASE to your server origin (default http://localhost:5000)

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  MessageSquare, Send, Star, PlayCircle, PauseCircle, Mic, MicOff, Bot, User, Shield, Rocket, Copy,
  Megaphone, ListChecks, Sparkles, Loader2, ChevronRight, Volume2, VolumeX, PlusCircle
} from 'lucide-react';

// ----- Config -----
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

// ----- Helpers -----
const classNames = (...xs) => xs.filter(Boolean).join(' ');
const timeStr = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function useStickyList(dep) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [dep]);
  return endRef;
}

function speak(text) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(u);
  } catch {}
}

function useSTT(enabled) {
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState('');
  const recRef = useRef(null);
  useEffect(() => {
    if (!enabled) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = true; r.interimResults = true; r.lang = 'en-US';
    r.onresult = (e) => {
      let s = '';
      for (let i = e.resultIndex; i < e.results.length; i++) s += e.results[i][0].transcript;
      setResult(s);
    };
    r.onend = () => setListening(false);
    recRef.current = r;
  }, [enabled]);
  const start = () => { try { recRef.current?.start(); setListening(true);} catch {} };
  const stop = () => { try { recRef.current?.stop(); setListening(false);} catch {} };
  return { result, listening, start, stop };
}

// ----- Types -----
// Channel: { name, topic, history: Array<Msg> }
// Msg: { sender: 'candidate'|'founder'|'system'|'bot:NAME', text, ts }

export default function RecrioSlackSim() {
  const [socket, setSocket] = useState(null);
  const [sessionId, setSessionId] = useState('');
  const [role, setRole] = useState('candidate');
  const [name, setName] = useState('');
  const [channels, setChannels] = useState([]); // [{name, topic, history: []}]
  const [active, setActive] = useState('');
  const [compose, setCompose] = useState('');
  const [inject, setInject] = useState('');
  const [ttson, setTtson] = useState(false);
  const [stton, setStton] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [score, setScore] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const [startOpen, setStartOpen] = useState(true);
  const [joinExisting, setJoinExisting] = useState(false);
  const [creating, setCreating] = useState(false);

  const endRef = useStickyList(channels);
  const stt = useSTT(stton);
  useEffect(() => { if (stton && stt.result) setCompose(stt.result); }, [stton, stt.result]);

  // Connect socket when sessionId exists
  useEffect(() => {
    if (!sessionId) return;
    const s = io(API_BASE, { transports: ['websocket'] });
    setSocket(s);
    s.on('connect', () => {
      s.emit('session:join', { sessionId, as: role });
    });
    s.on('session:state', (payload) => {
      setChannels(payload.channels);
      if (!active && payload.channels?.[0]) setActive(payload.channels[0].name);
    });
    s.on('chat:append', (msg) => {
      setChannels(prev => prev.map(c => c.name === msg.channel ? { ...c, history: [...(c.history||[]), { sender: msg.sender, text: msg.text, ts: msg.ts }] } : c));
      if (ttson && String(msg.sender).startsWith('bot:')) speak(msg.text);
    });
    s.on('highlight:ok', () => fetchHighlights(sessionId));
    s.on('error', (e) => console.warn('Socket error:', e));
    return () => s.disconnect();
  }, [sessionId, role, ttson]);

  const activeChannel = useMemo(() => channels.find(c => c.name === active), [channels, active]);

  async function createSession() {
    try {
      setCreating(true);
      const r = await fetch(`${API_BASE}/sessions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
      const j = await r.json();
      if (j.sessionId) {
        setSessionId(j.sessionId);
        setStartOpen(false);
        // optimistic channels list; socket will hydrate histories
        setChannels(j.channels.map(c => ({ ...c, history: [] })));
        setActive(j.channels[0]?.name || '');
      }
    } catch (e) { console.error(e); }
    finally { setCreating(false); }
  }

  async function fetchHighlights(id) {
    try {
      const r = await fetch(`${API_BASE}/sessions/${id}/highlights`);
      const j = await r.json();
      setHighlights(j.highlights || []);
    } catch (e) { console.error(e); }
  }

  async function runScore() {
    try {
      setScoring(true); setScore(null);
      const r = await fetch(`${API_BASE}/sessions/${sessionId}/score`, { method: 'POST' });
      const j = await r.json();
      setScore(j.score || j);
    } catch (e) { console.error(e); }
    finally { setScoring(false); }
  }

  function sendCandidate() {
    if (!compose.trim() || !socket || !active) return;
    socket.emit('chat:message', { sessionId, channel: active, text: compose.trim() });
    setCompose('');
  }

  function sendInject() {
    if (!inject.trim() || !socket || !active) return;
    socket.emit('founder:inject', { sessionId, channel: active, text: inject.trim(), name: name || 'Founder' });
    setInject('');
  }

  function starMessage(idx) {
    if (!socket || !active) return;
    const reason = prompt('Why is this a highlight? (optional)') || '';
    socket.emit('highlight:add', { sessionId, channel: active, idxStart: idx, idxEnd: idx, reason });
  }

  function copyId() {
    navigator.clipboard?.writeText(sessionId);
  }

  return (
    <div className="w-full h-screen bg-slate-50 text-slate-900 flex">
      {/* Left sidebar: Channels */}
      <aside className="w-64 border-r bg-white flex flex-col">
        <div className="p-4 border-b flex items-center gap-2">
          <Rocket className="w-5 h-5"/>
          <div className="font-semibold">Recrio Workspace</div>
        </div>
        <div className="p-3 text-xs text-slate-500">SESSION</div>
        <div className="px-3 pb-2 flex items-center gap-2">
          <Badge variant="secondary" className="truncate max-w-[11rem]">{sessionId ? sessionId : 'not started'}</Badge>
          {sessionId && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" onClick={copyId}><Copy className="w-4 h-4"/></Button>
                </TooltipTrigger>
                <TooltipContent>Copy session ID</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="px-3 pb-3 text-sm text-slate-600 flex items-center gap-2">
          <Shield className="w-4 h-4"/>
          <span className="capitalize">{role}</span>
        </div>
        <div className="px-3 text-xs text-slate-500">CHANNELS</div>
        <nav className="flex-1 overflow-auto">
          {channels.map(c => (
            <button key={c.name} onClick={() => setActive(c.name)}
              className={classNames("w-full text-left px-4 py-2 flex items-center gap-2 hover:bg-slate-100",
                active === c.name && 'bg-slate-100 font-medium')}
            >
              <MessageSquare className="w-4 h-4"/>
              <div className="truncate">#{c.name}</div>
            </button>
          ))}
        </nav>
        <div className="p-3 border-t space-y-2">
          <div className="flex items-center gap-2">
            <Button className="w-full" variant="outline" onClick={() => setTtson(v=>!v)}>
              {ttson ? <><VolumeX className="w-4 h-4 mr-2"/>TTS Off</> : <><Volume2 className="w-4 h-4 mr-2"/>TTS On</>}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button className="w-full" variant="outline" onClick={() => setStton(v=>!v)}>
              {stton ? <><MicOff className="w-4 h-4 mr-2"/>STT Off</> : <><Mic className="w-4 h-4 mr-2"/>STT On</>}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-14 bg-white border-b flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="font-semibold text-slate-900">#{active || '—'}</div>
            {activeChannel?.topic && <div className="text-sm text-slate-500 truncate">{activeChannel.topic}</div>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">{role}</Badge>
            <div className="text-xs text-slate-500">{socket?.connected ? 'Connected' : 'Disconnected'}</div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {activeChannel?.history?.map((m, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .15 }}
                className="group flex items-start gap-3">
                <div className="mt-1">
                  {m.sender === 'candidate' && <User className="w-5 h-5"/>}
                  {m.sender === 'founder' && <Shield className="w-5 h-5"/>}
                  {m.sender.startsWith?.('bot:') && <Bot className="w-5 h-5"/>}
                  {m.sender === 'system' && <Megaphone className="w-5 h-5"/>}
                </div>
                <div className="flex-1">
                  <div className="text-sm">
                    <span className="font-medium mr-2">{m.sender}</span>
                    <span className="text-slate-500">{timeStr(m.ts)}</span>
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => starMessage(idx)}>
                          <Star className="w-4 h-4"/>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Add highlight</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </motion.div>
            ))}
            <div ref={endRef} />
          </div>
        </ScrollArea>

        {/* Composer */}
        <div className="bg-white border-t p-3">
          {role === 'founder' && (
            <div className="flex gap-2 mb-2">
              <Input value={inject} onChange={e=>setInject(e.target.value)} placeholder="Founder co-pilot: inject a prompt or constraint"/>
              <Button onClick={sendInject} disabled={!sessionId || !inject.trim()}><Sparkles className="w-4 h-4 mr-2"/>Inject</Button>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea value={compose} onChange={e=>setCompose(e.target.value)} placeholder={role==='candidate' ? 'Write your response…' : 'Send a message as observer (disabled)'} disabled={role!=='candidate'} className="min-h-[60px]"/>
            <div className="flex flex-col gap-2">
              {stton ? (
                stt.listening ? (
                  <Button variant="secondary" onClick={stt.stop}><PauseCircle className="w-4 h-4 mr-2"/>Stop</Button>
                ) : (
                  <Button variant="secondary" onClick={stt.start}><PlayCircle className="w-4 h-4 mr-2"/>Listen</Button>
                )
              ) : (
                <div className="h-10" />
              )}
              <Button onClick={sendCandidate} disabled={role!=='candidate' || !sessionId || !compose.trim()}>
                <Send className="w-4 h-4 mr-2"/>Send
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Right panel: Insights */}
      <aside className="w-[380px] border-l bg-white p-3 flex flex-col">
        <Tabs defaultValue="highlights" className="flex-1 flex flex-col">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="highlights">Highlights</TabsTrigger>
            <TabsTrigger value="score">Score</TabsTrigger>
          </TabsList>
          <TabsContent value="highlights" className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-slate-600">Curated key moments</div>
              <Button size="sm" variant="outline" onClick={() => fetchHighlights(sessionId)} disabled={!sessionId}><ListChecks className="w-4 h-4 mr-2"/>Refresh</Button>
            </div>
            <ScrollArea className="h-full pr-2">
              <div className="space-y-3">
                {(highlights || []).map((h, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">#{h.channel}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm whitespace-pre-wrap">
                        {h.excerpt?.map((m, j) => (
                          <div key={j} className="mb-1"><span className="font-medium mr-2">{m.sender}</span>{m.text}</div>
                        ))}
                      </div>
                      {h.reason && <div className="text-xs text-slate-500 mt-2">Reason: {h.reason}</div>}
                    </CardContent>
                  </Card>
                ))}
                {(!highlights || highlights.length===0) && (
                  <div className="text-sm text-slate-500">No highlights yet. Hover any message and click the star.</div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="score" className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-slate-600">Simulation rubric</div>
              <Button size="sm" onClick={runScore} disabled={!sessionId || scoring}>
                {scoring ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Sparkles className="w-4 h-4 mr-2"/>}
                {scoring ? 'Scoring…' : 'Run Score'}
              </Button>
            </div>
            {score ? (
              <div className="space-y-3">
                <Meter label="Business impact" v={score.businessImpact}/>
                <Meter label="Technical accuracy" v={score.technicalAccuracy}/>
                <Meter label="Trade-off analysis" v={score.tradeoffs}/>
                <Meter label="Constraint management" v={score.constraints}/>
                <Meter label="Communication" v={score.communication}/>
                <div className="text-sm">
                  <div className="font-medium">Overall: {Number(score.overall ?? averageScore(score)).toFixed(1)}/10</div>
                  {score.notes && <div className="text-slate-600 mt-1 whitespace-pre-wrap">{score.notes}</div>}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">Run a score to see rubric results and notes.</div>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer actions */}
        <div className="pt-2 border-t flex items-center justify-between">
          <div className="text-xs text-slate-500 truncate">Pro tip: founders can inject prompts and star moments.</div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a className="text-xs text-blue-600 hover:underline cursor-pointer" onClick={() => setStartOpen(true)}>Session</a>
              </TooltipTrigger>
              <TooltipContent>Open session controls</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </aside>

      {/* Start dialog */}
      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Start a simulation</DialogTitle>
            <DialogDescription>Spin up a new session or join an existing one. Choose your role.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Your info</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2 items-center">
                  <div className="text-sm text-slate-600">Name</div>
                  <div className="col-span-2"><Input value={name} onChange={e=>setName(e.target.value)} placeholder="Your display name"/></div>
                </div>
                <div className="grid grid-cols-3 gap-2 items-center">
                  <div className="text-sm text-slate-600">Role</div>
                  <div className="col-span-2 flex gap-2">
                    {['candidate','founder','observer'].map(r => (
                      <Button key={r} variant={role===r? 'default':'outline'} size="sm" onClick={()=>setRole(r)} className="capitalize">{r}</Button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Session</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Button onClick={()=>setJoinExisting(false)} variant={!joinExisting? 'default':'outline'} size="sm">Create new</Button>
                  <Button onClick={()=>setJoinExisting(true)} variant={joinExisting? 'default':'outline'} size="sm">Join existing</Button>
                </div>
                {joinExisting ? (
                  <div className="space-y-2">
                    <Input value={sessionId} onChange={e=>setSessionId(e.target.value)} placeholder="Session ID"/>
                    <Button onClick={()=> setStartOpen(false)} disabled={!sessionId}>Join</Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Button onClick={createSession} disabled={creating}>{creating ? 'Creating…' : 'Create new session'}</Button>
                    <div className="text-xs text-slate-500">This will create default channels and seed kickoff messages from AI teammates.</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Meter({ label, v }) {
  const value = Math.max(0, Math.min(10, Number(v ?? 0)));
  return (
    <div>
      <div className="flex items-center justify-between mb-1 text-sm"><div>{label}</div><div className="text-slate-600">{value.toFixed(1)}/10</div></div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-2 bg-slate-900" style={{ width: `${value*10}%` }} />
      </div>
    </div>
  );
}

function averageScore(s) {
  const keys = ['businessImpact','technicalAccuracy','tradeoffs','constraints','communication'];
  const nums = keys.map(k => Number(s?.[k] ?? 0));
  const sum = nums.reduce((a,b)=>a+b,0);
  return (sum/keys.length)||0;
}
