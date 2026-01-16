# Digital Forensics Suite

A comprehensive platform for digital evidence management, featuring AI-driven media analysis, facial recognition, and geospatial intelligence.

## Features

-   **Media Analysis**: Automated processing of images and videos using advanced computer vision pipelines.
-   **Facial Recognition**: Deep learning-based face detection and recognition using DeepFace, integrated with watchlist alerts.
-   **Geospatial Intelligence**: EXIF data extraction, reverse geocoding, and offline-capable map visualization.
-   **Signature Matching**: Robust content identification using pHash (visual) and VSM (video temporal signatures).
-   **AI Categorization**: Zero-shot classification of media content using CLIP models.
-   **Case Management**: Organized evidence handling, timeline views, and automated reporting.
-   **Link Analysis**: Visualization of relationships between entities (persons, cases, media).

## Architecture

The system is built on a modular microservices architecture, orchestrated via Docker Compose.

### Core Services
-   **Frontend**: React application (Vite + Tailwind CSS) providing the investigator dashboard.
-   **Backend**: FastAPI (Python) serving the REST API and managing business logic.
-   **Nginx**: Reverse proxy and API gateway, routing traffic to appropriate services.

### AI & Processing Microservices
These independent services expose internal APIs for specialized tasks:
-   **Face Service**: Wraps DeepFace for 128D face encoding generation.
-   **Hash Service**: Generates perceptual hashes (pHash) and ORB feature descriptors for image matching.
-   **VSM Service**: Extracts temporal signatures and keyframe hashes from video files.
-   **AI Categorizer**: Classifies images into categories (e.g., "weapon", "vehicle", "document") using pre-trained models.
-   **Geocoder**: Interfaces with Nominatim (OpenStreetMap) for address resolution.

### Asynchronous Workers (Celery)
Heavy processing is offloaded to specialized Celery workers via Redis:
-   `worker-faces`: Dedicated to face detection and encoding tasks.
-   `worker-signatures`: Handles image and video signature extraction.
-   `worker-categorization`: Runs AI classification models.
-   `worker-watchlist`: Processes background checks and watchlist matching.
-   `worker`: General-purpose tasks (media ingestion, EXIF extraction).

### Infrastructure & Data
-   **PostgreSQL**: Primary relational database (Cases, Evidence, Users).
-   **Redis**: Message broker for Celery and caching layer.
-   **MinIO**: S3-compatible object storage for evidence files (images/videos).
-   **Keycloak**: centralized Identity and Access Management (IAM).
-   **OSM**: Self-hosted OpenStreetMap viewer (Next.js) with dedicated database (`osm-db`).

## Networking & Security
The system uses isolated Docker networks to enforce security boundaries:
-   `frontend-net`: Exposed services (Nginx, Frontend, Keycloak).
-   `backend-net`: Internal communication (API, DB, Workers).
-   `processing-net`: AI services and high-performance workers.
-   `auth-net`: Isolated Keycloak database network.
-   `osm-net`: Isolated mapping infrastructure.

## Prerequisites

-   Docker & Docker Compose
-   Node.js (for local frontend dev)
-   Python 3.11+ (for local backend dev)

## Setup

1.  **Clone the repository**:
    ```bash
    git clone git@github.com:Weapon-of-Choice/digital-forensics-suite.git
    cd digital-forensics-suite
    ```

2.  **Environment Setup**:
    Copy the example environment files to `.env` files:
    ```bash
    cp .env.example .env
    cp backend/.env.example backend/.env
    cp workers/.env.example workers/.env
    cp frontend/.env.example frontend/.env
    cp geocoder/.env.example geocoder/.env
    ```
    *Security Note: The default passwords in `.env.example` are for development only. Change them for production.*

3.  **Build and Run**:
    ```bash
    docker compose up --build -d
    ```

4.  **Access the Application**:
    -   **Dashboard**: http://localhost
    -   **API Documentation**: http://localhost/api/docs
    -   **MinIO Console**: http://localhost:9001 (User/Pass from .env)
    -   **Keycloak Admin**: http://localhost:8080 (User/Pass from .env)
    -   **Flower (Task Monitor)**: http://localhost/flower/
    -   **Map Viewer**: http://localhost/osm/

## Development Directory Structure

-   `backend/`: FastAPI application
-   `frontend/`: React application
-   `workers/`: Celery task definitions
-   `face-service/`, `hash-service/`, etc.: Independent AI microservices
-   `nginx/`: Gateway configuration
-   `osm/`: Next.js Map Viewer application

## License

[License Type] - See LICENSE file for details.
