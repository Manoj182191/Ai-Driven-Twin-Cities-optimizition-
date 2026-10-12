import React from 'react';
import { Layers } from 'lucide-react';

export const MapLegend: React.FC = () => {
  return (
    <div className="glass-panel" style={{ padding: '0.85rem 1.1rem', fontSize: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.65rem' }}>
        <Layers size={14} color="#38bdf8" />
        <span style={{ fontWeight: 700, color: '#f1f5f9', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Map Legend & Telemetry Indicators
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.85rem'
      }}>
        {/* Congestion Levels */}
        <div>
          <div style={{ color: '#94a3b8', fontWeight: 600, marginBottom: '5px' }}>
            Congestion Levels (BPR)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 12, height: 4, borderRadius: 2, background: '#10b981' }} />
              <span style={{ color: '#e2e8f0' }}>Low Congestion (&lt; 40%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 12, height: 4, borderRadius: 2, background: '#f59e0b' }} />
              <span style={{ color: '#e2e8f0' }}>Medium Congestion (40% - 75%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 12, height: 4, borderRadius: 2, background: '#f43f5e' }} />
              <span style={{ color: '#e2e8f0' }}>High / Severe Congestion (&gt; 75%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 12, height: 4, borderRadius: 2, background: '#64748b' }} />
              <span style={{ color: '#e2e8f0' }}>Inactive / Road Closure</span>
            </div>
          </div>
        </div>

        {/* Road Categories */}
        <div>
          <div style={{ color: '#94a3b8', fontWeight: 600, marginBottom: '5px' }}>
            Road Hierarchy
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 14, height: 5, borderRadius: 2, background: '#a855f7' }} />
              <span style={{ color: '#e2e8f0' }}>Intercity Expressway (90 km/h)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 14, height: 4, borderRadius: 2, background: '#38bdf8' }} />
              <span style={{ color: '#e2e8f0' }}>Major Arterial (50-60 km/h)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 14, height: 2.5, borderRadius: 1.5, background: '#64748b' }} />
              <span style={{ color: '#e2e8f0' }}>Local / Collector (45-50 km/h)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00f0ff', boxShadow: '0 0 6px #00f0ff' }} />
              <span style={{ color: '#e2e8f0' }}>Active Vehicle Flow Pulses</span>
            </div>
          </div>
        </div>

        {/* Node Zones */}
        <div>
          <div style={{ color: '#94a3b8', fontWeight: 600, marginBottom: '5px' }}>
            Urban Zone Types
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '0.7rem' }}>
              ● Commercial Hub
            </span>
            <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.7rem' }}>
              ● Residential Suburb
            </span>
            <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', fontSize: '0.7rem' }}>
              ● Industrial District
            </span>
            <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', fontSize: '0.7rem' }}>
              ● Transit Gateway
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
