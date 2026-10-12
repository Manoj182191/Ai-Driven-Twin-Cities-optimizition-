from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, Response
from typing import List, Dict, Optional, Any
from pydantic import BaseModel

from ..models.realworld_models import (
    DataSourceType,
    DatasetMetadata,
    DataQualityReport,
    DataSourceInfo,
    NetworkRoadMapping,
    CalibrationRequest,
    CalibrationResult,
    DigitalTwinValidationReport
)
from ..services.realworld_service import realworld_data_service
from ..services.calibration_service import calibration_service

router = APIRouter(prefix="/api/data/traffic", tags=["realworld-data"])


class ImportJsonRequest(BaseModel):
    dataset_name: str
    source_name: str
    records: List[Dict[str, Any]]
    description: Optional[str] = None


class ValidationRequest(BaseModel):
    dataset_id: str
    calibration_params: Optional[Dict[str, float]] = None


@router.get("/sources", response_model=List[DataSourceInfo])
def get_traffic_sources():
    """Returns available data providers, configured external APIs, and licenses."""
    return realworld_data_service.get_sources_info()


@router.get("/datasets", response_model=List[DatasetMetadata])
def list_datasets():
    """Lists all imported and benchmark traffic observation datasets."""
    return list(realworld_data_service.datasets.values())


@router.get("/datasets/{dataset_id}", response_model=Dict[str, Any])
def get_dataset(dataset_id: str, preview_limit: int = Query(default=25, ge=1, le=100)):
    """Retrieves dataset metadata, quality overview, active road mappings, and preview rows."""
    if dataset_id not in realworld_data_service.datasets:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")

    metadata = realworld_data_service.datasets[dataset_id]
    records = realworld_data_service.dataset_records.get(dataset_id, [])
    return {
        "metadata": metadata,
        "preview_records": records[:preview_limit],
        "total_records": len(records)
    }


@router.get("/datasets/{dataset_id}/quality", response_model=DataQualityReport)
def get_dataset_quality(dataset_id: str):
    """Returns data quality report including quarantine log and missing fields breakdown."""
    if dataset_id not in realworld_data_service.datasets:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")

    return realworld_data_service.datasets[dataset_id].quality_report


@router.get("/datasets/{dataset_id}/export")
def export_dataset(dataset_id: str, format: str = Query(default="json", pattern="^(json|csv)$")):
    """Exports validated traffic observations as downloadable CSV or JSON."""
    if dataset_id not in realworld_data_service.datasets:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")

    content = realworld_data_service.export_dataset(dataset_id, format_type=format)
    media_type = "text/csv" if format == "csv" else "application/json"
    filename = f"{dataset_id}_validated.{format}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/upload", response_model=DatasetMetadata)
async def upload_traffic_file(
    file: UploadFile = File(...),
    dataset_name: str = Form(default="Uploaded Traffic Dataset"),
    source_name: str = Form(default="Municipal CSV Upload")
):
    """
    Ingests and validates uploaded CSV or JSON traffic observations with strict schema checks.
    File size capped at 10 MB for security and memory safety.
    """
    # Enforce 10 MB size limit
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File exceeds 10 MB upload ceiling.")

    text_content = contents.decode("utf-8", errors="replace")
    filename = file.filename or ""

    try:
        if filename.endswith(".csv") or "," in text_content.splitlines()[0]:
            return realworld_data_service.parse_csv_content(
                csv_content=text_content,
                source_name=source_name,
                dataset_name=dataset_name
            )
        elif filename.endswith(".json") or text_content.strip().startswith(("[", "{")):
            return realworld_data_service.parse_json_content(
                json_content=text_content,
                source_name=source_name,
                dataset_name=dataset_name
            )
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload CSV or JSON.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Data ingestion parsing error: {str(e)}")


@router.post("/import", response_model=DatasetMetadata)
def import_traffic_json(payload: ImportJsonRequest):
    """Imports structured JSON traffic observation records into the repository."""
    return realworld_data_service.ingest_records(
        name=payload.dataset_name,
        source_name=payload.source_name,
        source_type=DataSourceType.JSON_IMPORT,
        raw_rows=payload.records,
        description=payload.description or "Imported via JSON API payload."
    )


@router.post("/datasets/{dataset_id}/mappings", response_model=DatasetMetadata)
def update_dataset_mappings(dataset_id: str, mappings: List[NetworkRoadMapping]):
    """Updates the transparent mapping between sensor locations and twin city roads."""
    try:
        return realworld_data_service.update_road_mappings(dataset_id, mappings)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found.")


@router.post("/calibrate", response_model=CalibrationResult)
def calibrate_digital_twin(request: CalibrationRequest):
    """
    Calibrates digital twin simulation parameters against observed traffic data
    using a bounded search over a chronological training period.
    """
    try:
        return calibration_service.calibrate_simulation(request)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calibration error: {str(e)}")


@router.post("/validate", response_model=DigitalTwinValidationReport)
def validate_digital_twin(request: ValidationRequest):
    """
    Computes empirical digital twin validation metrics (MAE, RMSE, Safe MAPE, Bias, Pearson r)
    comparing observed ground truth to simulated dynamics across all mapped roads.
    """
    try:
        return calibration_service.validate_dataset(
            dataset_id=request.dataset_id,
            calibration_params=request.calibration_params
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation error: {str(e)}")
