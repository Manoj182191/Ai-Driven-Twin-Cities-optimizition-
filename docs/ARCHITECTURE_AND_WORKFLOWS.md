# AI-Driven Twin Cities Optimization: Architecture and Operational Workflows

This document details the system architecture, operational workflows, synthetic research experiments, and traffic-data comparison protocols for the **AI-Driven Twin Cities Optimization** research prototype.

All diagrams are rendered using standard Mermaid syntax.

---

## 1. System Architecture Diagram

The system is organized into modular layers: an interactive React 19 frontend client, a FastAPI high-throughput REST backend, a BPR-governed simulation digital twin, ML prediction and multi-strategy optimization engines, and a persistent research experiment data store.

```mermaid
graph TB
    subgraph Frontend_Client["Frontend Client (React 19 + TypeScript + Vite)"]
        UI_Dash["Overview Dashboard"]
        UI_Twin["Digital Twin SVG Map"]
        UI_Sim["Stepwise Simulation Controls"]
        UI_AI["ML Prediction Telemetry"]
        UI_OptIndep["Independent Optimization"]
        UI_OptCoord["Joint Coordinated Optimization"]
        UI_MPC["MPC & Scenario Planning"]
        UI_RealWorld["Traffic Data Comparison Hub"]
        UI_Research["Research Experimentation Suite"]
    end

    subgraph Backend_Gateway["Backend API Gateway (FastAPI)"]
        API_Sim["/api/simulation/*"]
        API_AI["/api/ai/*"]
        API_Opt["/api/optimization/*"]
        API_Research["/api/research/*"]
        API_Data["/api/data/traffic/*"]
        API_Health["/api/health & /api/system/status"]
    end

    subgraph Core_Engines["Digital Twin Core & Modeling Engines"]
        SimEngine["BPR Simulation Engine<br/>• Bureau of Public Roads Solver<br/>• 20 Road Links (A1-A10, B1-B10)<br/>• Intercity Bottleneck Queue Dynamics"]
        MLPredictor["Random Forest AI Predictor<br/>• Multi-Step Horizons (t+1, t+3, t+6)<br/>• Held-out Persistence Benchmark"]
    end

    subgraph Optimization_Services["Decision & Optimization Services"]
        IndepOpt["Phase 5: Independent Optimizer<br/>• Decentralized Local State Isolation<br/>• 5 Discrete Municipal Actions"]
        CoordOpt["Phase 6: Joint Coordinated Optimizer<br/>• Exhaustive 25-Pair Search<br/>• Combined 5-Component System Cost<br/>• Corridor Capacity & Budget Constraints"]
        MPCOpt["Phase 8: Multi-Step MPC Planner<br/>• Receding Horizon Execution (H ∈ {1,2,3,5})<br/>• Bounded Beam Search (K ≤ 10)<br/>• Discounted Cost & Robust/CVaR Modes"]
    end

    subgraph Data_Research_Services["Data Ingestion & Synthetic Benchmark Evaluation"]
        RealWorldSvc["Phase 9: Traffic Data Ingestion<br/>• CSV/JSON Parser & UTC Normalizer<br/>• Generated PeMS-schema-aligned benchmark<br/>• Imported source authenticity is unverified"]
        CalibEngine["Simulation Calibration Engine<br/>• Bounded Search on Selected Metric<br/>• Chronological Record Split (70/30)<br/>• Safe MAPE & Pearson r Metrics"]
        ResearchRunner["Phase 7: Research Experiment Engine<br/>• Multi-Seed Matched Executions<br/>• Paired t-tests & Wilcoxon Signed-Rank<br/>• Cohen's dz & Holm-Bonferroni Correction"]
        StorageEngine["Persistent JSON Storage<br/>• Experiment Runs & Telemetry Logs<br/>• CSV/JSON Export Pipeline"]
    end

    %% Client to API Connections
    UI_Sim --> API_Sim
    UI_Twin --> API_Sim
    UI_AI --> API_AI
    UI_OptIndep --> API_Opt
    UI_OptCoord --> API_Opt
    UI_MPC --> API_Opt
    UI_RealWorld --> API_Data
    UI_Research --> API_Research

    %% Gateway to Services
    API_Sim --> SimEngine
    API_AI --> MLPredictor
    API_Opt --> IndepOpt
    API_Opt --> CoordOpt
    API_Opt --> MPCOpt
    API_Data --> RealWorldSvc
    API_Data --> CalibEngine
    API_Research --> ResearchRunner

    %% Inter-service connections
    SimEngine --> MLPredictor
    IndepOpt --> SimEngine
    CoordOpt --> SimEngine
    MPCOpt --> SimEngine
    CoordOpt -. Fallback .-> MPCOpt
    CalibEngine --> SimEngine
    ResearchRunner --> IndepOpt
    ResearchRunner --> CoordOpt
    ResearchRunner --> MPCOpt
    ResearchRunner --> StorageEngine
    RealWorldSvc --> StorageEngine
```

