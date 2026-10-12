from fastapi import APIRouter, HTTPException, status
from typing import List, Optional
from ..models.ai_models import (
    TrainModelRequest,
    TrainModelResponse,
    ModelStatusResponse,
    PredictRequest,
    PredictResponse,
    EvaluationComparison,
    AIHistoryResponse
)
from ..services.ai_predictor import ai_predictor
from ..services.simulation_engine import sim_engine

router = APIRouter(prefix="/api/ai", tags=["ai_prediction"])


@router.post("/train", response_model=TrainModelResponse)
def train_ai_model(payload: Optional[TrainModelRequest] = None):
    """
    Generates synthetic training trajectories across multiple scenarios,
    trains a Random Forest Regressor, and evaluates against held-out test scenarios.
    """
    horizon = payload.prediction_horizon if payload and payload.prediction_horizon else 3
    num_scenarios = payload.num_train_scenarios if payload and payload.num_train_scenarios else 5
    steps_per_run = payload.steps_per_scenario if payload and payload.steps_per_scenario else 36
    seed = payload.random_seed if payload and payload.random_seed is not None else 42

    try:
        result = ai_predictor.train(
            horizon=horizon,
            num_train_scenarios=num_scenarios,
            steps_per_scenario=steps_per_run,
            random_seed=seed
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to train prediction model: {str(e)}"
        )


@router.get("/status", response_model=ModelStatusResponse)
def get_ai_status():
    """Returns the current readiness and parameters of the prediction models."""
    return ai_predictor.get_status()


@router.post("/predict", response_model=PredictResponse)
def run_prediction(payload: Optional[PredictRequest] = None):
    """
    Forecasts near-future traffic demand and congestion for City A and City B.
    """
    try:
        # Check if horizon override provided
        if payload and payload.prediction_horizon and payload.prediction_horizon != ai_predictor.horizon:
            ai_predictor.train(horizon=payload.prediction_horizon)

        pred_response = ai_predictor.predict(
            city_a=sim_engine.city_a,
            city_b=sim_engine.city_b,
            intercity=sim_engine.intercity,
            simulation_step=sim_engine.current_step,
            demand_level=sim_engine.demand_level,
            recent_history=[rec.model_dump() for rec in sim_engine.history]
        )
        return pred_response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(e)}"
        )


@router.get("/evaluation", response_model=List[EvaluationComparison])
def get_model_evaluation():
    """
    Returns actual test metrics (MAE, RMSE) comparing Random Forest with Persistence Baseline.
    """
    if not ai_predictor.is_trained:
        # Auto-train default model so evaluation metrics are available
        ai_predictor.train(horizon=ai_predictor.horizon)

    return ai_predictor.evaluations


@router.get("/history", response_model=AIHistoryResponse)
def get_ai_history():
    """
    Returns time series of observed metrics alongside forecasts for comparison charts.
    """
    history_dicts = [rec.model_dump() for rec in sim_engine.history]
    return ai_predictor.get_history_chart_data(history_dicts)
