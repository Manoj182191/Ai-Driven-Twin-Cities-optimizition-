from enum import Enum
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class ResearchScenario(str, Enum):
    NORMAL = "normal"
    HIGH = "high"
    PEAK = "peak"
    BOTTLENECK = "bottleneck"


class OptimizationStrategy(str, Enum):
    UNOPTIMIZED = "unoptimized"
    INDEPENDENT = "independent"
    COORDINATED = "coordinated"
    MPC = "mpc"
    MPC_ROBUST = "mpc_robust"


class ExperimentConfigRequest(BaseModel):
    name: Optional[str] = Field(default="Twin Cities Tri-Strategy Evaluation", description="Experiment title")
    scenarios: List[ResearchScenario] = Field(
        default=[ResearchScenario.NORMAL, ResearchScenario.PEAK, ResearchScenario.BOTTLENECK],
        description="Scenarios to evaluate"
    )
    strategies: Optional[List[OptimizationStrategy]] = Field(
        default=None,
        description="Strategies to benchmark (defaults to unoptimized, independent, coordinated; can include mpc, mpc_robust)"
    )
    num_seeds: int = Field(default=30, ge=1, le=50, description="Number of random seeds per scenario (1 to 50)")
    seed_start: int = Field(default=42, ge=1, description="Starting seed value")
    steps: int = Field(default=24, ge=6, le=48, description="Simulation duration in time steps per run")
    run_async: bool = Field(default=True, description="Run in background thread (true) or synchronously (false)")


class MetricDefinition(BaseModel):
    metric_id: str
    name: str
    unit: str
    category: str  # "primary" or "secondary"
    higher_is_better: bool
    description: str


class RunMetricRecord(BaseModel):
    experiment_id: str
    scenario: ResearchScenario
    seed: int
    strategy: OptimizationStrategy
    simulation_duration: int
    
    # Primary Metrics
    system_avg_travel_time: float = Field(..., description="System-wide average travel time (mins)")
    system_avg_congestion: float = Field(..., description="System-wide average congestion percentage (%)")
    system_avg_queue_length: float = Field(..., description="System-wide average queue length (vehicles)")
    system_objective_cost: float = Field(..., description="Combined normalized objective cost")
    
    # Secondary Metrics
    city_a_travel_time: float
    city_a_congestion: float
    city_a_queue_length: float
    city_b_travel_time: float
    city_b_congestion: float
    city_b_queue_length: float
    intercity_travel_time: float
    intercity_congestion: float
    intercity_queue_length: float
    total_intervention_cost: float = Field(..., description="Total intervention/budget cost (points)")
    total_vehicles_served: int = Field(..., description="Active vehicles processed across network")
    optimization_execution_time_ms: float = Field(..., description="Wall-clock runtime for the complete strategy run in milliseconds")


class DescriptiveStatistics(BaseModel):
    mean: float
    median: float
    std_dev: float
    min_val: float
    max_val: float
    ci_95_lower: float
    ci_95_upper: float
    sample_size: int


class PairedComparisonResult(BaseModel):
    metric_id: str
    metric_name: str
    unit: str
    higher_is_better: bool
    comparison_type: str  # "coordinated_vs_independent" or "coordinated_vs_unoptimized"
    
    baseline_strategy: OptimizationStrategy
    target_strategy: OptimizationStrategy
    
    mean_baseline: float
    mean_target: float
    mean_difference: float
    mean_improvement_pct: Optional[float] = None
    
    ci_95_diff_lower: float
    ci_95_diff_upper: float
    
    t_statistic: Optional[float] = None
    p_value_parametric: Optional[float] = None
    p_value_wilcoxon: Optional[float] = None
    p_value_adjusted_holm: Optional[float] = None
    
    effect_size_cohen_dz: Optional[float] = None
    is_statistically_significant: bool = False
    practical_significance_note: str = ""


class ScenarioStatisticalSummary(BaseModel):
    scenario: ResearchScenario
    sample_size_per_strategy: int
    descriptive_by_strategy: Dict[str, Dict[str, DescriptiveStatistics]]  # strategy -> metric_id -> stats
    paired_comparisons: List[PairedComparisonResult]


class ResearchExperimentStatus(BaseModel):
    experiment_id: str
    name: str
    status: str  # "pending", "running", "completed", "failed"
    progress_pct: float
    completed_runs: int
    total_expected_runs: int
    current_scenario: Optional[str] = None
    current_seed: Optional[int] = None
    created_at: str
    completed_at: Optional[str] = None
    error_message: Optional[str] = None


class ResearchExperimentResponse(BaseModel):
    experiment_id: str
    name: str
    status: str
    created_at: str
    completed_at: Optional[str] = None
    config: ExperimentConfigRequest
    metric_definitions: List[MetricDefinition]
    scenario_summaries: Dict[str, ScenarioStatisticalSummary]
    total_runs_completed: int
    computational_cost_summary: Dict[str, float]  # strategy -> avg runtime ms
    research_summary_text: str
    academic_disclaimer: str
    run_records: Optional[List[RunMetricRecord]] = None
