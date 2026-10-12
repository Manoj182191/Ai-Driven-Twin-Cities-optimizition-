import React, { useState, useEffect } from 'react';
import {
  fetchHeadToHeadComparison,
  runCoordinatedOptimization,
  fetchCoordinatedStatus,
  type HeadToHeadComparisonResponse,
  type CoordinatedRunResponse,
  type CoordinatedStatusResponse,
  type DemandLevel
} from '../../services/api';
import {
  Play,
  AlertTriangle,
  Clock,
  ShieldCheck,
  GitCompare
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

export const CoordinatedOptimizationPage: React.FC = () => {
  const [comparison, setComparison] = useState<HeadToHeadComparisonResponse | null>(null);
  const [status, setStatus] = useState<CoordinatedStatusResponse | null>(null);
  const [coordRun, setCoordRun] = useState<CoordinatedRunResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [benchmarking, setBenchmarking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form controls
  const [seed, setSeed] = useState<number>(42);
  const [demandLevel, setDemandLevel] = useState<DemandLevel>('normal');
  const [steps, setSteps] = useState<number>(24);
  const [inspectStepIndex, setInspectStepIndex] = useState<number>(0);
  const [activeChartMetric, setActiveChartMetric] = useState<'congestion' | 'travel_time' | 'queues'>('congestion');

  const loadData = async (targetSeed = seed, targetDemand = demandLevel, targetSteps = steps) => {
    setLoading(true);
    setError(null);
    try {
      const [statRes, cmpRes, coordRes] = await Promise.all([
        fetchCoordinatedStatus(),
        fetchHeadToHeadComparison(targetSeed, targetDemand, targetSteps),
        runCoordinatedOptimization({ seed: targetSeed, demand_level: targetDemand, steps: targetSteps })
      ]);
      setStatus(statRes);
      setComparison(cmpRes);
      setCoordRun(coordRes);
      setInspectStepIndex(0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load coordinated optimization data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRunBenchmark = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setBenchmarking(true);
    setError(null);
    try {
      const cmpRes = await fetchHeadToHeadComparison(seed, demandLevel, steps);
      const coordRes = await runCoordinatedOptimization({ seed, demand_level: demandLevel, steps });
      setComparison(cmpRes);
      setCoordRun(coordRes);
      setInspectStepIndex(0);
      const statRes = await fetchCoordinatedStatus();
      setStatus(statRes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Benchmark execution failed');
    } finally {
      setBenchmarking(false);
    }
  };

  const currentStep = coordRun?.step_records?.[inspectStepIndex] || coordRun?.step_records?.[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Top Banner & Control Bar */}
      <div className="glass-panel" style={{
        padding: '1.25rem 1.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        borderLeft: '4px solid #10b981'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #10b981, #06b6d4)',
            padding: '10px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(16, 185, 129, 0.35)'
          }}>
            <GitCompare size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                background: '#10b981',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase'
              }}>
                Phase 6 Active
              </span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                Joint Coordinated Optimization vs. Independent Baseline
              </h2>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '2px' }}>
              Exhaustive 25-pair joint search coordinating City A and City B with intercity corridor awareness.
            </p>
            {status && (
              <div style={{
                marginTop: '4px',
                fontSize: '0.72rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: status.ai_prediction_ready ? '#34d399' : '#fbbf24'
              }}>
                <span>● AI Engine: {status.ai_prediction_ready ? 'Trained RF Forecaster Active' : 'Physics Simulation Fallback'}</span>
                <span style={{ color: '#64748b' }}>•</span>
                <span style={{ color: '#94a3b8' }}>Search Space: {status.available_pairs_count} Action Pairs</span>
              </div>
            )}
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

          <button
            onClick={() => handleRunBenchmark()}
            disabled={benchmarking || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#059669',
              color: '#ffffff',
              border: 'none',
              padding: '7px 16px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: benchmarking ? 'not-allowed' : 'pointer',
              boxShadow: '0 0 10px rgba(16, 185, 129, 0.3)'
            }}
          >
            <Play size={14} />
            <span>{benchmarking ? 'Running Head-to-Head...' : 'Run Head-to-Head Benchmark'}</span>
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

      {/* Summary Narrative Banner */}
      {comparison && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: '10px',
          padding: '0.9rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <ShieldCheck size={22} color="#10b981" />
          <div style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.4 }}>
            <strong style={{ color: '#f8fafc' }}>Benchmark Finding: </strong>
            {comparison.coordination_gain_summary}
          </div>
        </div>
      )}

      {/* 4 Head-to-Head KPI Comparison Cards */}
      {comparison && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem'
        }}>
          {comparison.comparison_metrics.map((m) => {
            const hasImp = m.improvement_pct !== null && m.improvement_pct !== undefined;
            const isPositive = hasImp && m.improvement_pct! > 0;
            return (
              <div key={m.metric_name} className="glass-panel" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
                    {m.metric_name}
                  </span>
                  {hasImp && (
                    <span style={{
                      fontSize: '0.72rem',
                      color: isPositive ? '#10b981' : (m.improvement_pct! < 0 ? '#f43f5e' : '#94a3b8'),
                      background: isPositive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 700
                    }}>
                      {isPositive ? '▼ ' : '▲ '}
                      {Math.abs(m.improvement_pct!)}% {isPositive ? 'Gain' : 'Loss'}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '0.5rem 0' }}>
                  <span style={{ fontSize: '1.85rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
                    {m.coordinated_value}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    {m.unit} (Coordinated)
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '6px',
                  fontSize: '0.78rem'
                }}>
                  <span style={{ color: '#64748b' }}>Phase 5 Baseline:</span>
                  <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
                    {m.baseline_value} {m.unit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Step Inspector Controls */}
      {coordRun && coordRun.step_records.length > 0 && (
        <div className="glass-panel" style={{ padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="#10b981" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
              Inspect Coordinated Decisions at Step:
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflowX: 'auto', maxWidth: '100%' }}>
            {coordRun.step_records.map((rec, idx) => (
              <button
                key={rec.step}
                onClick={() => setInspectStepIndex(idx)}
                style={{
                  background: inspectStepIndex === idx ? '#059669' : 'rgba(255, 255, 255, 0.05)',
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

      {/* Active Step Decision Breakdown & 25-Pairs Evaluation Card */}
      {currentStep && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '1.25rem'
        }}>
          {/* Card 1: Selected Optimal Action Pair */}
          <div className="glass-panel-elevated" style={{ padding: '1.25rem', borderTop: '3px solid #10b981' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                  Joint Action Pair Selected at Step t={currentStep.step}
                </span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                  Coordinated Dual-City Deployment
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
                Cost: {currentStep.joint_decision.total_combined_cost.toFixed(4)}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '10px', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>City A Action:</span>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                  {currentStep.joint_decision.selected_action_a_name}
                </div>
              </div>
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '10px', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>City B Action:</span>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                  {currentStep.joint_decision.selected_action_b_name}
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '1rem', background: 'rgba(0,0,0,0.25)', padding: '10px 12px', borderRadius: '8px' }}>
              {currentStep.joint_decision.explanation}
            </p>

            {/* Combined Cost Breakdown */}
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                Combined Multi-Criteria Objective Breakdown (5 Components):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', textAlign: 'center', fontSize: '0.7rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px' }}>
                  <div style={{ color: '#64748b' }}>Travel Time</div>
                  <div style={{ color: '#cbd5e1', fontWeight: 700 }}>{currentStep.joint_decision.cost_breakdown.travel_time_cost}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px' }}>
                  <div style={{ color: '#64748b' }}>Congestion</div>
                  <div style={{ color: '#cbd5e1', fontWeight: 700 }}>{currentStep.joint_decision.cost_breakdown.congestion_cost}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px' }}>
                  <div style={{ color: '#64748b' }}>Queues</div>
                  <div style={{ color: '#cbd5e1', fontWeight: 700 }}>{currentStep.joint_decision.cost_breakdown.queue_cost}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px' }}>
                  <div style={{ color: '#64748b' }}>Corridor</div>
                  <div style={{ color: '#cbd5e1', fontWeight: 700 }}>{currentStep.joint_decision.cost_breakdown.intercity_cost}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '6px' }}>
                  <div style={{ color: '#64748b' }}>Cost</div>
                  <div style={{ color: '#cbd5e1', fontWeight: 700 }}>{currentStep.joint_decision.cost_breakdown.resource_cost}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: 25 Exhaustive Candidate Search Inspector */}
          <div className="glass-panel-elevated" style={{ padding: '1.25rem', borderTop: '3px solid #06b6d4' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#06b6d4', fontWeight: 700, textTransform: 'uppercase' }}>
                  Search Space Evaluation
                </span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                  25 Joint Candidate Pairs Evaluated
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ fontSize: '0.72rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  {currentStep.joint_decision.feasible_pairs_count} Feasible
                </span>
                {currentStep.joint_decision.rejected_pairs_count > 0 && (
                  <span style={{ fontSize: '0.72rem', background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', padding: '3px 8px', borderRadius: '4px', fontWeight: 600 }}>
                    {currentStep.joint_decision.rejected_pairs_count} Rejected
                  </span>
                )}
              </div>
            </div>

            <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.85rem' }}>
              Exhaustive sandbox simulation evaluates dual-city flow dynamics and shared corridor delays across all 25 permutations:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
              {currentStep.joint_decision.all_evaluated_pairs.map((cand) => {
                const isSelected = cand.action_a === currentStep.joint_decision.selected_action_a && cand.action_b === currentStep.joint_decision.selected_action_b;
                return (
                  <div
                    key={cand.pair_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 0, 0, 0.25)',
                      border: isSelected ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255, 255, 255, 0.04)',
                      borderRadius: '6px',
                      fontSize: '0.74rem'
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: isSelected ? 700 : 500, color: cand.is_feasible ? '#f8fafc' : '#f43f5e' }}>
                        {cand.action_a_name} + {cand.action_b_name}
                      </span>
                      {!cand.is_feasible && (
                        <div style={{ fontSize: '0.68rem', color: '#f43f5e' }}>{cand.rejection_reason}</div>
                      )}
                    </div>
                    <span style={{ fontWeight: 700, color: isSelected ? '#10b981' : '#38bdf8', fontFamily: 'monospace' }}>
                      Cost: {cand.total_combined_cost.toFixed(4)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Trajectory Comparison Charts */}
      {comparison && comparison.per_step_comparison.length > 0 && (
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
                Trajectory Comparison: Independent Baseline vs. Joint Coordinated
              </h3>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                Solid lines show Joint Coordinated optimization; dashed lines show Phase 5 Independent Baseline.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '6px', background: 'rgba(0, 0, 0, 0.35)', padding: '3px', borderRadius: '8px' }}>
              <button
                onClick={() => setActiveChartMetric('congestion')}
                style={{
                  background: activeChartMetric === 'congestion' ? '#10b981' : 'transparent',
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
                  background: activeChartMetric === 'travel_time' ? '#10b981' : 'transparent',
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
                onClick={() => setActiveChartMetric('queues')}
                style={{
                  background: activeChartMetric === 'queues' ? '#10b981' : 'transparent',
                  color: activeChartMetric === 'queues' ? '#fff' : '#94a3b8',
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Queues (veh)
              </button>
            </div>
          </div>

          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparison.per_step_comparison} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
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
                    <Line type="monotone" dataKey="baseline_congestion" name="Phase 5 Independent Baseline Congestion (%)" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="coordinated_congestion" name="Phase 6 Joint Coordinated Congestion (%)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                  </>
                )}

                {activeChartMetric === 'travel_time' && (
                  <>
                    <Line type="monotone" dataKey="baseline_travel_time" name="Phase 5 Baseline Travel Time (min)" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="coordinated_travel_time" name="Phase 6 Coordinated Travel Time (min)" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 3 }} />
                  </>
                )}

                {activeChartMetric === 'queues' && (
                  <>
                    <Line type="monotone" dataKey="baseline_queues" name="Phase 5 Baseline Total Queues (veh)" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="coordinated_queues" name="Phase 6 Coordinated Queues (veh)" stroke="#a855f7" strokeWidth={2.5} dot={{ r: 3 }} />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Head-to-Head Step Audit Log Table */}
      {comparison && (
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                Head-to-Head Step Decision Audit Log
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Side-by-side comparison of actions and congestion outcomes for every step.
              </p>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Comparison ID: {comparison.comparison_id}
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: '#94a3b8' }}>
                  <th style={{ padding: '8px 10px' }}>Step</th>
                  <th style={{ padding: '8px 10px' }}>Baseline (City A / City B)</th>
                  <th style={{ padding: '8px 10px' }}>Baseline Congestion</th>
                  <th style={{ padding: '8px 10px' }}>Coordinated (City A / City B)</th>
                  <th style={{ padding: '8px 10px' }}>Coordinated Congestion</th>
                  <th style={{ padding: '8px 10px' }}>Travel Time Diff</th>
                </tr>
              </thead>
              <tbody>
                {comparison.per_step_comparison.map((r, i) => {
                  const ttDiff = r.baseline_travel_time - r.coordinated_travel_time;
                  return (
                    <tr
                      key={r.step}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#10b981' }}>t={r.step}</td>
                      <td style={{ padding: '8px 10px', color: '#cbd5e1' }}>
                        {r.action_a_independent} / {r.action_b_independent}
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace' }}>{r.baseline_congestion}%</td>
                      <td style={{ padding: '8px 10px', color: '#f8fafc', fontWeight: 600 }}>
                        {r.action_a_coordinated} / {r.action_b_coordinated}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#10b981', fontWeight: 700, fontFamily: 'monospace' }}>
                        {r.coordinated_congestion}%
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          color: ttDiff >= 0 ? '#10b981' : '#f43f5e',
                          fontWeight: 600
                        }}>
                          {ttDiff >= 0 ? `-${ttDiff.toFixed(2)}m` : `+${Math.abs(ttDiff).toFixed(2)}m`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
