import React, { useState, useEffect } from 'react';
import {
  fetchAIStatus,
  trainAIModel,
  fetchAIPrediction,
  fetchAIEvaluation,
  fetchAIHistory,
  stepSimulation,
  type ModelStatusResponse,
  type PredictResponse,
  type EvaluationComparison,
  type AIHistoryPoint,
  type SimulationStateResponse
} from '../services/api';
import {
  BrainCircuit,
  Activity,
  Layers,
  AlertTriangle,
  Play,
  RotateCw,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Zap,
  RefreshCw
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

interface AIPredictionsPageProps {
  onStateUpdate?: (state: SimulationStateResponse) => void;
}

export const AIPredictionsPage: React.FC<AIPredictionsPageProps> = ({ onStateUpdate }) => {
  const [status, setStatus] = useState<ModelStatusResponse | null>(null);
  const [prediction, setPrediction] = useState<PredictResponse | null>(null);
  const [evaluations, setEvaluations] = useState<EvaluationComparison[]>([]);
  const [historyData, setHistoryData] = useState<AIHistoryPoint[]>([]);
  const [horizon, setHorizon] = useState<number>(3);
  const [loading, setLoading] = useState<boolean>(true);
  const [predicting, setPredicting] = useState<boolean>(false);
  const [training, setTraining] = useState<boolean>(false);
  const [stepping, setStepping] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<'demand' | 'congestion'>('congestion');
  const [showTrainModal, setShowTrainModal] = useState<boolean>(false);

  // Train form state
  const [trainHorizon, setTrainHorizon] = useState<number>(3);
  const [trainScenarios, setTrainScenarios] = useState<number>(5);
  const [trainSteps, setTrainSteps] = useState<number>(36);
  const [trainSeed, setTrainSeed] = useState<number>(42);

  const loadData = async (targetHorizon?: number) => {
    setLoading(true);
    setError(null);
    try {
      const h = targetHorizon ?? horizon;
      const [statusRes, predRes, evalRes, histRes] = await Promise.all([
        fetchAIStatus(),
        fetchAIPrediction(h),
        fetchAIEvaluation(),
        fetchAIHistory()
      ]);

      setStatus(statusRes);
      setPrediction(predRes);
      setEvaluations(evalRes);
      setHistoryData(histRes.history);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load AI prediction data');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(horizon);
  }, [horizon]);

  const handleHorizonChange = async (newHorizon: number) => {
    setHorizon(newHorizon);
  };

  const handleRunPrediction = async () => {
    setPredicting(true);
    setError(null);
    try {
      const predRes = await fetchAIPrediction(horizon);
      const histRes = await fetchAIHistory();
      setPrediction(predRes);
      setHistoryData(histRes.history);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Prediction error');
    } finally {
      setPredicting(false);
    }
  };

  const handleStepAndPredict = async () => {
    setStepping(true);
    setError(null);
    try {
      const stepRes = await stepSimulation(1);
      if (onStateUpdate) {
        onStateUpdate(stepRes);
      }
      const predRes = await fetchAIPrediction(horizon);
      const histRes = await fetchAIHistory();
      setPrediction(predRes);
      setHistoryData(histRes.history);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Step & Predict error');
    } finally {
      setStepping(false);
    }
  };

  const handleTrainModel = async (e: React.FormEvent) => {
    e.preventDefault();
    setTraining(true);
    setError(null);
    try {
      const trainRes = await trainAIModel({
        prediction_horizon: trainHorizon,
        num_train_scenarios: trainScenarios,
        steps_per_scenario: trainSteps,
        random_seed: trainSeed
      });

      setStatus(trainRes.status);
      setEvaluations(trainRes.evaluations);
      setHorizon(trainHorizon);
      setShowTrainModal(false);

      // Re-fetch predictions
      const predRes = await fetchAIPrediction(trainHorizon);
      const histRes = await fetchAIHistory();
      setPrediction(predRes);
      setHistoryData(histRes.history);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Training failed');
    } finally {
      setTraining(false);
    }
  };

  const getDeltaBadge = (current: number, predicted: number, isPercent: boolean = false) => {
    const diff = predicted - current;
    const isIncrease = diff > 0.05;
    const isDecrease = diff < -0.05;
    const formatted = isPercent
      ? `${Math.abs(diff).toFixed(1)}%`
      : `${Math.abs(diff).toFixed(0)} veh`;

    if (!isIncrease && !isDecrease) {
      return (
        <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '4px' }}>
          Stable (±0)
        </span>
      );
    }

    const color = isIncrease ? '#f43f5e' : '#10b981';
    const bg = isIncrease ? 'rgba(244, 63, 94, 0.15)' : 'rgba(16, 185, 129, 0.15)';
    const Icon = isIncrease ? ArrowUpRight : ArrowDownRight;

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        fontSize: '0.75rem',
        color,
        background: bg,
        padding: '2px 8px',
        borderRadius: '4px',
        fontWeight: 600
      }}>
        <Icon size={13} />
        {isIncrease ? `+${formatted}` : `-${formatted}`}
      </span>
    );
  };

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
        borderLeft: '4px solid #a855f7'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #a855f7, #6366f1)',
            padding: '10px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(168, 85, 247, 0.35)'
          }}>
            <BrainCircuit size={22} color="#ffffff" />
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
                Phase 4 Complete
              </span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                AI-Driven Traffic Demand & Congestion Forecaster
              </h2>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '2px' }}>
              Multi-step Random Forest Regressor predicting future load at t+{horizon} steps vs. Persistence Baseline.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Horizon Selector */}
          <div style={{
            display: 'flex',
            background: 'rgba(0, 0, 0, 0.4)',
            padding: '3px',
            borderRadius: '8px',
            border: '1px solid var(--border-subtle)'
          }}>
            {[1, 3, 6].map((h) => (
              <button
                key={h}
                onClick={() => handleHorizonChange(h)}
                style={{
                  background: horizon === h ? '#7c3aed' : 'transparent',
                  color: horizon === h ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: horizon === h ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                t+{h} Steps
              </button>
            ))}
          </div>

          {/* Refresh Forecast Button */}
          <button
            onClick={handleRunPrediction}
            disabled={predicting || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              color: '#38bdf8',
              padding: '7px 12px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: predicting ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={14} className={predicting ? 'animate-spin' : ''} />
            <span>{predicting ? 'Forecasting...' : 'Refresh'}</span>
          </button>

          {/* Step & Predict Button */}
          <button
            onClick={handleStepAndPredict}
            disabled={stepping || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: stepping ? 'not-allowed' : 'pointer'
            }}
          >
            <Play size={14} />
            <span>{stepping ? 'Advancing...' : 'Step & Forecast'}</span>
          </button>

          {/* Retrain Button */}
          <button
            onClick={() => setShowTrainModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(168, 85, 247, 0.15)',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              color: '#c084fc',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RotateCw size={14} />
            <span>Retrain Model</span>
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

      {/* Model State Pill Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '0.85rem'
      }}>
        <div className="glass-panel" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '8px', borderRadius: '8px' }}>
            <ShieldCheck size={18} color="#10b981" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Model Status</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#34d399' }}>
              {status?.is_trained ? 'Trained & Operational' : 'Ready'}
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '8px', borderRadius: '8px' }}>
            <Clock size={18} color="#38bdf8" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Current Horizon</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
              t+{prediction?.horizon_steps ?? horizon} (Target t={prediction?.target_step ?? (prediction?.current_step ?? 0) + horizon})
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'rgba(168, 85, 247, 0.15)', padding: '8px', borderRadius: '8px' }}>
            <Layers size={18} color="#c084fc" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Training Set</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
              {status?.train_samples ?? 0} samples ({status?.test_samples ?? 0} test)
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '8px', borderRadius: '8px' }}>
            <Zap size={18} color="#f59e0b" />
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Current Step</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fbbf24' }}>
              t={prediction?.current_step ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Multi-Target Forecast Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.25rem'
      }}>
        {/* Target 1: City A Congestion */}
        {prediction?.predictions?.city_a_congestion && (
          <div className="glass-panel-elevated" style={{
            padding: '1.25rem',
            borderTop: '3px solid #38bdf8',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                  City A (Metro Alpha)
                </span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                  Congestion Forecast
                </h3>
              </div>
              {getDeltaBadge(
                prediction.predictions.city_a_congestion.current_value,
                prediction.predictions.city_a_congestion.predicted_value,
                true
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '1rem 0 0.5rem 0' }}>
              <span style={{ fontSize: '2.1rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
                {prediction.predictions.city_a_congestion.predicted_value.toFixed(1)}%
              </span>
              <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                at step t={prediction.target_step}
              </span>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '10px 12px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              fontSize: '0.78rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Current Observed (t={prediction.current_step}):</span>
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
                  {prediction.predictions.city_a_congestion.current_value.toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Persistence Baseline:</span>
                <span style={{ color: '#94a3b8' }}>
                  {prediction.predictions.city_a_congestion.persistence_baseline.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Target 2: City A Demand */}
        {prediction?.predictions?.city_a_demand && (
          <div className="glass-panel-elevated" style={{
            padding: '1.25rem',
            borderTop: '3px solid #0ea5e9'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#0ea5e9', fontWeight: 700, textTransform: 'uppercase' }}>
                  City A (Metro Alpha)
                </span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                  Traffic Demand Forecast
                </h3>
              </div>
              {getDeltaBadge(
                prediction.predictions.city_a_demand.current_value,
                prediction.predictions.city_a_demand.predicted_value,
                false
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '1rem 0 0.5rem 0' }}>
              <span style={{ fontSize: '2.1rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
                {Math.round(prediction.predictions.city_a_demand.predicted_value)}
              </span>
              <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>veh/step</span>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '10px 12px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              fontSize: '0.78rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Current Observed (t={prediction.current_step}):</span>
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
                  {Math.round(prediction.predictions.city_a_demand.current_value)} veh/step
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Persistence Baseline:</span>
                <span style={{ color: '#94a3b8' }}>
                  {Math.round(prediction.predictions.city_a_demand.persistence_baseline)} veh/step
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Target 3: City B Congestion */}
        {prediction?.predictions?.city_b_congestion && (
          <div className="glass-panel-elevated" style={{
            padding: '1.25rem',
            borderTop: '3px solid #10b981'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                  City B (Metro Beta)
                </span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                  Congestion Forecast
                </h3>
              </div>
              {getDeltaBadge(
                prediction.predictions.city_b_congestion.current_value,
                prediction.predictions.city_b_congestion.predicted_value,
                true
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '1rem 0 0.5rem 0' }}>
              <span style={{ fontSize: '2.1rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
                {prediction.predictions.city_b_congestion.predicted_value.toFixed(1)}%
              </span>
              <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                at step t={prediction.target_step}
              </span>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '10px 12px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              fontSize: '0.78rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Current Observed (t={prediction.current_step}):</span>
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
                  {prediction.predictions.city_b_congestion.current_value.toFixed(1)}%
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Persistence Baseline:</span>
                <span style={{ color: '#94a3b8' }}>
                  {prediction.predictions.city_b_congestion.persistence_baseline.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Target 4: City B Demand */}
        {prediction?.predictions?.city_b_demand && (
          <div className="glass-panel-elevated" style={{
            padding: '1.25rem',
            borderTop: '3px solid #059669'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>
                  City B (Metro Beta)
                </span>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                  Traffic Demand Forecast
                </h3>
              </div>
              {getDeltaBadge(
                prediction.predictions.city_b_demand.current_value,
                prediction.predictions.city_b_demand.predicted_value,
                false
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '1rem 0 0.5rem 0' }}>
              <span style={{ fontSize: '2.1rem', fontWeight: 800, color: '#f8fafc', fontFamily: 'monospace' }}>
                {Math.round(prediction.predictions.city_b_demand.predicted_value)}
              </span>
              <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>veh/step</span>
            </div>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '10px 12px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              fontSize: '0.78rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Current Observed (t={prediction.current_step}):</span>
                <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
                  {Math.round(prediction.predictions.city_b_demand.current_value)} veh/step
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Persistence Baseline:</span>
                <span style={{ color: '#94a3b8' }}>
                  {Math.round(prediction.predictions.city_b_demand.persistence_baseline)} veh/step
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trajectory Time Series Chart */}
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
              Observed vs. AI Forecast Trajectories
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              Solid lines reflect actual observed digital twin states; dashed segments show Random Forest predictions.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '6px', background: 'rgba(0, 0, 0, 0.35)', padding: '3px', borderRadius: '8px' }}>
            <button
              onClick={() => setActiveChartTab('congestion')}
              style={{
                background: activeChartTab === 'congestion' ? '#0ea5e9' : 'transparent',
                color: activeChartTab === 'congestion' ? '#fff' : '#94a3b8',
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
              onClick={() => setActiveChartTab('demand')}
              style={{
                background: activeChartTab === 'demand' ? '#0ea5e9' : 'transparent',
                color: activeChartTab === 'demand' ? '#fff' : '#94a3b8',
                border: 'none',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Demand (veh/step)
            </button>
          </div>
        </div>

        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.07)" />
              <XAxis
                dataKey="step"
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                label={{ value: 'Simulation Step (t)', position: 'insideBottomRight', offset: -5, fill: '#64748b', fontSize: 11 }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 11 }}
                unit={activeChartTab === 'congestion' ? '%' : ''}
              />
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

              {activeChartTab === 'congestion' ? (
                <>
                  <Line
                    type="monotone"
                    dataKey="actual_congestion_a"
                    name="City A Actual Congestion"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="predicted_congestion_a"
                    name={`City A Forecast (t+${horizon})`}
                    stroke="#0284c7"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 4, stroke: '#38bdf8' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual_congestion_b"
                    name="City B Actual Congestion"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="predicted_congestion_b"
                    name={`City B Forecast (t+${horizon})`}
                    stroke="#059669"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 4, stroke: '#10b981' }}
                  />
                </>
              ) : (
                <>
                  <Line
                    type="monotone"
                    dataKey="actual_demand_a"
                    name="City A Actual Demand"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="predicted_demand_a"
                    name={`City A Demand Forecast (t+${horizon})`}
                    stroke="#0284c7"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 4, stroke: '#38bdf8' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual_demand_b"
                    name="City B Actual Demand"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="predicted_demand_b"
                    name={`City B Demand Forecast (t+${horizon})`}
                    stroke="#059669"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 4, stroke: '#10b981' }}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Model Evaluation & Benchmark Comparison Table */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
              Rigorous Evaluation vs. Persistence Baseline
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              Evaluated on strictly unseen held-out test scenarios with seed separation to prevent data leakage.
            </p>
          </div>
          <span style={{
            fontSize: '0.75rem',
            background: 'rgba(56, 189, 248, 0.1)',
            color: '#38bdf8',
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid rgba(56, 189, 248, 0.25)'
          }}>
            Held-out Test Scenarios: 2 (Unseen)
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left', color: '#94a3b8' }}>
                <th style={{ padding: '10px 12px' }}>Target Variable</th>
                <th style={{ padding: '10px 12px' }}>Random Forest MAE</th>
                <th style={{ padding: '10px 12px' }}>Persistence MAE</th>
                <th style={{ padding: '10px 12px' }}>MAE Improvement</th>
                <th style={{ padding: '10px 12px' }}>Random Forest RMSE</th>
                <th style={{ padding: '10px 12px' }}>Persistence RMSE</th>
                <th style={{ padding: '10px 12px' }}>RMSE Improvement</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((ev, i) => (
                <tr
                  key={ev.target}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    background: i % 2 === 0 ? 'rgba(255, 255, 255, 0.015)' : 'transparent'
                  }}
                >
                  <td style={{ padding: '12px', fontWeight: 600, color: '#f1f5f9' }}>
                    {ev.target_label} <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({ev.unit})</span>
                  </td>
                  <td style={{ padding: '12px', color: '#38bdf8', fontWeight: 600, fontFamily: 'monospace' }}>
                    {ev.rf_metrics.mae.toFixed(2)}
                  </td>
                  <td style={{ padding: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>
                    {ev.persistence_metrics.mae.toFixed(2)}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      color: ev.mae_improvement_pct >= 0 ? '#10b981' : '#f43f5e',
                      background: ev.mae_improvement_pct >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      fontSize: '0.78rem'
                    }}>
                      {ev.mae_improvement_pct >= 0 ? `+${ev.mae_improvement_pct}%` : `${ev.mae_improvement_pct}%`}
                    </span>
                  </td>
                  <td style={{ padding: '12px', color: '#38bdf8', fontWeight: 600, fontFamily: 'monospace' }}>
                    {ev.rf_metrics.rmse.toFixed(2)}
                  </td>
                  <td style={{ padding: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>
                    {ev.persistence_metrics.rmse.toFixed(2)}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      color: ev.rmse_improvement_pct >= 0 ? '#10b981' : '#f43f5e',
                      background: ev.rmse_improvement_pct >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontWeight: 700,
                      fontSize: '0.78rem'
                    }}>
                      {ev.rmse_improvement_pct >= 0 ? `+${ev.rmse_improvement_pct}%` : `${ev.rmse_improvement_pct}%`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Feature Engineering & Model Architecture Notes */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.25rem'
      }}>
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
            <Activity size={18} color="#38bdf8" />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
              Feature Engineering Vectors (19 Features)
            </h4>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5, marginBottom: '0.85rem' }}>
            The predictor captures cyclical demand harmonics, lag dynamics, and cross-boundary corridor effects:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {[
              'time_sin (Diurnal)',
              'time_cos (Diurnal)',
              'demand_a (t)',
              'congestion_a (t)',
              'travel_time_a',
              'queue_a',
              'demand_b (t)',
              'congestion_b (t)',
              'travel_time_b',
              'queue_b',
              'ic_volume',
              'ic_congestion',
              'demand_level_code',
              'demand_a_lag1',
              'congestion_a_lag1',
              'demand_b_lag1',
              'congestion_b_lag1'
            ].map((f) => (
              <span key={f} style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#cbd5e1',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.72rem',
                fontFamily: 'monospace'
              }}>
                {f}
              </span>
            ))}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
            <ShieldCheck size={18} color="#a855f7" />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
              Simulation & Model Separation Principles
            </h4>
          </div>
          <ul style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.6, paddingLeft: '1.2rem' }}>
            <li>
              <strong style={{ color: '#f1f5f9' }}>Anti-Leakage Seed Partitioning:</strong> Test scenarios utilize independent random seeds never touched during training.
            </li>
            <li>
              <strong style={{ color: '#f1f5f9' }}>Real-time Replay Cache:</strong> Historical steps retain predictions made at step $t$ so retrospective accuracy is verifiable.
            </li>
            <li>
              <strong style={{ color: '#f1f5f9' }}>Decoupled Decision Layer:</strong> Predictions serve as proactive inputs to Phase 5 Joint Optimization without feedback contamination.
            </li>
          </ul>
        </div>
      </div>

      {/* Retrain Modal */}
      {showTrainModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1rem'
        }}>
          <div className="glass-panel-elevated" style={{
            width: '100%',
            maxWidth: '480px',
            padding: '1.75rem',
            borderRadius: '16px',
            border: '1px solid rgba(168, 85, 247, 0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BrainCircuit size={20} color="#c084fc" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                  Retrain AI Predictor
                </h3>
              </div>
              <button
                onClick={() => setShowTrainModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '1.2rem',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleTrainModel} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Prediction Horizon (Steps Ahead)
                </label>
                <select
                  value={trainHorizon}
                  onChange={(e) => setTrainHorizon(Number(e.target.value))}
                  style={{
                    width: '100%',
                    background: '#070a13',
                    border: '1px solid var(--border-subtle)',
                    color: '#f8fafc',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value={1}>1 Step Ahead (Short-range)</option>
                  <option value={2}>2 Steps Ahead</option>
                  <option value={3}>3 Steps Ahead (Standard default)</option>
                  <option value={4}>4 Steps Ahead</option>
                  <option value={6}>6 Steps Ahead (Quarter day)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Number of Training Scenarios (Independent Seeds)
                </label>
                <input
                  type="number"
                  min={2}
                  max={8}
                  value={trainScenarios}
                  onChange={(e) => setTrainScenarios(Number(e.target.value))}
                  style={{
                    width: '100%',
                    background: '#070a13',
                    border: '1px solid var(--border-subtle)',
                    color: '#f8fafc',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Steps per Scenario Run
                </label>
                <input
                  type="number"
                  min={20}
                  max={48}
                  value={trainSteps}
                  onChange={(e) => setTrainSteps(Number(e.target.value))}
                  style={{
                    width: '100%',
                    background: '#070a13',
                    border: '1px solid var(--border-subtle)',
                    color: '#f8fafc',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'block', marginBottom: '4px' }}>
                  Random Seed
                </label>
                <input
                  type="number"
                  value={trainSeed}
                  onChange={(e) => setTrainSeed(Number(e.target.value))}
                  style={{
                    width: '100%',
                    background: '#070a13',
                    border: '1px solid var(--border-subtle)',
                    color: '#f8fafc',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowTrainModal(false)}
                  style={{
                    flex: 1,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid var(--border-subtle)',
                    color: '#cbd5e1',
                    padding: '9px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={training}
                  style={{
                    flex: 1,
                    background: '#7c3aed',
                    border: 'none',
                    color: '#ffffff',
                    padding: '9px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: training ? 'not-allowed' : 'pointer'
                  }}
                >
                  {training ? 'Training Ensemble...' : 'Start Training'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
