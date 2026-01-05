
import { TeamStats, MatchContext, MarketResult, SimulationSummary } from '../types';

export const factorial = (n: number): number => {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
};

export const poissonProb = (k: number, lambda: number): number => {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k);
};

const samplePoisson = (lambda: number): number => {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
};

export const runMonteCarloSimulation = (hL: number, aL: number, trials: number = 10000) => {
  let hW = 0, dr = 0, aW = 0;
  for (let i = 0; i < trials; i++) {
    const hGoals = samplePoisson(hL);
    const aGoals = samplePoisson(aL);
    if (hGoals > aGoals) hW++;
    else if (aGoals > hGoals) aW++;
    else dr++;
  }
  return {
    homeWin: (hW / trials) * 100,
    draw: (dr / trials) * 100,
    awayWin: (aW / trials) * 100,
    trials
  };
};

const dixonColesAdjustment = (x: number, y: number, hL: number, aL: number, rho: number): number => {
  if (x === 0 && y === 0) return 1 - (hL * aL * rho);
  if (x === 0 && y === 1) return 1 + (hL * rho);
  if (x === 1 && y === 0) return 1 + (aL * rho);
  if (x === 1 && y === 1) return 1 - rho;
  return 1;
};

export const calculateLambdas = (home: TeamStats, away: TeamStats, ctx: MatchContext) => {
  const hGames = home.homeGamesPlayed || (home.played / 2) || 1;
  const aGames = away.awayGamesPlayed || (away.played / 2) || 1;

  const hAttGoals = home.homeGoalsScored ? (home.homeGoalsScored / hGames) : (home.goalsScored / (home.played || 1));
  const hAttXg = home.homeXgScored ? (home.homeXgScored / hGames) : ((home.xgScored || home.goalsScored) / (home.played || 1));
  const homeAttackPower = (hAttGoals + hAttXg) / 2;

  const aDefGoals = away.awayGoalsConceded ? (away.awayGoalsConceded / aGames) : (away.goalsConceded / (away.played || 1));
  const aDefXg = away.awayXgConceded ? (away.awayXgConceded / aGames) : ((away.xgConceded || away.goalsConceded) / (away.played || 1));
  const awayDefensePower = (aDefGoals + aDefXg) / 2;

  const aAttGoals = away.awayGoalsScored ? (away.awayGoalsScored / aGames) : (away.goalsScored / (away.played || 1));
  const aAttXg = away.awayXgScored ? (away.awayXgScored / aGames) : ((away.xgScored || away.goalsScored) / (away.played || 1));
  const awayAttackPower = (aAttGoals + aAttXg) / 2;

  const hDefGoals = home.homeGoalsConceded ? (home.homeGoalsConceded / hGames) : (home.goalsConceded / (home.played || 1));
  const hDefXg = home.homeXgConceded ? (home.homeXgConceded / hGames) : ((home.xgConceded || home.goalsConceded) / (home.played || 1));
  const homeDefensePower = (hDefGoals + hDefXg) / 2;

  let hL = (homeAttackPower + awayDefensePower) / 2;
  let aL = (awayAttackPower + homeDefensePower) / 2;

  // Fattore Campo Dinamico
  hL *= (1 + (ctx.homeAdvantage / 100)); 
  
  if (ctx.weather === 'rain') { hL *= 0.94; aL *= 0.94; }
  if (ctx.weather === 'extreme') { hL *= 0.80; aL *= 0.80; }
  
  if (ctx.homeMidweekCup) hL *= 0.85;
  if (ctx.awayMidweekCup) aL *= 0.85;
  
  hL *= (1 - (ctx.homeKeyAbsences * 0.06));
  aL *= (1 - (ctx.awayKeyAbsences * 0.06));

  return { hL, aL };
};

export const runSimulation = (hL: number, aL: number, ctx: MatchContext): SimulationSummary => {
  const rho = -0.05;
  let hW = 0, dr = 0, aW = 0;
  let htHW = 0, htDR = 0, htAW = 0;

  const scoreGrid: number[][] = Array.from({ length: 10 }, () => Array(10).fill(0));
  
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      const baseProb = poissonProb(i, hL) * poissonProb(j, aL);
      const adj = dixonColesAdjustment(i, j, hL, aL, rho);
      const finalProb = baseProb * adj;
      scoreGrid[i][j] = finalProb;
      
      if (i > j) hW += finalProb;
      else if (i < j) aW += finalProb;
      else dr += finalProb;
    }
  }

  const hL_ht = hL * 0.45;
  const aL_ht = aL * 0.45;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const p = poissonProb(i, hL_ht) * poissonProb(j, aL_ht);
      if (i > j) htHW += p; else if (i < j) htAW += p; else htDR += p;
    }
  }

  const markets = generateMarkets(hL, aL, scoreGrid, ctx);

  return {
    homeLambda: hL,
    awayLambda: aL,
    monteCarloResults: {
      homeWin: hW * 100,
      draw: dr * 100,
      awayWin: aW * 100,
      htHomeWin: htHW * 100,
      htDraw: htDR * 100,
      htAwayWin: htAW * 100
    },
    markets
  };
};

