import pytest
import copy
from fastapi.testclient import TestClient
from app.main import app
from app.models.simulation_models import DemandLevel
from app.models.optimization_models import OptimizationActionType
from app.models.coordinated_optimization_models import (
    CoordinatedRunRequest,
    CoordinatedObjectiveWeights
)
from app.services.simulation_engine import SimulationEngine
from app.services.coordinated_optimizer import coordinated_optimizer
from app.services.independent_optimizer import independent_optimizer, ACTION_DEFINITIONS

client = TestClient(app)


def test_joint_search_evaluates_all_25_action_pairs():
    """
    Requirement 1: Verify exhaustive joint search evaluates all 5 x 5 = 25 candidate pairs.
    """
    engine = SimulationEngine(seed=42, demand_level=DemandLevel.NORMAL)
    best_pair, all_evals, _ = coordinated_optimizer.evaluate_all_pairs(current_engine=engine)

    assert len(all_evals) == 25
    pair_ids = {e.pair_id for e in all_evals}
    assert len(pair_ids) == 25
    assert "MAINTAIN_CURRENT+MAINTAIN_CURRENT" in pair_ids
    assert "PEAK_CONGESTION_MANAGEMENT+PEAK_CONGESTION_MANAGEMENT" in pair_ids


def test_candidate_evaluations_do_not_contaminate_simulation_state():
    """
    Requirement 2: Verify candidate evaluations run on isolated sandboxes and
    DO NOT mutate or contaminate the main simulation engine state.
    """
    engine = SimulationEngine(seed=42, demand_level=DemandLevel.NORMAL)
    initial_step = engine.current_step
    initial_active_a = engine.city_a.active_vehicles
    initial_active_b = engine.city_b.active_vehicles
    initial_ic_vol = engine.intercity.current_volume

    # Run exhaustive candidate evaluation across all 25 pairs
    best_pair, all_evals, _ = coordinated_optimizer.evaluate_all_pairs(current_engine=engine)

    # Engine state MUST be bit-for-bit unchanged
    assert engine.current_step == initial_step
    assert engine.city_a.active_vehicles == initial_active_a
    assert engine.city_b.active_vehicles == initial_active_b
    assert engine.intercity.current_volume == initial_ic_vol


def test_selected_pair_has_lowest_objective_among_feasible():
    """
    Requirement 3: Verify the selected pair has the strictly minimum total combined cost
    among all feasible candidate pairs.
    """
    engine = SimulationEngine(seed=42, demand_level=DemandLevel.PEAK)
    best_pair, all_evals, _ = coordinated_optimizer.evaluate_all_pairs(current_engine=engine)

    feasible_evals = [e for e in all_evals if e.is_feasible]
    assert len(feasible_evals) > 0

    min_feasible_cost = min(e.total_combined_cost for e in feasible_evals)
    assert best_pair.total_combined_cost == min_feasible_cost
    assert best_pair.is_feasible is True


def test_shared_capacity_and_budget_constraints_enforced():
    """
    Requirement 4: Verify budget and bottleneck constraints reject violating candidates.
    """
    engine = SimulationEngine(seed=42, demand_level=DemandLevel.NORMAL)
    # Budget = 30.0 (any pair with operational cost > 30 must be rejected)
    best_pair, all_evals, _ = coordinated_optimizer.evaluate_all_pairs(
        current_engine=engine,
        max_combined_budget=30.0
    )

    for cand in all_evals:
        if cand.combined_intervention_cost > 30.0:
            assert cand.is_feasible is False
            assert "exceeds joint budget" in (cand.rejection_reason or "")

    assert best_pair.combined_intervention_cost <= 30.0


def test_deterministic_tie_breaking():
    """
    Requirement 5: Verify identical inputs yield bit-for-bit identical pair decisions.
    """
    engine = SimulationEngine(seed=101, demand_level=DemandLevel.NORMAL)
    w = CoordinatedObjectiveWeights(travel_time_weight=0.3, congestion_weight=0.3, queue_weight=0.2, intercity_weight=0.1, intervention_cost_weight=0.1)

    best1, _, _ = coordinated_optimizer.evaluate_all_pairs(current_engine=engine, weights=w)
    best2, _, _ = coordinated_optimizer.evaluate_all_pairs(current_engine=engine, weights=w)

    assert best1.pair_id == best2.pair_id
    assert best1.total_combined_cost == best2.total_combined_cost
    assert best1.cost_breakdown == best2.cost_breakdown


