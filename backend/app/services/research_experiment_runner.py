import time
import copy
import threading
import uuid
import numpy as np
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple

from ..models.simulation_models import DemandLevel
from ..models.research_models import (
    ResearchScenario,
    OptimizationStrategy,
    ExperimentConfigRequest,
    MetricDefinition,
    RunMetricRecord,
    DescriptiveStatistics,
    PairedComparisonResult,
    ScenarioStatisticalSummary,
    ResearchExperimentStatus,
    ResearchExperimentResponse
)
from .simulation_engine import SimulationEngine
from .independent_optimizer import IndependentOptimizerService
from .coordinated_optimizer import CoordinatedOptimizerService
from .statistical_evaluator import (
    compute_descriptive_stats,
    compute_paired_comparison,
    apply_holm_bonferroni
)
from .research_storage import storage_service
from .mpc_optimizer import mpc_optimizer
from ..models.mpc_models import PlanningMode


METRIC_DEFINITIONS: List[MetricDefinition] = [
    MetricDefinition(
        metric_id="system_avg_travel_time",
        name="System Average Travel Time",
        unit="mins",
        category="primary",
        higher_is_better=False,
        description="System-wide vehicle-weighted mean travel time across City A, City B, and the Intercity Corridor."
    ),
    MetricDefinition(
        metric_id="system_avg_congestion",
        name="System Average Congestion",
        unit="%",
        category="primary",
        higher_is_better=False,
        description="Network-wide volume-to-capacity strain percentage."
    ),
    MetricDefinition(
        metric_id="system_avg_queue_length",
        name="System Average Queue Length",
        unit="vehicles",
        category="primary",
        higher_is_better=False,
        description="Average number of spillover queued vehicles waiting at intersections and bottlenecks."
    ),
    MetricDefinition(
        metric_id="system_objective_cost",
        name="System Combined Objective Cost",
        unit="score",
        category="primary",
        higher_is_better=False,
        description="Normalized multi-criteria system objective cost (travel time + congestion + queues + corridor + budget)."
    ),
    MetricDefinition(
        metric_id="city_a_travel_time",
        name="City A Travel Time",
        unit="mins",
        category="secondary",
        higher_is_better=False,
        description="Mean trip duration within City A network."
    ),
    MetricDefinition(
        metric_id="city_a_congestion",
        name="City A Congestion",
        unit="%",
        category="secondary",
        higher_is_better=False,
        description="Average road congestion percentage within City A."
    ),
    MetricDefinition(
        metric_id="city_a_queue_length",
        name="City A Queue Length",
        unit="vehicles",
        category="secondary",
        higher_is_better=False,
        description="Sum of queued vehicles across City A roads."
    ),
    MetricDefinition(
        metric_id="city_b_travel_time",
        name="City B Travel Time",
        unit="mins",
        category="secondary",
        higher_is_better=False,
        description="Mean trip duration within City B network."
    ),
    MetricDefinition(
        metric_id="city_b_congestion",
        name="City B Congestion",
        unit="%",
        category="secondary",
        higher_is_better=False,
        description="Average road congestion percentage within City B."
    ),
    MetricDefinition(
        metric_id="city_b_queue_length",
        name="City B Queue Length",
        unit="vehicles",
        category="secondary",
        higher_is_better=False,
        description="Sum of queued vehicles across City B roads."
    ),
    MetricDefinition(
        metric_id="intercity_travel_time",
        name="Intercity Corridor Travel Time",
        unit="mins",
        category="secondary",
        higher_is_better=False,
        description="BPR-governed transit time along the shared intercity arterial connection."
    ),
    MetricDefinition(
        metric_id="intercity_congestion",
        name="Intercity Corridor Congestion",
        unit="%",
        category="secondary",
        higher_is_better=False,
        description="Corridor volume-to-capacity congestion percentage."
    ),
    MetricDefinition(
        metric_id="intercity_queue_length",
        name="Intercity Corridor Queue",
        unit="vehicles",
        category="secondary",
        higher_is_better=False,
        description="Queued vehicles delayed at the intercity border gateway."
    ),
    MetricDefinition(
        metric_id="total_intervention_cost",
        name="Total Intervention Resource Cost",
        unit="points",
        category="secondary",
        higher_is_better=False,
        description="Sum of operational policy deployment costs incurred across all simulation steps."
    ),
    MetricDefinition(
        metric_id="total_vehicles_served",
        name="Total Active Vehicles Served",
        unit="vehicles",
        category="secondary",
        higher_is_better=True,
        description="Total distinct traffic volume accommodated and processed by the system."
    ),
    MetricDefinition(
        metric_id="optimization_execution_time_ms",
        name="Optimization Computation Time",
        unit="ms",
        category="secondary",
        higher_is_better=False,
        description="Wall-clock execution time for algorithmic decision optimization."
    )
]


