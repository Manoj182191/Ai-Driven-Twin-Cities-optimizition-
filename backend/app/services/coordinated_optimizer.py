import time
import copy
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple, Any
from ..models.simulation_models import DemandLevel, CityState, IntercityConnection
from ..models.optimization_models import (
    OptimizationActionType,
    OptimizationAggregateMetrics
)
from ..models.coordinated_optimization_models import (
    CoordinatedObjectiveWeights,
    JointCandidateEvaluation,
    JointDecision,
    StepCoordinatedRecord,
    CoordinatedRunRequest,
    CoordinatedRunResponse,
    ComparisonMetricItem,
    HeadToHeadComparisonResponse,
    CoordinatedStatusResponse
)
from .simulation_engine import SimulationEngine
from .independent_optimizer import (
    ACTION_DEFINITIONS,
    NORM_TRAVEL_TIME_MINS,
    NORM_CONGESTION_PCT,
    NORM_QUEUE_LENGTH,
    NORM_OPERATIONAL_COST,
    independent_optimizer
)
from .ai_predictor import ai_predictor

NORM_INTERCITY_TRAVEL_TIME_MINS = 25.0


class CoordinatedOptimizerService:
    """
    Phase 6 Joint Coordinated Optimization Service.
    Evaluates all 25 discrete (action_a, action_b) candidate pairs simultaneously
    considering dual-city network interactions, shared corridor dynamics,
    and a unified multi-criteria system objective.
    """

    def __init__(self):
        self.default_weights = CoordinatedObjectiveWeights(
            travel_time_weight=0.30,
            congestion_weight=0.30,
            queue_weight=0.15,
            intercity_weight=0.15,
            intervention_cost_weight=0.10
        )
        self.last_run_result: Optional[CoordinatedRunResponse] = None
        self.results_history: List[CoordinatedRunResponse] = []
        self.comparison_history: List[HeadToHeadComparisonResponse] = []

    def get_status(self) -> CoordinatedStatusResponse:
        """Returns readiness and parameters of the coordinated optimizer."""
        return CoordinatedStatusResponse(
            is_ready=True,
            last_run_id=self.last_run_result.run_id if self.last_run_result else None,
            last_run_timestamp=self.last_run_result.timestamp if self.last_run_result else None,
            available_pairs_count=25,
            active_weights=self.default_weights,
            ai_prediction_ready=ai_predictor.is_trained
        )

    def evaluate_all_pairs(
        self,
        current_engine: SimulationEngine,
        weights: Optional[CoordinatedObjectiveWeights] = None,
        max_combined_budget: float = 120.0,
        forecast_context: Optional[Dict[str, float]] = None
    ) -> Tuple[JointCandidateEvaluation, List[JointCandidateEvaluation], bool]:
        """
        Exhaustively evaluates all 25 (action_a, action_b) candidate pairs
        using isolated sandbox copies to prevent state contamination.
        """
        w = weights or self.default_weights
        all_evaluations: List[JointCandidateEvaluation] = []
        used_ai = forecast_context is not None and len(forecast_context) > 0

        action_keys = list(ACTION_DEFINITIONS.keys())

        # Exhaustive search over all 5 x 5 = 25 action pairs
        for act_a_key in action_keys:
            act_a_def = ACTION_DEFINITIONS[act_a_key]
            for act_b_key in action_keys:
                act_b_def = ACTION_DEFINITIONS[act_b_key]
                pair_id = f"{act_a_key.value}+{act_b_key.value}"

                # 1. Budget constraint check
                combined_cost = act_a_def.operational_cost + act_b_def.operational_cost
                is_feasible = True
                rejection_reason = None

                if combined_cost > max_combined_budget:
                    is_feasible = False
                    rejection_reason = f"Combined intervention cost ({combined_cost:.1f}) exceeds joint budget ({max_combined_budget:.1f})."

                # 2. Isolated sandbox simulation to prevent state mutation
                sandbox_engine = copy.deepcopy(current_engine)
                sandbox_resp = sandbox_engine.advance_step(
                    steps=1,
                    action_a=act_a_key.value,
                    action_b=act_b_key.value
                )

                # Read physical simulation metrics from isolated sandbox
                exp_tt = sandbox_resp.combined_metrics.avg_travel_time_mins
                exp_cong = sandbox_resp.combined_metrics.system_congestion_pct
                exp_q = float(sandbox_resp.combined_metrics.total_queues)
                exp_ic = sandbox_resp.intercity_connection.travel_time_mins

                # 3. Optional forecast-aware adjustment if AI forecasts available
                if used_ai and forecast_context:
                    # If high incoming intercity volume is forecasted, penalize lack of gateway buffering
                    avg_pred_cong = (
                        forecast_context.get("city_a_congestion", exp_cong) +
                        forecast_context.get("city_b_congestion", exp_cong)
                    ) / 2.0
                    if avg_pred_cong > 65.0:
                        # High forecasted congestion: actions providing demand dampening or metering yield extra relief
                        if act_a_key == OptimizationActionType.PEAK_CONGESTION_MANAGEMENT or act_b_key == OptimizationActionType.PEAK_CONGESTION_MANAGEMENT:
                            exp_cong = max(20.0, exp_cong * 0.95)
                            exp_tt = max(8.0, exp_tt * 0.96)

                # 4. Shared bottleneck corridor constraint:
                # If intercity corridor queue exceeds 50 vehicles and neither city meters or manages demand
                if sandbox_resp.intercity_connection.queue_length > 45:
                    has_mitigation = (
                        act_a_key in [OptimizationActionType.RAMP_METERING_RESTRICTION, OptimizationActionType.PEAK_CONGESTION_MANAGEMENT] or
                        act_b_key in [OptimizationActionType.RAMP_METERING_RESTRICTION, OptimizationActionType.PEAK_CONGESTION_MANAGEMENT]
                    )
                    if not has_mitigation:
                        is_feasible = False
                        rejection_reason = "Corridor congestion critical: pair lacks gateway metering or peak demand mitigation."

                # 5. Dimensionless multi-criteria combined cost
                norm_tt = exp_tt / NORM_TRAVEL_TIME_MINS
                norm_cong = exp_cong / NORM_CONGESTION_PCT
                norm_q = exp_q / NORM_QUEUE_LENGTH
                norm_ic = exp_ic / NORM_INTERCITY_TRAVEL_TIME_MINS
                norm_cost = combined_cost / NORM_OPERATIONAL_COST

                cost_tt = w.travel_time_weight * norm_tt
                cost_cong = w.congestion_weight * norm_cong
                cost_q = w.queue_weight * norm_q
                cost_ic = w.intercity_weight * norm_ic
                cost_res = w.intervention_cost_weight * norm_cost

                total_cost = round(cost_tt + cost_cong + cost_q + cost_ic + cost_res, 4)

                eval_item = JointCandidateEvaluation(
                    pair_id=pair_id,
                    action_a=act_a_key,
                    action_b=act_b_key,
                    action_a_name=act_a_def.name,
                    action_b_name=act_b_def.name,
                    is_feasible=is_feasible,
                    rejection_reason=rejection_reason,
                    expected_system_travel_time=round(exp_tt, 2),
                    expected_system_congestion=round(exp_cong, 1),
                    expected_system_queues=round(exp_q, 1),
                    expected_intercity_delay=round(exp_ic, 2),
                    combined_intervention_cost=round(combined_cost, 1),
                    cost_breakdown={
                        "travel_time_cost": round(cost_tt, 4),
                        "congestion_cost": round(cost_cong, 4),
                        "queue_cost": round(cost_q, 4),
                        "intercity_cost": round(cost_ic, 4),
                        "resource_cost": round(cost_res, 4)
                    },
                    total_combined_cost=total_cost
                )
                all_evaluations.append(eval_item)

        # Deterministic tie-breaking: minimum total cost, then pair_id string order
        feasible_candidates = [ev for ev in all_evaluations if ev.is_feasible]
        if not feasible_candidates:
            # Fallback to least-cost candidate if all fail constraints
            best_pair = min(all_evaluations, key=lambda c: (c.total_combined_cost, c.pair_id))
        else:
            best_pair = min(feasible_candidates, key=lambda c: (c.total_combined_cost, c.pair_id))

        return best_pair, all_evaluations, used_ai

    def run_coordinated_experiment(self, request: CoordinatedRunRequest) -> CoordinatedRunResponse:
        """
        Executes a controlled coordinated optimization experiment over N discrete steps.
        Selects joint action pairs at each step and applies them to the main simulation.
        """
        start_time = time.perf_counter()
        weights = request.weights or self.default_weights
        demand_enum = DemandLevel(request.demand_level)

        sim_engine = SimulationEngine(seed=request.seed, demand_level=demand_enum)
        step_records: List[StepCoordinatedRecord] = []
        total_intervention_cost = 0.0
        overall_used_ai = False

        for s in range(request.steps):
            # Optional Phase 4 AI forecasts
            forecast_context = None
            if ai_predictor.is_trained:
                try:
                    pred_res = ai_predictor.predict(
                        city_a=sim_engine.city_a,
                        city_b=sim_engine.city_b,
                        intercity=sim_engine.intercity,
                        simulation_step=sim_engine.current_step,
                        demand_level=demand_enum,
                        recent_history=[h.model_dump() for h in sim_engine.history]
                    )
                    forecast_context = {
                        k: v.predicted_value for k, v in pred_res.predictions.items()
                    }
                except Exception:
                    pass

            # Joint optimization evaluation across all 25 candidate pairs
            best_pair, all_evals, used_ai = self.evaluate_all_pairs(
                current_engine=sim_engine,
                weights=weights,
                max_combined_budget=request.max_combined_budget,
                forecast_context=forecast_context
            )
            if used_ai:
                overall_used_ai = True

            total_intervention_cost += best_pair.combined_intervention_cost

            # Advance the REAL simulation with the selected optimal pair
            state_resp = sim_engine.advance_step(
                steps=1,
                action_a=best_pair.action_a.value,
                action_b=best_pair.action_b.value
            )

            explanation = (
                f"Joint optimizer coordinated '{best_pair.action_a_name}' for City A and "
                f"'{best_pair.action_b_name}' for City B (Total System Cost: {best_pair.total_combined_cost:.4f}). "
                f"Projected System Travel Time: {best_pair.expected_system_travel_time:.2f}m, "
                f"Congestion: {best_pair.expected_system_congestion:.1f}%, "
                f"Intercity Delay: {best_pair.expected_intercity_delay:.2f}m."
            )

            joint_decision = JointDecision(
                step=sim_engine.current_step,
                selected_action_a=best_pair.action_a,
                selected_action_b=best_pair.action_b,
                selected_action_a_name=best_pair.action_a_name,
                selected_action_b_name=best_pair.action_b_name,
                explanation=explanation,
                used_ai_prediction=used_ai,
                total_combined_cost=best_pair.total_combined_cost,
                cost_breakdown=best_pair.cost_breakdown,
                all_evaluated_pairs=all_evals,
                feasible_pairs_count=len([e for e in all_evals if e.is_feasible]),
                rejected_pairs_count=len([e for e in all_evals if not e.is_feasible])
            )

            step_records.append(StepCoordinatedRecord(
                step=sim_engine.current_step,
                joint_decision=joint_decision,
                observed_city_a={
                    "congestion_pct": state_resp.city_a.current_congestion,
                    "avg_travel_time": state_resp.city_a.avg_travel_time,
                    "avg_queue_length": state_resp.city_a.avg_queue_length,
                    "active_vehicles": state_resp.city_a.active_vehicles,
                    "total_demand": state_resp.city_a.total_demand
                },
                observed_city_b={
                    "congestion_pct": state_resp.city_b.current_congestion,
                    "avg_travel_time": state_resp.city_b.avg_travel_time,
                    "avg_queue_length": state_resp.city_b.avg_queue_length,
                    "active_vehicles": state_resp.city_b.active_vehicles,
                    "total_demand": state_resp.city_b.total_demand
                },
                observed_intercity={
                    "volume": state_resp.intercity_connection.current_volume,
                    "queue_length": state_resp.intercity_connection.queue_length,
                    "congestion_pct": state_resp.intercity_connection.congestion_level,
                    "travel_time_mins": state_resp.intercity_connection.travel_time_mins
                },
                observed_combined={
                    "total_active_vehicles": state_resp.combined_metrics.total_active_vehicles,
                    "system_congestion_pct": state_resp.combined_metrics.system_congestion_pct,
                    "avg_travel_time_mins": state_resp.combined_metrics.avg_travel_time_mins,
                    "total_queues": state_resp.combined_metrics.total_queues
                }
            ))

        # Compute aggregate metrics
        coord_agg = OptimizationAggregateMetrics(
            avg_travel_time_mins=round(sum(r.observed_combined["avg_travel_time_mins"] for r in step_records) / request.steps, 2),
            avg_congestion_pct=round(sum(r.observed_combined["system_congestion_pct"] for r in step_records) / request.steps, 1),
            avg_queue_length=round(sum(r.observed_combined["total_queues"] for r in step_records) / request.steps, 1),
            total_active_vehicles=int(step_records[-1].observed_combined["total_active_vehicles"]),
            intercity_volume=int(step_records[-1].observed_intercity["volume"]),
            total_intervention_cost=round(total_intervention_cost, 1),
            total_objective_cost=round(sum(r.joint_decision.total_combined_cost for r in step_records) / request.steps, 4)
        )

        elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
        run_id = f"OPT-COORD-{request.seed}-{request.demand_level.upper()}-{int(time.time())}"
        scenario_id = f"SCENARIO-{request.seed}-{request.demand_level.upper()}"
        timestamp_str = datetime.now(timezone.utc).isoformat()

        response = CoordinatedRunResponse(
            run_id=run_id,
            scenario_id=scenario_id,
            seed=request.seed,
            demand_level=request.demand_level,
            total_steps=request.steps,
            timestamp=timestamp_str,
            computation_time_ms=elapsed_ms,
            used_ai_prediction=overall_used_ai,
            coordinated_metrics=coord_agg,
            step_records=step_records
        )

        self.last_run_result = response
        self.results_history.append(response)
        return response

    def compare_strategies(
        self,
        seed: int = 42,
        demand_level: str = "normal",
        steps: int = 24
    ) -> HeadToHeadComparisonResponse:
        """
        Runs the Phase 5 Independent Baseline and Phase 6 Coordinated Optimizer
        under STRICTLY IDENTICAL initial conditions, demand, seed, and duration.
        Computes measured performance metrics and percentage gains.
        """
        # 1. Run Phase 5 Independent Baseline
        from ..models.optimization_models import IndependentRunRequest
        indep_req = IndependentRunRequest(
            seed=seed,
            demand_level=demand_level,
            steps=steps,
            include_unoptimized_reference=True
        )
        indep_res = independent_optimizer.run_experiment(indep_req)

        # 2. Run Phase 6 Coordinated Optimizer
        coord_req = CoordinatedRunRequest(
            seed=seed,
            demand_level=demand_level,
            steps=steps
        )
        coord_res = self.run_coordinated_experiment(coord_req)

        # 3. Calculate Head-to-Head Improvements:
        # Improvement (%) = (Baseline Cost - Coordinated Cost) / Baseline Cost * 100
        def safe_improvement(base_val: float, coord_val: float) -> Optional[float]:
            if base_val <= 0:
                return None
            return round(((base_val - coord_val) / base_val) * 100.0, 1)

        imp_tt = safe_improvement(indep_res.baseline_metrics.avg_travel_time_mins, coord_res.coordinated_metrics.avg_travel_time_mins)
        imp_cong = safe_improvement(indep_res.baseline_metrics.avg_congestion_pct, coord_res.coordinated_metrics.avg_congestion_pct)
        imp_q = safe_improvement(indep_res.baseline_metrics.avg_queue_length, coord_res.coordinated_metrics.avg_queue_length)
        imp_obj = safe_improvement(indep_res.baseline_metrics.total_objective_cost, coord_res.coordinated_metrics.total_objective_cost)

        metrics_comparison = [
            ComparisonMetricItem(
                metric_name="System Congestion",
                unit="%",
                baseline_value=indep_res.baseline_metrics.avg_congestion_pct,
                coordinated_value=coord_res.coordinated_metrics.avg_congestion_pct,
                improvement_pct=imp_cong,
                is_better=(imp_cong is not None and imp_cong > 0)
            ),
            ComparisonMetricItem(
                metric_name="Average Travel Time",
                unit="min",
                baseline_value=indep_res.baseline_metrics.avg_travel_time_mins,
                coordinated_value=coord_res.coordinated_metrics.avg_travel_time_mins,
                improvement_pct=imp_tt,
                is_better=(imp_tt is not None and imp_tt > 0)
            ),
            ComparisonMetricItem(
                metric_name="System Queue Burden",
                unit="veh",
                baseline_value=indep_res.baseline_metrics.avg_queue_length,
                coordinated_value=coord_res.coordinated_metrics.avg_queue_length,
                improvement_pct=imp_q,
                is_better=(imp_q is not None and imp_q > 0)
            ),
            ComparisonMetricItem(
                metric_name="Total Objective Cost",
                unit="pts",
                baseline_value=indep_res.baseline_metrics.total_objective_cost,
                coordinated_value=coord_res.coordinated_metrics.total_objective_cost,
                improvement_pct=imp_obj,
                is_better=(imp_obj is not None and imp_obj > 0)
            ),
            ComparisonMetricItem(
                metric_name="Intervention Cost",
                unit="pts",
                baseline_value=indep_res.baseline_metrics.total_intervention_cost,
                coordinated_value=coord_res.coordinated_metrics.total_intervention_cost,
                improvement_pct=safe_improvement(indep_res.baseline_metrics.total_intervention_cost, coord_res.coordinated_metrics.total_intervention_cost),
                is_better=None  # Resource usage is a budget expenditure rather than strict quality metric
            )
        ]

        # Per-step comparison series
        per_step = []
        for i in range(min(len(indep_res.step_records), len(coord_res.step_records))):
            s_indep = indep_res.step_records[i]
            s_coord = coord_res.step_records[i]
            per_step.append({
                "step": s_indep.step,
                "baseline_congestion": s_indep.observed_combined["system_congestion_pct"],
                "coordinated_congestion": s_coord.observed_combined["system_congestion_pct"],
                "baseline_travel_time": s_indep.observed_combined["avg_travel_time_mins"],
                "coordinated_travel_time": s_coord.observed_combined["avg_travel_time_mins"],
                "baseline_queues": s_indep.observed_combined["total_queues"],
                "coordinated_queues": s_coord.observed_combined["total_queues"],
                "action_a_independent": s_indep.city_a_decision.selected_action_name,
                "action_b_independent": s_indep.city_b_decision.selected_action_name,
                "action_a_coordinated": s_coord.joint_decision.selected_action_a_name,
                "action_b_coordinated": s_coord.joint_decision.selected_action_b_name
            })

        summary = (
            f"Under seed {seed} ({demand_level} demand), joint coordinated optimization achieved "
            f"{imp_cong:+0.1f}% congestion reduction and {imp_tt:+0.1f}% travel time reduction "
            f"compared to the independent local decision baseline."
            if imp_cong is not None and imp_tt is not None else
            "Comparison executed successfully across independent and coordinated strategies."
        )

        comparison_id = f"CMP-{seed}-{demand_level.upper()}-{int(time.time())}"
        timestamp_str = datetime.now(timezone.utc).isoformat()

        comparison_response = HeadToHeadComparisonResponse(
            comparison_id=comparison_id,
            seed=seed,
            demand_level=demand_level,
            steps=steps,
            timestamp=timestamp_str,
            baseline_run_id=indep_res.run_id,
            coordinated_run_id=coord_res.run_id,
            baseline_metrics=indep_res.baseline_metrics,
            coordinated_metrics=coord_res.coordinated_metrics,
            comparison_metrics=metrics_comparison,
            per_step_comparison=per_step,
            coordination_gain_summary=summary
        )

        self.comparison_history.append(comparison_response)
        return comparison_response


# Global singleton instance
coordinated_optimizer = CoordinatedOptimizerService()
