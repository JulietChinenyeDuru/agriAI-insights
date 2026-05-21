# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

AgriAI is a full-stack application providing AI-powered crop yield predictions for Nigerian smallholder farmers. It consists of:

- **FastAPI backend** deployed to AWS Lambda (eu-west-1) via API Gateway HTTP API
- **React Native / Expo mobile app** targeting Android-first
- **Static docs site** hosted on S3
- **CloudFormation** for all AWS infrastructure

## Common Commands

### Backend (FastAPI)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run locally (auto-reload)
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
# Swagger UI → http://localhost:8000/docs

# Run tests (no suite exists yet — use curl or Swagger UI for manual testing)
pip install pytest httpx
pytest -v
```

### Mobile (React Native / Expo)

```bash
cd mobile
npm install
npx expo start                          # scan QR in Expo Go app
npx expo start --android                # direct Android launch

# Point at a non-localhost backend (LAN or deployed Lambda)
EXPO_PUBLIC_AGRIAI_API_URL=https://urr6s98icd.execute-api.eu-west-1.amazonaws.com npx expo start

# EAS cloud builds
eas build --profile development         # internal APK for testing
eas build --profile preview             # internal APK (preview channel)
eas build --profile production          # AAB for Google Play
```

### AWS Deployment

```bash
# Deploy backend to Lambda (eu-west-1) — packages deps, uploads to S3, runs CloudFormation
bash scripts/deploy-backend.sh

# Deploy static website to S3 (eu-west-2 by default, override with AWS_REGION)
bash scripts/deploy-website.sh

# Override defaults
AWS_REGION=eu-west-1 STACK_NAME=agriai-backend-staging bash scripts/deploy-backend.sh
```

### Manual API testing

```bash
# Test the predict endpoint locally (start uvicorn first)
curl -X POST http://127.0.0.1:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "region": "Enugu",
    "crop_type": "Maize",
    "rainfall_mm": 120,
    "temperature_celsius": 28,
    "humidity_percent": 70,
    "fertilizer_kg": 50,
    "soil_ph": 6.5,
    "farm_size_hectares": 2
  }'

# Same request against the deployed Lambda
curl -X POST https://urr6s98icd.execute-api.eu-west-1.amazonaws.com/predict \
  -H "Content-Type: application/json" \
  -d '{
    "region": "Enugu",
    "crop_type": "Maize",
    "rainfall_mm": 120,
    "temperature_celsius": 28,
    "humidity_percent": 70,
    "fertilizer_kg": 50,
    "soil_ph": 6.5,
    "farm_size_hectares": 2
  }'
```

### CloudFormation

```bash
# Validate template before deploying
aws cloudformation validate-template \
  --template-body file://infrastructure/lambda.yaml \
  --region eu-west-1

# Check deployed outputs (API URL, function name)
aws cloudformation describe-stacks \
  --stack-name agriai-backend --region eu-west-1 \
  --query "Stacks[0].Outputs"
```

## Architecture

### Backend yield model (`backend/src/main.py`)

The entire backend is a single file. The yield calculation is a multiplicative factor model:

```
Y (t/ha) = Yc × Rz × Fs × Fr × Ff
```

- `Yc` — crop baseline (`SUPPORTED_CROPS` dict, 10 staples)
- `Rz` — regional multiplier (`REGIONAL_YIELD_INDEX`, 6 geopolitical zones)
- `Fs` — soil factor: poor=0.7, medium=1.0, good=1.25
- `Fr` — rainfall factor: `min(1.2, max(0.5, rainfall_mm / 1200))`
- `Ff` — fertilizer factor: `min(1.3, 1.0 + fertilizer_kg_per_ha / 500)`

Confidence is 0.88 if the crop's season matches the current calendar season, 0.65 otherwise.

The `_prediction_history` list is **in-memory only** — it resets on every Lambda cold start. The `/history` endpoint reflects only the current warm container's predictions. Persistent history lives on-device via AsyncStorage.

### Lambda deployment pattern (`scripts/deploy-backend.sh`)

The deploy script enables **S3 object versioning** on the artifact bucket. It captures the new version ID after every upload and passes it as `ArtifactVersion` to CloudFormation. This forces CloudFormation to detect a change and re-deploy the Lambda even when the S3 key is unchanged. Without this, a second deploy with identical code would be a no-op.

The zip layout — all pip packages at root level with `src/` alongside them — maps to the Lambda handler `src.main.handler`.

### Mobile data flow

`ApiService.js` reads `EXPO_PUBLIC_AGRIAI_API_URL` at **Expo build time** (not runtime). Changing the env var requires restarting the Expo dev server or rebuilding for EAS. The default falls back to `http://localhost:8000`.

Two separate history stores exist with different lifecycles:

| Store | Location | Key | Max entries | Persistence |
|---|---|---|---|---|
| Server-side | Lambda memory | — | 500 | Until cold start |
| Client-side | AsyncStorage | `@agriai/history` | 100 | Permanent on device |

The `ResultsScreen` writes to AsyncStorage when the user taps "Save to History". The `HistoryScreen` reads only from AsyncStorage (not the `/history` API). These two stores are never synced.

### Mobile navigation

`App.js` defines a single `NativeStack` navigator. Screens and their data contracts:

- `Home` — fetches `/seasons/current` on mount; entry point to the two main flows
- `Prediction` → `Results` — `PredictionScreen` posts to `/predict` and passes the full response object as `route.params.prediction` to `ResultsScreen`
- `Results` — reads `route.params.prediction`; tapping a history card in `HistoryScreen` also navigates here with a locally-stored prediction object
- `History` — reloads from AsyncStorage on every `useFocusEffect` (i.e. every time the screen gains focus)

The `ChipPicker` component is defined inline in `PredictionScreen.js`, not in a shared components directory.

### Infrastructure

Two independent CloudFormation stacks:

| Stack | Template | Region | Purpose |
|---|---|---|---|
| `agriai-backend` | `infrastructure/lambda.yaml` | eu-west-1 | Lambda + API Gateway HTTP API |
| `agriai-insights-website` | `infrastructure/s3-website.yaml` | eu-west-2 | S3 static website |

The Lambda stack uses API Gateway **HTTP API (v2)** with payload format 2.0, which Mangum detects automatically. Do not switch to REST API (v1) — it uses a different payload format and requires `PayloadFormatVersion: '1.0'`.

`AWS::Lambda::Function` tags must be a **list** of `{Key, Value}` pairs. `AWS::ApiGatewayV2::Api` tags must be a **JSON map**. Mixing these formats passes `validate-template` but fails CloudFormation early property validation at changeset time.

### CI/CD

Three GitHub Actions workflows run on pushes to `main`:

| Workflow | Trigger paths | What it does |
|---|---|---|
| `deploy-website.yml` | `docs/**`, `infrastructure/s3-website.yaml` | Syncs `docs/` to S3 |
| `deploy-backend.yml` | `backend/**`, `infrastructure/lambda.yaml` | Packages and deploys Lambda via CloudFormation |
| `deploy-mobile.yml` | `mobile/src/**` | Publishes EAS OTA update to the production channel |

All three require `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` repository secrets; the mobile workflow additionally requires `EXPO_TOKEN`.
