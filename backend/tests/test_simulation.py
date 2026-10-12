import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.simulation_models import DemandLevel, CongestionBand
from app.services.generator import SyntheticDataGenerator, calculate_bpr_travel_time
from app.services.simulation_engine import SimulationEngine

client = TestClient(app)


def test_synthetic_data_generation_validity():
    """Verify generated topology, positive capacities, lengths, and valid speeds."""
    gen = SyntheticDataGenerator(seed=101)
    city_a, city_b, intercity = gen.generate(demand_level=DemandLevel.NORMAL)

    assert city_a.city_id == "CITY_A"
    assert city_b.city_id == "CITY_B"
    assert len(city_a.nodes) >= 5
    assert len(city_b.nodes) >= 5
    assert len(city_a.roads) >= 10
    assert len(city_b.roads) >= 10

    for road in city_a.roads + city_b.roads:
        assert road.capacity > 0
        assert road.length_km > 0
        assert road.current_vehicles >= 0
        assert road.queue_length >= 0
        assert 0.0 <= road.congestion_level <= 100.0
        assert road.travel_time_mins > 0.0

    assert intercity.capacity > 0
    assert intercity.length_km > 0
    assert intercity.current_volume >= 0
    assert intercity.travel_time_mins > 0


def test_seed_reproducibility():
    """Verify same seed produces bit-for-bit identical initial states."""
    gen1 = SyntheticDataGenerator(seed=777)
    city_a1, city_b1, ic1 = gen1.generate(demand_level=DemandLevel.NORMAL)

    gen2 = SyntheticDataGenerator(seed=777)
    city_a2, city_b2, ic2 = gen2.generate(demand_level=DemandLevel.NORMAL)

    assert city_a1.total_capacity == city_a2.total_capacity
    assert city_a1.total_demand == city_a2.total_demand
    assert city_b1.total_capacity == city_b2.total_capacity
    assert ic1.current_volume == ic2.current_volume
    for r1, r2 in zip(city_a1.roads, city_a2.roads):
        assert r1.capacity == r2.capacity
        assert r1.current_vehicles == r2.current_vehicles
        assert r1.travel_time_mins == r2.travel_time_mins


def test_demand_scenarios():
    """Verify low, normal, and peak demand scaling."""
    gen = SyntheticDataGenerator(seed=42)
    ca_low, cb_low, ic_low = gen.generate(demand_level=DemandLevel.LOW)
    ca_norm, cb_norm, ic_norm = gen.generate(demand_level=DemandLevel.NORMAL)
    ca_peak, cb_peak, ic_peak = gen.generate(demand_level=DemandLevel.PEAK)

    assert ca_low.total_demand < ca_norm.total_demand < ca_peak.total_demand
    assert cb_low.total_demand < cb_norm.total_demand < cb_peak.total_demand
    assert ic_low.current_volume <= ic_norm.current_volume <= ic_peak.current_volume


def test_bpr_travel_time_behavior():
    """Verify BPR formula increases travel time under congestion and queues."""
    t_free = calculate_bpr_travel_time(length_km=10.0, free_flow_speed_kmh=60.0, volume=0, capacity=100, queue=0)
    t_mid = calculate_bpr_travel_time(length_km=10.0, free_flow_speed_kmh=60.0, volume=70, capacity=100, queue=0)
    t_over = calculate_bpr_travel_time(length_km=10.0, free_flow_speed_kmh=60.0, volume=100, capacity=100, queue=30)

    assert t_free == 10.0  # 10 km at 60 km/h = 10 mins
    assert t_mid > t_free
    assert t_over > t_mid


def test_simulation_step_advancement_and_history():
    """Verify simulation step updates state and records history."""
    engine = SimulationEngine(seed=42, demand_level=DemandLevel.NORMAL)
    initial_step = engine.current_step
    assert initial_step == 0
    assert len(engine.history) == 1

    resp = engine.advance_step(steps=1)
    assert resp.simulation_step == 1
    assert len(resp.history) == 2
    assert resp.history[-1].step == 1

    # Check vehicle values are positive and state was updated
    assert resp.city_a.active_vehicles > 0
    assert resp.city_b.active_vehicles > 0
    assert resp.intercity_connection.current_volume > 0


def test_simulation_reset_behavior():
    """Verify resetting restores initial state exactly."""
    engine = SimulationEngine(seed=42, demand_level=DemandLevel.NORMAL)
    initial_active_a = engine.city_a.active_vehicles

    engine.advance_step(steps=5)
    assert engine.current_step == 5
    assert len(engine.history) == 6

    reset_resp = engine.reset()
    assert reset_resp.simulation_step == 0
    assert len(reset_resp.history) == 1
    assert reset_resp.city_a.active_vehicles == initial_active_a


def test_combined_metrics_no_double_counting():
    """Verify total active vehicles equals exact sum of City A, City B, and Intercity vehicles."""
    engine = SimulationEngine(seed=42)
    engine.advance_step(steps=3)
    metrics = engine.get_combined_metrics()

    expected_sum = (
        engine.city_a.active_vehicles +
        engine.city_b.active_vehicles +
        engine.intercity.current_volume
    )
    assert metrics.total_active_vehicles == expected_sum


def test_api_endpoints():
    """Test all Phase 2 endpoints via FastAPI TestClient."""
    # 1. State
    r_state = client.get("/api/simulation/state")
    assert r_state.status_code == 200
    data = r_state.json()
    assert "city_a" in data
    assert "city_b" in data
    assert "intercity_connection" in data

    # 2. Metrics
    r_metrics = client.get("/api/simulation/metrics")
    assert r_metrics.status_code == 200
    m_data = r_metrics.json()
    assert m_data["city_a"]["city_id"] == "CITY_A"

    # 3. Step
    r_step = client.post("/api/simulation/step", json={"steps_to_advance": 1})
    assert r_step.status_code == 200
    assert r_step.json()["simulation_step"] >= 1

    # 4. Reset
    r_reset = client.post("/api/simulation/reset")
    assert r_reset.status_code == 200
    assert r_reset.json()["simulation_step"] == 0

    # 5. Initialize with custom parameters
    r_init = client.post("/api/simulation/initialize", json={"seed": 123, "demand_level": "peak"})
    assert r_init.status_code == 200
    init_data = r_init.json()
    assert init_data["seed"] == 123
    assert init_data["demand_level"] == "peak"

    # 6. Invalid parameters error handling
    r_bad = client.post("/api/simulation/initialize", json={"seed": -1})
    assert r_bad.status_code == 422  # Pydantic validation error
