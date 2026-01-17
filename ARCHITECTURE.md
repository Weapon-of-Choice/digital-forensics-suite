# System Architecture

The Digital Forensics Suite is a distributed microservices application designed for scalability, modularity, and security.

## High-Level Overview

The system ingests digital media (images/videos), processes them through various AI pipelines (Face Recognition, Video Analysis, Classification), and presents the results in a unified Investigator Dashboard.

### Core Components

1.  **Frontend (`/frontend`)**:
    -   **Tech**: React 18, Vite, Tailwind CSS, React Query, Zustand.
    -   **Role**: User interface for case management, media viewing, and analysis.
    -   **Key Libraries**: `lucide-react` (Icons), `leaflet` (Maps), `radix-ui` (Primitives).

2.  **API Gateway / Backend (`/backend`)**:
    -   **Tech**: FastAPI (Python 3.11), SQLAlchemy, Pydantic.
    -   **Role**: Central REST API, business logic, orchestration of workers.
    -   **Auth**: Integration with Keycloak (OIDC/OAuth2).

3.  **Database (`/postgres_data`)**:
    -   **Tech**: PostgreSQL 15+ with `pgvector` support (planned).
    -   **Role**: Persistent storage for Cases, Media metadata, Face embeddings, Signatures, and Relations.

4.  **Message Queue (`/redis`)**:
    -   **Tech**: Redis.
    -   **Role**: Task queue broker for Celery and caching layer.

5.  **Object Storage (`/minio_data`)**:
    -   **Tech**: MinIO (S3 Compatible).
    -   **Role**: Storage for raw evidence files (Images, Videos) and generated thumbnails.

### Processing Workers (`/workers`)

Asynchronous processing is handled by Celery workers, segmented by queue for scalability:

-   **`worker` (Queue: `celery`, `media`)**: General ingestion, EXIF extraction, Video thumbnail generation (ffmpeg).
-   **`worker-faces` (Queue: `faces`)**: Face detection and encoding. Calls `face-service`.
-   **`worker-signatures` (Queue: `signatures`)**: Visual signature extraction (ORB, pHash). Calls `hash-service`.
-   **`worker-categorization` (Queue: `categorization`)**: AI scene classification. Calls `ai-categorizer`.
-   **`worker-watchlist` (Queue: `watchlist`)**: Real-time matching against watchlists.

### Specialized Microservices

Standalone AI services exposing REST APIs (internal use only):

1.  **Face Service**:
    -   **Tech**: Flask, DeepFace, TensorFlow, RetinaFace.
    -   **Role**: Face detection (RetinaFace), alignment, and embedding generation (Facenet512).

2.  **VSM Service (Video Signature)**:
    -   **Tech**: FastAPI, OpenCV, NumPy.
    -   **Role**: Temporal hashing of video files for duplicate detection and matching.

3.  **Hash Service**:
    -   **Tech**: Flask, OpenCV.
    -   **Role**: Image pHash and ORB feature extraction.

4.  **AI Categorizer**:
    -   **Tech**: FastAPI, PyTorch (CLIP/ResNet).
    -   **Role**: Zero-shot image classification.

5.  **Geocoder**:
    -   **Tech**: Flask.
    -   **Role**: Proxy for Nominatim/OSM geocoding services.

6.  **OSM Viewer**:
    -   **Tech**: Next.js.
    -   **Role**: Self-hosted offline-capable OpenStreetMap viewer.

## Network Topology

The system uses Docker Compose networks to isolate components:

-   **`frontend-net`**: Public-facing (Nginx, Frontend, Keycloak).
-   **`backend-net`**: Internal application traffic (API <-> DB <-> Redis <-> Workers).
-   **`processing-net`**: High-bandwidth AI traffic (Workers <-> AI Services).
-   **`auth-net`**: Identity database isolation.
-   **`osm-net`**: Map infrastructure isolation.

## Data Flow

1.  **Ingestion**: User uploads file via Frontend -> Nginx -> API.
2.  **Storage**: API streams file to MinIO. Creates DB record.
3.  **Queuing**: API sends `process_media` task to Redis.
4.  **Processing**:
    -   `worker` picks up task. Generates thumbnail. Extracts EXIF.
    -   Dispatches sub-tasks to `faces`, `signatures`, `categorization` queues.
5.  **Analysis**:
    -   Workers call respective Microservices (e.g., `worker-faces` calls `face-service`).
    -   Results (Embeddings, Tags) are saved to PostgreSQL.
6.  **Alerting**: `worker-watchlist` checks new embeddings against Watchlist. Creates `Alert` if match found.
7.  **Visualization**: User views results on Dashboard (Real-time via API polling/React Query).

## Security

-   **Authentication**: Keycloak manages users and sessions (JWT).
-   **Authorization**: API verifies tokens.
-   **Storage**: MinIO requires signed URLs or internal access (proxied via API).
-   **Secrets**: Managed via `.env` files (not committed to repo).
