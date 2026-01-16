# Digital Forensics Suite

A comprehensive platform for digital evidence management, featuring AI-driven media analysis, facial recognition, and geospatial intelligence.

## Features

-   **Media Analysis**: Automated processing of images and videos.
-   **Facial Recognition**: Deep learning-based face detection and recognition using DeepFace.
-   **Geospatial Intelligence**: EXIF data extraction and location-based media mapping.
-   **Signature Matching**: Visual and video signature extraction for content identification.
-   **AI Categorization**: Automatic classification of media content.
-   **Watchlists**: Management of persons of interest with automated alerts.
-   **Case Management**: Organized evidence handling and reporting.

## Architecture

The system is built on a microservices architecture:

-   **Frontend**: React + Vite + Tailwind CSS
-   **Backend**: FastAPI (Python)
-   **Database**: PostgreSQL
-   **Message Queue**: Redis + Celery
-   **Object Storage**: MinIO
-   **Auth**: Keycloak
-   **Services**:
    -   Face Service (DeepFace)
    -   Hash Service (pHash/ORB)
    -   VSM Service (Video Signature)
    -   AI Categorizer
    -   Geocoder (Nominatim)

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
    Copy the example environment files to `.env`:
    ```bash
    cp .env.example .env
    cp backend/.env.example backend/.env
    cp workers/.env.example workers/.env
    cp frontend/.env.example frontend/.env
    cp geocoder/.env.example geocoder/.env
    ```
    *Note: Update the passwords and secrets in `.env` files for production use.*

3.  **Build and Run**:
    ```bash
    docker compose up --build -d
    ```

4.  **Access the Application**:
    -   Frontend: http://localhost
    -   API Docs: http://localhost/api/docs
    -   MinIO Console: http://localhost:9001
    -   Keycloak: http://localhost:8080

## Development

### Backend
located in `./backend`. Uses FastAPI and SQLAlchemy.

### Frontend
Located in `./frontend`. Uses React, React Query, and Leaflet.

### Workers
Celery workers located in `./workers` handle asynchronous tasks like face recognition and video analysis.

## License

[License Type] - See LICENSE file for details.
