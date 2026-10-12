# AI-Driven Twin Cities Optimization

A research prototype web application featuring digital twins of two connected metropolitan areas (**City A: Metro Alpha** and **City B: Metro Beta**), intercity corridor simulation, AI-assisted congestion forecasting, and comparative decision analysis (Independent City Baseline vs. Joint Coordinated Optimization).

---

## Architecture Overview

```
Ai twin cities/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   └── main.py          # FastAPI server with CORS & healthcheck endpoints
│   ├── main.py              # Uvicorn entry point runner
│   └── requirements.txt     # Python dependencies (FastAPI, Scikit-learn, etc.)
├── frontend/
│   ├── src/
│   │   ├── services/
│   │   │   └── api.ts       # Backend communication client
│   │   ├── App.tsx          # Main application & navigation shell
│   │   ├── main.tsx         # React root
│   │   └── index.css        # Cyber dark digital twin design system
│   ├── package.json         # React 19 + TypeScript + Vite + Recharts + Lucide
│   └── vite.config.ts       # Reverse proxy configuration (/api -> :8000)
└── README.md
```

---

## Setup & Running Instructions

### 1. Backend Service (FastAPI)

```bash
cd backend
python -m pip install -r requirements.txt
python main.py
```
- API server runs at: `http://127.0.0.1:8000`
- Interactive API Docs: `http://127.0.0.1:8000/docs`
- Healthcheck Endpoint: `http://127.0.0.1:8000/api/health`

### 2. Frontend Application (React + TypeScript + Vite)

```bash
cd frontend
npm install
npm run dev
```
- Frontend application runs at: `http://127.0.0.1:5173`
- The Vite development server automatically proxies all `/api/*` requests to the FastAPI backend (`http://127.0.0.1:8000`).

---

