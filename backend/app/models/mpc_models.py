from enum import Enum
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

from .simulation_models import DemandLevel
from .optimization_models import OptimizationActionType, OptimizationAggregateMetrics
from .coordinated_optimization_models import CoordinatedObjectiveWeights


class PlanningMode(str, Enum):
    NOMINAL = "nominal"
    ROBUST = "robust"
    RISK_SENSITIVE = "risk_sensitive"


class UncertaintyScenarioType(str, Enum):
    NORMAL = "normal"
    PEAK_SURGE = "peak_surge"
    SUDDEN_BURST = "sudden_burst"
    CORRIDOR_BOTTLENECK = "corridor_bottleneck"
    UNEVEN_DEMAND = "uneven_demand"
    FORECAST_NOISE = "forecast_noise"


class PlannedActionStep(BaseModel):
    step_offset: int  # 0 = immediate executed step, 1 = t+1, 2 = t+2, etc.
    action_a: OptimizationActionType
    action_b: OptimizationActionType
    action_a_name: str
    action_b_name: str
    combined_intervention_cost: float
    discount_factor_weight: float
    raw_step_cost: float
    discounted_step_cost: float
    expected_system_travel_time: float
    expected_system_congestion: float
    expected_system_queues: float
    expected_intercity_delay: float


class MPCPlanningDecision(BaseModel):
    decision_step: int
    planning_mode: PlanningMode
    planning_horizon: int
    discount_factor: float
    beam_width: int
    total_candidate_evaluations: int
    
    # Executed action (first action of the selected sequence)
    executed_action_a: OptimizationActionType
    executed_action_b: OptimizationActionType
    executed_action_a_name: str
    executed_action_b_name: str
    executed_intervention_cost: float
    
    # Full multi-step planned path
    planned_sequence: List[PlannedActionStep]
    cumulative_discounted_cost: float
    
    # Uncertainty & risk metrics
    robust_worst_case_cost: Optional[float] = None
    cvar_risk_metric: Optional[float] = None
    
    # Fallback status
    fallback_used: bool = False
    fallback_reason: Optional[str] = None
    used_ai_prediction: bool = False


class MPCRunRequest(BaseModel):
    seed: int = Field(default=42, ge=1)
    demand_level: DemandLevel = DemandLevel.NORMAL
    steps: int = Field(default=24, ge=6, le=48)
    planning_horizon: int = Field(default=3, ge=1, le=5)
    discount_factor: float = Field(default=0.95, ge=0.5, le=1.0)
    beam_width: int = Field(default=5, ge=1, le=10)
    max_search_budget: int = Field(default=200, ge=25, le=500)
    planning_mode: PlanningMode = PlanningMode.NOMINAL
    uncertainty_scenario: UncertaintyScenarioType = UncertaintyScenarioType.NORMAL
    risk_alpha: float = Field(default=0.75, ge=0.5, le=0.95, description="CVaR tail percentile")
    weights: Optional[CoordinatedObjectiveWeights] = None


class MPCRunResponse(BaseModel):
    run_id: str
    scenario_id: str
    seed: int
    demand_level: str
    planning_horizon: int
    discount_factor: float
    beam_width: int
    planning_mode: str
    uncertainty_scenario: str
    total_steps: int
    computation_time_ms: float
    total_evaluations_count: int
    fallback_occurred: bool
    mpc_metrics: OptimizationAggregateMetrics
    step_decisions: List[MPCPlanningDecision]

    class Config:
        populate_by_name = True


class ScenarioComparisonItem(BaseModel):
    scenario_type: UncertaintyScenarioType
    name: str
    nominal_cost: float
    robust_cost: float
    risk_sensitive_cost: float
    recommended_action_pair: str
    vulnerability_notes: str


class ScenarioPlanningRunResponse(BaseModel):
    run_id: str
    timestamp: str
    base_seed: int
    planning_horizon: int
    discount_factor: float
    evaluated_scenarios: List[ScenarioComparisonItem]
    overall_recommended_policy: str
    robustness_summary: str


class MPCConfigResponse(BaseModel):
    supported_horizons: List[int]
    default_horizon: int
    default_discount_factor: float
    default_beam_width: int
    supported_planning_modes: List[str]
    supported_uncertainty_scenarios: List[str]
    max_search_budget_limit: int
    action_space_size_per_step: int
