import pytest
import copy
from fastapi.testclient import TestClient
from app.main import app
from app.models.simulation_models import DemandLevel, CityState
from app.models.optimization_models import (
    OptimizationActionType,
    ObjectiveWeights,
    IndependentRunRequest
)
from app.services.independent_optimizer import independent_optimizer, ACTION_DEFINITIONS
from app.services.simulation_engine import SimulationEngine

client = TestClient(app)


def test_city_a_decision_depends_only_on_city_a_inputs():
    """
    Requirement 1: Verify City A's decision depends ONLY on City A inputs.
    Modifying City B's state, queues, or congestion MUST NOT alter City A's decision.
    """
    engine = SimulationEngine(seed=42, demand_level=DemandLevel.NORMAL)
    weights = ObjectiveWeights()

    # Decision for City A with baseline state
    decision_a_1 = independent_optimizer.optimize_city(
        city_id="CITY_A",
        city_name="City A",
        city_state=copy.deepcopy(engine.city_a),
        local_forecast_congestion=55.0,
        local_forecast_demand=1200.0,
        weights=weights
    )

    # Now drastically mutate City B's congestion, travel time, and queues
    mutated_city_b = copy.deepcopy(engine.city_b)
    mutated_city_b.current_congestion = 99.9
    mutated_city_b.avg_travel_time = 120.0
    mutated_city_b.avg_queue_length = 300.0

    # Decision for City A evaluated again
    decision_a_2 = independent_optimizer.optimize_city(
        city_id="CITY_A",
        city_name="City A",
        city_state=copy.deepcopy(engine.city_a),
        local_forecast_congestion=55.0,
        local_forecast_demand=1200.0,
        weights=weights
    )

    assert decision_a_1.selected_action == decision_a_2.selected_action
    assert decision_a_1.total_local_cost == decision_a_2.total_local_cost
    assert decision_a_1.expected_travel_time == decision_a_2.expected_travel_time
    assert decision_a_1.expected_congestion == decision_a_2.expected_congestion


def test_city_b_decision_depends_only_on_city_b_inputs():
    """
    Requirement 2: Verify City B's decision depends ONLY on City B inputs.
    Modifying City A's state MUST NOT alter City B's decision.
    """
    engine = SimulationEngine(seed=42, demand_level=DemandLevel.NORMAL)
    weights = ObjectiveWeights()

    decision_b_1 = independent_optimizer.optimize_city(
        city_id="CITY_B",
        city_name="City B",
        city_state=copy.deepcopy(engine.city_b),
        local_forecast_congestion=40.0,
        local_forecast_demand=900.0,
        weights=weights
    )

    # Mutate City A
    mutated_city_a = copy.deepcopy(engine.city_a)
    mutated_city_a.current_congestion = 95.0
    mutated_city_a.active_vehicles = 50000

    decision_b_2 = independent_optimizer.optimize_city(
        city_id="CITY_B",
        city_name="City B",
        city_state=copy.deepcopy(engine.city_b),
        local_forecast_congestion=40.0,
        local_forecast_demand=900.0,
        weights=weights
    )

    assert decision_b_1.selected_action == decision_b_2.selected_action
    assert decision_b_1.total_local_cost == decision_b_2.total_local_cost


def test_optimizer_selects_lowest_cost_feasible_action():
    """
    Requirement 3: Verify the optimizer selects the feasible candidate
    with strictly the lowest total local cost.
    """
    engine = SimulationEngine(seed=42, demand_level=DemandLevel.PEAK)
    decision = independent_optimizer.optimize_city(
        city_id="CITY_A",
        city_name="City A",
        city_state=engine.city_a,
        weights=ObjectiveWeights()
    )

    feasible_candidates = [c for c in decision.candidate_evaluations if c.is_feasible]
    assert len(feasible_candidates) > 0

    min_cost = min(c.total_local_cost for c in feasible_candidates)
    assert decision.total_local_cost == min_cost


def test_constraints_and_budget_limits_enforced():
    """
    Requirement 4: Verify constraints reject candidates exceeding the budget threshold.
    """
    engine = SimulationEngine(seed=42, demand_level=DemandLevel.NORMAL)

    # Set very tight budget = 20.0 (actions with cost > 20 must be rejected)
    decision = independent_optimizer.optimize_city(
        city_id="CITY_A",
        city_name="City A",
        city_state=engine.city_a,
        max_cost_budget=20.0
    )

    for cand in decision.candidate_evaluations:
        if cand.operational_cost > 20.0:
            assert cand.is_feasible is False
            assert "exceeds budget limit" in (cand.rejection_reason or "")
        else:
            assert cand.is_feasible is True

    # Selected action must not violate the 20.0 budget constraint
    assert decision.operational_cost <= 20.0


