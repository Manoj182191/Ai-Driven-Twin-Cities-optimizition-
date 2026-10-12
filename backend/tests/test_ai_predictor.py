import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.ai_predictor import ai_predictor
from app.services.simulation_engine import sim_engine

client = TestClient(app)


def test_ai_status_endpoint():
    """Verify AI status endpoint returns valid metadata."""
    res = client.get("/api/ai/status")
    assert res.status_code == 200
    data = res.json()
    assert "is_trained" in data
    assert "prediction_horizon" in data
    assert "features" in data
    assert len(data["features"]) > 0
    assert "targets" in data
    assert len(data["targets"]) == 4


def test_ai_train_endpoint():
    """Verify AI training across multiple scenarios produces valid evaluation metrics."""
    payload = {
        "prediction_horizon": 2,
        "num_train_scenarios": 2,
        "steps_per_scenario": 18,
        "random_seed": 42
    }
    res = client.post("/api/ai/train", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "evaluations" in data
    assert len(data["evaluations"]) == 4

    for ev in data["evaluations"]:
        assert "target" in ev
        assert "rf_metrics" in ev
        assert "persistence_metrics" in ev
        assert ev["rf_metrics"]["mae"] >= 0
        assert ev["rf_metrics"]["rmse"] >= 0


def test_ai_predict_endpoint():
    """Verify near-future traffic predictions for City A and City B."""
    # Ensure simulation has stepped forward
    sim_engine.advance_step(2)

    res = client.post("/api/ai/predict", json={"prediction_horizon": 2})
    assert res.status_code == 200
    data = res.json()
    assert "predictions" in data
    assert "target_step" in data
    assert data["target_step"] == data["current_step"] + 2

    preds = data["predictions"]
    assert "city_a_demand" in preds
    assert "city_a_congestion" in preds
    assert "city_b_demand" in preds
    assert "city_b_congestion" in preds

    for target_key, item in preds.items():
        assert item["predicted_value"] >= 0
        assert item["persistence_baseline"] >= 0
        assert item["current_value"] >= 0


def test_ai_evaluation_and_history_endpoints():
    """Verify evaluation and history endpoints return structured comparison data."""
    eval_res = client.get("/api/ai/evaluation")
    assert eval_res.status_code == 200
    evals = eval_res.json()
    assert len(evals) == 4

    hist_res = client.get("/api/ai/history")
    assert hist_res.status_code == 200
    hist = hist_res.json()
    assert "history" in hist
    assert isinstance(hist["history"], list)