---

## 2. Operational Workflow Diagram

Illustrates live simulation and multi-step receding-horizon Model Predictive Control (MPC). MPC evaluates candidate actions through cloned simulation-engine rollouts; it does not call the Random Forest predictor.

```mermaid
sequenceDiagram
    autonumber
    participant Client as Frontend Dashboard
    participant Engine as Simulation Engine
    participant MPC as MPC Planner (Beam Search)
    participant Twin as Digital Twin State

    Client->>Engine: Initialize Scenario (Demand Level, Seed, Corridor Capacity)
    Engine->>Twin: Reset Road Capacities, Initial Speeds & Queue States
    
    loop At Simulation Step k
        Engine->>Twin: Calculate Flow & BPR Delays: t = t_0 * (1 + 0.15 * (V/C)^4)
        alt Mode: Independent Optimization (Phase 5)
            Engine->>Engine: City A selects argmin c_A(a_A) locally
            Engine->>Engine: City B selects argmin c_B(a_B) locally
        else Mode: Joint Coordinated Optimization (Phase 6)
            Engine->>Engine: Evaluate 25 (a_A, a_B) pairs on state clone
            Engine->>Engine: Select pair minimizing combined system cost c_0
        else Mode: Multi-Step Receding Horizon MPC (Phase 8)
            MPC->>Engine: Clone engine state via copy.deepcopy(parent_engine)
            MPC->>MPC: Branch candidate sequences over horizon H via Beam Search
            MPC->>MPC: Simulate future steps using sandbox_engine.advance_step(1, a_A, a_B)
            MPC->>MPC: Evaluate discounted cumulative cost C = sum gamma^t * c_t
            MPC->>MPC: Identify optimal sequence (a_A^0..a_A^H-1, a_B^0..a_B^H-1)
            MPC->>Engine: Commit ONLY immediate action pair (a_A^0, a_B^0)
        end
        
        Engine->>Twin: Apply Physical Adjustments (Signal timing, Metering, Route advisory)
        Engine->>Twin: Update Spillover Queues & Intercity Corridor Delay
        Twin-->>Client: Stream Updated Link Speeds, Congestion Bands & Telemetry
    end
```

---

## 3. Research Experiment Workflow Diagram

Illustrates the simulation-based evaluation pipeline that compares strategies under matched initial seeds, calculates descriptive metrics, and runs paired inferential tests:

```mermaid
flowchart TD
    StartExp(["User Configures Experiment<br/>(Scenarios, Seeds N, Steps S, Strategies)"]) --> InitStorage["Initialize Experiment Record<br/>Status: Pending → Running"]
    
    subgraph ScenarioLoop["Scenario Evaluation Loop (Normal, Peak, Bottleneck)"]
        InitSeed["Initialize Matched Seed s"] --> BaseEngine["Instantiate Baseline Simulation Engine<br/>Set Identical Initial Traffic State"]
        
        BaseEngine --> BranchUnopt["Clone State: Unoptimized Run<br/>(Zero Traffic Interventions)"]
        BaseEngine --> BranchIndep["Clone State: Phase 5 Independent Run<br/>(Decentralized Local Control)"]
        BaseEngine --> BranchCoord["Clone State: Phase 6 Coordinated Run<br/>(25-Pair Joint Multi-Criteria Search)"]
        BaseEngine --> BranchMPC["Clone State: Phase 8 MPC Run<br/>(Receding Horizon Lookahead H=3)"]
        
        BranchUnopt --> StepUnopt["Simulate S Steps & Record Trajectories"]
        BranchIndep --> StepIndep["Simulate S Steps & Record Trajectories"]
        BranchCoord --> StepCoord["Simulate S Steps & Record Trajectories"]
        BranchMPC --> StepMPC["Simulate S Steps & Record Trajectories"]
        
        StepUnopt --> CollectMetrics["Collect Run Metric Records<br/>(Travel Time, Congestion, Queues, Budget, Compute Time)"]
        StepIndep --> CollectMetrics
        StepCoord --> CollectMetrics
        StepMPC --> CollectMetrics
    end
    
    InitStorage --> ScenarioLoop
    CollectMetrics --> PostProcess["Statistical Evaluation Module"]
    
    subgraph StatisticsAnalysis["Rigorous Statistical Processing"]
        PostProcess --> CalcDesc["Compute Descriptive Statistics<br/>Mean, Median, Std Dev, IQR, 95% Student's t CI"]
        CalcDesc --> PairedT["Execute Paired t-tests<br/>(H0: delta_mean = 0)"]
        CalcDesc --> Wilcoxon["Execute Wilcoxon Signed-Rank Tests<br/>(Non-parametric rank test)"]
        CalcDesc --> EffectSize["Compute Cohen's dz Effect Sizes<br/>dz = mean_diff / std_diff"]
        EffectSize --> HolmBonf["Apply Holm-Bonferroni Correction<br/>Family-wise Error Rate alpha = 0.05"]
    end
    
    HolmBonf --> GenNarrative["Synthesize Academic Findings Narrative"]
    GenNarrative --> SaveDisk["Persist EXP-ID.json to Disk Storage"]
    SaveDisk --> UI_Display["Render Interactive Charts & CSV/JSON Export in Dashboard"]
    UI_Display --> EndExp(["Experiment Complete"])
```

