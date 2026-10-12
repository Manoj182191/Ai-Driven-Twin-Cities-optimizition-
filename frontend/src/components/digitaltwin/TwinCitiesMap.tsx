import React, { useState } from 'react';
import type { CityState, IntercityConnection, Road, RoadNode } from '../../services/api';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface TwinCitiesMapProps {
  cityA: CityState;
  cityB: CityState;
  intercity: IntercityConnection;
  selectedItem: Road | IntercityConnection | null;
  onSelectItem: (item: Road | IntercityConnection | null) => void;
  showCongestionOverlay: boolean;
  showFlowIndicators: boolean;
  focusCity: 'ALL' | 'CITY_A' | 'CITY_B';
}

export const TwinCitiesMap: React.FC<TwinCitiesMapProps> = ({
  cityA,
  cityB,
  intercity,
  selectedItem,
  onSelectItem,
  showCongestionOverlay,
  showFlowIndicators,
  focusCity
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [hoveredRoadId, setHoveredRoadId] = useState<string | null>(null);

  // Node coordinate lookup map
  const nodeMap: { [id: string]: RoadNode } = {};
  cityA.nodes.forEach(n => { nodeMap[n.node_id] = n; });
  cityB.nodes.forEach(n => { nodeMap[n.node_id] = n; });

  const getCongestionColor = (pct: number) => {
    if (!showCongestionOverlay) return '#38bdf8';
    if (pct < 40) return '#10b981'; // Green
    if (pct < 75) return '#f59e0b'; // Amber
    return '#f43f5e';               // Red
  };

  const getNodeColor = (zone: string) => {
    switch (zone) {
      case 'commercial': return '#38bdf8';
      case 'residential': return '#10b981';
      case 'industrial': return '#f59e0b';
      case 'transit': return '#a855f7';
      default: return '#94a3b8';
    }
  };

  // Helper to compute parallel offset line for bidirectional roads
  const getOffsetCoords = (start: RoadNode, end: RoadNode, offsetDist: number = 4) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x1: start.x, y1: start.y, x2: end.x, y2: end.y };
    
    // Perpendicular unit vector (-dy, dx)
    const ux = -dy / len;
    const uy = dx / len;
    return {
      x1: start.x + ux * offsetDist,
      y1: start.y + uy * offsetDist,
      x2: end.x + ux * offsetDist,
      y2: end.y + uy * offsetDist,
    };
  };

  // Determine SVG viewBox according to focusCity and zoomLevel
  let baseViewBox = { x: 0, y: 0, w: 900, h: 460 };
  if (focusCity === 'CITY_A') {
    baseViewBox = { x: 10, y: 30, w: 420, h: 400 };
  } else if (focusCity === 'CITY_B') {
    baseViewBox = { x: 470, y: 30, w: 420, h: 400 };
  }

  // Apply zoom factor centered
  const curW = baseViewBox.w / zoomLevel;
  const curH = baseViewBox.h / zoomLevel;
  const curX = baseViewBox.x + (baseViewBox.w - curW) / 2;
  const curY = baseViewBox.y + (baseViewBox.h - curH) / 2;
  const viewBoxStr = `${curX} ${curY} ${curW} ${curH}`;

  const isRoadSelected = (id: string) => {
    if (!selectedItem) return false;
    if ('road_id' in selectedItem) return selectedItem.road_id === id;
    return false;
  };

  const isIntercitySelected = () => {
    if (!selectedItem) return false;
    return 'city_a_node' in selectedItem && selectedItem.connection_id === intercity.connection_id;
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '520px', overflow: 'hidden', borderRadius: '12px' }} className="glass-panel-elevated">
      {/* Map Control Toolbar Overlay */}
      <div style={{
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: 'rgba(10, 15, 29, 0.85)',
        backdropFilter: 'blur(8px)',
        padding: '5px 8px',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle)'
      }}>
        <button
          onClick={() => setZoomLevel(prev => Math.min(2.5, prev + 0.25))}
          title="Zoom In"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#cbd5e1',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px'
          }}
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => setZoomLevel(prev => Math.max(0.75, prev - 0.25))}
          title="Zoom Out"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#cbd5e1',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px'
          }}
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={() => setZoomLevel(1)}
          title="Reset Zoom"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#cbd5e1',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            fontSize: '0.72rem',
            fontWeight: 600
          }}
        >
          <Maximize2 size={15} />
        </button>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
        <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontFamily: 'monospace', padding: '0 4px' }}>
          {Math.round(zoomLevel * 100)}%
        </span>
      </div>

      {/* Simulated Network Label Pill */}
      <div style={{
        position: 'absolute',
        top: 14,
        left: 14,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(10, 15, 29, 0.85)',
        backdropFilter: 'blur(8px)',
        padding: '6px 12px',
        borderRadius: '8px',
        border: '1px solid rgba(245, 158, 11, 0.3)'
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f59e0b', boxShadow: '0 0 8px #f59e0b' }} />
        <span style={{ fontSize: '0.74rem', color: '#f59e0b', fontWeight: 700 }}>
          SIMULATED DIGITAL TWIN NETWORK • NON-GEOGRAPHICAL
        </span>
      </div>

      {/* Main SVG Visualization Canvas */}
      <svg
        viewBox={viewBoxStr}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: 'default',
          userSelect: 'none'
        }}
      >
        <defs>
          {/* Arrow markers for directions */}
          <marker id="arrow-green" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#10b981" />
          </marker>
          <marker id="arrow-amber" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#f59e0b" />
          </marker>
          <marker id="arrow-red" viewBox="0 0 10 10" refX="16" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#f43f5e" />
          </marker>
          <marker id="arrow-purple" viewBox="0 0 10 10" refX="18" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#a855f7" />
          </marker>

          {/* Glowing filters */}
          <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-selected" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background Grid Pattern */}
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.025)" strokeWidth="1" />
        </pattern>
        <rect width="900" height="460" fill="url(#grid)" />

        {/* 1. Distinct City A Boundary Area */}
        <rect
          x="30"
          y="40"
          width="350"
          height="390"
          rx="16"
          fill="rgba(14, 165, 233, 0.04)"
          stroke="rgba(56, 189, 248, 0.25)"
          strokeWidth="1.5"
          strokeDasharray="6 4"
        />
        <text x="50" y="65" fill="#38bdf8" fontSize="13" fontWeight="700" letterSpacing="0.05em">
          CITY A: METRO ALPHA
        </text>
        <text x="50" y="80" fill="#64748b" fontSize="9" fontWeight="500">
          Autonomous Administrative Zone • Pop: {cityA.population.toLocaleString()}
        </text>

        {/* 2. Distinct City B Boundary Area */}
        <rect
          x="460"
          y="40"
          width="410"
          height="390"
          rx="16"
          fill="rgba(16, 185, 129, 0.04)"
          stroke="rgba(16, 185, 129, 0.25)"
          strokeWidth="1.5"
          strokeDasharray="6 4"
        />
        <text x="480" y="65" fill="#10b981" fontSize="13" fontWeight="700" letterSpacing="0.05em">
          CITY B: METRO BETA
        </text>
        <text x="480" y="80" fill="#64748b" fontSize="9" fontWeight="500">
          Autonomous Administrative Zone • Pop: {cityB.population.toLocaleString()}
        </text>

        {/* 3. Central Regional Waterway & Border Corridor */}
        <path
          d="M 400 30 Q 425 230 400 440"
          fill="none"
          stroke="rgba(99, 102, 241, 0.2)"
          strokeWidth="45"
          strokeLinecap="round"
        />
        <text x="410" y="220" fill="rgba(255,255,255,0.2)" fontSize="10" fontWeight="600" textAnchor="middle" transform="rotate(-90 410 220)">
          REGIONAL BOUNDARY CHANNEL
        </text>

        {/* 4. Intercity Expressway Bridge (A_GATEWAY ↔ B_GATEWAY) */}
        {(() => {
          const nodeA = nodeMap[intercity.city_a_node];
          const nodeB = nodeMap[intercity.city_b_node];
          if (!nodeA || !nodeB) return null;
          const isSelected = isIntercitySelected();
          const congColor = getCongestionColor(intercity.congestion_level);

          return (
            <g
              onClick={() => onSelectItem(intercity)}
              style={{ cursor: 'pointer' }}
            >
              {/* Bridge deck underlay */}
              <path
                d={`M ${nodeA.x} ${nodeA.y} Q 400 410 ${nodeB.x} ${nodeB.y}`}
                fill="none"
                stroke="rgba(0, 0, 0, 0.7)"
                strokeWidth="14"
              />
              <path
                d={`M ${nodeA.x} ${nodeA.y} Q 400 410 ${nodeB.x} ${nodeB.y}`}
                fill="none"
                stroke="rgba(168, 85, 247, 0.3)"
                strokeWidth="12"
              />
              {/* Highlight halo when selected */}
              {isSelected && (
                <path
                  d={`M ${nodeA.x} ${nodeA.y} Q 400 410 ${nodeB.x} ${nodeB.y}`}
                  fill="none"
                  stroke="#c084fc"
                  strokeWidth="16"
                  opacity="0.4"
                  filter="url(#glow-selected)"
                />
              )}
              {/* Active roadway line */}
              <path
                d={`M ${nodeA.x} ${nodeA.y} Q 400 410 ${nodeB.x} ${nodeB.y}`}
                fill="none"
                stroke={congColor}
                strokeWidth="6"
                strokeDasharray={showFlowIndicators ? "8 6" : "none"}
                className={showFlowIndicators ? "animate-pulse-glow" : ""}
              />
              {/* Bridge label */}
              <rect
                x="345"
                y="385"
                width="110"
                height="22"
                rx="5"
                fill="rgba(15, 23, 42, 0.9)"
                stroke="#a855f7"
                strokeWidth="1"
              />
              <text x="400" y="400" fill="#d8b4fe" fontSize="9" fontWeight="700" textAnchor="middle">
                EXPRESSWAY CORRIDOR
              </text>
            </g>
          );
        })()}

        {/* 5. City A Internal Road Segments */}
        {cityA.roads.map(road => {
          const start = nodeMap[road.start_node];
          const end = nodeMap[road.end_node];
          if (!start || !end) return null;

          const isSelected = isRoadSelected(road.road_id);
          const isHovered = hoveredRoadId === road.road_id;
          const congColor = getCongestionColor(road.congestion_level);
          const offset = road.road_id.charCodeAt(road.road_id.length - 1) % 2 === 0 ? 5 : -5;
          const coords = getOffsetCoords(start, end, offset);
          const strokeW = road.category === 'arterial' ? 4 : 2.5;

          const arrowMarker = congColor === '#10b981' ? 'url(#arrow-green)' : congColor === '#f59e0b' ? 'url(#arrow-amber)' : 'url(#arrow-red)';

          return (
            <g
              key={road.road_id}
              onClick={() => onSelectItem(road)}
              onMouseEnter={() => setHoveredRoadId(road.road_id)}
              onMouseLeave={() => setHoveredRoadId(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Invisible wider target for easier clicking */}
              <line
                x1={coords.x1}
                y1={coords.y1}
                x2={coords.x2}
                y2={coords.y2}
                stroke="transparent"
                strokeWidth="16"
              />
              {/* Selection aura */}
              {isSelected && (
                <line
                  x1={coords.x1}
                  y1={coords.y1}
                  x2={coords.x2}
                  y2={coords.y2}
                  stroke="#38bdf8"
                  strokeWidth={strokeW + 8}
                  opacity="0.45"
                  filter="url(#glow-selected)"
                />
              )}
              {/* Main colored road segment */}
              <line
                x1={coords.x1}
                y1={coords.y1}
                x2={coords.x2}
                y2={coords.y2}
                stroke={isHovered ? '#ffffff' : congColor}
                strokeWidth={isHovered ? strokeW + 2 : strokeW}
                strokeDasharray={showFlowIndicators && road.current_vehicles > 30 ? "6 5" : "none"}
                markerEnd={arrowMarker}
                opacity={isHovered || isSelected ? 1 : 0.88}
              />
            </g>
          );
        })}

        {/* 6. City B Internal Road Segments */}
        {cityB.roads.map(road => {
          const start = nodeMap[road.start_node];
          const end = nodeMap[road.end_node];
          if (!start || !end) return null;

          const isSelected = isRoadSelected(road.road_id);
          const isHovered = hoveredRoadId === road.road_id;
          const congColor = getCongestionColor(road.congestion_level);
          const offset = road.road_id.charCodeAt(road.road_id.length - 1) % 2 === 0 ? 5 : -5;
          const coords = getOffsetCoords(start, end, offset);
          const strokeW = road.category === 'arterial' ? 4 : 2.5;

          const arrowMarker = congColor === '#10b981' ? 'url(#arrow-green)' : congColor === '#f59e0b' ? 'url(#arrow-amber)' : 'url(#arrow-red)';

          return (
            <g
              key={road.road_id}
              onClick={() => onSelectItem(road)}
              onMouseEnter={() => setHoveredRoadId(road.road_id)}
              onMouseLeave={() => setHoveredRoadId(null)}
              style={{ cursor: 'pointer' }}
            >
              <line
                x1={coords.x1}
                y1={coords.y1}
                x2={coords.x2}
                y2={coords.y2}
                stroke="transparent"
                strokeWidth="16"
              />
              {isSelected && (
                <line
                  x1={coords.x1}
                  y1={coords.y1}
                  x2={coords.x2}
                  y2={coords.y2}
                  stroke="#10b981"
                  strokeWidth={strokeW + 8}
                  opacity="0.45"
                  filter="url(#glow-selected)"
                />
              )}
              <line
                x1={coords.x1}
                y1={coords.y1}
                x2={coords.x2}
                y2={coords.y2}
                stroke={isHovered ? '#ffffff' : congColor}
                strokeWidth={isHovered ? strokeW + 2 : strokeW}
                strokeDasharray={showFlowIndicators && road.current_vehicles > 30 ? "6 5" : "none"}
                markerEnd={arrowMarker}
                opacity={isHovered || isSelected ? 1 : 0.88}
              />
            </g>
          );
        })}

        {/* 7. Intersection Nodes (City A & City B) */}
        {Object.values(nodeMap).map(node => {
          const color = getNodeColor(node.zone_type);
          const isCityA = node.node_id.startsWith('A_');

          return (
            <g key={node.node_id} transform={`translate(${node.x}, ${node.y})`}>
              {/* Outer halo */}
              <circle r="14" fill={isCityA ? "rgba(14, 165, 233, 0.15)" : "rgba(16, 185, 129, 0.15)"} />
              {/* Core node circle */}
              <circle r="8" fill="#0f172a" stroke={color} strokeWidth="2.5" />
              <circle r="3" fill={color} />
              
              {/* Node ID label */}
              <text
                x="0"
                y="-18"
                fill="#f8fafc"
                fontSize="10"
                fontWeight="700"
                textAnchor="middle"
                style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
              >
                {node.name.split(' ')[0]}
              </text>
              <text
                x="0"
                y="26"
                fill="#94a3b8"
                fontSize="8"
                fontWeight="500"
                textAnchor="middle"
              >
                {node.node_id}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