class ResearchExperimentRunner:
    """
    Orchestrates matched, scientific multi-seed experiments comparing Unoptimized, Phase 5, and Phase 6.
    """

    def launch_experiment(self, config: ExperimentConfigRequest) -> str:
        experiment_id = f"EXP-{uuid.uuid4().hex[:8].upper()}"
        total_runs = len(config.scenarios) * config.num_seeds * 3  # 3 strategies
        
        status = ResearchExperimentStatus(
            experiment_id=experiment_id,
            name=config.name or f"Experiment {experiment_id}",
            status="pending",
            progress_pct=0.0,
            completed_runs=0,
            total_expected_runs=total_runs,
            created_at=datetime.now(timezone.utc).isoformat()
        )
        storage_service.save_status(status)

        if config.run_async:
            thread = threading.Thread(
                target=self._run_experiment_thread,
                args=(experiment_id, config),
                daemon=True
            )
            thread.start()
        else:
            self._run_experiment_thread(experiment_id, config)

        return experiment_id

    def _map_scenario_to_demand(self, scenario: ResearchScenario) -> DemandLevel:
        if scenario == ResearchScenario.NORMAL:
            return DemandLevel.NORMAL
        elif scenario in (ResearchScenario.HIGH, ResearchScenario.PEAK):
            return DemandLevel.PEAK
        elif scenario == ResearchScenario.BOTTLENECK:
            return DemandLevel.NORMAL
        return DemandLevel.NORMAL

    def _run_experiment_thread(self, experiment_id: str, config: ExperimentConfigRequest):
        try:
            status = storage_service.get_status(experiment_id)
            if not status:
                return
            status.status = "running"
            storage_service.save_status(status)

            all_records: List[RunMetricRecord] = []
            strats = config.strategies if config.strategies else [
                OptimizationStrategy.UNOPTIMIZED,
                OptimizationStrategy.INDEPENDENT,
                OptimizationStrategy.COORDINATED
            ]
            total_expected = len(config.scenarios) * config.num_seeds * len(strats)
            completed = 0
            
            runtime_acc = {strat.value: [] for strat in strats}

            for scenario in config.scenarios:
                demand_level = self._map_scenario_to_demand(scenario)
                is_bottleneck = (scenario == ResearchScenario.BOTTLENECK)

                for seed_idx in range(config.num_seeds):
                    seed = config.seed_start + seed_idx
                    
                    status.current_scenario = scenario.value
                    status.current_seed = seed
                    storage_service.save_status(status)

                    # 1. Create Base Simulation State
                    base_engine = SimulationEngine(seed=seed, demand_level=demand_level)
                    if is_bottleneck:
                        # Throttle intercity corridor capacity from 1800 to 900 to simulate severe bottleneck
                        base_engine.intercity.capacity = 900
                        base_engine.initial_intercity.capacity = 900

                    # 2. Strategy 1: Unoptimized Baseline (Zero Intervention)
                    if OptimizationStrategy.UNOPTIMIZED in strats:
                        unopt_engine = copy.deepcopy(base_engine)
                        rec_unopt, t_unopt = self._run_unoptimized(
                            experiment_id, scenario, seed, config.steps, unopt_engine
                        )
                        all_records.append(rec_unopt)
                        runtime_acc[OptimizationStrategy.UNOPTIMIZED.value].append(t_unopt)
                        completed += 1
                        status.completed_runs = completed
                        status.progress_pct = round((completed / total_expected) * 100.0, 1)
                        storage_service.save_status(status)

                    # 3. Strategy 2: Phase 5 Independent City Optimization
                    if OptimizationStrategy.INDEPENDENT in strats:
                        indep_engine = copy.deepcopy(base_engine)
                        rec_indep, t_indep = self._run_independent(
                            experiment_id, scenario, seed, config.steps, indep_engine
                        )
                        all_records.append(rec_indep)
                        runtime_acc[OptimizationStrategy.INDEPENDENT.value].append(t_indep)
                        completed += 1
                        status.completed_runs = completed
                        status.progress_pct = round((completed / total_expected) * 100.0, 1)
                        storage_service.save_status(status)

                    # 4. Strategy 3: Phase 6 Joint Coordinated Optimization
                    if OptimizationStrategy.COORDINATED in strats:
                        coord_engine = copy.deepcopy(base_engine)
                        rec_coord, t_coord = self._run_coordinated(
                            experiment_id, scenario, seed, config.steps, coord_engine
                        )
                        all_records.append(rec_coord)
                        runtime_acc[OptimizationStrategy.COORDINATED.value].append(t_coord)
                        completed += 1
                        status.completed_runs = completed
                        status.progress_pct = round((completed / total_expected) * 100.0, 1)
                        storage_service.save_status(status)

                    # 5. Strategy 4: Phase 8 Multi-Step MPC Optimization
                    if OptimizationStrategy.MPC in strats:
                        mpc_engine = copy.deepcopy(base_engine)
                        rec_mpc, t_mpc = self._run_mpc(
                            experiment_id, scenario, seed, config.steps, mpc_engine, PlanningMode.NOMINAL
                        )
                        all_records.append(rec_mpc)
                        runtime_acc[OptimizationStrategy.MPC.value].append(t_mpc)
                        completed += 1
                        status.completed_runs = completed
                        status.progress_pct = round((completed / total_expected) * 100.0, 1)
                        storage_service.save_status(status)

                    # 6. Strategy 5: Phase 8 Robust MPC Optimization
                    if OptimizationStrategy.MPC_ROBUST in strats:
                        rob_engine = copy.deepcopy(base_engine)
                        rec_rob, t_rob = self._run_mpc(
                            experiment_id, scenario, seed, config.steps, rob_engine, PlanningMode.ROBUST
                        )
                        all_records.append(rec_rob)
                        runtime_acc[OptimizationStrategy.MPC_ROBUST.value].append(t_rob)
                        completed += 1
                        status.completed_runs = completed
                        status.progress_pct = round((completed / total_expected) * 100.0, 1)
                        storage_service.save_status(status)

            # Post-Process: Compile Statistics and Summaries
            scenario_summaries = self._compile_scenario_summaries(all_records, config.scenarios)

            # Computational Cost Summary
            cost_summary = {
                strat: round(float(np.mean(rts)), 2) if rts else 0.0
                for strat, rts in runtime_acc.items()
            }

            # Generate scientific findings summary narrative
            summary_narrative = self._generate_findings_narrative(scenario_summaries)

            final_response = ResearchExperimentResponse(
                experiment_id=experiment_id,
                name=config.name or f"Experiment {experiment_id}",
                status="completed",
                created_at=status.created_at,
                completed_at=datetime.now(timezone.utc).isoformat(),
                config=config,
                metric_definitions=METRIC_DEFINITIONS,
                scenario_summaries=scenario_summaries,
                total_runs_completed=completed,
                computational_cost_summary=cost_summary,
                research_summary_text=summary_narrative,
                academic_disclaimer=(
                    "ACADEMIC & METHODOLOGICAL DISCLAIMER: All outcomes in this evaluation are derived from "
                    "synthetic digital twin simulations (calibrated BPR travel-time curves, synthetic population diurnal demand). "
                    "These outcomes represent simulation-based empirical evidence of algorithmic behavior under controlled "
                    "conditions, and must not be interpreted as empirical proof of identical performance in real-world urban municipal infrastructure."
                ),
                run_records=all_records
            )

            storage_service.save_experiment(final_response)

        except Exception as e:
            status = storage_service.get_status(experiment_id)
            if status:
                status.status = "failed"
                status.error_message = str(e)
                storage_service.save_status(status)

    def _run_unoptimized(
        self,
        experiment_id: str,
        scenario: ResearchScenario,
        seed: int,
        steps: int,
        engine: SimulationEngine
    ) -> Tuple[RunMetricRecord, float]:
        start_time = time.perf_counter()
        
        hist_travel_time = []
        hist_congestion = []
        hist_queues = []
        hist_vehicles = []
        
        hist_city_a_tt = []
        hist_city_a_cong = []
        hist_city_a_q = []
        
        hist_city_b_tt = []
        hist_city_b_cong = []
        hist_city_b_q = []
        
        hist_ic_tt = []
        hist_ic_cong = []
        hist_ic_q = []

        for _ in range(steps):
            # Maintain current: no action applied
            state = engine.advance_step(steps=1, action_a="MAINTAIN_CURRENT", action_b="MAINTAIN_CURRENT")
            
            hist_travel_time.append(state.combined_metrics.avg_travel_time_mins)
            hist_congestion.append(state.combined_metrics.system_congestion_pct)
            hist_queues.append(state.combined_metrics.total_queues)
            hist_vehicles.append(state.combined_metrics.total_active_vehicles)
            
            hist_city_a_tt.append(state.city_a.avg_travel_time)
            hist_city_a_cong.append(state.city_a.current_congestion)
            hist_city_a_q.append(state.city_a.avg_queue_length)
            
            hist_city_b_tt.append(state.city_b.avg_travel_time)
            hist_city_b_cong.append(state.city_b.current_congestion)
            hist_city_b_q.append(state.city_b.avg_queue_length)
            
            hist_ic_tt.append(state.intercity_connection.travel_time_mins)
            hist_ic_cong.append(state.intercity_connection.congestion_level)
            hist_ic_q.append(state.intercity_connection.queue_length)

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        mean_tt = float(np.mean(hist_travel_time))
        mean_cong = float(np.mean(hist_congestion))
        mean_q = float(np.mean(hist_queues))
        mean_ic_tt = float(np.mean(hist_ic_tt))

        # Standard normalized objective cost formula
        obj_cost = round(
            0.30 * (mean_tt / 30.0) +
            0.30 * (mean_cong / 100.0) +
            0.15 * (mean_q / 500.0) +
            0.15 * (mean_ic_tt / 35.0) +
            0.10 * (0.0 / 120.0),
            4
        )

        record = RunMetricRecord(
            experiment_id=experiment_id,
            scenario=scenario,
            seed=seed,
            strategy=OptimizationStrategy.UNOPTIMIZED,
            simulation_duration=steps,
            system_avg_travel_time=round(mean_tt, 2),
            system_avg_congestion=round(mean_cong, 2),
            system_avg_queue_length=round(mean_q, 2),
            system_objective_cost=obj_cost,
            city_a_travel_time=round(float(np.mean(hist_city_a_tt)), 2),
            city_a_congestion=round(float(np.mean(hist_city_a_cong)), 2),
            city_a_queue_length=round(float(np.mean(hist_city_a_q)), 2),
            city_b_travel_time=round(float(np.mean(hist_city_b_tt)), 2),
            city_b_congestion=round(float(np.mean(hist_city_b_cong)), 2),
            city_b_queue_length=round(float(np.mean(hist_city_b_q)), 2),
            intercity_travel_time=round(mean_ic_tt, 2),
            intercity_congestion=round(float(np.mean(hist_ic_cong)), 2),
            intercity_queue_length=round(float(np.mean(hist_ic_q)), 2),
            total_intervention_cost=0.0,
            total_vehicles_served=int(np.sum(hist_vehicles)),
            optimization_execution_time_ms=round(elapsed_ms, 2)
        )
        return record, elapsed_ms

    def _run_independent(
        self,
        experiment_id: str,
        scenario: ResearchScenario,
        seed: int,
        steps: int,
        engine: SimulationEngine
    ) -> Tuple[RunMetricRecord, float]:
        start_time = time.perf_counter()
        opt = IndependentOptimizerService()

        hist_travel_time = []
        hist_congestion = []
        hist_queues = []
        hist_vehicles = []
        
        hist_city_a_tt = []
        hist_city_a_cong = []
        hist_city_a_q = []
        
        hist_city_b_tt = []
        hist_city_b_cong = []
        hist_city_b_q = []
        
        hist_ic_tt = []
        hist_ic_cong = []
        hist_ic_q = []
        
        total_cost = 0.0

        for s in range(1, steps + 1):
            dec_a = opt.optimize_city("CITY_A", "City A", engine.city_a)
            dec_b = opt.optimize_city("CITY_B", "City B", engine.city_b)
            
            act_a = dec_a.selected_action.value
            act_b = dec_b.selected_action.value
            total_cost += dec_a.operational_cost + dec_b.operational_cost
            
            state = engine.advance_step(steps=1, action_a=act_a, action_b=act_b)

            hist_travel_time.append(state.combined_metrics.avg_travel_time_mins)
            hist_congestion.append(state.combined_metrics.system_congestion_pct)
            hist_queues.append(state.combined_metrics.total_queues)
            hist_vehicles.append(state.combined_metrics.total_active_vehicles)
            
            hist_city_a_tt.append(state.city_a.avg_travel_time)
            hist_city_a_cong.append(state.city_a.current_congestion)
            hist_city_a_q.append(state.city_a.avg_queue_length)
            
            hist_city_b_tt.append(state.city_b.avg_travel_time)
            hist_city_b_cong.append(state.city_b.current_congestion)
            hist_city_b_q.append(state.city_b.avg_queue_length)
            
            hist_ic_tt.append(state.intercity_connection.travel_time_mins)
            hist_ic_cong.append(state.intercity_connection.congestion_level)
            hist_ic_q.append(state.intercity_connection.queue_length)

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        mean_tt = float(np.mean(hist_travel_time))
        mean_cong = float(np.mean(hist_congestion))
        mean_q = float(np.mean(hist_queues))
        mean_ic_tt = float(np.mean(hist_ic_tt))

        obj_cost = round(
            0.30 * (mean_tt / 30.0) +
            0.30 * (mean_cong / 100.0) +
            0.15 * (mean_q / 500.0) +
            0.15 * (mean_ic_tt / 35.0) +
            0.10 * (min(120.0, total_cost / steps) / 120.0),
            4
        )

        record = RunMetricRecord(
            experiment_id=experiment_id,
            scenario=scenario,
            seed=seed,
            strategy=OptimizationStrategy.INDEPENDENT,
            simulation_duration=steps,
            system_avg_travel_time=round(mean_tt, 2),
            system_avg_congestion=round(mean_cong, 2),
            system_avg_queue_length=round(mean_q, 2),
            system_objective_cost=obj_cost,
            city_a_travel_time=round(float(np.mean(hist_city_a_tt)), 2),
            city_a_congestion=round(float(np.mean(hist_city_a_cong)), 2),
            city_a_queue_length=round(float(np.mean(hist_city_a_q)), 2),
            city_b_travel_time=round(float(np.mean(hist_city_b_tt)), 2),
            city_b_congestion=round(float(np.mean(hist_city_b_cong)), 2),
            city_b_queue_length=round(float(np.mean(hist_city_b_q)), 2),
            intercity_travel_time=round(mean_ic_tt, 2),
            intercity_congestion=round(float(np.mean(hist_ic_cong)), 2),
            intercity_queue_length=round(float(np.mean(hist_ic_q)), 2),
            total_intervention_cost=round(total_cost, 1),
            total_vehicles_served=int(np.sum(hist_vehicles)),
            optimization_execution_time_ms=round(elapsed_ms, 2)
        )
        return record, elapsed_ms

    def _run_coordinated(
        self,
        experiment_id: str,
        scenario: ResearchScenario,
        seed: int,
        steps: int,
        engine: SimulationEngine
    ) -> Tuple[RunMetricRecord, float]:
        start_time = time.perf_counter()
        coord_opt = CoordinatedOptimizerService()

        hist_travel_time = []
        hist_congestion = []
        hist_queues = []
        hist_vehicles = []
        
        hist_city_a_tt = []
        hist_city_a_cong = []
        hist_city_a_q = []
        
        hist_city_b_tt = []
        hist_city_b_cong = []
        hist_city_b_q = []
        
        hist_ic_tt = []
        hist_ic_cong = []
        hist_ic_q = []
        
        total_cost = 0.0

        for s in range(1, steps + 1):
            best_eval, _, _ = coord_opt.evaluate_all_pairs(engine)
            act_a = best_eval.action_a.value
            act_b = best_eval.action_b.value
            total_cost += best_eval.combined_intervention_cost
            
            state = engine.advance_step(steps=1, action_a=act_a, action_b=act_b)

            hist_travel_time.append(state.combined_metrics.avg_travel_time_mins)
            hist_congestion.append(state.combined_metrics.system_congestion_pct)
            hist_queues.append(state.combined_metrics.total_queues)
            hist_vehicles.append(state.combined_metrics.total_active_vehicles)
            
            hist_city_a_tt.append(state.city_a.avg_travel_time)
            hist_city_a_cong.append(state.city_a.current_congestion)
            hist_city_a_q.append(state.city_a.avg_queue_length)
            
            hist_city_b_tt.append(state.city_b.avg_travel_time)
            hist_city_b_cong.append(state.city_b.current_congestion)
            hist_city_b_q.append(state.city_b.avg_queue_length)
            
            hist_ic_tt.append(state.intercity_connection.travel_time_mins)
            hist_ic_cong.append(state.intercity_connection.congestion_level)
            hist_ic_q.append(state.intercity_connection.queue_length)

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        mean_tt = float(np.mean(hist_travel_time))
        mean_cong = float(np.mean(hist_congestion))
        mean_q = float(np.mean(hist_queues))
        mean_ic_tt = float(np.mean(hist_ic_tt))

        obj_cost = round(
            0.30 * (mean_tt / 30.0) +
            0.30 * (mean_cong / 100.0) +
            0.15 * (mean_q / 500.0) +
            0.15 * (mean_ic_tt / 35.0) +
            0.10 * (min(120.0, total_cost / steps) / 120.0),
            4
        )

        record = RunMetricRecord(
            experiment_id=experiment_id,
            scenario=scenario,
            seed=seed,
            strategy=OptimizationStrategy.COORDINATED,
            simulation_duration=steps,
            system_avg_travel_time=round(mean_tt, 2),
            system_avg_congestion=round(mean_cong, 2),
            system_avg_queue_length=round(mean_q, 2),
            system_objective_cost=obj_cost,
            city_a_travel_time=round(float(np.mean(hist_city_a_tt)), 2),
            city_a_congestion=round(float(np.mean(hist_city_a_cong)), 2),
            city_a_queue_length=round(float(np.mean(hist_city_a_q)), 2),
            city_b_travel_time=round(float(np.mean(hist_city_b_tt)), 2),
            city_b_congestion=round(float(np.mean(hist_city_b_cong)), 2),
            city_b_queue_length=round(float(np.mean(hist_city_b_q)), 2),
            intercity_travel_time=round(mean_ic_tt, 2),
            intercity_congestion=round(float(np.mean(hist_ic_cong)), 2),
            intercity_queue_length=round(float(np.mean(hist_ic_q)), 2),
            total_intervention_cost=round(total_cost, 1),
            total_vehicles_served=int(np.sum(hist_vehicles)),
            optimization_execution_time_ms=round(elapsed_ms, 2)
        )
        return record, elapsed_ms

    def _run_mpc(
        self,
        experiment_id: str,
        scenario: ResearchScenario,
        seed: int,
        steps: int,
        engine: SimulationEngine,
        planning_mode: PlanningMode = PlanningMode.NOMINAL
    ) -> Tuple[RunMetricRecord, float]:
        start_time = time.perf_counter()

        hist_travel_time = []
        hist_congestion = []
        hist_queues = []
        hist_vehicles = []
        
        hist_city_a_tt = []
        hist_city_a_cong = []
        hist_city_a_q = []
        
        hist_city_b_tt = []
        hist_city_b_cong = []
        hist_city_b_q = []
        
        hist_ic_tt = []
        hist_ic_cong = []
        hist_ic_q = []
        
        total_cost = 0.0

        for s in range(steps):
            dec = mpc_optimizer.plan_decision(
                current_engine=engine,
                decision_step=s,
                planning_horizon=3,
                discount_factor=0.95,
                beam_width=4,
                max_search_budget=150,
                planning_mode=planning_mode
            )
            act_a = dec.executed_action_a.value
            act_b = dec.executed_action_b.value
            total_cost += dec.executed_intervention_cost
            
            state = engine.advance_step(steps=1, action_a=act_a, action_b=act_b)

            hist_travel_time.append(state.combined_metrics.avg_travel_time_mins)
            hist_congestion.append(state.combined_metrics.system_congestion_pct)
            hist_queues.append(state.combined_metrics.total_queues)
            hist_vehicles.append(state.combined_metrics.total_active_vehicles)
            
            hist_city_a_tt.append(state.city_a.avg_travel_time)
            hist_city_a_cong.append(state.city_a.current_congestion)
            hist_city_a_q.append(state.city_a.avg_queue_length)
            
            hist_city_b_tt.append(state.city_b.avg_travel_time)
            hist_city_b_cong.append(state.city_b.current_congestion)
            hist_city_b_q.append(state.city_b.avg_queue_length)
            
            hist_ic_tt.append(state.intercity_connection.travel_time_mins)
            hist_ic_cong.append(state.intercity_connection.congestion_level)
            hist_ic_q.append(state.intercity_connection.queue_length)

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        mean_tt = float(np.mean(hist_travel_time))
        mean_cong = float(np.mean(hist_congestion))
        mean_q = float(np.mean(hist_queues))
        mean_ic_tt = float(np.mean(hist_ic_tt))

        w_tt, w_cong, w_q, w_ic, w_cost = 0.30, 0.30, 0.15, 0.15, 0.10
        norm_cost = (
            w_tt * (mean_tt / 30.0) +
            w_cong * (mean_cong / 100.0) +
            w_q * (mean_q / 500.0) +
            w_ic * (mean_ic_tt / 35.0) +
            w_cost * (total_cost / 120.0)
        )
        obj_cost = round(norm_cost, 4)

        strategy_type = OptimizationStrategy.MPC_ROBUST if planning_mode == PlanningMode.ROBUST else OptimizationStrategy.MPC

        record = RunMetricRecord(
            run_id=f"RUN-{uuid.uuid4().hex[:8].upper()}",
            experiment_id=experiment_id,
            scenario=scenario,
            seed=seed,
            strategy=strategy_type,
            simulation_duration=steps,
            system_avg_travel_time=round(mean_tt, 2),
            system_avg_congestion=round(mean_cong, 2),
            system_avg_queue_length=round(mean_q, 2),
            system_objective_cost=obj_cost,
            city_a_travel_time=round(float(np.mean(hist_city_a_tt)), 2),
            city_a_congestion=round(float(np.mean(hist_city_a_cong)), 2),
            city_a_queue_length=round(float(np.mean(hist_city_a_q)), 2),
            city_b_travel_time=round(float(np.mean(hist_city_b_tt)), 2),
            city_b_congestion=round(float(np.mean(hist_city_b_cong)), 2),
            city_b_queue_length=round(float(np.mean(hist_city_b_q)), 2),
            intercity_travel_time=round(mean_ic_tt, 2),
            intercity_congestion=round(float(np.mean(hist_ic_cong)), 2),
            intercity_queue_length=round(float(np.mean(hist_ic_q)), 2),
            total_intervention_cost=round(total_cost, 1),
            total_vehicles_served=int(np.sum(hist_vehicles)),
            optimization_execution_time_ms=round(elapsed_ms, 2)
        )
        return record, elapsed_ms

    def _compile_scenario_summaries(
        self,
        records: List[RunMetricRecord],
        scenarios: List[ResearchScenario]
    ) -> Dict[str, ScenarioStatisticalSummary]:
        res = {}
        for sc in scenarios:
            sc_records = [r for r in records if r.scenario == sc]
            if not sc_records:
                continue

            # Group by strategy
            by_strat = {
                OptimizationStrategy.UNOPTIMIZED.value: [r for r in sc_records if r.strategy == OptimizationStrategy.UNOPTIMIZED],
                OptimizationStrategy.INDEPENDENT.value: [r for r in sc_records if r.strategy == OptimizationStrategy.INDEPENDENT],
                OptimizationStrategy.COORDINATED.value: [r for r in sc_records if r.strategy == OptimizationStrategy.COORDINATED],
                OptimizationStrategy.MPC.value: [r for r in sc_records if r.strategy == OptimizationStrategy.MPC],
                OptimizationStrategy.MPC_ROBUST.value: [r for r in sc_records if r.strategy == OptimizationStrategy.MPC_ROBUST]
            }

            sample_size = len(by_strat[OptimizationStrategy.UNOPTIMIZED.value]) if by_strat[OptimizationStrategy.UNOPTIMIZED.value] else len(sc_records)

            # Calculate descriptive stats for each strategy and metric
            desc_map: Dict[str, Dict[str, DescriptiveStatistics]] = {}
            for strat, s_recs in by_strat.items():
                desc_map[strat] = {}
                for m_def in METRIC_DEFINITIONS:
                    vals = [getattr(r, m_def.metric_id) for r in s_recs]
                    desc_map[strat][m_def.metric_id] = compute_descriptive_stats(vals)

            # Paired comparisons: Coordinated vs Independent
            comparisons: List[PairedComparisonResult] = []
            indep_recs = sorted(by_strat[OptimizationStrategy.INDEPENDENT.value], key=lambda r: r.seed)
            coord_recs = sorted(by_strat[OptimizationStrategy.COORDINATED.value], key=lambda r: r.seed)

            for m_def in METRIC_DEFINITIONS:
                base_vals = [getattr(r, m_def.metric_id) for r in indep_recs]
                target_vals = [getattr(r, m_def.metric_id) for r in coord_recs]
                
                cmp_res = compute_paired_comparison(
                    metric_id=m_def.metric_id,
                    metric_name=m_def.name,
                    unit=m_def.unit,
                    higher_is_better=m_def.higher_is_better,
                    comparison_type="coordinated_vs_independent",
                    baseline_strategy=OptimizationStrategy.INDEPENDENT,
                    target_strategy=OptimizationStrategy.COORDINATED,
                    baseline_values=base_vals,
                    target_values=target_vals
                )
                comparisons.append(cmp_res)

            # Apply Holm-Bonferroni correction
            comparisons = apply_holm_bonferroni(comparisons)

            res[sc.value] = ScenarioStatisticalSummary(
                scenario=sc,
                sample_size_per_strategy=sample_size,
                descriptive_by_strategy=desc_map,
                paired_comparisons=comparisons
            )

        return res

    def _generate_findings_narrative(
        self,
        summaries: Dict[str, ScenarioStatisticalSummary]
    ) -> str:
        lines = []
        lines.append("RESEARCH EVALUATION EXECUTIVE SUMMARY:")
        for sc_name, summary in summaries.items():
            lines.append(f"\n--- Scenario: {sc_name.upper()} (N = {summary.sample_size_per_strategy} matched seeds) ---")
            for cmp_res in summary.paired_comparisons:
                if cmp_res.metric_id in ("system_avg_travel_time", "system_avg_congestion", "system_avg_queue_length"):
                    sig_label = "Statistically Significant (p < 0.05)" if cmp_res.is_statistically_significant else "Not Statistically Significant (p >= 0.05)"
                    p_val_str = f"p={cmp_res.p_value_adjusted_holm:.4f}" if cmp_res.p_value_adjusted_holm is not None else "p=N/A"
                    imp_str = f"{cmp_res.mean_improvement_pct}%" if cmp_res.mean_improvement_pct is not None else "N/A"
                    lines.append(
                        f"• {cmp_res.metric_name}: Coordinated mean {cmp_res.mean_target} {cmp_res.unit} vs Independent {cmp_res.mean_baseline} {cmp_res.unit} "
                        f"(Improvement: {imp_str}, 95% CI: [{cmp_res.ci_95_diff_lower}, {cmp_res.ci_95_diff_upper}], {p_val_str}, {sig_label}, {cmp_res.practical_significance_note})"
                    )
        return "\n".join(lines)


experiment_runner = ResearchExperimentRunner()
