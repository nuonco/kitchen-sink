"""
Kitchen Sink Worker - Python Port

A no-op worker that just logs periodically.
Ported from mono/services/e2e/worker/main.go
"""

import time
import logging

logging.basicConfig(
    level=logging.INFO,
    format='{"level":"info","ts":%(created)f,"msg":"%(message)s"}'
)
logger = logging.getLogger(__name__)


def main():
    """Main worker loop - logs every 5 seconds."""
    logger.info("worker starting")
    
    while True:
        logger.info("worker")
        time.sleep(5)


if __name__ == "__main__":
    main()
