from enum import Enum
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any


class OptimizationActionType(str, Enum):
    MAINTAIN_CURRENT = "MAINTAIN_CURRENT"
    LOCAL_SIGNAL_TIMING = "LOCAL_SIGNAL_TIMING"
    RAMP_METERING_RESTRICTION = "RAMP_METERING_RESTRICTION"
    DYNAMIC_LOCAL_REROUTING = "DYNAMIC_LOCAL_REROUTING"
    PEAK_CONGESTION_MANAGEMENT = "PEAK_CONGESTION_MANAGEMENT"


class OptimizationActionDefinition(BaseModel):
    action_type: OptimizationActionType
    name: str
    description: str
    target_scope: str
    capacity_impact_pct: float = Field(..., description="Percentage adjustment to arterial/local road capacity")
    demand_impact_pct: float = Field(..., description="Percentage reduction to incoming local demand")
    gateway_inflow_impact_pct: float = Field(..., description="Percentage adjustment to intercity gateway outbound flow")
    operational_cost: float = Field(..., description="Resource or operational cost of intervention (0-100 scale)")
    constraints: List[str] = Field(default_factory=list)


class ObjectiveWeights(BaseModel):
    travel_time_weight: float = Field(default=0.35, ge=0.0, le=1.0)
    congestion_weight: float = Field(default=0.35, ge=0.0, le=1.0)
    queue_weight: float = Field(default=0.20, ge=0.0, le=1.0)
    resource_cost_weight: float = Field(default=0.10, ge=0.0, le=1.0)


class LocalCandidateEvaluation(BaseModel):
    action_type: OptimizationActionType
    action_name: str
    is_feasible: bool
    rejection_reason: Optional[str] = None
    expected_travel_time: float
    expected_congestion: float
    expected_queue_length: float
    operational_cost: float
    cost_breakdown: Dict[str, float]
    total_local_cost: float


class CityDecision(BaseModel):
    city_id: str
    city_name: str
    step: int
    selected_action: OptimizationActionType
    selected_action_name: str
    explanation: str
    expected_travel_time: float
    expected_congestion: float
    expected_queue_length: float
    operational_cost: float
    total_local_cost: float
    cost_breakdown: Dict[str, float]
    candidate_evaluations: List[LocalCandidateEvaluation]
    local_inputs_snapshot: Dict[str, Any]


class StepOptimizationRecord(BaseModel):
    step: int
    city_a_decision: CityDecision
    city_b_decision: CityDecision
    # Post-step actual observed metrics
    observed_city_a: Dict[str, Any]
    observed_city_b: Dict[str, Any]
    observed_intercity: Dict[str, Any]
    observed_combined: Dict[str, Any]


class OptimizationAggregateMetrics(BaseModel):
    avg_travel_time_mins: float
    avg_congestion_pct: float
    avg_queue_length: float
    total_active_vehicles: int
    intercity_volume: int
    total_intervention_cost: float
    total_objective_cost: float


class IndependentRunRequest(BaseModel):
    seed: int = Field(default=42, ge=0)
    demand_level: str = Field(default="normal", pattern="^(low|normal|peak)$")
    steps: int = Field(default=24, ge=1, le=72)
    include_unoptimized_reference: bool = Field(default=True)
    weights: Optional[ObjectiveWeights] = None


class IndependentRunResponse(BaseModel):
    run_id: str
    scenario_id: str
    seed: int
    demand_level: str
    total_steps: int
    timestamp: str
    computation_time_ms: float
    baseline_metrics: OptimizationAggregateMetrics
    reference_metrics: Optional[OptimizationAggregateMetrics] = None
    improvement_vs_reference: Optional[Dict[str, float]] = None
    step_records: List[StepOptimizationRecord]


class OptimizationStatusResponse(BaseModel):
    is_ready: bool
    last_run_id: Optional[str] = None
    last_run_timestamp: Optional[str] = None
    available_actions_count: int
    active_weights: ObjectiveWeights