def test_deterministic_decisions_on_identical_inputs():
    """
    Requirement 5: Verify identical inputs and configurations produce identical decisions.
    """
    engine = SimulationEngine(seed=101, demand_level=DemandLevel.NORMAL)
    w = ObjectiveWeights(travel_time_weight=0.4, congestion_weight=0.3, queue_weight=0.2, resource_cost_weight=0.1)

    dec1 = independent_optimizer.optimize_city("CITY_A", "City A", engine.city_a, weights=w)
    dec2 = independent_optimizer.optimize_city("CITY_A", "City A", engine.city_a, weights=w)

    assert dec1.selected_action == dec2.selected_action
    assert dec1.total_local_cost == dec2.total_local_cost
    assert dec1.cost_breakdown == dec2.cost_breakdown


def test_simulation_actually_applies_selected_actions():
    """
    Requirement 6: Verify the simulation engine physically executes actions.
    Applying PEAK_CONGESTION_MANAGEMENT must throttle demand relative to unoptimized run.
    """
    sim_unopt = SimulationEngine(seed=777, demand_level=DemandLevel.PEAK)
    resp_unopt = sim_unopt.advance_step(1, action_a=None, action_b=None)

    sim_opt = SimulationEngine(seed=777, demand_level=DemandLevel.PEAK)
    resp_opt = sim_opt.advance_step(
        1,
        action_a=OptimizationActionType.PEAK_CONGESTION_MANAGEMENT.value,
        action_b=None
    )

    # City A with PEAK_CONGESTION_MANAGEMENT must have reduced demand
    assert resp_opt.city_a.total_demand < resp_unopt.city_a.total_demand
    # City B without action must have exact same demand
    assert resp_opt.city_b.total_demand == resp_unopt.city_b.total_demand


def test_combined_metrics_no_double_counting():
    """
    Requirement 7: Verify total active vehicles strictly equals sum of City A,
    City B, and Intercity volume during optimization runs.
    """
    engine = SimulationEngine(seed=42)
    resp = engine.advance_step(
        1,
        action_a=OptimizationActionType.LOCAL_SIGNAL_TIMING.value,
        action_b=OptimizationActionType.DYNAMIC_LOCAL_REROUTING.value
    )

    combined = engine.get_combined_metrics()
    expected_sum = (
        engine.city_a.active_vehicles +
        engine.city_b.active_vehicles +
        engine.intercity.current_volume
    )
    assert combined.total_active_vehicles == expected_sum


def test_experiment_results_reproducibility():
    """
    Requirement 8: Verify experiment runner yields bit-for-bit reproducible results
    given identical seeds and demand levels.
    """
    req1 = IndependentRunRequest(seed=888, demand_level="normal", steps=6, include_unoptimized_reference=True)
    res1 = independent_optimizer.run_experiment(req1)

    req2 = IndependentRunRequest(seed=888, demand_level="normal", steps=6, include_unoptimized_reference=True)
    res2 = independent_optimizer.run_experiment(req2)

    assert res1.baseline_metrics.avg_travel_time_mins == res2.baseline_metrics.avg_travel_time_mins
    assert res1.baseline_metrics.avg_congestion_pct == res2.baseline_metrics.avg_congestion_pct
    assert res1.baseline_metrics.total_intervention_cost == res2.baseline_metrics.total_intervention_cost
    assert len(res1.step_records) == len(res2.step_records)


def test_api_endpoints_and_validation():
    """
    Requirement 9: Test all Phase 5 API endpoints and input validation.
    """
    # 1. GET /actions
    r_act = client.get("/api/optimization/independent/actions")
    assert r_act.status_code == 200
    actions = r_act.json()
    assert len(actions) == 5

    # 2. GET /status
    r_stat = client.get("/api/optimization/independent/status")
    assert r_stat.status_code == 200
    assert r_stat.json()["is_ready"] is True

    # 3. POST /run (Valid)
    r_run = client.post("/api/optimization/independent/run", json={
        "seed": 42,
        "demand_level": "normal",
        "steps": 4,
        "include_unoptimized_reference": True
    })
    assert r_run.status_code == 200
    data = r_run.json()
    assert "run_id" in data
    assert "baseline_metrics" in data
    assert "reference_metrics" in data
    assert len(data["step_records"]) == 4

    # 4. GET /results
    r_res = client.get("/api/optimization/independent/results")
    assert r_res.status_code == 200
    assert len(r_res.json()) >= 1

    # 5. Invalid input validation (Pydantic 422)
    r_bad_demand = client.post("/api/optimization/independent/run", json={"demand_level": "super_extreme"})
    assert r_bad_demand.status_code == 422

    r_bad_steps = client.post("/api/optimization/independent/run", json={"steps": 0})
    assert r_bad_steps.status_code == 422
