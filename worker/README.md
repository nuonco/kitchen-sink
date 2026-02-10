# Kitchen Sink Worker

A no-op worker that logs periodically. Used for testing worker deployments.

## Run Locally

```bash
python main.py
```

## Docker

```bash
docker build -t kitchen-sink-worker .
docker run kitchen-sink-worker
```

## Output

Logs `"worker"` every 5 seconds in JSON format.
