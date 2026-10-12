import React, { useState, useEffect } from 'react';
import {
  runIndependentOptimization,
  fetchOptimizationStatus,
  fetchOptimizationResults,
  fetchOptimizationActions,
  type IndependentRunResponse,
  type OptimizationActionDefinition,
  type OptimizationStatusResponse,
  type DemandLevel
} from '../../services/api';
import {
  Cpu,
  Play,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Sliders
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export const IndependentOptimizationPage: React.FC = () => {
  const [status, setStatus] = useState<OptimizationStatusResponse | null>(null);
  const [actions, setActions] = useState<OptimizationActionDefinition[]>([]);
  const [latestRun, setLatestRun] = useState<IndependentRunResponse | null>(null);
  const [runHistory, setRunHistory] = useState<IndependentRunResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [running, setRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form controls
  const [seed, setSeed] = useState<number>(42);
  const [demandLevel, setDemandLevel] = useState<DemandLevel>('normal');
  const [steps, setSteps] = useState<number>(24);
  const [includeRef, setIncludeRef] = useState<boolean>(true);

  // Active step inspector for step-by-step breakdown
  const [inspectStepIndex, setInspectStepIndex] = useState<number>(0);
  const [activeChartMetric, setActiveChartMetric] = useState<'congestion' | 'travel_time' | 'corridor'>('congestion');
  const [showCandidateDetails, setShowCandidateDetails] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statRes, actRes, histRes] = await Promise.all([
        fetchOptimizationStatus(),
        fetchOptimizationActions(),
        fetchOptimizationResults()
      ]);
      setStatus(statRes);
      setActions(actRes);
      setRunHistory(histRes);
      if (histRes.length > 0) {
        setLatestRun(histRes[histRes.length - 1]);
        setInspectStepIndex(0);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load optimization status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunOptimization = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setRunning(true);
    setError(null);
    try {
      const res = await runIndependentOptimization({
        seed,
        demand_level: demandLevel,
        steps,
        include_unoptimized_reference: includeRef
      });
      setLatestRun(res);
      setInspectStepIndex(0);
      setRunHistory((prev) => [...prev, res]);
      const statRes = await fetchOptimizationStatus();
      setStatus(statRes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Independent optimization failed');
    } finally {
      setRunning(false);
    }
  };

  const currentStepRecord = latestRun?.step_records?.[inspectStepIndex] || latestRun?.step_records?.[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Header Banner */}
      <div className="glass-panel" style={{
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        borderLeft: '4px solid #38bdf8'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
            padding: '10px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(56, 189, 248, 0.35)'
          }}>
            <Cpu size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                background: '#0284c7',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase'
              }}>
                Phase 5 Active
              </span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                Independent City Optimization Baseline
              </h2>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '2px' }}>
              City A and City B autonomously select local traffic actions using strictly local states and predictions.
            </p>
          </div>
        </div>

        {/* Experiment Run Trigger Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Demand:</span>
            <select
              value={demandLevel}
              onChange={(e) => setDemandLevel(e.target.value as DemandLevel)}
              style={{
                background: '#070a13',
                border: '1px solid var(--border-subtle)',
                color: '#f8fafc',
                padding: '5px 8px',
                borderRadius: '6px',
                fontSize: '0.78rem'
              }}
            >
              <option value="low">Low Demand</option>
              <option value="normal">Normal Demand</option>
              <option value="peak">Peak Rush Hour</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Seed:</span>
            <select
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              style={{
                background: '#070a13',
                border: '1px solid var(--border-subtle)',
                color: '#f8fafc',
                padding: '5px 8px',
                borderRadius: '6px',
                fontSize: '0.78rem'
              }}
            >
              <option value={42}>42 (Default)</option>
              <option value={101}>101</option>
              <option value={777}>777</option>
              <option value={999}>999</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Steps:</span>
            <select
              value={steps}
              onChange={(e) => setSteps(Number(e.target.value))}
              style={{
                background: '#070a13',
                border: '1px solid var(--border-subtle)',
                color: '#f8fafc',
                padding: '5px 8px',
                borderRadius: '6px',
                fontSize: '0.78rem'
              }}
            >
              <option value={12}>12 Steps (Half-Day)</option>
              <option value={24}>24 Steps (Full Day Cycle)</option>
              <option value={36}>36 Steps (1.5 Days)</option>
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: '#cbd5e1', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeRef}
              onChange={(e) => setIncludeRef(e.target.checked)}
            />
            <span>Compare Unoptimized Ref</span>
          </label>

          <button
            onClick={() => handleRunOptimization()}
            disabled={running || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              padding: '7px 16px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: running ? 'not-allowed' : 'pointer',
              boxShadow: '0 0 10px rgba(14, 165, 233, 0.3)'
            }}
          >
            <Play size={14} />
            <span>{running ? 'Running Baseline...' : 'Run Independent Baseline'}</span>
          </button>
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
          <AlertTriangle size={16} color="#f43f5e" />
          <span>{error}</span>
        </div>
      )}

      {/* Aggregate KPI Comparison Cards (Baseline vs Reference) */}
      {latestRun && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem'
        }}>
          {/* Card 1: System Congestion */}
          <div className="glass-panel" style={{ padding: '1.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                System Congestion
              </span>
              {latestRun.improvement_vs_reference && (
                <span style={{
                  fontSize: '0.72rem',
                  color: latestRun.improvement_vs_reference.congestion_reduction_pct >= 0 ? '#10b981' : '#f43f5e',
                  background: latestRun.improvement_vs_reference.congestion_reduction_pct >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 700
                }}>
                  {latestRun.improvement_vs_reference.congestion_reduction_pct >= 0 ? '▼ ' : '▲ '}
                  {Math.abs(latestRun.improvement_vs_reference.congestion_reduction_pct)}% vs Unopt
                </span>
              )}
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
              {latestRun.baseline_metrics.avg_congestion_pct}%
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
              Unoptimized Reference: {latestRun.reference_metrics?.avg_congestion_pct ?? 'N/A'}%
            </div>
          </div>

          {/* Card 2: Avg Travel Time */}
          <div className="glass-panel" style={{ padding: '1.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                Avg Travel Time
              </span>
              {latestRun.improvement_vs_reference && (
                <span style={{
                  fontSize: '0.72rem',
                  color: latestRun.improvement_vs_reference.travel_time_reduction_pct >= 0 ? '#10b981' : '#f43f5e',
                  background: latestRun.improvement_vs_reference.travel_time_reduction_pct >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 700
                }}>
                  {latestRun.improvement_vs_reference.travel_time_reduction_pct >= 0 ? '▼ ' : '▲ '}
                  {Math.abs(latestRun.improvement_vs_reference.travel_time_reduction_pct)}% vs Unopt
                </span>
              )}
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
              {latestRun.baseline_metrics.avg_travel_time_mins} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>min</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
              Unoptimized Reference: {latestRun.reference_metrics?.avg_travel_time_mins ?? 'N/A'} min
            </div>
          </div>

          {/* Card 3: Total Queues */}
          <div className="glass-panel" style={{ padding: '1.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                Avg Total Queues
              </span>
              {latestRun.improvement_vs_reference && (
                <span style={{
                  fontSize: '0.72rem',
                  color: latestRun.improvement_vs_reference.queue_reduction_pct >= 0 ? '#10b981' : '#f43f5e',
                  background: latestRun.improvement_vs_reference.queue_reduction_pct >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 700
                }}>
                  {latestRun.improvement_vs_reference.queue_reduction_pct >= 0 ? '▼ ' : '▲ '}
                  {Math.abs(latestRun.improvement_vs_reference.queue_reduction_pct)}%
                </span>
              )}
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
              {latestRun.baseline_metrics.avg_queue_length} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>veh</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
              Unoptimized Reference: {latestRun.reference_metrics?.avg_queue_length ?? 'N/A'} veh
            </div>
          </div>

          {/* Card 4: Operational Intervention Cost */}
          <div className="glass-panel" style={{ padding: '1.15rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                Total Intervention Cost
              </span>
              <span style={{
                fontSize: '0.72rem',
                color: '#38bdf8',
                background: 'rgba(56, 189, 248, 0.15)',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: 600
              }}>
                {latestRun.total_steps} Steps
              </span>
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
              {latestRun.baseline_metrics.total_intervention_cost} <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>pts</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
              Avg Objective Cost: {latestRun.baseline_metrics.total_objective_cost.toFixed(4)}
            </div>
          </div>
        </div>
      )}

      {/* Strict Decentralization Notice */}
      <div style={{
        background: 'rgba(56, 189, 248, 0.05)',
        border: '1px solid rgba(56, 189, 248, 0.2)',
        borderRadius: '10px',
        padding: '0.85rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <ShieldCheck size={20} color="#38bdf8" />
        <div style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.4 }}>
          <strong style={{ color: '#f8fafc' }}>Strict Independence Guarantee:</strong> City A and City B operate with separate local objective functions and private input spaces. Neither optimizer receives the other city's status, forecasts, or chosen actions.
        </div>
      </div>

      {/* Step Inspector Controls */}
      {latestRun && latestRun.step_records.length > 0 && (
        <div className="glass-panel" style={{ padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="#38bdf8" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                Inspect Decisions at Step:
              </span>
            </div>
            {runHistory.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Run:</span>
                <select
                  value={latestRun.run_id}
                  onChange={(e) => {
                    const found = runHistory.find((r) => r.run_id === e.target.value);
                    if (found) {
                      setLatestRun(found);
                      setInspectStepIndex(0);
                    }
                  }}
                  style={{
                    background: '#070a13',
                    border: '1px solid var(--border-subtle)',
                    color: '#38bdf8',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem'
                  }}
                >
                  {runHistory.map((r) => (
                    <option key={r.run_id} value={r.run_id}>
                      {r.run_id} ({r.demand_level}, {r.baseline_metrics.avg_congestion_pct}%)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', maxWidth: '100%' }}>
            {latestRun.step_records.map((rec, idx) => (
              <button
                key={rec.step}
                onClick={() => setInspectStepIndex(idx)}
                style={{
                  background: inspectStepIndex === idx ? '#0284c7' : 'rgba(255, 255, 255, 0.05)',
                  color: inspectStepIndex === idx ? '#fff' : '#94a3b8',
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: inspectStepIndex === idx ? 700 : 500,
                  cursor: 'pointer'
                }}
              >
                t={rec.step}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Independent Decision Panels (City A vs City B) */}
      {currentStepRecord && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1.25rem'
        }}>
          {/* City A Autonomous Decision Card */}
          <div className="glass-panel-elevated" style={{
            padding: '1.25rem',
            borderTop: '3px solid #38bdf8'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                  City A (Metro Alpha)
                </span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                  Autonomous Action at Step t={currentStepRecord.step}
                </h3>
              </div>
              <span style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>
                Cost: {currentStepRecord.city_a_decision.total_local_cost.toFixed(4)}
              </span>
            </div>

            {/* Selected Action Pill */}
            <div style={{
              background: 'rgba(2, 132, 199, 0.15)',
              border: '1px solid rgba(2, 132, 199, 0.35)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '1rem'
            }}>
              <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase' }}>
                Selected Optimization Action:
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                {currentStepRecord.city_a_decision.selected_action_name}
              </div>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px', lineHeight: 1.4 }}>
                {currentStepRecord.city_a_decision.explanation}
              </p>
            </div>

            {/* Local Inputs Snapshot */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                Permitted Local Inputs (City A Only):
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '6px',
                fontSize: '0.78rem'
              }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '6px' }}>
                  <span style={{ color: '#64748b' }}>Congestion: </span>
                  <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{currentStepRecord.city_a_decision.local_inputs_snapshot.current_congestion}%</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '6px' }}>
                  <span style={{ color: '#64748b' }}>Travel Time: </span>
                  <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{currentStepRecord.city_a_decision.local_inputs_snapshot.avg_travel_time}m</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '6px' }}>
                  <span style={{ color: '#64748b' }}>Queue Length: </span>
                  <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{currentStepRecord.city_a_decision.local_inputs_snapshot.avg_queue_length}v</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '6px' }}>
                  <span style={{ color: '#64748b' }}>Forecast Cong: </span>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>
                    {currentStepRecord.city_a_decision.local_inputs_snapshot.local_forecast_congestion
                      ? `${currentStepRecord.city_a_decision.local_inputs_snapshot.local_forecast_congestion.toFixed(1)}%`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                Local Multi-Criteria Cost Breakdown:
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '6px',
                textAlign: 'center',
                fontSize: '0.72rem'
              }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px' }}>
                  <div style={{ color: '#64748b' }}>Travel Time</div>
                  <div style={{ color: '#cbd5e1', fontWeight: 700 }}>{currentStepRecord.city_a_decision.cost_breakdown.travel_time_cost}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px' }}>
                  <div style={{ color: '#64748b' }}>Congestion</div>
                  <div style={{ color: '#cbd5e1', fontWeight: 700 }}>{currentStepRecord.city_a_decision.cost_breakdown.congestion_cost}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px' }}>
                  <div style={{ color: '#64748b' }}>Queues</div>
                  <div style={{ color: '#cbd5e1', fontWeight: 700 }}>{currentStepRecord.city_a_decision.cost_breakdown.queue_cost}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px' }}>
                  <div style={{ color: '#64748b' }}>Resource</div>
                  <div style={{ color: '#cbd5e1', fontWeight: 700 }}>{currentStepRecord.city_a_decision.cost_breakdown.resource_cost}</div>
                </div>
              </div>
            </div>

            {/* Candidate Evaluations Toggle */}
            <div style={{ marginTop: '0.85rem' }}>
              <button
                onClick={() => setShowCandidateDetails(!showCandidateDetails)}
                style={{
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  color: '#38bdf8',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                {showCandidateDetails ? 'Hide All Candidate Evaluations' : 'Inspect Evaluated Local Candidates'}
              </button>
              {showCandidateDetails && (
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.7rem' }}>
                  {currentStepRecord.city_a_decision.candidate_evaluations.map((c) => (
                    <div key={c.action_type} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '4px 8px',
                      background: c.action_type === currentStepRecord.city_a_decision.selected_action ? 'rgba(56, 189, 248, 0.15)' : 'rgba(0,0,0,0.25)',
                      borderRadius: '4px',
                      border: c.action_type === currentStepRecord.city_a_decision.selected_action ? '1px solid rgba(56, 189, 248, 0.3)' : 'none'
                    }}>
                      <span style={{ color: c.is_feasible ? '#cbd5e1' : '#f43f5e' }}>
                        {c.action_name} {!c.is_feasible && '(Infeasible)'}
                      </span>
                      <span style={{ color: '#38bdf8', fontWeight: 600, fontFamily: 'monospace' }}>
                        Cost: {c.total_local_cost.toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* City B Autonomous Decision Card */}
          <div className="glass-panel-elevated" style={{
            padding: '1.25rem',
            borderTop: '3px solid #10b981'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                  City B (Metro Beta)
                </span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                  Autonomous Action at Step t={currentStepRecord.step}
                </h3>
              </div>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 700
              }}>
                Cost: {currentStepRecord.city_b_decision.total_local_cost.toFixed(4)}
              </span>
            </div>

            {/* Selected Action Pill */}
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '1rem'
            }}>
              <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600, textTransform: 'uppercase' }}>
                Selected Optimization Action:
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                {currentStepRecord.city_b_decision.selected_action_name}
              </div>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px', lineHeight: 1.4 }}>
                {currentStepRecord.city_b_decision.explanation}
              </p>
            </div>

            {/* Local Inputs Snapshot */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                Permitted Local Inputs (City B Only):
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '6px',
                fontSize: '0.78rem'
              }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '6px' }}>
                  <span style={{ color: '#64748b' }}>Congestion: </span>
                  <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{currentStepRecord.city_b_decision.local_inputs_snapshot.current_congestion}%</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '6px' }}>
                  <span style={{ color: '#64748b' }}>Travel Time: </span>
                  <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{currentStepRecord.city_b_decision.local_inputs_snapshot.avg_travel_time}m</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '6px' }}>
                  <span style={{ color: '#64748b' }}>Queue Length: </span>
                  <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{currentStepRecord.city_b_decision.local_inputs_snapshot.avg_queue_length}v</span>
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '6px' }}>
                  <span style={{ color: '#64748b' }}>Forecast Cong: </span>
                  <span style={{ color: '#10b981', fontWeight: 600 }}>
                    {currentStepRecord.city_b_decision.local_inputs_snapshot.local_forecast_congestion
                      ? `${currentStepRecord.city_b_decision.local_inputs_snapshot.local_forecast_congestion.toFixed(1)}%`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                Local Multi-Criteria Cost Breakdown:
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '6px',
                textAlign: 'center',
                fontSize: '0.72rem'
              }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px' }}>
                  <div style={{ color: '#64748b' }}>Travel Time</div>
                  <div style={{ color: '#cbd5e1', fontWeight: 700 }}>{currentStepRecord.city_b_decision.cost_breakdown.travel_time_cost}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px' }}>
                  <div style={{ color: '#64748b' }}>Congestion</div>
                  <div style={{ color: '#cbd5e1', fontWeight: 700 }}>{currentStepRecord.city_b_decision.cost_breakdown.congestion_cost}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px' }}>
                  <div style={{ color: '#64748b' }}>Queues</div>
                  <div style={{ color: '#cbd5e1', fontWeight: 700 }}>{currentStepRecord.city_b_decision.cost_breakdown.queue_cost}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px' }}>
                  <div style={{ color: '#64748b' }}>Resource</div>
                  <div style={{ color: '#cbd5e1', fontWeight: 700 }}>{currentStepRecord.city_b_decision.cost_breakdown.resource_cost}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trajectory Charts Across Steps */}
      {latestRun && latestRun.step_records.length > 0 && (
        <div className="glass-panel-elevated" style={{ padding: '1.5rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.25rem'
          }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                Optimization Performance Trajectory
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                Tracking step-by-step evolution under independent decentralized control.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '6px', background: 'rgba(0, 0, 0, 0.35)', padding: '3px', borderRadius: '8px' }}>
              <button
                onClick={() => setActiveChartMetric('congestion')}
                style={{
                  background: activeChartMetric === 'congestion' ? '#0ea5e9' : 'transparent',
                  color: activeChartMetric === 'congestion' ? '#fff' : '#94a3b8',
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Congestion (%)
              </button>
              <button
                onClick={() => setActiveChartMetric('travel_time')}
                style={{
                  background: activeChartMetric === 'travel_time' ? '#0ea5e9' : 'transparent',
                  color: activeChartMetric === 'travel_time' ? '#fff' : '#94a3b8',
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Travel Time (min)
              </button>
              <button
                onClick={() => setActiveChartMetric('corridor')}
                style={{
                  background: activeChartMetric === 'corridor' ? '#0ea5e9' : 'transparent',
                  color: activeChartMetric === 'corridor' ? '#fff' : '#94a3b8',
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Intercity Corridor
              </button>
            </div>
          </div>

          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={latestRun.step_records.map((r) => ({
                  step: r.step,
                  city_a_congestion: r.observed_city_a.congestion_pct,
                  city_b_congestion: r.observed_city_b.congestion_pct,
                  system_congestion: r.observed_combined.system_congestion_pct,
                  city_a_tt: r.observed_city_a.avg_travel_time,
                  city_b_tt: r.observed_city_b.avg_travel_time,
                  system_tt: r.observed_combined.avg_travel_time_mins,
                  ic_volume: r.observed_intercity.volume,
                  ic_queue: r.observed_intercity.queue_length
                }))}
                margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" />
                <XAxis dataKey="step" stroke="#64748b" tick={{ fontSize: 11 }} label={{ value: 'Simulation Step (t)', position: 'insideBottomRight', offset: -5, fill: '#64748b', fontSize: 11 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(14, 21, 38, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    fontSize: '0.78rem',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '0.78rem', paddingTop: '10px' }} />

                {activeChartMetric === 'congestion' && (
                  <>
                    <Line type="monotone" dataKey="city_a_congestion" name="City A Congestion (%)" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="city_b_congestion" name="City B Congestion (%)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="system_congestion" name="Combined System Congestion (%)" stroke="#a855f7" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                  </>
                )}

                {activeChartMetric === 'travel_time' && (
                  <>
                    <Line type="monotone" dataKey="city_a_tt" name="City A Travel Time (min)" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="city_b_tt" name="City B Travel Time (min)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="system_tt" name="System Weighted Avg Travel Time (min)" stroke="#a855f7" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                  </>
                )}

                {activeChartMetric === 'corridor' && (
                  <>
                    <Line type="monotone" dataKey="ic_volume" name="Intercity Volume (veh)" stroke="#a855f7" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="ic_queue" name="Corridor Queue (veh)" stroke="#f43f5e" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Step Log Table */}
      {latestRun && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                Step-by-Step Optimization History Log
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Complete audit trail of independently selected actions and resulting post-step metrics.
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Run ID: {latestRun.run_id}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: '#94a3b8' }}>
                  <th style={{ padding: '8px 10px' }}>Step</th>
                  <th style={{ padding: '8px 10px' }}>City A Action</th>
                  <th style={{ padding: '8px 10px' }}>City A Congestion</th>
                  <th style={{ padding: '8px 10px' }}>City B Action</th>
                  <th style={{ padding: '8px 10px' }}>City B Congestion</th>
                  <th style={{ padding: '8px 10px' }}>Intercity Flow</th>
                  <th style={{ padding: '8px 10px' }}>System Congestion</th>
                  <th style={{ padding: '8px 10px' }}>Avg Travel Time</th>
                </tr>
              </thead>
              <tbody>
                {latestRun.step_records.map((r, i) => (
                  <tr
                    key={r.step}
                    onClick={() => setInspectStepIndex(i)}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: inspectStepIndex === i ? 'rgba(56, 189, 248, 0.1)' : (i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'),
                      cursor: 'pointer'
                    }}
                  >
                    <td style={{ padding: '8px 10px', fontWeight: 700, color: '#38bdf8' }}>t={r.step}</td>
                    <td style={{ padding: '8px 10px', color: '#f8fafc' }}>{r.city_a_decision.selected_action_name}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{r.observed_city_a.congestion_pct}%</td>
                    <td style={{ padding: '8px 10px', color: '#f8fafc' }}>{r.city_b_decision.selected_action_name}</td>
                    <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{r.observed_city_b.congestion_pct}%</td>
                    <td style={{ padding: '8px 10px', color: '#a855f7' }}>{r.observed_intercity.volume} veh</td>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.observed_combined.system_congestion_pct}%</td>
                    <td style={{ padding: '8px 10px' }}>{r.observed_combined.avg_travel_time_mins} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Available Actions Reference Drawer */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.85rem' }}>
          <Sliders size={18} color="#38bdf8" />
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
            Action Space Specifications ({status?.available_actions_count || actions.length} Discrete Controls)
          </h4>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.85rem' }}>
          {actions.map((act) => (
            <div key={act.action_type} style={{
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '10px 12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>{act.name}</span>
                <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 600 }}>Cost: {act.operational_cost}</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '4px 0 8px 0', lineHeight: 1.4 }}>
                {act.description}
              </p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {act.capacity_impact_pct !== 0 && (
                  <span style={{ fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 6px', borderRadius: '4px' }}>
                    Capacity +{act.capacity_impact_pct}%
                  </span>
                )}
                {act.demand_impact_pct !== 0 && (
                  <span style={{ fontSize: '0.7rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px' }}>
                    Demand {act.demand_impact_pct}%
                  </span>
                )}
                {act.gateway_inflow_impact_pct !== 0 && (
                  <span style={{ fontSize: '0.7rem', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', padding: '2px 6px', borderRadius: '4px' }}>
                    Gateway {act.gateway_inflow_impact_pct}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
