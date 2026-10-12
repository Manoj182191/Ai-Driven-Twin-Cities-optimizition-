from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from .optimization_models import (
    OptimizationActionType,
    OptimizationAggregateMetrics
)


class CoordinatedObjectiveWeights(BaseModel):
    travel_time_weight: float = Field(default=0.30, ge=0.0, le=1.0)
    congestion_weight: float = Field(default=0.30, ge=0.0, le=1.0)
    queue_weight: float = Field(default=0.15, ge=0.0, le=1.0)
    intercity_weight: float = Field(default=0.15, ge=0.0, le=1.0)
    intervention_cost_weight: float = Field(default=0.10, ge=0.0, le=1.0)


class JointCandidateEvaluation(BaseModel):
    pair_id: str
    action_a: OptimizationActionType
    action_b: OptimizationActionType
    action_a_name: str
    action_b_name: str
    is_feasible: bool
    rejection_reason: Optional[str] = None
    expected_system_travel_time: float
    expected_system_congestion: float
    expected_system_queues: float
    expected_intercity_delay: float
    combined_intervention_cost: float
    cost_breakdown: Dict[str, float]
    total_combined_cost: float


class JointDecision(BaseModel):
    step: int
    selected_action_a: OptimizationActionType
    selected_action_b: OptimizationActionType
    selected_action_a_name: str
    selected_action_b_name: str
    explanation: str
    used_ai_prediction: bool
    total_combined_cost: float
    cost_breakdown: Dict[str, float]
    all_evaluated_pairs: List[JointCandidateEvaluation]
    feasible_pairs_count: int
    rejected_pairs_count: int


class StepCoordinatedRecord(BaseModel):
    step: int
    joint_decision: JointDecision
    observed_city_a: Dict[str, Any]
    observed_city_b: Dict[str, Any]
    observed_intercity: Dict[str, Any]
    observed_combined: Dict[str, Any]


class CoordinatedRunRequest(BaseModel):
    seed: int = Field(default=42, ge=0)
    demand_level: str = Field(default="normal", pattern="^(low|normal|peak)$")
    steps: int = Field(default=24, ge=1, le=72)
    weights: Optional[CoordinatedObjectiveWeights] = None
    max_combined_budget: float = Field(default=120.0, ge=0.0)


class CoordinatedRunResponse(BaseModel):
    run_id: str
    scenario_id: str
    seed: int
    demand_level: str
    total_steps: int
    timestamp: str
    computation_time_ms: float
    used_ai_prediction: bool
    coordinated_metrics: OptimizationAggregateMetrics
    step_records: List[StepCoordinatedRecord]


class ComparisonMetricItem(BaseModel):
    metric_name: str
    unit: str
    baseline_value: float
    coordinated_value: float
    improvement_pct: Optional[float] = None
    is_better: Optional[bool] = None


class HeadToHeadComparisonResponse(BaseModel):
    comparison_id: str
    seed: int
    demand_level: str
    steps: int
    timestamp: str
    baseline_run_id: str
    coordinated_run_id: str
    baseline_metrics: OptimizationAggregateMetrics
    coordinated_metrics: OptimizationAggregateMetrics
    comparison_metrics: List[ComparisonMetricItem]
    per_step_comparison: List[Dict[str, Any]]
    coordination_gain_summary: str


class CoordinatedStatusResponse(BaseModel):
    is_ready: bool
    last_run_id: Optional[str] = None
    last_run_timestamp: Optional[str] = None
    available_pairs_count: int = 25
    active_weights: CoordinatedObjectiveWeights
    ai_prediction_ready: bool
