export interface RoadNode {
  node_id: string;
  name: string;
  x: number;
  y: number;
  zone_type: string;
}

export type RoadCategory = 'local' | 'arterial' | 'intercity';
export type CongestionBand = 'Low' | 'Medium' | 'High' | 'Severe';
export type DemandLevel = 'low' | 'normal' | 'peak';

export interface Road {
  road_id: string;
  name: string;
  start_node: string;
  end_node: string;
  length_km: number;
  capacity: number;
  free_flow_speed_kmh: number;
  current_vehicles: number;
  queue_length: number;
  congestion_level: number;
  raw_utilization: number;
  travel_time_mins: number;
  category: RoadCategory;
  congestion_band: CongestionBand;
}

export interface IntercityConnection {
  connection_id: string;
  name: string;
  city_a_node: string;
  city_b_node: string;
  length_km: number;
  capacity: number;
  free_flow_speed_kmh: number;
  current_volume: number;
  queue_length: number;
  congestion_level: number;
  raw_utilization: number;
  travel_time_mins: number;
  category: RoadCategory;
  congestion_band: CongestionBand;
}

export interface CityState {
  city_id: string;
  name: string;
  population: number;
  nodes: RoadNode[];
  roads: Road[];
  total_demand: number;
  current_congestion: number;
  avg_travel_time: number;
  avg_queue_length: number;
  total_capacity: number;
  available_capacity: number;
  vehicles_entering: number;
  vehicles_leaving: number;
  active_vehicles: number;
  current_step: number;
}

export interface CombinedSystemMetrics {
  total_demand: number;
  avg_travel_time_mins: number;
  system_congestion_pct: number;
  total_queues: number;
  total_active_vehicles: number;
  intercity_crossings: number;
}

export interface StepHistoryRecord {
  step: number;
  timestamp: string;
  city_a_demand: number;
  city_a_congestion: number;
  city_a_travel_time: number;
  city_b_demand: number;
  city_b_congestion: number;
  city_b_travel_time: number;
  intercity_volume: number;
  intercity_congestion: number;
  combined_congestion: number;
  combined_travel_time: number;
  combined_queues: number;
}

export interface SimulationStateResponse {
  simulation_step: number;
  scenario_id: string;
  seed: number;
  demand_level: DemandLevel;
  timestamp: string;
  is_simulated_data: boolean;
  city_a: CityState;
  city_b: CityState;
  intercity_connection: IntercityConnection;
  combined_metrics: CombinedSystemMetrics;
  history_length: number;
  history: StepHistoryRecord[];
}

export interface SystemStatus {
  connected: boolean;
  cities: string[];
  intercity_corridor: string;
  modules: {
    digital_twins: string;
    simulation_engine: string;
    ai_predictor: string;
    joint_optimizer: string;
  };
  phase: string;
}

export interface HealthCheckResponse {
  status: string;
  backend: string;
  timestamp: string;
  database: string;
  engine: string;
}

const API_BASE = '/api';

export async function fetchHealth(): Promise<HealthCheckResponse> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API_BASE}/system/status`);
  if (!res.ok) throw new Error(`System status failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchSimulationState(): Promise<SimulationStateResponse> {
  const res = await fetch(`${API_BASE}/simulation/state`);
  if (!res.ok) throw new Error(`Fetch simulation state failed: HTTP ${res.status}`);
  return res.json();
}

export async function initializeSimulation(
  seed: number = 42,
  demand_level: DemandLevel = 'normal',
  intercity_capacity: number = 250
): Promise<SimulationStateResponse> {
  const res = await fetch(`${API_BASE}/simulation/initialize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seed, demand_level, intercity_capacity })
  });
  if (!res.ok) throw new Error(`Initialize simulation failed: HTTP ${res.status}`);
  return res.json();
}

export async function stepSimulation(steps: number = 1): Promise<SimulationStateResponse> {
  const res = await fetch(`${API_BASE}/simulation/step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ steps_to_advance: steps })
  });
  if (!res.ok) throw new Error(`Step simulation failed: HTTP ${res.status}`);
  return res.json();
}

