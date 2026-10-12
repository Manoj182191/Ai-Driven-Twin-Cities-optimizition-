import io
import csv
import json
import uuid
import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Tuple, Any

from ..models.realworld_models import (
    DataSourceType,
    DataOriginTag,
    TrafficObservationRecord,
    QuarantineRecord,
    DataQualityReport,
    NetworkRoadMapping,
    DatasetMetadata,
    DataSourceInfo
)


class RealWorldDataService:
    """
    Phase 9: Pluggable Real-World Traffic Data Integration Layer.
    Responsible for:
    - Ingesting, parsing, and validating CSV and JSON traffic observation files.
    - Strict schema verification, quarantine isolation, duplicate tracking, and missing-field auditing.
    - Transparent mapping between external sensor locations and simulated twin roads (A1..A10, B1..B10, IC_CORRIDOR).
    - Preserving data provenance and distinguishing OBSERVED, IMPUTED, SIMULATED, and CALIBRATED data.
    """

    def __init__(self):
        self.datasets: Dict[str, DatasetMetadata] = {}
        self.dataset_records: Dict[str, List[TrafficObservationRecord]] = {}
        self._initialize_benchmark_datasets()

    def get_sources_info(self) -> List[DataSourceInfo]:
        """Returns the list of available data providers and their operational status."""
        return [
            DataSourceInfo(
                source_id="csv_uploader",
                name="Local CSV File Upload Engine",
                source_type=DataSourceType.CSV_UPLOAD,
                is_live_configured=True,
                requires_credentials=False,
                license_type="Public / Open License (User Provided)",
                description="Ingests user-provided municipal traffic logs, loop detector records, and corridor telemetry in CSV format; source authenticity is not verified."
            ),
            DataSourceInfo(
                source_id="json_importer",
                name="Structured JSON Ingestion Engine",
                source_type=DataSourceType.JSON_IMPORT,
                is_live_configured=True,
                requires_credentials=False,
                license_type="Public / Open License (User Provided)",
                description="Accepts user-provided normalized JSON records; source authenticity is not verified."
            ),
            DataSourceInfo(
                source_id="twin_cities_benchmark",
                name="Synthetic Twin Cities Benchmark (PeMS-schema-aligned)",
                source_type=DataSourceType.BENCHMARK_SAMPLE,
                is_live_configured=True,
                requires_credentials=False,
                license_type="Synthetic sample; no external data source",
                description="Formula-generated benchmark with 48 hourly intervals per sensor, aligned to a PeMS-like schema; not external observations."
            ),
            DataSourceInfo(
                source_id="corridor_sensor_benchmark",
                name="Synthetic Intercity Corridor Benchmark",
                source_type=DataSourceType.BENCHMARK_SAMPLE,
                is_live_configured=True,
                requires_credentials=False,
                license_type="Synthetic sample; no external data source",
                description="Synthetic corridor benchmark metadata; no radar or toll-tag observations are bundled."
            ),
            DataSourceInfo(
                source_id="external_municipal_api",
                name="External Municipal API Connector (not implemented)",
                source_type=DataSourceType.EXTERNAL_API,
                is_live_configured=False,
                requires_credentials=True,
                license_type="Government Open Data Terms",
                description="Reserved source entry only; this application does not fetch live municipal traffic data. Use CSV/JSON import for user-supplied records."
            )
        ]

    def _initialize_benchmark_datasets(self):
        """Populates a formula-generated benchmark for development, testing, and calibration."""
        # 1. Twin Cities Arterial Benchmark (48 steps, 2 days of diurnal cycle)
        base_time = datetime(2026, 10, 1, 0, 0, tzinfo=timezone.utc)
        benchmark_records: List[TrafficObservationRecord] = []
        ingest_time = datetime.now(timezone.utc).isoformat()

        # Target sensor locations covering City A, City B, and the Intercity Corridor
        sensors = [
            ("SENSOR_ALPHA_NORTH", "Road A1 (Alpha Heights North)", "A1", "City A", 50.0, 180),
            ("SENSOR_ALPHA_CORE", "Road A7 (Alpha Downtown Corridor)", "A7", "City A", 60.0, 220),
            ("SENSOR_ALPHA_PORT", "Road A5 (Alpha Industrial Port)", "A5", "City A", 50.0, 190),
            ("SENSOR_BETA_CAMPUS", "Road B1 (Beta University District)", "B1", "City B", 45.0, 160),
            ("SENSOR_BETA_CORE", "Road B7 (Beta Financial Gateway)", "B7", "City B", 55.0, 200),
            ("SENSOR_IC_CORRIDOR", "Intercity Trunk Corridor Link", "IC_CORRIDOR", "Intercity Corridor", 90.0, 250),
        ]

        mappings: List[NetworkRoadMapping] = []
        for s_id, s_name, road_id, city, free_speed, base_cap in sensors:
            mappings.append(NetworkRoadMapping(
                source_location_id=s_id,
                target_road_id=road_id,
                target_city=city,
                mapping_method="heuristic_id",
                confidence_score=0.98,
                unit_conversion_factor=1.0,
                notes=f"Mapped to simulated link {road_id} based on geometry and capacity alignment."
            ))

            # Generate 48 synthetic time steps with diurnal oscillations.
            for step in range(48):
                hour = step % 24
                # Morning peak at hour 7, Evening peak at hour 17
                peak_factor = (
                    0.42 * math.exp(-((hour - 7) ** 2) / 4.5) +
                    0.38 * math.exp(-((hour - 17) ** 2) / 5.0) +
                    0.45 + 0.10 * math.sin(hour * math.pi / 12)
                )

                volume = int(base_cap * peak_factor * (0.95 + 0.1 * math.sin(step)))
                v_c = volume / max(base_cap, 1)
                speed = max(18.0, free_speed / (1.0 + 0.18 * (v_c ** 3.8)))
                length_km = 5.0 if "A" in road_id or "B" in road_id else 24.0
                travel_time = round((length_km / speed) * 60.0, 2)
                occupancy = min(98.0, round(v_c * 42.0, 1))
                queue = max(0.0, float(int((v_c - 0.85) * 35.0))) if v_c > 0.85 else 0.0

                t_stamp = (base_time + timedelta(hours=step)).isoformat()
                benchmark_records.append(TrafficObservationRecord(
                    observation_id=f"OBS-BM-{s_id}-{step}",
                    timestamp=t_stamp,
                    source_timezone="UTC",
                    location_id=s_id,
                    location_name=s_name,
                    vehicle_count=float(volume),
                    average_speed_kmh=round(speed, 1),
                    travel_time_mins=travel_time,
                    occupancy_pct=occupancy,
                    queue_length=queue,
                    weather_condition="Clear",
                    incident_reported=(step == 18 and s_id == "SENSOR_IC_CORRIDOR"),
                    source_name="Synthetic Twin Cities PeMS-schema benchmark",
                    data_origin=DataOriginTag.SIMULATED,
                    ingestion_timestamp=ingest_time
                ))

        ds_id = "DATASET-BENCHMARK-TC-01"
        report = DataQualityReport(
            total_records_ingested=len(benchmark_records),
            valid_records_count=len(benchmark_records),
            quarantined_records_count=0,
            duplicate_records_count=0,
            missing_fields_summary={"weather_condition": 0, "queue_length": 0},
            outliers_detected_count=0,
            temporal_range={"start": benchmark_records[0].timestamp, "end": benchmark_records[-1].timestamp},
            quarantine_log=[]
        )

        metadata = DatasetMetadata(
            dataset_id=ds_id,
            name="Synthetic Twin Cities Benchmark (PeMS-schema-aligned)",
            source_name="Synthetic Twin Cities PeMS-schema benchmark",
            source_type=DataSourceType.BENCHMARK_SAMPLE,
            description="Formula-generated synthetic records: 48 hourly intervals at each of 6 locations. No external traffic observations are included.",
            created_at=ingest_time,
            record_count=len(benchmark_records),
            quality_report=report,
            active_mappings=mappings,
            unmatched_locations=[]
        )

        self.datasets[ds_id] = metadata
        self.dataset_records[ds_id] = benchmark_records

    def ingest_records(
        self,
        name: str,
        source_name: str,
        source_type: DataSourceType,
        raw_rows: List[Dict[str, Any]],
        description: str = ""
    ) -> DatasetMetadata:
        """
        Validates, sanitizes, and stores traffic observation records.
        Quarantines malformed rows and tracks missing values and duplicates.
        """
        ingest_time = datetime.now(timezone.utc).isoformat()
        dataset_id = f"DATASET-{uuid.uuid4().hex[:8].upper()}"

        valid_records: List[TrafficObservationRecord] = []
        quarantine_log: List[QuarantineRecord] = []
        seen_keys = set()
        duplicate_count = 0
        missing_fields = {
            "vehicle_count": 0,
            "average_speed_kmh": 0,
            "travel_time_mins": 0,
            "occupancy_pct": 0,
            "queue_length": 0,
            "weather_condition": 0
        }
        outliers_count = 0
        timestamps: List[str] = []

        for idx, row in enumerate(raw_rows):
            # 1. Required field checks
            ts_raw = row.get("timestamp")
            loc_id = row.get("location_id") or row.get("road_id") or row.get("sensor_id")

            if not ts_raw:
                quarantine_log.append(QuarantineRecord(
                    row_index=idx,
                    raw_data=row,
                    rejection_reason="Missing required 'timestamp' field"
                ))
                continue

            if not loc_id:
                quarantine_log.append(QuarantineRecord(
                    row_index=idx,
                    raw_data=row,
                    rejection_reason="Missing required location/segment identifier"
                ))
                continue

            # 2. Timestamp parsing & ISO normalization
            norm_ts = None
            try:
                # Handle ISO 8601 or common datetime formats
                if "T" in str(ts_raw):
                    dt = datetime.fromisoformat(str(ts_raw).replace("Z", "+00:00"))
                else:
                    dt = datetime.strptime(str(ts_raw).strip(), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                norm_ts = dt.isoformat()
            except Exception:
                quarantine_log.append(QuarantineRecord(
                    row_index=idx,
                    raw_data=row,
                    rejection_reason=f"Malformed timestamp format: '{ts_raw}'"
                ))
                continue

            # 3. Duplicate check (same timestamp and location)
            dup_key = (norm_ts, str(loc_id).strip())
            if dup_key in seen_keys:
                duplicate_count += 1
                quarantine_log.append(QuarantineRecord(
                    row_index=idx,
                    raw_data=row,
                    rejection_reason=f"Duplicate observation for location '{loc_id}' at timestamp '{norm_ts}'"
                ))
                continue
            seen_keys.add(dup_key)

            # 4. Metric parsing and range validation
            def parse_float_val(val: Any) -> Optional[float]:
                if val is None or val == "" or str(val).lower() in ("null", "none", "nan", "na"):
                    return None
                try:
                    return float(val)
                except ValueError:
                    return None

            v_count = parse_float_val(row.get("vehicle_count") or row.get("volume"))
            speed = parse_float_val(row.get("average_speed_kmh") or row.get("speed"))
            tt = parse_float_val(row.get("travel_time_mins") or row.get("travel_time"))
            occ = parse_float_val(row.get("occupancy_pct") or row.get("occupancy"))
            q_len = parse_float_val(row.get("queue_length") or row.get("queue"))
            weather = row.get("weather_condition")

            # Missing field auditing
            if v_count is None: missing_fields["vehicle_count"] += 1
            if speed is None: missing_fields["average_speed_kmh"] += 1
            if tt is None: missing_fields["travel_time_mins"] += 1
            if occ is None: missing_fields["occupancy_pct"] += 1
            if q_len is None: missing_fields["queue_length"] += 1
            if weather is None: missing_fields["weather_condition"] += 1

            # Value range checks
            rejection_reason = None
            if v_count is not None and v_count < 0:
                rejection_reason = f"Negative vehicle count: {v_count}"
            elif speed is not None and (speed <= 0 or speed > 220):
                rejection_reason = f"Average speed out of feasible physical bounds (0-220 km/h): {speed}"
            elif tt is not None and (tt <= 0 or tt > 300):
                rejection_reason = f"Travel time out of feasible physical bounds (0-300 mins): {tt}"
            elif occ is not None and (occ < 0 or occ > 100):
                rejection_reason = f"Occupancy percentage out of bounds [0, 100]: {occ}"
            elif q_len is not None and q_len < 0:
                rejection_reason = f"Negative queue length: {q_len}"

            if rejection_reason:
                quarantine_log.append(QuarantineRecord(
                    row_index=idx,
                    raw_data=row,
                    rejection_reason=rejection_reason
                ))
                continue

            # Outlier detection (e.g. speed > 180 km/h on non-highway, or sudden 5000+ volume)
            if (speed is not None and speed > 160) or (v_count is not None and v_count > 4000):
                outliers_count += 1

            timestamps.append(norm_ts)
            valid_records.append(TrafficObservationRecord(
                observation_id=f"OBS-{uuid.uuid4().hex[:8].upper()}",
                timestamp=norm_ts,
                source_timezone=str(row.get("timezone") or "UTC"),
                location_id=str(loc_id).strip(),
                location_name=row.get("location_name") or f"Sensor Location {loc_id}",
                vehicle_count=v_count,
                average_speed_kmh=speed,
                travel_time_mins=tt,
                occupancy_pct=occ,
                queue_length=q_len,
                weather_condition=weather,
                incident_reported=bool(row.get("incident_reported", False)),
                source_name=source_name,
                data_origin=DataOriginTag.OBSERVED,
                ingestion_timestamp=ingest_time
            ))

        # Sort valid records chronologically
        valid_records.sort(key=lambda r: r.timestamp)
        temporal_range = {
            "start": valid_records[0].timestamp if valid_records else None,
            "end": valid_records[-1].timestamp if valid_records else None
        }

        quality_report = DataQualityReport(
            total_records_ingested=len(raw_rows),
            valid_records_count=len(valid_records),
            quarantined_records_count=len(quarantine_log),
            duplicate_records_count=duplicate_count,
            missing_fields_summary=missing_fields,
            outliers_detected_count=outliers_count,
            temporal_range=temporal_range,
            quarantine_log=quarantine_log[:50]  # Store first 50 quarantine diagnostics
        )

        # Automatic initial heuristic mappings for recognized sensor IDs
        unique_locs = sorted(list({r.location_id for r in valid_records}))
        initial_mappings = self._auto_generate_mappings(unique_locs)
        unmatched = [loc for loc in unique_locs if not any(m.source_location_id == loc for m in initial_mappings)]

        metadata = DatasetMetadata(
            dataset_id=dataset_id,
            name=name,
            source_name=source_name,
            source_type=source_type,
            description=description or f"Ingested {len(valid_records)} valid traffic observations.",
            created_at=ingest_time,
            record_count=len(valid_records),
            quality_report=quality_report,
            active_mappings=initial_mappings,
            unmatched_locations=unmatched
        )

        self.datasets[dataset_id] = metadata
        self.dataset_records[dataset_id] = valid_records
        return metadata

    def _auto_generate_mappings(self, location_ids: List[str]) -> List[NetworkRoadMapping]:
        """Automatically aligns sensor IDs to City A, City B, or Corridor roads if recognized."""
        mappings: List[NetworkRoadMapping] = []
        for loc in location_ids:
            loc_upper = loc.upper()
            target_road = None
            target_city = None
            confidence = 0.5
            notes = "Heuristic location match"

            if "CORRIDOR" in loc_upper or "IC" in loc_upper or "HIGHWAY" in loc_upper:
                target_road = "IC_CORRIDOR"
                target_city = "Intercity Corridor"
                confidence = 0.95
                notes = "Matched to primary intercity arterial link"
            elif "A" in loc_upper or "ALPHA" in loc_upper:
                # Find matching link A1..A10
                for i in range(1, 11):
                    if f"A{i}" in loc_upper or f"A_{i}" in loc_upper:
                        target_road = f"A{i}"
                        break
                target_road = target_road or "A1"
                target_city = "City A"
                confidence = 0.85
            elif "B" in loc_upper or "BETA" in loc_upper:
                for i in range(1, 11):
                    if f"B{i}" in loc_upper or f"B_{i}" in loc_upper:
                        target_road = f"B{i}"
                        break
                target_road = target_road or "B1"
                target_city = "City B"
                confidence = 0.85

            if target_road:
                mappings.append(NetworkRoadMapping(
                    source_location_id=loc,
                    target_road_id=target_road,
                    target_city=target_city,
                    mapping_method="heuristic_id",
                    confidence_score=confidence,
                    unit_conversion_factor=1.0,
                    notes=notes
                ))
        return mappings

    def parse_csv_content(self, csv_content: str, source_name: str, dataset_name: str) -> DatasetMetadata:
        """Parses CSV text payload into structured traffic observations."""
        f = io.StringIO(csv_content)
        reader = csv.DictReader(f)
        raw_rows = list(reader)
        return self.ingest_records(
            name=dataset_name,
            source_name=source_name,
            source_type=DataSourceType.CSV_UPLOAD,
            raw_rows=raw_rows,
            description=f"CSV upload with {len(raw_rows)} raw records."
        )

    def parse_json_content(self, json_content: str, source_name: str, dataset_name: str) -> DatasetMetadata:
        """Parses JSON text payload (list of objects) into structured traffic observations."""
        data = json.loads(json_content)
        if isinstance(data, dict) and "records" in data:
            raw_rows = data["records"]
        elif isinstance(data, list):
            raw_rows = data
        else:
            raise ValueError("Expected JSON array of records or object with 'records' key.")

        return self.ingest_records(
            name=dataset_name,
            source_name=source_name,
            source_type=DataSourceType.JSON_IMPORT,
            raw_rows=raw_rows,
            description=f"JSON import with {len(raw_rows)} raw records."
        )

    def update_road_mappings(self, dataset_id: str, new_mappings: List[NetworkRoadMapping]) -> DatasetMetadata:
        """Updates and persists road mappings for a specific dataset."""
        if dataset_id not in self.datasets:
            raise KeyError(f"Dataset {dataset_id} not found.")

        metadata = self.datasets[dataset_id]
        metadata.active_mappings = new_mappings
        unique_locs = {r.location_id for r in self.dataset_records[dataset_id]}
        mapped_locs = {m.source_location_id for m in new_mappings}
        metadata.unmatched_locations = sorted(list(unique_locs - mapped_locs))
        return metadata

    def export_dataset(self, dataset_id: str, format_type: str = "json") -> str:
        """Exports sanitized and validated records in CSV or JSON format."""
        if dataset_id not in self.datasets:
            raise KeyError(f"Dataset {dataset_id} not found.")

        records = self.dataset_records[dataset_id]
        if format_type.lower() == "csv":
            out = io.StringIO()
            writer = csv.writer(out)
            writer.writerow([
                "observation_id", "timestamp", "source_timezone", "location_id",
                "location_name", "vehicle_count", "average_speed_kmh", "travel_time_mins",
                "occupancy_pct", "queue_length", "weather_condition", "incident_reported",
                "source_name", "data_origin"
            ])
            for r in records:
                writer.writerow([
                    r.observation_id, r.timestamp, r.source_timezone, r.location_id,
                    r.location_name, r.vehicle_count, r.average_speed_kmh, r.travel_time_mins,
                    r.occupancy_pct, r.queue_length, r.weather_condition, r.incident_reported,
                    r.source_name, r.data_origin.value
                ])
            return out.getvalue()
        else:
            return json.dumps([r.model_dump() for r in records], indent=2)


realworld_data_service = RealWorldDataService()