---

## 4. Traffic Data Comparison Workflow Diagram

Illustrates Phase 9 ingestion and comparison. The bundled benchmark is generated synthetic data; imported CSV/JSON source authenticity is not verified. Metrics describe agreement with the selected inputs, not real-world validation:

```mermaid
flowchart TD
    InputData["Traffic Data Input<br/>• User-provided CSV/JSON (unverified source)<br/>• Generated PeMS-schema-aligned synthetic benchmark"] --> ParseStage["Ingestion & Parsing<br/>• Detect Column Formats<br/>• Normalize Timestamps to ISO 8601 UTC"]

    ParseStage --> QualityCheck{"Data Quality & Hygiene Audit"}
    
    QualityCheck -->|Negative Flow, Speed > 220 km/h, Occupancy > 100%| Quarantine["Quarantine Buffer<br/>• Record Rejection Reason<br/>• Retain for Audit Log"]
    QualityCheck -->|Duplicate (timestamp, sensor_id)| Dedup["Drop Duplicates<br/>Increment Duplicate Count"]
    QualityCheck -->|Valid Input| ValidStore["Canonical Input Store<br/>Generated benchmark: SIMULATED<br/>Imported records: source unverified"]
    
    ValidStore --> MapStage["Detector-to-Road Mapping Layer<br/>• Map Sensor ID to Modeled Road (A1-A10, B1-B10, Corridor)<br/>• Confidence Tag: Exact / Spatial / Heuristic"]
    
    MapStage --> ChronoSplit["Chronological Train/Validation Split<br/>(Default: 70% Calibration, 30% Holdout)"]
    
    subgraph CalibrationModule["Model Calibration (70% Split)"]
        ChronoSplit -->|First 70% of Timestamp-Sorted Records| BoundedSearch["Bounded Grid Search<br/>• Demand Scale [0.5, 2.0]<br/>• Capacity Scale [0.7, 1.5]<br/>• Corridor Capacity Scale [0.5, 1.8]<br/>• Speed Factor Fixed at 1.0"]
        BoundedSearch --> SelectBest["Select Parameters Minimizing MAE<br/>for the Requested Metric"]
    end
    
    subgraph ValidationModule["Holdout Validation (30% Split)"]
        ChronoSplit -->|Last 30% of Records| HoldoutData["Synthetic Benchmark or Imported Records<br/>(source unverified)"]
        SelectBest --> SimCalib["Run Simulation with Calibrated Parameters"]
        HoldoutData --> CompareEngine["Input-to-Simulation Comparison"]
        SimCalib --> CompareEngine
        
        CompareEngine --> Metrics["Compute Error Metrics:<br/>• Mean Absolute Error (MAE)<br/>• Root Mean Squared Error (RMSE)<br/>• Safe MAPE (epsilon = 0.5)<br/>• Mean Signed Bias (over/under)<br/>• Pearson Correlation r (zero-variance safe)"]
    end
    
    Metrics --> ExportReport["Generate Validation Report<br/>• Compare Default vs. Calibrated Errors<br/>• Label Data Origins (OBSERVED, SIMULATED, CALIBRATED)<br/>• Export Processed CSV / JSON"]
    ExportReport --> EndVal(["Validation Complete"])
```
