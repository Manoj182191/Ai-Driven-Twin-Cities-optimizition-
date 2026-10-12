import pytest
import numpy as np
from fastapi.testclient import TestClient

from app.main import app
from app.models.research_models import (
    ResearchScenario,
    OptimizationStrategy,
    ExperimentConfigRequest
)
from app.services.statistical_evaluator import (
    compute_descriptive_stats,
    compute_paired_comparison,
    apply_holm_bonferroni
)
from app.services.research_experiment_runner import experiment_runner
from app.services.research_storage import storage_service

client = TestClient(app)


def test_descriptive_statistics_and_confidence_intervals():
    """Verifies descriptive stats and 95% Student's t confidence interval bounds."""
    # Known data: mean = 10, std = 2, n = 5
    data = [8.0, 9.0, 10.0, 11.0, 12.0]
    stats = compute_descriptive_stats(data)
    assert stats.sample_size == 5
    assert stats.mean == 10.0
    assert stats.median == 10.0
    assert stats.min_val == 8.0
    assert stats.max_val == 12.0
    assert stats.std_dev > 0.0
    # CI bounds must bracket the sample mean
    assert stats.ci_95_lower < stats.mean < stats.ci_95_upper

    # Single item edge case
    single_stat = compute_descriptive_stats([42.0])
    assert single_stat.sample_size == 1
    assert single_stat.mean == 42.0
    assert single_stat.ci_95_lower == 42.0
    assert single_stat.ci_95_upper == 42.0


def test_paired_comparison_and_zero_denominator_safety():
    """Verifies paired differences, paired t-test, Wilcoxon, Cohen's dz, and safe division."""
    baseline = [20.0, 22.0, 24.0, 26.0, 28.0]
    target = [18.0, 19.0, 21.0, 23.0, 24.0]  # Lower is better (improvements)
    
    cmp_res = compute_paired_comparison(
        metric_id="test_metric",
        metric_name="Test Metric",
        unit="mins",
        higher_is_better=False,
        comparison_type="coordinated_vs_independent",
        baseline_strategy=OptimizationStrategy.INDEPENDENT,
        target_strategy=OptimizationStrategy.COORDINATED,
        baseline_values=baseline,
        target_values=target
    )
    assert cmp_res.mean_baseline == 24.0
    assert cmp_res.mean_target == 21.0
    assert cmp_res.mean_difference == 3.0
    assert cmp_res.mean_improvement_pct is not None
    assert cmp_res.mean_improvement_pct > 0.0
    assert cmp_res.ci_95_diff_lower < cmp_res.mean_difference < cmp_res.ci_95_diff_upper
    assert cmp_res.t_statistic is not None
    assert cmp_res.p_value_parametric is not None
    assert cmp_res.p_value_parametric < 0.05
    assert cmp_res.effect_size_cohen_dz is not None
    assert cmp_res.effect_size_cohen_dz > 0.8  # Large effect

    # Zero baseline safety check
    zero_base = [0.0, 0.0]
    zero_target = [5.0, 5.0]
    zero_cmp = compute_paired_comparison(
        metric_id="zero_metric",
        metric_name="Zero Metric",
        unit="pts",
        higher_is_better=False,
        comparison_type="test",
        baseline_strategy=OptimizationStrategy.INDEPENDENT,
        target_strategy=OptimizationStrategy.COORDINATED,
        baseline_values=zero_base,
        target_values=zero_target
    )
    assert zero_cmp.mean_improvement_pct is None  # Handled safely as None, not crashing or inf


def test_holm_bonferroni_multiple_testing_correction():
    """Verifies that step-down Holm-Bonferroni strictly controls family-wise error rate."""
    comp1 = compute_paired_comparison("m1", "M1", "%", False, "t", OptimizationStrategy.INDEPENDENT, OptimizationStrategy.COORDINATED, [10, 12, 14], [9, 11, 13])
    comp2 = compute_paired_comparison("m2", "M2", "%", False, "t", OptimizationStrategy.INDEPENDENT, OptimizationStrategy.COORDINATED, [10, 12, 14], [10, 12, 14])
    
    comp1.p_value_parametric = 0.01
    comp2.p_value_parametric = 0.04
    
    adjusted = apply_holm_bonferroni([comp1, comp2])
    # For m=2: smallest p (0.01) is multiplied by 2 -> 0.02, next p (0.04) multiplied by 1 -> 0.04
    assert adjusted[0].p_value_adjusted_holm == 0.02
    assert adjusted[1].p_value_adjusted_holm == 0.04
    assert adjusted[0].is_statistically_significant is True
    assert adjusted[1].is_statistically_significant is True


