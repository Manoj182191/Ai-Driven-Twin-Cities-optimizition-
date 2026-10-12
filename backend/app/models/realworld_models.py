from enum import Enum
from typing import List, Dict, Optional, Any, Tuple
from pydantic import BaseModel, Field


class DataSourceType(str, Enum):
    CSV_UPLOAD = "csv_upload"
    JSON_IMPORT = "json_import"
    BENCHMARK_SAMPLE = "benchmark_sample"
    EXTERNAL_API = "external_api"
    SIMULATED_REFERENCE = "simulated_reference"


class DataOriginTag(str, Enum):
    OBSERVED = "OBSERVED"
    IMPUTED = "IMPUTED"
    SIMULATED = "SIMULATED"
    CALIBRATED = "CALIBRATED"


class TrafficObservationRecord(BaseModel):
    observation_id: str
    timestamp: str  # ISO 8601 format
    source_timezone: str = "UTC"
    location_id: str
    location_name: Optional[str] = None
    vehicle_count: Optional[float] = None
    average_speed_kmh: Optional[float] = None
    travel_time_mins: Optional[float] = None
    occupancy_pct: Optional[float] = None
    queue_length: Optional[float] = None
    weather_condition: Optional[str] = None
    incident_reported: Optional[bool] = False
    source_name: str
    data_origin: DataOriginTag = DataOriginTag.OBSERVED
    ingestion_timestamp: str


class QuarantineRecord(BaseModel):
    row_index: int
    raw_data: Dict[str, Any]
    rejection_reason: str


class DataQualityReport(BaseModel):
    total_records_ingested: int
    valid_records_count: int
    quarantined_records_count: int
    duplicate_records_count: int
    missing_fields_summary: Dict[str, int]
    outliers_detected_count: int
    temporal_range: Dict[str, Optional[str]] = Field(
        default_factory=lambda: {"start": None, "end": None}
    )
    quarantine_log: List[QuarantineRecord] = Field(default_factory=list)


class NetworkRoadMapping(BaseModel):
    source_location_id: str
    target_road_id: str  # A1..A10, B1..B10, or IC_CORRIDOR
    target_city: str  # "City A", "City B", or "Intercity Corridor"
    mapping_method: str = "manual"  # manual, heuristic_id, coordinate_proximity
    confidence_score: float = Field(default=1.0, ge=0.0, le=1.0)
    unit_conversion_factor: float = 1.0
    notes: Optional[str] = None


class DatasetMetadata(BaseModel):
    dataset_id: str
    name: str
    source_name: str
    source_type: DataSourceType
    description: str
    created_at: str
    record_count: int
    quality_report: DataQualityReport
    active_mappings: List[NetworkRoadMapping] = Field(default_factory=list)
    unmatched_locations: List[str] = Field(default_factory=list)


class CalibrationParameterBounds(BaseModel):
    demand_scale_min: float = 0.5
    demand_scale_max: float = 2.0
    capacity_scale_min: float = 0.7
    capacity_scale_max: float = 1.5
    speed_factor_min: float = 0.8
    speed_factor_max: float = 1.2
    intercity_capacity_scale_min: float = 0.5
    intercity_capacity_scale_max: float = 1.8


class CalibrationRequest(BaseModel):
    dataset_id: str
    train_ratio: float = Field(default=0.7, ge=0.4, le=0.9, description="Chronological split: 0.7 = 70% calibration train, 30% validation holdout")
    parameter_bounds: Optional[CalibrationParameterBounds] = None
    target_metric: str = Field(default="travel_time", description="travel_time, speed, or volume")
    max_search_evaluations: int = Field(default=120, ge=20, le=400)


class ValidationMetrics(BaseModel):
    mae: float
    rmse: float
    safe_mape_pct: float
    mean_signed_bias: float
    pearson_correlation: float
    sample_size: int


class CalibrationResult(BaseModel):
    calibration_id: str
    dataset_id: str
    timestamp: str
    optimal_parameters: Dict[str, float]
    initial_objective_error: float
    calibrated_objective_error: float
    improvement_pct: float
    train_window_start: str
    train_window_end: str
    test_window_start: str
    test_window_end: str
    iterations_evaluated: int
    convergence_status: str
    uncalibrated_validation: ValidationMetrics
    calibrated_validation: ValidationMetrics


class RoadValidationSummary(BaseModel):
    road_id: str
    location_id: str
    sample_size: int
    uncalibrated_mae: float
    calibrated_mae: float
    improvement_pct: float
    correlation: float


class DigitalTwinValidationReport(BaseModel):
    validation_id: str
    dataset_id: str
    calibration_id: Optional[str]
    timestamp: str
    validation_status: str
    default_model_metrics: ValidationMetrics
    calibrated_model_metrics: ValidationMetrics
    per_road_summaries: List[RoadValidationSummary]
    time_series_comparison: List[Dict[str, Any]]
    academic_disclaimer: str
    dataset_provenance: Dict[str, Any]


class DataSourceInfo(BaseModel):
    source_id: str
    name: str
    source_type: DataSourceType
    is_live_configured: bool
    requires_credentials: bool
    license_type: str
    description: str
