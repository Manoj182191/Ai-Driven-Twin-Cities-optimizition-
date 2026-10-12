import React, { useState, useEffect } from 'react';
import {
  fetchMPCConfig,
  runMPCOptimization,
  runScenarioPlanningStudy,
  type MPCRunResponse,
  type ScenarioPlanningRunResponse,
  type MPCConfigResponse,
  type PlanningMode,
  type UncertaintyScenarioType,
  type DemandLevel
} from '../../services/api';
import {
  Play,
  AlertTriangle,
  Clock,
  ShieldCheck,
  GitBranch,
  Layers,
  Activity,
  CheckCircle2,
  TrendingDown,
  Compass
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

export const MPCScenarioPlanningPage: React.FC = () => {
  const [config, setConfig] = useState<MPCConfigResponse | null>(null);
  const [mpcResult, setMpcResult] = useState<MPCRunResponse | null>(null);
  const [scenarioStudy, setScenarioStudy] = useState<ScenarioPlanningRunResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningPlanning, setRunningPlanning] = useState<boolean>(false);
  const [runningScenarioStudy, setRunningScenarioStudy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form Controls
  const [seed, setSeed] = useState<number>(42);
  const [demandLevel, setDemandLevel] = useState<DemandLevel>('normal');
  const [steps, setSteps] = useState<number>(12);
  const [planningHorizon, setPlanningHorizon] = useState<number>(3);
  const [discountFactor, setDiscountFactor] = useState<number>(0.95);
  const [beamWidth, setBeamWidth] = useState<number>(5);
  const [maxSearchBudget, setMaxSearchBudget] = useState<number>(200);
  const [planningMode, setPlanningMode] = useState<PlanningMode>('nominal');
  const [uncertaintyScenario, setUncertaintyScenario] = useState<UncertaintyScenarioType>('normal');
  const [riskAlpha, setRiskAlpha] = useState<number>(0.75);

  // UI state
  const [selectedStepIdx, setSelectedStepIdx] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'mpc_run' | 'scenario_matrix'>('mpc_run');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await fetchMPCConfig();
      setConfig(cfg);

      // Initial MPC run
      const res = await runMPCOptimization({
        seed,
        demand_level: demandLevel,
        steps,
        planning_horizon: planningHorizon,
        discount_factor: discountFactor,
        beam_width: beamWidth,
        max_search_budget: maxSearchBudget,
        planning_mode: planningMode,
        uncertainty_scenario: uncertaintyScenario,
        risk_alpha: riskAlpha
      });
      setMpcResult(res);

      // Initial Scenario Study
      const studyRes = await runScenarioPlanningStudy(seed, planningHorizon, discountFactor);
      setScenarioStudy(studyRes);
      setSelectedStepIdx(0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to initialize Phase 8 MPC system');
    } finally {
      setLoading(false);
    }
  };

  const handleRunMPC = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setRunningPlanning(true);
    setError(null);
    try {
      const res = await runMPCOptimization({
        seed,
        demand_level: demandLevel,
        steps,
        planning_horizon: planningHorizon,
        discount_factor: discountFactor,
        beam_width: beamWidth,
        max_search_budget: maxSearchBudget,
        planning_mode: planningMode,
        uncertainty_scenario: uncertaintyScenario,
        risk_alpha: riskAlpha
      });
      setMpcResult(res);
      setSelectedStepIdx(0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error executing MPC planning cycle');
    } finally {
      setRunningPlanning(false);
    }
  };

  const handleRunScenarioStudy = async () => {
    setRunningScenarioStudy(true);
    setError(null);
    try {
      const res = await runScenarioPlanningStudy(seed, planningHorizon, discountFactor);
      setScenarioStudy(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error executing scenario planning study');
    } finally {
      setRunningScenarioStudy(false);
    }
  };

  const currentDecision = mpcResult?.step_decisions[selectedStepIdx];

  // Trajectory chart dataset
  const trajectoryChartData = mpcResult?.step_decisions.map((dec) => ({
    step: `Step ${dec.decision_step}`,
    rawCost: dec.planned_sequence[0]?.raw_step_cost || 0,
    cumulativeDiscounted: dec.cumulative_discounted_cost,
    travelTime: dec.planned_sequence[0]?.expected_system_travel_time || 0,
    congestion: dec.planned_sequence[0]?.expected_system_congestion || 0,
    queues: dec.planned_sequence[0]?.expected_system_queues || 0,
    corridorDelay: dec.planned_sequence[0]?.expected_intercity_delay || 0,
    candidatesEvaluated: dec.total_candidate_evaluations
  })) || [];

  // Multi-step lookahead cost decay curve for currently inspected step
  const lookaheadDecayData = currentDecision?.planned_sequence.map((step) => ({
    horizonStep: `t + ${step.step_offset}`,
    rawStepCost: step.raw_step_cost,
    discountedCost: step.discounted_step_cost,
    discountWeight: Number((step.discount_factor_weight * 100).toFixed(1)),
    expectedCongestion: step.expected_system_congestion,
    expectedTravelTime: step.expected_system_travel_time
  })) || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 rounded-full text-xs font-semibold tracking-wide flex items-center gap-1.5">
                <GitBranch className="w-3.5 h-3.5" /> PHASE 8 ACTIVE
              </span>
              <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-full text-xs font-semibold tracking-wide flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" /> Model Predictive Control (MPC)
              </span>
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-xs font-semibold tracking-wide">
                Horizon H={planningHorizon}
              </span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Multi-Step AI Planning & Scenario Robustness
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-3xl">
              Receding-horizon Model Predictive Control (MPC) with Bounded Beam Search over 25<sup>H</sup> joint action combinations.
              Simulates candidate futures in isolated memory sandboxes, minimizes discounted cumulative cost C = &sum; &gamma;<sup>t</sup> c<sub>t</sub>,
              and stress-tests policies under adverse corridor and demand surge scenarios.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-2.5 flex items-center gap-4 text-xs">
              <div>
                <span className="text-slate-400 block">Search Budget</span>
                <span className="font-mono font-semibold text-indigo-300">Beam K={beamWidth} (Max {maxSearchBudget} evals)</span>
              </div>
              <div className="w-px h-8 bg-slate-700" />
              <div>
                <span className="text-slate-400 block">Discount Factor</span>
                <span className="font-mono font-semibold text-emerald-300">&gamma; = {discountFactor}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fallback & Warning Banner (if fallback triggered) */}
      {mpcResult?.fallback_occurred && (
        <div className="bg-amber-950/40 border border-amber-500/50 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs">
            <h4 className="font-semibold text-amber-200">Autonomous Fallback Activated</h4>
            <p className="text-amber-300/80 mt-0.5">
              One or more decision steps exceeded search constraints or encountered forecast noise. The system smoothly fell back to the
              Phase 6 Coordinated Optimizer to guarantee safe uninterrupted physical actuation.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-rose-950/40 border border-rose-500/50 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
          <div className="text-xs text-rose-200">
            <h4 className="font-semibold">Planning Error</h4>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Control Panel & Config */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <form onSubmit={handleRunMPC} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4 items-end">
          {/* Planning Mode */}
          <div className="xl:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">Planning Mode</label>
            <select
              value={planningMode}
              onChange={(e) => setPlanningMode(e.target.value as PlanningMode)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="nominal">Nominal (Expected Forecast)</option>
              <option value="robust">Robust (Worst-Case Adverse Penalty)</option>
              <option value="risk_sensitive">Risk-Sensitive (CVaR &alpha;={riskAlpha})</option>
            </select>
          </div>

          {/* Uncertainty Scenario */}
          <div className="xl:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">Future Traffic Scenario</label>
            <select
              value={uncertaintyScenario}
              onChange={(e) => setUncertaintyScenario(e.target.value as UncertaintyScenarioType)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="normal">Normal Baseline Traffic</option>
              <option value="peak_surge">Peak-Hour Demand Surge (+25%)</option>
              <option value="sudden_burst">Sudden Demand Burst (+40%)</option>
              <option value="corridor_bottleneck">Intercity Corridor Bottleneck (-50% Cap)</option>
              <option value="uneven_demand">Uneven City Demand (A: +30%, B: -25%)</option>
              <option value="forecast_noise">Forecast Stochastic Noise (&plusmn;15%)</option>
            </select>
          </div>

          {/* Horizon */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Horizon (H)</label>
            <select
              value={planningHorizon}
              onChange={(e) => setPlanningHorizon(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              {config?.supported_horizons.map((h) => (
                <option key={h} value={h}>{h} Steps</option>
              )) || [1, 2, 3, 5].map((h) => (
                <option key={h} value={h}>{h} Steps</option>
              ))}
            </select>
          </div>

          {/* Discount Factor */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Discount (&gamma;)</label>
            <select
              value={discountFactor}
              onChange={(e) => setDiscountFactor(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value={0.95}>0.95 (Default)</option>
              <option value={0.90}>0.90</option>
              <option value={0.80}>0.80</option>
              <option value={1.00}>1.00 (Undiscounted)</option>
            </select>
          </div>

          {/* Beam Width */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Beam Width (K)</label>
            <select
              value={beamWidth}
              onChange={(e) => setBeamWidth(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value={3}>K = 3 (Fast)</option>
              <option value={5}>K = 5 (Balanced)</option>
              <option value={8}>K = 8 (Exhaustive)</option>
            </select>
          </div>

          {/* Execute Button */}
          <div>
            <button
              type="submit"
              disabled={runningPlanning || loading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm transition shadow-md shadow-indigo-600/30"
            >
              {runningPlanning ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-white" />
              )}
              Run MPC
            </button>
          </div>
        </form>

        {/* Form Extended Controls: Seed, Demand Level, Steps, Search Budget, Risk Alpha */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Random Seed</label>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-white font-mono"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Initial Demand Level</label>
            <select
              value={demandLevel}
              onChange={(e) => setDemandLevel(e.target.value as DemandLevel)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-white"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="peak">Peak</option>
            </select>
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Simulation Steps</label>
            <input
              type="number"
              min={6}
              max={48}
              value={steps}
              onChange={(e) => setSteps(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-white font-mono"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Max Evaluations Budget</label>
            <input
              type="number"
              min={25}
              max={500}
              value={maxSearchBudget}
              onChange={(e) => setMaxSearchBudget(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-white font-mono"
            />
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Risk Alpha (&alpha; Tail)</label>
            <input
              type="number"
              step={0.05}
              min={0.5}
              max={0.95}
              value={riskAlpha}
              onChange={(e) => setRiskAlpha(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-white font-mono"
            />
          </div>
        </div>

        {/* Telemetry info bar */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span>
              Search Space per Step: <strong className="text-slate-200">25 Actions</strong> (5 City A &times; 5 City B)
            </span>
            <span>&bull;</span>
            <span>
              Unbounded Complexity: <strong className="text-amber-400">25<sup>{planningHorizon}</sup> = {Math.pow(25, planningHorizon).toLocaleString()}</strong>
            </span>
            <span>&bull;</span>
            <span>
              Bounded Search Ceiling: <strong className="text-emerald-400">&le; {maxSearchBudget} evals</strong> via Beam Search
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRunScenarioStudy}
              disabled={runningScenarioStudy}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded-md font-medium flex items-center gap-1.5 transition"
            >
              {runningScenarioStudy ? (
                <div className="w-3 h-3 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
              ) : (
                <Layers className="w-3.5 h-3.5" />
              )}
              Run Cross-Scenario Stress Test
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('mpc_run')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === 'mpc_run'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Compass className="w-4 h-4" />
          Receding-Horizon MPC Trajectory & Execution Inspector
        </button>
        <button
          onClick={() => setActiveTab('scenario_matrix')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
            activeTab === 'scenario_matrix'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Multi-Scenario Uncertainty Matrix (Nominal vs. Robust vs. CVaR)
        </button>
      </div>

      {activeTab === 'mpc_run' && mpcResult && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
              <span className="text-slate-400 text-xs block">Average Travel Time</span>
              <span className="text-xl font-bold text-white mt-1 block">
                {mpcResult.mpc_metrics.avg_travel_time_mins.toFixed(1)} <span className="text-xs text-slate-400 font-normal">mins</span>
              </span>
              <span className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" /> System Mean
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
              <span className="text-slate-400 text-xs block">Average Congestion</span>
              <span className="text-xl font-bold text-white mt-1 block">
                {mpcResult.mpc_metrics.avg_congestion_pct.toFixed(1)}<span className="text-xs text-slate-400 font-normal">%</span>
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Both Cities & Corridor</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
              <span className="text-slate-400 text-xs block">Average Queues</span>
              <span className="text-xl font-bold text-cyan-400 mt-1 block">
                {mpcResult.mpc_metrics.avg_queue_length.toFixed(1)} <span className="text-xs text-slate-400 font-normal">veh</span>
              </span>
              <span className="text-[10px] text-cyan-400/80 mt-1 block">Bottleneck Controlled</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
              <span className="text-slate-400 text-xs block">Total Intervention Cost</span>
              <span className="text-xl font-bold text-amber-300 mt-1 block">
                ${mpcResult.mpc_metrics.total_intervention_cost.toFixed(0)}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">Cumulative Budget Spent</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
              <span className="text-slate-400 text-xs block">Total Evaluations</span>
              <span className="text-xl font-bold text-indigo-300 mt-1 block">
                {mpcResult.total_evaluations_count.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-400 mt-1 block">Beam search bounded</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
              <span className="text-slate-400 text-xs block">Planning Latency</span>
              <span className="text-xl font-bold text-white mt-1 block">
                {mpcResult.computation_time_ms.toFixed(1)} <span className="text-xs text-slate-400 font-normal">ms</span>
              </span>
              <span className="text-[10px] text-emerald-400 mt-1 block">
                {(mpcResult.computation_time_ms / mpcResult.total_steps).toFixed(1)} ms / step
              </span>
            </div>
          </div>

          {/* Trajectory Evolution Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  Receding-Horizon Multi-Step Execution Trajectory
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Actual simulated progression over {mpcResult.total_steps} steps. At every step, the MPC solver planned {planningHorizon} steps ahead and executed the first action pair.
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-indigo-400 font-medium">
                  <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full" /> Cumulative Discounted Cost
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" /> System Congestion (%)
                </span>
                <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
                  <span className="w-2.5 h-2.5 bg-cyan-500 rounded-full" /> Corridor Delay (mins)
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trajectoryChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="step" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="cost" stroke="#818cf8" tick={{ fontSize: 11 }} domain={[0, 'auto']} />
                  <YAxis yAxisId="metric" orientation="right" stroke="#10b981" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }}
                  />
                  <Line
                    yAxisId="cost"
                    type="monotone"
                    dataKey="cumulativeDiscounted"
                    name="Discounted Plan Cost"
                    stroke="#818cf8"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    yAxisId="metric"
                    type="monotone"
                    dataKey="congestion"
                    name="Congestion (%)"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Line
                    yAxisId="metric"
                    type="monotone"
                    dataKey="corridorDelay"
                    name="Corridor Travel Time (m)"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Step Selector Bar & Inspector */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  Step Decision & Multi-Step Lookahead Inspector
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select a simulation step to inspect its executed decision, future planned lookahead sequence, and cost discount decay.
                </p>
              </div>

              {/* Step Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
                {mpcResult.step_decisions.map((dec, idx) => (
                  <button
                    key={dec.decision_step}
                    onClick={() => setSelectedStepIdx(idx)}
                    className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition ${
                      selectedStepIdx === idx
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    Step {dec.decision_step}
                  </button>
                ))}
              </div>
            </div>

            {currentDecision && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Executed Action (Receding Horizon Principle) */}
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Step {currentDecision.decision_step} Executed Action
                    </span>
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono">
                      Receding Horizon (t=0)
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-slate-900/90 border border-slate-700/60 rounded-lg p-3">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide block">City A Executed Policy</span>
                      <span className="text-sm font-semibold text-white mt-0.5 block">{currentDecision.executed_action_a_name}</span>
                      <span className="text-xs font-mono text-cyan-400 block mt-0.5">{currentDecision.executed_action_a}</span>
                    </div>

                    <div className="bg-slate-900/90 border border-slate-700/60 rounded-lg p-3">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide block">City B Executed Policy</span>
                      <span className="text-sm font-semibold text-white mt-0.5 block">{currentDecision.executed_action_b_name}</span>
                      <span className="text-xs font-mono text-purple-400 block mt-0.5">{currentDecision.executed_action_b}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Intervention Cost</span>
                      <span className="font-semibold text-amber-300 font-mono">${currentDecision.executed_intervention_cost}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Cumulative Cost</span>
                      <span className="font-semibold text-indigo-300 font-mono">{currentDecision.cumulative_discounted_cost.toFixed(4)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Evaluations</span>
                      <span className="font-semibold text-slate-200 font-mono">{currentDecision.total_candidate_evaluations}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">AI Model Used</span>
                      <span className="font-semibold text-emerald-400">{currentDecision.used_ai_prediction ? 'Yes' : 'Fallback'}</span>
                    </div>
                  </div>
                </div>

                {/* Multi-Step Planned Sequence (Future Horizon) */}
                <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-3 lg:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                        Planned Forward Horizon Sequence (H={currentDecision.planning_horizon})
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Only step t+0 was executed in the real engine. Steps t+1..t+{currentDecision.planning_horizon-1} are hypothetical sandbox plans.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-slate-400">
                      &gamma; = {currentDecision.discount_factor}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-700 text-slate-400">
                          <th className="pb-2 font-medium">Offset</th>
                          <th className="pb-2 font-medium">City A Action</th>
                          <th className="pb-2 font-medium">City B Action</th>
                          <th className="pb-2 font-medium">Weight (&gamma;<sup>t</sup>)</th>
                          <th className="pb-2 font-medium">Step Cost</th>
                          <th className="pb-2 font-medium">Discounted Cost</th>
                          <th className="pb-2 font-medium">Pred. Congestion</th>
                          <th className="pb-2 font-medium">Pred. Travel Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-700/50">
                        {currentDecision.planned_sequence.map((step) => (
                          <tr
                            key={step.step_offset}
                            className={step.step_offset === 0 ? 'bg-indigo-950/40 text-white font-medium' : 'text-slate-300'}
                          >
                            <td className="py-2.5 font-mono">
                              {step.step_offset === 0 ? (
                                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[10px]">
                                  t+0 (Executed)
                                </span>
                              ) : (
                                <span className="text-slate-400">t+{step.step_offset} (Plan)</span>
                              )}
                            </td>
                            <td className="py-2.5 max-w-[140px] truncate" title={step.action_a_name}>{step.action_a_name}</td>
                            <td className="py-2.5 max-w-[140px] truncate" title={step.action_b_name}>{step.action_b_name}</td>
                            <td className="py-2.5 font-mono text-slate-400">{step.discount_factor_weight.toFixed(2)}</td>
                            <td className="py-2.5 font-mono">{step.raw_step_cost.toFixed(3)}</td>
                            <td className="py-2.5 font-mono text-indigo-300 font-semibold">{step.discounted_step_cost.toFixed(3)}</td>
                            <td className="py-2.5 font-mono text-emerald-400">{step.expected_system_congestion.toFixed(1)}%</td>
                            <td className="py-2.5 font-mono text-cyan-400">{step.expected_system_travel_time.toFixed(1)}m</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Future Horizon Cost Decay Bar */}
                  <div className="mt-3 pt-3 border-t border-slate-700/60">
                    <span className="text-[11px] font-medium text-slate-400 block mb-1">
                      Discounted Cost Decay Across Lookahead Steps (C = &sum; &gamma;<sup>t</sup> c<sub>t</sub>):
                    </span>
                    <div className="h-28 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={lookaheadDecayData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                          <XAxis dataKey="horizonStep" stroke="#64748b" tick={{ fontSize: 10 }} />
                          <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                          />
                          <Bar dataKey="discountedCost" name="Discounted Cost" fill="#818cf8" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="rawStepCost" name="Undiscounted Raw Cost" fill="#475569" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Uncertainty Matrix Tab */}
      {activeTab === 'scenario_matrix' && scenarioStudy && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Cross-Scenario Robustness & Vulnerability Evaluation
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Comparison of Nominal, Robust (worst-case penalized), and Risk-Sensitive (CVaR &alpha;={riskAlpha}) policies across multiple traffic conditions.
                </p>
              </div>

              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span className="bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
                  Base Seed: <strong className="text-white">{scenarioStudy.base_seed}</strong>
                </span>
                <span className="bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
                  Horizon: <strong className="text-white">H={scenarioStudy.planning_horizon}</strong>
                </span>
              </div>
            </div>

            {/* Recommended Policy Summary Callout */}
            <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-lg p-4 text-xs">
              <span className="font-semibold text-indigo-300 block mb-1 uppercase tracking-wide">
                Optimal Policy Synthesis & Recommendation
              </span>
              <p className="text-slate-300 leading-relaxed">
                {scenarioStudy.overall_recommended_policy} {scenarioStudy.robustness_summary}
              </p>
            </div>

            {/* Scenarios Comparison Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-medium">Uncertainty Scenario</th>
                    <th className="pb-3 font-medium">Nominal Cost (E[C])</th>
                    <th className="pb-3 font-medium">Robust Cost (Penalized)</th>
                    <th className="pb-3 font-medium">Risk-Sensitive (CVaR)</th>
                    <th className="pb-3 font-medium">Recommended Action Pair</th>
                    <th className="pb-3 font-medium">Vulnerability & Risk Analysis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {scenarioStudy.evaluated_scenarios.map((item) => (
                    <tr key={item.scenario_type} className="hover:bg-slate-800/40">
                      <td className="py-3 font-semibold text-white">
                        <span className="block">{item.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{item.scenario_type}</span>
                      </td>
                      <td className="py-3 font-mono text-slate-300">{item.nominal_cost.toFixed(4)}</td>
                      <td className="py-3 font-mono text-cyan-300 font-semibold">{item.robust_cost.toFixed(4)}</td>
                      <td className="py-3 font-mono text-purple-300 font-semibold">{item.risk_sensitive_cost.toFixed(4)}</td>
                      <td className="py-3">
                        <span className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-[11px] font-mono text-indigo-300">
                          {item.recommended_action_pair}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400 max-w-xs">{item.vulnerability_notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Visual Bar Comparison */}
            <div className="pt-4 border-t border-slate-800">
              <h4 className="text-xs font-semibold text-slate-300 mb-2">Cost Distribution by Scenario & Planning Mode</h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={scenarioStudy.evaluated_scenarios.map((s) => ({
                      scenario: s.name,
                      nominal: s.nominal_cost,
                      robust: s.robust_cost,
                      riskSensitive: s.risk_sensitive_cost
                    }))}
                    margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="scenario" stroke="#64748b" tick={{ fontSize: 10 }} interval={0} angle={-10} textAnchor="end" />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="nominal" name="Nominal E[C]" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="robust" name="Robust Worst-Case" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="riskSensitive" name="Risk-Sensitive CVaR" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