export async function resetSimulation(): Promise<SimulationStateResponse> {
  const res = await fetch(`${API_BASE}/simulation/reset`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error(`Reset simulation failed: HTTP ${res.status}`);
  return res.json();
}

export async function generateNewScenario(
  seed?: number,
  demand_level: DemandLevel = 'normal'
): Promise<SimulationStateResponse> {
  const res = await fetch(`${API_BASE}/simulation/scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seed, demand_level })
  });
  if (!res.ok) throw new Error(`Generate scenario failed: HTTP ${res.status}`);
  return res.json();
}

// ----------------------------------------------------
// Phase 4: AI Prediction Engine Interfaces & API Calls
// ----------------------------------------------------

export interface ModelMetrics {
  mae: number;
  rmse: number;
  sample_count: number;
}

export interface EvaluationComparison {
  target: string;
  target_label: string;
  unit: string;
  rf_metrics: ModelMetrics;
  persistence_metrics: ModelMetrics;
  mae_improvement_pct: number;
  rmse_improvement_pct: number;
}

export interface ModelStatusResponse {
  is_trained: boolean;
  prediction_horizon: number;
  model_type: string;
  last_trained: string | null;
  features: string[];
  targets: string[];
  train_samples: number;
  test_samples: number;
}

export interface TrainModelRequest {
  prediction_horizon?: number;
  num_train_scenarios?: number;
  steps_per_scenario?: number;
  random_seed?: number;
}

export interface TrainModelResponse {
  success: boolean;
  message: string;
  status: ModelStatusResponse;
  evaluations: EvaluationComparison[];
  timestamp: string;
}

export interface PredictionItem {
  target: string;
  target_label: string;
  unit: string;
  current_value: number;
  predicted_value: number;
  persistence_baseline: number;
  horizon_steps: number;
  current_step: number;
  target_step: number;
  confidence_band: string;
}

export interface PredictResponse {
  current_step: number;
  horizon_steps: number;
  target_step: number;
  predictions: Record<string, PredictionItem>;
  timestamp: string;
  is_simulated_data: boolean;
}

export interface AIHistoryPoint {
  step: number;
  actual_demand_a?: number;
  predicted_demand_a?: number;
  actual_congestion_a?: number;
  predicted_congestion_a?: number;
  actual_demand_b?: number;
  predicted_demand_b?: number;
  actual_congestion_b?: number;
  predicted_congestion_b?: number;
}

export interface AIHistoryResponse {
  history: AIHistoryPoint[];
  horizon_steps: number;
  total_points: number;
}

export async function fetchAIStatus(): Promise<ModelStatusResponse> {
  const res = await fetch(`${API_BASE}/ai/status`);
  if (!res.ok) throw new Error(`Fetch AI status failed: HTTP ${res.status}`);
  return res.json();
}

export async function trainAIModel(params?: TrainModelRequest): Promise<TrainModelResponse> {
  const res = await fetch(`${API_BASE}/ai/train`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {})
  });
  if (!res.ok) throw new Error(`Train AI model failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchAIPrediction(prediction_horizon?: number): Promise<PredictResponse> {
  const res = await fetch(`${API_BASE}/ai/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prediction_horizon })
  });
  if (!res.ok) throw new Error(`Fetch AI prediction failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchAIEvaluation(): Promise<EvaluationComparison[]> {
  const res = await fetch(`${API_BASE}/ai/evaluation`);
  if (!res.ok) throw new Error(`Fetch AI evaluation failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchAIHistory(): Promise<AIHistoryResponse> {
  const res = await fetch(`${API_BASE}/ai/history`);
  if (!res.ok) throw new Error(`Fetch AI history failed: HTTP ${res.status}`);
  return res.json();
}

// ----------------------------------------------------
// Phase 5: Independent City Optimization Interfaces & API Calls
// ----------------------------------------------------

export type OptimizationActionType =
  | 'MAINTAIN_CURRENT'
  | 'LOCAL_SIGNAL_TIMING'
  | 'RAMP_METERING_RESTRICTION'
  | 'DYNAMIC_LOCAL_REROUTING'
  | 'PEAK_CONGESTION_MANAGEMENT';

export interface OptimizationActionDefinition {
  action_type: OptimizationActionType;
  name: string;
  description: string;
  target_scope: string;
  capacity_impact_pct: number;
  demand_impact_pct: number;
  gateway_inflow_impact_pct: number;
  operational_cost: number;
  constraints: string[];
}

export interface ObjectiveWeights {
  travel_time_weight: number;
  congestion_weight: number;
  queue_weight: number;
  resource_cost_weight: number;
}

export interface LocalCandidateEvaluation {
  action_type: OptimizationActionType;
  action_name: string;
  is_feasible: boolean;
  rejection_reason?: string | null;
  expected_travel_time: number;
  expected_congestion: number;
  expected_queue_length: number;
  operational_cost: number;
  cost_breakdown: {
    travel_time_cost: number;
    congestion_cost: number;
    queue_cost: number;
    resource_cost: number;
  };
  total_local_cost: number;
}

export interface CityDecision {
  city_id: string;
  city_name: string;
  step: number;
  selected_action: OptimizationActionType;
  selected_action_name: string;
  explanation: string;
  expected_travel_time: number;
  expected_congestion: number;
  expected_queue_length: number;
  operational_cost: number;
  total_local_cost: number;
  cost_breakdown: {
    travel_time_cost: number;
    congestion_cost: number;
    queue_cost: number;
    resource_cost: number;
  };
  candidate_evaluations: LocalCandidateEvaluation[];
  local_inputs_snapshot: Record<string, any>;
}

export interface StepOptimizationRecord {
  step: number;
  city_a_decision: CityDecision;
  city_b_decision: CityDecision;
  observed_city_a: {
    congestion_pct: number;
    avg_travel_time: number;
    avg_queue_length: number;
    active_vehicles: number;
    total_demand: number;
  };
  observed_city_b: {
    congestion_pct: number;
    avg_travel_time: number;
    avg_queue_length: number;
    active_vehicles: number;
    total_demand: number;
  };
  observed_intercity: {
    volume: number;
    queue_length: number;
    congestion_pct: number;
    travel_time_mins: number;
  };
  observed_combined: {
    total_active_vehicles: number;
    system_congestion_pct: number;
    avg_travel_time_mins: number;
    total_queues: number;
  };
}

export interface OptimizationAggregateMetrics {
  avg_travel_time_mins: number;
  avg_congestion_pct: number;
  avg_queue_length: number;
  total_active_vehicles: number;
  intercity_volume: number;
  total_intervention_cost: number;
  total_objective_cost: number;
}

export interface IndependentRunRequest {
  seed?: number;
  demand_level?: DemandLevel;
  steps?: number;
  include_unoptimized_reference?: boolean;
  weights?: ObjectiveWeights;
}

export interface IndependentRunResponse {
  run_id: string;
  scenario_id: string;
  seed: number;
  demand_level: string;
  total_steps: number;
  timestamp: string;
  computation_time_ms: number;
  baseline_metrics: OptimizationAggregateMetrics;
  reference_metrics?: OptimizationAggregateMetrics | null;
  improvement_vs_reference?: {
    travel_time_reduction_pct: number;
    congestion_reduction_pct: number;
    queue_reduction_pct: number;
  } | null;
  step_records: StepOptimizationRecord[];
}

export interface OptimizationStatusResponse {
  is_ready: boolean;
  last_run_id: string | null;
  last_run_timestamp: string | null;
  available_actions_count: number;
  active_weights: ObjectiveWeights;
}

export async function runIndependentOptimization(
  params?: IndependentRunRequest
): Promise<IndependentRunResponse> {
  const res = await fetch(`${API_BASE}/optimization/independent/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {})
  });
  if (!res.ok) throw new Error(`Run independent optimization failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchOptimizationStatus(): Promise<OptimizationStatusResponse> {
  const res = await fetch(`${API_BASE}/optimization/independent/status`);
  if (!res.ok) throw new Error(`Fetch optimization status failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchOptimizationResults(): Promise<IndependentRunResponse[]> {
  const res = await fetch(`${API_BASE}/optimization/independent/results`);
  if (!res.ok) throw new Error(`Fetch optimization results failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchOptimizationActions(): Promise<OptimizationActionDefinition[]> {
  const res = await fetch(`${API_BASE}/optimization/independent/actions`);
  if (!res.ok) throw new Error(`Fetch optimization actions failed: HTTP ${res.status}`);
  return res.json();
}

// ----------------------------------------------------
// Phase 6: Joint Coordinated Optimization & Comparison
// ----------------------------------------------------

export interface CoordinatedObjectiveWeights {
  travel_time_weight: number;
  congestion_weight: number;
  queue_weight: number;
  intercity_weight: number;
  intervention_cost_weight: number;
}

export interface JointCandidateEvaluation {
  pair_id: string;
  action_a: OptimizationActionType;
  action_b: OptimizationActionType;
  action_a_name: string;
  action_b_name: string;
  is_feasible: boolean;
  rejection_reason?: string | null;
  expected_system_travel_time: number;
  expected_system_congestion: number;
  expected_system_queues: number;
  expected_intercity_delay: number;
  combined_intervention_cost: number;
  cost_breakdown: {
    travel_time_cost: number;
    congestion_cost: number;
    queue_cost: number;
    intercity_cost: number;
    resource_cost: number;
  };
  total_combined_cost: number;
}

export interface JointDecision {
  step: number;
  selected_action_a: OptimizationActionType;
  selected_action_b: OptimizationActionType;
  selected_action_a_name: string;
  selected_action_b_name: string;
  explanation: string;
  used_ai_prediction: boolean;
  total_combined_cost: number;
  cost_breakdown: {
    travel_time_cost: number;
    congestion_cost: number;
    queue_cost: number;
    intercity_cost: number;
    resource_cost: number;
  };
  all_evaluated_pairs: JointCandidateEvaluation[];
  feasible_pairs_count: number;
  rejected_pairs_count: number;
}

export interface StepCoordinatedRecord {
  step: number;
  joint_decision: JointDecision;
  observed_city_a: {
    congestion_pct: number;
    avg_travel_time: number;
    avg_queue_length: number;
    active_vehicles: number;
    total_demand: number;
  };
  observed_city_b: {
    congestion_pct: number;
    avg_travel_time: number;
    avg_queue_length: number;
    active_vehicles: number;
    total_demand: number;
  };
  observed_intercity: {
    volume: number;
    queue_length: number;
    congestion_pct: number;
    travel_time_mins: number;
  };
  observed_combined: {
    total_active_vehicles: number;
    system_congestion_pct: number;
    avg_travel_time_mins: number;
    total_queues: number;
  };
}

export interface CoordinatedRunRequest {
  seed?: number;
  demand_level?: DemandLevel;
  steps?: number;
  weights?: CoordinatedObjectiveWeights;
  max_combined_budget?: number;
}

export interface CoordinatedRunResponse {
  run_id: string;
  scenario_id: string;
  seed: number;
  demand_level: string;
  total_steps: number;
  timestamp: string;
  computation_time_ms: number;
  used_ai_prediction: boolean;
  coordinated_metrics: OptimizationAggregateMetrics;
  step_records: StepCoordinatedRecord[];
}

export interface ComparisonMetricItem {
  metric_name: string;
  unit: string;
  baseline_value: number;
  coordinated_value: number;
  improvement_pct: number | null;
  is_better: boolean | null;
}

export interface HeadToHeadComparisonResponse {
  comparison_id: string;
  seed: number;
  demand_level: string;
  steps: number;
  timestamp: string;
  baseline_run_id: string;
  coordinated_run_id: string;
  baseline_metrics: OptimizationAggregateMetrics;
  coordinated_metrics: OptimizationAggregateMetrics;
  comparison_metrics: ComparisonMetricItem[];
  per_step_comparison: Array<{
    step: number;
    baseline_congestion: number;
    coordinated_congestion: number;
    baseline_travel_time: number;
    coordinated_travel_time: number;
    baseline_queues: number;
    coordinated_queues: number;
    action_a_independent: string;
    action_b_independent: string;
    action_a_coordinated: string;
    action_b_coordinated: string;
  }>;
  coordination_gain_summary: string;
}

export interface CoordinatedStatusResponse {
  is_ready: boolean;
  last_run_id: string | null;
  last_run_timestamp: string | null;
  available_pairs_count: number;
  active_weights: CoordinatedObjectiveWeights;
  ai_prediction_ready: boolean;
}

export async function runCoordinatedOptimization(
  params?: CoordinatedRunRequest
): Promise<CoordinatedRunResponse> {
  const res = await fetch(`${API_BASE}/optimization/coordinated/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {})
  });
  if (!res.ok) throw new Error(`Run coordinated optimization failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchCoordinatedStatus(): Promise<CoordinatedStatusResponse> {
  const res = await fetch(`${API_BASE}/optimization/coordinated/status`);
  if (!res.ok) throw new Error(`Fetch coordinated status failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchCoordinatedResults(): Promise<CoordinatedRunResponse[]> {
  const res = await fetch(`${API_BASE}/optimization/coordinated/results`);
  if (!res.ok) throw new Error(`Fetch coordinated results failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchHeadToHeadComparison(
  seed: number = 42,
  demand_level: DemandLevel = 'normal',
  steps: number = 24
): Promise<HeadToHeadComparisonResponse> {
  const params = new URLSearchParams({
    seed: seed.toString(),
    demand_level,
    steps: steps.toString()
  });
  const res = await fetch(`${API_BASE}/optimization/compare?${params.toString()}`);
  if (!res.ok) throw new Error(`Fetch comparison failed: HTTP ${res.status}`);
  return res.json();
}

// ==========================================
// Phase 7: Research-Grade Experiments & Statistical Evaluation
// ==========================================

export type ResearchScenario = 'normal' | 'high' | 'peak' | 'bottleneck';
export type OptimizationStrategy = 'unoptimized' | 'independent' | 'coordinated';

export interface ExperimentConfigRequest {
  name?: string;
  scenarios?: ResearchScenario[];
  num_seeds?: number;
  seed_start?: number;
  steps?: number;
  run_async?: boolean;
}

export interface MetricDefinition {
  metric_id: string;
  name: string;
  unit: string;
  category: string;
  higher_is_better: boolean;
  description: string;
}

export interface RunMetricRecord {
  experiment_id: string;
  scenario: ResearchScenario;
  seed: number;
  strategy: OptimizationStrategy;
  simulation_duration: number;
  system_avg_travel_time: number;
  system_avg_congestion: number;
  system_avg_queue_length: number;
  system_objective_cost: number;
  city_a_travel_time: number;
  city_a_congestion: number;
  city_a_queue_length: number;
  city_b_travel_time: number;
  city_b_congestion: number;
  city_b_queue_length: number;
  intercity_travel_time: number;
  intercity_congestion: number;
  intercity_queue_length: number;
  total_intervention_cost: number;
  total_vehicles_served: number;
  optimization_execution_time_ms: number;
}

export interface DescriptiveStatistics {
  mean: number;
  median: number;
  std_dev: number;
  min_val: number;
  max_val: number;
  ci_95_lower: number;
  ci_95_upper: number;
  sample_size: number;
}

export interface PairedComparisonResult {
  metric_id: string;
  metric_name: string;
  unit: string;
  higher_is_better: boolean;
  comparison_type: string;
  baseline_strategy: OptimizationStrategy;
  target_strategy: OptimizationStrategy;
  mean_baseline: number;
  mean_target: number;
  mean_difference: number;
  mean_improvement_pct: number | null;
  ci_95_diff_lower: number;
  ci_95_diff_upper: number;
  t_statistic: number | null;
  p_value_parametric: number | null;
  p_value_wilcoxon: number | null;
  p_value_adjusted_holm: number | null;
  effect_size_cohen_dz: number | null;
  is_statistically_significant: boolean;
  practical_significance_note: string;
}

export interface ScenarioStatisticalSummary {
  scenario: ResearchScenario;
  sample_size_per_strategy: number;
  descriptive_by_strategy: Record<string, Record<string, DescriptiveStatistics>>;
  paired_comparisons: PairedComparisonResult[];
}

export interface ResearchExperimentStatus {
  experiment_id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress_pct: number;
  completed_runs: number;
  total_expected_runs: number;
  current_scenario: string | null;
  current_seed: number | null;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface ResearchExperimentResponse {
  experiment_id: string;
  name: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  config: ExperimentConfigRequest;
  metric_definitions: MetricDefinition[];
  scenario_summaries: Record<string, ScenarioStatisticalSummary>;
  total_runs_completed: number;
  computational_cost_summary: Record<string, number>;
  research_summary_text: string;
  academic_disclaimer: string;
  run_records?: RunMetricRecord[];
}

export async function runResearchExperiment(
  config: ExperimentConfigRequest
): Promise<ResearchExperimentStatus> {
  const res = await fetch(`${API_BASE}/research/experiments/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Run experiment failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchResearchStatus(
  experimentId: string
): Promise<ResearchExperimentStatus> {
  const res = await fetch(`${API_BASE}/research/experiments/status/${experimentId}`);
  if (!res.ok) throw new Error(`Fetch status failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchResearchResults(
  experimentId: string
): Promise<ResearchExperimentResponse> {
  const res = await fetch(`${API_BASE}/research/experiments/${experimentId}/results`);
  if (!res.ok) throw new Error(`Fetch results failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchResearchHistory(): Promise<ResearchExperimentStatus[]> {
  const res = await fetch(`${API_BASE}/research/experiments/history`);
  if (!res.ok) throw new Error(`Fetch history failed: HTTP ${res.status}`);
  return res.json();
}

export function getResearchExportUrl(experimentId: string, format: 'csv' | 'json'): string {
  if (!/^EXP-[A-Za-z0-9_-]+$/.test(experimentId)) {
    throw new Error('Invalid experiment ID');
  }
  return `${API_BASE}/research/experiments/${encodeURIComponent(experimentId)}/export?format=${format}`;
}

// ============================================================================
// PHASE 8: MODEL PREDICTIVE CONTROL (MPC) & SCENARIO PLANNING TYPES & APIS
// ============================================================================

export type PlanningMode = 'nominal' | 'robust' | 'risk_sensitive';
export type UncertaintyScenarioType =
  | 'normal'
  | 'peak_surge'
  | 'sudden_burst'
  | 'corridor_bottleneck'
  | 'uneven_demand'
  | 'forecast_noise';

export interface PlannedActionStep {
  step_offset: number;
  action_a: OptimizationActionType;
  action_b: OptimizationActionType;
  action_a_name: string;
  action_b_name: string;
  combined_intervention_cost: number;
  discount_factor_weight: number;
  raw_step_cost: number;
  discounted_step_cost: number;
  expected_system_travel_time: number;
  expected_system_congestion: number;
  expected_system_queues: number;
  expected_intercity_delay: number;
}

export interface MPCPlanningDecision {
  decision_step: number;
  planning_mode: PlanningMode;
  planning_horizon: number;
  discount_factor: number;
  beam_width: number;
  total_candidate_evaluations: number;
  executed_action_a: OptimizationActionType;
  executed_action_b: OptimizationActionType;
  executed_action_a_name: string;
  executed_action_b_name: string;
  executed_intervention_cost: number;
  planned_sequence: PlannedActionStep[];
  cumulative_discounted_cost: number;
  robust_worst_case_cost?: number | null;
  cvar_risk_metric?: number | null;
  fallback_used: boolean;
  fallback_reason?: string | null;
  used_ai_prediction: boolean;
}

export interface MPCRunRequest {
  seed?: number;
  demand_level?: DemandLevel;
  steps?: number;
  planning_horizon?: number;
  discount_factor?: number;
  beam_width?: number;
  max_search_budget?: number;
  planning_mode?: PlanningMode;
  uncertainty_scenario?: UncertaintyScenarioType;
  risk_alpha?: number;
  weights?: CoordinatedObjectiveWeights;
}

export interface MPCRunResponse {
  run_id: string;
  scenario_id: string;
  seed: number;
  demand_level: string;
  planning_horizon: number;
  discount_factor: number;
  beam_width: number;
  planning_mode: string;
  uncertainty_scenario: string;
  total_steps: number;
  computation_time_ms: number;
  total_evaluations_count: number;
  fallback_occurred: boolean;
  mpc_metrics: OptimizationAggregateMetrics;
  step_decisions: MPCPlanningDecision[];
}

export interface ScenarioComparisonItem {
  scenario_type: UncertaintyScenarioType;
  name: string;
  nominal_cost: number;
  robust_cost: number;
  risk_sensitive_cost: number;
  recommended_action_pair: string;
  vulnerability_notes: string;
}

export interface ScenarioPlanningRunResponse {
  run_id: string;
  timestamp: string;
  base_seed: number;
  planning_horizon: number;
  discount_factor: number;
  evaluated_scenarios: ScenarioComparisonItem[];
  overall_recommended_policy: string;
  robustness_summary: string;
}

export interface MPCConfigResponse {
  supported_horizons: number[];
  default_horizon: number;
  default_discount_factor: number;
  default_beam_width: number;
  supported_planning_modes: string[];
  supported_uncertainty_scenarios: string[];
  max_search_budget_limit: number;
  action_space_size_per_step: number;
}

export async function fetchMPCConfig(): Promise<MPCConfigResponse> {
  const res = await fetch(`${API_BASE}/optimization/mpc/config`);
  if (!res.ok) throw new Error(`Fetch MPC config failed: HTTP ${res.status}`);
  return res.json();
}

export async function runMPCOptimization(request: MPCRunRequest): Promise<MPCRunResponse> {
  const res = await fetch(`${API_BASE}/optimization/mpc/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Run MPC optimization failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchMPCResults(): Promise<MPCRunResponse[]> {
  const res = await fetch(`${API_BASE}/optimization/mpc/results`);
  if (!res.ok) throw new Error(`Fetch MPC results failed: HTTP ${res.status}`);
  return res.json();
}

export async function runScenarioPlanningStudy(
  baseSeed: number = 42,
  horizon: number = 3,
  discountFactor: number = 0.95
): Promise<ScenarioPlanningRunResponse> {
  const res = await fetch(
    `${API_BASE}/optimization/scenarios/run?base_seed=${baseSeed}&horizon=${horizon}&discount_factor=${discountFactor}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Run scenario planning failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchScenarioPlanningResults(): Promise<ScenarioPlanningRunResponse[]> {
  const res = await fetch(`${API_BASE}/optimization/scenarios/results`);
  if (!res.ok) throw new Error(`Fetch scenario planning results failed: HTTP ${res.status}`);
  return res.json();
}

// ============================================================================
// PHASE 9: REAL-WORLD DATA INTEGRATION & DIGITAL TWIN VALIDATION TYPES & APIS
// ============================================================================

export type DataSourceType =
  | 'csv_upload'
  | 'json_import'
  | 'benchmark_sample'
  | 'external_api'
  | 'simulated_reference';

export type DataOriginTag = 'OBSERVED' | 'IMPUTED' | 'SIMULATED' | 'CALIBRATED';

export interface TrafficObservationRecord {
  observation_id: string;
  timestamp: string;
  source_timezone: string;
  location_id: string;
  location_name?: string | null;
  vehicle_count?: number | null;
  average_speed_kmh?: number | null;
  travel_time_mins?: number | null;
  occupancy_pct?: number | null;
  queue_length?: number | null;
  weather_condition?: string | null;
  incident_reported?: boolean;
  source_name: string;
  data_origin: DataOriginTag;
  ingestion_timestamp: string;
}

export interface QuarantineRecord {
  row_index: number;
  raw_data: Record<string, any>;
  rejection_reason: string;
}

export interface DataQualityReport {
  total_records_ingested: number;
  valid_records_count: number;
  quarantined_records_count: number;
  duplicate_records_count: number;
  missing_fields_summary: Record<string, number>;
  outliers_detected_count: number;
  temporal_range: { start: string | null; end: string | null };
  quarantine_log: QuarantineRecord[];
}

export interface NetworkRoadMapping {
  source_location_id: string;
  target_road_id: string;
  target_city: string;
  mapping_method: string;
  confidence_score: number;
  unit_conversion_factor: number;
  notes?: string | null;
}

export interface DatasetMetadata {
  dataset_id: string;
  name: string;
  source_name: string;
  source_type: DataSourceType;
  description: string;
  created_at: string;
  record_count: number;
  quality_report: DataQualityReport;
  active_mappings: NetworkRoadMapping[];
  unmatched_locations: string[];
}

export interface CalibrationParameterBounds {
  demand_scale_min: number;
  demand_scale_max: number;
  capacity_scale_min: number;
  capacity_scale_max: number;
  speed_factor_min: number;
  speed_factor_max: number;
  intercity_capacity_scale_min: number;
  intercity_capacity_scale_max: number;
}

export interface CalibrationRequest {
  dataset_id: string;
  train_ratio?: number;
  parameter_bounds?: CalibrationParameterBounds;
  target_metric?: 'travel_time' | 'speed' | 'volume';
  max_search_evaluations?: number;
}

export interface ValidationMetrics {
  mae: number;
  rmse: number;
  safe_mape_pct: number;
  mean_signed_bias: number;
  pearson_correlation: number;
  sample_size: number;
}

export interface CalibrationResult {
  calibration_id: string;
  dataset_id: string;
  timestamp: string;
  optimal_parameters: Record<string, number>;
  initial_objective_error: number;
  calibrated_objective_error: number;
  improvement_pct: number;
  train_window_start: string;
  train_window_end: string;
  test_window_start: string;
  test_window_end: string;
  iterations_evaluated: number;
  convergence_status: string;
  uncalibrated_validation: ValidationMetrics;
  calibrated_validation: ValidationMetrics;
}

export interface RoadValidationSummary {
  road_id: string;
  location_id: string;
  sample_size: number;
  uncalibrated_mae: number;
  calibrated_mae: number;
  improvement_pct: number;
  correlation: number;
}

export interface DigitalTwinValidationReport {
  validation_id: string;
  dataset_id: string;
  calibration_id?: string | null;
  timestamp: string;
  validation_status: string;
  default_model_metrics: ValidationMetrics;
  calibrated_model_metrics: ValidationMetrics;
  per_road_summaries: RoadValidationSummary[];
  time_series_comparison: Array<{
    timestamp: string;
    location_id: string;
    observed: number;
    uncalibrated_sim: number;
    calibrated_sim: number;
    data_origin: string;
  }>;
  academic_disclaimer: string;
  dataset_provenance: Record<string, any>;
}

export interface DataSourceInfo {
  source_id: string;
  name: string;
  source_type: DataSourceType;
  is_live_configured: boolean;
  requires_credentials: boolean;
  license_type: string;
  description: string;
}

export async function fetchTrafficSources(): Promise<DataSourceInfo[]> {
  const res = await fetch(`${API_BASE}/data/traffic/sources`);
  if (!res.ok) throw new Error(`Fetch traffic sources failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchTrafficDatasets(): Promise<DatasetMetadata[]> {
  const res = await fetch(`${API_BASE}/data/traffic/datasets`);
  if (!res.ok) throw new Error(`Fetch datasets failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchDatasetDetails(
  datasetId: string,
  previewLimit: number = 25
): Promise<{ metadata: DatasetMetadata; preview_records: TrafficObservationRecord[]; total_records: number }> {
  const res = await fetch(`${API_BASE}/data/traffic/datasets/${datasetId}?preview_limit=${previewLimit}`);
  if (!res.ok) throw new Error(`Fetch dataset details failed: HTTP ${res.status}`);
  return res.json();
}

export async function fetchDatasetQuality(datasetId: string): Promise<DataQualityReport> {
  const res = await fetch(`${API_BASE}/data/traffic/datasets/${datasetId}/quality`);
  if (!res.ok) throw new Error(`Fetch quality report failed: HTTP ${res.status}`);
  return res.json();
}

export async function uploadTrafficFile(
  file: File,
  datasetName: string = 'Uploaded Traffic Dataset',
  sourceName: string = 'Municipal CSV Upload'
): Promise<DatasetMetadata> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('dataset_name', datasetName);
  formData.append('source_name', sourceName);

  const res = await fetch(`${API_BASE}/data/traffic/upload`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Upload traffic file failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function importTrafficJson(payload: {
  dataset_name: string;
  source_name: string;
  records: any[];
  description?: string;
}): Promise<DatasetMetadata> {
  const res = await fetch(`${API_BASE}/data/traffic/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Import traffic JSON failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function updateDatasetMappings(
  datasetId: string,
  mappings: NetworkRoadMapping[]
): Promise<DatasetMetadata> {
  const res = await fetch(`${API_BASE}/data/traffic/datasets/${datasetId}/mappings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(mappings)
  });
  if (!res.ok) throw new Error(`Update mappings failed: HTTP ${res.status}`);
  return res.json();
}

export async function runDigitalTwinCalibration(
  request: CalibrationRequest
): Promise<CalibrationResult> {
  const res = await fetch(`${API_BASE}/data/traffic/calibrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Calibration failed: HTTP ${res.status}`);
  }
  return res.json();
}

export async function runDigitalTwinValidation(
  datasetId: string,
  calibrationParams?: Record<string, number>
): Promise<DigitalTwinValidationReport> {
  const res = await fetch(`${API_BASE}/data/traffic/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_id: datasetId, calibration_params: calibrationParams })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Validation failed: HTTP ${res.status}`);
  }
  return res.json();
}

export function getDatasetExportDownloadUrl(datasetId: string, format: 'json' | 'csv'): string {
  if (!/^[A-Za-z0-9_-]+$/.test(datasetId)) {
    throw new Error('Invalid dataset ID');
  }
  return `${API_BASE}/data/traffic/datasets/${encodeURIComponent(datasetId)}/export?format=${format}`;
}





