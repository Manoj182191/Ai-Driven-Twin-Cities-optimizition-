from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from .api.simulation import router as simulation_router
from .api.ai import router as ai_router
from .api.optimization import router as optimization_router
from .api.research import router as research_router
from .api.realworld import router as realworld_router

app = FastAPI(
    title="AI-Driven Twin Cities Optimization API",
    description="Backend service providing digital twin simulation, ML prediction, and joint optimization for connected cities.",
    version="1.0.0"
)

# Enable CORS for frontend local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(simulation_router)
app.include_router(ai_router)
app.include_router(optimization_router)
app.include_router(research_router)
app.include_router(realworld_router)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "AI-Driven Twin Cities Optimization API",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0"
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "backend": "connected",
        "timestamp": datetime.utcnow().isoformat(),
        "database": "sqlite/local",
        "engine": "FastAPI + Scikit-Learn"
    }

@app.get("/api/system/status")
def system_status():
    return {
        "connected": True,
        "cities": ["City A (Metro Alpha)", "City B (Metro Beta)"],
        "intercity_corridor": "Active",
        "modules": {
            "digital_twins": "active",
            "simulation_engine": "active",
            "ai_predictor": "active",
            "independent_optimizer": "active",
            "joint_optimizer": "active",
            "mpc_scenario_planner": "active",
            "research_evaluation": "active",
            "realworld_validation": "active",
            "system_integration": "active"
        },
        "phase": "Phase 10 - Final System Integration, Research Documentation & Presentation Active",
        "timestamp": datetime.utcnow().isoformat()
    }

