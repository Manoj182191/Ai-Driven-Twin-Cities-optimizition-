import React from 'react';
import type { CityState, IntercityConnection } from '../../services/api';

interface CityMetricsPanelProps {
  cityA: CityState;
  cityB: CityState;
  intercity: IntercityConnection;
  simulationStep: number;
  onFocusCity?: (cityId: 'ALL' | 'CITY_A' | 'CITY_B') => void;
  activeFocus?: 'ALL' | 'CITY_A' | 'CITY_B';
}

export const CityMetricsPanel: React.FC<CityMetricsPanelProps> = ({
  cityA,
  cityB,
  intercity,
  simulationStep,
  onFocusCity,
  activeFocus = 'ALL'
}) => {
  const getCongestionBadge = (pct: number) => {
    if (pct < 40) return { label: 'Low', color: '#34d399', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' };
    if (pct < 75) return { label: 'Medium', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.3)' };
    if (pct < 90) return { label: 'High', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' };
    return { label: 'Severe', color: '#fb7185', bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.3)' };
  };

  const badgeA = getCongestionBadge(cityA.current_congestion);
  const badgeB = getCongestionBadge(cityB.current_congestion);
  const badgeIC = getCongestionBadge(intercity.congestion_level);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
      gap: '1.25rem'
    }}>
      {/* City A Card */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem',
          border: activeFocus === 'CITY_A' ? '2px solid #38bdf8' : '1px solid var(--border-subtle)',
          cursor: onFocusCity ? 'pointer' : 'default',
          transition: 'all 0.2s ease'
        }}
        onClick={() => onFocusCity && onFocusCity(activeFocus === 'CITY_A' ? 'ALL' : 'CITY_A')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
              Digital Twin A
            </span>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
              {cityA.name}
            </h3>
          </div>
          <span style={{
            background: badgeA.bg,
            color: badgeA.color,
            border: `1px solid ${badgeA.border}`,
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 600
          }}>
            {cityA.current_congestion}% ({badgeA.label})
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem', marginBottom: '0.75rem' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.65rem', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>DEMAND</span>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
              {cityA.total_demand} <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>veh</span>
            </div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.65rem', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>AVG TRAVEL TIME</span>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#38bdf8' }}>
              {cityA.avg_travel_time} <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>min</span>
            </div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.65rem', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>AVG QUEUE</span>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
              {cityA.avg_queue_length} <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>veh</span>
            </div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.65rem', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>ENTERING / LEAVING</span>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
              +{cityA.vehicles_entering} / -{cityA.vehicles_leaving}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
          <span>Roads: <strong style={{ color: '#cbd5e1' }}>{cityA.roads.length} links</strong></span>
          <span>Population: <strong style={{ color: '#cbd5e1' }}>{cityA.population.toLocaleString()}</strong></span>
          <span>Step: <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>t={simulationStep}</strong></span>
        </div>
      </div>

      {/* Intercity Connection Card */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <span style={{ fontSize: '0.7rem', color: '#a855f7', fontWeight: 700, textTransform: 'uppercase' }}>
                Shared Connection
              </span>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
                {intercity.name}
              </h3>
            </div>
            <span style={{
              background: badgeIC.bg,
              color: badgeIC.color,
              border: `1px solid ${badgeIC.border}`,
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600
            }}>
              {intercity.congestion_level}% ({badgeIC.label})
            </span>
          </div>

          <div style={{
            background: 'rgba(0,0,0,0.3)',
            padding: '0.75rem',
            borderRadius: '6px',
            marginBottom: '0.75rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Transit Volume / Capacity:</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f1f5f9', fontFamily: 'monospace' }}>
                {intercity.current_volume} / {intercity.capacity} veh
              </span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, intercity.congestion_level)}%`,
                height: '100%',
                background: badgeIC.color,
                borderRadius: '3px'
              }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center', fontSize: '0.75rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '6px', borderRadius: '4px' }}>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>TRAVEL TIME</span>
              <span style={{ fontWeight: 600, color: '#c084fc' }}>{intercity.travel_time_mins}m</span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '6px', borderRadius: '4px' }}>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>QUEUE</span>
              <span style={{ fontWeight: 600, color: intercity.queue_length > 0 ? '#fb7185' : '#34d399' }}>{intercity.queue_length}v</span>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '6px', borderRadius: '4px' }}>
              <span style={{ color: '#64748b', display: 'block', fontSize: '0.68rem' }}>DISTANCE</span>
              <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{intercity.length_km}km</span>
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.72rem', color: '#a855f7', textAlign: 'center', marginTop: '0.65rem' }}>
          Corridor ID: {intercity.connection_id} • A_GATEWAY ↔ B_GATEWAY
        </div>
      </div>

      {/* City B Card */}
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem',
          border: activeFocus === 'CITY_B' ? '2px solid #10b981' : '1px solid var(--border-subtle)',
          cursor: onFocusCity ? 'pointer' : 'default',
          transition: 'all 0.2s ease'
        }}
        onClick={() => onFocusCity && onFocusCity(activeFocus === 'CITY_B' ? 'ALL' : 'CITY_B')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div>
            <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>
              Digital Twin B
            </span>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px' }}>
              {cityB.name}
            </h3>
          </div>
          <span style={{
            background: badgeB.bg,
            color: badgeB.color,
            border: `1px solid ${badgeB.border}`,
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 600
          }}>
            {cityB.current_congestion}% ({badgeB.label})
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem', marginBottom: '0.75rem' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.65rem', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>DEMAND</span>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
              {cityB.total_demand} <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>veh</span>
            </div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.65rem', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>AVG TRAVEL TIME</span>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#10b981' }}>
              {cityB.avg_travel_time} <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>min</span>
            </div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.65rem', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>AVG QUEUE</span>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
              {cityB.avg_queue_length} <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>veh</span>
            </div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.65rem', borderRadius: '6px' }}>
            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>ENTERING / LEAVING</span>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc' }}>
              +{cityB.vehicles_entering} / -{cityB.vehicles_leaving}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
          <span>Roads: <strong style={{ color: '#cbd5e1' }}>{cityB.roads.length} links</strong></span>
          <span>Population: <strong style={{ color: '#cbd5e1' }}>{cityB.population.toLocaleString()}</strong></span>
          <span>Step: <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>t={simulationStep}</strong></span>
        </div>
      </div>
    </div>
  );
};
