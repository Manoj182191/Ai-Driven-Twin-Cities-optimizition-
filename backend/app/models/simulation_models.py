from enum import Enum
from typing import List, Dict, Optional
from pydantic import BaseModel, Field


class DemandLevel(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    PEAK = "peak"


class RoadCategory(str, Enum):
    LOCAL = "local"
    ARTERIAL = "arterial"
    INTERCITY = "intercity"


class CongestionBand(str, Enum):
    LOW = "Low"          # < 40%
    MEDIUM = "Medium"    # 40% - 75%
    HIGH = "High"        # 75% - 90%
    SEVERE = "Severe"    # > 90%


class RoadNode(BaseModel):
    node_id: str
    name: str
    x: float
    y: float
    zone_type: str = "mixed"  # residential, commercial, industrial, transit


class Road(BaseModel):
    road_id: str
    name: str
    start_node: str
    end_node: str
    length_km: float = Field(..., ge=0.1)
    capacity: int = Field(..., ge=1, description="Max vehicles per simulation step")
    free_flow_speed_kmh: float = Field(default=50.0, ge=10.0)
    current_vehicles: int = Field(default=0, ge=0)
    queue_length: int = Field(default=0, ge=0)
    congestion_level: float = Field(default=0.0, ge=0.0, description="Congestion percentage (0-100)")
    raw_utilization: float = Field(default=0.0, ge=0.0, description="Volume/Capacity ratio")
    travel_time_mins: float = Field(default=1.0, ge=0.1)
    category: RoadCategory = RoadCategory.LOCAL
    congestion_band: CongestionBand = CongestionBand.LOW


class IntercityConnection(BaseModel):
    connection_id: str
    name: str
    city_a_node: str
    city_b_node: str
    length_km: float = Field(default=24.0, ge=1.0)
    capacity: int = Field(default=250, ge=10)
    free_flow_speed_kmh: float = Field(default=90.0, ge=20.0)
    current_volume: int = Field(default=0, ge=0)
    queue_length: int = Field(default=0, ge=0)
    congestion_level: float = Field(default=0.0, ge=0.0)
    raw_utilization: float = Field(default=0.0, ge=0.0)
    travel_time_mins: float = Field(default=16.0, ge=1.0)
    category: RoadCategory = RoadCategory.INTERCITY
    congestion_band: CongestionBand = CongestionBand.LOW


class CityState(BaseModel):
    city_id: str
    name: str
    population: int = Field(..., ge=1000)
    nodes: List[RoadNode]
    roads: List[Road]
    total_demand: int = Field(default=0, ge=0)
    current_congestion: float = Field(default=0.0, ge=0.0, description="Average road congestion (%)")
    avg_travel_time: float = Field(default=0.0, ge=0.0, description="Average travel time in minutes")
    avg_queue_length: float = Field(default=0.0, ge=0.0, description="Average vehicles queued per road")
    total_capacity: int = Field(..., ge=1)
    available_capacity: int = Field(..., ge=0)
    vehicles_entering: int = Field(default=0, ge=0)
    vehicles_leaving: int = Field(default=0, ge=0)
    active_vehicles: int = Field(default=0, ge=0)
    current_step: int = Field(default=0, ge=0)


class CitySummaryMetrics(BaseModel):
    city_id: str
    name: str
    demand: int
    congestion_pct: float
    avg_travel_time_mins: float
    avg_queue_vehicles: float
    active_vehicles: int
    vehicles_entering: int
    vehicles_leaving: int
    congestion_band: CongestionBand


class IntercitySummaryMetrics(BaseModel):
    connection_id: str
    name: str
    volume: int
    capacity: int
    congestion_pct: float
    queue_length: int
    travel_time_mins: float
    congestion_band: CongestionBand


class CombinedSystemMetrics(BaseModel):
    total_demand: int
    avg_travel_time_mins: float
    system_congestion_pct: float
    total_queues: int
    total_active_vehicles: int
    intercity_crossings: int


class StepHistoryRecord(BaseModel):
    step: int
    timestamp: str
    city_a_demand: int
    city_a_congestion: float
    city_a_travel_time: float
    city_b_demand: int
    city_b_congestion: float
    city_b_travel_time: float
    intercity_volume: int
    intercity_congestion: float
    combined_congestion: float
    combined_travel_time: float
    combined_queues: int


class SimulationStateResponse(BaseModel):
    simulation_step: int
    scenario_id: str
    seed: int
    demand_level: DemandLevel
    timestamp: str
    is_simulated_data: bool = True
    city_a: CityState
    city_b: CityState
    intercity_connection: IntercityConnection
    combined_metrics: CombinedSystemMetrics
    history_length: int
    history: List[StepHistoryRecord]


class MetricsResponse(BaseModel):
    simulation_step: int
    scenario_id: str
    demand_level: DemandLevel
    city_a: CitySummaryMetrics
    city_b: CitySummaryMetrics
    intercity: IntercitySummaryMetrics
    combined: CombinedSystemMetrics
    timestamp: str
    is_simulated_data: bool = True


# Request models
class InitializeScenarioRequest(BaseModel):
    seed: Optional[int] = Field(default=42, ge=0, le=999999)
    demand_level: Optional[DemandLevel] = Field(default=DemandLevel.NORMAL)
    intercity_capacity: Optional[int] = Field(default=250, ge=50, le=1000)


class StepSimulationRequest(BaseModel):
    steps_to_advance: Optional[int] = Field(default=1, ge=1, le=50)


class ScenarioGenerateRequest(BaseModel):
    seed: Optional[int] = None
    demand_level: Optional[DemandLevel] = DemandLevel.NORMAL
    city_a_population: Optional[int] = Field(default=120000, ge=10000, le=1000000)
    city_b_population: Optional[int] = Field(default=95000, ge=10000, le=1000000)
