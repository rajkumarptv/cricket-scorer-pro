import React, { useState, useEffect } from 'react';
import {
  Trophy, Users, Play, Plus, Undo2,
  Youtube, Share2, X, Check, AlertCircle,
  Radio, Tv2, BarChart3, Home, LogOut, RefreshCw
} from 'lucide-react';
import { Team, Player, Match, Innings, Ball, BattingStats, BowlingStats } from './types';

// ─── Wicket Types ─────────────────────────────────────────────────────────────
const WICKET_TYPES = [
  { id: 'bowled', label: 'Bowled', needsTaker: false },
  { id: 'caught', label: 'Caught', needsTaker: true },
  { id: 'caught_behind', label: 'Caught Behind', needsTaker: true },
  { id: 'caught_and_bowled', label: 'Caught & Bowled', needsTaker: false },
  { id: 'lbw', label: 'LBW', needsTaker: false },
  { id: 'stumped', label: 'Stumped', needsTaker: true },
  { id: 'run_out', label: 'Run Out', needsTaker: true },
  { id: 'hit_wicket', label: 'Hit Wicket', needsTaker: false },
  { id: 'retired', label: 'Retired', needsTaker: false },
  { id: 'retired_hurt', label: 'Retired Hurt', needsTaker: false },
  { id: 'obstructing', label: 'Obstructing Field', needsTaker: false },
  { id: 'timed_out', label: 'Timed Out', needsTaker: false },
];

// ─── UI Components ────────────────────────────────────────────────────────────
const Btn = ({
  children, onClick, variant = 'primary', size = 'md', disabled = false, className = ''
}: {
  children: React.ReactNode; onClick?: () => void;
  variant?: 'primary'|'secondary'|'danger'|'outline'|'ghost'|'yellow'|'fb'|'red';
  size?: 'sm'|'md'|'lg'; disabled?: boolean; className?: string;
}) => {
  const v = {
    primary: 'bg-green-600 hover:bg-green-700 text-white',
    secondary: 'bg-green-800 hover:bg-green-900 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    red: 'bg-red-500 hover:bg-red-600 text-white',
    outline: 'border-2 border-green-600 text-green-700 hover:bg-green-50',
    ghost: 'text-green-700 hover:bg-green-100',
    yellow: 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900',
    fb: 'bg-blue-600 hover:bg-blue-700 text-white',
  };
  const s = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${v[variant]} ${s[size]} rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 ${className}`}>
      {children}
    </button>
  );
};

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-2xl border border-green-100 shadow-sm ${className}`}>{children}</div>
);