const generateMarkets = (hL: number, aL: number, grid: number[][], ctx: MatchContext): MarketResult[] => {
  const res: MarketResult[] = [];
  const add = (label: string, cat: string, prob: number) => {
    const fairOdd = prob > 0 ? 100 / prob : 999;
    const bookieOdd = ctx.marketOdds[label];
    const value = bookieOdd ? (prob * bookieOdd) / 100 : undefined;
    res.push({
      label, category: cat, probability: prob, fairOdd, bookieOdd, value,
      isHighProb: prob > 68
    });
  };

  let p1 = 0, pX = 0, p2 = 0;
  for(let i=0; i<10; i++) for(let j=0; j<10; j++) {
    if (i > j) p1 += grid[i][j]; else if (i < j) p2 += grid[i][j]; else pX += grid[i][j];
  }
  add("1", "Main", p1 * 100); add("X", "Main", pX * 100); add("2", "Main", p2 * 100);
  add("1X", "DC", (p1 + pX) * 100); add("X2", "DC", (pX + p2) * 100); add("12", "DC", (p1 + p2) * 100);
  add("DNB 1", "DNB", (p1 / (p1 + p2)) * 100); add("DNB 2", "DNB", (p2 / (p1 + p2)) * 100);

  [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5].forEach(t => {
    let under = 0;
    for(let i=0; i<10; i++) for(let j=0; j<10; j++) if(i+j < t) under += grid[i][j];
    add(`Under ${t}`, "Over/Under", under * 100); add(`Over ${t}`, "Over/Under", (1 - under) * 100);
  });

  const pBoth = (1 - poissonProb(0, hL)) * (1 - poissonProb(0, aL)) * 100;
  add("BTTS Yes", "Goal/No Goal", pBoth); add("BTTS No", "Goal/No Goal", 100 - pBoth);

  const getMG = (min: number, max: number) => {
    let pr = 0;
    for(let i=0; i<10; i++) for(let j=0; j<10; j++) if((i+j) >= min && (i+j) <= max) pr += grid[i][j];
    return pr * 100;
  };
  ["1-2", "1-3", "1-4", "1-5", "2-3", "2-4", "2-5", "2-6", "3-4", "3-5", "3-6", "4-5", "4-6", "5-6"].forEach(r => {
    const [min, max] = r.split('-').map(Number);
    add(`MG ${r}`, "Multigoal", getMG(min, max));
  });

  const scores: {s: string, p: number}[] = [];
  for(let i=0; i<=5; i++) for(let j=0; j<=5; j++) scores.push({s: `${i}-${j}`, p: grid[i][j] * 100});
  scores.sort((a,b) => b.p - a.p).slice(0, 25).forEach(s => add(s.s, "Risultati Esatti", s.p));

  add("H. -1.5", "Asian Handicap", (p1 - grid[1][0] - grid[2][1] - grid[3][2]) * 85); 
  add("H. -0.5", "Asian Handicap", p1 * 100);
  add("A. -1.5", "Asian Handicap", (p2 - grid[0][1] - grid[1][2] - grid[2][3]) * 85);
  add("A. -0.5", "Asian Handicap", p2 * 100);
  add("H. +0.5", "Asian Handicap", (p1 + pX) * 100);
  add("A. +0.5", "Asian Handicap", (p2 + pX) * 100);
  add("H. +1.5", "Asian Handicap", (p1 + pX + grid[0][1]) * 95);
  add("A. +1.5", "Asian Handicap", (p2 + pX + grid[1][0]) * 95);

  add("Win Nil H", "Specials", p1 * poissonProb(0, aL) * 100);
  add("Win Nil A", "Specials", p2 * poissonProb(0, hL) * 100);
  add("Score Both H", "Specials", Math.pow(1 - poissonProb(0, hL/2), 2) * 100);
  add("Score Both A", "Specials", Math.pow(1 - poissonProb(0, aL/2), 2) * 100);
  add("Clean Sheet H", "Specials", poissonProb(0, aL) * 100);
  add("Clean Sheet A", "Specials", poissonProb(0, hL) * 100);
  add("Pari", "Specials", 50);
  add("Dispari", "Specials", 50);
  add("H 1.5+ Goals", "Specials", (1 - poissonProb(0, hL) - poissonProb(1, hL)) * 100);
  add("A 1.5+ Goals", "Specials", (1 - poissonProb(0, aL) - poissonProb(1, aL)) * 100);

  return res;
};
