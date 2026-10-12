import os
import math
import copy
from datetime import datetime, timezone
from typing import List, Dict, Tuple, Optional
import numpy as np
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

from ..models.ai_models import (
    ModelMetrics,
    EvaluationComparison,
    ModelStatusResponse,
    TrainModelResponse,
    PredictResponse,
    PredictionItem,
    AIHistoryPoint,
    AIHistoryResponse
)
from ..models.simulation_models import DemandLevel, CityState, IntercityConnection
from .simulation_engine import SimulationEngine


FEATURE_NAMES = [
    "time_sin",
    "time_cos",
    "demand_a",
    "congestion_a",
    "travel_time_a",
    "active_a",
    "queue_a",
    "demand_b",
    "congestion_b",
    "travel_time_b",
    "active_b",
    "queue_b",
    "ic_volume",
    "ic_congestion",
    "demand_level_code",
    "demand_a_lag1",
    "congestion_a_lag1",
    "demand_b_lag1",
    "congestion_b_lag1"
]

TARGET_CONFIGS = [
    {"target": "city_a_demand", "label": "City A Traffic Demand", "unit": "veh/step"},
    {"target": "city_a_congestion", "label": "City A Congestion", "unit": "%"},
    {"target": "city_b_demand", "label": "City B Traffic Demand", "unit": "veh/step"},
    {"target": "city_b_congestion", "label": "City B Congestion", "unit": "%"}
]

TARGET_NAMES = [cfg["target"] for cfg in TARGET_CONFIGS]

ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "artifacts")
MODEL_PATH = os.path.join(ARTIFACTS_DIR, "rf_twin_cities_predictor.joblib")


