#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "Installing Python dependencies..."
pip install -r requirements.txt -q
echo "Running analysis pipeline..."
python fetch_and_analyze.py
