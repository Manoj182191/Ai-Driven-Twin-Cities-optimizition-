import React, { useState, useEffect } from 'react';
import {
  runResearchExperiment,
  fetchResearchStatus,
  fetchResearchResults,
  fetchResearchHistory,
  getResearchExportUrl,
  type ResearchScenario,
  type ExperimentConfigRequest,
  type ResearchExperimentStatus,
  type ResearchExperimentResponse,
  type ScenarioStatisticalSummary
} from '../../services/api';
import {
  BookOpen,
  Play,
  AlertCircle,
  FileSpreadsheet,
  FileJson
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export const ResearchEvaluationPage: React.FC = () => {
  const [history, setHistory] = useState<ResearchExperimentStatus[]>([]);
  const [selectedExpId, setSelectedExpId] = useState<string | null>(null);
  const [activeExp, setActiveExp] = useState<ResearchExperimentResponse | null>(null);
  const [activeStatus, setActiveStatus] = useState<ResearchExperimentStatus | null>(null);
  const [running, setRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form controls
  const [expName, setExpName] = useState<string>('Dual Cities Tri-Strategy Study');
  const [selectedScenarios, setSelectedScenarios] = useState<ResearchScenario[]>(['normal', 'peak', 'bottleneck']);
  const [numSeeds, setNumSeeds] = useState<number>(5);
  const [seedStart, setSeedStart] = useState<number>(42);
  const [steps, setSteps] = useState<number>(24);
  const [activeScenarioTab, setActiveScenarioTab] = useState<string>('normal');

  // Load experiment history
  const loadHistory = async () => {
    try {
      const hist = await fetchResearchHistory();
      setHistory(hist);
      if (hist.length > 0 && !selectedExpId) {
        setSelectedExpId(hist[0].experiment_id);
      }
    } catch (err: unknown) {
      console.error(err);
    }
  };

  // Load results for selected experiment
  const loadExperimentDetails = async (id: string) => {
    setError(null);
    try {
      const stat = await fetchResearchStatus(id);
      setActiveStatus(stat);
      if (stat.status === 'completed') {
        const results = await fetchResearchResults(id);
        setActiveExp(results);
        const scenarios = Object.keys(results.scenario_summaries);
        if (scenarios.length > 0 && !scenarios.includes(activeScenarioTab)) {
          setActiveScenarioTab(scenarios[0]);
        }
      } else {
        setActiveExp(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load experiment results');
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (selectedExpId) {
      loadExperimentDetails(selectedExpId);
    }
  }, [selectedExpId]);

  // Polling when active experiment is running
  useEffect(() => {
    if (!activeStatus || activeStatus.status !== 'running') {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const stat = await fetchResearchStatus(activeStatus.experiment_id);
        setActiveStatus(stat);
        if (stat.status === 'completed') {
          setRunning(false);
          const results = await fetchResearchResults(stat.experiment_id);
          setActiveExp(results);
          loadHistory();
        } else if (stat.status === 'failed') {
          setRunning(false);
          setError(stat.error_message || 'Experiment execution failed');
        }
      } catch (e) {
        console.error(e);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [activeStatus]);

  const handleLaunchExperiment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (selectedScenarios.length === 0) {
      setError('Please select at least one scenario.');
      return;
    }

    setRunning(true);
    setError(null);

    const config: ExperimentConfigRequest = {
      name: expName,
      scenarios: selectedScenarios,
      num_seeds: numSeeds,
      seed_start: seedStart,
      steps: steps,
      run_async: true
    };

    try {
      const initStatus = await runResearchExperiment(config);
      setActiveStatus(initStatus);
      setSelectedExpId(initStatus.experiment_id);
      await loadHistory();
    } catch (err: unknown) {
      setRunning(false);
      setError(err instanceof Error ? err.message : 'Failed to launch research experiment');
    }
  };

  const toggleScenario = (sc: ResearchScenario) => {
    if (selectedScenarios.includes(sc)) {
      if (selectedScenarios.length > 1) {
        setSelectedScenarios(selectedScenarios.filter((s) => s !== sc));
      }
    } else {
      setSelectedScenarios([...selectedScenarios, sc]);
    }
  };

  const currentSummary: ScenarioStatisticalSummary | undefined =
    activeExp?.scenario_summaries?.[activeScenarioTab];

  // Prepare chart data comparing strategies on primary metrics
  const primaryChartData = currentSummary ? [
    {
      metric: 'Travel Time (mins)',
      Unoptimized: currentSummary.descriptive_by_strategy?.unoptimized?.system_avg_travel_time?.mean || 0,
      Independent: currentSummary.descriptive_by_strategy?.independent?.system_avg_travel_time?.mean || 0,
      Coordinated: currentSummary.descriptive_by_strategy?.coordinated?.system_avg_travel_time?.mean || 0
    },
    {
      metric: 'Congestion (%)',
      Unoptimized: currentSummary.descriptive_by_strategy?.unoptimized?.system_avg_congestion?.mean || 0,
      Independent: currentSummary.descriptive_by_strategy?.independent?.system_avg_congestion?.mean || 0,
      Coordinated: currentSummary.descriptive_by_strategy?.coordinated?.system_avg_congestion?.mean || 0
    },
    {
      metric: 'Queue (veh)',
      Unoptimized: currentSummary.descriptive_by_strategy?.unoptimized?.system_avg_queue_length?.mean || 0,
      Independent: currentSummary.descriptive_by_strategy?.independent?.system_avg_queue_length?.mean || 0,
      Coordinated: currentSummary.descriptive_by_strategy?.coordinated?.system_avg_queue_length?.mean || 0
    },
    {
      metric: 'Objective Cost (x100)',
      Unoptimized: (currentSummary.descriptive_by_strategy?.unoptimized?.system_objective_cost?.mean || 0) * 100,
      Independent: (currentSummary.descriptive_by_strategy?.independent?.system_objective_cost?.mean || 0) * 100,
      Coordinated: (currentSummary.descriptive_by_strategy?.coordinated?.system_objective_cost?.mean || 0) * 100
    }
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Top Banner */}
      <div className="glass-panel" style={{
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        borderLeft: '4px solid #8b5cf6'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
            padding: '10px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(139, 92, 246, 0.35)'
          }}>
            <BookOpen size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                background: '#8b5cf6',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase'
              }}>
                Phase 7 Active
              </span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                Research Experiments & Statistical Evaluation
              </h2>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '2px' }}>
              Scientific tri-strategy evaluation: Unoptimized vs. Independent (Phase 5) vs. Joint Coordinated (Phase 6).
            </p>
          </div>
        </div>

        {/* Experiment History Dropdown & Export Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Saved Study:</span>
            <select
              value={selectedExpId || ''}
              onChange={(e) => setSelectedExpId(e.target.value)}
              style={{
                background: '#070a13',
                border: '1px solid var(--border-subtle)',
                color: '#f8fafc',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.78rem'
              }}
            >
              {history.map((h) => (
                <option key={h.experiment_id} value={h.experiment_id}>
                  {h.name} ({h.experiment_id} • {h.completed_runs}/{h.total_expected_runs} runs)
                </option>
              ))}
              {history.length === 0 && <option value="">No experiments recorded</option>}
            </select>
          </div>

          {selectedExpId && activeExp && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <a
                href={getResearchExportUrl(selectedExpId, 'csv')}
                download
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#38bdf8',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                <FileSpreadsheet size={14} />
                <span>Export CSV</span>
              </a>

              <a
                href={getResearchExportUrl(selectedExpId, 'json')}
                download
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(168, 85, 247, 0.15)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  color: '#c084fc',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  textDecoration: 'none'
                }}
              >
                <FileJson size={14} />
                <span>Export JSON</span>
              </a>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          color: '#fda4af',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} color="#f43f5e" />
          <span>{error}</span>
        </div>
      )}

      {/* Experiment Configuration & Execution Panel */}
      <div className="glass-panel-elevated" style={{ padding: '1.25rem 1.5rem' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginBottom: '1rem' }}>
          Configure New Research-Grade Experiment
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              Experiment Name
            </label>
            <input
              type="text"
              value={expName}
              onChange={(e) => setExpName(e.target.value)}
              style={{
                width: '100%',
                background: '#070a13',
                border: '1px solid var(--border-subtle)',
                color: '#f8fafc',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.8rem'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              Sample Size (Seeds per Scenario)
            </label>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[3, 5, 10, 30].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setNumSeeds(num)}
                  style={{
                    flex: 1,
                    background: numSeeds === num ? '#7c3aed' : 'rgba(255, 255, 255, 0.05)',
                    color: numSeeds === num ? '#fff' : '#94a3b8',
                    border: '1px solid ' + (numSeeds === num ? '#8b5cf6' : 'var(--border-subtle)'),
                    padding: '6px 4px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {num} {num === 30 ? '(Full)' : ''}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
              Starting Seed & Duration
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="number"
                value={seedStart}
                onChange={(e) => setSeedStart(Number(e.target.value))}
                placeholder="Seed"
                style={{
                  width: '50%',
                  background: '#070a13',
                  border: '1px solid var(--border-subtle)',
                  color: '#f8fafc',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  fontSize: '0.78rem'
                }}
              />
              <select
                value={steps}
                onChange={(e) => setSteps(Number(e.target.value))}
                style={{
                  width: '50%',
                  background: '#070a13',
                  border: '1px solid var(--border-subtle)',
                  color: '#f8fafc',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  fontSize: '0.78rem'
                }}
              >
                <option value={12}>12 Steps</option>
                <option value={24}>24 Steps</option>
                <option value={36}>36 Steps</option>
              </select>
            </div>
          </div>

          <div>
            <button
              onClick={() => handleLaunchExperiment()}
              disabled={running}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: running ? '#4c1d95' : '#7c3aed',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: running ? 'not-allowed' : 'pointer',
                boxShadow: '0 0 12px rgba(124, 58, 237, 0.35)'
              }}
            >
              <Play size={14} />
              <span>{running ? 'Executing Tri-Strategy Study...' : 'Run Experiment (All 3 Strategies)'}</span>
            </button>
          </div>
        </div>

        {/* Scenarios Selection Pills */}
        <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Scenarios to evaluate:</span>
          {(['normal', 'high', 'peak', 'bottleneck'] as ResearchScenario[]).map((sc) => {
            const isSelected = selectedScenarios.includes(sc);
            return (
              <button
                key={sc}
                type="button"
                onClick={() => toggleScenario(sc)}
                style={{
                  background: isSelected ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid ' + (isSelected ? 'rgba(56, 189, 248, 0.5)' : 'var(--border-subtle)'),
                  color: isSelected ? '#38bdf8' : '#64748b',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {sc === 'normal' && 'Normal Demand'}
                {sc === 'high' && 'High Inflow'}
                {sc === 'peak' && 'Peak Rush Hour'}
                {sc === 'bottleneck' && 'Intercity Bottleneck'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Running Progress Bar */}
      {activeStatus && activeStatus.status === 'running' && (
        <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', borderLeft: '4px solid #38bdf8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
              Experiment in Progress: {activeStatus.name} ({activeStatus.experiment_id})
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
              {activeStatus.progress_pct}% Completed ({activeStatus.completed_runs}/{activeStatus.total_expected_runs} matched runs)
            </span>
          </div>

          <div style={{
            width: '100%',
            height: '8px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '999px',
            overflow: 'hidden',
            marginBottom: '0.5rem'
          }}>
            <div style={{
              width: `${activeStatus.progress_pct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #38bdf8, #8b5cf6)',
              borderRadius: '999px',
              transition: 'width 0.3s ease'
            }} />
          </div>

          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Simulating scenario: <strong style={{ color: '#cbd5e1' }}>{activeStatus.current_scenario}</strong> • Seed: <strong style={{ color: '#cbd5e1' }}>{activeStatus.current_seed}</strong> • Evaluating Unoptimized, Independent, and Coordinated policies.
          </div>
        </div>
      )}

      {/* Scenario Tabs for Results Exploration */}
      {activeExp && Object.keys(activeExp.scenario_summaries).length > 0 && (
        <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
          {Object.keys(activeExp.scenario_summaries).map((scKey) => (
            <button
              key={scKey}
              onClick={() => setActiveScenarioTab(scKey)}
              style={{
                background: activeScenarioTab === scKey ? '#7c3aed' : 'transparent',
                color: activeScenarioTab === scKey ? '#fff' : '#94a3b8',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize'
              }}
            >
              Scenario: {scKey} ({activeExp.scenario_summaries[scKey].sample_size_per_strategy} seeds)
            </button>
          ))}
        </div>
      )}

      {/* Primary Comparison Cards for Active Scenario */}
      {currentSummary && (
        <div>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Matched Strategy Mean Outcomes (Scenario: {currentSummary.scenario.toUpperCase()}, N = {currentSummary.sample_size_per_strategy})
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1rem'
          }}>
            {/* Travel Time */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>System Travel Time (mins)</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                    {currentSummary.descriptive_by_strategy?.coordinated?.system_avg_travel_time?.mean.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Coordinated (Phase 6)</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
                    {currentSummary.descriptive_by_strategy?.independent?.system_avg_travel_time?.mean.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Independent (Phase 5)</div>
                </div>
              </div>
              <div style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Unoptimized Baseline:</span>
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{currentSummary.descriptive_by_strategy?.unoptimized?.system_avg_travel_time?.mean.toFixed(2)} mins</span>
              </div>
            </div>

            {/* Congestion */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>System Congestion (%)</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                    {currentSummary.descriptive_by_strategy?.coordinated?.system_avg_congestion?.mean.toFixed(2)}%
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Coordinated (Phase 6)</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
                    {currentSummary.descriptive_by_strategy?.independent?.system_avg_congestion?.mean.toFixed(2)}%
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Independent (Phase 5)</div>
                </div>
              </div>
              <div style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Unoptimized Baseline:</span>
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{currentSummary.descriptive_by_strategy?.unoptimized?.system_avg_congestion?.mean.toFixed(2)}%</span>
              </div>
            </div>

            {/* Queues */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Average Queues (Vehicles)</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                    {currentSummary.descriptive_by_strategy?.coordinated?.system_avg_queue_length?.mean.toFixed(1)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Coordinated (Phase 6)</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
                    {currentSummary.descriptive_by_strategy?.independent?.system_avg_queue_length?.mean.toFixed(1)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Independent (Phase 5)</div>
                </div>
              </div>
              <div style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Unoptimized Baseline:</span>
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{currentSummary.descriptive_by_strategy?.unoptimized?.system_avg_queue_length?.mean.toFixed(1)} veh</span>
              </div>
            </div>

            {/* Objective Cost */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Combined Objective Cost</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '6px', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
                    {currentSummary.descriptive_by_strategy?.coordinated?.system_objective_cost?.mean.toFixed(4)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Coordinated (Phase 6)</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
                    {currentSummary.descriptive_by_strategy?.independent?.system_objective_cost?.mean.toFixed(4)}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Independent (Phase 5)</div>
                </div>
              </div>
              <div style={{ padding: '6px 10px', background: 'rgba(0,0,0,0.25)', borderRadius: '6px', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Unoptimized Baseline:</span>
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{currentSummary.descriptive_by_strategy?.unoptimized?.system_objective_cost?.mean.toFixed(4)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recharts Bar Chart: Tri-Strategy Direct Comparison */}
      {primaryChartData.length > 0 && (
        <div className="glass-panel-elevated" style={{ padding: '1.25rem 1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>
            Empirical Comparison Across Primary Network Metrics
          </h3>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1.25rem' }}>
            Mean performance across matched seeds for {currentSummary?.scenario.toUpperCase()} scenario.
          </p>

          <div style={{ height: '320px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={primaryChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="metric" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0c1322', borderColor: '#334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#f8fafc' }}
                />
                <Legend />
                <Bar dataKey="Unoptimized" fill="#64748b" name="Unoptimized Baseline" />
                <Bar dataKey="Independent" fill="#0284c7" name="Phase 5 Independent" />
                <Bar dataKey="Coordinated" fill="#10b981" name="Phase 6 Coordinated" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Rigorous Statistical Hypothesis Testing Table (Paired Coordinated vs Independent) */}
      {currentSummary && (
        <div className="glass-panel-elevated" style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                Paired Statistical Hypothesis Testing (Phase 6 vs. Phase 5)
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Paired t-test, Wilcoxon signed-rank test, Cohen's dz effect size, and Holm-Bonferroni FWER correction.
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
              Alpha = 0.05 (Two-Tailed)
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: '#64748b' }}>
                  <th style={{ padding: '8px' }}>Metric</th>
                  <th style={{ padding: '8px' }}>Independent Mean</th>
                  <th style={{ padding: '8px' }}>Coordinated Mean</th>
                  <th style={{ padding: '8px' }}>Mean Diff (d)</th>
                  <th style={{ padding: '8px' }}>Improvement (%)</th>
                  <th style={{ padding: '8px' }}>Paired 95% CI</th>
                  <th style={{ padding: '8px' }}>t-stat</th>
                  <th style={{ padding: '8px' }}>Holm Adj p-val</th>
                  <th style={{ padding: '8px' }}>Cohen's dz</th>
                  <th style={{ padding: '8px' }}>Significance Verdict</th>
                </tr>
              </thead>
              <tbody>
                {currentSummary.paired_comparisons.map((cmp) => (
                  <tr key={cmp.metric_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 8px', fontWeight: 600, color: '#f8fafc' }}>
                      {cmp.metric_name} ({cmp.unit})
                    </td>
                    <td style={{ padding: '10px 8px', color: '#94a3b8', fontFamily: 'monospace' }}>
                      {cmp.mean_baseline.toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 8px', color: '#10b981', fontFamily: 'monospace', fontWeight: 700 }}>
                      {cmp.mean_target.toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 8px', color: '#cbd5e1', fontFamily: 'monospace' }}>
                      {cmp.mean_difference.toFixed(2)}
                    </td>
                    <td style={{ padding: '10px 8px', fontWeight: 700 }}>
                      {cmp.mean_improvement_pct !== null ? (
                        <span style={{ color: cmp.mean_improvement_pct > 0 ? '#10b981' : '#f43f5e' }}>
                          {cmp.mean_improvement_pct > 0 ? '+' : ''}{cmp.mean_improvement_pct.toFixed(2)}%
                        </span>
                      ) : (
                        <span style={{ color: '#64748b' }}>N/A</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 8px', color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.74rem' }}>
                      [{cmp.ci_95_diff_lower.toFixed(2)}, {cmp.ci_95_diff_upper.toFixed(2)}]
                    </td>
                    <td style={{ padding: '10px 8px', color: '#cbd5e1', fontFamily: 'monospace' }}>
                      {cmp.t_statistic !== null ? cmp.t_statistic.toFixed(3) : 'N/A'}
                    </td>
                    <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontWeight: 600, color: cmp.p_value_adjusted_holm !== null && cmp.p_value_adjusted_holm < 0.05 ? '#10b981' : '#94a3b8' }}>
                      {cmp.p_value_adjusted_holm !== null ? cmp.p_value_adjusted_holm.toFixed(4) : 'N/A'}
                    </td>
                    <td style={{ padding: '10px 8px', color: '#cbd5e1', fontFamily: 'monospace' }}>
                      {cmp.effect_size_cohen_dz !== null ? cmp.effect_size_cohen_dz.toFixed(3) : 'N/A'}
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      {cmp.is_statistically_significant ? (
                        <span style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#34d399',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontWeight: 700,
                          fontSize: '0.72rem'
                        }}>
                          Significant (p &lt; 0.05)
                        </span>
                      ) : (
                        <span style={{
                          background: 'rgba(148, 163, 184, 0.15)',
                          color: '#94a3b8',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontWeight: 500,
                          fontSize: '0.72rem'
                        }}>
                          Inconclusive
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Academic Disclaimer & Methodology Notes */}
      <div className="glass-panel" style={{
        padding: '1.25rem 1.5rem',
        borderRadius: '10px',
        border: '1px solid rgba(139, 92, 246, 0.25)',
        background: 'rgba(139, 92, 246, 0.05)'
      }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#c084fc', marginBottom: '0.5rem' }}>
          Academic & Methodological Standards
        </h4>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>
          {activeExp?.academic_disclaimer || (
            "All experimental evaluations in this platform are conducted under matched random seeds, identical diurnal traffic profiles, and equivalent network topologies using Bureau of Public Roads (BPR) congestion curves. Outcomes represent simulation-based evidence under controlled assumptions and should not be generalized to empirical real-world municipal infrastructure without field calibration."
          )}
        </p>
      </div>
    </div>
  );
};
