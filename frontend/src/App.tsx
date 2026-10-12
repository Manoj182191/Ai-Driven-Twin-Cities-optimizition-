import React, { useState, useEffect } from 'react';
import { 
  fetchHealth, 
  fetchSystemStatus, 
  fetchSimulationState,
  type HealthCheckResponse, 
  type SystemStatus,
  type SimulationStateResponse
} from './services/api';
import { SimulationPage } from './components/SimulationPage';
import { TwinCitiesView } from './components/digitaltwin/TwinCitiesView';
import { AIPredictionsPage } from './components/AIPredictionsPage';
import { IndependentOptimizationPage } from './components/optimization/IndependentOptimizationPage';
import { CoordinatedOptimizationPage } from './components/optimization/CoordinatedOptimizationPage';
import { MPCScenarioPlanningPage } from './components/optimization/MPCScenarioPlanningPage';
import { ResearchEvaluationPage } from './components/research/ResearchEvaluationPage';
import { RealWorldValidationPage } from './components/realworld/RealWorldValidationPage';
import { 
  Activity, 
  Cpu, 
  Network, 
  BarChart3, 
  Sliders, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ArrowRightLeft,
  Server,
  Layers,
  Sparkles,
  ArrowRight,
  GitBranch,
  Database
} from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('twins');
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [systemData, setSystemData] = useState<SystemStatus | null>(null);
  const [simState, setSimState] = useState<SimulationStateResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastPing, setLastPing] = useState<number | null>(null);

  const checkConnection = async () => {
    setLoading(true);
    setError(null);
    const start = performance.now();
    try {
      const [hRes, sRes, simRes] = await Promise.all([
        fetchHealth(),
        fetchSystemStatus(),
        fetchSimulationState()
      ]);
      const latency = Math.round(performance.now() - start);
      setHealthData(hRes);
      setSystemData(sRes);
      setSimState(simRes);
      setLastPing(latency);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unknown connection error');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, 12000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    { id: 'overview', label: 'Overview Dashboard', icon: Activity },
    { id: 'twins', label: 'Twin Cities View', icon: Layers },
    { id: 'simulation', label: 'Simulation', icon: Sliders },
    { id: 'predictions', label: 'AI Predictions', icon: Sparkles },
    { id: 'optimization', label: 'Independent Optimization', icon: Cpu },
    { id: 'results', label: 'Joint Coordinated Optimization', icon: BarChart3 },
    { id: 'mpc', label: 'MPC & Scenario Planning', icon: GitBranch },
    { id: 'realworld', label: 'Real-World Data & Validation', icon: Database, isNew: true },
    { id: 'methodology', label: 'Research Evaluation', icon: BookOpen },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <header style={{
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(10, 15, 29, 0.85)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)',
            padding: '8px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(14, 165, 233, 0.3)'
          }}>
            <Network size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#f8fafc' }}>
                AI-Driven Twin Cities
              </h1>
              <span style={{
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '999px',
                border: '1px solid rgba(56, 189, 248, 0.3)'
              }}>
                Phase 10 • Integrated Digital Twin System
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Digital Twin Simulation, Predictive AI & Coordinated Optimization
            </p>
          </div>
        </div>

        {/* Backend Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '6px 14px',
            borderRadius: '8px',
            background: error ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.12)',
            border: `1px solid ${error ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
          }}>
            {error ? (
              <AlertCircle size={16} color="#f43f5e" />
            ) : (
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#10b981',
                boxShadow: '0 0 8px #10b981'
              }} />
            )}
            <span style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: error ? '#fb7185' : '#34d399'
            }}>
              {loading && !healthData ? 'Connecting...' : error ? 'Backend Disconnected' : 'API Online'}
            </span>
            {lastPing !== null && !error && (
              <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '4px' }}>
                ({lastPing}ms)
              </span>
            )}
          </div>

          <button
            onClick={checkConnection}
            title="Refresh connection"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border-subtle)',
              color: '#cbd5e1',
              padding: '6px 10px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              transition: 'all 0.2s'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Check</span>
          </button>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <nav style={{
        background: '#0c1322',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 1.5rem',
        display: 'flex',
        gap: '0.25rem',
        overflowX: 'auto'
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.85rem 1.1rem',
                fontSize: '0.86rem',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#38bdf8' : '#94a3b8',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #38bdf8' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} color={isActive ? '#38bdf8' : '#64748b'} />
              {tab.label}
              {(tab.id === 'twins' || tab.id === 'simulation') && (
                <span style={{
                  fontSize: '0.65rem',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: tab.id === 'twins' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(16, 185, 129, 0.2)',
                  color: tab.id === 'twins' ? '#38bdf8' : '#34d399',
                  fontWeight: 700
                }}>
                  Active
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '1.5rem', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
        {/* Phase 3 Active Banner */}
        <section style={{
          marginBottom: '1.5rem',
          padding: '1rem 1.4rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(168, 85, 247, 0.1))',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{
                background: activeTab === 'overview' ? '#3b82f6' : (activeTab === 'realworld' ? '#059669' : (activeTab === 'mpc' ? '#6366f1' : (activeTab === 'methodology' ? '#8b5cf6' : (activeTab === 'results' ? '#10b981' : (activeTab === 'optimization' ? '#0ea5e9' : (activeTab === 'predictions' ? '#7c3aed' : '#0284c7')))))),
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '4px',
                textTransform: 'uppercase'
              }}>
                {activeTab === 'overview' ? 'Phase 10 Integrated' : (activeTab === 'realworld' ? 'Phase 9 Active' : (activeTab === 'mpc' ? 'Phase 8 Active' : (activeTab === 'methodology' ? 'Phase 7 Active' : (activeTab === 'results' ? 'Phase 6 Active' : (activeTab === 'optimization' ? 'Phase 5 Active' : (activeTab === 'predictions' ? 'Phase 4 Active' : 'Phase 3 Active'))))))}
              </span>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc' }}>
                {activeTab === 'overview'
                  ? 'Unified Digital Twin, Predictive AI, Multi-Strategy Optimization & Validation Suite'
                  : (activeTab === 'realworld'
                    ? 'Real-World Data Integration, Calibration & Digital Twin Validation'
                    : (activeTab === 'mpc'
                      ? 'Multi-Step AI Planning & Scenario Robustness (MPC)'
                      : (activeTab === 'methodology'
                        ? 'Research-Grade Empirical & Statistical Evaluation'
                        : (activeTab === 'results'
                          ? 'Joint Coordinated Optimization & Baseline Comparison'
                          : (activeTab === 'optimization'
                            ? 'Independent City Optimization Baseline (Decentralized Control)'
                            : (activeTab === 'predictions'
                              ? 'Supervised Random Forest Traffic Demand & Congestion Forecaster'
                              : 'Digital Twin Visualization & Predictive Urban Mobility Platform'))))))}
              </h2>
            </div>
            <p style={{ fontSize: '0.84rem', color: '#94a3b8' }}>
              {activeTab === 'realworld'
                ? 'Empirical municipal CSV/JSON traffic observation ingestion, strict quarantine auditing, network road segment mapping, parameter calibration, and digital twin discrepancy validation.'
                : (activeTab === 'mpc'
                  ? 'Receding-horizon Model Predictive Control (MPC) with Bounded Beam Search over 25^H action sequences, cumulative discounted cost minimization, and multi-scenario uncertainty robustness.'
                  : (activeTab === 'methodology'
                    ? 'Multi-scenario paired hypothesis testing, Wilcoxon signed-rank tests, Cohen\'s dz effect sizes, and Holm-Bonferroni corrections comparing Unoptimized, Phase 5, and Phase 6 policies.'
                    : (activeTab === 'results'
                      ? 'Jointly optimizes City A and City B traffic policies across 25 action pairs, enforces shared corridor capacity, and computes head-to-head empirical improvements.'
                      : (activeTab === 'optimization'
                        ? 'City A and City B independently optimize local traffic conditions with private local inputs, zero coordination, and physical corridor tracking.'
                        : (activeTab === 'predictions'
                          ? 'Supervised ML model predicting t+h traffic demands, BPR-governed congestion, and held-out persistence baseline comparisons.'
                          : 'Live interactive SVG digital twin network for City A and City B with BPR-governed color congestion, clickable road telemetry, and live step syncing.')))))}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {simState && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(0, 0, 0, 0.35)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '0.78rem',
                color: '#cbd5e1',
                fontFamily: 'monospace'
              }}>
                <Server size={14} color="#38bdf8" />
                <span>Step t={simState.simulation_step} • {simState.scenario_id}</span>
              </div>
            )}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.78rem',
              color: '#34d399',
              fontWeight: 600
            }}>
              <CheckCircle2 size={14} />
              <span>Digital Twin Live</span>
            </div>
          </div>
        </section>

        {/* Tab 1: Twin Cities View (Phase 3 Core Feature) */}
        {activeTab === 'twins' && (
          <TwinCitiesView onStateUpdate={setSimState} />
        )}

        {/* Tab 2: Simulation Module (Phase 2 primary interactive view) */}
        {activeTab === 'simulation' && (
          <SimulationPage onStateUpdate={setSimState} />
        )}

        {/* Tab 3: AI Predictions (Phase 4 primary interactive view) */}
        {activeTab === 'predictions' && (
          <AIPredictionsPage onStateUpdate={setSimState} />
        )}

        {/* Tab 4: Independent Optimization (Phase 5 primary interactive view) */}
        {activeTab === 'optimization' && (
          <IndependentOptimizationPage />
        )}

        {/* Tab 5: Joint Coordinated Optimization (Phase 6 primary interactive view) */}
        {activeTab === 'results' && (
          <CoordinatedOptimizationPage />
        )}

        {/* Tab 6: Multi-Step MPC & Scenario Planning (Phase 8 primary interactive view) */}
        {activeTab === 'mpc' && (
          <MPCScenarioPlanningPage />
        )}

        {/* Tab 7: Real-World Data Integration & Validation (Phase 9 primary interactive view) */}
        {activeTab === 'realworld' && (
          <RealWorldValidationPage />
        )}

        {/* Tab 8: Research Evaluation & Statistical Analysis (Phase 7 primary interactive view) */}
        {activeTab === 'methodology' && (
          <ResearchEvaluationPage />
        )}

        {/* Tab 3: Overview Dashboard */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Top Stat Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.25rem'
            }}>
              {/* Card 1: City A Twin */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, textTransform: 'uppercase' }}>
                      Digital Twin 1
                    </span>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                      City A (Metro Alpha)
                    </h3>
                  </div>
                  <span style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {simState ? `${simState.city_a.current_congestion}% Congestion` : 'Ready'}
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1rem', lineHeight: 1.4 }}>
                  Industrial & Commercial hub. 5 zone nodes, {simState?.city_a.roads.length ?? 10} directional links, and live BPR queue tracking.
                </p>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '6px',
                  fontSize: '0.8rem'
                }}>
                  <span style={{ color: '#64748b' }}>Active Vehicles:</span>
                  <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{simState?.city_a.active_vehicles ?? 0} veh</span>
                </div>
              </div>

              {/* Card 2: Intercity Corridor */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#a855f7', fontWeight: 600, textTransform: 'uppercase' }}>
                      Shared Connection
                    </span>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                      Intercity Corridor
                    </h3>
                  </div>
                  <ArrowRightLeft size={18} color="#a855f7" />
                </div>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1rem', lineHeight: 1.4 }}>
                  Cross-boundary arterial highway connecting A_GATEWAY and B_GATEWAY (24.0 km length, 90 km/h design speed).
                </p>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '6px',
                  fontSize: '0.8rem'
                }}>
                  <span style={{ color: '#64748b' }}>Current Transit Load:</span>
                  <span style={{ color: '#cbd5e1', fontWeight: 600 }}>
                    {simState?.intercity_connection.current_volume ?? 0} / {simState?.intercity_connection.capacity ?? 250} veh
                  </span>
                </div>
              </div>

              {/* Card 3: City B Twin */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600, textTransform: 'uppercase' }}>
                      Digital Twin 2
                    </span>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                      City B (Metro Beta)
                    </h3>
                  </div>
                  <span style={{
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}>
                    {simState ? `${simState.city_b.current_congestion}% Congestion` : 'Ready'}
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '1rem', lineHeight: 1.4 }}>
                  Residential & Tech corridor. Rapid commuter outflow into City A during morning rush hour with returning flow at evening peak.
                </p>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '6px',
                  fontSize: '0.8rem'
                }}>
                  <span style={{ color: '#64748b' }}>Active Vehicles:</span>
                  <span style={{ color: '#cbd5e1', fontWeight: 600 }}>{simState?.city_b.active_vehicles ?? 0} veh</span>
                </div>
              </div>
            </div>

            {/* Quick Action Navigation */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1rem'
            }}>
              <div className="glass-panel" style={{
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.1), rgba(168, 85, 247, 0.05))',
                border: '1px solid rgba(56, 189, 248, 0.25)'
              }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                    Open Twin Cities Map View
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                    Inspect individual roads, observe color-coded congestion, and zoom into city networks.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('twins')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#0284c7',
                    color: '#fff',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                >
                  <span>Open Map</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="glass-panel" style={{
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(56, 189, 248, 0.05))',
                border: '1px solid rgba(16, 185, 129, 0.25)'
              }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                    Open Simulation Dashboard
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                    Run step sequences, view telemetry charts, and change demand profiles.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('simulation')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#059669',
                    color: '#fff',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                >
                  <span>Simulation</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="glass-panel" style={{
                padding: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(56, 189, 248, 0.05))',
                border: '1px solid rgba(168, 85, 247, 0.25)'
              }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                    Open AI Forecasts
                  </h4>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                    Multi-horizon Random Forest predictions vs. Persistence baseline comparisons.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('predictions')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#7c3aed',
                    color: '#fff',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                >
                  <span>AI Predictions</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

            {/* Infrastructure Status */}
            <div className="glass-panel-elevated" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>
                    Full-Stack Infrastructure Status
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                    Live communication telemetry between React frontend and FastAPI backend
                  </p>
                </div>
                <button
                  onClick={checkConnection}
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                >
                  Re-test Ping
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>HEALTH ENDPOINT (/api/health)</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: healthData?.status === 'healthy' ? '#10b981' : '#f43f5e' }}>
                    {healthData?.status ? `Status: ${healthData.status}` : 'Unavailable'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', fontFamily: 'monospace' }}>
                    Engine: {healthData?.engine || 'N/A'}
                  </div>
                </div>

                <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>SYSTEM ROUTE (/api/system/status)</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#38bdf8' }}>
                    {systemData?.phase || 'Initializing'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', fontFamily: 'monospace' }}>
                    Corridor: {systemData?.intercity_corridor || 'N/A'}
                  </div>
                </div>

                <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>ROUNDTRIP LATENCY</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: lastPing && lastPing < 100 ? '#10b981' : '#f59e0b' }}>
                    {lastPing !== null ? `${lastPing} ms` : 'Testing...'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                    Vite Proxy to Python FastAPI
                  </div>
                </div>

                <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '1rem', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>SIMULATION ENGINE</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#10b981' }}>
                    {simState ? `Step t=${simState.simulation_step}` : 'Ready'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                    Total Vehicles: {simState?.combined_metrics.total_active_vehicles ?? 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Placeholders for subsequent tabs */}
        {activeTab !== 'overview' && activeTab !== 'twins' && activeTab !== 'simulation' && activeTab !== 'predictions' && activeTab !== 'optimization' && activeTab !== 'results' && activeTab !== 'methodology' && (
          <div className="glass-panel-elevated" style={{ padding: '2.5rem', textAlign: 'center' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '16px',
              background: 'rgba(56, 189, 248, 0.1)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto'
            }}>
              {React.createElement(tabs.find(t => t.id === activeTab)?.icon || Layers, {
                size: 28,
                color: '#38bdf8'
              })}
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.5rem' }}>
              {tabs.find(t => t.id === activeTab)?.label}
            </h3>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', maxWidth: '520px', margin: '0 auto 1.5rem auto', lineHeight: 1.5 }}>
              This module will be activated in subsequent phases of the roadmap according to the required workflow order.
            </p>
            <button
              onClick={() => setActiveTab('twins')}
              style={{
                background: 'rgba(56, 189, 248, 0.2)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                padding: '8px 16px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600
              }}
            >
              Return to Twin Cities View
            </button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        marginTop: 'auto',
        borderTop: '1px solid var(--border-subtle)',
        padding: '1rem 1.75rem',
        background: '#070a13',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.78rem',
        color: '#64748b'
      }}>
        <div>
          AI-Driven Twin Cities Research Platform • Phase 7 Research Evaluation & Statistical Analysis Complete
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span>FastAPI v1.0.0</span>
          <span>•</span>
          <span>Interactive SVG Network</span>
          <span>•</span>
          <span>BPR Congestion Overlays</span>
          <span>•</span>
          <span style={{ color: '#f59e0b' }}>Simulated Data Only</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
