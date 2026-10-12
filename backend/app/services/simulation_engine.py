import math
import copy
from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple
from ..models.simulation_models import (
    CityState,
    Road,
    IntercityConnection,
    DemandLevel,
    CongestionBand,
    CombinedSystemMetrics,
    StepHistoryRecord,
    SimulationStateResponse,
    CitySummaryMetrics,
    IntercitySummaryMetrics,
    MetricsResponse
)
from .generator import SyntheticDataGenerator, calculate_bpr_travel_time, get_congestion_band


class SimulationEngine:
    """
    Core stateful simulation engine managing City A, City B, and the Intercity Corridor.
    Adheres strictly to vehicle conservation, BPR travel times, and discrete time steps.
    """

    def __init__(self, seed: int = 42, demand_level: DemandLevel = DemandLevel.NORMAL):
        self.seed = seed
        self.demand_level = demand_level
        self.generator = SyntheticDataGenerator(seed=seed)
        
        # State tracking
        self.current_step = 0
        self.scenario_id = f"SCENARIO-{seed}-{demand_level.value.upper()}"
        
        # Initialize initial state
        self.city_a, self.city_b, self.intercity = self.generator.generate(
            demand_level=demand_level
        )
        self.initial_city_a = copy.deepcopy(self.city_a)
        self.initial_city_b = copy.deepcopy(self.city_b)
        self.initial_intercity = copy.deepcopy(self.intercity)
        
        self.history: List[StepHistoryRecord] = []
        self._record_history()

    def reset(self) -> SimulationStateResponse:
        """Resets the simulation to the initial state of the active scenario."""
        self.current_step = 0
        self.city_a = copy.deepcopy(self.initial_city_a)
        self.city_b = copy.deepcopy(self.initial_city_b)
        self.intercity = copy.deepcopy(self.initial_intercity)
        self.history = []
        self._record_history()
        return self.get_state_response()

    def reinitialize(
        self,
        seed: int,
        demand_level: DemandLevel,
        intercity_capacity: int = 250,
        city_a_pop: int = 120000,
        city_b_pop: int = 95000
    ) -> SimulationStateResponse:
        """Initializes a new scenario with specified seed and demand level."""
        self.seed = seed
        self.demand_level = demand_level
        self.scenario_id = f"SCENARIO-{seed}-{demand_level.value.upper()}"
        self.generator = SyntheticDataGenerator(seed=seed)
        self.current_step = 0

        self.city_a, self.city_b, self.intercity = self.generator.generate(
            demand_level=demand_level,
            city_a_pop=city_a_pop,
            city_b_pop=city_b_pop,
            intercity_capacity=intercity_capacity
        )
        self.initial_city_a = copy.deepcopy(self.city_a)
        self.initial_city_b = copy.deepcopy(self.city_b)
        self.initial_intercity = copy.deepcopy(self.intercity)

        self.history = []
        self._record_history()
        return self.get_state_response()

    def _get_time_of_day_demand_factor(self, step: int) -> float:
        """
        Diurnal traffic pattern model:
        Simulates morning rush (steps 4-8) and evening rush (steps 16-20)
        over a 24-step simulation day cycle.
        """
        cycle_step = step % 24
        # Two harmonic peaks: morning (hour 8) and evening (hour 17)
        morning_peak = math.exp(-((cycle_step - 6) ** 2) / 6.0) * 0.45
        evening_peak = math.exp(-((cycle_step - 17) ** 2) / 6.0) * 0.40
        base_trough = 0.65 + 0.15 * math.sin(cycle_step * math.pi / 12)
        return round(base_trough + morning_peak + evening_peak, 3)

    def advance_step(self, steps: int = 1, action_a: Optional[str] = None, action_b: Optional[str] = None) -> SimulationStateResponse:
        """
        Advances the simulation by one or more discrete time steps.
        Updates demand, intercity flow, queues, capacities, and metrics.
        Optionally applies independent or joint traffic actions to City A and City B.
        """
        for _ in range(steps):
            self.current_step += 1
            self._step_internal(action_a=action_a, action_b=action_b)
            self._record_history()

        return self.get_state_response()

    def _step_internal(self, action_a: Optional[str] = None, action_b: Optional[str] = None):
        """Single discrete time-step simulation logic with optional action applications."""
        # 1. Calculate time-of-day demand multiplier
        time_factor = self._get_time_of_day_demand_factor(self.current_step)
        demand_level_mult = {
            DemandLevel.LOW: 0.65,
            DemandLevel.NORMAL: 1.0,
            DemandLevel.PEAK: 1.45
        }[self.demand_level]

        # Calculate step demand for each city
        step_demand_a = int(self.initial_city_a.total_demand * time_factor * (1.0 + (self.generator.rng.random() - 0.5) * 0.1))
        step_demand_b = int(self.initial_city_b.total_demand * time_factor * (1.0 + (self.generator.rng.random() - 0.5) * 0.1))

        # Action: PEAK_CONGESTION_MANAGEMENT (reduces raw inbound city demand by -18%)
        if action_a == "PEAK_CONGESTION_MANAGEMENT":
            step_demand_a = int(step_demand_a * 0.82)
        if action_b == "PEAK_CONGESTION_MANAGEMENT":
            step_demand_b = int(step_demand_b * 0.82)

        self.city_a.total_demand = step_demand_a
        self.city_b.total_demand = step_demand_b

        # 2. Intercity Corridor Flow:
        # A portion (11% to 12%) of demand seeks cross-boundary transit
        intercity_inflow_a_to_b = int(step_demand_a * 0.12)
        intercity_inflow_b_to_a = int(step_demand_b * 0.11)

        # Action: RAMP_METERING_RESTRICTION (throttles outbound gateway flow to protect bottleneck)
        if action_a == "RAMP_METERING_RESTRICTION":
            intercity_inflow_a_to_b = int(intercity_inflow_a_to_b * 0.85)
        if action_b == "RAMP_METERING_RESTRICTION":
            intercity_inflow_b_to_a = int(intercity_inflow_b_to_a * 0.85)

        total_intercity_inflow = intercity_inflow_a_to_b + intercity_inflow_b_to_a

        # Update Intercity Corridor
        ic_cap = self.intercity.capacity
        ic_potential_flow = self.intercity.current_volume * 0.4 + total_intercity_inflow + self.intercity.queue_length
        
        ic_served = min(ic_potential_flow, ic_cap)
        new_ic_queue = max(0, int(ic_potential_flow - ic_cap))
        self.intercity.current_volume = int(ic_served)
        self.intercity.queue_length = new_ic_queue
        
        ic_util = (self.intercity.current_volume + new_ic_queue) / max(ic_cap, 1)
        self.intercity.raw_utilization = round(ic_util, 3)
        self.intercity.congestion_level = min(100.0, round(ic_util * 100.0, 1))
        self.intercity.travel_time_mins = calculate_bpr_travel_time(
            self.intercity.length_km,
            self.intercity.free_flow_speed_kmh,
            self.intercity.current_volume,
            ic_cap,
            new_ic_queue
        )
        self.intercity.congestion_band = get_congestion_band(self.intercity.congestion_level)

        # 3. Simulate City A Roads with City A's chosen action
        city_a_internal_demand = step_demand_a - intercity_inflow_a_to_b + int(ic_served * 0.45)
        self._simulate_city_network(self.city_a, city_a_internal_demand, action=action_a)
        self.city_a.vehicles_entering = int(step_demand_a)
        self.city_a.vehicles_leaving = int(sum(r.current_vehicles for r in self.city_a.roads) * 0.35 + ic_served * 0.5)
        self.city_a.current_step = self.current_step

        # 4. Simulate City B Roads with City B's chosen action
        city_b_internal_demand = step_demand_b - intercity_inflow_b_to_a + int(ic_served * 0.45)
        self._simulate_city_network(self.city_b, city_b_internal_demand, action=action_b)
        self.city_b.vehicles_entering = int(step_demand_b)
        self.city_b.vehicles_leaving = int(sum(r.current_vehicles for r in self.city_b.roads) * 0.35 + ic_served * 0.5)
        self.city_b.current_step = self.current_step

    def _simulate_city_network(self, city: CityState, net_demand: int, action: Optional[str] = None):
        """Simulates traffic distribution, capacity bottleneck, and queues on roads."""
        num_roads = len(city.roads)
        # Allocate demand across roads weighted by capacity
        total_city_cap = sum(r.capacity for r in city.roads)

        for road in city.roads:
            effective_cap = road.capacity
            # Action: LOCAL_SIGNAL_TIMING (+10% arterial green-wave capacity boost)
            if action == "LOCAL_SIGNAL_TIMING" and getattr(road, "category", None) == "arterial":
                effective_cap = int(road.capacity * 1.10)
            # Action: DYNAMIC_LOCAL_REROUTING (+12% throughput across internal city roads)
            elif action == "DYNAMIC_LOCAL_REROUTING":
                effective_cap = int(road.capacity * 1.12)

            cap_share = road.capacity / max(total_city_cap, 1)
            inflow = int(net_demand * cap_share * (1.0 + (self.generator.rng.random() - 0.5) * 0.2))
            
            # Incoming vehicles = remaining unserviced + new inflow + queue
            total_active = int(road.current_vehicles * 0.45) + inflow + road.queue_length
            
            # Service capacity
            serviced = min(total_active, effective_cap)
            new_queue = max(0, total_active - effective_cap)
            
            road.current_vehicles = int(serviced)
            road.queue_length = int(new_queue)
            
            utilization = (road.current_vehicles + road.queue_length) / max(effective_cap, 1)
            road.raw_utilization = round(utilization, 3)
            road.congestion_level = min(100.0, round(utilization * 100.0, 1))
            road.travel_time_mins = calculate_bpr_travel_time(
                road.length_km,
                road.free_flow_speed_kmh,
                road.current_vehicles,
                effective_cap,
                road.queue_length
            )
            road.congestion_band = get_congestion_band(road.congestion_level)

        # Update City Summary Metrics
        city.active_vehicles = sum(r.current_vehicles for r in city.roads)
        city.available_capacity = max(0, city.total_capacity - city.active_vehicles)
        city.current_congestion = round(sum(r.congestion_level for r in city.roads) / num_roads, 1)
        city.avg_travel_time = round(sum(r.travel_time_mins for r in city.roads) / num_roads, 2)
        city.avg_queue_length = round(sum(r.queue_length for r in city.roads) / num_roads, 1)

    def get_combined_metrics(self) -> CombinedSystemMetrics:
        """
        Calculates joint metrics across City A, City B, and the Intercity corridor
        without double counting vehicles.
        """
        total_demand = self.city_a.total_demand + self.city_b.total_demand
        
        # Total vehicles across all unique elements
        total_active_vehicles = (
            self.city_a.active_vehicles + 
            self.city_b.active_vehicles + 
            self.intercity.current_volume
        )
        
        total_queues = (
            sum(r.queue_length for r in self.city_a.roads) +
            sum(r.queue_length for r in self.city_b.roads) +
            self.intercity.queue_length
        )

        all_roads_count = len(self.city_a.roads) + len(self.city_b.roads) + 1
        all_congestion_sum = (
            sum(r.congestion_level for r in self.city_a.roads) +
            sum(r.congestion_level for r in self.city_b.roads) +
            self.intercity.congestion_level
        )
        system_congestion = round(all_congestion_sum / all_roads_count, 1)

        # Weighted travel time across all active vehicles
        all_tt_sum = (
            sum(r.travel_time_mins * r.current_vehicles for r in self.city_a.roads) +
            sum(r.travel_time_mins * r.current_vehicles for r in self.city_b.roads) +
            (self.intercity.travel_time_mins * self.intercity.current_volume)
        )
        avg_tt = round(all_tt_sum / max(total_active_vehicles, 1), 2)

        return CombinedSystemMetrics(
            total_demand=total_demand,
            avg_travel_time_mins=avg_tt,
            system_congestion_pct=system_congestion,
            total_queues=total_queues,
            total_active_vehicles=total_active_vehicles,
            intercity_crossings=self.intercity.current_volume
        )

    def _record_history(self):
        """Records telemetry for trend charts."""
        combined = self.get_combined_metrics()
        record = StepHistoryRecord(
            step=self.current_step,
            timestamp=datetime.now(timezone.utc).isoformat(),
            city_a_demand=self.city_a.total_demand,
            city_a_congestion=self.city_a.current_congestion,
            city_a_travel_time=self.city_a.avg_travel_time,
            city_b_demand=self.city_b.total_demand,
            city_b_congestion=self.city_b.current_congestion,
            city_b_travel_time=self.city_b.avg_travel_time,
            intercity_volume=self.intercity.current_volume,
            intercity_congestion=self.intercity.congestion_level,
            combined_congestion=combined.system_congestion_pct,
            combined_travel_time=combined.avg_travel_time_mins,
            combined_queues=combined.total_queues
        )
        self.history.append(record)
        # Keep maximum 200 history steps
        if len(self.history) > 200:
            self.history.pop(0)

    def get_state_response(self) -> SimulationStateResponse:
        """Returns the full state payload for frontend consumption."""
        return SimulationStateResponse(
            simulation_step=self.current_step,
            scenario_id=self.scenario_id,
            seed=self.seed,
            demand_level=self.demand_level,
            timestamp=datetime.now(timezone.utc).isoformat(),
            is_simulated_data=True,
            city_a=self.city_a,
            city_b=self.city_b,
            intercity_connection=self.intercity,
            combined_metrics=self.get_combined_metrics(),
            history_length=len(self.history),
            history=self.history
        )

    def get_metrics_response(self) -> MetricsResponse:
        """Returns a lightweight metrics payload."""
        combined = self.get_combined_metrics()
        return MetricsResponse(
            simulation_step=self.current_step,
            scenario_id=self.scenario_id,
            demand_level=self.demand_level,
            city_a=CitySummaryMetrics(
                city_id=self.city_a.city_id,
                name=self.city_a.name,
                demand=self.city_a.total_demand,
                congestion_pct=self.city_a.current_congestion,
                avg_travel_time_mins=self.city_a.avg_travel_time,
                avg_queue_vehicles=self.city_a.avg_queue_length,
                active_vehicles=self.city_a.active_vehicles,
                vehicles_entering=self.city_a.vehicles_entering,
                vehicles_leaving=self.city_a.vehicles_leaving,
                congestion_band=get_congestion_band(self.city_a.current_congestion)
            ),
            city_b=CitySummaryMetrics(
                city_id=self.city_b.city_id,
                name=self.city_b.name,
                demand=self.city_b.total_demand,
                congestion_pct=self.city_b.current_congestion,
                avg_travel_time_mins=self.city_b.avg_travel_time,
                avg_queue_vehicles=self.city_b.avg_queue_length,
                active_vehicles=self.city_b.active_vehicles,
                vehicles_entering=self.city_b.vehicles_entering,
                vehicles_leaving=self.city_b.vehicles_leaving,
                congestion_band=get_congestion_band(self.city_b.current_congestion)
            ),
            intercity=IntercitySummaryMetrics(
                connection_id=self.intercity.connection_id,
                name=self.intercity.name,
                volume=self.intercity.current_volume,
                capacity=self.intercity.capacity,
                congestion_pct=self.intercity.congestion_level,
                queue_length=self.intercity.queue_length,
                travel_time_mins=self.intercity.travel_time_mins,
                congestion_band=get_congestion_band(self.intercity.congestion_level)
            ),
            combined=combined,
            timestamp=datetime.now(timezone.utc).isoformat(),
            is_simulated_data=True
        )


# Global singleton instance for in-memory simulation state
sim_engine = SimulationEngine()
