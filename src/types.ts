export interface Team {
  id: number;
  name: string;
}

export interface Player {
  id: number;
  team_id: number;
  name: string;
}

export interface Match {
  id: number;
  team1_id: number;
  team2_id: number;
  team1_name: string;
  team2_name: string;
  toss_winner_id: number | null;
  toss_decision: 'bat' | 'bowl' | null;
  overs_per_innings: number;
  youtube_url: string | null;
  youtube_broadcast_id: string | null;
  facebook_live_id: string | null;
  status: 'scheduled' | 'live' | 'completed';
  winner_id: number | null;
  result_note: string | null;
  innings?: Innings[];
}

export interface Innings {
  id: number;
  match_id: number;
  batting_team_id: number;
  innings_number: number;
  total_runs: number;
  total_wickets: number;
  total_balls: number;
  is_completed: number;
}

export interface Ball {
  id: number;
  innings_id: number;
  over_number: number;
  ball_number: number;
  batsman_id: number;
  non_striker_id: number;
  bowler_id: number;
  runs_batter: number;
  extras_runs: number;
  extras_type: 'wide' | 'no_ball' | 'bye' | 'leg_bye' | null;
  is_wicket: number;
  wicket_type: string | null;
  is_free_hit: number;
}

export interface BattingStats {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  is_out: number;
}

export interface BowlingStats {
  name: string;
  balls: number;
  runs: number;
  wickets: number;
}
