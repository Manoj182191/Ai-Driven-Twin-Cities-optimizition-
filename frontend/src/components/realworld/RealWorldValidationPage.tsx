import React, { useState, useEffect } from 'react';
import {
  fetchTrafficSources,
  fetchTrafficDatasets,
  fetchDatasetDetails,
  uploadTrafficFile,
  runDigitalTwinCalibration,
  runDigitalTwinValidation,
  getDatasetExportDownloadUrl,
  type DataSourceInfo,
  type DatasetMetadata,
  type TrafficObservationRecord,
  type CalibrationResult,
  type DigitalTwinValidationReport
} from '../../services/api';
import {
  Database,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Play,
  Download,
  Activity,
  Layers,
  TrendingDown,
  Sparkles,
  Link2
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export const RealWorldValidationPage: React.FC = () => {
  const [sources, setSources] = useState<DataSourceInfo[]>([]);
  const [datasets, setDatasets] = useState<DatasetMetadata[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
  const [datasetDetails, setDatasetDetails] = useState<{
    metadata: DatasetMetadata;
    preview_records: TrafficObservationRecord[];
    total_records: number;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [calibrating, setCalibrating] = useState<boolean>(false);
  const [validating, setValidating] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Calibration parameters state
  const [trainRatio, setTrainRatio] = useState<number>(0.7);
  const [targetMetric, setTargetMetric] = useState<'travel_time' | 'speed' | 'volume'>('travel_time');
  const [demandScaleMin, setDemandScaleMin] = useState<number>(0.7);
  const [demandScaleMax, setDemandScaleMax] = useState<number>(1.4);
  const [capacityScaleMin, setCapacityScaleMin] = useState<number>(0.8);
  const [capacityScaleMax, setCapacityScaleMax] = useState<number>(1.2);

  // Results state
  const [calibrationResult, setCalibrationResult] = useState<CalibrationResult | null>(null);
  const [validationReport, setValidationReport] = useState<DigitalTwinValidationReport | null>(null);

  // Navigation tab within page
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'quality_mapping' | 'calibration_validation'>('overview');

  useEffect(() => {
    loadSourcesAndDatasets();
  }, []);

  const loadSourcesAndDatasets = async () => {
    setLoading(true);
    setError(null);
    try {
      const [srcs, dss] = await Promise.all([
        fetchTrafficSources(),
        fetchTrafficDatasets()
      ]);
      setSources(srcs);
      setDatasets(dss);

      if (dss.length > 0) {
        const initialId = dss[0].dataset_id;
        setSelectedDatasetId(initialId);
        await selectAndLoadDataset(initialId);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load real-world data providers');
    } finally {
      setLoading(false);
    }
  };

  const selectAndLoadDataset = async (datasetId: string) => {
    setSelectedDatasetId(datasetId);
    setError(null);
    try {
      const details = await fetchDatasetDetails(datasetId, 30);
      setDatasetDetails(details);
      // Automatically trigger initial validation
      const valRep = await runDigitalTwinValidation(datasetId);
      setValidationReport(valRep);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching dataset details');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const metadata = await uploadTrafficFile(file, file.name.replace(/\.[^/.]+$/, ''), 'Local File Upload');
      const updatedDatasets = await fetchTrafficDatasets();
      setDatasets(updatedDatasets);
      await selectAndLoadDataset(metadata.dataset_id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleRunCalibration = async () => {
    if (!selectedDatasetId) return;
    setCalibrating(true);
    setError(null);
    try {
      const calRes = await runDigitalTwinCalibration({
        dataset_id: selectedDatasetId,
        train_ratio: trainRatio,
        target_metric: targetMetric,
        parameter_bounds: {
          demand_scale_min: demandScaleMin,
          demand_scale_max: demandScaleMax,
          capacity_scale_min: capacityScaleMin,
          capacity_scale_max: capacityScaleMax,
          speed_factor_min: 0.85,
          speed_factor_max: 1.15,
          intercity_capacity_scale_min: 0.7,
          intercity_capacity_scale_max: 1.3
        },
        max_search_evaluations: 100
      });
      setCalibrationResult(calRes);

      // Re-run validation with calibrated parameters
      setValidating(true);
      const valRep = await runDigitalTwinValidation(selectedDatasetId, calRes.optimal_parameters);
      setValidationReport(valRep);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Calibration execution error');
    } finally {
      setCalibrating(false);
      setValidating(false);
    }
  };

  const meta = datasetDetails?.metadata;
  const quality = meta?.quality_report;
  const isSyntheticBenchmark = meta?.source_type === 'benchmark_sample';
  const provenanceLabel = isSyntheticBenchmark
    ? 'Generated synthetic benchmark; not external observations'
    : meta?.source_type === 'csv_upload' || meta?.source_type === 'json_import'
      ? 'User-provided data; source not independently verified'
      : meta?.source_type === 'external_api'
        ? 'External feed; source not independently verified'
        : 'Source provenance unavailable';
  const inputSeriesLabel = isSyntheticBenchmark
    ? 'Synthetic benchmark input'
    : 'Imported input (source unverified)';

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Banner */}
      <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-xs font-semibold tracking-wide flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" /> PHASE 9 ACTIVE
              </span>
              <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-full text-xs font-semibold tracking-wide flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> {isSyntheticBenchmark ? 'Synthetic Benchmark' : 'Imported Traffic Data'}
              </span>
              {loading && (
                <span className="px-2.5 py-1 bg-slate-800 text-slate-400 rounded-full text-xs font-mono">
                  Syncing Sources...
                </span>
              )}
              {validating && (
                <span className="px-2.5 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs font-mono">
                  Validating Model...
                </span>
              )}
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Traffic Data Calibration & Simulation Comparison
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-3xl">
              {sources.length} registered source entries. Ingests CSV/JSON records and a generated PeMS-schema-aligned benchmark, audits data quality, maps locations to simulated roads, and compares input records with simulation outputs. Imported data sources are not independently verified.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 text-xs transition shadow-md shadow-emerald-600/20">
              <UploadCloud className="w-4 h-4" />
              <span>{uploading ? 'Ingesting...' : 'Upload CSV / JSON'}</span>
              <input type="file" accept=".csv,.json" onChange={handleFileUpload} disabled={uploading} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-500/50 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
          <div className="text-xs text-rose-200">
            <h4 className="font-semibold">Data Integration Error</h4>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Dataset Selector Bar & Source Telemetry */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-400 whitespace-nowrap">Active Dataset:</span>
          <select
            value={selectedDatasetId}
            onChange={(e) => selectAndLoadDataset(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 max-w-md truncate"
          >
            {datasets.map((d) => (
              <option key={d.dataset_id} value={d.dataset_id}>
                {d.name} ({d.record_count} records • {d.source_type})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {meta && (
            <>
              <span className="text-slate-400">
                Source: <strong className="text-slate-200">{meta.source_name}</strong>
              </span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-slate-400">
                Provenance: <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded">{provenanceLabel}</span>
              </span>
              <span className="text-slate-600">&bull;</span>
              <a
                href={getDatasetExportDownloadUrl(selectedDatasetId, 'csv')}
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </a>
            </>
          )}
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveSubTab('overview')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
            activeSubTab === 'overview'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Activity className="w-4 h-4" />
          Data Comparison Dashboard & Model Discrepancy
        </button>
        <button
          onClick={() => setActiveSubTab('quality_mapping')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
            activeSubTab === 'quality_mapping'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Data Quality, Quarantine Log & Road Mappings
        </button>
        <button
          onClick={() => setActiveSubTab('calibration_validation')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
            activeSubTab === 'calibration_validation'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Simulation Parameter Calibration & Optimization
        </button>
      </div>

      {/* SUB-TAB 1: DATA COMPARISON DASHBOARD */}
      {activeSubTab === 'overview' && validationReport && (
        <div className="space-y-6">
          {/* Validation Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
              <span className="text-slate-400 text-xs block">Mean Absolute Error (MAE)</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold text-white">{validationReport.calibrated_model_metrics.mae}</span>
                <span className="text-xs text-slate-400">mins</span>
              </div>
              <span className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                <TrendingDown className="w-3 h-3" /> Baseline: {validationReport.default_model_metrics.mae} mins
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
              <span className="text-slate-400 text-xs block">Root Mean Squared Error (RMSE)</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold text-white">{validationReport.calibrated_model_metrics.rmse}</span>
                <span className="text-xs text-slate-400">mins</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Baseline: {validationReport.default_model_metrics.rmse} mins
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
              <span className="text-slate-400 text-xs block">Safe MAPE (Protected &epsilon;)</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold text-cyan-400">{validationReport.calibrated_model_metrics.safe_mape_pct}%</span>
              </div>
              <span className="text-[10px] text-cyan-400/80 mt-1 block">
                Relative Percentage Error
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
              <span className="text-slate-400 text-xs block">Pearson Correlation (r)</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold text-purple-400">{validationReport.calibrated_model_metrics.pearson_correlation}</span>
              </div>
              <span className="text-[10px] text-purple-400/80 mt-1 block">
                Agreement with input records
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
                <span className="text-slate-400 text-xs block">Comparison Status</span>
              <span className="text-sm font-semibold text-emerald-400 mt-1 block uppercase">
                {validationReport.validation_status.replace('_', ' ')}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">
                N = {validationReport.calibrated_model_metrics.sample_size} paired observations
              </span>
            </div>
          </div>

          {/* Input Records vs Simulated Trajectory Comparison Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Input Records vs. Digital Twin Simulation
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Travel-time comparison between selected dataset records, the default simulation, and the calibrated simulation. Synthetic benchmark values are generated, not observed traffic.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" /> {inputSeriesLabel}
                </span>
                <span className="flex items-center gap-1 text-cyan-400">
                  <span className="w-2.5 h-2.5 bg-cyan-500 rounded-full" /> Calibrated Digital Twin
                </span>
                <span className="flex items-center gap-1 text-slate-400">
                  <span className="w-2.5 h-2.5 bg-slate-500 rounded-full" /> Uncalibrated Baseline
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={validationReport.time_series_comparison} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="timestamp" stroke="#64748b" tick={{ fontSize: 10 }} tickFormatter={(ts) => ts.split('T')[1]?.substring(0, 5) || ts} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="observed" name={inputSeriesLabel} stroke="#10b981" strokeWidth={2.5} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="calibrated_sim" name="Calibrated simulation (min)" stroke="#06b6d4" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                  <Line type="monotone" dataKey="uncalibrated_sim" name="Default simulation (min)" stroke="#64748b" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per-Road Comparison Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Per-Road Discrepancy & Validation Calibration Gains
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-medium">Mapped Twin Link</th>
                    <th className="pb-3 font-medium">Sensor Location ID</th>
                    <th className="pb-3 font-medium">Sample Size</th>
                    <th className="pb-3 font-medium">Uncalibrated MAE</th>
                    <th className="pb-3 font-medium">Calibrated MAE</th>
                    <th className="pb-3 font-medium">Error Reduction (%)</th>
                    <th className="pb-3 font-medium">Correlation (r)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {validationReport.per_road_summaries.map((road) => (
                    <tr key={road.road_id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 font-bold text-white font-mono">{road.road_id}</td>
                      <td className="py-2.5 font-mono text-slate-400">{road.location_id}</td>
                      <td className="py-2.5 font-mono text-slate-300">{road.sample_size}</td>
                      <td className="py-2.5 font-mono text-slate-400">{road.uncalibrated_mae}m</td>
                      <td className="py-2.5 font-mono text-emerald-400 font-semibold">{road.calibrated_mae}m</td>
                      <td className="py-2.5 font-mono text-cyan-400">+{road.improvement_pct}%</td>
                      <td className="py-2.5 font-mono text-purple-400">{road.correlation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-800 text-xs text-slate-500 leading-relaxed">
              <p>
                <strong className="text-slate-400">Academic Disclaimer: </strong>
                {validationReport.academic_disclaimer}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: DATA QUALITY & ROAD MAPPINGS */}
      {activeSubTab === 'quality_mapping' && meta && quality && (
        <div className="space-y-6">
          {/* Quality Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
              <span className="text-slate-400 text-xs block">Total Ingested</span>
              <span className="text-xl font-bold text-white mt-1 block">{quality.total_records_ingested}</span>
              <span className="text-[10px] text-slate-400 mt-1 block">Raw Records</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
              <span className="text-slate-400 text-xs block">Valid Records</span>
              <span className="text-xl font-bold text-emerald-400 mt-1 block">{quality.valid_records_count}</span>
              <span className="text-[10px] text-emerald-400/80 mt-1 block">Passed Schema Validation</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
              <span className="text-slate-400 text-xs block">Quarantined Invalid</span>
              <span className="text-xl font-bold text-amber-400 mt-1 block">{quality.quarantined_records_count}</span>
              <span className="text-[10px] text-amber-400/80 mt-1 block">Isolated with Diagnostics</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
              <span className="text-slate-400 text-xs block">Duplicates Detected</span>
              <span className="text-xl font-bold text-rose-400 mt-1 block">{quality.duplicate_records_count}</span>
              <span className="text-[10px] text-rose-400/80 mt-1 block">Identical Timestamp+Location</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow">
              <span className="text-slate-400 text-xs block">Outliers Flagged</span>
              <span className="text-xl font-bold text-cyan-400 mt-1 block">{quality.outliers_detected_count}</span>
              <span className="text-[10px] text-cyan-400/80 mt-1 block">Statistical Deviations</span>
            </div>
          </div>

          {/* Road Mapping Inspector */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-emerald-400" />
                  Network Road Segment Mapping Layer
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Explicit association between input location IDs and synthetic twin roads.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-slate-800 text-slate-300 rounded border border-slate-700">
                {meta.active_mappings.length} Active Mappings &bull; {meta.unmatched_locations.length} Unmatched
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-medium">Source Location ID</th>
                    <th className="pb-3 font-medium">Mapped Twin Link</th>
                    <th className="pb-3 font-medium">Target City</th>
                    <th className="pb-3 font-medium">Mapping Method</th>
                    <th className="pb-3 font-medium">Confidence</th>
                    <th className="pb-3 font-medium">Notes & Assumptions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {meta.active_mappings.map((m) => (
                    <tr key={m.source_location_id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 font-mono text-emerald-400 font-semibold">{m.source_location_id}</td>
                      <td className="py-2.5 font-bold text-white font-mono">{m.target_road_id}</td>
                      <td className="py-2.5 text-slate-300">{m.target_city}</td>
                      <td className="py-2.5 font-mono text-slate-400">{m.mapping_method}</td>
                      <td className="py-2.5 font-mono text-cyan-400">{(m.confidence_score * 100).toFixed(0)}%</td>
                      <td className="py-2.5 text-slate-400">{m.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quarantine Diagnostics Log */}
          {quality.quarantine_log.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
              <h3 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Invalid Record Quarantine Audit Log ({quality.quarantine_log.length} records)
              </h3>
              <div className="overflow-x-auto max-h-48">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-2">Row</th>
                      <th className="pb-2">Rejection Reason</th>
                      <th className="pb-2">Raw Payload Snapshot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {quality.quarantine_log.map((q, idx) => (
                      <tr key={idx}>
                        <td className="py-2 font-mono text-slate-400">{q.row_index}</td>
                        <td className="py-2 font-semibold text-rose-300">{q.rejection_reason}</td>
                        <td className="py-2 font-mono text-slate-400 text-[11px] truncate max-w-md">{JSON.stringify(q.raw_data)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: CALIBRATION WORKFLOW */}
      {activeSubTab === 'calibration_validation' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-5">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                Simulation Parameter Calibration Workflow
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Adjusts model parameters to minimize discrepancy between selected input records and simulated digital-twin outputs.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">
                  Chronological Train Split ({Math.round(trainRatio * 100)}% Train / {Math.round((1 - trainRatio) * 100)}% Holdout)
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="0.85"
                  step="0.05"
                  value={trainRatio}
                  onChange={(e) => setTrainRatio(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Target Calibration Metric</label>
                <select
                  value={targetMetric}
                  onChange={(e) => setTargetMetric(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="travel_time">Travel Time (mins)</option>
                  <option value="speed">Average Speed (km/h)</option>
                  <option value="volume">Vehicle Volume (count)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Demand Scaling Bounds</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.05"
                    value={demandScaleMin}
                    onChange={(e) => setDemandScaleMin(Number(e.target.value))}
                    className="w-1/2 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                  <span className="text-slate-500">to</span>
                  <input
                    type="number"
                    step="0.05"
                    value={demandScaleMax}
                    onChange={(e) => setDemandScaleMax(Number(e.target.value))}
                    className="w-1/2 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 block mb-1">Capacity Scaling Bounds</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.05"
                    value={capacityScaleMin}
                    onChange={(e) => setCapacityScaleMin(Number(e.target.value))}
                    className="w-1/2 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                  <span className="text-slate-500">to</span>
                  <input
                    type="number"
                    step="0.05"
                    value={capacityScaleMax}
                    onChange={(e) => setCapacityScaleMax(Number(e.target.value))}
                    className="w-1/2 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleRunCalibration}
                disabled={calibrating || !selectedDatasetId}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-semibold py-2 px-5 rounded-lg flex items-center gap-2 text-xs transition shadow-md shadow-emerald-600/30"
              >
                {calibrating ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Play className="w-4 h-4 fill-white" />
                )}
                Execute Parameter Calibration
              </button>
            </div>
          </div>

          {/* Calibration Output Results */}
          {calibrationResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Optimal Calibration Output ({calibrationResult.calibration_id})
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700">
                  <span className="text-slate-400 block">Optimal Demand Scale</span>
                  <span className="text-base font-bold text-emerald-400 font-mono mt-1 block">
                    {calibrationResult.optimal_parameters.demand_scale}x
                  </span>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700">
                  <span className="text-slate-400 block">Optimal Capacity Scale</span>
                  <span className="text-base font-bold text-cyan-400 font-mono mt-1 block">
                    {calibrationResult.optimal_parameters.capacity_scale}x
                  </span>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700">
                  <span className="text-slate-400 block">Holdout Validation Gain</span>
                  <span className="text-base font-bold text-purple-400 font-mono mt-1 block">
                    +{calibrationResult.improvement_pct}% MAE reduction
                  </span>
                </div>
                <div className="bg-slate-800/60 p-3 rounded-lg border border-slate-700">
                  <span className="text-slate-400 block">Evaluated Iterations</span>
                  <span className="text-base font-bold text-white font-mono mt-1 block">
                    {calibrationResult.iterations_evaluated} grid points
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
