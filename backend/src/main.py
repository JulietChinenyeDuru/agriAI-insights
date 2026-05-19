"""
AgriAI Backend API
FastAPI service providing AI-powered yield predictions and regional insights
for Nigerian smallholder farmers.

Author: Juliet Chinenye Duru
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from pydantic import BaseModel, Field, field_validator

app = FastAPI(
    title="AgriAI API",
    description="AI yield predictions and agricultural insights for Nigerian farmers",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


NIGERIAN_STATES = [
    "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa",
    "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti",
    "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
    "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo",
    "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
]

SUPPORTED_CROPS = {
    "maize":    {"avg_yield_t_ha": 2.0, "season": "rainy",  "regions": ["North", "Middle Belt"]},
    "rice":     {"avg_yield_t_ha": 2.5, "season": "rainy",  "regions": ["North", "South-South"]},
    "cassava":  {"avg_yield_t_ha": 12.0, "season": "all",   "regions": ["South", "Middle Belt"]},
    "yam":      {"avg_yield_t_ha": 10.0, "season": "rainy", "regions": ["Middle Belt", "South-East"]},
    "sorghum":  {"avg_yield_t_ha": 1.3, "season": "rainy",  "regions": ["North"]},
    "millet":   {"avg_yield_t_ha": 1.0, "season": "rainy",  "regions": ["North"]},
    "cocoa":    {"avg_yield_t_ha": 0.6, "season": "all",    "regions": ["South-West"]},
    "groundnut":{"avg_yield_t_ha": 1.2, "season": "rainy",  "regions": ["North"]},
    "tomato":   {"avg_yield_t_ha": 8.0, "season": "dry",    "regions": ["North", "Middle Belt"]},
    "plantain": {"avg_yield_t_ha": 7.0, "season": "all",    "regions": ["South"]},
}

REGIONAL_YIELD_INDEX = {
    "North-West":   {"rainfall_mm": 800,  "yield_multiplier": 0.85},
    "North-East":   {"rainfall_mm": 700,  "yield_multiplier": 0.75},
    "North-Central":{"rainfall_mm": 1200, "yield_multiplier": 1.00},
    "South-West":   {"rainfall_mm": 1500, "yield_multiplier": 1.10},
    "South-East":   {"rainfall_mm": 1800, "yield_multiplier": 1.15},
    "South-South":  {"rainfall_mm": 2400, "yield_multiplier": 1.20},
}

STATE_TO_REGION = {
    "Kano": "North-West", "Kaduna": "North-West", "Katsina": "North-West",
    "Jigawa": "North-West", "Kebbi": "North-West", "Sokoto": "North-West", "Zamfara": "North-West",
    "Borno": "North-East", "Yobe": "North-East", "Bauchi": "North-East",
    "Gombe": "North-East", "Adamawa": "North-East", "Taraba": "North-East",
    "Plateau": "North-Central", "Nasarawa": "North-Central", "Niger": "North-Central",
    "Kwara": "North-Central", "Kogi": "North-Central", "Benue": "North-Central", "FCT": "North-Central",
    "Lagos": "South-West", "Ogun": "South-West", "Oyo": "South-West",
    "Osun": "South-West", "Ondo": "South-West", "Ekiti": "South-West",
    "Anambra": "South-East", "Enugu": "South-East", "Imo": "South-East",
    "Abia": "South-East", "Ebonyi": "South-East",
    "Rivers": "South-South", "Bayelsa": "South-South", "Delta": "South-South",
    "Edo": "South-South", "Cross River": "South-South", "Akwa Ibom": "South-South",
}


_prediction_history: list[dict] = []


class FarmData(BaseModel):
    """Input payload for a yield prediction request."""
    state: str = Field(..., description="Nigerian state where the farm is located")
    crop: str = Field(..., description="Crop being cultivated")
    farm_size_hectares: float = Field(..., gt=0, le=10000)
    rainfall_mm: Optional[float] = Field(None, ge=0, le=5000)
    fertilizer_kg_per_ha: Optional[float] = Field(None, ge=0, le=1000)
    soil_quality: Optional[str] = Field("medium", description="poor | medium | good")

    @field_validator("state")
    @classmethod
    def validate_state(cls, v: str) -> str:
        if v not in NIGERIAN_STATES:
            raise ValueError(f"'{v}' is not a recognised Nigerian state")
        return v

    @field_validator("crop")
    @classmethod
    def validate_crop(cls, v: str) -> str:
        if v.lower() not in SUPPORTED_CROPS:
            raise ValueError(f"'{v}' is not a supported crop")
        return v.lower()

    @field_validator("soil_quality")
    @classmethod
    def validate_soil(cls, v: Optional[str]) -> str:
        v = (v or "medium").lower()
        if v not in {"poor", "medium", "good"}:
            raise ValueError("soil_quality must be poor, medium, or good")
        return v


class PredictionResponse(BaseModel):
    prediction_id: str
    state: str
    region: str
    crop: str
    farm_size_hectares: float
    predicted_yield_tonnes: float
    predicted_yield_per_hectare: float
    confidence: float
    season: str
    recommendation: str
    created_at: str


def _current_season() -> dict:
    """Return the current Nigerian farming season based on the calendar month."""
    month = datetime.now(timezone.utc).month
    if 4 <= month <= 10:
        return {
            "season": "rainy",
            "label": "Rainy / Wet Season",
            "months": "April - October",
            "primary_crops": ["maize", "rice", "yam", "sorghum", "millet", "groundnut"],
        }
    return {
        "season": "dry",
        "label": "Dry / Harmattan Season",
        "months": "November - March",
        "primary_crops": ["tomato", "onion", "irrigated rice", "vegetables"],
    }


def _compute_prediction(data: FarmData) -> PredictionResponse:
    crop_info = SUPPORTED_CROPS[data.crop]
    region = STATE_TO_REGION.get(data.state, "North-Central")
    region_info = REGIONAL_YIELD_INDEX[region]

    base_yield = crop_info["avg_yield_t_ha"] * region_info["yield_multiplier"]

    soil_factor = {"poor": 0.7, "medium": 1.0, "good": 1.25}[data.soil_quality]

    rainfall = data.rainfall_mm if data.rainfall_mm is not None else region_info["rainfall_mm"]
    rainfall_factor = min(1.2, max(0.5, rainfall / 1200))

    fertilizer_factor = 1.0
    if data.fertilizer_kg_per_ha is not None:
        fertilizer_factor = min(1.3, 1.0 + (data.fertilizer_kg_per_ha / 500))

    yield_per_ha = round(base_yield * soil_factor * rainfall_factor * fertilizer_factor, 2)
    total_yield = round(yield_per_ha * data.farm_size_hectares, 2)

    season = _current_season()["season"]
    in_season = season in {crop_info["season"], "all"} or crop_info["season"] == "all"
    confidence = 0.88 if in_season else 0.65

    recommendation = _build_recommendation(data, yield_per_ha, crop_info, in_season)

    return PredictionResponse(
        prediction_id=str(uuid4()),
        state=data.state,
        region=region,
        crop=data.crop,
        farm_size_hectares=data.farm_size_hectares,
        predicted_yield_tonnes=total_yield,
        predicted_yield_per_hectare=yield_per_ha,
        confidence=confidence,
        season=season,
        recommendation=recommendation,
        created_at=datetime.now(timezone.utc).isoformat(),
    )


def _build_recommendation(
    data: FarmData,
    yield_per_ha: float,
    crop_info: dict,
    in_season: bool,
) -> str:
    parts = []
    if not in_season:
        parts.append(
            f"{data.crop.title()} is best planted in the {crop_info['season']} season — "
            "yield estimate has been reduced accordingly."
        )
    if data.soil_quality == "poor":
        parts.append("Soil is poor — consider organic compost or NPK 15-15-15 before planting.")
    if data.fertilizer_kg_per_ha is None or data.fertilizer_kg_per_ha < 100:
        parts.append("Apply 100-150 kg/ha of fertilizer to lift yield by ~20%.")
    if yield_per_ha < crop_info["avg_yield_t_ha"]:
        parts.append("Predicted yield is below the national average; review irrigation and inputs.")
    if not parts:
        parts.append("Conditions look favourable — proceed with planting on schedule.")
    return " ".join(parts)


@app.get("/", tags=["meta"])
def root():
    return {
        "name": "AgriAI API",
        "version": "1.0.0",
        "author": "Juliet Chinenye Duru",
        "docs": "/docs",
    }


@app.post("/predict", response_model=PredictionResponse, tags=["predictions"])
def predict_yield(farm_data: FarmData) -> PredictionResponse:
    """Run an AI yield prediction on the given farm data."""
    result = _compute_prediction(farm_data)
    _prediction_history.append(result.model_dump())
    if len(_prediction_history) > 500:
        _prediction_history.pop(0)
    return result


@app.get("/regions", tags=["reference"])
def list_regions():
    """Return all 36 Nigerian states plus the FCT, grouped by geopolitical zone."""
    grouped: dict[str, list[str]] = {}
    for state, region in STATE_TO_REGION.items():
        grouped.setdefault(region, []).append(state)
    for region in grouped:
        grouped[region].sort()
    return {"count": len(NIGERIAN_STATES), "states": NIGERIAN_STATES, "by_region": grouped}


@app.get("/crops", tags=["reference"])
def list_crops():
    """Return the catalogue of supported crops with their agronomic profile."""
    return {
        "count": len(SUPPORTED_CROPS),
        "crops": [
            {"name": name, **info} for name, info in SUPPORTED_CROPS.items()
        ],
    }


@app.get("/seasons/current", tags=["reference"])
def current_season():
    """Return the current Nigerian farming season."""
    return _current_season()


@app.get("/insights/regional-summary", tags=["insights"])
def regional_summary():
    """Aggregate yield benchmarks for each Nigerian geopolitical zone."""
    summary = []
    for region, info in REGIONAL_YIELD_INDEX.items():
        states = sorted([s for s, r in STATE_TO_REGION.items() if r == region])
        summary.append({
            "region": region,
            "states": states,
            "avg_rainfall_mm": info["rainfall_mm"],
            "yield_multiplier": info["yield_multiplier"],
            "performance": _performance_label(info["yield_multiplier"]),
        })
    return {"regions": summary, "generated_at": datetime.now(timezone.utc).isoformat()}


def _performance_label(multiplier: float) -> str:
    if multiplier >= 1.15:
        return "high"
    if multiplier >= 1.0:
        return "above-average"
    if multiplier >= 0.85:
        return "average"
    return "below-average"


@app.get("/history", tags=["predictions"])
def get_history(limit: int = 50):
    """Return the most recent saved predictions (newest first)."""
    if limit < 1 or limit > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="limit must be between 1 and 500",
        )
    return {
        "count": len(_prediction_history),
        "predictions": list(reversed(_prediction_history))[:limit],
    }


# Lambda entry point — Mangum translates API Gateway HTTP API (payload v2.0)
# events into ASGI requests that FastAPI can handle.
# Note: _prediction_history is in-memory and resets on each Lambda cold start.
handler = Mangum(app, lifespan="off")
