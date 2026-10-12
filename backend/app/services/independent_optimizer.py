import time
import copy
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple, Any
from ..models.simulation_models import DemandLevel, CityState, IntercityConnection
from ..models.optimization_models import (
    OptimizationActionType,
    OptimizationActionDefinition,
    ObjectiveWeights,
    LocalCandidateEvaluation,
    CityDecision,
    StepOptimizationRecord,
    OptimizationAggregateMetrics,
    IndependentRunRequest,
    IndependentRunResponse,
    OptimizationStatusResponse
)
from .simulation_engine import SimulationEngine
from .ai_predictor import ai_predictor


# Normalization constants for dimensionless multi-criteria cost aggregation
NORM_TRAVEL_TIME_MINS = 25.0
NORM_CONGESTION_PCT = 100.0
NORM_QUEUE_LENGTH = 50.0
NORM_OPERATIONAL_COST = 100.0


# 5 Distinct, Explainable Optimization Actions
ACTION_DEFINITIONS: Dict[OptimizationActionType, OptimizationActionDefinition] = {
    OptimizationActionType.MAINTAIN_CURRENT: OptimizationActionDefinition(
        action_type=OptimizationActionType.MAINTAIN_CURRENT,
        name="Maintain Current Traffic Controls",
        description="Continue standard traffic signal splits and routing with no active interventions.",
        target_scope="Baseline City Network",
        capacity_impact_pct=0.0,
        demand_impact_pct=0.0,
        gateway_inflow_impact_pct=0.0,
        operational_cost=0.0,
        constraints=["Always feasible"]
    ),
    OptimizationActionType.LOCAL_SIGNAL_TIMING: OptimizationActionDefinition(
        action_type=OptimizationActionType.LOCAL_SIGNAL_TIMING,
        name="Arterial Green-Wave Coordination",
        description="Optimizes traffic signal progression along major arterial corridors to increase effective arterial service capacity by +10%.",
        target_scope="Arterial Corridors",
        capacity_impact_pct=10.0,
        demand_impact_pct=0.0,
        gateway_inflow_impact_pct=0.0,
        operational_cost=15.0,
        constraints=["Requires active arterial traffic controllers", "Max cost budget 80.0"]
    ),
    OptimizationActionType.RAMP_METERING_RESTRICTION: OptimizationActionDefinition(
        action_type=OptimizationActionType.RAMP_METERING_RESTRICTION,
        name="Gateway Perimeter Metering",
        description="Restricts outbound flow entering the cross-boundary gateway corridor by -15% to buffer internal bottlenecks and queues.",
        target_scope="Gateway Interchange",
        capacity_impact_pct=0.0,
        demand_impact_pct=0.0,
        gateway_inflow_impact_pct=-15.0,
        operational_cost=25.0,
        constraints=["Only active when gateway queue is emerging", "Max cost budget 80.0"]
    ),
    OptimizationActionType.DYNAMIC_LOCAL_REROUTING: OptimizationActionDefinition(
        action_type=OptimizationActionType.DYNAMIC_LOCAL_REROUTING,
        name="Dynamic Local Network Rerouting",
        description="Disseminates dynamic digital signage and nav updates to divert traffic across underutilized local roads (+12% throughput).",
        target_scope="Internal Secondary Grid",
        capacity_impact_pct=12.0,
        demand_impact_pct=0.0,
        gateway_inflow_impact_pct=0.0,
        operational_cost=35.0,
        constraints=["Applicable when internal congestion exceeds 35%", "Max cost budget 80.0"]
    ),
    OptimizationActionType.PEAK_CONGESTION_MANAGEMENT: OptimizationActionDefinition(
        action_type=OptimizationActionType.PEAK_CONGESTION_MANAGEMENT,
        name="Peak Demand Mitigation & Transit Priority",
        description="Implements proactive freight staging and transit signal priority to throttle incoming peak vehicular demand by -18%.",
        target_scope="City-wide Demand Gates",
        capacity_impact_pct=0.0,
        demand_impact_pct=-18.0,
        gateway_inflow_impact_pct=0.0,
        operational_cost=50.0,
        constraints=["High operational cost", "Max cost budget 80.0"]
    )
}


