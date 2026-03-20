import React, { useState, useEffect } from 'react';
import { Trophy, Users, Play, Plus, Undo2, Youtube, Share2, X, Check, AlertCircle, Radio, Tv2, BarChart3, Home, LogOut, RefreshCw, ChevronRight } from 'lucide-react';
import { Team, Player, Match, Innings, Ball, BattingStats, BowlingStats } from './types';

const WICKET_TYPES = [
  { id: 'bowled', label: 'Bowled', needsTaker: false },
  { id: 'caught', label: 'Caught', needsTaker: true },
  { id: 'caught_behind', label: 'Caught Behind', needsTaker: true },
  { id: 'caught_and_bowled', label: 'C&B', needsTaker: false },
  { id: 'lbw', label: 'LBW', needsTaker: false },
  { id: 'stumped', label: 'Stumped', needsTaker: true },
  { id: 'run_out', label: 'Run Out', needsTaker: true },
  { id: 'hit_wicket', label: 'Hit Wicket', needsTaker: false },
  { id: 'retired', label: 'Retired', needsTaker: false },
  { id: 'retired_hurt', label: 'Ret. Hurt', needsTaker: false },
  { id: 'obstructing', label: 'Obstruct', needsTaker: false },
  { id: 'timed_out', label: 'Timed Out', needsTaker: false },
];

