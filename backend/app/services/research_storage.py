import os
import json
import csv
import io
from typing import Dict, List, Optional
from datetime import datetime, timezone

from ..models.research_models import (
    ResearchExperimentResponse,
    ResearchExperimentStatus
)

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "research_experiments")


class ResearchStorage:
    """
    Manages persistent storage and retrieval for research experiments using JSON files and an in-memory index.
    """

    def __init__(self, data_dir: str = DATA_DIR):
        self.data_dir = data_dir
        os.makedirs(self.data_dir, exist_ok=True)
        self._memory_cache: Dict[str, ResearchExperimentResponse] = {}
        self._status_cache: Dict[str, ResearchExperimentStatus] = {}
        self._load_all_from_disk()

    def _load_all_from_disk(self):
        """Loads existing experiment files on startup."""
        try:
            for fname in os.listdir(self.data_dir):
                if fname.endswith(".json") and not fname.endswith("_status.json"):
                    fpath = os.path.join(self.data_dir, fname)
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        resp = ResearchExperimentResponse(**data)
                        self._memory_cache[resp.experiment_id] = resp
                elif fname.endswith("_status.json"):
                    fpath = os.path.join(self.data_dir, fname)
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        stat = ResearchExperimentStatus(**data)
                        self._status_cache[stat.experiment_id] = stat
        except Exception:
            pass

    def save_status(self, status: ResearchExperimentStatus):
        self._status_cache[status.experiment_id] = status
        status_file = os.path.join(self.data_dir, f"{status.experiment_id}_status.json")
        try:
            with open(status_file, "w", encoding="utf-8") as f:
                json.dump(status.model_dump(), f, indent=2)
        except Exception:
            pass

    def get_status(self, experiment_id: str) -> Optional[ResearchExperimentStatus]:
        return self._status_cache.get(experiment_id)

    def save_experiment(self, experiment: ResearchExperimentResponse):
        self._memory_cache[experiment.experiment_id] = experiment
        
        # Also update status to completed
        status = ResearchExperimentStatus(
            experiment_id=experiment.experiment_id,
            name=experiment.name,
            status=experiment.status,
            progress_pct=100.0,
            completed_runs=experiment.total_runs_completed,
            total_expected_runs=experiment.total_runs_completed,
            created_at=experiment.created_at,
            completed_at=experiment.completed_at
        )
        self.save_status(status)

        exp_file = os.path.join(self.data_dir, f"{experiment.experiment_id}.json")
        with open(exp_file, "w", encoding="utf-8") as f:
            json.dump(experiment.model_dump(), f, indent=2)

    def get_experiment(self, experiment_id: str) -> Optional[ResearchExperimentResponse]:
        if experiment_id in self._memory_cache:
            return self._memory_cache[experiment_id]
        
        exp_file = os.path.join(self.data_dir, f"{experiment_id}.json")
        if os.path.exists(exp_file):
            try:
                with open(exp_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    resp = ResearchExperimentResponse(**data)
                    self._memory_cache[experiment_id] = resp
                    return resp
            except Exception:
                return None
        return None

    def list_experiments(self) -> List[ResearchExperimentStatus]:
        # Return all known experiment statuses, newest first
        res = list(self._status_cache.values())
        res.sort(key=lambda s: s.created_at, reverse=True)
        return res

    def export_csv(self, experiment_id: str) -> str:
        """Exports all run-level records to CSV format."""
        exp = self.get_experiment(experiment_id)
        if not exp or not exp.run_records:
            return ""

        output = io.StringIO()
        fieldnames = [
            "experiment_id",
            "scenario",
            "seed",
            "strategy",
            "simulation_duration",
            "system_avg_travel_time",
            "system_avg_congestion",
            "system_avg_queue_length",
            "system_objective_cost",
            "city_a_travel_time",
            "city_a_congestion",
            "city_a_queue_length",
            "city_b_travel_time",
            "city_b_congestion",
            "city_b_queue_length",
            "intercity_travel_time",
            "intercity_congestion",
            "intercity_queue_length",
            "total_intervention_cost",
            "total_vehicles_served",
            "optimization_execution_time_ms"
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for r in exp.run_records:
            writer.writerow(r.model_dump())
        return output.getvalue()

    def export_json(self, experiment_id: str) -> str:
        """Exports the full experiment document as pretty-printed JSON."""
        exp = self.get_experiment(experiment_id)
        if not exp:
            return "{}"
        return json.dumps(exp.model_dump(), indent=2)


storage_service = ResearchStorage()
