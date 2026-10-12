import React, { useState, useEffect, useRef } from 'react';
import type { SimulationStateResponse, Road, IntercityConnection, DemandLevel } from '../../services/api';
import {
  fetchSimulationState,
  stepSimulation,
  resetSimulation,
  initializeSimulation,
  generateNewScenario
} from '../../services/api';
import { TwinCitiesMap } from './TwinCitiesMap';
import { CityMetricsPanel } from './CityMetricsPanel';
import { RoadDetailsPanel } from './RoadDetailsPanel';
import { MapLegend } from './MapLegend';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Sparkles,
  Layers,
  Eye,
  EyeOff,
  Radio
} from 'lucide-react';

interface TwinCitiesViewProps {
  onStateUpdate?: (state: SimulationStateResponse) => void;
}

export const TwinCitiesView: React.FC<TwinCitiesViewProps> = ({ onStateUpdate }) => {
  const [simState, setSimState] = useState<SimulationStateResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [stepping, setStepping] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Map Controls State
  const [selectedItem, setSelectedItem] = useState<Road | IntercityConnection | null>(null);
  const [focusCity, setFocusCity] = useState<'ALL' | 'CITY_A' | 'CITY_B'>('ALL');
  const [showCongestionOverlay, setShowCongestionOverlay] = useState<boolean>(true);
  const [showFlowIndicators, setShowFlowIndicators] = useState<boolean>(true);

  // Scenario config inputs
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
      setError(err instanceof Error ? err.message : 'Failed to fetch digital twin state');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCurrentState();
  }, []);

  // Discrete Step
  const handleStep = async () => {
    if (stepping) return;
    try {
      setStepping(true);
      const data = await stepSimulation(1);
      setSimState(data);
      if (onStateUpdate) onStateUpdate(data);

      // Refresh selected road data if open
      if (selectedItem) {
        if ('city_a_node' in selectedItem) {
          setSelectedItem(data.intercity_connection);
        } else {
          const updatedRoad = [...data.city_a.roads, ...data.city_b.roads].find(
            r => r.road_id === selectedItem.road_id
          );
          if (updatedRoad) setSelectedItem(updatedRoad);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error advancing simulation step');
      setIsPlaying(false);
    } finally {
      setStepping(false);
    }
  };

  // Play / Pause auto run
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = window.setInterval(() => {
        handleStep();
      }, 1500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying]);

  // Reset
  const handleReset = async () => {
    setIsPlaying(false);
    try {
      setLoading(true);
      const data = await resetSimulation();
      setSimState(data);
      setSelectedItem(null);
      if (onStateUpdate) onStateUpdate(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error resetting simulation');
    } finally {
      setLoading(false);
    }
  };

  // Initialize
  const handleInitialize = async () => {
    setIsPlaying(false);
    try {
      setLoading(true);
      const data = await initializeSimulation(seedInput, demandLevel);
      setSimState(data);
      setSelectedItem(null);
      if (onStateUpdate) onStateUpdate(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error initializing simulation');
    } finally {
      setLoading(false);
    }
  };

  // Generate New Scenario
  const handleNewScenario = async () => {
    setIsPlaying(false);
    try {
      setLoading(true);
      const randomSeed = Math.floor(Math.random() * 89999 + 1000);
      setSeedInput(randomSeed);
      const data = await generateNewScenario(randomSeed, demandLevel);
      setSimState(data);
      setSelectedItem(null);
      if (onStateUpdate) onStateUpdate(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error generating scenario');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !simState) {
    return (
      <div style={{ padding: '3.5rem', textAlign: 'center', color: '#94a3b8' }}>
        <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '1rem' }}>
          <Layers size={36} color="#38bdf8" />
        </div>
        <div>Initializing Digital Twin Visualization...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header & Simulation Controls Toolbar */}
      <div className="glass-panel-elevated" style={{ padding: '1.1rem 1.4rem' }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0.85rem',
          marginBottom: '0.85rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>
                Twin Cities Digital Twin Visualization
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
                SIMULATED DATA
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
            <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
              Real-time interactive network representation of City A (Metro Alpha), City B (Metro Beta), and the cross-border expressway.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              background: 'rgba(0, 0, 0, 0.35)',
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>SIMULATION STEP</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#00f0ff', fontFamily: 'monospace' }}>
                t = {simState?.simulation_step ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* Toolbar: Map Filters + Simulation Stepping */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.85rem'
        }}>
          {/* Map View Mode & Layer Toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <div style={{
              display: 'flex',
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '8px',
              padding: '2px',
              border: '1px solid var(--border-subtle)'
            }}>
              <button
                onClick={() => setFocusCity('ALL')}
                style={{
                  background: focusCity === 'ALL' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                  color: focusCity === 'ALL' ? '#38bdf8' : '#94a3b8',
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600
                }}
              >
                Dual Cities View
              </button>
              <button
                onClick={() => setFocusCity('CITY_A')}
                style={{
                  background: focusCity === 'CITY_A' ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                  color: focusCity === 'CITY_A' ? '#38bdf8' : '#94a3b8',
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600
                }}
              >
                Focus City A
              </button>
              <button
                onClick={() => setFocusCity('CITY_B')}
                style={{
                  background: focusCity === 'CITY_B' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                  color: focusCity === 'CITY_B' ? '#10b981' : '#94a3b8',
                  border: 'none',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600
                }}
              >
                Focus City B
              </button>
            </div>

            {/* Overlays Toggles */}
            <button
              onClick={() => setShowCongestionOverlay(!showCongestionOverlay)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: showCongestionOverlay ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: showCongestionOverlay ? '#38bdf8' : '#64748b',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.76rem',
                fontWeight: 600
              }}
            >
              {showCongestionOverlay ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>Congestion Overlay</span>
            </button>

            <button
              onClick={() => setShowFlowIndicators(!showFlowIndicators)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: showFlowIndicators ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: showFlowIndicators ? '#c084fc' : '#64748b',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.76rem',
                fontWeight: 600
              }}
            >
              <Radio size={14} />
              <span>Flow Indicators</span>
            </button>
          </div>

          {/* Stepping Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: isPlaying ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                border: `1px solid ${isPlaying ? 'rgba(244, 63, 94, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                color: isPlaying ? '#fb7185' : '#34d399',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.8rem'
              }}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              <span>{isPlaying ? 'Pause' : 'Auto-Run'}</span>
            </button>

            <button
              onClick={handleStep}
              disabled={stepping || isPlaying}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: (stepping || isPlaying) ? 'not-allowed' : 'pointer',
                opacity: (stepping || isPlaying) ? 0.6 : 1,
                fontWeight: 600,
                fontSize: '0.8rem'
              }}
            >
              <SkipForward size={14} />
              <span>Step +1</span>
            </button>

            <button
              onClick={handleReset}
              disabled={loading || isPlaying}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-subtle)',
                color: '#cbd5e1',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: (loading || isPlaying) ? 'not-allowed' : 'pointer',
                fontSize: '0.8rem'
              }}
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <select
                value={demandLevel}
                onChange={(e) => setDemandLevel(e.target.value as DemandLevel)}
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  color: '#f8fafc',
                  fontSize: '0.78rem'
                }}
              >
                <option value="low">Low (0.65x)</option>
                <option value="normal">Normal (1.00x)</option>
                <option value="peak">Peak (1.45x)</option>
              </select>
              <button
                onClick={handleInitialize}
                disabled={loading || isPlaying}
                style={{
                  background: 'rgba(168, 85, 247, 0.15)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  color: '#c084fc',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  cursor: (loading || isPlaying) ? 'not-allowed' : 'pointer',
                  fontSize: '0.78rem',
                  fontWeight: 600
                }}
              >
                Apply
              </button>
            </div>

            <button
              onClick={handleNewScenario}
              disabled={loading || isPlaying}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(168, 85, 247, 0.2))',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38bdf8',
                padding: '6px 10px',
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
            marginTop: '0.75rem',
            padding: '0.65rem 0.85rem',
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            borderRadius: '6px',
            color: '#fda4af',
            fontSize: '0.8rem'
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Main Interactive Map & Details Panel Grid */}
      {simState && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: selectedItem ? '1fr 340px' : '1fr',
          gap: '1.25rem',
          transition: 'all 0.3s ease'
        }}>
          {/* Map Canvas Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <TwinCitiesMap
              cityA={simState.city_a}
              cityB={simState.city_b}
              intercity={simState.intercity_connection}
              selectedItem={selectedItem}
              onSelectItem={setSelectedItem}
              showCongestionOverlay={showCongestionOverlay}
              showFlowIndicators={showFlowIndicators}
              focusCity={focusCity}
            />

            <MapLegend />
          </div>

          {/* Inspector Panel Sidebar when road or corridor is clicked */}
          {selectedItem && (
            <div>
              <RoadDetailsPanel
                selectedItem={selectedItem}
                onClose={() => setSelectedItem(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* City Information Panels */}
      {simState && (
        <CityMetricsPanel
          cityA={simState.city_a}
          cityB={simState.city_b}
          intercity={simState.intercity_connection}
          simulationStep={simState.simulation_step}
          onFocusCity={setFocusCity}
          activeFocus={focusCity}
        />
      )}
    </div>
  );
};
