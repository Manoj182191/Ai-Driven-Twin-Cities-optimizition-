import pytest
from app.services.simulation_engine import SimulationEngine
from app.models.simulation_models import DemandLevel
from app.models.optimization_models import OptimizationActionType
from app.models.mpc_models import (
    PlanningMode,
    UncertaintyScenarioType,
    MPCRunRequest,
    MPCRunResponse,
    MPCPlanningDecision,
)
from app.services.mpc_optimizer import mpc_optimizer
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_mpc_config_endpoint():
    """Verify MPC config endpoint returns valid defaults and supported ranges."""
    response = client.get("/api/optimization/mpc/config")
    assert response.status_code == 200
    data = response.json()
    assert data["default_horizon"] == 3
    assert 3 in data["supported_horizons"]
    assert data["default_discount_factor"] == 0.95
    assert "nominal" in data["supported_planning_modes"]
    assert "robust" in data["supported_planning_modes"]
    assert "risk_sensitive" in data["supported_planning_modes"]

def test_mpc_decision_horizon_and_discount():
    """Verify single-decision planning computes discounted cumulative cost properly."""
    engine = SimulationEngine(seed=42, demand_level=DemandLevel.NORMAL)
    
    decision = mpc_optimizer.plan_decision(
        current_engine=engine,
        decision_step=0,
        planning_horizon=3,
        discount_factor=0.9,
        beam_width=5,
        max_search_budget=300,
        planning_mode=PlanningMode.NOMINAL,
        uncertainty_scenario=UncertaintyScenarioType.NORMAL
    )
    
    assert isinstance(decision, MPCPlanningDecision)
    assert decision.planning_horizon == 3
    assert decision.discount_factor == 0.9
    assert len(decision.planned_sequence) == 3
    assert decision.planned_sequence[0].step_offset == 0
    assert decision.planned_sequence[1].step_offset == 1
    assert decision.planned_sequence[2].step_offset == 2
    assert decision.total_candidate_evaluations > 0
    assert decision.total_candidate_evaluations <= 300
    assert decision.executed_action_a is not None
    assert decision.executed_action_b is not None
    assert decision.fallback_used is False

def test_mpc_state_isolation():
    """Verify that simulating candidate branches in isolated states does not mutate the engine."""
    engine = SimulationEngine(seed=42, demand_level=DemandLevel.NORMAL)
    initial_step = engine.current_step
    initial_active_a = engine.city_a.active_vehicles
    initial_active_b = engine.city_b.active_vehicles
    
    mpc_optimizer.plan_decision(
        current_engine=engine,
        decision_step=0,
        planning_horizon=3,
        discount_factor=0.95,
        beam_width=5,
        max_search_budget=150,
        planning_mode=PlanningMode.NOMINAL
    )
    
    # Engine must NOT have moved forward during isolated candidate branch simulation
    assert engine.current_step == initial_step
    assert engine.city_a.active_vehicles == initial_active_a
    assert engine.city_b.active_vehicles == initial_active_b

def test_mpc_receding_horizon_experiment():
    """Verify receding horizon execution runs H steps, executing only 1st action per replan."""
    request = MPCRunRequest(
        steps=6,
        planning_horizon=2,
        discount_factor=0.95,
        beam_width=3,
        max_search_budget=100,
        planning_mode=PlanningMode.NOMINAL,
        uncertainty_scenario=UncertaintyScenarioType.NORMAL,
        seed=42
    )
    
    result = mpc_optimizer.run_mpc_experiment(request)
    assert isinstance(result, MPCRunResponse)
    assert result.total_steps == 6
    assert len(result.step_decisions) == 6
    assert result.fallback_occurred is False
    assert result.mpc_metrics.avg_travel_time_mins > 0

def test_mpc_robust_and_risk_sensitive_modes():
    """Verify robust and risk-sensitive planning modes execute without error."""
    engine = SimulationEngine(seed=42, demand_level=DemandLevel.NORMAL)
    
    # Robust planning
    robust_dec = mpc_optimizer.plan_decision(
        current_engine=engine,
        decision_step=0,
        planning_horizon=2,
        discount_factor=0.95,
        beam_width=3,
        max_search_budget=100,
        planning_mode=PlanningMode.ROBUST,
        uncertainty_scenario=UncertaintyScenarioType.PEAK_SURGE
    )
    assert robust_dec.planning_mode == PlanningMode.ROBUST
    assert robust_dec.robust_worst_case_cost is not None
    
    # Risk-sensitive planning
    risk_dec = mpc_optimizer.plan_decision(
        current_engine=engine,
        decision_step=0,
        planning_horizon=2,
        discount_factor=0.95,
        beam_width=3,
        max_search_budget=100,
        planning_mode=PlanningMode.RISK_SENSITIVE,
        risk_alpha=0.75,
        uncertainty_scenario=UncertaintyScenarioType.CORRIDOR_BOTTLENECK
    )
    assert risk_dec.planning_mode == PlanningMode.RISK_SENSITIVE
    assert risk_dec.cvar_risk_metric is not None

def test_mpc_fallback_on_failure():
    """Verify fallback to Phase 6 occurs gracefully if search budget is intentionally invalid or branch fails."""
    engine = SimulationEngine(seed=42, demand_level=DemandLevel.NORMAL)
    
    # Inject failure with zero budget/beam width
    decision = mpc_optimizer.plan_decision(
        current_engine=engine,
        decision_step=0,
        planning_horizon=3,
        discount_factor=0.95,
        beam_width=0,
        max_search_budget=0,
        planning_mode=PlanningMode.NOMINAL
    )
    assert decision.fallback_used is True
    assert decision.fallback_reason is not None

def test_scenario_planning_study():
    """Verify multi-scenario comparison runs across scenarios."""
    response = mpc_optimizer.run_scenario_planning_study(
        base_seed=42,
        horizon=2,
        discount_factor=0.95
    )
    assert len(response.evaluated_scenarios) == 4
    assert response.evaluated_scenarios[0].scenario_type == UncertaintyScenarioType.NORMAL
    assert response.overall_recommended_policy != ""

def test_api_mpc_endpoints():
    """Verify POST /api/optimization/mpc/run and GET results endpoints."""
    payload = {
        "steps": 6,
        "planning_horizon": 2,
        "discount_factor": 0.95,
        "beam_width": 3,
        "max_search_budget": 100,
        "planning_mode": "nominal",
        "uncertainty_scenario": "normal",
        "seed": 42
    }
    response = client.post("/api/optimization/mpc/run", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "run_id" in data
    assert data["total_steps"] == 6
    assert len(data["step_decisions"]) == 6
    
    # Check results retrieval
    res_get = client.get("/api/optimization/mpc/results")
    assert res_get.status_code == 200
    res_data = res_get.json()
    assert len(res_data) >= 1

def test_api_scenario_endpoints():
    """Verify POST /api/optimization/scenarios/run endpoint."""
    response = client.post("/api/optimization/scenarios/run?base_seed=42&horizon=2&discount_factor=0.95")
    assert response.status_code == 200
    data = response.json()
    assert "run_id" in data
    assert len(data["evaluated_scenarios"]) == 4
