
export interface TeamStats {
  played: number;
  goalsScored: number;
  goalsConceded: number;
  xgScored: number;
  xgConceded: number;
  homeGamesPlayed?: number;
  awayGamesPlayed?: number;
  homeGoalsScored?: number;
  homeGoalsConceded?: number;
  awayGoalsScored?: number;
  awayGoalsConceded?: number;
  homeXgScored?: number;
  homeXgConceded?: number;
  awayXgScored?: number;
  awayXgConceded?: number;
}

export interface MatchContext {
  homeTeam: string;
  awayTeam: string;
  weather: 'good' | 'rain' | 'extreme';
  homeMidweekCup: boolean;
  awayMidweekCup: boolean;
  homeKeyAbsences: number; 
  awayKeyAbsences: number;
  homeAdvantage: number; // Percentuale, es. 12
  marketOdds: { [key: string]: number };
}

export interface MarketResult {
  label: string;
  category: string;
  probability: number;
  fairOdd: number;
  bookieOdd?: number;
  value?: number;
  isHighProb: boolean;
}

export interface SimulationSummary {
  homeLambda: number;
  awayLambda: number;
  monteCarloResults: {
    homeWin: number;
    draw: number;
    awayWin: number;
    htHomeWin: number;
    htDraw: number;
    htAwayWin: number;
  };
  markets: MarketResult[];
}