// ─── Overlay Widget (self-contained, fetches own data) ────────────────────────
function OverlayWidget() {
  const [data, setData] = useState<any>(null);

  const matchId = window.location.pathname.split('/')[2];

  const getBallChip = (b: any) => {
    if (b.is_wicket) return { label: 'W', cls: 'bg-red-500 text-white' };
    if (b.extras_type === 'wide') return { label: b.extras_runs > 1 ? `Wd+${b.extras_runs - 1}` : 'Wd', cls: 'bg-yellow-400 text-yellow-900' };
    if (b.extras_type === 'no_ball') return { label: b.runs_batter > 0 ? `Nb+${b.runs_batter}` : 'Nb', cls: 'bg-orange-400 text-white' };
    if (b.runs_batter === 6) return { label: '6', cls: 'bg-purple-500 text-white' };
    if (b.runs_batter === 4) return { label: '4', cls: 'bg-blue-400 text-white' };
    return { label: String(b.runs_batter), cls: 'bg-white/20 text-white' };
  };

  const fetchData = async () => {
    try {
      const [mRes, scRes] = await Promise.all([
        fetch(`/api/matches/${matchId}`),
        fetch(`/api/matches/${matchId}/scorecard`),
      ]);
      const match = await mRes.json();
      const scorecard = await scRes.json();
      if (!match || match.error) return;

      const innings = match.innings || [];
      const currInnings = innings[innings.length - 1];
      if (!currInnings) return;

      const ballsRes = await fetch(`/api/innings/${currInnings.id}/balls`);
      const allBalls: any[] = await ballsRes.json();

      const [t1Res, t2Res] = await Promise.all([
        fetch(`/api/teams/${match.team1_id}/players`),
        fetch(`/api/teams/${match.team2_id}/players`),
      ]);
      const team1Players: any[] = await t1Res.json();
      const team2Players: any[] = await t2Res.json();
      const allPlayers: any[] = [...team1Players, ...team2Players];

      const currentOver = Math.floor(currInnings.total_balls / 6);
      const currentBall = currInnings.total_balls % 6;
      const thisOverBalls = allBalls.filter((b: any) => b.over_number === currentOver).reverse();

      // Last striker/non-striker from most recent ball
      const lastBall = allBalls[0];
      const strikerId = lastBall?.batsman_id;
      const nonStrikerId = lastBall?.non_striker_id;
      const bowlerId = lastBall?.bowler_id;

      const getBatsmanStats = (id: number) => {
        const playerBalls = allBalls.filter((b: any) => b.batsman_id === id && b.extras_type !== 'wide');
        return {
          runs: playerBalls.reduce((s: number, b: any) => s + b.runs_batter, 0),
          balls: playerBalls.length,
          fours: playerBalls.filter((b: any) => b.runs_batter === 4).length,
          sixes: playerBalls.filter((b: any) => b.runs_batter === 6).length,
        };
      };

      const getBowlerStats = (id: number) => {
        const bowlerBalls = allBalls.filter((b: any) => b.bowler_id === id);
        return {
          balls: bowlerBalls.filter((b: any) => !['wide', 'no_ball'].includes(b.extras_type || '')).length,
          runs: bowlerBalls.reduce((s: number, b: any) => s + b.runs_batter + b.extras_runs, 0),
          wickets: bowlerBalls.filter((b: any) => b.is_wicket).length,
        };
      };

      // Partnership
      const partnershipBalls = allBalls.filter((b: any) =>
        (b.batsman_id === strikerId || b.batsman_id === nonStrikerId) &&
        !b.is_wicket
      );
      const partnership = partnershipBalls.reduce((s: number, b: any) => s + b.runs_batter + b.extras_runs, 0);

      // Run rate
      const runRate = currInnings.total_balls > 0
        ? ((currInnings.total_runs / currInnings.total_balls) * 6).toFixed(1)
        : '0.0';

      // Required run rate
      const target = innings.length > 1 ? innings[0].total_runs + 1 : null;
      const ballsLeft = match.overs_per_innings * 6 - currInnings.total_balls;
      const rrr = target && ballsLeft > 0
        ? (((target - currInnings.total_runs) / ballsLeft) * 6).toFixed(1)
        : null;

      setData({
        match, innings, currInnings, allBalls, allPlayers,
        currentOver, currentBall, thisOverBalls,
        strikerId, nonStrikerId, bowlerId,
        striker: { player: allPlayers.find(p => p.id === strikerId), stats: getBatsmanStats(strikerId) },
        nonStriker: { player: allPlayers.find(p => p.id === nonStrikerId), stats: getBatsmanStats(nonStrikerId) },
        bowler: { player: allPlayers.find(p => p.id === bowlerId), stats: getBowlerStats(bowlerId) },
        partnership, runRate, rrr, target,
      });
    } catch (e) { console.error('Overlay fetch error', e); }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return (
    <div className="min-h-screen bg-transparent flex items-end p-0">
      <div className="bg-green-900/90 text-green-400 px-6 py-3 text-sm font-bold rounded-t-xl">Loading overlay...</div>
    </div>
  );

  const { match, currInnings, thisOverBalls, striker, nonStriker, bowler, partnership, runRate, rrr, target, currentOver, currentBall } = data;
  const battingTeamName = currInnings?.batting_team_id === match.team1_id ? match.team1_name : match.team2_name;
  const bowlingTeamName = currInnings?.batting_team_id === match.team1_id ? match.team2_name : match.team1_name;

  return (
    <div className="min-h-screen bg-transparent flex items-end">
      <div style={{ fontFamily: 'system-ui, sans-serif', width: '100%', background: 'transparent' }}>
        {/* Main overlay bar */}
        <div style={{ display: 'flex', alignItems: 'stretch', background: 'rgba(5,40,10,0.96)', borderTop: '3px solid #22c55e', minHeight: 70 }}>

          {/* LEFT: Batsmen */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 14px', borderRight: '1px solid rgba(255,255,255,0.1)', minWidth: 160 }}>
            {striker.player && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ color: '#facc15', fontSize: 9, fontWeight: 900 }}>▶</span>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{striker.player.name}</span>
                <span style={{ color: '#facc15', fontSize: 11, fontWeight: 900 }}>*</span>
                <span style={{ color: '#86efac', fontSize: 12, fontWeight: 700, marginLeft: 4 }}>
                  {striker.stats.runs}
                  <span style={{ color: '#4ade80', fontSize: 10, fontWeight: 400 }}> ({striker.stats.balls})</span>
                  {striker.stats.fours > 0 && <span style={{ color: '#93c5fd', fontSize: 10 }}> {striker.stats.fours}×4</span>}
                  {striker.stats.sixes > 0 && <span style={{ color: '#c4b5fd', fontSize: 10 }}> {striker.stats.sixes}×6</span>}
                </span>
              </div>
            )}
            {nonStriker.player && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#4ade80', fontSize: 9 }}>●</span>
                <span style={{ color: '#d1fae5', fontSize: 12, fontWeight: 600 }}>{nonStriker.player.name}</span>
                <span style={{ color: '#6ee7b7', fontSize: 12, fontWeight: 700, marginLeft: 4 }}>
                  {nonStriker.stats.runs}
                  <span style={{ color: '#4ade80', fontSize: 10, fontWeight: 400 }}> ({nonStriker.stats.balls})</span>
                </span>
              </div>
            )}
          </div>

          {/* CENTER: Score */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 16px', background: 'rgba(22,101,52,0.6)' }}>
            <div style={{ color: '#bbf7d0', fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 2 }}>
              {battingTeamName} vs {bowlingTeamName}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ color: '#fff', fontSize: 32, fontWeight: 900, lineHeight: 1 }}>{currInnings?.total_runs ?? 0}</span>
              <span style={{ color: '#4ade80', fontSize: 22, fontWeight: 700 }}>/{currInnings?.total_wickets ?? 0}</span>
              <span style={{ color: '#86efac', fontSize: 13, fontWeight: 600, fontFamily: 'monospace' }}>({currentOver}.{currentBall})</span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
              <span style={{ color: '#fde68a', fontSize: 10 }}>RR {runRate}</span>
              {rrr && <span style={{ color: '#f87171', fontSize: 10 }}>RRR {rrr}</span>}
              {target && <span style={{ color: '#fde68a', fontSize: 10 }}>Need {target - (currInnings?.total_runs || 0)}</span>}
            </div>
          </div>

          {/* This over balls */}
          {thisOverBalls.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 12px', borderLeft: '1px solid rgba(255,255,255,0.1)', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ color: '#6ee7b7', fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>THIS OVER</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {thisOverBalls.slice(-6).map((b: any, i: number) => {
                  let label = String(b.runs_batter);
                  let bg = 'rgba(255,255,255,0.15)'; let color = '#fff';
                  if (b.is_wicket) { label = 'W'; bg = '#ef4444'; }
                  else if (b.extras_type === 'wide') { label = b.extras_runs > 1 ? `W+${b.extras_runs-1}` : 'Wd'; bg = '#eab308'; color = '#422006'; }
                  else if (b.extras_type === 'no_ball') { label = b.runs_batter > 0 ? `N+${b.runs_batter}` : 'Nb'; bg = '#f97316'; }
                  else if (b.runs_batter === 6) { bg = '#7c3aed'; }
                  else if (b.runs_batter === 4) { bg = '#2563eb'; }
                  return (
                    <div key={i} style={{ minWidth: 28, height: 28, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>
                      {label}
                    </div>
                  );
                })}
              </div>
              {partnership > 0 && <div style={{ color: '#86efac', fontSize: 9, marginTop: 3, textAlign: 'center' }}>P: {partnership}</div>}
            </div>
          )}

          {/* RIGHT: Bowler */}
          {bowler.player && (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 14px', borderLeft: '1px solid rgba(255,255,255,0.1)', minWidth: 130 }}>
              <div style={{ color: '#6ee7b7', fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>BOWLER</div>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>{bowler.player.name}</div>
              <div style={{ color: '#86efac', fontSize: 11, fontWeight: 600 }}>
                {Math.floor(bowler.stats.balls / 6)}.{bowler.stats.balls % 6} ov &nbsp;
                <span style={{ color: '#fca5a5' }}>{bowler.stats.runs}r</span> &nbsp;
                <span style={{ color: '#4ade80', fontWeight: 900 }}>{bowler.stats.wickets}W</span>
              </div>
            </div>
          )}

          {/* LIVE badge */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', background: '#16a34a', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'pulse 1.5s infinite' }} />
              <span style={{ color: '#fff', fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>LIVE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── UI ───────────────────────────────────────────────────────────────────────
const Btn = ({ children, onClick, variant = 'primary', size = 'md', disabled = false, className = '' }: any) => {
  const v: any = {
    primary: 'bg-green-600 hover:bg-green-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    outline: 'border-2 border-green-600 text-green-700 hover:bg-green-50',
    ghost: 'text-green-700 hover:bg-green-100',
    yellow: 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900',
    fb: 'bg-blue-600 hover:bg-blue-700 text-white',
    dark: 'bg-green-900 hover:bg-green-800 text-white',
  };
  const s: any = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${v[variant]} ${s[size]} rounded-lg font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 ${className}`}>
      {children}
    </button>
  );
};
const Card = ({ children, className = '' }: any) => (
  <div className={`bg-white rounded-2xl border border-green-100 shadow-sm ${className}`}>{children}</div>
);
const Modal = ({ children, onClose, title }: any) => (
  <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
      <div className="flex items-center justify-between p-4 border-b border-green-100">
        <h2 className="text-base font-bold text-green-900">{title}</h2>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-green-50 text-green-600"><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  </div>
);

// ─── Wicket Modal ─────────────────────────────────────────────────────────────
const WicketModal = ({ onConfirm, onClose, fieldingPlayers, batsmen }: any) => {
  const [selectedType, setSelectedType] = useState('');
  const [takerId, setTakerId] = useState('');
  const [playerOutId, setPlayerOutId] = useState('');
  const wicketDef = WICKET_TYPES.find(w => w.id === selectedType);
  return (
    <Modal title="Wicket Details" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-green-800 mb-2">Who is out?</p>
          <div className="flex gap-2">
            {[batsmen.striker, batsmen.nonStriker].filter(Boolean).map((p: any) => (
              <button key={p.id} onClick={() => setPlayerOutId(String(p.id))}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${playerOutId === String(p.id) ? 'bg-red-500 border-red-500 text-white' : 'border-green-200 text-green-800 hover:bg-green-50'}`}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-green-800 mb-2">How out?</p>
          <div className="grid grid-cols-3 gap-2">
            {WICKET_TYPES.map(w => (
              <button key={w.id} onClick={() => { setSelectedType(w.id); setTakerId(''); }}
                className={`py-2 px-1 rounded-lg text-xs font-semibold border-2 transition-all ${selectedType === w.id ? 'bg-red-500 border-red-500 text-white' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
                {w.label}
              </button>
            ))}
          </div>
        </div>
        {wicketDef?.needsTaker && (
          <div>
            <p className="text-xs font-semibold text-green-800 mb-2">
              {selectedType === 'run_out' ? 'Fielder (run out by)?' : selectedType === 'stumped' ? 'Keeper (stumped by)?' : 'Caught by?'}
            </p>
            <select className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" value={takerId} onChange={e => setTakerId(e.target.value)}>
              <option value="">Select fielder</option>
              {fieldingPlayers.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex gap-3 pt-1">
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

// ─── Over Summary Modal ───────────────────────────────────────────────────────
const OverSummaryModal = ({ summary, onClose }: { summary: any; onClose: () => void }) => (
  <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
    <div className="bg-green-900 text-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-green-700 px-5 py-3 flex justify-between items-center">
        <div>
          <p className="text-green-300 text-xs font-bold uppercase tracking-widest">Over {summary.overNumber} Complete</p>
          <p className="text-2xl font-black">{summary.runsInOver} runs · {summary.wicketsInOver} wkt{summary.wicketsInOver !== 1 ? 's' : ''}</p>
        </div>
        <div className="text-right">
          <p className="text-green-300 text-xs">Total</p>
          <p className="text-2xl font-black">{summary.totalRuns}/{summary.totalWickets}</p>
        </div>
      </div>
      {/* Balls */}
      <div className="px-5 py-3">
        <p className="text-green-400 text-xs font-bold mb-2">BALLS THIS OVER</p>
        <div className="flex gap-2 flex-wrap">
          {summary.balls.map((b: any, i: number) => {
            let label = String(b.runs_batter + b.extras_runs);
            let cls = 'bg-green-700 text-white';
            if (b.is_wicket) { label = 'W'; cls = 'bg-red-500 text-white'; }
            else if (b.extras_type === 'wide') { label = `Wd${b.extras_runs > 1 ? '+' + (b.extras_runs - 1) : ''}`; cls = 'bg-yellow-400 text-yellow-900'; }
            else if (b.extras_type === 'no_ball') { label = `Nb${b.runs_batter > 0 ? '+' + b.runs_batter : ''}`; cls = 'bg-orange-400 text-white'; }
            else if (b.runs_batter === 6) { label = '6'; cls = 'bg-purple-500 text-white'; }
            else if (b.runs_batter === 4) { label = '4'; cls = 'bg-blue-400 text-white'; }
            return (
              <div key={i} className={`min-w-[36px] h-9 px-2 rounded-full flex items-center justify-center font-black text-xs ${cls}`}>
                {label}
              </div>
            );
          })}
        </div>
      </div>
      {/* Batsmen stats */}
      <div className="px-5 py-2 border-t border-green-800">
        <p className="text-green-400 text-xs font-bold mb-2">BATSMEN</p>
        <div className="space-y-1">
          {summary.batsmen.map((b: any, i: number) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="font-semibold">{b.name} {b.isStriker ? '*' : ''}</span>
              <span className="text-green-300">{b.runs} <span className="text-xs">({b.balls})</span>
                {b.fours > 0 && <span className="text-blue-300 ml-1">{b.fours}×4</span>}
                {b.sixes > 0 && <span className="text-purple-300 ml-1">{b.sixes}×6</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
      {/* Bowler stats */}
      <div className="px-5 py-2 border-t border-green-800">
        <p className="text-green-400 text-xs font-bold mb-2">BOWLER</p>
        <div className="flex justify-between text-sm">
          <span className="font-semibold">{summary.bowler.name}</span>
          <span className="text-green-300">
            {Math.floor(summary.bowler.balls / 6)}.{summary.bowler.balls % 6} ov · {summary.bowler.runs} runs · {summary.bowler.wickets}W
          </span>
        </div>
      </div>
      {/* Required */}
      {summary.required && (
        <div className="px-5 py-2 border-t border-green-800 text-center">
          <p className="text-yellow-300 font-bold text-sm">{summary.required}</p>
        </div>
      )}
      <div className="px-5 py-3">
        <button onClick={onClose} className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-bold text-sm transition-all">
          Continue →
        </button>
      </div>
    </div>
  </div>
);

// ─── Main App ─────────────────────────────────────────────────────────────────
type View = 'dashboard' | 'setup' | 'scoring' | 'overlay';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [activeInnings, setActiveInnings] = useState<Innings | null>(null);
  const [balls, setBalls] = useState<Ball[]>([]);
  const [allPlayers, setAllPlayers] = useState<{ [k: number]: Player[] }>({});
  const [newTeamName, setNewTeamName] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [selectedTeamForPlayer, setSelectedTeamForPlayer] = useState<number | null>(null);
  const [selectedTeam1, setSelectedTeam1] = useState<number | null>(null);
  const [selectedTeam2, setSelectedTeam2] = useState<number | null>(null);
  const [overs, setOvers] = useState(20);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [facebookLiveId, setFacebookLiveId] = useState('');
  const [strikerId, setStrikerId] = useState<number | null>(null);
  const [nonStrikerId, setNonStrikerId] = useState<number | null>(null);
  const [bowlerId, setBowlerId] = useState<number | null>(null);
  const [isFreeHit, setIsFreeHit] = useState(false);
  const [extrasMode, setExtrasMode] = useState<'wide' | 'no_ball' | 'bye' | 'leg_bye' | 'penalty' | null>(null);
  const [showWicketModal, setShowWicketModal] = useState(false);
  const [showScorecard, setShowScorecard] = useState(false);
  const [overSummary, setOverSummary] = useState<any | null>(null);
  const [scorecard, setScorecard] = useState<any[]>([]);
  const [isYouTubeConnected, setIsYouTubeConnected] = useState(false);
  const [youtubeBroadcasts, setYoutubeBroadcasts] = useState<any[]>([]);
  const [selectedBroadcastId, setSelectedBroadcastId] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    if (window.location.pathname.startsWith('/overlay/')) {
      const id = window.location.pathname.split('/')[2];
      if (id) { loadMatch(Number(id), true); setView('overlay'); }
    }
  }, []);

  useEffect(() => { fetchTeams(); fetchBroadcasts(); }, []);
  useEffect(() => { if (selectedTeamForPlayer) fetchPlayersForTeam(selectedTeamForPlayer); }, [selectedTeamForPlayer]);
  useEffect(() => {
    if (!activeMatch || activeMatch.status !== 'live') return;
    const interval = setInterval(() => loadMatch(activeMatch.id, true), 5000);
    return () => clearInterval(interval);
  }, [activeMatch?.id, activeMatch?.status]);
  useEffect(() => {
    if (activeMatch) { fetchPlayersForTeam(activeMatch.team1_id); fetchPlayersForTeam(activeMatch.team2_id); }
  }, [activeMatch?.id]);

  const fetchTeams = async () => { const r = await fetch('/api/teams'); setTeams(await r.json()); };
  const fetchPlayersForTeam = async (id: number) => {
    const r = await fetch(`/api/teams/${id}/players`);
    const d = await r.json();
    setAllPlayers(p => ({ ...p, [id]: d }));
  };
  const fetchBroadcasts = async () => {
    try {
      const r = await fetch('/api/youtube/broadcasts');
      if (r.ok) { setYoutubeBroadcasts(await r.json()); setIsYouTubeConnected(true); }
    } catch { setIsYouTubeConnected(false); }
  };
  const disconnectYouTube = async () => {
    await fetch('/api/auth/google/disconnect', { method: 'POST' });
    setIsYouTubeConnected(false); setYoutubeBroadcasts([]); setSelectedBroadcastId('');
    showToast('YouTube disconnected');
  };
  const loadMatch = async (id: number, silent = false) => {
    const r = await fetch(`/api/matches/${id}`);
    const d = await r.json();
    setActiveMatch(d);
    if (d.innings?.length > 0) {
      const curr = d.innings[d.innings.length - 1];
      setActiveInnings(curr);
      fetchBalls(curr.id);
    }
    if (!silent) setView('scoring');
  };
  const fetchBalls = async (inningsId: number) => {
    const r = await fetch(`/api/innings/${inningsId}/balls`);
    const d: Ball[] = await r.json();
    setBalls(d);
    setIsFreeHit(d.length > 0 && d[0].extras_type === 'no_ball');
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    await fetch('/api/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newTeamName.trim() }) });
    setNewTeamName(''); fetchTeams(); showToast('Team added!');
  };
  const addPlayer = async () => {
    if (!newPlayerName.trim() || !selectedTeamForPlayer) return;
    await fetch('/api/players', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team_id: selectedTeamForPlayer, name: newPlayerName.trim() }) });
    setNewPlayerName(''); fetchPlayersForTeam(selectedTeamForPlayer); showToast('Player added!');
  };
  const startMatch = async () => {
    if (!selectedTeam1 || !selectedTeam2) return;
    const r = await fetch('/api/matches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ team1_id: selectedTeam1, team2_id: selectedTeam2, overs_per_innings: overs, youtube_url: youtubeUrl, facebook_live_id: facebookLiveId }) });
    const d = await r.json();
    if (selectedBroadcastId) await fetch(`/api/matches/${d.id}/youtube`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ broadcast_id: selectedBroadcastId }) });
    loadMatch(d.id); showToast('Match started!');
  };
  const handleToss = async (winnerId: number, decision: 'bat' | 'bowl') => {
    if (!activeMatch) return;
    await fetch(`/api/matches/${activeMatch.id}/toss`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ toss_winner_id: winnerId, toss_decision: decision }) });
    loadMatch(activeMatch.id); showToast('Match is live!');
  };

  // ─── Build over summary ─────────────────────────────────────────────────────
  const buildOverSummary = (allBalls: Ball[], overNum: number, innings: Innings, matchData: Match, players: { [k: number]: Player[] }) => {
    const overBalls = allBalls.filter(b => b.over_number === overNum);
    const runsInOver = overBalls.reduce((s, b) => s + b.runs_batter + b.extras_runs, 0);
    const wicketsInOver = overBalls.filter(b => b.is_wicket).length;

    // Batsmen stats from all balls
    const batsmanMap: { [id: number]: { runs: number; balls: number; fours: number; sixes: number } } = {};
    allBalls.forEach(b => {
      if (!batsmanMap[b.batsman_id]) batsmanMap[b.batsman_id] = { runs: 0, balls: 0, fours: 0, sixes: 0 };
      batsmanMap[b.batsman_id].runs += b.runs_batter;
      if (!['wide'].includes(b.extras_type || '')) batsmanMap[b.batsman_id].balls++;
      if (b.runs_batter === 4) batsmanMap[b.batsman_id].fours++;
      if (b.runs_batter === 6) batsmanMap[b.batsman_id].sixes++;
    });

    // Get current batsmen
    const battingPlayers = players[innings.batting_team_id] || [];
    const batsmen = [strikerId, nonStrikerId].filter(Boolean).map(id => {
      const p = battingPlayers.find(p => p.id === id);
      const stats = batsmanMap[id!] || { runs: 0, balls: 0, fours: 0, sixes: 0 };
      return { name: p?.name || 'Unknown', isStriker: id === strikerId, ...stats };
    });

    // Bowler stats
    const bowlerId2 = overBalls[0]?.bowler_id;
    const bowlingTeamId = innings.batting_team_id === matchData.team1_id ? matchData.team2_id : matchData.team1_id;
    const bowlerName = (players[bowlingTeamId] || []).find(p => p.id === bowlerId2)?.name || 'Bowler';
    const allBowlerBalls = allBalls.filter(b => b.bowler_id === bowlerId2);
    const bowlerRuns = allBowlerBalls.reduce((s, b) => s + b.runs_batter + b.extras_runs, 0);
    const bowlerBalls = allBowlerBalls.filter(b => !['wide', 'no_ball'].includes(b.extras_type || '')).length;
    const bowlerWickets = allBowlerBalls.filter(b => b.is_wicket).length;

    // Required
    let required = null;
    if (matchData.innings && matchData.innings.length > 1) {
      const target = matchData.innings[0].total_runs + 1;
      const need = target - innings.total_runs;
      const ballsLeft = matchData.overs_per_innings * 6 - innings.total_balls;
      if (need > 0) required = `Need ${need} runs in ${ballsLeft} balls`;
      else required = 'Target achieved!';
    }

    return {
      overNumber: overNum + 1,
      runsInOver, wicketsInOver,
      totalRuns: innings.total_runs,
      totalWickets: innings.total_wickets,
      balls: overBalls.reverse(),
      batsmen, required,
      bowler: { name: bowlerName, balls: bowlerBalls, runs: bowlerRuns, wickets: bowlerWickets }
    };
  };

  // ─── Record ball ────────────────────────────────────────────────────────────
  const recordBall = async (runs: number, wicketData?: { type: string; takerId: string | null; playerOutId: string }) => {
    if (!activeInnings || !strikerId || !nonStrikerId || !bowlerId) {
      showToast('Select striker, non-striker and bowler!', 'error'); return;
    }
    const currentOver = Math.floor(activeInnings.total_balls / 6);
    const currentBallNum = (activeInnings.total_balls % 6) + 1;
    let runsScored = runs, extrasRuns = 0;
    const extrasType = extrasMode;
    const isWicket = !!wicketData && !isFreeHit && extrasMode !== 'wide';

    // ── FIX: Wide+runs, NB+runs logic ──
    if (extrasMode === 'wide') {
      runsScored = 0;
      extrasRuns = 1 + runs; // wide = 1 + any extra runs (overthrows)
    } else if (extrasMode === 'no_ball') {
      runsScored = runs; // batsman runs count normally
      extrasRuns = 1;    // +1 for no ball
    } else if (extrasMode === 'bye' || extrasMode === 'leg_bye') {
      runsScored = 0;
      extrasRuns = runs;
    } else if (extrasMode === 'penalty') {
      runsScored = 0;
      extrasRuns = 5;
    }

    const ballData: any = {
      innings_id: activeInnings.id, over_number: currentOver, ball_number: currentBallNum,
      batsman_id: strikerId, non_striker_id: nonStrikerId, bowler_id: bowlerId,
      runs_batter: runsScored, extras_runs: extrasRuns, extras_type: extrasType,
      is_wicket: isWicket ? 1 : 0, is_free_hit: isFreeHit ? 1 : 0,
      wicket_type: wicketData?.type || null,
      wicket_taker_id: wicketData?.takerId || null,
      player_out_id: wicketData?.playerOutId || null,
    };

    await fetch('/api/balls', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ballData) });

    // Strike rotation
    const totalForRotation = runsScored + extrasRuns;
    if (totalForRotation % 2 !== 0 && extrasMode !== 'wide') { // wide doesn't rotate
      setStrikerId(nonStrikerId); setNonStrikerId(strikerId);
    }

    const isValidBall = !['wide', 'no_ball'].includes(extrasMode || '');
    const newTotalBalls = activeInnings.total_balls + (isValidBall ? 1 : 0);
    const newBallInOver = newTotalBalls % 6;

    // Over end — show summary
    if (isValidBall && currentBallNum === 6) {
      setStrikerId(nonStrikerId); setNonStrikerId(strikerId); setBowlerId(null);
      // Fetch latest balls to build summary
      const r = await fetch(`/api/innings/${activeInnings.id}/balls`);
      const latestBalls: Ball[] = await r.json();
      const r2 = await fetch(`/api/matches/${activeMatch!.id}`);
      const latestMatch = await r2.json();
      const latestInnings = latestMatch.innings?.[latestMatch.innings.length - 1];
      if (latestInnings) {
        const summary = buildOverSummary(latestBalls, currentOver, latestInnings, latestMatch, allPlayers);
        setOverSummary(summary);
      }
    }

    // Wicket — clear out player
    if (isWicket && wicketData) {
      if (wicketData.playerOutId === String(strikerId)) setStrikerId(null);
      else if (wicketData.playerOutId === String(nonStrikerId)) setNonStrikerId(null);
    }

    setExtrasMode(null);
    loadMatch(activeMatch!.id);
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
      await fetch('/api/innings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ match_id: activeMatch.id, batting_team_id: battingTeamId, innings_number: 2 }) });
      setStrikerId(null); setNonStrikerId(null); setBowlerId(null);
      loadMatch(activeMatch.id); showToast('2nd Innings started!');
    } else {
      const fi = activeMatch.innings![0];
      const target = fi.total_runs + 1;
      let winnerId = null, resultNote = '';
      if (activeInnings.total_runs >= target) { winnerId = activeInnings.batting_team_id; resultNote = `${teams.find(t => t.id === winnerId)?.name} won by ${10 - activeInnings.total_wickets} wickets`; }
      else if (activeInnings.total_runs < target - 1) { winnerId = fi.batting_team_id; resultNote = `${teams.find(t => t.id === winnerId)?.name} won by ${fi.total_runs - activeInnings.total_runs} runs`; }
      else { resultNote = 'Match Tied!'; }
      await fetch(`/api/matches/${activeMatch.id}/complete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ winner_id: winnerId, result_note: resultNote }) });
      loadMatch(activeMatch.id); showToast(resultNote);
    }
  };

  const connectYouTube = () => {
    fetch('/api/auth/google/url').then(r => r.json()).then(({ url }) => {
      const handler = (e: MessageEvent) => {
        if (e.data?.type === 'OAUTH_AUTH_SUCCESS') { setIsYouTubeConnected(true); fetchBroadcasts(); showToast('YouTube connected!'); window.removeEventListener('message', handler); }
      };
      window.addEventListener('message', handler);
      window.open(url, 'yt_auth', 'width=600,height=700');
    });
  };

  const fetchScorecard = async () => {
    if (!activeMatch) return;
    const r = await fetch(`/api/matches/${activeMatch.id}/scorecard`);
    setScorecard(await r.json()); setShowScorecard(true);
  };

  // ─── Computed ────────────────────────────────────────────────────────────────
  const currentOver = activeInnings ? Math.floor(activeInnings.total_balls / 6) : 0;
  const currentBall = activeInnings ? activeInnings.total_balls % 6 : 0;
  const target = activeMatch?.innings?.length > 1 ? activeMatch.innings[0].total_runs + 1 : null;
  const battingTeamPlayers = activeInnings ? allPlayers[activeInnings.batting_team_id] || [] : [];
  const bowlingTeamId = activeInnings && activeMatch ? (activeInnings.batting_team_id === activeMatch.team1_id ? activeMatch.team2_id : activeMatch.team1_id) : null;
  const bowlingTeamPlayers = bowlingTeamId ? allPlayers[bowlingTeamId] || [] : [];
  const strikerPlayer = battingTeamPlayers.find(p => p.id === strikerId) || null;
  const nonStrikerPlayer = battingTeamPlayers.find(p => p.id === nonStrikerId) || null;
  const thisOverBalls = balls.filter(b => b.over_number === currentOver).reverse();

  // Current bowler stats
  const currentBowlerStats = bowlerId ? (() => {
    const bowlerBalls = balls.filter(b => b.bowler_id === bowlerId);
    const validBalls = bowlerBalls.filter(b => !['wide', 'no_ball'].includes(b.extras_type || ''));
    const runs = bowlerBalls.reduce((s, b) => s + b.runs_batter + b.extras_runs, 0);
    const wickets = bowlerBalls.filter(b => b.is_wicket).length;
    return { balls: validBalls.length, runs, wickets };
  })() : null;

  // Current batsmen stats
  const getBatsmanStats = (id: number | null) => {
    if (!id) return null;
    const playerBalls = balls.filter(b => b.batsman_id === id && b.extras_type !== 'wide');
    const runs = playerBalls.reduce((s, b) => s + b.runs_batter, 0);
    const ballsFaced = playerBalls.filter(b => b.extras_type !== 'wide').length;
    const fours = playerBalls.filter(b => b.runs_batter === 4).length;
    const sixes = playerBalls.filter(b => b.runs_batter === 6).length;
    return { runs, balls: ballsFaced, fours, sixes };
  };
  const strikerStats = getBatsmanStats(strikerId);
  const nonStrikerStats = getBatsmanStats(nonStrikerId);

  const getBallDisplay = (b: Ball) => {
    if (b.is_wicket) return { label: 'W', cls: 'bg-red-500 text-white' };
    if (b.extras_type === 'wide') return { label: b.extras_runs > 1 ? `Wd+${b.extras_runs - 1}` : 'Wd', cls: 'bg-yellow-400 text-yellow-900' };
    if (b.extras_type === 'no_ball') return { label: b.runs_batter > 0 ? `Nb+${b.runs_batter}` : 'Nb', cls: 'bg-orange-400 text-white' };
    if (b.extras_type === 'penalty') return { label: 'P5', cls: 'bg-gray-500 text-white' };
    if (b.runs_batter === 6) return { label: '6', cls: 'bg-purple-500 text-white' };
    if (b.runs_batter === 4) return { label: '4', cls: 'bg-blue-500 text-white' };
    return { label: String(b.runs_batter), cls: 'bg-green-100 text-green-800' };
  };

  // ─── Dashboard ───────────────────────────────────────────────────────────────
  const renderDashboard = () => (
    <div className="max-w-3xl mx-auto p-4 space-y-5">
      <div className="bg-gradient-to-br from-green-700 to-green-900 text-white rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><Tv2 size={22} /></div>
          <div><h1 className="text-2xl font-bold">Cricket Scorer Pro</h1><p className="text-green-200 text-sm">Live · YouTube · Facebook</p></div>
        </div>
        <div className="flex gap-2">
          <Btn variant="yellow" onClick={() => setView('setup')}><Plus size={16} /> New Match</Btn>
          {activeMatch?.status === 'live' && <Btn variant="outline" className="border-white text-white hover:bg-white/10" onClick={() => setView('scoring')}>Resume</Btn>}
        </div>
      </div>
      {activeMatch && (
        <Card className="p-5">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-bold text-green-900">Active Match</h2>
            {activeMatch.status === 'live' && <span className="flex items-center gap-1.5 text-xs font-bold text-green-600"><span className="live-dot" /> LIVE</span>}
          </div>
          <p className="text-center font-bold text-green-900">{activeMatch.team1_name} vs {activeMatch.team2_name}</p>
          {activeInnings && <p className="text-center text-3xl font-black text-green-700 mt-1">{activeInnings.total_runs}/{activeInnings.total_wickets} <span className="text-base font-normal text-green-400">({currentOver}.{currentBall} ov)</span></p>}
          <div className="flex gap-2 mt-4">
            <Btn variant="primary" className="flex-1" onClick={() => setView('scoring')}><Play size={15} /> Score</Btn>
            <Btn variant="outline" onClick={() => window.open(`/overlay/${activeMatch.id}`, '_blank')}><Tv2 size={15} /></Btn>
            <Btn variant="outline" onClick={fetchScorecard}><BarChart3 size={15} /></Btn>
          </div>
        </Card>
      )}
      <Card className="p-5">
        <h2 className="font-bold text-green-900 mb-4 flex items-center gap-2"><Users size={18} /> Team Setup</h2>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input type="text" placeholder="Team name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createTeam()} className="flex-1 px-3 py-2 border border-green-200 rounded-lg text-sm" />
            <Btn variant="primary" onClick={createTeam}>Add</Btn>
          </div>
          <select className="w-full px-3 py-2 border border-green-200 rounded-lg text-sm" value={selectedTeamForPlayer || ''} onChange={e => setSelectedTeamForPlayer(Number(e.target.value))}>
            <option value="">Select team for players</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {selectedTeamForPlayer && (
            <div className="flex gap-2">
              <input type="text" placeholder="Player name" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPlayer()} className="flex-1 px-3 py-2 border border-green-200 rounded-lg text-sm" />
              <Btn variant="outline" onClick={addPlayer}>Add</Btn>
            </div>
          )}
          {selectedTeamForPlayer && allPlayers[selectedTeamForPlayer]?.length > 0 && (
            <div className="bg-green-50 rounded-lg p-3 max-h-32 overflow-y-auto space-y-1">
              {allPlayers[selectedTeamForPlayer].map(p => <div key={p.id} className="text-sm text-green-800 flex items-center gap-2"><Check size={12} className="text-green-500" />{p.name}</div>)}
            </div>
          )}
          <p className="text-xs text-green-400">{teams.length} team{teams.length !== 1 ? 's' : ''}</p>
        </div>
      </Card>
    </div>
  );

  // ─── Setup ───────────────────────────────────────────────────────────────────
  const renderSetup = () => (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setView('dashboard')} className="p-2 rounded-lg hover:bg-green-100 text-green-700"><Home size={20} /></button>
        <h1 className="text-xl font-bold text-green-900">New Match</h1>
      </div>
      <Card className="p-5 space-y-5">
        <div>
          <label className="text-sm font-semibold text-green-800 block mb-2">Teams</label>
          <div className="grid grid-cols-2 gap-3">
            <select className="w-full px-3 py-2.5 border border-green-200 rounded-xl text-sm" value={selectedTeam1 || ''} onChange={e => setSelectedTeam1(Number(e.target.value))}>
              <option value="">Team 1</option>{teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className="w-full px-3 py-2.5 border border-green-200 rounded-xl text-sm" value={selectedTeam2 || ''} onChange={e => setSelectedTeam2(Number(e.target.value))}>
              <option value="">Team 2</option>{teams.filter(t => t.id !== selectedTeam1).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-green-800 block mb-2">Overs</label>
          <div className="flex gap-2">
            {[5, 10, 15, 20, 50].map(o => (
              <button key={o} onClick={() => setOvers(o)} className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-all ${overs === o ? 'bg-green-600 text-white border-green-600' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>{o}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-green-800 flex items-center gap-2 mb-2"><Youtube size={15} className="text-red-500" /> YouTube <span className="text-xs text-green-400 font-normal">(optional)</span></label>
          {!isYouTubeConnected ? <Btn variant="outline" className="w-full" onClick={connectYouTube}>Connect YouTube</Btn> : (
            <div className="space-y-2">
              <div className="flex justify-between items-center bg-green-50 px-3 py-2 rounded-lg">
                <span className="text-xs text-green-700 font-semibold flex items-center gap-1"><Check size={12} /> YouTube Connected</span>
                <div className="flex gap-2">
                  <button onClick={() => { disconnectYouTube(); setTimeout(connectYouTube, 300); }} className="text-xs text-green-500 underline flex items-center gap-1"><RefreshCw size={11} /> Switch</button>
                  <button onClick={disconnectYouTube} className="text-xs text-red-500 underline flex items-center gap-1"><LogOut size={11} /> Disconnect</button>
                </div>
              </div>
              <select className="w-full px-3 py-2.5 border border-green-200 rounded-xl text-sm" value={selectedBroadcastId} onChange={e => setSelectedBroadcastId(e.target.value)}>
                <option value="">Select broadcast (optional)</option>
                {youtubeBroadcasts.map(b => <option key={b.id} value={b.id}>{b.snippet?.title}</option>)}
              </select>
            </div>
          )}
          <input type="url" placeholder="YouTube stream URL (optional)" value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} className="w-full px-3 py-2.5 border border-green-200 rounded-xl text-sm mt-2" />
        </div>
        <div>
          <label className="text-sm font-semibold text-green-800 flex items-center gap-2 mb-2"><Share2 size={15} className="text-blue-600" /> Facebook Live <span className="text-xs text-green-400 font-normal">(optional)</span></label>
          <input type="text" placeholder="Facebook Live Video ID (optional)" value={facebookLiveId} onChange={e => setFacebookLiveId(e.target.value)} className="w-full px-3 py-2.5 border border-green-200 rounded-xl text-sm" />
        </div>
        <Btn variant="primary" size="lg" className="w-full" disabled={!selectedTeam1 || !selectedTeam2} onClick={startMatch}><Play size={18} /> Start Match</Btn>
      </Card>
    </div>
  );

  // ─── Scoring ─────────────────────────────────────────────────────────────────
  const renderScoring = () => {
    if (!activeMatch) return null;
    if (!activeMatch.toss_winner_id) {
      return (
        <div className="max-w-md mx-auto p-4">
          <Card className="p-6 text-center space-y-5">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto"><Trophy size={28} className="text-green-600" /></div>
            <h2 className="text-xl font-bold text-green-900">Toss</h2>
            <div className="space-y-4">
              {[activeMatch.team1_id, activeMatch.team2_id].map(tid => {
                const name = tid === activeMatch.team1_id ? activeMatch.team1_name : activeMatch.team2_name;
                return (
                  <div key={tid}>
                    <p className="font-semibold text-green-800 mb-2">{name} won — elected to...</p>
                    <div className="flex gap-2">
                      <Btn variant="primary" className="flex-1" onClick={() => handleToss(tid, 'bat')}>Bat</Btn>
                      <Btn variant="outline" className="flex-1" onClick={() => handleToss(tid, 'bowl')}>Bowl</Btn>
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
          <div className="bg-green-600 text-white rounded-2xl p-4 text-center font-bold flex items-center justify-center gap-2"><Trophy size={20} /> {activeMatch.result_note}</div>
        )}
        {/* Score header */}
        <div className="bg-gradient-to-br from-green-800 to-green-950 text-white rounded-2xl p-5">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-green-400 text-xs font-bold uppercase tracking-widest">{battingTeamName}</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-5xl font-black">{activeInnings?.total_runs ?? 0}</span>
                <span className="text-3xl text-green-500">/ {activeInnings?.total_wickets ?? 0}</span>
              </div>
              <p className="text-green-400 text-sm mt-1 font-mono">{currentOver}.{currentBall} / {activeMatch.overs_per_innings} ov</p>
              {target && <p className="text-yellow-300 text-sm mt-1 font-semibold">Target: {target} · Need {target - (activeInnings?.total_runs || 0)} from {activeMatch.overs_per_innings * 6 - (activeInnings?.total_balls || 0)} balls</p>}
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

          {/* Batsmen live stats */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[[strikerId, strikerPlayer, strikerStats, true], [nonStrikerId, nonStrikerPlayer, nonStrikerStats, false]].map(([id, player, stats, isStriker]: any) =>
              player ? (
                <div key={String(id)} className="bg-white/10 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold truncate">{player.name}</span>
                    {isStriker && <span className="text-yellow-400 text-xs">*</span>}
                  </div>
                  {stats && <span className="text-green-300 text-xs">{stats.runs} <span className="opacity-70">({stats.balls})</span>{stats.fours > 0 && <span className="text-blue-300 ml-1">{stats.fours}×4</span>}{stats.sixes > 0 && <span className="text-purple-300 ml-1">{stats.sixes}×6</span>}</span>}
                </div>
              ) : null
            )}
          </div>

          {/* This over */}
          <div className="mt-3">
            <p className="text-green-400 text-xs font-bold mb-2">THIS OVER</p>
            <div className="flex gap-2 flex-wrap">
              {thisOverBalls.map((b, i) => { const d = getBallDisplay(b); return <span key={i} className={`inline-flex items-center justify-center min-w-[36px] h-9 px-2 rounded-full font-bold text-xs ${d.cls}`}>{d.label}</span>; })}
              {thisOverBalls.length === 0 && <span className="text-green-500 text-xs">No balls yet</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 space-y-3">
            {/* Player selection */}
            <Card className="p-4">
              <h3 className="font-bold text-green-900 text-xs uppercase tracking-wide mb-3">On Field</h3>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-green-500 font-semibold mb-1">Striker *</p>
                  <select className="w-full text-xs px-2 py-2 border border-green-200 rounded-lg" value={strikerId || ''} onChange={e => setStrikerId(Number(e.target.value))}>
                    <option value="">Select</option>{battingTeamPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-green-500 font-semibold mb-1">Non-Striker</p>
                  <select className="w-full text-xs px-2 py-2 border border-green-200 rounded-lg" value={nonStrikerId || ''} onChange={e => setNonStrikerId(Number(e.target.value))}>
                    <option value="">Select</option>{battingTeamPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-green-500 font-semibold mb-1">
                    Bowler {currentBowlerStats && <span className="text-green-400">({Math.floor(currentBowlerStats.balls / 6)}.{currentBowlerStats.balls % 6}-{currentBowlerStats.runs}-{currentBowlerStats.wickets})</span>}
                  </p>
                  <select className="w-full text-xs px-2 py-2 border border-green-200 rounded-lg" value={bowlerId || ''} onChange={e => setBowlerId(Number(e.target.value))}>
                    <option value="">Select</option>{bowlingTeamPlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
              {/* Extras */}
              <div className="flex gap-2 mb-3 flex-wrap">
                {(['wide', 'no_ball', 'bye', 'leg_bye', 'penalty'] as const).map(e => (
                  <button key={e} onClick={() => setExtrasMode(prev => prev === e ? null : e)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${extrasMode === e ? 'bg-yellow-400 border-yellow-400 text-yellow-900' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
                    {e === 'no_ball' ? 'NB' : e === 'leg_bye' ? 'LB' : e === 'penalty' ? 'PEN' : e.toUpperCase().slice(0, 2)}
                  </button>
                ))}
              </div>
              {/* Hint for wide/nb */}
              {(extrasMode === 'wide' || extrasMode === 'no_ball') && (
                <div className="mb-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800 font-medium">
                  {extrasMode === 'wide' ? '⚡ WD mode: tap 0 for wide only, tap 4 for Wide+4, tap 1 for Wide+1' : '⚡ NB mode: tap 0 for NB only, tap 4 for NB+4 bat runs, tap 6 for NB+6 bat runs'}
                </div>
              )}
              {/* Runs */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[0, 1, 2, 3, 4, 6, 5, 7].map(r => (
                  <button key={r} onClick={() => recordBall(r)}
                    className={`btn-ball h-16 rounded-xl font-black text-xl border-2 transition-all
                      ${r === 4 ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100' :
                        r === 6 ? 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100' :
                          'border-green-200 bg-white text-green-900 hover:bg-green-50'}
                      ${extrasMode ? 'ring-2 ring-yellow-400' : ''}`}>
                    {r}
                  </button>
                ))}
              </div>
              {/* Wicket */}
              <button onClick={() => setShowWicketModal(true)} disabled={isFreeHit}
                className={`w-full py-3 rounded-xl font-black text-sm border-2 transition-all ${isFreeHit ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed' : 'border-red-400 bg-red-50 text-red-700 hover:bg-red-100'}`}>
                🏏 WICKET {isFreeHit ? '(Free Hit — no wicket)' : ''}
              </button>
            </Card>

            {activeMatch.status === 'live' && <Btn variant="danger" className="w-full" onClick={endInnings}>End Innings / Declare</Btn>}
          </div>

          {/* Right panel */}
          <div className="space-y-3">
            <Card className="p-4">
              <h3 className="font-bold text-green-900 text-xs mb-3 flex items-center gap-2"><Radio size={14} /> Live</h3>
              <div className="space-y-2">
                <div className={`flex items-center justify-between p-2 rounded-lg ${activeMatch.youtube_broadcast_id ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <span className="flex items-center gap-1.5 text-xs font-semibold"><Youtube size={13} className="text-red-500" /> YouTube</span>
                  <span className={`text-xs font-bold ${activeMatch.youtube_broadcast_id ? 'text-green-600' : 'text-gray-400'}`}>{activeMatch.youtube_broadcast_id ? '● LIVE' : 'Off'}</span>
                </div>
                <div className={`flex items-center justify-between p-2 rounded-lg ${activeMatch.facebook_live_id ? 'bg-blue-50' : 'bg-gray-50'}`}>
                  <span className="flex items-center gap-1.5 text-xs font-semibold"><Share2 size={13} className="text-blue-600" /> Facebook</span>
                  <span className={`text-xs font-bold ${activeMatch.facebook_live_id ? 'text-blue-600' : 'text-gray-400'}`}>{activeMatch.facebook_live_id ? '● LIVE' : 'Off'}</span>
                </div>
              </div>
              <Btn variant="outline" size="sm" className="w-full mt-3" onClick={() => window.open(`/overlay/${activeMatch.id}`, '_blank')}><Tv2 size={13} /> OBS Overlay</Btn>
            </Card>
            <Card className="p-4">
              <h3 className="font-bold text-green-900 text-xs mb-3">Recent Balls</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {balls.slice(0, 15).map(b => {
                  const d = getBallDisplay(b);
                  return (
                    <div key={b.id} className="flex items-center justify-between text-xs py-1 border-b border-green-50">
                      <span className="text-green-400">{b.over_number}.{b.ball_number}</span>
                      {b.wicket_type && <span className="text-red-400 text-xs">{b.wicket_type.replace('_', ' ')}</span>}
                      <span className={`inline-flex items-center justify-center min-w-[28px] h-7 px-1 rounded-full text-xs font-bold ${d.cls}`}>{d.label}</span>
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

  // ─── Overlay (for OBS) — self-fetching ───────────────────────────────────────
  const renderOverlay = () => {
    return <OverlayWidget />;
  };

  // ─── Scorecard ───────────────────────────────────────────────────────────────
  const renderScorecard = () => (
    <Modal title="Match Scorecard" onClose={() => setShowScorecard(false)}>
      {scorecard.map((inn: any, idx: number) => (
        <div key={idx} className="mb-8">
          <div className="flex justify-between items-center border-b-2 border-green-800 pb-2 mb-3">
            <h3 className="font-bold text-green-900">Innings {inn.innings_number}</h3>
            <p className="text-xl font-black text-green-700">{inn.total_runs}/{inn.total_wickets} <span className="text-sm font-normal text-green-400">({Math.floor(inn.total_balls / 6)}.{inn.total_balls % 6} ov)</span></p>
          </div>
          <table className="w-full text-xs mb-3">
            <thead><tr className="text-green-500 border-b border-green-100">
              <th className="text-left py-1 font-semibold">Batter</th><th className="text-right py-1">R</th><th className="text-right py-1">B</th><th className="text-right py-1">4s</th><th className="text-right py-1">6s</th><th className="text-right py-1">SR</th>
            </tr></thead>
            <tbody>
              {inn.battingStats?.map((s: BattingStats, i: number) => (
                <tr key={i} className="border-b border-green-50">
                  <td className="py-1.5 font-medium">{s.name}{!s.is_out ? ' *' : ''}</td>
                  <td className="text-right font-bold">{s.runs}</td><td className="text-right text-green-500">{s.balls}</td>
                  <td className="text-right text-blue-600">{s.fours}</td><td className="text-right text-purple-600">{s.sixes}</td>
                  <td className="text-right text-green-500">{((s.runs / (s.balls || 1)) * 100).toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bg-green-50 rounded px-3 py-1.5 text-xs mb-3 flex justify-between">
            <span className="text-green-600 font-semibold">Extras</span>
            <span>{inn.extras?.total ?? 0} <span className="text-green-400">(wd {inn.extras?.wides ?? 0}, nb {inn.extras?.no_balls ?? 0}, b {inn.extras?.byes ?? 0}, lb {inn.extras?.leg_byes ?? 0}, pen {inn.extras?.penalty ?? 0})</span></span>
          </div>
          <table className="w-full text-xs">
            <thead><tr className="text-green-500 border-b border-green-100">
              <th className="text-left py-1 font-semibold">Bowler</th><th className="text-right py-1">O</th><th className="text-right py-1">R</th><th className="text-right py-1">W</th><th className="text-right py-1">Econ</th>
            </tr></thead>
            <tbody>
              {inn.bowlingStats?.map((s: BowlingStats, i: number) => (
                <tr key={i} className="border-b border-green-50">
                  <td className="py-1.5 font-medium">{s.name}</td>
                  <td className="text-right font-bold">{Math.floor(s.balls / 6)}.{s.balls % 6}</td>
                  <td className="text-right text-green-500">{s.runs}</td>
                  <td className="text-right font-black text-green-600">{s.wickets}</td>
                  <td className="text-right text-green-500">{(s.runs / (s.balls / 6 || 1)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </Modal>
  );

  // ─── Root ─────────────────────────────────────────────────────────────────────
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
            <button onClick={() => setView('dashboard')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'dashboard' ? 'bg-green-100 text-green-800' : 'text-green-600 hover:bg-green-50'}`}>Home</button>
            {activeMatch && <button onClick={() => setView('scoring')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === 'scoring' ? 'bg-green-100 text-green-800' : 'text-green-600 hover:bg-green-50'}`}>Score {activeMatch.status === 'live' && '🔴'}</button>}
          </div>
        </div>
      </nav>
      <div className="pb-8">
        {view === 'dashboard' && renderDashboard()}
        {view === 'setup' && renderSetup()}
        {view === 'scoring' && renderScoring()}
      </div>
      {showScorecard && renderScorecard()}
      {showWicketModal && (
        <WicketModal
          onConfirm={(type: string, takerId: string | null, playerOutId: string) => { setShowWicketModal(false); recordBall(0, { type, takerId, playerOutId }); }}
          onClose={() => setShowWicketModal(false)}
          fieldingPlayers={bowlingTeamPlayers}
          batsmen={{ striker: strikerPlayer, nonStriker: nonStrikerPlayer }}
        />
      )}
      {overSummary && <OverSummaryModal summary={overSummary} onClose={() => setOverSummary(null)} />}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-semibold shadow-lg flex items-center gap-2 ${toast.type === 'success' ? 'bg-green-700 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}<span>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
