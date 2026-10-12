from fastapi import APIRouter, HTTPException, Query, status
from typing import Optional
from ..models.simulation_models import (
    SimulationStateResponse,
    MetricsResponse,
    InitializeScenarioRequest,
    StepSimulationRequest,
    ScenarioGenerateRequest,
    DemandLevel
)
from ..services.simulation_engine import sim_engine

router = APIRouter(prefix="/api/simulation", tags=["simulation"])


@router.get("/state", response_model=SimulationStateResponse)
def get_simulation_state():
    """Returns the current state of City A, City B, and the Intercity corridor."""
    return sim_engine.get_state_response()


@router.post("/initialize", response_model=SimulationStateResponse)
def initialize_simulation(payload: InitializeScenarioRequest):
    """
    Initializes a simulation scenario using optional seed and demand-level parameters.
    """
    try:
        seed = payload.seed if payload.seed is not None else 42
        demand_level = payload.demand_level or DemandLevel.NORMAL
        ic_cap = payload.intercity_capacity or 250
        
        state = sim_engine.reinitialize(
            seed=seed,
            demand_level=demand_level,
            intercity_capacity=ic_cap
        )
        return state
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to initialize simulation: {str(e)}"
        )


@router.post("/step", response_model=SimulationStateResponse)
def step_simulation(payload: Optional[StepSimulationRequest] = None):
    """
    Advances the simulation by one (or specified) time step.
    Updates demand, flows, congestion, and queues.
    """
    steps = payload.steps_to_advance if payload and payload.steps_to_advance else 1
    try:
        updated_state = sim_engine.advance_step(steps=steps)
        return updated_state
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error advancing simulation step: {str(e)}"
        )


@router.post("/reset", response_model=SimulationStateResponse)
def reset_simulation():
    """Resets the simulation to the initial state of the currently active scenario."""
    try:
        return sim_engine.reset()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset simulation: {str(e)}"
        )


@router.post("/scenario", response_model=SimulationStateResponse)
def generate_new_scenario(payload: Optional[ScenarioGenerateRequest] = None):
    """
    Generates a new synthetic scenario with customized seed and population settings.
    """
    import random
    new_seed = payload.seed if (payload and payload.seed is not None) else random.randint(100, 99999)
    demand_level = payload.demand_level if (payload and payload.demand_level) else DemandLevel.NORMAL
    city_a_pop = payload.city_a_population if (payload and payload.city_a_population) else 120000
    city_b_pop = payload.city_b_population if (payload and payload.city_b_population) else 95000

    try:
        state = sim_engine.reinitialize(
            seed=new_seed,
            demand_level=demand_level,
            city_a_pop=city_a_pop,
            city_b_pop=city_b_pop
        )
        return state
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to generate scenario: {str(e)}"
        )


@router.get("/metrics", response_model=MetricsResponse)
def get_simulation_metrics():
    """
    Returns concise summary metrics for City A, City B, Intercity corridor,
    and the overall combined system.
    """
    return sim_engine.get_metrics_response()