class AIPredictorService:
    """
    Supervised Machine Learning module predicting future traffic demand and congestion
    for connected digital twin cities. Evaluated against unseen test scenarios.
    """

    def __init__(self):
        self.horizon: int = 3
        self.is_trained: bool = False
        self.last_trained: Optional[str] = None
        self.model: Optional[RandomForestRegressor] = None
        self.evaluations: List[EvaluationComparison] = []
        self.train_samples: int = 0
        self.test_samples: int = 0
        self.forecast_cache: Dict[int, Dict[str, float]] = {}

        # Attempt to load previously persisted model
        self._load_persisted_model()

    def _load_persisted_model(self):
        """Loads serialized model and evaluation metrics if existing."""
        if os.path.exists(MODEL_PATH):
            try:
                data = joblib.load(MODEL_PATH)
                self.model = data.get("model")
                self.horizon = data.get("horizon", 3)
                self.is_trained = True
                self.last_trained = data.get("last_trained")
                self.evaluations = [EvaluationComparison(**ev) for ev in data.get("evaluations", [])]
                self.train_samples = data.get("train_samples", 0)
                self.test_samples = data.get("test_samples", 0)
            except Exception as e:
                print(f"Warning: Could not load existing AI model: {e}")

    def _extract_step_features(self, step: int, city_a: CityState, city_b: CityState, intercity: IntercityConnection, demand_level: DemandLevel, prev_features: Optional[Dict[str, float]] = None) -> Dict[str, float]:
        """Extracts standard time-series observation vector at step t."""
        cycle_hour = step % 24
        demand_code = 0.0 if demand_level == DemandLevel.LOW else (1.0 if demand_level == DemandLevel.NORMAL else 2.0)
        
        feats = {
            "time_sin": round(math.sin(2 * math.pi * cycle_hour / 24.0), 4),
            "time_cos": round(math.cos(2 * math.pi * cycle_hour / 24.0), 4),
            "demand_a": float(city_a.total_demand),
            "congestion_a": float(city_a.current_congestion),
            "travel_time_a": float(city_a.avg_travel_time),
            "active_a": float(city_a.active_vehicles),
            "queue_a": float(city_a.avg_queue_length),
            "demand_b": float(city_b.total_demand),
            "congestion_b": float(city_b.current_congestion),
            "travel_time_b": float(city_b.avg_travel_time),
            "active_b": float(city_b.active_vehicles),
            "queue_b": float(city_b.avg_queue_length),
            "ic_volume": float(intercity.current_volume),
            "ic_congestion": float(intercity.congestion_level),
            "demand_level_code": demand_code,
            "demand_a_lag1": prev_features.get("demand_a", float(city_a.total_demand)) if prev_features else float(city_a.total_demand),
            "congestion_a_lag1": prev_features.get("congestion_a", float(city_a.current_congestion)) if prev_features else float(city_a.current_congestion),
            "demand_b_lag1": prev_features.get("demand_b", float(city_b.total_demand)) if prev_features else float(city_b.total_demand),
            "congestion_b_lag1": prev_features.get("congestion_b", float(city_b.current_congestion)) if prev_features else float(city_b.current_congestion),
        }
        return feats

    def _generate_trajectory_data(
        self,
        seeds: List[int],
        demand_levels: List[DemandLevel],
        steps_per_run: int,
        horizon: int
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Runs independent simulations to generate (X, y, baseline_y) triples.
        Target y is the true state at t + horizon.
        Baseline is the persistence forecast (state at t).
        """
        all_X = []
        all_y = []
        all_base = []

        for seed in seeds:
            for d_level in demand_levels:
                engine = SimulationEngine(seed=seed, demand_level=d_level)
                
                # Step through trajectory and collect history observations
                run_obs = []
                for s in range(steps_per_run + horizon + 2):
                    prev = run_obs[-1]["feats"] if run_obs else None
                    feats = self._extract_step_features(
                        step=engine.current_step,
                        city_a=engine.city_a,
                        city_b=engine.city_b,
                        intercity=engine.intercity,
                        demand_level=d_level,
                        prev_features=prev
                    )
                    targets = {
                        "city_a_demand": float(engine.city_a.total_demand),
                        "city_a_congestion": float(engine.city_a.current_congestion),
                        "city_b_demand": float(engine.city_b.total_demand),
                        "city_b_congestion": float(engine.city_b.current_congestion),
                    }
                    run_obs.append({"step": engine.current_step, "feats": feats, "targets": targets})
                    engine.advance_step(1)

                # Pair observation at step t with target at step t + horizon
                for t in range(len(run_obs) - horizon):
                    curr_entry = run_obs[t]
                    future_entry = run_obs[t + horizon]

                    x_vec = [curr_entry["feats"][fname] for fname in FEATURE_NAMES]
                    y_vec = [future_entry["targets"][tname] for tname in TARGET_NAMES]
                    # Persistence baseline: predict value at t for future t + horizon
                    base_vec = [curr_entry["targets"][tname] for tname in TARGET_NAMES]

                    all_X.append(x_vec)
                    all_y.append(y_vec)
                    all_base.append(base_vec)

        return np.array(all_X), np.array(all_y), np.array(all_base)

    def train(
        self,
        horizon: int = 3,
        num_train_scenarios: int = 5,
        steps_per_scenario: int = 36,
        random_seed: int = 42
    ) -> TrainModelResponse:
        """
        Trains Random Forest models and evaluates on strictly unseen held-out test scenarios.
        Calculates MAE, RMSE, and persistence baseline comparison.
        """
        self.horizon = horizon
        rng = np.random.RandomState(random_seed)

        # 1. Train/Test scenario separation by seed (strictly preventing data leakage)
        train_seeds = [100 + i * 7 for i in range(num_train_scenarios)]
        test_seeds = [901, 902]  # Held-out test scenarios never seen during training

        demand_modes = [DemandLevel.LOW, DemandLevel.NORMAL, DemandLevel.PEAK]

        # Generate datasets
        X_train, y_train, _ = self._generate_trajectory_data(
            seeds=train_seeds,
            demand_levels=demand_modes,
            steps_per_run=steps_per_scenario,
            horizon=horizon
        )

        X_test, y_test, y_test_persistence = self._generate_trajectory_data(
            seeds=test_seeds,
            demand_levels=demand_modes,
            steps_per_run=steps_per_scenario,
            horizon=horizon
        )

        self.train_samples = len(X_train)
        self.test_samples = len(X_test)

        if self.train_samples < 20:
            raise ValueError("Insufficient training observations generated to train reliable models.")

        # 2. Train Random Forest Regressor
        self.model = RandomForestRegressor(
            n_estimators=45,
            max_depth=9,
            min_samples_split=3,
            random_state=random_seed,
            n_jobs=-1
        )
        self.model.fit(X_train, y_train)

        # 3. Predict on unseen test data
        y_pred = self.model.predict(X_test)

        # 4. Compute Test Metrics vs Persistence Baseline
        self.evaluations = []
        for i, cfg in enumerate(TARGET_CONFIGS):
            target_key = cfg["target"]
            y_true_col = y_test[:, i]
            y_pred_col = y_pred[:, i]
            y_base_col = y_test_persistence[:, i]

            # Model metrics
            rf_mae = float(round(mean_absolute_error(y_true_col, y_pred_col), 2))
            rf_rmse = float(round(math.sqrt(mean_squared_error(y_true_col, y_pred_col)), 2))

            # Persistence baseline metrics
            base_mae = float(round(mean_absolute_error(y_true_col, y_base_col), 2))
            base_rmse = float(round(math.sqrt(mean_squared_error(y_true_col, y_base_col)), 2))

            # Improvement percentage: (base_error - model_error) / base_error * 100
            mae_imp = round(((base_mae - rf_mae) / max(base_mae, 0.001)) * 100.0, 1)
            rmse_imp = round(((base_rmse - rf_rmse) / max(base_rmse, 0.001)) * 100.0, 1)

            self.evaluations.append(EvaluationComparison(
                target=target_key,
                target_label=cfg["label"],
                unit=cfg["unit"],
                rf_metrics=ModelMetrics(mae=rf_mae, rmse=rf_rmse, sample_count=len(y_true_col)),
                persistence_metrics=ModelMetrics(mae=base_mae, rmse=base_rmse, sample_count=len(y_base_col)),
                mae_improvement_pct=mae_imp,
                rmse_improvement_pct=rmse_imp
            ))

        self.is_trained = True
        self.last_trained = datetime.now(timezone.utc).isoformat()

        # 5. Persist model to artifacts directory
        os.makedirs(ARTIFACTS_DIR, exist_ok=True)
        joblib.dump({
            "model": self.model,
            "horizon": self.horizon,
            "last_trained": self.last_trained,
            "evaluations": [ev.model_dump() for ev in self.evaluations],
            "train_samples": self.train_samples,
            "test_samples": self.test_samples
        }, MODEL_PATH)

        status = self.get_status()
        return TrainModelResponse(
            success=True,
            message=f"Model successfully trained on {self.train_samples} samples and evaluated on {self.test_samples} unseen test samples.",
            status=status,
            evaluations=self.evaluations,
            timestamp=self.last_trained
        )

    def get_status(self) -> ModelStatusResponse:
        """Returns readiness and metadata of the AI model."""
        return ModelStatusResponse(
            is_trained=self.is_trained,
            prediction_horizon=self.horizon,
            model_type="RandomForestRegressor",
            last_trained=self.last_trained,
            features=FEATURE_NAMES,
            targets=TARGET_NAMES,
            train_samples=self.train_samples,
            test_samples=self.test_samples
        )

    def predict(
        self,
        city_a: CityState,
        city_b: CityState,
        intercity: IntercityConnection,
        simulation_step: int,
        demand_level: DemandLevel,
        recent_history: Optional[List[dict]] = None
    ) -> PredictResponse:
        """
        Runs live forecast for near-future step (current_step + horizon).
        """
        if not self.is_trained or self.model is None:
            # Auto-train default model if not trained yet
            self.train(horizon=self.horizon)

        prev_feats = None
        if recent_history and len(recent_history) > 1:
            prev_record = recent_history[-2]
            prev_feats = {
                "demand_a": float(prev_record.get("city_a_demand", city_a.total_demand)),
                "congestion_a": float(prev_record.get("city_a_congestion", city_a.current_congestion)),
                "demand_b": float(prev_record.get("city_b_demand", city_b.total_demand)),
                "congestion_b": float(prev_record.get("city_b_congestion", city_b.current_congestion)),
            }

        curr_feats = self._extract_step_features(
            step=simulation_step,
            city_a=city_a,
            city_b=city_b,
            intercity=intercity,
            demand_level=demand_level,
            prev_features=prev_feats
        )

        x_in = np.array([[curr_feats[fname] for fname in FEATURE_NAMES]])
        raw_preds = self.model.predict(x_in)[0]

        target_step = simulation_step + self.horizon
        predictions_dict: Dict[str, PredictionItem] = {}

        current_vals = {
            "city_a_demand": float(city_a.total_demand),
            "city_a_congestion": float(city_a.current_congestion),
            "city_b_demand": float(city_b.total_demand),
            "city_b_congestion": float(city_b.current_congestion),
        }

        for i, cfg in enumerate(TARGET_CONFIGS):
            t_key = cfg["target"]
            c_val = current_vals[t_key]
            p_val = float(round(raw_preds[i], 1 if "congestion" in t_key else 0))

            predictions_dict[t_key] = PredictionItem(
                target=t_key,
                target_label=cfg["label"],
                unit=cfg["unit"],
                current_value=c_val,
                predicted_value=p_val,
                persistence_baseline=c_val,
                horizon_steps=self.horizon,
                current_step=simulation_step,
                target_step=target_step,
                confidence_band="High" if self.is_trained else "Uncalibrated"
            )

        # Cache forecast for historical alignment
        self.forecast_cache[target_step] = {
            "pred_demand_a": predictions_dict["city_a_demand"].predicted_value,
            "pred_congestion_a": predictions_dict["city_a_congestion"].predicted_value,
            "pred_demand_b": predictions_dict["city_b_demand"].predicted_value,
            "pred_congestion_b": predictions_dict["city_b_congestion"].predicted_value,
        }

        return PredictResponse(
            current_step=simulation_step,
            horizon_steps=self.horizon,
            target_step=target_step,
            predictions=predictions_dict,
            timestamp=datetime.now(timezone.utc).isoformat(),
            is_simulated_data=True
        )

    def get_history_chart_data(self, history_records: List[dict]) -> AIHistoryResponse:
        """
        Generates combined actual vs predicted timeline for charts.
        """
        chart_points: List[AIHistoryPoint] = []
        for rec in history_records:
            step = rec.get("step", 0)
            cached = self.forecast_cache.get(step, {})

            point = AIHistoryPoint(
                step=step,
                actual_demand_a=rec.get("city_a_demand"),
                predicted_demand_a=cached.get("pred_demand_a"),
                actual_congestion_a=rec.get("city_a_congestion"),
                predicted_congestion_a=cached.get("pred_congestion_a"),
                actual_demand_b=rec.get("city_b_demand"),
                predicted_demand_b=cached.get("pred_demand_b"),
                actual_congestion_b=rec.get("city_b_congestion"),
                predicted_congestion_b=cached.get("pred_congestion_b"),
            )
            chart_points.append(point)

        return AIHistoryResponse(
            history=chart_points,
            horizon_steps=self.horizon,
            total_points=len(chart_points)
        )


ai_predictor = AIPredictorService()
