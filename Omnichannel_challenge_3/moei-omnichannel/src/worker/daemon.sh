#!/bin/bash
cd "$(dirname "$0")"
while true; do
  echo "[$(date)] Starting worker..." >> /tmp/worker-daemon.log
  bun index.ts >> /tmp/worker.log 2>&1
  EXIT_CODE=$?
  echo "[$(date)] Worker exited with code $EXIT_CODE, restarting in 3s..." >> /tmp/worker-daemon.log
  sleep 3
done
