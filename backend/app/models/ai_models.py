from pydantic import BaseModel, Field
from typing import List, Dict, Optional


class TargetVariable(str):
    CITY_A_DEMAND = "city_a_demand"
    CITY_A_CONGESTION = "city_a_congestion"
    CITY_B_DEMAND = "city_b_demand"
    CITY_B_CONGESTION = "city_b_congestion"


class ModelMetrics(BaseModel):
    mae: float = Field(..., description="Mean Absolute Error")
    rmse: float = Field(..., description="Root Mean Squared Error")
    sample_count: int = Field(..., ge=1)


class EvaluationComparison(BaseModel):
    target: str
    target_label: str
    unit: str
    rf_metrics: ModelMetrics
    persistence_metrics: ModelMetrics
    mae_improvement_pct: float
    rmse_improvement_pct: float


class ModelStatusResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    is_trained: bool
    prediction_horizon: int
    model_type: str = "RandomForestRegressor"
    last_trained: Optional[str] = None
    features: List[str]
    targets: List[str]
    train_samples: int = 0
    test_samples: int = 0


class TrainModelRequest(BaseModel):
    prediction_horizon: Optional[int] = Field(default=3, ge=1, le=12)
    num_train_scenarios: Optional[int] = Field(default=5, ge=2, le=10)
    steps_per_scenario: Optional[int] = Field(default=36, ge=15, le=72)
    random_seed: Optional[int] = Field(default=42, ge=0)


class TrainModelResponse(BaseModel):
    success: bool
    message: str
    status: ModelStatusResponse
    evaluations: List[EvaluationComparison]
    timestamp: str


class PredictRequest(BaseModel):
    prediction_horizon: Optional[int] = Field(default=None, ge=1, le=12)


class PredictionItem(BaseModel):
    target: str
    target_label: str
    unit: str
    current_value: float
    predicted_value: float
    persistence_baseline: float
    horizon_steps: int
    current_step: int
    target_step: int
    confidence_band: str = "Medium"


class PredictResponse(BaseModel):
    current_step: int
    horizon_steps: int
    target_step: int
    predictions: Dict[str, PredictionItem]
    timestamp: str
    is_simulated_data: bool = True


class AIHistoryPoint(BaseModel):
    step: int
    actual_demand_a: Optional[float] = None
    predicted_demand_a: Optional[float] = None
    actual_congestion_a: Optional[float] = None
    predicted_congestion_a: Optional[float] = None
    actual_demand_b: Optional[float] = None
    predicted_demand_b: Optional[float] = None
    actual_congestion_b: Optional[float] = None
    predicted_congestion_b: Optional[float] = None


class AIHistoryResponse(BaseModel):
    history: List[AIHistoryPoint]
    horizon_steps: int
    total_points: int
