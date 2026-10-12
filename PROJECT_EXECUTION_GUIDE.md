# AI-Driven Twin Cities Optimization: Execution and Demonstration Guide

This guide provides concise, verified instructions for starting, verifying, and demonstrating the **AI-Driven Twin Cities Optimization** research prototype.

---

## 1. Prerequisites and Environment Setup

- **Python Version**: Python 3.11 or 3.12 (Tested on Python 3.12.10 on Windows 64-bit)
- **Node.js Version**: Node.js v18+ or v20+ with npm (Tested with Vite v8.3.4)
- **Git**: Installed for version control

### Quick Setup

```bash
# Clone or navigate to the repository
cd "Ai twin cities"

# Backend setup
cd backend
python -m pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm install
cd ..
```

---

## 2. Launching the Services

Run the backend and frontend in two separate terminal windows:

### Terminal 1: Backend API (FastAPI + Uvicorn)
```bash
cd backend
python main.py
```
- API Server: `http://127.0.0.1:8000`
- Interactive OpenAPI Docs: `http://127.0.0.1:8000/docs`
- Healthcheck Endpoint: `http://127.0.0.1:8000/api/health`
- System Status: `http://127.0.0.1:8000/api/system/status`

### Terminal 2: Frontend Client (React 19 + Vite)
```bash
cd frontend
npm run dev
```
- Frontend Web App: `http://localhost:5173`
- Reverse proxy automatically forwards `/api/*` requests to port `8000`.

---

## 3. Running Automated Tests

```bash
# Run all 57 backend automated tests (Phases 1-9)
cd backend
python -m pytest -v

# Run individual test suites
python -m pytest tests/test_simulation.py -v
python -m pytest tests/test_ai_predictor.py -v
python -m pytest tests/test_independent_optimization.py -v
python -m pytest tests/test_coordinated_optimization.py -v
python -m pytest tests/test_research_evaluation.py -v
python -m pytest tests/test_mpc_optimization.py -v
python -m pytest tests/test_realworld_validation.py -v

# Test frontend production build
cd ../frontend
npm run build
```

---

## 4. Demonstrating the System (Step-by-Step Viva Script)

Follow these steps to demonstrate the platform to a reviewer:

### Step 1: Digital Twin Overview and Map
1. Open `http://localhost:5173` in your browser.
2. Click **Twin Cities View**.
3. Point out **City A (Metro Alpha)** on the left (blue), **City B (Metro Beta)** on the right (purple), and the central **Intercity Corridor** (`IC_CORRIDOR`).
4. Click road link `A1` or `IC_CORRIDOR` to open the **Road Details Drawer** showing current vehicles, capacity, travel time, and queue length.
5. Click **Step Simulation** to advance time step by step and watch the flow pulses and BPR congestion colors update.

### Step 2: Machine Learning Forecasting
1. Click **AI Predictions**.
2. Explain the multi-step horizons ($t+1, t+3, t+6$).
3. Compare the Random Forest predictions against the Persistence Baseline table.
4. Click **Retrain Model** to demonstrate live training on recent simulation runs.

### Step 3: Independent vs. Joint Coordinated Optimization
1. Click **Independent Optimization**.
2. Run a 12-step baseline experiment. Explain that City A and City B make decisions with **zero knowledge of each other**.
3. Click **Joint Coordinated Optimization**.
4. Click **Run Head-to-Head Comparison**.
5. Explain how evaluating all 25 joint action pairs respects shared corridor capacity and reduces severe queue buildup.

### Step 4: Multi-Step MPC & Scenario Planning
1. Click **MPC & Scenario Planning**.
2. Select Planning Horizon $H=3$ and Beam Width $K=5$.
3. Click **Execute MPC Plan**.
4. Explain the receding-horizon principle: the algorithm evaluates candidate sequences across 3 future steps, but commits **only the immediate first action pair** before replanning.

### Step 5: Research-Grade Statistical Evaluation
1. Click **Research Evaluation**.
2. Select experiment `EXP-B1F1EEB4` or `EXP-33FF6B2A`.
3. Review the **Executive Findings Narrative**, paired t-test $p$-values, Wilcoxon signed-rank tests, Cohen's $d_z$ effect sizes, and Holm-Bonferroni corrections.
4. Click **Export JSON** or **Export CSV** to demonstrate reproducible data export.

### Step 6: Real-World Data & Calibration
1. Click **Real-World Data & Validation**.
2. Select the reference dataset `DATASET-BENCHMARK-TC-01` (PeMS-aligned).
3. Point out the **Data Quality Summary** (48 intervals, 0 quarantined, explicit provenance tags).
4. Click **Run Model Calibration** with a 70% holdout split.
5. Show the validation scorecard displaying empirical error reduction and high Pearson correlation ($r = 0.941$).

---

## 5. Offline & Direct API Verification (CLI Script)

You can verify all core backend APIs directly using this one-line command:

```bash
cd backend
python -c "
import urllib.request, json

def probe(url, method='GET', body=None):
    req = urllib.request.Request(url, method=method)
    if body:
        req.add_header('Content-Type', 'application/json')
        data = json.dumps(body).encode()
        res = urllib.request.urlopen(req, data=data)
    else:
        res = urllib.request.urlopen(req)
    print(f'[OK] {method} {url} -> {res.status}')

probe('http://127.0.0.1:8000/api/health')
probe('http://127.0.0.1:8000/api/system/status')
probe('http://127.0.0.1:8000/api/simulation/state')
probe('http://127.0.0.1:8000/api/simulation/step', 'POST', {})
probe('http://127.0.0.1:8000/api/ai/status')
probe('http://127.0.0.1:8000/api/ai/predict', 'POST', {'horizon': 3})
probe('http://127.0.0.1:8000/api/optimization/independent/run', 'POST', {'steps': 6})
probe('http://127.0.0.1:8000/api/optimization/coordinated/run', 'POST', {'steps': 6})
probe('http://127.0.0.1:8000/api/optimization/mpc/run', 'POST', {'steps': 6, 'planning_horizon': 2})
probe('http://127.0.0.1:8000/api/data/traffic/sources')
probe('http://127.0.0.1:8000/api/data/traffic/datasets')
print('All core endpoints responding normally!')
"
```
