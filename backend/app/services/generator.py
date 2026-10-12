import random
from typing import Tuple, List, Dict
from ..models.simulation_models import (
    RoadNode,
    Road,
    IntercityConnection,
    CityState,
    RoadCategory,
    CongestionBand,
    DemandLevel
)


def get_congestion_band(utilization_pct: float) -> CongestionBand:
    """Classify congestion into documented research bands."""
    if utilization_pct < 40.0:
        return CongestionBand.LOW
    elif utilization_pct < 75.0:
        return CongestionBand.MEDIUM
    elif utilization_pct < 90.0:
        return CongestionBand.HIGH
    else:
        return CongestionBand.SEVERE


def calculate_bpr_travel_time(
    length_km: float,
    free_flow_speed_kmh: float,
    volume: int,
    capacity: int,
    queue: int = 0
) -> float:
    """
    Standard Bureau of Public Roads (BPR) function for travel time in minutes:
    T = T_free * (1 + 0.15 * (V / C)^4) + delay_from_queue
    """
    free_flow_time_mins = (length_km / max(free_flow_speed_kmh, 10.0)) * 60.0
    vc_ratio = volume / max(capacity, 1)
    bpr_factor = 1.0 + 0.15 * (vc_ratio ** 4)
    queue_delay_mins = (queue / max(capacity, 1)) * 3.0  # additional congestion delay
    return round(free_flow_time_mins * bpr_factor + queue_delay_mins, 2)


