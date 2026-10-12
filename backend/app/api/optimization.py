from fastapi import APIRouter, HTTPException, Query, status
from typing import List, Optional
from ..models.optimization_models import (
    IndependentRunRequest,
    IndependentRunResponse,
    OptimizationStatusResponse,
    OptimizationActionDefinition
)
from ..models.coordinated_optimization_models import (
    CoordinatedRunRequest,
    CoordinatedRunResponse,
    CoordinatedStatusResponse,
    HeadToHeadComparisonResponse
)
from ..models.mpc_models import (
    MPCRunRequest,
    MPCRunResponse,
    ScenarioPlanningRunResponse,
    MPCConfigResponse
)
from ..services.independent_optimizer import independent_optimizer
from ..services.coordinated_optimizer import coordinated_optimizer
from ..services.mpc_optimizer import mpc_optimizer

router = APIRouter(prefix="/api/optimization", tags=["optimization"])


# ----------------------------------------------------
# Phase 5: Independent Baseline Endpoints
# ----------------------------------------------------

@router.post("/independent/run", response_model=IndependentRunResponse)
def run_independent_optimization(payload: Optional[IndependentRunRequest] = None):
    """
    Executes a controlled baseline experiment where City A and City B
    independently select actions based purely on local state and forecasts.
    """
    req = payload or IndependentRunRequest()
    try:
        result = independent_optimizer.run_experiment(req)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute independent optimization: {str(e)}"
        )


@router.get("/independent/status", response_model=OptimizationStatusResponse)
def get_independent_status():
    """Returns current status and active parameters of the independent optimizer."""
    return independent_optimizer.get_status()


@router.get("/independent/results", response_model=List[IndependentRunResponse])
def get_independent_results():
    """Returns history of executed baseline optimization runs."""
    return independent_optimizer.results_history


@router.get("/independent/actions", response_model=List[OptimizationActionDefinition])
def get_optimization_actions():
    """Returns available discrete optimization actions and their operational specifications."""
    return independent_optimizer.get_actions()


# ----------------------------------------------------
# Phase 6: Joint Coordinated Optimization Endpoints
# ----------------------------------------------------

@router.post("/coordinated/run", response_model=CoordinatedRunResponse)
def run_coordinated_optimization(payload: Optional[CoordinatedRunRequest] = None):
    """
    Executes a joint coordinated optimization experiment evaluating all 25
    action pairs simultaneously across both cities and the shared intercity corridor.
    """
    req = payload or CoordinatedRunRequest()
    try:
        result = coordinated_optimizer.run_coordinated_experiment(req)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute coordinated optimization: {str(e)}"
        )


@router.get("/coordinated/status", response_model=CoordinatedStatusResponse)
def get_coordinated_status():
    """Returns status and readiness of the joint coordinated optimizer."""
    return coordinated_optimizer.get_status()


@router.get("/coordinated/results", response_model=List[CoordinatedRunResponse])
def get_coordinated_results():
    """Returns history of executed joint coordinated optimization runs."""
    return coordinated_optimizer.results_history


@router.get("/compare", response_model=HeadToHeadComparisonResponse)
def compare_strategies(
    seed: int = Query(default=42, ge=0),
    demand_level: str = Query(default="normal", pattern="^(low|normal|peak)$"),
    steps: int = Query(default=24, ge=1, le=72)
):
    """
    Executes a direct head-to-head benchmark comparing the Phase 5 Independent Baseline
    against Phase 6 Joint Coordinated Optimization under strictly identical starting conditions.
    """
    try:
        result = coordinated_optimizer.compare_strategies(
            seed=seed,
            demand_level=demand_level,
            steps=steps
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Strategy comparison failed: {str(e)}"
        )


# ----------------------------------------------------
# Phase 8: Multi-Step MPC & Scenario Planning Endpoints
# ----------------------------------------------------

@router.get("/mpc/config", response_model=MPCConfigResponse)
def get_mpc_config():
    """Returns supported MPC horizons, discount factors, beam width, and planning modes."""
    return mpc_optimizer.get_config()


@router.post("/mpc/run", response_model=MPCRunResponse)
def run_mpc_optimization(payload: Optional[MPCRunRequest] = None):
    """
    Executes receding-horizon Model Predictive Control (MPC) optimization.
    Plans H steps ahead using bounded Beam Search and executes only the first action pair.
    """
    req = payload or MPCRunRequest()
    try:
        result = mpc_optimizer.run_mpc_experiment(req)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute MPC optimization: {str(e)}"
        )


@router.get("/mpc/status")
def get_mpc_status():
    """Reports status, readiness, and last run metadata of the MPC optimizer."""
    last_res = mpc_optimizer.last_run_result
    return {
        "is_ready": True,
        "last_run_id": last_res.run_id if last_res else None,
        "last_planning_horizon": last_res.planning_horizon if last_res else 3,
        "last_planning_mode": last_res.planning_mode if last_res else "nominal",
        "last_computation_time_ms": last_res.computation_time_ms if last_res else None,
        "fallback_occurred": last_res.fallback_occurred if last_res else False,
        "total_runs_count": len(mpc_optimizer.results_history)
    }


@router.get("/mpc/results", response_model=List[MPCRunResponse])
def get_mpc_results():
    """Returns historical list of MPC runs with detailed multi-step decisions."""
    return mpc_optimizer.results_history


@router.post("/scenarios/run", response_model=ScenarioPlanningRunResponse)
def run_scenario_planning(
    seed: int = Query(default=42, ge=1),
    horizon: int = Query(default=3, ge=1, le=5),
    discount_factor: float = Query(default=0.95, ge=0.5, le=1.0)
):
    """
    Executes forward-looking scenario planning evaluating alternative adverse conditions
    (nominal, peak surge, corridor bottleneck, uneven demand) across planning modes.
    """
    try:
        result = mpc_optimizer.run_scenario_planning_study(
            base_seed=seed,
            horizon=horizon,
            discount_factor=discount_factor
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scenario planning study failed: {str(e)}"
        )


@router.get("/scenarios/results", response_model=List[ScenarioPlanningRunResponse])
def get_scenario_planning_results():
    """Returns saved scenario planning studies."""
    return mpc_optimizer.scenario_studies_history
