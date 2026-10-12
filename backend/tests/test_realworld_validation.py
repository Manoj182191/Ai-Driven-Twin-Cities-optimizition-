import pytest
import io
import json
import math
from fastapi.testclient import TestClient
from app.main import app
from app.services.realworld_service import realworld_data_service
from app.services.calibration_service import (
    calibration_service,
    compute_safe_validation_metrics
)
from app.models.realworld_models import (
    CalibrationRequest,
    CalibrationParameterBounds,
    NetworkRoadMapping,
    DataSourceType,
    DataOriginTag
)

client = TestClient(app)


def test_sources_endpoint_and_secrets_safety():
    """Verify traffic sources endpoint returns data providers without exposing API keys."""
    response = client.get("/api/data/traffic/sources")
    assert response.status_code == 200
    sources = response.json()
    assert len(sources) >= 4
    
    source_ids = [s["source_id"] for s in sources]
    assert "csv_uploader" in source_ids
    assert "twin_cities_benchmark" in source_ids
    assert "external_municipal_api" in source_ids
    external_source = next(s for s in sources if s["source_id"] == "external_municipal_api")
    assert external_source["is_live_configured"] is False
    assert "does not fetch live" in external_source["description"]
    
    # Secrets safety check: no token/password in response
    resp_text = json.dumps(sources).lower()
    assert "secret" not in resp_text
    assert "password" not in resp_text
    assert "bearer" not in resp_text


def test_benchmark_dataset_preloaded():
    """Verify built-in benchmark dataset is available out-of-the-box."""
    response = client.get("/api/data/traffic/datasets")
    assert response.status_code == 200
    datasets = response.json()
    assert len(datasets) >= 1
    
    ds = datasets[0]
    assert "Twin Cities" in ds["name"]
    assert ds["record_count"] >= 40
    assert len(ds["active_mappings"]) > 0


def test_generated_benchmark_has_synthetic_provenance_and_disclaimer():
    dataset_id = "DATASET-BENCHMARK-TC-01"
    metadata = realworld_data_service.datasets[dataset_id]
    records = realworld_data_service.dataset_records[dataset_id]

    assert metadata.source_type == DataSourceType.BENCHMARK_SAMPLE
    assert records
    assert all(record.data_origin == DataOriginTag.SIMULATED for record in records)

    report = calibration_service.validate_dataset(dataset_id)
    assert "synthetic benchmark" in report.academic_disclaimer.lower()
    assert "not external sensor telemetry" in report.academic_disclaimer.lower()
    assert report.dataset_provenance["data_origins"] == [DataOriginTag.SIMULATED.value]


def test_csv_upload_ingestion_and_quality():
    """Verify CSV upload parsing, schema validation, and data quality diagnostics."""
    csv_data = (
        "timestamp,location_id,location_name,vehicle_count,average_speed_kmh,travel_time_mins,occupancy_pct,queue_length\n"
        "2026-10-01 08:00:00,SENSOR_A1,Downtown Link,150,48.5,6.2,35.0,0.0\n"
        "2026-10-01 09:00:00,SENSOR_A1,Downtown Link,190,42.0,7.1,45.0,2.0\n"
        "2026-10-01 10:00:00,SENSOR_A1,Downtown Link,140,51.0,5.9,32.0,0.0\n"
        "2026-10-01 11:00:00,SENSOR_A1,Downtown Link,130,53.2,5.6,30.0,0.0\n"
        "2026-10-01 12:00:00,SENSOR_A1,Downtown Link,160,46.0,6.5,38.0,1.0\n"
        "2026-10-01 13:00:00,SENSOR_A1,Downtown Link,155,47.8,6.3,36.0,0.0\n"
    )
    files = {"file": ("test_traffic.csv", csv_data, "text/csv")}
    data = {"dataset_name": "Test Municipal CSV", "source_name": "Test Source"}

    response = client.post("/api/data/traffic/upload", files=files, data=data)
    assert response.status_code == 200
    res = response.json()
    assert res["name"] == "Test Municipal CSV"
    assert res["record_count"] == 6
    assert res["quality_report"]["valid_records_count"] == 6
    assert res["quality_report"]["quarantined_records_count"] == 0


def test_quarantine_rejections_and_duplicate_detection():
    """Verify malformed records, negative volumes, and duplicate timestamps are quarantined with clear reasons."""
    csv_dirty = (
        "timestamp,location_id,vehicle_count,average_speed_kmh\n"
        "2026-10-01 08:00:00,SENSOR_1,100,50.0\n"
        "2026-10-01 08:00:00,SENSOR_1,110,48.0\n"  # Duplicate key!
        "invalid_time,SENSOR_2,120,45.0\n"         # Malformed timestamp!
        "2026-10-01 09:00:00,SENSOR_3,-50,45.0\n"  # Negative volume!
        "2026-10-01 10:00:00,SENSOR_4,100,280.0\n" # Speed out of bounds!
        ",SENSOR_5,100,45.0\n"                     # Missing timestamp!
    )
    files = {"file": ("dirty_traffic.csv", csv_dirty, "text/csv")}
    response = client.post("/api/data/traffic/upload", files=files, data={"dataset_name": "Dirty CSV", "source_name": "Test"})
    assert response.status_code == 200
    res = response.json()
    
    assert res["quality_report"]["valid_records_count"] == 1
    assert res["quality_report"]["quarantined_records_count"] == 5
    assert res["quality_report"]["duplicate_records_count"] == 1
    
    reasons = [q["rejection_reason"] for q in res["quality_report"]["quarantine_log"]]
    assert any("Duplicate" in r for r in reasons)
    assert any("Malformed timestamp" in r for r in reasons)
    assert any("Negative vehicle count" in r for r in reasons)
    assert any("out of feasible physical bounds" in r for r in reasons)