const Modal = ({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) => (
  <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
      <div className="flex items-center justify-between p-5 border-b border-green-100">
        <h2 className="text-lg font-bold text-green-900">{title}</h2>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-green-50 text-green-600"><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">{children}</div>
    </div>
  </div>
);

// ─── Wicket Modal ─────────────────────────────────────────────────────────────
const WicketModal = ({
  onConfirm, onClose, fieldingPlayers, batsmen
}: {
  onConfirm: (type: string, takerId: string | null, playerOutId: string) => void;
  onClose: () => void;
  fieldingPlayers: Player[];
  batsmen: { striker: Player | null; nonStriker: Player | null };
}) => {
  const [selectedType, setSelectedType] = useState('');
  const [takerId, setTakerId] = useState('');
  const [playerOutId, setPlayerOutId] = useState('');

  const wicketDef = WICKET_TYPES.find(w => w.id === selectedType);

  return (
    <Modal title="Wicket Details" onClose={onClose}>
      <div className="space-y-4">
        {/* Who is out */}
        <div>
          <p className="text-sm font-semibold text-green-800 mb-2">Who is out?</p>
          <div className="flex gap-2">
            {[batsmen.striker, batsmen.nonStriker].filter(Boolean).map(p => (
              <button key={p!.id} onClick={() => setPlayerOutId(String(p!.id))}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all
                  ${playerOutId === String(p!.id) ? 'bg-red-500 border-red-500 text-white' : 'border-green-200 text-green-800 hover:bg-green-50'}`}>
                {p!.name}
              </button>
            ))}
          </div>
        </div>

        {/* Wicket type grid */}
        <div>
          <p className="text-sm font-semibold text-green-800 mb-2">How out?</p>
          <div className="grid grid-cols-3 gap-2">
            {WICKET_TYPES.map(w => (
              <button key={w.id} onClick={() => { setSelectedType(w.id); setTakerId(''); }}
                className={`py-2 px-1 rounded-lg text-xs font-semibold border-2 transition-all
                  ${selectedType === w.id ? 'bg-red-500 border-red-500 text-white' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {/* Wicket taker */}
        {wicketDef?.needsTaker && (
          <div>
            <p className="text-sm font-semibold text-green-800 mb-2">
              {selectedType === 'run_out' ? 'Who threw/fielded?' :
               selectedType === 'stumped' ? 'Keeper (stumped by)?' : 'Caught by?'}
            </p>
            <select className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm"
              value={takerId} onChange={e => setTakerId(e.target.value)}>
              <option value="">Select fielder</option>
              {fieldingPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Btn variant="outline" className="flex-1" onClick={onClose}>Cancel</Btn>
          <Btn variant="danger" className="flex-1"
            disabled={!selectedType || !playerOutId || (wicketDef?.needsTaker ? !takerId : false)}
            onClick={() => onConfirm(selectedType, takerId || null, playerOutId)}>
            Confirm Wicket
          </Btn>
        </div>
      </div>
    </Modal>
  );
};

// ─── Main App ─────────────────────────────────────────────────────────────────
type View = 'dashboard' | 'setup' | 'scoring' | 'overlay';

export default function App() {
  const [view, setView] = useState<View>('dashboard');

  // Data
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [activeInnings, setActiveInnings] = useState<Innings | null>(null);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [allPlayers, setAllPlayers] = useState<{ [teamId: number]: Player[] }>({});

  // Setup form
  const [newTeamName, setNewTeamName] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [selectedTeamForPlayer, setSelectedTeamForPlayer] = useState<number | null>(null);
  const [selectedTeam1, setSelectedTeam1] = useState<number | null>(null);
  const [selectedTeam2, setSelectedTeam2] = useState<number | null>(null);
  const [overs, setOvers] = useState(20);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [facebookLiveId, setFacebookLiveId] = useState('');

  // Scoring state
  const [strikerId, setStrikerId] = useState<number | null>(null);
  const [nonStrikerId, setNonStrikerId] = useState<number | null>(null);
  const [bowlerId, setBowlerId] = useState<number | null>(null);
  const [isFreeHit, setIsFreeHit] = useState(false);
  const [extrasMode, setExtrasMode] = useState<'wide'|'no_ball'|'bye'|'leg_bye'|'penalty'|null>(null);
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [pendingRuns, setPendingRuns] = useState(0);

  // Modals
  const [showScorecard, setShowScorecard] = useState(false);
  const [showLivePanel, setShowLivePanel] = useState(false);
  const [scorecard, setScorecard] = useState<any[]>([]);

  // YouTube/Facebook
  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false);
  const [youtubeBroadcasts, setYoutubeBroadcasts] = useState<any[]>([]);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState('');
  const [connectedChannel, setConnectedChannel] = useState<string>('');

  // Toast
  const [toast, setToast] = useState<{msg: string; type: 'success'|'error'} | null>(null);
  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Overlay route check
  useEffect(() => {
    if (window.location.pathname.startsWith('/overlay/')) {
      const matchId = window.location.pathname.split('/')[2];
      if (matchId) { loadMatch(Number(matchId), true); setView('overlay'); }
    }
  }, []);

  useEffect(() => { fetchTeams(); fetchBroadcasts(); }, []);

  useEffect(() => {
    if (selectedTeamForPlayer) fetchPlayersForTeam(selectedTeamForPlayer);
  }, [selectedTeamForPlayer]);

  useEffect(() => {
    if (!activeMatch || activeMatch.status !== 'live') return;
    const interval = setInterval(() => loadMatch(activeMatch.id, true), 5000);
    return () => clearInterval(interval);
  }, [activeMatch?.id, activeMatch?.status]);

  useEffect(() => {
    if (activeMatch) {
      fetchPlayersForTeam(activeMatch.team1_id);
      fetchPlayersForTeam(activeMatch.team2_id);
    }
  }, [activeMatch?.id]);

  // ── API ───────────────────────────────────────────────────────────────────────
  const fetchTeams = async () => {
    const res = await fetch('/api/teams');
    setTeams(await res.json());
  };

  const fetchPlayersForTeam = async (teamId: number) => {
    const res = await fetch(`/api/teams/${teamId}/players`);
    const data = await res.json();
    setAllPlayers(prev => ({ ...prev, [teamId]: data }));
  };

  const fetchBroadcasts = async () => {
    try {
      const res = await fetch('/api/youtube/broadcasts');
      if (res.ok) {
        const data = await res.json();
        setYoutubeBroadcasts(data);
        setIsYouTubeConnected(true);
        if (data.length > 0 && !connectedChannel) setConnectedChannel('Connected');
      }
    } catch { setIsYouTubeConnected(false); }
  };

  const disconnectYouTube = async () => {
    await fetch('/api/auth/google/disconnect', { method: 'POST' });
    setIsYouTubeConnected(false);
    setYoutubeBroadcasts([]);
    setSelectedBroadcastId('');
    setConnectedChannel('');
    showToast('YouTube disconnected');
  };

  const loadMatch = async (id: number, silent = false) => {
    const res = await fetch(`/api/matches/${id}`);
    const data = await res.json();
    setActiveMatch(data);
    if (data.innings?.length > 0) {
      const curr = data.innings[data.innings.length - 1];
      setActiveInnings(curr);
      fetchBalls(curr.id);
    }
    if (!silent) setView('scoring');
  };

  const fetchBalls = async (inningsId: number) => {
    const res = await fetch(`/api/innings/${inningsId}/balls`);
    const data: Ball[] = await res.json();
    setBalls(data);
    setIsFreeHit(data.length > 0 && data[0].extras_type === 'no_ball');
  };

  // ── Actions ───────────────────────────────────────────────────────────────────
  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    await fetch('/api/teams', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTeamName.trim() })
    });
    setNewTeamName(''); fetchTeams(); showToast('Team added!');
  };

  const addPlayer = async () => {
    if (!newPlayerName.trim() || !selectedTeamForPlayer) return;
    await fetch('/api/players', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: selectedTeamForPlayer, name: newPlayerName.trim() })
    });
    setNewPlayerName(''); fetchPlayersForTeam(selectedTeamForPlayer); showToast('Player added!');
  };

  const startMatch = async () => {
    if (!selectedTeam1 || !selectedTeam2) return;
    const res = await fetch('/api/matches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        team1_id: selectedTeam1, team2_id: selectedTeam2,
        overs_per_innings: overs, youtube_url: youtubeUrl, facebook_live_id: facebookLiveId
      })
    });
    const data = await res.json();
    if (selectedBroadcastId) {
      await fetch(`/api/matches/${data.id}/youtube`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broadcast_id: selectedBroadcastId })
      });
    }
    loadMatch(data.id); showToast('Match started!');
  };

  const handleToss = async (winnerId: number, decision: 'bat'|'bowl') => {
    if (!activeMatch) return;
    await fetch(`/api/matches/${activeMatch.id}/toss`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toss_winner_id: winnerId, toss_decision: decision })
    });
    loadMatch(activeMatch.id); showToast('Toss recorded! Match is live.');
  };

  const recordBall = async (runs: number, wicketData?: { type: string; takerId: string|null; playerOutId: string }) => {
    if (!activeInnings || !strikerId || !nonStrikerId || !bowlerId) {
      showToast('Select striker, non-striker and bowler!', 'error'); return;
    }

    const currentOver = Math.floor(activeInnings.total_balls / 6);
    const currentBall = (activeInnings.total_balls % 6) + 1;

    let runsScored = runs;
    let extrasRuns = 0;
    const extrasType = extrasMode;
    const isWicket = !!wicketData && !isFreeHit && extrasMode !== 'wide';

    if (extrasMode === 'wide') { runsScored = 0; extrasRuns = 1 + runs; }
    else if (extrasMode === 'no_ball') { runsScored = runs; extrasRuns = 1; }
    else if (extrasMode === 'bye' || extrasMode === 'leg_bye') { runsScored = 0; extrasRuns = runs; }
    else if (extrasMode === 'penalty') { runsScored = 0; extrasRuns = 5; }

    const ballData: any = {
      innings_id: activeInnings.id, over_number: currentOver, ball_number: currentBall,
      batsman_id: strikerId, non_striker_id: nonStrikerId, bowler_id: bowlerId,
      runs_batter: runsScored, extras_runs: extrasRuns, extras_type: extrasType,
      is_wicket: isWicket ? 1 : 0, is_free_hit: isFreeHit ? 1 : 0,
    };

    if (wicketData) {
      ballData.wicket_type = wicketData.type;
      ballData.wicket_taker_id = wicketData.takerId;
      ballData.player_out_id = wicketData.playerOutId;
    }

    await fetch('/api/balls', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ballData)
    });

    // Strike rotation
    const totalRuns = runsScored + (extrasMode === 'bye' || extrasMode === 'leg_bye' ? runs : extrasMode === 'penalty' ? 5 : 0);
    if ((runsScored + extrasRuns) % 2 !== 0) { setStrikerId(nonStrikerId); setNonStrikerId(strikerId); }

    const isValidBall = !['wide', 'no_ball'].includes(extrasMode || '');
    if (isValidBall && currentBall === 6) { setStrikerId(nonStrikerId); setNonStrikerId(strikerId); setBowlerId(null); }

    // If wicket — new batsman needed
    if (isWicket && wicketData) {
      if (wicketData.playerOutId === String(strikerId)) setStrikerId(null);
      else if (wicketData.playerOutId === String(nonStrikerId)) setNonStrikerId(null);
    }

    setExtrasMode(null);
    setPendingRuns(0);
    loadMatch(activeMatch!.id);
  };

  const handleRunButton = (runs: number) => {
    if (showWicketModal) return;
    recordBall(runs);
  };

  const handleWicketClick = () => {
    setShowWicketModal(true);
  };

  const handleWicketConfirm = (type: string, takerId: string|null, playerOutId: string) => {
    setShowWicketModal(false);
    recordBall(0, { type, takerId, playerOutId });
  };

  const undoLastBall = async () => {
    if (!balls.length) return;
    await fetch(`/api/balls/${balls[0].id}`, { method: 'DELETE' });
    loadMatch(activeMatch!.id); showToast('Last ball undone');
  };

  const endInnings = async () => {
    if (!activeInnings || !activeMatch) return;
    if (activeInnings.innings_number === 1) {
      const battingTeamId = activeMatch.team1_id === activeInnings.batting_team_id ? activeMatch.team2_id : activeMatch.team1_id;
      await fetch('/api/innings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: activeMatch.id, batting_team_id: battingTeamId, innings_number: 2 })
      });
      setStrikerId(null); setNonStrikerId(null); setBowlerId(null);
      loadMatch(activeMatch.id); showToast('2nd Innings started!');
    } else {
      const firstInnings = activeMatch.innings![0];
      const target = firstInnings.total_runs + 1;
      let winnerId = null; let resultNote = '';
      if (activeInnings.total_runs >= target) {
        winnerId = activeInnings.batting_team_id;
        resultNote = `${teams.find(t => t.id === winnerId)?.name} won by ${10 - activeInnings.total_wickets} wickets`;
      } else if (activeInnings.total_runs < target - 1) {
        winnerId = firstInnings.batting_team_id;
        resultNote = `${teams.find(t => t.id === winnerId)?.name} won by ${firstInnings.total_runs - activeInnings.total_runs} runs`;
      } else { resultNote = 'Match Tied!'; }
      await fetch(`/api/matches/${activeMatch.id}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ winner_id: winnerId, result_note: resultNote })
      });
      loadMatch(activeMatch.id); showToast(resultNote);
    }
  };

  const connectYouTube = () => {
    fetch('/api/auth/google/url').then(r => r.json()).then(({ url }) => {
      const handler = (e: MessageEvent) => {
        if (e.data?.type === 'OAUTH_AUTH_SUCCESS') {
          setIsYouTubeConnected(true);
          fetchBroadcasts();
          showToast('YouTube connected!');
          window.removeEventListener('message', handler);
        }
      };
      window.addEventListener('message', handler);
      window.open(url, 'yt_auth', 'width=600,height=700');
    });
  };

  const fetchScorecard = async () => {
    if (!activeMatch) return;
    const res = await fetch(`/api/matches/${activeMatch.id}/scorecard`);
    setScorecard(await res.json()); setShowScorecard(true);
  };

  // ── Computed ──────────────────────────────────────────────────────────────────
  const currentOver = activeInnings ? Math.floor(activeInnings.total_balls / 6) : 0;
  const currentBall = activeInnings ? activeInnings.total_balls % 6 : 0;
  const target = activeMatch?.innings && activeMatch.innings.length > 1 ? activeMatch.innings[0].total_runs + 1 : null;
  const battingTeamPlayers = activeInnings ? allPlayers[activeInnings.batting_team_id] || [] : [];
  const bowlingTeamId = activeInnings && activeMatch
    ? (activeInnings.batting_team_id === activeMatch.team1_id ? activeMatch.team2_id : activeMatch.team1_id) : null;
  const bowlingTeamPlayers = bowlingTeamId ? allPlayers[bowlingTeamId] || [] : [];
  const thisOverBalls = balls.filter(b => b.over_number === currentOver).reverse();
  const strikerPlayer = battingTeamPlayers.find(p => p.id === strikerId) || null;
  const nonStrikerPlayer = battingTeamPlayers.find(p => p.id === nonStrikerId) || null;

  const getBallDisplay = (b: Ball) => {
    if (b.is_wicket) return { label: 'W', cls: 'bg-red-500 text-white' };
    if (b.extras_type === 'wide') return { label: 'Wd', cls: 'bg-yellow-400 text-yellow-900' };
    if (b.extras_type === 'no_ball') return { label: 'Nb', cls: 'bg-orange-400 text-white' };
    if (b.extras_type === 'penalty') return { label: 'P', cls: 'bg-gray-500 text-white' };
    if (b.runs_batter === 6) return { label: '6', cls: 'bg-purple-500 text-white' };
    if (b.runs_batter === 4) return { label: '4', cls: 'bg-blue-500 text-white' };
    return { label: String(b.runs_batter + b.extras_runs), cls: 'bg-green-100 text-green-800' };
  };

  // ── Dashboard ─────────────────────────────────────────────────────────────────
  const renderDashboard = () => (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <div className="bg-gradient-to-br from-green-700 to-green-900 text-white rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><Tv2 size={22} /></div>
          <div>
            <h1 className="text-2xl font-bold">Cricket Scorer Pro</h1>
            <p className="text-green-200 text-sm">Live scoring · YouTube · Facebook</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn variant="yellow" onClick={() => setView('setup')}><Plus size={16} /> New Match</Btn>
          {activeMatch?.status === 'live' && (
            <Btn variant="outline" className="border-white text-white hover:bg-white/10" onClick={() => setView('scoring')}>
              Resume Match
            </Btn>
          )}
        </div>
      </div>

      {/* Active match */}
      {activeMatch && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-green-900">Active Match</h2>
            {activeMatch.status === 'live' && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                <span className="live-dot" /> LIVE
              </span>
            )}
          </div>
          <p className="text-center font-bold text-green-900">{activeMatch.team1_name} vs {activeMatch.team2_name}</p>
          {activeInnings && (
            <p className="text-center text-3xl font-black text-green-700 mt-1">
              {activeInnings.total_runs}/{activeInnings.total_wickets}
              <span className="text-base font-normal text-green-400 ml-2">({currentOver}.{currentBall} ov)</span>
            </p>
          )}
          <div className="flex gap-2 mt-4">
            <Btn variant="primary" className="flex-1" onClick={() => setView('scoring')}><Play size={15} /> Score</Btn>
            <Btn variant="outline" onClick={() => window.open(`/overlay/${activeMatch.id}`, '_blank')}><Tv2 size={15} /> Overlay</Btn>
            <Btn variant="outline" onClick={fetchScorecard}><BarChart3 size={15} /></Btn>
          </div>
        </Card>
      )}

      {/* Team setup */}
      <Card className="p-5">
        <h2 className="font-bold text-green-900 mb-4 flex items-center gap-2"><Users size={18} /> Team Setup</h2>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input type="text" placeholder="Team name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createTeam()}
              className="flex-1 px-3 py-2 border border-green-200 rounded-lg text-sm" />
            <Btn variant="primary" onClick={createTeam}>Add</Btn>
          </div>
          <div className="flex gap-2">
            <select className="flex-1 px-3 py-2 border border-green-200 rounded-lg text-sm"
              value={selectedTeamForPlayer || ''} onChange={e => setSelectedTeamForPlayer(Number(e.target.value))}>
              <option value="">Select team for players</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {selectedTeamForPlayer && (
            <div className="flex gap-2">
              <input type="text" placeholder="Player name" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPlayer()}
                className="flex-1 px-3 py-2 border border-green-200 rounded-lg text-sm" />
              <Btn variant="outline" onClick={addPlayer}>Add</Btn>
            </div>
          )}
          {selectedTeamForPlayer && allPlayers[selectedTeamForPlayer]?.length > 0 && (
            <div className="bg-green-50 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
              {allPlayers[selectedTeamForPlayer].map(p => (
                <div key={p.id} className="text-sm text-green-800 flex items-center gap-2">
                  <Check size={12} className="text-green-500" /> {p.name}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-green-400">{teams.length} team{teams.length !== 1 ? 's' : ''} registered</p>
        </div>
      </Card>
    </div>
  );

  // ── Setup ─────────────────────────────────────────────────────────────────────
  const renderSetup = () => (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('dashboard')} className="p-2 rounded-lg hover:bg-green-100 text-green-700"><Home size={20} /></button>
        <h1 className="text-xl font-bold text-green-900">New Match Setup</h1>
      </div>
      <Card className="p-5 space-y-5">
        {/* Teams */}
        <div>
          <label className="text-sm font-semibold text-green-800 block mb-2">Select Teams</label>
          <div className="grid grid-cols-2 gap-3">
            <select className="w-full px-3 py-2.5 border border-green-200 rounded-xl text-sm"
              value={selectedTeam1 || ''} onChange={e => setSelectedTeam1(Number(e.target.value))}>
              <option value="">Team 1</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className="w-full px-3 py-2.5 border border-green-200 rounded-xl text-sm"
              value={selectedTeam2 || ''} onChange={e => setSelectedTeam2(Number(e.target.value))}>
              <option value="">Team 2</option>
              {teams.filter(t => t.id !== selectedTeam1).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>

        {/* Overs */}
        <div>
          <label className="text-sm font-semibold text-green-800 block mb-2">Format (Overs)</label>
          <div className="flex gap-2">
            {[5, 10, 15, 20, 50].map(o => (
              <button key={o} onClick={() => setOvers(o)}
                className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all
                  ${overs === o ? 'bg-green-600 text-white border-green-600' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
                {o}
              </button>
            ))}
          </div>
        </div>

        {/* YouTube — OPTIONAL */}
        <div>
          <label className="text-sm font-semibold text-green-800 flex items-center gap-2 mb-2">
            <Youtube size={15} className="text-red-500" /> YouTube Live
            <span className="text-xs text-green-400 font-normal">(optional)</span>
          </label>
          {!isYouTubeConnected ? (
            <Btn variant="outline" className="w-full" onClick={connectYouTube}>Connect YouTube Account</Btn>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between bg-green-50 px-3 py-2 rounded-lg">
                <span className="text-xs text-green-700 font-semibold flex items-center gap-1"><Check size={13} /> YouTube Connected</span>
                <button onClick={disconnectYouTube} className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1">
                  <LogOut size={12} /> Disconnect
                </button>
              </div>
              <select className="w-full px-3 py-2.5 border border-green-200 rounded-xl text-sm"
                value={selectedBroadcastId} onChange={e => setSelectedBroadcastId(e.target.value)}>
                <option value="">Select active broadcast (optional)</option>
                {youtubeBroadcasts.map(b => <option key={b.id} value={b.id}>{b.snippet?.title}</option>)}
              </select>
              <button onClick={() => { setIsYouTubeConnected(false); connectYouTube(); }}
                className="text-xs text-green-600 underline flex items-center gap-1">
                <RefreshCw size={11} /> Switch account
              </button>
            </div>
          )}
          <input type="url" placeholder="YouTube stream URL (optional)" value={youtubeUrl}
            onChange={e => setYoutubeUrl(e.target.value)}
            className="w-full px-3 py-2.5 border border-green-200 rounded-xl text-sm mt-2" />
        </div>

        {/* Facebook — OPTIONAL */}
        <div>
          <label className="text-sm font-semibold text-green-800 flex items-center gap-2 mb-2">
            <Share2 size={15} className="text-blue-600" /> Facebook Live
            <span className="text-xs text-green-400 font-normal">(optional)</span>
          </label>
          <input type="text" placeholder="Facebook Live Video ID (optional)" value={facebookLiveId}
            onChange={e => setFacebookLiveId(e.target.value)}
            className="w-full px-3 py-2.5 border border-green-200 rounded-xl text-sm" />
          <p className="text-xs text-green-400 mt-1">Score updates post as comments automatically</p>
        </div>

        <Btn variant="primary" size="lg" className="w-full" disabled={!selectedTeam1 || !selectedTeam2} onClick={startMatch}>
          <Play size={18} /> Start Match
        </Btn>
      </Card>
    </div>
  );

  // ── Scoring ───────────────────────────────────────────────────────────────────
  const renderScoring = () => {
    if (!activeMatch) return null;

    // Toss screen
    if (!activeMatch.toss_winner_id) {
      return (
        <div className="max-w-md mx-auto p-4">
          <Card className="p-6 text-center space-y-5">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Trophy size={28} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-green-900">Toss</h2>
            <p className="text-green-600 text-sm">Who won the toss?</p>
            <div className="space-y-4">
              {[activeMatch.team1_id, activeMatch.team2_id].map(teamId => {
                const name = teamId === activeMatch.team1_id ? activeMatch.team1_name : activeMatch.team2_name;
                return (
                  <div key={teamId}>
                    <p className="font-semibold text-green-800 mb-2">{name} won — elected to...</p>
                    <div className="flex gap-2">
                      <Btn variant="primary" className="flex-1" onClick={() => handleToss(teamId, 'bat')}>Bat</Btn>
                      <Btn variant="outline" className="flex-1" onClick={() => handleToss(teamId, 'bowl')}>Bowl</Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      );
    }

    const battingTeamName = activeInnings?.batting_team_id === activeMatch.team1_id ? activeMatch.team1_name : activeMatch.team2_name;

    return (
      <div className="max-w-4xl mx-auto p-3 space-y-3">
        {activeMatch.status === 'completed' && (
          <div className="bg-green-600 text-white rounded-2xl p-4 text-center font-bold flex items-center justify-center gap-2">
            <Trophy size={20} /> {activeMatch.result_note}
          </div>
        )}

        {/* Live score header */}
        <div className="bg-gradient-to-br from-green-800 to-green-950 text-white rounded-2xl p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-green-400 text-xs font-bold uppercase tracking-widest">{battingTeamName} batting</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-5xl font-black">{activeInnings?.total_runs ?? 0}</span>
                <span className="text-3xl text-green-500">/ {activeInnings?.total_wickets ?? 0}</span>
              </div>
              <p className="text-green-400 text-sm mt-1 font-mono">{currentOver}.{currentBall} / {activeMatch.overs_per_innings} ov</p>
              {target && (
                <p className="text-yellow-300 text-sm mt-1 font-semibold">
                  Target: {target} · Need {target - (activeInnings?.total_runs || 0)} from {activeMatch.overs_per_innings * 6 - (activeInnings?.total_balls || 0)} balls
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {activeMatch.status === 'live' && <span className="flex items-center gap-1.5 text-xs font-bold"><span className="live-dot" /> LIVE</span>}
              {isFreeHit && <span className="bg-yellow-400 text-yellow-900 text-xs font-black px-2 py-1 rounded-full">FREE HIT!</span>}
              <div className="flex gap-1 mt-1">
                <button onClick={() => setView('dashboard')} className="p-2 rounded-lg bg-white/10 hover:bg-white/20"><Home size={15} /></button>
                <button onClick={fetchScorecard} className="p-2 rounded-lg bg-white/10 hover:bg-white/20"><BarChart3 size={15} /></button>
                <button onClick={() => window.open(`/overlay/${activeMatch.id}`, '_blank')} className="p-2 rounded-lg bg-white/10 hover:bg-white/20"><Tv2 size={15} /></button>
              </div>
            </div>
          </div>
          {/* This over balls */}
          <div className="mt-4">
            <p className="text-green-400 text-xs font-bold mb-2">THIS OVER</p>
            <div className="flex gap-2 flex-wrap">
              {thisOverBalls.map((b, i) => {
                const d = getBallDisplay(b);
                return <span key={i} className={`inline-flex items-center justify-center w-9 h-9 rounded-full font-bold text-xs ${d.cls}`}>{d.label}</span>;
              })}
              {thisOverBalls.length === 0 && <span className="text-green-500 text-xs">No balls yet</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Main scoring panel */}
          <div className="md:col-span-2 space-y-3">
            {/* Player selection */}
            <Card className="p-4">
              <h3 className="font-bold text-green-900 text-xs uppercase tracking-wide mb-3">On Field</h3>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-green-500 font-semibold mb-1">Striker *</p>
                  <select className="w-full text-xs px-2 py-2 border border-green-200 rounded-lg"
                    value={strikerId || ''} onChange={e => setStrikerId(Number(e.target.value))}>
                    <option value="">Select</option>
                    {battingTeamPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-green-500 font-semibold mb-1">Non-Striker</p>
                  <select className="w-full text-xs px-2 py-2 border border-green-200 rounded-lg"
                    value={nonStrikerId || ''} onChange={e => setNonStrikerId(Number(e.target.value))}>
                    <option value="">Select</option>
                    {battingTeamPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-green-500 font-semibold mb-1">Bowler</p>
                  <select className="w-full text-xs px-2 py-2 border border-green-200 rounded-lg"
                    value={bowlerId || ''} onChange={e => setBowlerId(Number(e.target.value))}>
                    <option value="">Select</option>
                    {bowlingTeamPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            </Card>

            {/* Ball entry */}
            <Card className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-green-900 text-xs uppercase tracking-wide">Record Ball</h3>
                <Btn variant="ghost" size="sm" onClick={undoLastBall}><Undo2 size={14} /> Undo</Btn>
              </div>

              {/* Extras row */}
              <div className="flex gap-2 mb-3 flex-wrap">
                {(['wide', 'no_ball', 'bye', 'leg_bye', 'penalty'] as const).map(e => (
                  <button key={e} onClick={() => setExtrasMode(prev => prev === e ? null : e)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all
                      ${extrasMode === e ? 'bg-yellow-400 border-yellow-400 text-yellow-900' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
                    {e === 'no_ball' ? 'NB' : e === 'leg_bye' ? 'LB' : e === 'penalty' ? 'PEN' : e.toUpperCase().slice(0, 2)}
                  </button>
                ))}
              </div>

              {/* Run buttons */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[0, 1, 2, 3, 4, 6, 5, 7].map(r => (
                  <button key={r} onClick={() => handleRunButton(r)}
                    className={`btn-ball h-16 rounded-xl font-black text-xl border-2 transition-all
                      ${r === 4 ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100' :
                        r === 6 ? 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100' :
                          'border-green-200 bg-white text-green-900 hover:bg-green-50'}
                      ${extrasMode ? 'ring-2 ring-yellow-400' : ''}`}>
                    {r}
                  </button>
                ))}
              </div>

              {/* Wicket button */}
              <button onClick={handleWicketClick}
                className={`w-full py-3 rounded-xl font-black text-sm border-2 transition-all
                  ${isFreeHit ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' :
                    'border-red-400 bg-red-50 text-red-700 hover:bg-red-100'}`}
                disabled={isFreeHit}>
                🏏 WICKET {isFreeHit ? '(Free Hit — no wicket)' : ''}
              </button>

              {/* Mode hint */}
              {extrasMode && (
                <div className="mt-2 px-3 py-2 rounded-lg text-xs font-semibold bg-yellow-50 text-yellow-700">
                  {extrasMode.toUpperCase()} mode — tap runs scored
                  {extrasMode === 'penalty' ? ' (5 penalty runs will be added)' : ''}
                </div>
              )}
            </Card>

            {activeMatch.status === 'live' && (
              <Btn variant="danger" className="w-full" onClick={endInnings}>End Innings / Declare</Btn>
            )}
          </div>

          {/* Right panel */}
          <div className="space-y-3">
            {/* Live stream status */}
            <Card className="p-4">
              <h3 className="font-bold text-green-900 text-xs mb-3 flex items-center gap-2"><Radio size={14} /> Live</h3>
              <div className="space-y-2">
                <div className={`flex items-center justify-between p-2 rounded-lg ${activeMatch.youtube_broadcast_id ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <span className="flex items-center gap-1.5 text-xs font-semibold"><Youtube size={13} className="text-red-500" /> YouTube</span>
                  <span className={`text-xs font-bold ${activeMatch.youtube_broadcast_id ? 'text-green-600' : 'text-gray-400'}`}>
                    {activeMatch.youtube_broadcast_id ? '● LIVE' : 'Off'}
                  </span>
                </div>
                <div className={`flex items-center justify-between p-2 rounded-lg ${activeMatch.facebook_live_id ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <span className="flex items-center gap-1.5 text-xs font-semibold"><Share2 size={13} className="text-blue-600" /> Facebook</span>
                  <span className={`text-xs font-bold ${activeMatch.facebook_live_id ? 'text-blue-600' : 'text-gray-400'}`}>
                    {activeMatch.facebook_live_id ? '● LIVE' : 'Off'}
                  </span>
                </div>
              </div>
              <Btn variant="outline" size="sm" className="w-full mt-3" onClick={() => window.open(`/overlay/${activeMatch.id}`, '_blank')}>
                <Tv2 size={13} /> OBS Overlay
              </Btn>
            </Card>

            {/* Recent balls */}
            <Card className="p-4">
              <h3 className="font-bold text-green-900 text-xs mb-3">Recent Balls</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {balls.slice(0, 15).map(b => {
                  const d = getBallDisplay(b);
                  return (
                    <div key={b.id} className="flex items-center justify-between text-xs py-1 border-b border-green-50">
                      <span className="text-green-400">{b.over_number}.{b.ball_number}</span>
                      {b.wicket_type && <span className="text-red-500 text-xs">{b.wicket_type.replace('_', ' ')}</span>}
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${d.cls}`}>{d.label}</span>
                    </div>
                  );
                })}
                {balls.length === 0 && <p className="text-xs text-green-400 text-center py-4">No balls yet</p>}
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  };

  // ── Overlay ───────────────────────────────────────────────────────────────────
  const renderOverlay = () => (
    <div className="min-h-screen bg-transparent flex items-end p-6">
      <div className="bg-green-900/95 backdrop-blur text-white px-6 py-4 rounded-2xl border border-green-700/50 shadow-2xl flex items-center gap-6">
        <div className="flex items-center gap-3 border-r border-green-700 pr-6">
          <span className="live-dot" />
          <div>
            <p className="text-green-400 text-[10px] font-bold uppercase tracking-widest">Live</p>
            <p className="font-black text-lg uppercase">{activeMatch?.team1_name} vs {activeMatch?.team2_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div><p className="text-green-400 text-[10px] font-bold uppercase">Score</p>
            <p className="text-3xl font-black">{activeInnings?.total_runs ?? 0}/{activeInnings?.total_wickets ?? 0}</p></div>
          <div><p className="text-green-400 text-[10px] font-bold uppercase">Overs</p>
            <p className="text-xl font-mono font-bold">{currentOver}.{currentBall}</p></div>
          {target && <div><p className="text-green-400 text-[10px] font-bold uppercase">Target</p>
            <p className="text-xl font-bold text-yellow-300">{target}</p></div>}
        </div>
        {thisOverBalls.length > 0 && (
          <div className="border-l border-green-700 pl-6">
            <p className="text-green-400 text-[10px] font-bold uppercase mb-1">This Over</p>
            <div className="flex gap-1">
              {thisOverBalls.slice(-6).map((b, i) => {
                const d = getBallDisplay(b);
                return <span key={i} className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${d.cls}`}>{d.label}</span>;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── Scorecard modal ───────────────────────────────────────────────────────────
  const renderScorecard = () => (
    <Modal title="Match Scorecard" onClose={() => setShowScorecard(false)}>
      {scorecard.map((inn: any, idx: number) => (
        <div key={idx} className="mb-8">
          <div className="flex justify-between items-center border-b-2 border-green-800 pb-2 mb-3">
            <h3 className="font-bold text-green-900">Innings {inn.innings_number}</h3>
            <p className="text-xl font-black text-green-700">
              {inn.total_runs}/{inn.total_wickets}
              <span className="text-sm font-normal text-green-400 ml-2">({Math.floor(inn.total_balls/6)}.{inn.total_balls%6} ov)</span>
            </p>
          </div>
          <table className="w-full text-xs mb-3">
            <thead><tr className="text-green-500 border-b border-green-100">
              <th className="text-left py-2 font-semibold">Batter</th>
              <th className="text-right py-2">R</th><th className="text-right py-2">B</th>
              <th className="text-right py-2">4s</th><th className="text-right py-2">6s</th><th className="text-right py-2">SR</th>
            </tr></thead>
            <tbody>
              {inn.battingStats?.map((s: BattingStats, i: number) => (
                <tr key={i} className="border-b border-green-50">
                  <td className="py-2 font-medium">{s.name}{!s.is_out ? ' *' : ''}</td>
                  <td className="text-right font-bold">{s.runs}</td>
                  <td className="text-right text-green-500">{s.balls}</td>
                  <td className="text-right text-blue-600">{s.fours}</td>
                  <td className="text-right text-purple-600">{s.sixes}</td>
                  <td className="text-right text-green-500">{((s.runs/(s.balls||1))*100).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bg-green-50 rounded px-3 py-2 text-xs mb-3 flex justify-between">
            <span className="text-green-600 font-semibold">Extras</span>
            <span>{inn.extras?.total ?? 0}
              <span className="text-green-400 ml-1">(wd {inn.extras?.wides ?? 0}, nb {inn.extras?.no_balls ?? 0}, b {inn.extras?.byes ?? 0}, lb {inn.extras?.leg_byes ?? 0}, pen {inn.extras?.penalty ?? 0})</span>
            </span>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="text-green-500 border-b border-green-100">
              <th className="text-left py-2 font-semibold">Bowler</th>
              <th className="text-right py-2">O</th><th className="text-right py-2">R</th>
              <th className="text-right py-2">W</th><th className="text-right py-2">Econ</th>
            </tr></thead>
            <tbody>
              {inn.bowlingStats?.map((s: BowlingStats, i: number) => (
                <tr key={i} className="border-b border-green-50">
                  <td className="py-2 font-medium">{s.name}</td>
                  <td className="text-right font-bold">{Math.floor(s.balls/6)}.{s.balls%6}</td>
                  <td className="text-right text-green-500">{s.runs}</td>
                  <td className="text-right font-black text-green-600">{s.wickets}</td>
                  <td className="text-right text-green-500">{(s.runs/(s.balls/6||1)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </Modal>
  );

  // ── Root ──────────────────────────────────────────────────────────────────────
  if (view === 'overlay') return renderOverlay();

  return (
    <div className="min-h-screen bg-green-50">
      <nav className="bg-white border-b border-green-100 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center"><Tv2 size={16} className="text-white" /></div>
            <span className="font-bold text-green-900 text-sm">Cricket Scorer Pro</span>
          </div>
          <div className="flex gap-1">
            <button onClick={() => setView('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'dashboard' ? 'bg-green-100 text-green-800' : 'text-green-600 hover:bg-green-50'}`}>
              Home
            </button>
            {activeMatch && (
              <button onClick={() => setView('scoring')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'scoring' ? 'bg-green-100 text-green-800' : 'text-green-600 hover:bg-green-50'}`}>
                Score {activeMatch.status === 'live' && '🔴'}
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="pb-8">
        {view === 'dashboard' && renderDashboard()}
        {view === 'setup' && renderSetup()}
        {view === 'scoring' && renderScoring()}
      </div>

      {showScorecard && renderScorecard()}

      {/* Wicket Modal */}
      {showWicketModal && (
        <WicketModal
          onConfirm={handleWicketConfirm}
          onClose={() => setShowWicketModal(false)}
          fieldingPlayers={bowlingTeamPlayers}
          batsmen={{ striker: strikerPlayer, nonStriker: nonStrikerPlayer }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-lg flex items-center gap-2
          ${toast.type === 'success' ? 'bg-green-700 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
