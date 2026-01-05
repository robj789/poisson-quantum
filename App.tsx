
import React, { useState, useMemo } from 'react';
import { 
  Trophy, Zap, BarChart3, AlertCircle, Info, CloudRain, Sun, Wind, Activity, UserX, History, TrendingUp, Filter, Target, LayoutGrid, Sparkles, Home, Plane, Crosshair, Hash, HelpCircle, RefreshCw, Trash2, MapPin, ChevronDown, ChevronUp, ArrowDownWideNarrow, ToggleLeft, ToggleRight
} from 'lucide-react';
import { calculateLambdas, runSimulation, poissonProb, runMonteCarloSimulation } from './services/poissonEngine';
import { TeamStats, MatchContext, SimulationSummary, MarketResult } from './types';

const INITIAL_STATS_HOME: TeamStats = {
  played: 20, homeGamesPlayed: 10, goalsScored: 35, goalsConceded: 22, xgScored: 1.75, xgConceded: 1.10,
  homeGoalsScored: 18, homeGoalsConceded: 8, homeXgScored: 18.5, homeXgConceded: 9.5
};

const INITIAL_STATS_AWAY: TeamStats = {
  played: 20, awayGamesPlayed: 10, goalsScored: 28, goalsConceded: 30, xgScored: 1.45, xgConceded: 1.40,
  awayGoalsScored: 12, awayGoalsConceded: 15, awayXgScored: 13.0, awayXgConceded: 15.5
};