def test_json_import_endpoint():
    """Verify structured JSON payload import endpoint."""
    payload = {
        "dataset_name": "API Ingested Traffic",
        "source_name": "Sensor Feed JSON",
        "records": [
            {"timestamp": "2026-10-01T08:00:00Z", "location_id": "IC_TRUNK_1", "vehicle_count": 220, "average_speed_kmh": 85.0, "travel_time_mins": 16.9},
            {"timestamp": "2026-10-01T09:00:00Z", "location_id": "IC_TRUNK_1", "vehicle_count": 240, "average_speed_kmh": 80.0, "travel_time_mins": 18.0},
            {"timestamp": "2026-10-01T10:00:00Z", "location_id": "IC_TRUNK_1", "vehicle_count": 210, "average_speed_kmh": 88.0, "travel_time_mins": 16.3},
            {"timestamp": "2026-10-01T11:00:00Z", "location_id": "IC_TRUNK_1", "vehicle_count": 190, "average_speed_kmh": 90.0, "travel_time_mins": 16.0},
            {"timestamp": "2026-10-01T12:00:00Z", "location_id": "IC_TRUNK_1", "vehicle_count": 230, "average_speed_kmh": 82.0, "travel_time_mins": 17.5},
            {"timestamp": "2026-10-01T13:00:00Z", "location_id": "IC_TRUNK_1", "vehicle_count": 225, "average_speed_kmh": 83.5, "travel_time_mins": 17.2}
        ]
    }
    response = client.post("/api/data/traffic/import", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["record_count"] == 6
    assert data["source_type"] == "json_import"


def test_safe_validation_metrics_zero_denominator_and_variance():
    """Verify metrics calculation prevents division-by-zero explosions and NaN correlations."""
    # Test zero denominator with safe MAPE
    y_obs = [0.0, 0.0, 0.0]
    y_sim = [1.0, 2.0, 0.5]
    metrics = compute_safe_validation_metrics(y_obs, y_sim, epsilon=0.5)
    
    assert metrics.mae > 0
    assert not math.isnan(metrics.safe_mape_pct)
    assert metrics.pearson_correlation == 0.0  # Zero variance safe return


def test_road_mappings_update():
    """Verify updating network road mappings and tracking unmatched locations."""
    # Fetch existing benchmark
    ds_list = client.get("/api/data/traffic/datasets").json()
    ds_id = ds_list[0]["dataset_id"]
    
    new_mapping = [
        {
            "source_location_id": "SENSOR_ALPHA_NORTH",
            "target_road_id": "A1",
            "target_city": "City A",
            "mapping_method": "manual",
            "confidence_score": 1.0,
            "unit_conversion_factor": 1.0,
            "notes": "Custom calibration alignment"
        }
    ]
    resp = client.post(f"/api/data/traffic/datasets/{ds_id}/mappings", json=new_mapping)
    assert resp.status_code == 200
    res_data = resp.json()
    assert len(res_data["active_mappings"]) == 1
    assert res_data["active_mappings"][0]["target_road_id"] == "A1"


def test_calibration_workflow_with_chronological_split():
    """Verify calibration workflow searches bounded parameters across chronological train split."""
    ds_list = client.get("/api/data/traffic/datasets").json()
    ds_id = ds_list[0]["dataset_id"]

    calib_payload = {
        "dataset_id": ds_id,
        "train_ratio": 0.7,
        "target_metric": "travel_time",
        "max_search_evaluations": 50,
        "parameter_bounds": {
            "demand_scale_min": 0.7,
            "demand_scale_max": 1.3,
            "capacity_scale_min": 0.8,
            "capacity_scale_max": 1.2,
            "speed_factor_min": 0.9,
            "speed_factor_max": 1.1,
            "intercity_capacity_scale_min": 0.8,
            "intercity_capacity_scale_max": 1.2
        }
    }
    response = client.post("/api/data/traffic/calibrate", json=calib_payload)
    assert response.status_code == 200
    res = response.json()
    assert "optimal_parameters" in res
    assert "demand_scale" in res["optimal_parameters"]
    assert res["train_window_start"] is not None
    assert res["test_window_start"] is not None
    assert res["iterations_evaluated"] > 0


def test_digital_twin_validation_endpoint():
    """Verify digital twin validation endpoint generates observed vs simulated metrics and per-road errors."""
    ds_list = client.get("/api/data/traffic/datasets").json()
    ds_id = ds_list[0]["dataset_id"]

    val_payload = {
        "dataset_id": ds_id,
        "calibration_params": {
            "demand_scale": 1.05,
            "capacity_scale": 1.0,
            "speed_factor": 1.0,
            "intercity_capacity_scale": 1.0
        }
    }
    response = client.post("/api/data/traffic/validate", json=val_payload)
    assert response.status_code == 200
    res = response.json()
    assert "default_model_metrics" in res
    assert "calibrated_model_metrics" in res
    assert len(res["per_road_summaries"]) > 0
    assert len(res["time_series_comparison"]) > 0
    assert "academic_disclaimer" in res


def test_dataset_export_formats():
    """Verify CSV and JSON export endpoints for sanitized datasets."""
    ds_list = client.get("/api/data/traffic/datasets").json()
    ds_id = ds_list[0]["dataset_id"]

    # CSV export
    r_csv = client.get(f"/api/data/traffic/datasets/{ds_id}/export?format=csv")
    assert r_csv.status_code == 200
    assert "observation_id,timestamp" in r_csv.text

    # JSON export
    r_json = client.get(f"/api/data/traffic/datasets/{ds_id}/export?format=json")
    assert r_json.status_code == 200
    json_data = r_json.json()
    assert isinstance(json_data, list)
    assert len(json_data) > 0
