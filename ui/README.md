# Kitchen Sink Dashboard UI

A Python Flask web dashboard for visualizing Kitchen Sink introspection data.

## Features

- **Cluster Monitoring**: View namespaces, environment variables (Nuon, Sandbox)
- **Deployments**: View Helm releases and their values
- **Log Viewer**: Browse environment variables with filtering and search
- **Resources**: View Kubernetes resources (Pods, Services, ConfigMaps, Secrets) by namespace

## Local Development

### Prerequisites

- Python 3.11+
- The Kitchen Sink API running on `http://localhost:8080`

### Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the UI (API must be running)
python app.py
```

Open http://localhost:5000 in your browser.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `API_URL` | `http://localhost:8080` | Base URL of the Kitchen Sink API |
| `PORT` | `5000` | Port to run the UI on |
| `FLASK_DEBUG` | `true` | Enable debug mode |

## Docker

```bash
# Build
docker build -t kitchen-sink-ui .

# Run (assuming API is available at host.docker.internal:8080)
docker run -p 5000:5000 -e API_URL=http://host.docker.internal:8080 kitchen-sink-ui
```

## Architecture

```
ui/
├── app.py              # Flask application with routes and API proxies
├── requirements.txt    # Python dependencies
├── Dockerfile          # Container image
├── static/
│   └── css/
│       └── styles.css  # Dark theme styling (K8s-inspired colors)
└── templates/
    ├── base.html       # Base template with sidebar navigation
    ├── cluster.html    # Cluster monitoring view
    ├── deployments.html # Helm releases view
    ├── logs.html       # Environment log viewer
    └── resources.html  # Kubernetes resources view
```

## Design

- Dark, terminal-inspired theme
- Monospace fonts (JetBrains Mono) for data display
- K8s color palette: blue, cyan, green, yellow, red
- Collapsible sidebar navigation
- Real-time data refresh (30 second interval)