class SyntheticDataGenerator:
    """
    Generates realistic, reproducible synthetic digital twin city topologies,
    capacities, and traffic demand curves.
    """

    def __init__(self, seed: int = 42):
        self.seed = seed
        self.rng = random.Random(seed)

    def generate(
        self,
        demand_level: DemandLevel = DemandLevel.NORMAL,
        city_a_pop: int = 120000,
        city_b_pop: int = 95000,
        intercity_capacity: int = 250
    ) -> Tuple[CityState, CityState, IntercityConnection]:
        """
        Generates full initial states for City A, City B, and their Intercity corridor.
        Fully deterministic based on self.seed.
        """
        # Multipliers based on demand scenario
        multipliers = {
            DemandLevel.LOW: 0.65,
            DemandLevel.NORMAL: 1.00,
            DemandLevel.PEAK: 1.45
        }
        demand_mult = multipliers.get(demand_level, 1.00)

        # 1. City A: Metro Alpha (Industrial & Tech Core)
        city_a_nodes = [
            RoadNode(node_id="A_CENTRAL", name="Metro Alpha Downtown", x=180.0, y=220.0, zone_type="commercial"),
            RoadNode(node_id="A_NORTH", name="Alpha Heights North", x=180.0, y=80.0, zone_type="residential"),
            RoadNode(node_id="A_WEST", name="West Alpha Suburb", x=50.0, y=220.0, zone_type="residential"),
            RoadNode(node_id="A_EAST", name="Alpha Industrial Port", x=310.0, y=220.0, zone_type="industrial"),
            RoadNode(node_id="A_GATEWAY", name="South Alpha Hub", x=220.0, y=360.0, zone_type="transit"),
        ]

        # Template road connections for City A
        city_a_links = [
            ("A1", "A_NORTH", "A_CENTRAL", 4.2, 180, 50.0, RoadCategory.ARTERIAL),
            ("A2", "A_CENTRAL", "A_NORTH", 4.2, 180, 50.0, RoadCategory.ARTERIAL),
            ("A3", "A_WEST", "A_CENTRAL", 5.0, 160, 45.0, RoadCategory.LOCAL),
            ("A4", "A_CENTRAL", "A_WEST", 5.0, 160, 45.0, RoadCategory.LOCAL),
            ("A5", "A_CENTRAL", "A_EAST", 4.8, 190, 50.0, RoadCategory.ARTERIAL),
            ("A6", "A_EAST", "A_CENTRAL", 4.8, 190, 50.0, RoadCategory.ARTERIAL),
            ("A7", "A_CENTRAL", "A_GATEWAY", 5.5, 220, 60.0, RoadCategory.ARTERIAL),
            ("A8", "A_GATEWAY", "A_CENTRAL", 5.5, 220, 60.0, RoadCategory.ARTERIAL),
            ("A9", "A_EAST", "A_GATEWAY", 6.0, 140, 50.0, RoadCategory.LOCAL),
            ("A10", "A_GATEWAY", "A_EAST", 6.0, 140, 50.0, RoadCategory.LOCAL),
        ]

        city_a_roads: List[Road] = []
        for r_id, start_n, end_n, length, base_cap, speed, cat in city_a_links:
            # Seed-based perturbation for variability
            cap_var = self.rng.randint(-15, 15)
            cap = max(80, base_cap + cap_var)
            
            # Initial baseline load based on demand level
            base_load = int(cap * (0.35 if demand_level == DemandLevel.LOW else 0.55 if demand_level == DemandLevel.NORMAL else 0.78))
            load_noise = self.rng.randint(-8, 8)
            curr_vol = max(10, min(cap, base_load + load_noise))
            
            queue = 0
            if curr_vol >= cap:
                queue = self.rng.randint(2, 12) if demand_level == DemandLevel.PEAK else 0

            utilization = (curr_vol + queue) / cap
            congestion_pct = min(100.0, round(utilization * 100.0, 1))
            travel_time = calculate_bpr_travel_time(length, speed, curr_vol, cap, queue)

            city_a_roads.append(Road(
                road_id=r_id,
                name=f"Road {r_id} ({start_n.split('_')[1]} → {end_n.split('_')[1]})",
                start_node=start_n,
                end_node=end_n,
                length_km=length,
                capacity=cap,
                free_flow_speed_kmh=speed,
                current_vehicles=curr_vol,
                queue_length=queue,
                congestion_level=congestion_pct,
                raw_utilization=round(utilization, 3),
                travel_time_mins=travel_time,
                category=cat,
                congestion_band=get_congestion_band(congestion_pct)
            ))

        total_cap_a = sum(r.capacity for r in city_a_roads)
        active_veh_a = sum(r.current_vehicles for r in city_a_roads)
        avail_cap_a = max(0, total_cap_a - active_veh_a)
        base_demand_a = int((city_a_pop * 0.0075) * demand_mult)
        avg_cong_a = round(sum(r.congestion_level for r in city_a_roads) / len(city_a_roads), 1)
        avg_tt_a = round(sum(r.travel_time_mins for r in city_a_roads) / len(city_a_roads), 2)
        avg_q_a = round(sum(r.queue_length for r in city_a_roads) / len(city_a_roads), 1)

        city_a = CityState(
            city_id="CITY_A",
            name="City A (Metro Alpha)",
            population=city_a_pop,
            nodes=city_a_nodes,
            roads=city_a_roads,
            total_demand=base_demand_a,
            current_congestion=avg_cong_a,
            avg_travel_time=avg_tt_a,
            avg_queue_length=avg_q_a,
            total_capacity=total_cap_a,
            available_capacity=avail_cap_a,
            vehicles_entering=int(base_demand_a * 0.6),
            vehicles_leaving=int(base_demand_a * 0.55),
            active_vehicles=active_veh_a,
            current_step=0
        )

        # 2. City B: Metro Beta (Residential & Technology Corridor)
        city_b_nodes = [
            RoadNode(node_id="B_CENTRAL", name="Metro Beta Downtown", x=620.0, y=220.0, zone_type="commercial"),
            RoadNode(node_id="B_NORTH", name="Beta Innovation Hub", x=620.0, y=80.0, zone_type="industrial"),
            RoadNode(node_id="B_WEST", name="Beta West Crossing", x=490.0, y=220.0, zone_type="transit"),
            RoadNode(node_id="B_EAST", name="Sun Valley Suburb", x=750.0, y=220.0, zone_type="residential"),
            RoadNode(node_id="B_GATEWAY", name="South Beta Junction", x=580.0, y=360.0, zone_type="transit"),
        ]

        city_b_links = [
            ("B1", "B_NORTH", "B_CENTRAL", 4.0, 170, 50.0, RoadCategory.ARTERIAL),
            ("B2", "B_CENTRAL", "B_NORTH", 4.0, 170, 50.0, RoadCategory.ARTERIAL),
            ("B3", "B_WEST", "B_CENTRAL", 4.5, 200, 55.0, RoadCategory.ARTERIAL),
            ("B4", "B_CENTRAL", "B_WEST", 4.5, 200, 55.0, RoadCategory.ARTERIAL),
            ("B5", "B_EAST", "B_CENTRAL", 5.2, 160, 45.0, RoadCategory.LOCAL),
            ("B6", "B_CENTRAL", "B_EAST", 5.2, 160, 45.0, RoadCategory.LOCAL),
            ("B7", "B_GATEWAY", "B_CENTRAL", 5.0, 210, 55.0, RoadCategory.ARTERIAL),
            ("B8", "B_CENTRAL", "B_GATEWAY", 5.0, 210, 55.0, RoadCategory.ARTERIAL),
            ("B9", "B_WEST", "B_GATEWAY", 5.8, 150, 50.0, RoadCategory.LOCAL),
            ("B10", "B_GATEWAY", "B_WEST", 5.8, 150, 50.0, RoadCategory.LOCAL),
        ]

        city_b_roads: List[Road] = []
        for r_id, start_n, end_n, length, base_cap, speed, cat in city_b_links:
            cap_var = self.rng.randint(-15, 15)
            cap = max(80, base_cap + cap_var)
            
            base_load = int(cap * (0.32 if demand_level == DemandLevel.LOW else 0.52 if demand_level == DemandLevel.NORMAL else 0.76))
            load_noise = self.rng.randint(-8, 8)
            curr_vol = max(10, min(cap, base_load + load_noise))
            
            queue = 0
            if curr_vol >= cap:
                queue = self.rng.randint(2, 10) if demand_level == DemandLevel.PEAK else 0

            utilization = (curr_vol + queue) / cap
            congestion_pct = min(100.0, round(utilization * 100.0, 1))
            travel_time = calculate_bpr_travel_time(length, speed, curr_vol, cap, queue)

            city_b_roads.append(Road(
                road_id=r_id,
                name=f"Road {r_id} ({start_n.split('_')[1]} → {end_n.split('_')[1]})",
                start_node=start_n,
                end_node=end_n,
                length_km=length,
                capacity=cap,
                free_flow_speed_kmh=speed,
                current_vehicles=curr_vol,
                queue_length=queue,
                congestion_level=congestion_pct,
                raw_utilization=round(utilization, 3),
                travel_time_mins=travel_time,
                category=cat,
                congestion_band=get_congestion_band(congestion_pct)
            ))

        total_cap_b = sum(r.capacity for r in city_b_roads)
        active_veh_b = sum(r.current_vehicles for r in city_b_roads)
        avail_cap_b = max(0, total_cap_b - active_veh_b)
        base_demand_b = int((city_b_pop * 0.0075) * demand_mult)
        avg_cong_b = round(sum(r.congestion_level for r in city_b_roads) / len(city_b_roads), 1)
        avg_tt_b = round(sum(r.travel_time_mins for r in city_b_roads) / len(city_b_roads), 2)
        avg_q_b = round(sum(r.queue_length for r in city_b_roads) / len(city_b_roads), 1)

        city_b = CityState(
            city_id="CITY_B",
            name="City B (Metro Beta)",
            population=city_b_pop,
            nodes=city_b_nodes,
            roads=city_b_roads,
            total_demand=base_demand_b,
            current_congestion=avg_cong_b,
            avg_travel_time=avg_tt_b,
            avg_queue_length=avg_q_b,
            total_capacity=total_cap_b,
            available_capacity=avail_cap_b,
            vehicles_entering=int(base_demand_b * 0.58),
            vehicles_leaving=int(base_demand_b * 0.52),
            active_vehicles=active_veh_b,
            current_step=0
        )

        # 3. Intercity Connection (Highway Corridor connecting A_GATEWAY to B_GATEWAY)
        ic_cap = max(100, intercity_capacity)
        ic_base_vol = int(ic_cap * (0.35 if demand_level == DemandLevel.LOW else 0.55 if demand_level == DemandLevel.NORMAL else 0.82))
        ic_vol = max(20, min(ic_cap, ic_base_vol + self.rng.randint(-10, 10)))
        ic_queue = self.rng.randint(5, 25) if demand_level == DemandLevel.PEAK else 0
        ic_util = (ic_vol + ic_queue) / ic_cap
        ic_cong_pct = min(100.0, round(ic_util * 100.0, 1))
        ic_tt = calculate_bpr_travel_time(24.0, 90.0, ic_vol, ic_cap, ic_queue)

        intercity = IntercityConnection(
            connection_id="IC_CORRIDOR_1",
            name="Intercity Expressway (A_GATEWAY ↔ B_GATEWAY)",
            city_a_node="A_GATEWAY",
            city_b_node="B_GATEWAY",
            length_km=24.0,
            capacity=ic_cap,
            free_flow_speed_kmh=90.0,
            current_volume=ic_vol,
            queue_length=ic_queue,
            congestion_level=ic_cong_pct,
            raw_utilization=round(ic_util, 3),
            travel_time_mins=ic_tt,
            category=RoadCategory.INTERCITY,
            congestion_band=get_congestion_band(ic_cong_pct)
        )

        return city_a, city_b, intercity