def test_matched_tri_strategy_experiment_execution():
    """Verifies that all three strategies (unoptimized, independent, coordinated) run on matched states."""
    config = ExperimentConfigRequest(
        name="Unit Test Small Experiment",
        scenarios=[ResearchScenario.NORMAL],
        num_seeds=2,
        seed_start=100,
        steps=6,
        run_async=False  # Synchronous for test speed
    )
    
    exp_id = experiment_runner.launch_experiment(config)
    exp = storage_service.get_experiment(exp_id)
    assert exp is not None
    assert exp.status == "completed"
    assert exp.total_runs_completed == 2 * 1 * 3  # 2 seeds * 1 scenario * 3 strategies = 6 runs
    
    # Verify run records
    records = exp.run_records
    assert len(records) == 6
    
    strategies_present = {r.strategy for r in records}
    assert strategies_present == {
        OptimizationStrategy.UNOPTIMIZED,
        OptimizationStrategy.INDEPENDENT,
        OptimizationStrategy.COORDINATED
    }
    
    unopt_seed100 = next(r for r in records if r.seed == 100 and r.strategy == OptimizationStrategy.UNOPTIMIZED)
    indep_seed100 = next(r for r in records if r.seed == 100 and r.strategy == OptimizationStrategy.INDEPENDENT)
    coord_seed100 = next(r for r in records if r.seed == 100 and r.strategy == OptimizationStrategy.COORDINATED)

    # Verify each strategy completed with valid metrics on the matched seed
    assert unopt_seed100.system_avg_congestion > 0
    assert indep_seed100.system_avg_congestion > 0
    assert coord_seed100.system_avg_congestion > 0
    assert coord_seed100.system_objective_cost > 0
    assert indep_seed100.system_objective_cost > 0
    assert unopt_seed100.system_objective_cost > 0


def test_experiment_reproducibility():
    """Verifies identical outcomes across two independent executions with identical seed and config."""
    config1 = ExperimentConfigRequest(
        name="Reproducibility Run 1",
        scenarios=[ResearchScenario.NORMAL],
        num_seeds=1,
        seed_start=555,
        steps=6,
        run_async=False
    )
    config2 = ExperimentConfigRequest(
        name="Reproducibility Run 2",
        scenarios=[ResearchScenario.NORMAL],
        num_seeds=1,
        seed_start=555,
        steps=6,
        run_async=False
    )
    
    id1 = experiment_runner.launch_experiment(config1)
    id2 = experiment_runner.launch_experiment(config2)
    
    exp1 = storage_service.get_experiment(id1)
    exp2 = storage_service.get_experiment(id2)
    
    assert exp1 is not None and exp2 is not None
    assert exp1.run_records[0].system_avg_travel_time == exp2.run_records[0].system_avg_travel_time
    assert exp1.run_records[0].system_avg_congestion == exp2.run_records[0].system_avg_congestion
    assert exp1.run_records[0].system_avg_queue_length == exp2.run_records[0].system_avg_queue_length


def test_research_api_endpoints_and_exports():
    """Verifies all API routes: run, status, results, statistics, history, export CSV/JSON."""
    # 1. Run validation
    invalid_res = client.post("/api/research/experiments/run", json={"num_seeds": 0})
    assert invalid_res.status_code in (400, 422)

    # 2. Launch valid fast experiment
    run_res = client.post("/api/research/experiments/run", json={
        "name": "API Test Experiment",
        "scenarios": ["normal"],
        "num_seeds": 2,
        "seed_start": 300,
        "steps": 6,
        "run_async": False
    })
    assert run_res.status_code == 200
    exp_data = run_res.json()
    exp_id = exp_data["experiment_id"]
    assert exp_data["status"] in ("pending", "completed")

    # 3. Status endpoint
    stat_res = client.get(f"/api/research/experiments/status/{exp_id}")
    assert stat_res.status_code == 200
    assert stat_res.json()["progress_pct"] == 100.0

    # 4. Results endpoint
    results_res = client.get(f"/api/research/experiments/{exp_id}/results")
    assert results_res.status_code == 200
    results_data = results_res.json()
    assert results_data["status"] == "completed"
    assert "scenario_summaries" in results_data
    assert "academic_disclaimer" in results_data

    # 5. Statistics endpoint
    stats_res = client.get(f"/api/research/experiments/{exp_id}/statistics")
    assert stats_res.status_code == 200
    assert "scenario_summaries" in stats_res.json()

    # 6. History endpoint
    hist_res = client.get("/api/research/experiments/history")
    assert hist_res.status_code == 200
    assert any(h["experiment_id"] == exp_id for h in hist_res.json())

    # 7. Export CSV
    csv_res = client.get(f"/api/research/experiments/{exp_id}/export?format=csv")
    assert csv_res.status_code == 200
    assert "system_avg_travel_time" in csv_res.text
    assert "experiment_id" in csv_res.text

    # 8. Export JSON
    json_res = client.get(f"/api/research/experiments/{exp_id}/export?format=json")
    assert json_res.status_code == 200
    assert json_res.json()["experiment_id"] == exp_id