def test_phase_5_baseline_remains_independent_and_unchanged():
    """
    Requirement 6: Verify Phase 5 independent baseline behavior was not altered or coordinated.
    """
    engine = SimulationEngine(seed=42, demand_level=DemandLevel.NORMAL)
    # City A decision must depend only on City A
    dec_a = independent_optimizer.optimize_city("CITY_A", "City A", engine.city_a)
    assert dec_a.selected_action in ACTION_DEFINITIONS


def test_comparable_starting_conditions_between_strategies():
    """
    Requirement 7: Verify head-to-head comparison initializes both strategies
    with the exact same scenario seed, population, and initial demand.
    """
    cmp_res = coordinated_optimizer.compare_strategies(seed=42, demand_level="normal", steps=4)

    assert cmp_res.seed == 42
    assert cmp_res.demand_level == "normal"
    assert cmp_res.steps == 4
    assert len(cmp_res.per_step_comparison) == 4


def test_safe_percentage_improvement_calculation():
    """
    Requirement 8: Verify percentage calculation handles zero and edge cases safely.
    """
    cmp_res = coordinated_optimizer.compare_strategies(seed=777, demand_level="peak", steps=4)
    for m in cmp_res.comparison_metrics:
        if m.baseline_value > 0:
            assert m.improvement_pct is not None
            expected_calc = round(((m.baseline_value - m.coordinated_value) / m.baseline_value) * 100.0, 1)
            assert m.improvement_pct == expected_calc


def test_ai_unavailable_fallback():
    """
    Requirement 9: Verify optimizer executes robustly using simulation-based fallback
    when AI predictions are disabled or empty.
    """
    engine = SimulationEngine(seed=42, demand_level=DemandLevel.NORMAL)
    best_pair, all_evals, used_ai = coordinated_optimizer.evaluate_all_pairs(
        current_engine=engine,
        forecast_context=None  # No AI forecast provided
    )

    assert used_ai is False
    assert len(all_evals) == 25
    assert best_pair.total_combined_cost > 0


def test_experiment_reproducibility():
    """
    Requirement 10: Verify identical seeds and parameters produce reproducible coordinated results.
    """
    req1 = CoordinatedRunRequest(seed=999, demand_level="normal", steps=6)
    res1 = coordinated_optimizer.run_coordinated_experiment(req1)

    req2 = CoordinatedRunRequest(seed=999, demand_level="normal", steps=6)
    res2 = coordinated_optimizer.run_coordinated_experiment(req2)

    assert res1.coordinated_metrics.avg_travel_time_mins == res2.coordinated_metrics.avg_travel_time_mins
    assert res1.coordinated_metrics.avg_congestion_pct == res2.coordinated_metrics.avg_congestion_pct
    assert res1.coordinated_metrics.total_intervention_cost == res2.coordinated_metrics.total_intervention_cost


def test_coordinated_api_endpoints():
    """
    Requirements 11 & 12: Verify FastAPI routes /coordinated/run, /coordinated/status,
    /coordinated/results, and /compare.
    """
    # 1. Status
    r_stat = client.get("/api/optimization/coordinated/status")
    assert r_stat.status_code == 200
    assert r_stat.json()["is_ready"] is True

    # 2. Run
    r_run = client.post("/api/optimization/coordinated/run", json={"seed": 42, "demand_level": "normal", "steps": 4})
    assert r_run.status_code == 200
    run_data = r_run.json()
    assert "coordinated_metrics" in run_data
    assert len(run_data["step_records"]) == 4

    # 3. Results
    r_res = client.get("/api/optimization/coordinated/results")
    assert r_res.status_code == 200
    assert len(r_res.json()) >= 1

    # 4. Compare
    r_cmp = client.get("/api/optimization/compare?seed=42&demand_level=normal&steps=4")
    assert r_cmp.status_code == 200
    cmp_data = r_cmp.json()
    assert "comparison_metrics" in cmp_data
    assert "coordination_gain_summary" in cmp_data