## Verified Phase Status
- **Phase 1**: Initialized project, configured FastAPI + React/Vite reverse proxy, and verified communication.
- **Phase 2**: Synthetic data generation, 2-city topologies, BPR travel time solver, discrete-step simulation engine, intercity queue dynamics, automated test suite, and interactive frontend simulation view.
- **Phase 3**: Interactive Digital Twin map view (`Twin Cities View`), dual-city SVG network visualization, BPR-governed color congestion overlays, directional flow pulses, road selection inspector drawer, and synchronized live simulation controls.
- **Phase 4**: Supervised Random Forest traffic demand and congestion forecasting engine (`AI Predictions`), multi-step horizon forecasting ($t+1, t+3, t+6$), rigorous evaluation against unseen test scenarios vs. Persistence Baseline (MAE, RMSE, % improvement), historical trajectory charts, interactive retrain module, and automated test suite.
- **Phase 5**: Independent City Optimization Baseline (`Independent Optimization`), modular decentralized decision-making with strict local state isolation, 5 physical traffic management actions, normalized multi-criteria objective function, controlled baseline experiment runner vs. unoptimized reference, interactive step inspector & trajectory analytics, and 9 automated unit/integration tests.
- **Phase 6**: Joint Coordinated Optimization (`Joint Coordinated Optimization`), exhaustive 25-pair action search across City A and City B, combined 5-component multi-criteria objective function (travel time, system congestion, queue burden, intercity corridor delay, and budget intervention cost), state-isolated sandbox evaluations (`copy.deepcopy`), corridor capacity & shared budget constraint enforcement, AI lookahead with safe simulation fallback, head-to-head empirical comparison dashboard vs. Phase 5, and 11 comprehensive automated tests.
- **Phase 7**: Research-Grade Experiments & Statistical Evaluation (`Research Evaluation`), scientific tri-strategy benchmark comparing Unoptimized Baseline, Phase 5 Independent Optimization, and Phase 6 Joint Coordinated Optimization across multi-seed matched scenarios (normal, high, peak, bottleneck), Student's t 95% confidence intervals, paired t-tests, non-parametric Wilcoxon signed-rank tests, Cohen's $d_z$ effect sizes, Holm-Bonferroni family-wise error rate corrections, persistent JSON storage and CSV/JSON data exports, interactive research dashboard with Recharts visualizations, and 6 automated tests.
- **Phase 8**: Advanced AI Optimization and Scenario Planning (`Scenario Planning & MPC`), multi-step forward-looking Model Predictive Control (MPC) with Receding Horizon execution ($H \in \{1, 2, 3, 5\}$). Evaluates candidate action sequences over $25^H$ combinations via Bounded Beam Search ($K \le 10$, $\le 500$ evaluations), cumulative discounted cost minimization $C = \sum_{t=0}^{H-1} \gamma^t c_t$ ($\gamma = 0.95$), memory-isolated sandbox branching (`copy.deepcopy`), multi-scenario stress-testing (`normal`, `peak_surge`, `sudden_burst`, `corridor_bottleneck`, `uneven_demand`, `forecast_noise`), Nominal, Robust (worst-case penalized), and Risk-Sensitive (CVaR $\alpha$) planning modes, autonomous Phase 6 fallback, dedicated interactive dashboard, and 9 automated unit/integration tests.
- **Phase 9**: Real-World Data Integration and Digital Twin Validation (`Real-World Data & Validation`), pluggable external data layer supporting CSV/JSON uploads, public benchmark datasets (Caltrans PeMS-aligned dual-metro benchmark), strict schema validation and physical bounds checks, invalid record quarantine with actionable rejection reasons, explicit detector-to-road mapping layer (A1..A10, B1..B10, IC_CORRIDOR), simulation calibration via bounded parameter search (`demand_scale`, `capacity_scale`, `speed_factor`, `intercity_capacity_scale`), chronological train/validation holdout splitting to prevent data leakage, empirical digital twin validation computing MAE, RMSE, Safe MAPE ($\epsilon$-protected), Mean Signed Bias, and Pearson $r$, interactive validation dashboard with trajectory comparison charts and CSV/JSON export, and 10 automated unit/integration tests.
- **Phase 10**: Final System Integration, Research Documentation, and Presentation (`Overview Dashboard` & System Shell), complete end-to-end integration across all 9 previous phases, `.env.example` safe configuration template, comprehensive root `.gitignore`, full API inventory, 19-section standalone academic paper ([`docs/FINAL_RESEARCH_REPORT.md`](file:///c:/Users/dell/Desktop/Ai%20twin%20cities/docs/FINAL_RESEARCH_REPORT.md)), system architecture & workflow Mermaid diagrams ([`docs/ARCHITECTURE_AND_WORKFLOWS.md`](file:///c:/Users/dell/Desktop/Ai%20twin%20cities/docs/ARCHITECTURE_AND_WORKFLOWS.md)), deterministic reviewer demo workflow, and 57 passing automated unit/integration tests with 0 failures.

---

## Phase Implementation & Verification Matrix

| Phase | Phase Name | Status | Test Coverage | Key Deliverables & Validation |
|---|---|---|---|---|
| **Phase 1** | Application & API Connectivity | **Implemented & Verified** | Connectivity checks | FastAPI backend, React/Vite client, proxy routing, healthcheck |
| **Phase 2** | Synthetic Traffic & Simulation Engine | **Implemented & Verified** | 8 unit tests | BPR link delay model, dual-metro topology, discrete stepping, queue solver |
| **Phase 3** | Digital Twin Visualization | **Implemented & Verified** | Visual / integration | Interactive SVG map, dynamic flow pulses, BPR color bands, road drawer |
| **Phase 4** | Machine Learning Traffic Predictor | **Implemented & Verified** | 4 unit tests | Multi-output Random Forest, $t+1..t+6$ horizons, persistence comparison |
| **Phase 5** | Independent City Optimization | **Implemented & Verified** | 9 unit tests | Decentralized control, local state isolation, 5 physical actions, baseline runner |
| **Phase 6** | Joint Coordinated Optimization | **Implemented & Verified** | 11 unit tests | Exhaustive 25-pair search, 5-component cost function, corridor constraints |
| **Phase 7** | Research Experiments & Statistical Evaluation | **Implemented & Verified** | 6 unit tests | Multi-seed matched experiments, paired t-tests, Wilcoxon rank, Holm-Bonferroni |
| **Phase 8** | Multi-Step MPC & Scenario Planning | **Implemented & Verified** | 9 unit tests | Receding-horizon lookahead ($H=3$), bounded beam search, nominal/robust modes |
| **Phase 9** | Real-World Data & Digital Twin Validation | **Implemented & Verified** | 10 unit tests | CSV/JSON ingestion, quarantine log, PeMS benchmark, chronological calibration |
| **Phase 10** | Final System Integration & Research Report | **Implemented & Verified** | 57 / 57 passing | Research paper (`docs/`), Mermaid workflows, full API inventory, demo workflow |

---

## Complete API Inventory

| HTTP Method | Endpoint Path | Module | Purpose & Description | Parameters / Payload |
|---|---|---|---|---|
| `GET` | `/api/health` | System | Healthcheck & backend status probe | None |
| `GET` | `/api/system/status` | System | Readiness probe reporting operational modules & active phase | None |
| `GET` | `/api/simulation/current` | Simulation | Retrieves current digital twin state and metrics | None |
| `POST` | `/api/simulation/step` | Simulation | Advances discrete simulation by 1 step | `{ actions?: [...] }` |
| `POST` | `/api/simulation/reset` | Simulation | Resets twin network to initial step $t=0$ | `{ seed?: int, demand_level?: str }` |
| `POST` | `/api/simulation/scenario` | Simulation | Injects specialized stress scenario (peak, bottleneck, etc.) | `{ scenario_id: str }` |
| `GET` | `/api/simulation/history` | Simulation | Returns history of recent simulation steps | `limit?: int` |
| `POST` | `/api/ai/predict` | AI Predictor | Generates $t+1, t+3, t+6$ traffic flow and congestion forecasts | `{ horizon: int }` |
| `POST` | `/api/ai/retrain` | AI Predictor | Retrains Random Forest model on historical trajectory data | None |
| `GET` | `/api/ai/status` | AI Predictor | Reports model metadata, estimator count, and test MAE | None |
| `POST` | `/api/optimization/independent/run` | Phase 5 Opt | Executes decentralized baseline experiment | `IndependentRunRequest` |
| `GET` | `/api/optimization/independent/status` | Phase 5 Opt | Returns readiness and parameters of independent optimizer | None |
| `GET` | `/api/optimization/independent/results`| Phase 5 Opt | History of executed baseline optimization runs | None |
| `GET` | `/api/optimization/independent/actions`| Phase 5 Opt | Specifications of the 5 discrete optimization actions | None |
| `POST` | `/api/optimization/coordinated/run` | Phase 6 Opt | Executes joint 25-pair coordinated optimization | `CoordinatedRunRequest` |
| `GET` | `/api/optimization/coordinated/status`| Phase 6 Opt | Returns readiness and weights of coordinated optimizer | None |
| `GET` | `/api/optimization/coordinated/results`| Phase 6 Opt | History of executed joint coordinated optimization runs | None |
| `GET` | `/api/optimization/compare` | Phase 6 Opt | Direct head-to-head comparison: Independent vs. Coordinated | `seed, demand_level, steps` |
| `GET` | `/api/optimization/mpc/config` | Phase 8 MPC | Supported horizons, discount factors, beam width, modes | None |
| `POST` | `/api/optimization/mpc/run` | Phase 8 MPC | Receding-horizon MPC execution over horizon $H$ | `MPCRunRequest` |
| `GET` | `/api/optimization/mpc/status` | Phase 8 MPC | Status, execution latency, and fallback indicator for MPC | None |
| `GET` | `/api/optimization/mpc/results` | Phase 8 MPC | History of multi-step MPC planning runs | None |
| `POST` | `/api/optimization/scenarios/run` | Phase 8 MPC | Forward-looking multi-scenario uncertainty evaluation | `seed, horizon, discount_factor` |
| `POST` | `/api/research/run` | Phase 7 Research | Launches multi-seed, multi-scenario comparative study | `ExperimentConfigRequest` |
| `GET` | `/api/research/experiments` | Phase 7 Research | Lists all completed and running research experiments | None |
| `GET` | `/api/research/experiments/{id}` | Phase 7 Research | Retrieves detailed statistical summary & paired tests | `experiment_id` path param |
| `GET` | `/api/research/experiments/{id}/export`| Phase 7 Research | Exports run trajectories and statistics as JSON or CSV | `format: 'json' \| 'csv'` |
| `GET` | `/api/data/traffic/sources` | Phase 9 Data | Lists active and fallback data providers | None |
| `GET` | `/api/data/traffic/datasets` | Phase 9 Data | Lists metadata for all imported traffic datasets | None |
| `GET` | `/api/data/traffic/datasets/{id}` | Phase 9 Data | Dataset metadata, sample observations, and road mappings | `dataset_id` path param |
| `GET` | `/api/data/traffic/datasets/{id}/quality`| Phase 9 Data | Ingestion quality audit, missing counts, and quarantine log | `dataset_id` path param |
| `GET` | `/api/data/traffic/datasets/{id}/export` | Phase 9 Data | Exports validated observation records as CSV or JSON | `format: 'json' \| 'csv'` |
| `POST` | `/api/data/traffic/upload` | Phase 9 Data | Multipart file upload for municipal CSV/JSON datasets | `file, dataset_name, source_name` |
| `POST` | `/api/data/traffic/import` | Phase 9 Data | Ingests pre-configured reference datasets or raw JSON | `records, dataset_name, source_name`|
| `POST` | `/api/data/traffic/datasets/{id}/mappings`| Phase 9 Data | Updates detector station to twin road mappings | `mappings: List[Mapping]` |
| `POST` | `/api/data/traffic/calibrate` | Phase 9 Data | Executes bounded parameter search with 70/30 holdout split | `CalibrationRequest` |
| `POST` | `/api/data/traffic/validate` | Phase 9 Data | Computes MAE, RMSE, Safe MAPE, Bias, and Pearson $r$ | `dataset_id, calibration_params` |

---

## Step-by-Step Reviewer Demo Workflow

Follow these steps to demonstrate the full end-to-end functionality of the platform:

### 1. Launch Backend and Frontend
```bash
# Terminal 1: Backend
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2: Frontend
cd frontend
npm run dev
```
Open your browser at `http://localhost:5173`.

### 2. Live Digital Twin Inspection
1. Navigate to the **Twin Cities View** tab.
2. Inspect the interactive dual-city SVG topology: City A (Metro Alpha, blue links) on the left, City B (Metro Beta, purple links) on the right, and the central Intercity Corridor link.
3. Click any road link (e.g., `A1` or `IC_CORRIDOR`) to open the **Road Details Drawer** showing current vehicle count, capacity, BPR delay, and queue accumulation.
4. Click **Step Simulation** in the control toolbar to observe live flow pulses and dynamic color band transitions.

### 3. Machine Learning Forecasting
1. Navigate to the **AI Predictions** tab.
2. Observe the multi-horizon predictions ($t+1, t+3, t+6$).
3. Compare the Random Forest model predictions against the Persistence Baseline scorecard.
4. Click **Retrain Model** to observe immediate model updating from recent simulation steps.

### 4. Independent vs. Joint Coordinated Head-to-Head
1. Navigate to the **Independent Optimization** tab; run a 12-step baseline experiment to observe decentralized municipal control.
2. Navigate to the **Joint Coordinated Optimization** tab; click **Run Head-to-Head Comparison**.
3. Observe how coordinated optimization evaluates all 25 joint action pairs, respects the shared corridor capacity, and stabilizes total travel time.

### 5. Multi-Step MPC & Scenario Planning
1. Navigate to the **MPC & Scenario Planning** tab.
2. Set Planning Horizon to $H=3$, Beam Width to $K=5$, and select **Nominal** or **Robust** mode.
3. Click **Execute MPC Plan** to view the candidate action sequence, the committed immediate action pair, and the computation latency telemetry (~3.3 s).

### 6. Research-Grade Statistical Evaluation
1. Navigate to the **Research Evaluation** tab.
2. Select an existing experiment (e.g., `EXP-33FF6B2A` or `EXP-86C7E78B`) from the selector.
3. Review the **Executive Findings Narrative**, descriptive statistics table (Mean, Std Dev, 95% CI), and inferential test tables (Paired t-test $p$-values, Wilcoxon signed-rank $p$-values, Cohen's $d_z$ effect sizes, and Holm-Bonferroni correction flags).
4. Click **Export JSON** or **Export CSV** to download the raw experimental data.

### 7. Real-World Data Ingestion & Calibration
1. Navigate to the **Real-World Data & Validation** tab.
2. Select the built-in reference dataset **`pems_dual_metro_benchmark`** (Caltrans PeMS freeway sensors).
3. Review the **Data Quality Audit**: 48 valid intervals, 0 quarantined records, and explicit provenance tags.
4. Click **Run Model Calibration** with a 70% chronological holdout split.
5. Review the **Validation Scorecard**: verify that calibration reduces Flow MAE from 32.4 veh/h to 18.2 veh/h (**43.8% error reduction**) with strong temporal correlation ($r = 0.941$).

---

## Running Automated Tests

```bash
cd backend
python -m pytest -v

# Run individual test suites:
python -m pytest tests/test_simulation.py -v
python -m pytest tests/test_ai_predictor.py -v
python -m pytest tests/test_independent_optimization.py -v
python -m pytest tests/test_coordinated_optimization.py -v
python -m pytest tests/test_research_evaluation.py -v
python -m pytest tests/test_mpc_optimization.py -v
python -m pytest tests/test_realworld_validation.py -v

# Frontend production bundle test:
cd ../frontend
npm run build
```

---

## Research Documentation & Technical Papers

- **Comprehensive Research Report**: [`docs/FINAL_RESEARCH_REPORT.md`](file:///c:/Users/dell/Desktop/Ai%20twin%20cities/docs/FINAL_RESEARCH_REPORT.md)
  *Includes Title & Abstract, Problem Statement, Objectives, Related Work, Digital Twin Design, Mathematical Formulations, Datasets & Provenance, Experimental Methodology, Inferential Statistics, Empirical Findings Tables, Critical Discussion, Threats to Validity, and Future Work.*
- **System Architecture & Workflows**: [`docs/ARCHITECTURE_AND_WORKFLOWS.md`](file:///c:/Users/dell/Desktop/Ai%20twin%20cities/docs/ARCHITECTURE_AND_WORKFLOWS.md)
  *Includes System Architecture Diagram, Operational Sequence Diagram, Research Experiment Pipeline, and Real-World Validation Pipeline in Mermaid syntax.*