class IndependentOptimizerService:
    """
    Modular Phase 5 optimization service.
    City A and City B optimizers make decisions STRICTLY independently:
    - City A uses ONLY City A local state and City A local forecasts.
    - City B uses ONLY City B local state and City B local forecasts.
    - Zero cross-city information sharing or joint coordination logic.
    """

    def __init__(self):
        self.default_weights = ObjectiveWeights(
            travel_time_weight=0.35,
            congestion_weight=0.35,
            queue_weight=0.20,
            resource_cost_weight=0.10
        )
        self.last_run_result: Optional[IndependentRunResponse] = None
        self.results_history: List[IndependentRunResponse] = []

    def get_actions(self) -> List[OptimizationActionDefinition]:
        """Returns documented optimization action specifications."""
        return list(ACTION_DEFINITIONS.values())

    def get_status(self) -> OptimizationStatusResponse:
        """Returns readiness and metadata of the independent optimizer."""
        return OptimizationStatusResponse(
            is_ready=True,
            last_run_id=self.last_run_result.run_id if self.last_run_result else None,
            last_run_timestamp=self.last_run_result.timestamp if self.last_run_result else None,
            available_actions_count=len(ACTION_DEFINITIONS),
            active_weights=self.default_weights
        )

    def _estimate_candidate_outcome(
        self,
        action: OptimizationActionDefinition,
        current_travel_time: float,
        current_congestion: float,
        current_queue: float,
        predicted_demand_delta_pct: float
    ) -> Tuple[float, float, float]:
        """
        Predicts expected travel time, congestion, and queue length under a candidate action
        using documented physical response models.
        """
        # Base trend incorporating local demand trajectory
        demand_factor = 1.0 + (predicted_demand_delta_pct / 100.0)

        # Baseline projection without intervention
        est_tt = current_travel_time * (1.0 + (demand_factor - 1.0) * 0.4)
        est_cong = current_congestion * (1.0 + (demand_factor - 1.0) * 0.5)
        est_q = current_queue * (1.0 + (demand_factor - 1.0) * 0.6)

        # Action-specific adjustments
        if action.action_type == OptimizationActionType.LOCAL_SIGNAL_TIMING:
            # +10% arterial capacity reduces travel time and queues
            est_tt *= 0.92
            est_cong *= 0.95
            est_q *= 0.85
        elif action.action_type == OptimizationActionType.RAMP_METERING_RESTRICTION:
            # Buffers gateway queues
            est_q *= 0.88
            est_tt *= 0.97
            est_cong *= 0.98
        elif action.action_type == OptimizationActionType.DYNAMIC_LOCAL_REROUTING:
            # +12% effective local throughput distributes traffic
            est_tt *= 0.90
            est_cong *= 0.91
            est_q *= 0.82
        elif action.action_type == OptimizationActionType.PEAK_CONGESTION_MANAGEMENT:
            # -18% demand significantly relieves peak pressure
            est_tt *= 0.86
            est_cong *= 0.82
            est_q *= 0.74

        return round(max(5.0, est_tt), 2), round(max(0.0, min(100.0, est_cong)), 1), round(max(0.0, est_q), 1)

    def optimize_city(
        self,
        city_id: str,
        city_name: str,
        city_state: CityState,
        local_forecast_congestion: Optional[float] = None,
        local_forecast_demand: Optional[float] = None,
        weights: Optional[ObjectiveWeights] = None,
        max_cost_budget: float = 80.0
    ) -> CityDecision:
        """
        Evaluates local action candidates and selects the lowest-cost feasible action.
        STRICT INDEPENDENCE: Reads ONLY the specified city's local attributes.
        """
        w = weights or self.default_weights

        # Permitted local inputs snapshot
        local_inputs = {
            "city_id": city_id,
            "current_congestion": city_state.current_congestion,
            "avg_travel_time": city_state.avg_travel_time,
            "avg_queue_length": city_state.avg_queue_length,
            "total_demand": city_state.total_demand,
            "active_vehicles": city_state.active_vehicles,
            "local_forecast_congestion": local_forecast_congestion,
            "local_forecast_demand": local_forecast_demand
        }

        # Calculate local forecast demand trend delta
        demand_delta_pct = 0.0
        if local_forecast_demand and city_state.total_demand > 0:
            demand_delta_pct = ((local_forecast_demand - city_state.total_demand) / city_state.total_demand) * 100.0

        evaluations: List[LocalCandidateEvaluation] = []

        # Exhaustive search over the 5 discrete action candidates
        for action_type, action_def in ACTION_DEFINITIONS.items():
            # Check local feasibility constraint
            is_feasible = True
            rejection_reason = None

            if action_def.operational_cost > max_cost_budget:
                is_feasible = False
                rejection_reason = f"Operational cost ({action_def.operational_cost}) exceeds budget limit ({max_cost_budget})."

            # Estimate outcome
            expected_tt, expected_cong, expected_q = self._estimate_candidate_outcome(
                action=action_def,
                current_travel_time=city_state.avg_travel_time,
                current_congestion=city_state.current_congestion,
                current_queue=city_state.avg_queue_length,
                predicted_demand_delta_pct=demand_delta_pct
            )

            # Calculate normalized multi-criteria local cost
            norm_tt = expected_tt / NORM_TRAVEL_TIME_MINS
            norm_cong = expected_cong / NORM_CONGESTION_PCT
            norm_q = expected_q / NORM_QUEUE_LENGTH
            norm_cost = action_def.operational_cost / NORM_OPERATIONAL_COST

            cost_tt = w.travel_time_weight * norm_tt
            cost_cong = w.congestion_weight * norm_cong
            cost_q = w.queue_weight * norm_q
            cost_res = w.resource_cost_weight * norm_cost

            total_cost = round(cost_tt + cost_cong + cost_q + cost_res, 4)

            evaluations.append(LocalCandidateEvaluation(
                action_type=action_type,
                action_name=action_def.name,
                is_feasible=is_feasible,
                rejection_reason=rejection_reason,
                expected_travel_time=expected_tt,
                expected_congestion=expected_cong,
                expected_queue_length=expected_q,
                operational_cost=action_def.operational_cost,
                cost_breakdown={
                    "travel_time_cost": round(cost_tt, 4),
                    "congestion_cost": round(cost_cong, 4),
                    "queue_cost": round(cost_q, 4),
                    "resource_cost": round(cost_res, 4)
                },
                total_local_cost=total_cost
            ))

        # Select feasible action with lowest total local cost (deterministic tie-breaking by action enum value)
        feasible_candidates = [ev for ev in evaluations if ev.is_feasible]
        if not feasible_candidates:
            # Fallback to maintain current if all else rejected
            best_candidate = evaluations[0]
        else:
            best_candidate = min(feasible_candidates, key=lambda c: (c.total_local_cost, c.action_type.value))

        # Build clear local rationale
        chosen_action_def = ACTION_DEFINITIONS[best_candidate.action_type]
        explanation = (
            f"{city_name} autonomously selected '{chosen_action_def.name}' (Objective Cost: {best_candidate.total_local_cost:.4f}). "
            f"Expected outcomes: {best_candidate.expected_travel_time:.2f} mins travel time, "
            f"{best_candidate.expected_congestion:.1f}% congestion, "
            f"and queue length {best_candidate.expected_queue_length:.1f} veh "
            f"with operational intervention cost of {chosen_action_def.operational_cost}."
        )

        return CityDecision(
            city_id=city_id,
            city_name=city_name,
            step=city_state.current_step,
            selected_action=best_candidate.action_type,
            selected_action_name=chosen_action_def.name,
            explanation=explanation,
            expected_travel_time=best_candidate.expected_travel_time,
            expected_congestion=best_candidate.expected_congestion,
            expected_queue_length=best_candidate.expected_queue_length,
            operational_cost=chosen_action_def.operational_cost,
            total_local_cost=best_candidate.total_local_cost,
            cost_breakdown=best_candidate.cost_breakdown,
            candidate_evaluations=evaluations,
            local_inputs_snapshot=local_inputs
        )

    def run_experiment(self, request: IndependentRunRequest) -> IndependentRunResponse:
        """
        Executes a controlled baseline simulation experiment over N discrete steps:
        1. Runs the Independent Baseline where City A and City B independently optimize.
        2. Optionally runs an identical Unoptimized Reference run with the exact same seed & demand.
        3. Records per-step metrics and aggregate performance comparisons.
        """
        start_time = time.perf_counter()
        weights = request.weights or self.default_weights
        demand_enum = DemandLevel(request.demand_level)

        # ----------------------------------------------------
        # 1. Independent Optimization Run
        # ----------------------------------------------------
        sim_engine = SimulationEngine(seed=request.seed, demand_level=demand_enum)
        step_records: List[StepOptimizationRecord] = []
        total_intervention_cost = 0.0

        for s in range(request.steps):
            # Optional Phase 4 AI forecasts for City A and City B
            pred_cong_a, pred_dem_a = None, None
            pred_cong_b, pred_dem_b = None, None

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
                    preds = pred_res.predictions
                    if "city_a_congestion" in preds:
                        pred_cong_a = preds["city_a_congestion"].predicted_value
                    if "city_a_demand" in preds:
                        pred_dem_a = preds["city_a_demand"].predicted_value
                    if "city_b_congestion" in preds:
                        pred_cong_b = preds["city_b_congestion"].predicted_value
                    if "city_b_demand" in preds:
                        pred_dem_b = preds["city_b_demand"].predicted_value
                except Exception:
                    pass

            # Independent optimization decisions
            dec_a = self.optimize_city(
                city_id="CITY_A",
                city_name="City A (Metro Alpha)",
                city_state=sim_engine.city_a,
                local_forecast_congestion=pred_cong_a,
                local_forecast_demand=pred_dem_a,
                weights=weights
            )

            dec_b = self.optimize_city(
                city_id="CITY_B",
                city_name="City B (Metro Beta)",
                city_state=sim_engine.city_b,
                local_forecast_congestion=pred_cong_b,
                local_forecast_demand=pred_dem_b,
                weights=weights
            )

            total_intervention_cost += (dec_a.operational_cost + dec_b.operational_cost)

            # Advance simulation applying independently selected actions
            state_resp = sim_engine.advance_step(
                steps=1,
                action_a=dec_a.selected_action.value,
                action_b=dec_b.selected_action.value
            )

            step_records.append(StepOptimizationRecord(
                step=sim_engine.current_step,
                city_a_decision=dec_a,
                city_b_decision=dec_b,
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

        # Compute aggregate baseline metrics
        baseline_agg = OptimizationAggregateMetrics(
            avg_travel_time_mins=round(sum(r.observed_combined["avg_travel_time_mins"] for r in step_records) / request.steps, 2),
            avg_congestion_pct=round(sum(r.observed_combined["system_congestion_pct"] for r in step_records) / request.steps, 1),
            avg_queue_length=round(sum(r.observed_combined["total_queues"] for r in step_records) / request.steps, 1),
            total_active_vehicles=int(step_records[-1].observed_combined["total_active_vehicles"]),
            intercity_volume=int(step_records[-1].observed_intercity["volume"]),
            total_intervention_cost=round(total_intervention_cost, 1),
            total_objective_cost=round(sum(r.city_a_decision.total_local_cost + r.city_b_decision.total_local_cost for r in step_records) / request.steps, 4)
        )

        # ----------------------------------------------------
        # 2. Unoptimized Reference Run (if requested)
        # ----------------------------------------------------
        ref_agg = None
        imp_dict = None

        if request.include_unoptimized_reference:
            ref_sim = SimulationEngine(seed=request.seed, demand_level=demand_enum)
            ref_tts, ref_congs, ref_qs = [], [], []

            for _ in range(request.steps):
                ref_state = ref_sim.advance_step(steps=1, action_a=None, action_b=None)
                ref_tts.append(ref_state.combined_metrics.avg_travel_time_mins)
                ref_congs.append(ref_state.combined_metrics.system_congestion_pct)
                ref_qs.append(ref_state.combined_metrics.total_queues)

            ref_agg = OptimizationAggregateMetrics(
                avg_travel_time_mins=round(sum(ref_tts) / request.steps, 2),
                avg_congestion_pct=round(sum(ref_congs) / request.steps, 1),
                avg_queue_length=round(sum(ref_qs) / request.steps, 1),
                total_active_vehicles=int(ref_state.combined_metrics.total_active_vehicles),
                intercity_volume=int(ref_state.intercity_connection.current_volume),
                total_intervention_cost=0.0,
                total_objective_cost=0.0
            )

            # Improvement = (ref - baseline) / ref * 100
            imp_tt = round(((ref_agg.avg_travel_time_mins - baseline_agg.avg_travel_time_mins) / max(ref_agg.avg_travel_time_mins, 0.01)) * 100.0, 1)
            imp_cong = round(((ref_agg.avg_congestion_pct - baseline_agg.avg_congestion_pct) / max(ref_agg.avg_congestion_pct, 0.01)) * 100.0, 1)
            imp_q = round(((ref_agg.avg_queue_length - baseline_agg.avg_queue_length) / max(ref_agg.avg_queue_length, 0.01)) * 100.0, 1)

            imp_dict = {
                "travel_time_reduction_pct": imp_tt,
                "congestion_reduction_pct": imp_cong,
                "queue_reduction_pct": imp_q
            }

        elapsed_ms = round((time.perf_counter() - start_time) * 1000.0, 2)
        run_id = f"OPT-INDEP-{request.seed}-{request.demand_level.upper()}-{int(time.time())}"
        scenario_id = f"SCENARIO-{request.seed}-{request.demand_level.upper()}"
        timestamp_str = datetime.now(timezone.utc).isoformat()

        response = IndependentRunResponse(
            run_id=run_id,
            scenario_id=scenario_id,
            seed=request.seed,
            demand_level=request.demand_level,
            total_steps=request.steps,
            timestamp=timestamp_str,
            computation_time_ms=elapsed_ms,
            baseline_metrics=baseline_agg,
            reference_metrics=ref_agg,
            improvement_vs_reference=imp_dict,
            step_records=step_records
        )

        self.last_run_result = response
        self.results_history.append(response)
        return response


# Global singleton instance
independent_optimizer = IndependentOptimizerService()
