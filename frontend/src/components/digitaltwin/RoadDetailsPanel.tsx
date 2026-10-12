import React from 'react';
import { X, Route, ArrowRight } from 'lucide-react';
import type { Road, IntercityConnection } from '../../services/api';

interface RoadDetailsPanelProps {
  selectedItem: Road | IntercityConnection | null;
  onClose: () => void;
}

export const RoadDetailsPanel: React.FC<RoadDetailsPanelProps> = ({ selectedItem, onClose }) => {
  if (!selectedItem) return null;

  const isIntercity = 'city_a_node' in selectedItem;
  const roadId = isIntercity ? selectedItem.connection_id : selectedItem.road_id;
  const name = selectedItem.name;
  const startNode = isIntercity ? selectedItem.city_a_node : selectedItem.start_node;
  const endNode = isIntercity ? selectedItem.city_b_node : selectedItem.end_node;
  const lengthKm = selectedItem.length_km;
  const capacity = selectedItem.capacity;
  const volume = isIntercity ? selectedItem.current_volume : selectedItem.current_vehicles;
  const queue = selectedItem.queue_length;
  const congestionPct = selectedItem.congestion_level;
  const travelTimeMins = selectedItem.travel_time_mins;
  const category = selectedItem.category;
  const speedLimit = selectedItem.free_flow_speed_kmh;

  const getCongestionColor = (pct: number) => {
    if (pct < 40) return '#10b981';
    if (pct < 75) return '#f59e0b';
    return '#f43f5e';
  };

  return (
    <div className="glass-panel-elevated" style={{
      padding: '1.25rem',
      position: 'relative',
      border: '1px solid rgba(56, 189, 248, 0.4)',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
    }}>
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid var(--border-subtle)',
          color: '#94a3b8',
          borderRadius: '6px',
          padding: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Close Inspector"
      >
        <X size={16} />
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <Route size={18} color={isIntercity ? '#a855f7' : '#38bdf8'} />
        <span style={{ fontSize: '0.72rem', color: isIntercity ? '#c084fc' : '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
          {isIntercity ? 'Intercity Corridor Segment' : 'Urban Road Segment'}
        </span>
      </div>

      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', marginBottom: '2px' }}>
        {name}
      </h3>
      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem', fontFamily: 'monospace' }}>
        ID: {roadId} • Category: <span style={{ textTransform: 'capitalize', color: '#cbd5e1' }}>{category}</span>
      </div>

      {/* Nodes Connection */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.35)',
        padding: '8px 12px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
        fontSize: '0.8rem'
      }}>
        <div style={{ textAlign: 'left' }}>
          <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>ORIGIN</span>
          <span style={{ fontWeight: 600, color: '#38bdf8' }}>{startNode}</span>
        </div>
        <ArrowRight size={16} color="#94a3b8" />
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '0.68rem', color: '#64748b', display: 'block' }}>DESTINATION</span>
          <span style={{ fontWeight: 600, color: '#10b981' }}>{endNode}</span>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.75rem', borderRadius: '6px' }}>
          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>FLOW / CAPACITY</span>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginTop: '2px', fontFamily: 'monospace' }}>
            {volume} / {capacity} <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>veh</span>
          </div>
        </div>

        <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.75rem', borderRadius: '6px' }}>
          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>CONGESTION LEVEL</span>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: getCongestionColor(congestionPct), marginTop: '2px' }}>
            {congestionPct}%
          </div>
        </div>

        <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.75rem', borderRadius: '6px' }}>
          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>BPR TRAVEL TIME</span>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8', marginTop: '2px' }}>
            {travelTimeMins} <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>mins</span>
          </div>
        </div>

        <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '0.75rem', borderRadius: '6px' }}>
          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>ROAD QUEUE</span>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: queue > 0 ? '#fb7185' : '#34d399', marginTop: '2px' }}>
            {queue} <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>veh</span>
          </div>
        </div>
      </div>

      {/* Utilization Bar */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8' }}>Capacity Utilization</span>
          <span style={{ fontWeight: 600, color: getCongestionColor(congestionPct) }}>
            {((volume + queue) / capacity * 100).toFixed(1)}%
          </span>
        </div>
        <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{
            width: `${Math.min(100, (volume + queue) / capacity * 100)}%`,
            height: '100%',
            background: getCongestionColor(congestionPct),
            borderRadius: '4px',
            transition: 'width 0.3s ease'
          }} />
        </div>
      </div>

      {/* Engineering Specs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#94a3b8', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
        <span>Length: <strong style={{ color: '#f1f5f9' }}>{lengthKm} km</strong></span>
        <span>Free Speed: <strong style={{ color: '#f1f5f9' }}>{speedLimit} km/h</strong></span>
        <span>Free-flow Time: <strong style={{ color: '#f1f5f9' }}>{((lengthKm / speedLimit) * 60).toFixed(1)}m</strong></span>
      </div>
    </div>
  );
};
