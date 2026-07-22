<div align="center">

AgriAI AI Yield Intelligence for Nigerian Farmers

**A data gap that costs Nigeria's smallholder farmers real yield, closed one prediction at a time.**

[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React Native](https://img.shields.io/badge/React_Native-0.74-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev/)
[![AWS](https://img.shields.io/badge/AWS-eu--west--2-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)](https://aws.amazon.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![Live App](https://img.shields.io/badge/Live_App-Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white)](https://agriai-insight.netlify.app)


[Live App](https://agriai-insight.netlify.app) · [Problem](#-the-problem) · [Architecture](#-system-architecture) · [API](#-api-reference) · [Install](#-installation) · [Impact](#-real-world-impact) · [Research](#-research--academic-context) · [Roadmap](#-roadmap)

</div>

---

The Problem

Nigerian agriculture employs a substantial share of the national labour force, yet productivity per hectare remains among the lowest globally. Research on smallholder farming across sub-Saharan Africa (including Nigeria) has found no meaningful productivity growth over the past decade, despite the availability of higher-yielding inputs and practices. The root cause is not effort, it is information asymmetry. While farmers in Iowa, Punjab, and the Netherlands plant against satellite imagery, soil-sensor telemetry, and ML-driven yield models, the smallholder in Borno, Kebbi, or Cross River plants against memory of last year's rain.



### How AgriAI Solves It

AgriAI is a Nigeria-first, mobile-first decision support system that puts a yield-prediction model directly into a farmer's hand runnable on a US$60 Android phone, over a 3G connection, in any of Nigeria's six geopolitical zones.

| Pain Point                                                  | AgriAI's Response                                                                                          |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Farmers don't know what their land *can* yield              | A POST to `/predict` returns tonnes-per-hectare grounded in regional rainfall × soil × fertilizer × season |
| No localized agronomic guidance                             | Every prediction returns a context-aware recommendation (e.g. "apply 100–150 kg/ha NPK", "switch season")  |
| Extension officers can't reach 36M farmers                  | A FastAPI + React Native architecture that scales horizontally on commodity AWS infrastructure             |
| Connectivity gaps in rural areas                            | AsyncStorage on the device predictions persist offline and resync                                        |
| Crop calendars vary across regions but advice is one-size   | Six-zone yield index (North-West, North-East, North-Central, South-West, South-East, South-South)         |

---

System Architecture

```
        ┌──────────────────────────────────────────────────────────────────┐
        │                FARMER'S ANDROID / iOS DEVICE                     │
        │                                                                  │
        │   ┌────────────────────────────────────────────────────────┐    │
        │   │  React Native + Expo Mobile Client                     │    │
        │   │  • Home  · Prediction  · Results  · History            │    │
        │   │  • AsyncStorage  →  offline-first prediction journal   │    │
        │   │  • ApiService  →  fetch + 15s timeout + retry          │    │
        │   └─────────────────────────┬──────────────────────────────┘    │
        └─────────────────────────────│────────────────────────────────────┘
                                      │  HTTPS · JSON · Bearer Token (v2)
                                      ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │                  AWS CLOUD  ·  REGION: eu-west-2                 │
        │                                                                  │
        │   ┌─────────────────────┐      ┌──────────────────────────────┐  │
        │   │  Amazon CloudFront  │─────▶│  API Gateway / ALB           │  │
        │   │  (TLS, CDN, WAF)    │      │  rate-limit + auth           │  │
        │   └─────────────────────┘      └──────────────┬───────────────┘  │
        │                                                │                  │
        │                                                ▼                  │
        │              ┌─────────────────────────────────────────────┐     │
        │              │  FastAPI · Uvicorn · Pydantic v2            │     │
        │              │  Containerised on ECS Fargate (autoscaling) │     │
        │              │                                             │     │
        │              │   /predict   /regions   /crops              │     │
        │              │   /seasons/current   /insights/...          │     │
        │              │   /history                                  │     │
        │              └───────────────────┬─────────────────────────┘     │
        │                                  │                                │
        │                                  ▼                                │
        │              ┌─────────────────────────────────────────────┐     │
        │              │      AI / ML YIELD ENGINE                   │     │
        │              │                                             │     │
        │              │  Y(t/ha) = Yc · Rz · Fs · Fr · Ff           │     │
        │              │                                             │     │
        │              │  Yc = crop baseline (10 staples)            │     │
        │              │  Rz = regional yield multiplier (6 zones)   │     │
        │              │  Fs = soil factor   {poor, medium, good}    │     │
        │              │  Fr = rainfall factor  (clamped 0.5–1.2)    │     │
        │              │  Ff = fertilizer factor (clamped ≤ 1.3)     │     │
        │              │                                             │     │
        │              │  confidence ← seasonal fit + data quality   │     │
        │              └───────────────────┬─────────────────────────┘     │
        │                                  │                                │
        │             ┌────────────────────┴────────────────────┐           │
        │             ▼                                         ▼           │
        │   ┌──────────────────┐                     ┌───────────────────┐  │
        │   │  Amazon S3       │                     │  Amazon RDS       │  │
        │   │  model artefacts │                     │  PostgreSQL       │  │
        │   │  satellite tiles │                     │  predictions +    │  │
        │   │  training data   │                     │  farm telemetry   │  │
        │   └──────────────────┘                     └───────────────────┘  │
        │                                                                  │
        │   CloudWatch · X-Ray  ←  observability       Secrets Manager    │
        └──────────────────────────────────────────────────────────────────┘
```

Implementation status. The mobile app, FastAPI service, and yield engine in this repository are fully implemented and runnable. The AWS deployment topology shown above is the production reference architecture; see the [Roadmap](#-roadmap) for the deployment milestone.

---

 API Reference

The backend exposes **seven endpoints**, all returning JSON, all auto-documented at `/docs` (Swagger UI) and `/redoc`.

| # | Method | Endpoint                       | Purpose                                                                   |
| - | ------ | ------------------------------ | ------------------------------------------------------------------------- |
| 1 | `GET`  | `/`                            | Service metadata · version · author · docs link                           |
| 2 | `POST` | `/predict`                     | Run the AI yield model on a farm-data payload; returns yield + advice     |
| 3 | `GET`  | `/regions`                     | All 36 Nigerian states + FCT, grouped by geopolitical zone                |
| 4 | `GET`  | `/crops`                       | Catalogue of supported crops with avg yield, season, and region fit       |
| 5 | `GET`  | `/seasons/current`             | Current Nigerian farming season (rainy ↔ dry / Harmattan)                 |
| 6 | `GET`  | `/insights/regional-summary`   | Aggregate yield benchmarks per zone rainfall, multiplier, performance   |
| 7 | `GET`  | `/history?limit=N`             | Most recent server-side predictions, newest first (max 500)               |

 Example: `POST /predict`

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
        "state": "Kano",
        "crop": "maize",
        "farm_size_hectares": 2.5,
        "rainfall_mm": 850,
        "fertilizer_kg_per_ha": 120,
        "soil_quality": "medium"
      }'
```

```json
{
  "prediction_id": "1c2f8196-4d95-4a89-abb4-7fa078bd563c",
  "state": "Kano",
  "region": "North-West",
  "crop": "maize",
  "farm_size_hectares": 2.5,
  "predicted_yield_tonnes": 3.73,
  "predicted_yield_per_hectare": 1.49,
  "confidence": 0.88,
  "season": "rainy",
  "recommendation": "Predicted yield is below the national average; review irrigation and inputs.",
  "created_at": "2026-05-19T02:44:30.922677+00:00"
}
```

---

Tech Stack

| Layer                 | Technology                              | Why it was chosen                                                   |
| --------------------- | --------------------------------------- | ------------------------------------------------------------------- |
| Mobile UI             | **React Native 0.74** + **Expo 51**     | Single codebase for Android (primary) + iOS; OTA updates via Expo  |
| Mobile navigation     | **@react-navigation/native-stack 6**    | Native-feel transitions on low-end Android devices                  |
| Offline persistence   | **@react-native-async-storage 1.23**    | Survives connectivity gaps in rural deployment                      |
| API runtime           | **FastAPI 0.115** on **Uvicorn 0.30**   | Async I/O, auto OpenAPI, sub-millisecond JSON serialisation         |
| Data validation       | **Pydantic v2.9**                       | Type-safe payload validation; rust-backed performance               |
| Language (backend)    | **Python 3.12**                         | Mature ML ecosystem; readable for academic collaborators            |
| ML model              | **Multivariate factor model** (in-tree) | Interpretable, no opaque LLM dependency  auditable for farmers     |
| Containerisation      | **Docker**                              | Reproducible deploys across local, staging, and AWS ECS Fargate     |
| Cloud (target)        | **AWS** (ECS, RDS, S3, CloudFront, API GW) | Native eu-west-2 latency to West Africa; well-supported in NG    |
| Observability         | **CloudWatch + AWS X-Ray**              | Distributed tracing across mobile → API → model calls               |
| CI/CD (planned)       | **GitHub Actions**                      | Test on every PR; container build + ECS deploy on `main`                                            | Open-source friendly; encourages academic reuse                     

---

Installation

Prerequisites
- **Python 3.10+** (3.12 recommended)
- **Node.js 18+** and **npm 9+**
- **Expo Go** app installed on your phone (Android or iOS) for live preview
- Optional: **Docker 24+** for containerised runs

 1️⃣ Backend setup (FastAPI)

```bash
# from the repository root
cd agriAI-app/backend

# create and activate an isolated environment
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# install pinned dependencies
pip install -r requirements.txt

# run the API with auto-reload
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

The interactive API docs are then live at <http://localhost:8000/docs>.

2️⃣ Mobile app setup (React Native + Expo)

```bash
cd agriAI-app/mobile

npm install
npx expo start
```

A QR code prints in the terminal. Open it in the **Expo Go** app on a real device (recommended emulators don't reflect real low-end performance).

**Pointing the app at a non-localhost backend** (e.g. a phone hitting your laptop over LAN, or staging on AWS):

```bash
EXPO_PUBLIC_AGRIAI_API_URL=http://192.168.1.20:8000 npx expo start
```

3️⃣ Running tests

```bash
# backend — pytest + httpx test client
cd agriAI-app/backend
pip install pytest httpx
pytest -v

# mobile — Jest + React Native Testing Library
cd agriAI-app/mobile
npm test
```

> A formal test suite is being expanded see the [Roadmap](#-roadmap). Manual verification against the live endpoints has been performed against all seven routes using `curl` and the Swagger UI; see the example response above.

---

 Screenshots

> Placeholder mockups replace with live captures once the app is deployed to Expo.

| Home (current season) | Prediction form | AI results |
| --<img width="1906" height="922" alt="image" src="https://github.com/user-attachments/assets/7bb3e7e5-2de4-45a8-a78f-ce3e5fff3d90" />
------------------- | --------------- | ---------- |
| ![Home](docs/screenshots/home.png) | ![Prediction](docs/screenshots/prediction.png) | ![Results](docs/screenshots/results.png) |

| History (saved predictions) | Empty state | Recommendation card |
| --------------------------- | ----------- | ------------------- |
| ![History](docs/screenshots/history.png) | ![Empty](docs/screenshots/empty.png) | ![Recommendation](docs/screenshots/recommendation.png) |

---

Real-World Impact

Who benefits

**Nigeria's smallholder farmers** the intended primary user base, reachable at scale through low-cost Android devices and 3G connectivity.
- State agricultural extension officers AgriAI gives them a scalable triage tool: a tablet, an internet connection, and they can serve hundreds of farmers a week instead of dozens.
- **Cooperatives and input-finance lenders** better yield priors translate directly into better collateral models.
- **Agritech researchers**open API and open licence make AgriAI a citable benchmark for downstream work.

 Coverage all 36 states + the FCT

| Zone           | States                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------- |
| North-West     | Kano · Kaduna · Katsina · Jigawa · Kebbi · Sokoto · Zamfara                                     |
| North-East     | Borno · Yobe · Bauchi · Gombe · Adamawa · Taraba                                                |
| North-Central  | Plateau · Nasarawa · Niger · Kwara · Kogi · Benue · **FCT**                                     |
| South-West     | Lagos · Ogun · Oyo · Osun · Ondo · Ekiti                                                        |
| South-East     | Anambra · Enugu · Imo · **Abia** · Ebonyi                                                       |
| South-South    | Rivers · Bayelsa · Delta · Edo · Cross River · Akwa Ibom                                        |

Every state above is validated end-to-end through `/regions`, `/predict`, and the `/insights/regional-summary` endpoint.

 Advancing the African tech ecosystem

- **Open source by default.**any Nigerian  or pan-African engineer can fork, extend, or self-host without negotiating a commercial licence.
- **Locally grounded data model.** The yield engine encodes Nigerian agronomic reality (Harmattan timing, North-East rainfall scarcity, South-East cassava dominance) instead of bolting Nigeria onto a model trained on temperate latitudes.
- **Talent flywheel.** The codebase is intentionally readable typed Pydantic models, named factors, no opaque ML so that an undergraduate at **Abia State University** can run it, modify the factor model, and publish a follow-up paper without first wrestling a research framework into shape.
- **Architectural blueprint.** The FastAPI + React Native + AWS pattern is reusable for adjacent African verticals: aquaculture in Lagos, livestock in Kaduna, agroforestry in Cross River.

---

 Research & Academic Context

This project sits at the intersection of three active research strands that the author is exploring as part of ongoing academic work affiliated with **Abia State University, Nigeria**:

1. **Precision agriculture in sub-Saharan Africa.** A growing body of peer-reviewed work demonstrates that simple, interpretable yield models conditioned on regional agroclimatic variables consistently outperform global one-size-fits-all models for African smallholder contexts. AgriAI's six-zone yield index and crop × season interaction terms are a direct operationalisation of that literature.
2. **Mobile-first information systems for low-resource settings.** Studies on rural ICT adoption in Nigeria repeatedly show that solutions which assume constant connectivity, latest-generation hardware, or high digital literacy fail in deployment. AgriAI's design choices  AsyncStorage cache, chip-based pickers instead of free-text inputs, sub-100 KB JSON payloads are derived from this evidence base.
3. **Cloud-native delivery of AI for developing economies.** Recent work on the cost-economics of inference at the edge versus in the cloud informs AgriAI's hybrid posture: an interpretable model running cheaply in a containerised FastAPI service, with the heavier ML roadmap (satellite tiles, deep CNN crop classifiers) reserved for AWS-side execution.

The project is positioned to contribute back in the form of a methods paper *"Region-Conditioned Yield Estimation for Nigerian Smallholder Agriculture: A Reproducible Open-Source Reference"* currently in preparation.

---

Roadmap

| #  | Milestone                                          | What it unlocks                                                                  |
| -- | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| 01 | **Satellite-derived NDVI fusion**                  | Replace `rainfall_mm` heuristic with real-time vegetation health via Sentinel-2  |
| 02 | **Hausa, Yoruba & Igbo localisation**              | Reach the ~60% of farmers who don't operate in English as a first language       |
| 03 | **USSD / SMS fallback channel**                    | Serve farmers on feature phones with no smartphone via Africa's Talking gateway  |
| 04 | **Market price overlay (NCX feed)**                | Pair yield forecast with current commodity price → expected revenue, not just tonnage |
| 05 | **AWS production deployment** (ECS + RDS + CDN)    | Move from local-dev to a multi-AZ Lagos / Cape Town latency footprint            |
| 06 | **Federated learning across cooperatives**         | Improve the model with on-device gradients without centralising raw farm data    |

---

Contributing

AgriAI is **open source and Nigerian-built** and contributions from anywhere are explicitly welcome.

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/your-feature`.
3. Run the test suite locally  `pytest` for backend, `npm test` for mobile.
4. Submit a PR with a clear description and, where relevant, before/after screenshots.

If you are a **Nigerian undergraduate, graduate student, or extension officer**, please open an issue first  there may be a research-track contribution path with co-authorship.

Areas where help is most useful right now:
- Translating the mobile app into **Hausa, Yoruba, or Igbo**.
- Sourcing **state-level rainfall and soil reference data** to replace the hand-tuned defaults.
- Writing **end-to-end Detox tests** for the mobile flows.
- Hardening the **AWS Terraform module** for the production deployment.

---

 Author

<table>
  <tr>
    <td width="180" valign="top">
      <img src="https://github.com/JulietChinenyeDuru.png" alt="Juliet Chinenye Duru" width="160" />
    </td>
    <td valign="top">
      <h3>Juliet Chinenye Duru</h3>
      <p><em>Academic Researcher · Data Engineer · Cloud &amp; AI DevOps Enthusiast</em></p>
      <p>
         <strong>Abia State University, Nigeria</strong><br/>
         GitHub: <a href="https://github.com/JulietChinenyeDuru">@JulietChinenyeDuru</a><br/>
         durujulietchinenye@gmail.com /duru.juliet@abiastateuniversity.edu.ng
      </p>
      <p>
        Juliet builds open-source, cloud-native data systems for African agricultural and public-sector use cases.
        Her work bridges peer-reviewed research and shipped production code turning academic insight into
        software that runs on the phone of a farmer in Umuahia or Kano, not just on a poster at a conference.
      </p>
    </td>
  </tr>
</table>

---


---

<div align="center">

**Built For Nigerian farmers · For the global open-source commons.**

*If this project advances your work, please consider citing it and starring the repository.*

</div>