const DEFAULT_CONTEXT: MatchContext = {
  homeTeam: 'Squadra Casa', 
  awayTeam: 'Squadra Ospite', 
  weather: 'good', 
  homeMidweekCup: false, 
  awayMidweekCup: false,
  homeKeyAbsences: 0, 
  awayKeyAbsences: 0, 
  homeAdvantage: 12,
  marketOdds: {}
};

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, icon, children, defaultOpen = true, badge }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className={`card-neo rounded-[2.5rem] border transition-all duration-300 ${isOpen ? 'pb-8 border-slate-800' : 'pb-0 border-transparent hover:border-slate-800'}`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-7 text-left outline-none focus:ring-0"
      >
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-xl ${isOpen ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-900 text-slate-500'}`}>
            {icon}
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-300">{title}</h3>
            {badge && !isOpen && <span className="text-[9px] font-bold text-emerald-500 mt-1 block uppercase tracking-widest">{badge}</span>}
          </div>
        </div>
        {isOpen ? <ChevronUp size={20} className="text-slate-600" /> : <ChevronDown size={20} className="text-slate-600" />}
      </button>
      <div className={`px-4 sm:px-8 overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="pt-2 border-t border-slate-800/30">
          {children}
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [homeStats, setHomeStats] = useState<TeamStats>(INITIAL_STATS_HOME);
  const [awayStats, setAwayStats] = useState<TeamStats>(INITIAL_STATS_AWAY);
  const [context, setContext] = useState<MatchContext>(DEFAULT_CONTEXT);

  const [simulation, setSimulation] = useState<SimulationSummary | null>(null);
  const [monteCarlo, setMonteCarlo] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isMonteCarloRunning, setIsMonteCarloRunning] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('Main');
  const [sortBy, setSortBy] = useState<'probability' | 'value'>('probability');
  const [isAdvancedMode, setIsAdvancedMode] = useState(true);

  // Calcola i parametri di computazione basandosi sulla modalità selezionata
  const getComputeParams = () => {
    const computeContext = isAdvancedMode ? context : {
      ...context,
      weather: 'good' as const,
      homeMidweekCup: false,
      awayMidweekCup: false,
      homeKeyAbsences: 0,
      awayKeyAbsences: 0,
      homeAdvantage: 0
    };

    // Se non è modalità avanzata, i dati xG vengono ignorati forzando i valori xG uguali ai Gol reali
    const computeHomeStats = isAdvancedMode ? homeStats : {
      ...homeStats,
      homeXgScored: homeStats.homeGoalsScored,
      homeXgConceded: homeStats.homeGoalsConceded,
      xgScored: homeStats.goalsScored,
      xgConceded: homeStats.goalsConceded
    };

    const computeAwayStats = isAdvancedMode ? awayStats : {
      ...awayStats,
      awayXgScored: awayStats.awayGoalsScored,
      awayXgConceded: awayStats.awayGoalsConceded,
      xgScored: awayStats.goalsScored,
      xgConceded: awayStats.goalsConceded
    };

    return { computeContext, computeHomeStats, computeAwayStats };
  };

  const handleSimulate = () => {
    setIsSimulating(true);
    setTimeout(() => {
      const { computeContext, computeHomeStats, computeAwayStats } = getComputeParams();
      const { hL, aL } = calculateLambdas(computeHomeStats, computeAwayStats, computeContext);
      const results = runSimulation(hL, aL, computeContext);
      setSimulation(results);
      setIsSimulating(false);
      setMonteCarlo(null);
    }, 800);
  };

  const handleReset = () => {
    setHomeStats(INITIAL_STATS_HOME);
    setAwayStats(INITIAL_STATS_AWAY);
    setContext(DEFAULT_CONTEXT);
    setSimulation(null);
    setMonteCarlo(null);
    setActiveCategory('Main');
    setSortBy('probability');
    setIsAdvancedMode(true);
  };

  const handleMonteCarlo = () => {
    if (!simulation) return;
    setIsMonteCarloRunning(true);
    setTimeout(() => {
      const results = runMonteCarloSimulation(simulation.homeLambda, simulation.awayLambda);
      setMonteCarlo(results);
      setIsMonteCarloRunning(false);
    }, 1000);
  };

  const setBookieOdd = (marketLabel: string, odd: number) => {
    setContext(prev => ({
      ...prev,
      marketOdds: { ...prev.marketOdds, [marketLabel]: odd }
    }));
    
    if (simulation) {
      // Usiamo il contesto aggiornato con la nuova quota
      const updatedContext = { ...context, marketOdds: { ...context.marketOdds, [marketLabel]: odd } };
      
      const computeContext = isAdvancedMode ? updatedContext : {
        ...updatedContext,
        weather: 'good' as const,
        homeMidweekCup: false,
        awayMidweekCup: false,
        homeKeyAbsences: 0,
        awayKeyAbsences: 0,
        homeAdvantage: 0
      };

      const computeHomeStats = isAdvancedMode ? homeStats : {
        ...homeStats,
        homeXgScored: homeStats.homeGoalsScored,
        homeXgConceded: homeStats.homeGoalsConceded
      };

      const computeAwayStats = isAdvancedMode ? awayStats : {
        ...awayStats,
        awayXgScored: awayStats.awayGoalsScored,
        awayXgConceded: awayStats.awayGoalsConceded
      };

      const { hL, aL } = calculateLambdas(computeHomeStats, computeAwayStats, computeContext);
      const results = runSimulation(hL, aL, computeContext);
      setSimulation(results);
    }
  };

  const categories = useMemo(() => {
    if (!simulation) return [];
    return Array.from(new Set(simulation.markets.map(m => m.category)));
  }, [simulation]);

  const sortedMarkets = useMemo(() => {
    if (!simulation) return [];
    const filtered = simulation.markets.filter(m => m.category === activeCategory);
    return [...filtered].sort((a, b) => {
      if (sortBy === 'probability') return b.probability - a.probability;
      if (sortBy === 'value') return (b.value || 0) - (a.value || 0);
      return 0;
    });
  }, [simulation, activeCategory, sortBy]);

  const smartInsights = useMemo(() => {
    if (!simulation) return [];
    return simulation.markets
      .filter(m => m.probability > 65 || (m.value && m.value > 1.10))
      .sort((a, b) => (b.value || 0) - (a.value || 0))
      .slice(0, 3);
  }, [simulation]);

  const scoreMatrix = useMemo(() => {
    if (!simulation) return [];
    const matrix = [];
    for(let i=0; i<6; i++) {
      for(let j=0; j<6; j++) {
        const p = poissonProb(i, simulation.homeLambda) * poissonProb(j, simulation.awayLambda) * 100;
        matrix.push({ home: i, away: j, prob: p });
      }
    }
    return matrix;
  }, [simulation]);

  return (
    <div className="min-h-screen bg-[#020305] text-slate-200 font-sans selection:bg-emerald-500/30 pb-24 text-center">
      
      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-6" onClick={() => setShowHelp(false)}>
           <div className="card-neo max-w-md w-full p-8 rounded-[3rem] border border-emerald-500/30 text-center" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-black italic text-emerald-500 uppercase tracking-tighter">Guida Analisi</h3>
                 <button onClick={() => setShowHelp(false)} className="text-slate-500 hover:text-white transition-colors">✕</button>
              </div>
              <div className="text-xs text-slate-400 leading-relaxed mb-6 space-y-5">
                 <p className="bg-slate-900/50 p-3 rounded-2xl"><b>Modalità Quantum:</b> Include algoritmi Dixon-Coles, xG, meteo e assenze pesanti per precisione d'élite.</p>
                 <p className="bg-slate-900/50 p-3 rounded-2xl"><b>Modalità Base:</b> Esclude tutti i parametri ambientali e ignora gli xG, basandosi solo sui gol reali.</p>
                 <p className="bg-slate-900/50 p-3 rounded-2xl"><b>Fattore Campo:</b> Regola l'incremento di forza per la squadra ospitante.</p>
                 <p className="bg-emerald-500/5 p-3 rounded-2xl border border-emerald-500/20"><b>Monte Carlo:</b> Simulazione stocastica di 10.000 match per testare la varianza.</p>
              </div>
              <button onClick={() => setShowHelp(false)} className="w-full bg-emerald-500 text-black font-black py-4 rounded-2xl uppercase italic shadow-lg shadow-emerald-500/20">Chiudi</button>
           </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto p-4 md:p-10">
        
        {/* Header */}
        <header className="flex flex-col items-center justify-center mb-12 gap-8">
          <div className="flex flex-col items-center gap-5">
            <div className="p-5 bg-emerald-500 rounded-[2rem] shadow-[0_0_50px_rgba(16,185,129,0.3)] transition-all hover:scale-105">
              <Sparkles className="text-black" size={32} />
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase flex flex-col md:flex-row items-center gap-3">
                Poisson<span className="text-emerald-500 underline decoration-emerald-500/10 underline-offset-[12px]">QUANTUM</span>
              </h1>
              <p className="text-[10px] md:text-[11px] text-slate-500 font-black uppercase tracking-[0.4em] italic opacity-80">Distributed Neural Prediction V6.5 Mobile-Optimized</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row bg-slate-900/40 p-1.5 rounded-[2rem] border border-slate-800 backdrop-blur-xl">
             <div className="px-8 py-3 border-b sm:border-b-0 sm:border-r border-slate-800">
                <span className="block text-[8px] font-black text-emerald-500 uppercase mb-1 tracking-widest">Logic Tier</span>
                <span className="text-xs font-black mono text-white uppercase">{isAdvancedMode ? 'Quantum' : 'Standard'}</span>
             </div>
             <div className="px-8 py-3">
                <span className="block text-[8px] font-black text-blue-500 uppercase mb-1 tracking-widest">Dataset Size</span>
                <span className="text-xs font-black mono text-white uppercase">81 Markets</span>
             </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Controls Side */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="card-neo p-7 md:p-8 rounded-[3rem] border-t border-emerald-500/20 relative overflow-hidden text-center shadow-2xl">
               <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full"></div>
               
               <div className="flex items-center justify-between mb-8 px-2">
                 <h3 className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-3 tracking-[0.2em]">
                   <Filter size={14} className="text-emerald-500" /> Analisi {isAdvancedMode ? 'Quantum' : 'Base'}
                 </h3>
                 <div className="flex gap-4 items-center">
                    <button 
                      onClick={() => setIsAdvancedMode(!isAdvancedMode)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${isAdvancedMode ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                      title={isAdvancedMode ? "Passa a Poisson Tradizionale" : "Passa a Poisson Quantum"}
                    >
                      <span className="text-[8px] font-black uppercase tracking-tighter">{isAdvancedMode ? 'Quantum' : 'Base'}</span>
                      {isAdvancedMode ? <ToggleRight size={16}/> : <ToggleLeft size={16}/>}
                    </button>
                    <Trash2 size={16} className="text-slate-600 hover:text-red-500 cursor-pointer transition-all" onClick={handleReset} />
                 </div>
               </div>

              <div className="space-y-6">
                {/* Team Names */}
                <div className="grid grid-cols-1 gap-4">
                   <div className="relative group">
                      <input type="text" placeholder="Squadra Casa" className="w-full bg-black/40 border-2 border-slate-800/40 p-4 rounded-3xl text-sm outline-none focus:border-emerald-500/40 focus:bg-black/60 transition-all font-black text-center" value={context.homeTeam} onChange={e => setContext({...context, homeTeam: e.target.value})}/>
                      <div className="absolute left-6 top-4 text-emerald-500 opacity-20"><Home size={18}/></div>
                   </div>
                   <div className="relative group">
                      <input type="text" placeholder="Squadra Ospite" className="w-full bg-black/40 border-2 border-slate-800/40 p-4 rounded-3xl text-sm outline-none focus:border-emerald-500/40 focus:bg-black/60 transition-all font-black text-center" value={context.awayTeam} onChange={e => setContext({...context, awayTeam: e.target.value})}/>
                      <div className="absolute left-6 top-4 text-red-500 opacity-20"><Plane size={18}/></div>
                   </div>
                </div>

                {/* Sezione Parametri Avanzati */}
                <div className={`space-y-6 transition-all duration-500 ${isAdvancedMode ? 'opacity-100' : 'opacity-20 pointer-events-none grayscale'}`}>
                  {/* Weather */}
                  <div className="grid grid-cols-3 gap-2">
                    {(['good', 'rain', 'extreme'] as const).map(w => (
                      <button key={w} onClick={() => setContext({...context, weather: w})} 
                        className={`py-3 flex flex-col items-center gap-2 rounded-2xl border transition-all ${context.weather === w ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 shadow-xl shadow-emerald-500/5' : 'bg-slate-900/30 border-slate-800 text-slate-500 hover:text-slate-300'}`}>
                        {w === 'good' && <Sun size={18}/>}
                        {w === 'rain' && <CloudRain size={18}/>}
                        {w === 'extreme' && <Wind size={18}/>}
                        <span className="text-[8px] font-black uppercase">{w}</span>
                      </button>
                    ))}
                  </div>

                  {/* Home Advantage */}
                  <div className="pt-4 border-t border-slate-800/30">
                    <div className="flex justify-between items-center mb-4 px-2">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <MapPin size={14} className="text-emerald-500"/> Fattore Campo
                        </span>
                        <span className="text-emerald-500 font-black text-[10px]">+{context.homeAdvantage}%</span>
                    </div>
                    <input type="range" min="0" max="30" value={context.homeAdvantage} onChange={e => setContext({...context, homeAdvantage: parseInt(e.target.value)})} className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                  </div>

                  {/* Key Absences */}
                  <div className="space-y-6 pt-6 border-t border-slate-800/30">
                    {['homeKeyAbsences', 'awayKeyAbsences'].map((k, i) => (
                        <div key={k} className="space-y-3 px-2">
                          <div className="flex justify-between text-[8px] font-black uppercase tracking-widest">
                              <span className="text-slate-500">Livello Assenze {i === 0 ? 'Casa' : 'Ospite'}</span>
                              <span className={i === 0 ? 'text-emerald-500' : 'text-red-500'}>-{context[k as keyof MatchContext] as number * 6}% Goal</span>
                          </div>
                          <input type="range" min="0" max="5" value={context[k as keyof MatchContext] as number} onChange={e => setContext({...context, [k]: parseInt(e.target.value)})} className="w-full accent-emerald-500 h-1 bg-slate-800 rounded-full appearance-none cursor-pointer" />
                        </div>
                    ))}
                  </div>
                </div>

                {/* Detailed Team Stats - Always Active */}
                <div className="space-y-8 pt-6 border-t border-slate-800/30">
                   {/* Home Stats */}
                   <div className="space-y-4">
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase text-emerald-500 justify-between px-2">
                         <div className="flex items-center gap-2"><Home size={14}/> <span>Casa</span></div>
                         <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/10">
                            <span className="text-[8px] text-slate-500 uppercase">Gare</span>
                            <input type="number" value={homeStats.homeGamesPlayed || ''} onChange={e => setHomeStats({...homeStats, homeGamesPlayed: parseFloat(e.target.value)})} className="bg-transparent w-8 text-[10px] font-black outline-none text-emerald-400 text-center"/>
                         </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                         {[{label: 'GF', key: 'homeGoalsScored', color: 'text-emerald-400'}, {label: 'GS', key: 'homeGoalsConceded', color: 'text-red-400'}, {label: 'xGF', key: 'homeXgScored', color: 'text-emerald-500', isXg: true}, {label: 'xGS', key: 'homeXgConceded', color: 'text-red-500', isXg: true}].map(s => (
                           <div key={s.key} className={`p-3 rounded-2xl border flex flex-col items-center transition-all ${!isAdvancedMode && s.isXg ? 'bg-slate-900/10 border-slate-900 opacity-20' : 'bg-black/30 border-slate-800/50'}`}>
                              <label className="block text-[7px] text-slate-600 uppercase font-black mb-1">{s.label}</label>
                              <input 
                                type="number" 
                                step="0.01" 
                                disabled={!isAdvancedMode && s.isXg}
                                value={homeStats[s.key as keyof TeamStats] || ''} 
                                onChange={e => setHomeStats({...homeStats, [s.key]: parseFloat(e.target.value)})} 
                                className={`bg-transparent w-full text-xs font-black outline-none text-center ${s.color} ${!isAdvancedMode && s.isXg ? 'cursor-not-allowed' : ''}`} 
                                placeholder="0"
                              />
                           </div>
                         ))}
                      </div>
                   </div>

                   {/* Away Stats */}
                   <div className="space-y-4">
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase text-red-500 justify-between px-2">
                         <div className="flex items-center gap-2"><Plane size={14}/> <span>Ospite</span></div>
                         <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/10">
                            <span className="text-[8px] text-slate-500 uppercase">Gare</span>
                            <input type="number" value={awayStats.awayGamesPlayed || ''} onChange={e => setAwayStats({...awayStats, awayGamesPlayed: parseFloat(e.target.value)})} className="bg-transparent w-8 text-[10px] font-black outline-none text-red-400 text-center"/>
                         </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                         {[{label: 'GF', key: 'awayGoalsScored', color: 'text-emerald-400'}, {label: 'GS', key: 'awayGoalsConceded', color: 'text-red-400'}, {label: 'xGF', key: 'awayXgScored', color: 'text-emerald-500', isXg: true}, {label: 'xGS', key: 'awayXgConceded', color: 'text-red-500', isXg: true}].map(s => (
                           <div key={s.key} className={`p-3 rounded-2xl border flex flex-col items-center transition-all ${!isAdvancedMode && s.isXg ? 'bg-slate-900/10 border-slate-900 opacity-20' : 'bg-black/30 border-slate-800/50'}`}>
                              <label className="block text-[7px] text-slate-600 uppercase font-black mb-1">{s.label}</label>
                              <input 
                                type="number" 
                                step="0.01" 
                                disabled={!isAdvancedMode && s.isXg}
                                value={awayStats[s.key as keyof TeamStats] || ''} 
                                onChange={e => setAwayStats({...awayStats, [s.key]: parseFloat(e.target.value)})} 
                                className={`bg-transparent w-full text-xs font-black outline-none text-center ${s.color} ${!isAdvancedMode && s.isXg ? 'cursor-not-allowed' : ''}`} 
                                placeholder="0"
                              />
                           </div>
                         ))}
                      </div>
                   </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-4 pt-4">
                  <button onClick={handleSimulate} disabled={isSimulating} className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-5 rounded-[2rem] flex items-center justify-center gap-4 transition-all active:scale-95 shadow-xl shadow-emerald-500/20 text-md uppercase italic">
                    {isSimulating ? <Activity className="animate-spin" /> : <Zap size={20} fill="currentColor"/>}
                    {isSimulating ? 'Calcolo in corso...' : isAdvancedMode ? 'Analisi Quantum' : 'Analisi Tradizionale'}
                  </button>
                  <button onClick={handleReset} className="w-full text-slate-600 font-black py-2 rounded-3xl flex items-center justify-center gap-2 hover:text-red-500 transition-all uppercase text-[8px] tracking-[0.2em]">
                    <Trash2 size={12} /> Reset Dati
                  </button>
                </div>
              </div>
            </div>
          </aside>

          {/* Results Side */}
          <main className="lg:col-span-8 space-y-6">
            {simulation ? (
              <div className="animate-in fade-in slide-in-from-bottom-5 duration-700 space-y-6">
                
                <CollapsibleSection title="Alpha Neural Signals" icon={<Sparkles size={16}/>} badge={`${smartInsights.length} High Edge Markets`}>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                    {smartInsights.map((insight, idx) => (
                      <div key={idx} className={`p-6 rounded-[2rem] border-l-4 transition-all ${insight.value && insight.value > 1.05 ? 'border-teal-400 bg-teal-500/5' : 'border-emerald-500 bg-emerald-500/5'} relative flex flex-col items-center shadow-lg`}>
                          <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-3 italic">Node #{idx+1}</span>
                          <h4 className="text-lg font-black italic text-white mb-4 uppercase text-center truncate w-full">{insight.label}</h4>
                          <div className="flex items-end justify-between w-full">
                            <span className="text-3xl font-black text-white">{insight.probability.toFixed(1)}%</span>
                            <div className="text-right">
                                <span className="block text-[7px] font-bold text-slate-500 uppercase">Fair Odd</span>
                                <span className="text-sm font-black text-teal-400">@{insight.fairOdd.toFixed(2)}</span>
                            </div>
                          </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Monte Carlo stochastic" icon={<RefreshCw size={16}/>} defaultOpen={false} badge={monteCarlo ? "Simulation Active" : "Pending"}>
                  <div className="flex flex-col items-center justify-center space-y-8 py-6">
                    {!monteCarlo && !isMonteCarloRunning ? (
                      <div className="text-center space-y-6">
                         <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Esegui test stocastico per misurare la varianza</p>
                         <button onClick={handleMonteCarlo} className="px-10 py-4 bg-slate-900 border border-slate-800 hover:border-emerald-500 hover:text-emerald-500 rounded-3xl font-black italic uppercase text-[10px] transition-all tracking-widest flex items-center gap-3 mx-auto">
                            <Zap size={14} fill="currentColor" /> Trial 10.000 Simulation
                         </button>
                      </div>
                    ) : isMonteCarloRunning ? (
                      <div className="flex flex-col items-center space-y-4">
                         <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 animate-[loading_1s_infinite]" style={{width: '60%'}}></div>
                         </div>
                         <span className="text-[8px] font-black text-emerald-500 uppercase animate-pulse">Computing Stochastics...</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-6 w-full animate-in zoom-in-95 duration-500 max-w-md mx-auto">
                         <div className="flex flex-col items-center p-4 bg-slate-900/30 rounded-3xl border border-slate-800/50">
                            <span className="text-[8px] font-black text-emerald-500 uppercase mb-2">Sim Home</span>
                            <span className="text-xl font-black text-white italic">{monteCarlo.homeWin.toFixed(1)}%</span>
                         </div>
                         <div className="flex flex-col items-center p-4 bg-slate-900/30 rounded-3xl border border-slate-800/50">
                            <span className="text-[8px] font-black text-slate-500 uppercase mb-2">Sim Draw</span>
                            <span className="text-xl font-black text-white italic">{monteCarlo.draw.toFixed(1)}%</span>
                         </div>
                         <div className="flex flex-col items-center p-4 bg-slate-900/30 rounded-3xl border border-slate-800/50">
                            <span className="text-[8px] font-black text-red-500 uppercase mb-2">Sim Away</span>
                            <span className="text-xl font-black text-white italic">{monteCarlo.awayWin.toFixed(1)}%</span>
                         </div>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Probabilità Risultato" icon={<LayoutGrid size={16}/>} defaultOpen={false}>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-4 py-6">
                      {scoreMatrix.map((item, i) => (
                        <div key={i} className={`aspect-square flex flex-col items-center justify-center rounded-2xl border transition-all hover:scale-105 ${item.prob > 10 ? 'bg-emerald-500 border-emerald-400 text-black shadow-lg shadow-emerald-500/20' : item.prob > 5 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-slate-900/20 border-slate-800 text-slate-700 opacity-60'}`}>
                          <span className="text-[9px] font-black leading-none mb-1">{item.home}-{item.away}</span>
                          <span className="text-[8px] font-bold">{item.prob.toFixed(1)}%</span>
                        </div>
                      ))}
                  </div>
                </CollapsibleSection>

                <CollapsibleSection title="Neural Market explorer" icon={<BarChart3 size={16}/>}>
                  <div className="space-y-6 py-6">
                    {/* Category Selector */}
                    <div className="flex flex-wrap justify-center gap-2 pb-2">
                      {categories.map(cat => (
                        <button key={cat} onClick={() => setActiveCategory(cat)}
                          className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase transition-all whitespace-nowrap border ${activeCategory === cat ? 'bg-emerald-500 text-black border-emerald-500 shadow-lg' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Sorting Controls */}
                    <div className="flex items-center justify-center gap-4 bg-slate-900/30 p-2 rounded-2xl border border-slate-800/50 max-w-sm mx-auto">
                       <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                          <ArrowDownWideNarrow size={12}/> Ordina per:
                       </span>
                       <button 
                        onClick={() => setSortBy('probability')}
                        className={`text-[8px] font-black uppercase px-3 py-1.5 rounded-xl transition-all ${sortBy === 'probability' ? 'bg-emerald-500 text-black' : 'text-slate-400 hover:text-slate-200'}`}
                       >
                         Probabilità
                       </button>
                       <button 
                        onClick={() => setSortBy('value')}
                        className={`text-[8px] font-black uppercase px-3 py-1.5 rounded-xl transition-all ${sortBy === 'value' ? 'bg-teal-500 text-black' : 'text-slate-400 hover:text-slate-200'}`}
                       >
                         Value Bet
                       </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {sortedMarkets.map((m, idx) => (
                        <div key={idx} className={`p-6 rounded-[2.5rem] border transition-all group flex flex-col items-center ${m.isHighProb ? 'bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'bg-slate-900/30 border-slate-800'} ${m.value && m.value > 1 ? 'border-teal-500/30 bg-teal-500/5' : 'border-transparent'}`}>
                          <div className="flex items-center justify-between w-full mb-4">
                             <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate text-center flex-1">{m.label}</span>
                             {m.isHighProb && <Zap size={12} className="text-emerald-500 animate-pulse" fill="currentColor"/>}
                          </div>
                          <div className="flex flex-col items-center gap-1 mb-5">
                             <span className={`text-2xl font-black italic tracking-tighter leading-none ${m.isHighProb ? 'text-emerald-500' : 'text-white'}`}>{m.probability.toFixed(1)}%</span>
                             <div className="flex flex-col items-center mt-2 gap-1">
                                <span className="text-[9px] font-mono text-teal-400 font-bold uppercase tracking-widest opacity-80">Fair: @{m.fairOdd.toFixed(2)}</span>
                                {m.value && m.value > 1 && (
                                  <span className="text-[8px] font-black bg-teal-400 text-black px-2 py-0.5 rounded-lg shadow animate-bounce mt-1">
                                    EDGE: +{((m.value - 1) * 100).toFixed(1)}%
                                  </span>
                                )}
                             </div>
                          </div>
                          
                          <div className="pt-4 border-t border-slate-800/30 w-full flex items-center justify-center gap-4">
                             <span className="text-[8px] font-black text-slate-600 uppercase">Bookie</span>
                             <input 
                                type="number" 
                                step="0.01" 
                                placeholder="1.00" 
                                className="w-16 bg-black/40 border border-slate-800/80 rounded-xl p-2 text-xs text-center outline-none focus:border-teal-500/50 text-teal-400 font-black transition-all"
                                onChange={e => setBookieOdd(m.label, parseFloat(e.target.value))}
                                value={context.marketOdds[m.label] || ''}
                             />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsibleSection>

              </div>
            ) : (
              <div className="h-[400px] md:h-[600px] card-neo rounded-[3.5rem] border-2 border-dashed border-slate-800/30 flex flex-col items-center justify-center space-y-8 group px-10">
                <div className="w-24 h-24 md:w-32 md:h-32 bg-slate-900/50 rounded-full flex items-center justify-center border-4 border-slate-800 group-hover:border-emerald-500/20 transition-all duration-1000 shadow-2xl">
                   <Target size={48} className="text-slate-800 group-hover:text-emerald-500 group-hover:rotate-180 transition-all duration-1000" />
                </div>
                <div className="text-center space-y-4">
                   <h3 className="text-xl md:text-2xl font-black italic uppercase text-slate-700 group-hover:text-white transition-all tracking-[0.2em]">Sincronizzazione Richiesta</h3>
                   <p className="text-[9px] md:text-[10px] font-bold text-slate-800 uppercase tracking-[0.4em] italic leading-relaxed">Inserisci i parametri statistici per avviare il calcolo neurale distribuito</p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <footer className="fixed bottom-0 w-full bg-black/80 backdrop-blur-3xl border-t border-slate-900 p-4 z-50">
         <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 md:px-10">
            <div className="flex items-center gap-3">
               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_15px_#10b981]"></div>
               <span className="text-[8px] font-black text-slate-600 uppercase tracking-[0.2em]">Quantum Engine Core v6.5: ACTIVE</span>
            </div>
            <div className="hidden sm:flex items-center gap-8">
               <span className="text-[8px] font-black text-slate-700 uppercase italic tracking-widest">Powered by Dixon-Coles Distributed Architecture</span>
            </div>
         </div>
      </footer>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          background: #10b981;
          cursor: pointer;
          border-radius: 50%;
          box-shadow: 0 0 10px rgba(16,185,129,0.3);
          border: 2px solid rgba(0,0,0,0.5);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default App;
