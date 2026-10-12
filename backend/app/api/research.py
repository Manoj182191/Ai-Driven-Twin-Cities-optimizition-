from fastapi import APIRouter, HTTPException, Query, Response
from typing import List, Optional

from ..models.research_models import (
    ExperimentConfigRequest,
    ResearchExperimentStatus,
    ResearchExperimentResponse,
    ScenarioStatisticalSummary
)
from ..services.research_experiment_runner import experiment_runner
from ..services.research_storage import storage_service

router = APIRouter(prefix="/api/research", tags=["Research Evaluation"])


@router.post("/experiments/run", response_model=ResearchExperimentStatus)
def run_experiment(config: ExperimentConfigRequest):
    """
    Launches a multi-seed, multi-scenario matched experiment comparing:
    1. Unoptimized baseline
    2. Phase 5 Independent City Optimization
    3. Phase 6 Joint Coordinated Optimization
    """
    if config.num_seeds < 1 or config.num_seeds > 50:
        raise HTTPException(status_code=400, detail="num_seeds must be between 1 and 50.")
    if config.steps < 6 or config.steps > 48:
        raise HTTPException(status_code=400, detail="steps must be between 6 and 48.")
    if not config.scenarios:
        raise HTTPException(status_code=400, detail="At least one scenario must be provided.")

    experiment_id = experiment_runner.launch_experiment(config)
    status = storage_service.get_status(experiment_id)
    if not status:
        raise HTTPException(status_code=500, detail="Failed to initialize experiment.")
    return status


@router.get("/experiments/status/{experiment_id}", response_model=ResearchExperimentStatus)
def get_experiment_status(experiment_id: str):
    """Reports execution status, current scenario/seed, and completion progress percentage."""
    status = storage_service.get_status(experiment_id)
    if not status:
        raise HTTPException(status_code=404, detail=f"Experiment '{experiment_id}' not found.")
    return status


@router.get("/experiments/{experiment_id}/results", response_model=ResearchExperimentResponse)
def get_experiment_results(experiment_id: str):
    """Retrieves full results, run records, descriptive metrics, and hypothesis testing summaries."""
    exp = storage_service.get_experiment(experiment_id)
    if not exp:
        # Check if still running
        status = storage_service.get_status(experiment_id)
        if status and status.status in ("pending", "running"):
            raise HTTPException(
                status_code=202,
                detail=f"Experiment '{experiment_id}' is still in progress ({status.progress_pct}%)."
            )
        raise HTTPException(status_code=404, detail=f"Experiment '{experiment_id}' not found.")
    return exp


@router.get("/experiments/{experiment_id}/statistics")
def get_experiment_statistics(experiment_id: str):
    """Retrieves statistical analysis summaries, 95% CIs, and hypothesis tests."""
    exp = storage_service.get_experiment(experiment_id)
    if not exp:
        raise HTTPException(status_code=404, detail=f"Experiment '{experiment_id}' not found.")
    return {
        "experiment_id": exp.experiment_id,
        "name": exp.name,
        "scenario_summaries": exp.scenario_summaries,
        "computational_cost_summary": exp.computational_cost_summary,
        "research_summary_text": exp.research_summary_text
    }


@router.get("/experiments/history", response_model=List[ResearchExperimentStatus])
def get_experiment_history():
    """Lists all stored experiment records with timestamp and completion status."""
    return storage_service.list_experiments()


@router.get("/experiments/{experiment_id}/export")
def export_experiment(experiment_id: str, format: str = Query("json", pattern="^(json|csv)$")):
    """Exports raw and summarized experiment outcomes as CSV or JSON format."""
    exp = storage_service.get_experiment(experiment_id)
    if not exp:
        raise HTTPException(status_code=404, detail=f"Experiment '{experiment_id}' not found.")

    if format == "csv":
        csv_content = storage_service.export_csv(experiment_id)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={experiment_id}_results.csv"}
        )
    else:
        json_content = storage_service.export_json(experiment_id)
        return Response(
            content=json_content,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={experiment_id}_results.json"}
        )
