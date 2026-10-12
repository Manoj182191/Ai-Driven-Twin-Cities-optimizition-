import React, { useState, useEffect, useRef } from 'react';
import {
  type SimulationStateResponse,
  type DemandLevel,
  fetchSimulationState,
  initializeSimulation,
  stepSimulation,
  resetSimulation,
  generateNewScenario
} from '../services/api';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Sparkles,
  Sliders,
  ArrowRightLeft
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area
} from 'recharts';

interface SimulationPageProps {
  onStateUpdate?: (state: SimulationStateResponse) => void;
}

export const SimulationPage: React.FC<SimulationPageProps> = ({ onStateUpdate }) => {
  const [simState, setSimState] = useState<SimulationStateResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [stepping, setStepping] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Configuration Form
  const [seedInput, setSeedInput] = useState<number>(42);
  const [demandLevel, setDemandLevel] = useState<DemandLevel>('normal');
  const timerRef = useRef<number | null>(null);

  const loadCurrentState = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSimulationState();
      setSimState(data);
      setSeedInput(data.seed);
      setDemandLevel(data.demand_level);
      if (onStateUpdate) onStateUpdate(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load simulation state');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentState();
  }, []);

  // Handle single discrete step
  const handleStep = async () => {
    if (stepping) return;
    try {
      setStepping(true);
      const data = await stepSimulation(1);
      setSimState(data);
      if (onStateUpdate) onStateUpdate(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error executing simulation step');
      setIsPlaying(false);
    } finally {
      setStepping(false);
    }
  };

  // Play / Pause auto stepping
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        handleStep();
      }, 1400);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying]);

  // Handle Reset
  const handleReset = async () => {
    setIsPlaying(false);
    try {
      setLoading(true);
      const data = await resetSimulation();
      setSimState(data);
      if (onStateUpdate) onStateUpdate(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error resetting simulation');
    } finally {
      setLoading(false);
    }
  };

  // Handle Initialize with form seed & demand
  const handleInitialize = async () => {
    setIsPlaying(false);
    try {
      setLoading(true);
      const data = await initializeSimulation(seedInput, demandLevel);
      setSimState(data);
      if (onStateUpdate) onStateUpdate(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error initializing simulation');
    } finally {
      setLoading(false);
    }
  };

  // Handle Generate New Random Scenario
  const handleGenerateScenario = async () => {
    setIsPlaying(false);
    try {
      setLoading(true);
      const randomSeed = Math.floor(Math.random() * 89999 + 1000);
      setSeedInput(randomSeed);
      const data = await generateNewScenario(randomSeed, demandLevel);
      setSimState(data);
      if (onStateUpdate) onStateUpdate(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error generating new scenario');
    } finally {
      setLoading(false);
    }
  };

  const getBandBadge = (band: string) => {
    switch (band) {
      case 'Low':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' };
      case 'Medium':
        return { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8', border: 'rgba(56, 189, 248, 0.3)' };
      case 'High':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' };
      case 'Severe':
      default:
        return { bg: 'rgba(244, 63, 94, 0.15)', text: '#fb7185', border: 'rgba(244, 63, 94, 0.3)' };
    }
  };

  if (loading && !simState) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
        <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '1rem' }}>
          <Sliders size={32} color="#38bdf8" />
        </div>
        <div>Loading digital twin simulation state...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Simulation Header & Scenario Controls */}
      <div className="glass-panel-elevated" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '1rem',
          marginBottom: '1rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
                Twin Cities Simulation Engine
              </h2>
              <span style={{
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                border: '1px solid rgba(245, 158, 11, 0.3)'
              }}>
                SYNTHETIC SIMULATED DATA
              </span>
              <span style={{
                background: 'rgba(56, 189, 248, 0.12)',
                color: '#38bdf8',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontFamily: 'monospace'
              }}>
                {simState?.scenario_id}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
              Discrete-step microscopic BPR congestion solver modeling intra-city roads and the intercity corridor.
            </p>
          </div>

          {/* Current Step Counter Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'rgba(0, 0, 0, 0.35)',
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block' }}>SIMULATION STEP</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#00f0ff', fontFamily: 'monospace' }}>
                t = {simState?.simulation_step ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Control Toolbar */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem'
        }}>
          {/* Step Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: isPlaying ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                border: `1px solid ${isPlaying ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                color: isPlaying ? '#fb7185' : '#34d399',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem'
              }}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
              <span>{isPlaying ? 'Pause' : 'Auto-Run'}</span>
            </button>

            <button
              onClick={handleStep}
              disabled={stepping || isPlaying}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                padding: '8px 14px',
                borderRadius: '8px',
                cursor: (stepping || isPlaying) ? 'not-allowed' : 'pointer',
                opacity: (stepping || isPlaying) ? 0.6 : 1,
                fontWeight: 600,
                fontSize: '0.85rem'
              }}
            >
              <SkipForward size={16} />
              <span>Step +1</span>
            </button>

            <button
              onClick={handleReset}
              disabled={loading || isPlaying}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: '#cbd5e1',
                padding: '8px 12px',
                borderRadius: '8px',
                cursor: (loading || isPlaying) ? 'not-allowed' : 'pointer',
                fontSize: '0.85rem'
              }}
            >
              <RotateCcw size={15} />
              <span>Reset</span>
            </button>
          </div>

          {/* Scenario Parameters Form */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Seed:</span>
              <input
                type="number"
                value={seedInput}
                onChange={(e) => setSeedInput(parseInt(e.target.value) || 0)}
                style={{
                  width: '80px',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  color: '#f8fafc',
                  fontSize: '0.82rem',
                  fontFamily: 'monospace'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Demand:</span>
              <select
                value={demandLevel}
                onChange={(e) => setDemandLevel(e.target.value as DemandLevel)}
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  color: '#f8fafc',
                  fontSize: '0.82rem'
                }}
              >
                <option value="low">Low (0.65x)</option>
                <option value="normal">Normal (1.00x)</option>
                <option value="peak">Peak Commute (1.45x)</option>
              </select>
            </div>

            <button
              onClick={handleInitialize}
              disabled={loading || isPlaying}
              style={{
                background: 'rgba(168, 85, 247, 0.15)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                color: '#c084fc',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: (loading || isPlaying) ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              Apply Seed
            </button>

            <button
              onClick={handleGenerateScenario}
              disabled={loading || isPlaying}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(168, 85, 247, 0.2))',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: (loading || isPlaying) ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              <Sparkles size={14} />
              <span>New Scenario</span>
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '6px',
            color: '#fda4af',
            fontSize: '0.82rem'
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Combined System Metrics Bar */}
      {simState && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem'
        }}>
          <div className="glass-panel" style={{ padding: '1rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Combined System Demand</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
              {simState.combined_metrics.total_demand.toLocaleString()} <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>veh/step</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px' }}>
              City A: {simState.city_a.total_demand} | City B: {simState.city_b.total_demand}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>System Congestion</span>
            <div style={{
              fontSize: '1.4rem',
              fontWeight: 700,
              marginTop: '2px',
              color: simState.combined_metrics.system_congestion_pct > 75 ? '#fb7185' : simState.combined_metrics.system_congestion_pct > 50 ? '#fbbf24' : '#34d399'
            }}>
              {simState.combined_metrics.system_congestion_pct}%
            </div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px' }}>
              Network Average (20 roads + IC)
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Total Active Vehicles</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
              {simState.combined_metrics.total_active_vehicles.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: '4px' }}>
              ✓ Strict Vehicle Conservation
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1rem' }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Weighted Avg Travel Time</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
              {simState.combined_metrics.avg_travel_time_mins} <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>mins</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px' }}>
              Total Network Queues: {simState.combined_metrics.total_queues} veh
            </div>
          </div>
        </div>
      )}

      {/* 3-Column Twin Cities Simulation Status */}
      {simState && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: '1.25rem'
        }}>
          {/* City A Panel */}
          <div className="glass-panel-elevated" style={{ gridColumn: 'span 5', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                  DIGITAL TWIN 1
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                  {simState.city_a.name}
                </h3>
              </div>
              {(() => {
                const badge = getBandBadge(simState.city_a.current_congestion > 75 ? 'High' : simState.city_a.current_congestion > 45 ? 'Medium' : 'Low');
                return (
                  <span style={{
                    background: badge.bg,
                    color: badge.text,
                    border: `1px solid ${badge.border}`,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {simState.city_a.current_congestion}% Congestion
                  </span>
                );
              })()}
            </div>

            {/* City A Metric Tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.75rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>DEMAND GENERATION</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                  {simState.city_a.total_demand} <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>veh/step</span>
                </div>
              </div>
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.75rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>AVG TRAVEL TIME</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>
                  {simState.city_a.avg_travel_time} <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>min</span>
                </div>
              </div>
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.75rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>AVG QUEUE LENGTH</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                  {simState.city_a.avg_queue_length} <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>veh</span>
                </div>
              </div>
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.75rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>INFLOW / OUTFLOW</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                  +{simState.city_a.vehicles_entering} / -{simState.city_a.vehicles_leaving}
                </div>
              </div>
            </div>

            {/* City A Road Table Preview */}
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>
              INTERNAL ROAD NETWORK ({simState.city_a.roads.length} Links)
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(0, 0, 0, 0.4)', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>Road</th>
                    <th style={{ padding: '6px 8px' }}>Type</th>
                    <th style={{ padding: '6px 8px' }}>Volume / Cap</th>
                    <th style={{ padding: '6px 8px' }}>Congestion</th>
                    <th style={{ padding: '6px 8px' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {simState.city_a.roads.map((r) => (
                    <tr key={r.road_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 600, color: '#cbd5e1' }}>{r.road_id}</td>
                      <td style={{ padding: '6px 8px', color: '#94a3b8', textTransform: 'capitalize' }}>{r.category}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{r.current_vehicles}/{r.capacity}</td>
                      <td style={{ padding: '6px 8px', color: r.congestion_level > 70 ? '#fb7185' : '#34d399' }}>
                        {r.congestion_level}%
                      </td>
                      <td style={{ padding: '6px 8px', color: '#cbd5e1' }}>{r.travel_time_mins}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Intercity Corridor Panel */}
          <div className="glass-panel-elevated" style={{ gridColumn: 'span 2', padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <ArrowRightLeft size={16} color="#a855f7" />
                <span style={{ fontSize: '0.72rem', color: '#a855f7', fontWeight: 700, textTransform: 'uppercase' }}>
                  INTERCITY
                </span>
              </div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.75rem' }}>
                Expressway Corridor
              </h4>

              <div style={{
                background: 'rgba(0, 0, 0, 0.35)',
                padding: '0.75rem',
                borderRadius: '8px',
                marginBottom: '0.75rem'
              }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b' }}>CROSS-BORDER FLOW</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#a855f7', marginTop: '2px' }}>
                  {simState.intercity_connection.current_volume} <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>veh</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                  Cap: {simState.intercity_connection.capacity} veh/step
                </div>
              </div>

              {/* Utilization Bar */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>Load:</span>
                  <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{simState.intercity_connection.congestion_level}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(100, simState.intercity_connection.congestion_level)}%`,
                    height: '100%',
                    background: simState.intercity_connection.congestion_level > 80 ? '#f43f5e' : 'linear-gradient(90deg, #38bdf8, #a855f7)',
                    borderRadius: '4px'
                  }} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Length:</span>
                  <span style={{ color: '#cbd5e1' }}>{simState.intercity_connection.length_km} km</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Travel Time:</span>
                  <span style={{ color: '#cbd5e1' }}>{simState.intercity_connection.travel_time_mins} min</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Queue:</span>
                  <span style={{ color: simState.intercity_connection.queue_length > 0 ? '#fb7185' : '#34d399' }}>
                    {simState.intercity_connection.queue_length} veh
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
                  <span>Congestion Band:</span>
                  <span style={{ color: '#a855f7', fontWeight: 600 }}>
                    {simState.intercity_connection.congestion_band}
                  </span>
                </div>
              </div>
            </div>

            <div style={{
              background: 'rgba(168, 85, 247, 0.08)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              borderRadius: '6px',
              padding: '6px 8px',
              fontSize: '0.68rem',
              color: '#d8b4fe',
              marginTop: '1rem',
              textAlign: 'center'
            }}>
              A_GATEWAY ↔ B_GATEWAY
            </div>
          </div>

          {/* City B Panel */}
          <div className="glass-panel-elevated" style={{ gridColumn: 'span 5', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
                  DIGITAL TWIN 2
                </span>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
                  {simState.city_b.name}
                </h3>
              </div>
              {(() => {
                const badge = getBandBadge(simState.city_b.current_congestion > 75 ? 'High' : simState.city_b.current_congestion > 45 ? 'Medium' : 'Low');
                return (
                  <span style={{
                    background: badge.bg,
                    color: badge.text,
                    border: `1px solid ${badge.border}`,
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {simState.city_b.current_congestion}% Congestion
                  </span>
                );
              })()}
            </div>

            {/* City B Metric Tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.75rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>DEMAND GENERATION</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                  {simState.city_b.total_demand} <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>veh/step</span>
                </div>
              </div>
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.75rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>AVG TRAVEL TIME</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>
                  {simState.city_b.avg_travel_time} <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>min</span>
                </div>
              </div>
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.75rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>AVG QUEUE LENGTH</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                  {simState.city_b.avg_queue_length} <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>veh</span>
                </div>
              </div>
              <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '0.75rem', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>INFLOW / OUTFLOW</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                  +{simState.city_b.vehicles_entering} / -{simState.city_b.vehicles_leaving}
                </div>
              </div>
            </div>

            {/* City B Road Table Preview */}
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.5rem' }}>
              INTERNAL ROAD NETWORK ({simState.city_b.roads.length} Links)
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(0, 0, 0, 0.4)', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>Road</th>
                    <th style={{ padding: '6px 8px' }}>Type</th>
                    <th style={{ padding: '6px 8px' }}>Volume / Cap</th>
                    <th style={{ padding: '6px 8px' }}>Congestion</th>
                    <th style={{ padding: '6px 8px' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {simState.city_b.roads.map((r) => (
                    <tr key={r.road_id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.03)' }}>
                      <td style={{ padding: '6px 8px', fontWeight: 600, color: '#cbd5e1' }}>{r.road_id}</td>
                      <td style={{ padding: '6px 8px', color: '#94a3b8', textTransform: 'capitalize' }}>{r.category}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{r.current_vehicles}/{r.capacity}</td>
                      <td style={{ padding: '6px 8px', color: r.congestion_level > 70 ? '#fb7185' : '#34d399' }}>
                        {r.congestion_level}%
                      </td>
                      <td style={{ padding: '6px 8px', color: '#cbd5e1' }}>{r.travel_time_mins}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Telemetry Charts (Actual backend simulation history) */}
      {simState && simState.history && simState.history.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '1.25rem'
        }}>
          {/* Chart 1: Traffic Demand Over Time */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.25rem' }}>
              Traffic Demand Over Time
            </h4>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Diurnal synthetic commuter demand curves for City A and City B.
            </p>
            <div style={{ height: '230px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={simState.history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis dataKey="step" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#0e1526', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                    labelStyle={{ color: '#38bdf8', fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="city_a_demand" name="City A Demand" stroke="#38bdf8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="city_b_demand" name="City B Demand" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Congestion Levels Over Time */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.25rem' }}>
              Congestion Levels Over Time (%)
            </h4>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Network congestion percentages comparing individual cities and joint system.
            </p>
            <div style={{ height: '230px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={simState.history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis dataKey="step" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} stroke="#64748b" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#0e1526', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                    labelStyle={{ color: '#38bdf8', fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="city_a_congestion" name="City A Congestion %" stroke="#38bdf8" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="city_b_congestion" name="City B Congestion %" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="combined_congestion" name="System Congestion %" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Intercity Traffic & Queues */}
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.25rem' }}>
              Intercity Expressway Volume & Travel Time
            </h4>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem' }}>
              Cross-border transit load and calculated BPR travel time.
            </p>
            <div style={{ height: '230px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={simState.history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis dataKey="step" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#0e1526', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}
                    labelStyle={{ color: '#a855f7', fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="intercity_volume" name="Intercity Volume (veh)" stroke="#a855f7" fill="rgba(168, 85, 247, 0.2)" strokeWidth={2} />
                  <Line type="monotone" dataKey="intercity_congestion" name="IC Congestion %" stroke="#f43f5e" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
