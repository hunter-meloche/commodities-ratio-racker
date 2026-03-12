#!/usr/bin/env python3
"""
Metals-Ratio Tracker Pipeline
Fetches historical index and precious metals data, calculates price ratios,
detects anomalies via Z-score and IsolationForest, and outputs data.json.
"""

import json
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.ensemble import IsolationForest

warnings.filterwarnings("ignore")

OUTPUT_PATH = Path(__file__).parent.parent / "frontend" / "public" / "data.json"

TICKERS = {
    "^GSPC": "S&P 500",
    "^IXIC": "Nasdaq",
    "GC=F": "Gold",
    "SI=F": "Silver",
}

PAIRS = [
    {
        "id": "sp500_gold",
        "name": "S&P 500 / Gold (oz)",
        "index_key": "^GSPC",
        "metal_key": "GC=F",
    },
    {
        "id": "sp500_silver",
        "name": "S&P 500 / Silver (oz)",
        "index_key": "^GSPC",
        "metal_key": "SI=F",
    },
    {
        "id": "nasdaq_gold",
        "name": "Nasdaq / Gold (oz)",
        "index_key": "^IXIC",
        "metal_key": "GC=F",
    },
    {
        "id": "nasdaq_silver",
        "name": "Nasdaq / Silver (oz)",
        "index_key": "^IXIC",
        "metal_key": "SI=F",
    },
]

ROLLING_WINDOW = 252
ANOMALY_THRESHOLD = 2.0
CONTAMINATION = 0.05


def safe_round(val, decimals=4):
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    return round(float(val), decimals)


def fetch_ticker(ticker: str) -> pd.Series | None:
    """Download max history for a ticker, return Close price series."""
    print(f"  Fetching {ticker} ({TICKERS.get(ticker, ticker)})...")
    try:
        df = yf.download(ticker, period="max", auto_adjust=True, progress=False)
        if df.empty:
            print(f"  WARNING: No data returned for {ticker}")
            return None

        # Handle multi-level columns (yfinance >= 0.2.x returns MultiIndex)
        if isinstance(df.columns, pd.MultiIndex):
            close = df["Close"].squeeze()
        else:
            close = df["Close"]

        # Ensure it's a Series
        if isinstance(close, pd.DataFrame):
            close = close.iloc[:, 0]

        close = close.dropna()
        print(f"  OK: {ticker} — {len(close)} rows, {close.index[0].date()} to {close.index[-1].date()}")
        return close
    except Exception as e:
        print(f"  ERROR fetching {ticker}: {e}")
        return None


def compute_ratio_stats(ratio: pd.Series, window: int = ROLLING_WINDOW):
    """Compute rolling mean, std, z-score, and anomaly flags."""
    mean = ratio.rolling(window).mean()
    std = ratio.rolling(window).std()
    z_score = (ratio - mean) / std

    is_anomaly = z_score.abs() > ANOMALY_THRESHOLD
    direction = pd.Series(index=ratio.index, dtype=object)
    direction[z_score > ANOMALY_THRESHOLD] = "metals_undervalued"
    direction[z_score < -ANOMALY_THRESHOLD] = "metals_overvalued"

    upper_band = mean + ANOMALY_THRESHOLD * std
    lower_band = mean - ANOMALY_THRESHOLD * std

    return {
        "mean": mean,
        "std": std,
        "z_score": z_score,
        "is_anomaly": is_anomaly,
        "direction": direction,
        "upper_band": upper_band,
        "lower_band": lower_band,
    }


def get_signal(direction: str | None) -> str | None:
    if direction == "metals_undervalued":
        return "revert_to_metals"
    if direction == "metals_overvalued":
        return "revert_to_equities"
    return None


def main():
    print("=== Metals-Ratio Tracker Pipeline ===\n")

    # --- 1. Fetch all tickers ---
    print("Step 1: Fetching price data...")
    raw = {}
    for ticker in TICKERS:
        series = fetch_ticker(ticker)
        if series is not None:
            raw[ticker] = series

    if len(raw) < 4:
        missing = [t for t in TICKERS if t not in raw]
        print(f"\nERROR: Could not fetch data for: {missing}")
        sys.exit(1)

    # --- 2. Align dates (inner join) ---
    print("\nStep 2: Aligning dates across all series...")
    combined = pd.DataFrame(raw).dropna()
    print(f"  Aligned date range: {combined.index[0].date()} to {combined.index[-1].date()}")
    print(f"  Total trading days: {len(combined)}")

    # --- 3. Compute ratios ---
    print("\nStep 3: Calculating ratios...")
    ratio_cols = {}
    for pair in PAIRS:
        ratio = combined[pair["index_key"]] / combined[pair["metal_key"]]
        ratio_cols[pair["id"]] = ratio
        current_val = ratio.iloc[-1]
        print(f"  {pair['name']}: current ratio = {current_val:.4f}")

    ratio_df = pd.DataFrame(ratio_cols)

    # --- 4. Statistical analysis per pair ---
    print("\nStep 4: Computing rolling stats and Z-scores...")
    stats_per_pair = {}
    for pair in PAIRS:
        pid = pair["id"]
        stats = compute_ratio_stats(ratio_df[pid])
        stats_per_pair[pid] = stats
        latest_z = stats["z_score"].dropna().iloc[-1] if not stats["z_score"].dropna().empty else None
        print(f"  {pair['name']}: Z-score = {latest_z:.4f if latest_z else 'N/A'}")

    # --- 5. IsolationForest on all ratios combined ---
    print("\nStep 5: Training IsolationForest...")
    # Use only rows with valid rolling stats (after warmup)
    valid_mask = ratio_df.notna().all(axis=1)
    # Also need warmup period
    warmup_mask = pd.Series(True, index=ratio_df.index)
    for pid in ratio_cols:
        warmup_mask = warmup_mask & stats_per_pair[pid]["mean"].notna()

    valid_idx = ratio_df[warmup_mask].index
    ratio_valid = ratio_df.loc[valid_idx]

    clf = IsolationForest(contamination=CONTAMINATION, random_state=42)
    if_labels = clf.fit_predict(ratio_valid)  # -1 = anomaly, 1 = normal
    if_anomaly = pd.Series(if_labels == -1, index=valid_idx)

    # Reindex to full date range, fill False for warmup period
    if_anomaly_full = if_anomaly.reindex(ratio_df.index, fill_value=False)

    print(f"  IsolationForest flagged {if_anomaly.sum()} anomalous trading days out of {len(if_anomaly)}")

    # --- 6. Build output JSON ---
    print("\nStep 6: Building output JSON...")

    pairs_output = []
    alerts = []

    for pair in PAIRS:
        pid = pair["id"]
        stats = stats_per_pair[pid]
        ratio_series = ratio_df[pid]

        # Filter to rows with valid rolling stats
        valid_rows_mask = stats["mean"].notna()
        ts_dates = ratio_series[valid_rows_mask].index

        timeseries = []
        for date in ts_dates:
            row_z = stats["z_score"][date]
            row_dir = stats["direction"][date]
            row_if = bool(if_anomaly_full[date]) if date in if_anomaly_full.index else False

            timeseries.append({
                "date": date.strftime("%Y-%m-%d"),
                "ratio": safe_round(ratio_series[date]),
                "mean": safe_round(stats["mean"][date]),
                "upper_band": safe_round(stats["upper_band"][date]),
                "lower_band": safe_round(stats["lower_band"][date]),
                "z_score": safe_round(row_z),
                "is_anomaly": bool(abs(row_z) > ANOMALY_THRESHOLD) if not np.isnan(row_z) else False,
                "if_anomaly": row_if,
            })

        # Current (most recent valid row)
        latest_date = ts_dates[-1]
        latest_ratio = ratio_series[latest_date]
        latest_z = stats["z_score"][latest_date]
        latest_mean = stats["mean"][latest_date]
        latest_upper = stats["upper_band"][latest_date]
        latest_lower = stats["lower_band"][latest_date]
        latest_dir = stats["direction"][latest_date] if pd.notna(stats["direction"][latest_date]) else None
        latest_if = bool(if_anomaly_full[latest_date]) if latest_date in if_anomaly_full.index else False
        latest_is_anomaly = bool(abs(latest_z) > ANOMALY_THRESHOLD) if not np.isnan(latest_z) else False
        latest_signal = get_signal(latest_dir)

        current = {
            "ratio": safe_round(latest_ratio),
            "z_score": safe_round(latest_z),
            "mean": safe_round(latest_mean),
            "upper_band": safe_round(latest_upper),
            "lower_band": safe_round(latest_lower),
            "is_anomaly": latest_is_anomaly,
            "if_anomaly": latest_if,
            "direction": latest_dir,
            "signal": latest_signal,
        }

        date_range = {
            "start": ts_dates[0].strftime("%Y-%m-%d"),
            "end": ts_dates[-1].strftime("%Y-%m-%d"),
        }

        pairs_output.append({
            "id": pid,
            "name": pair["name"],
            "index_symbol": pair["index_key"],
            "metal_symbol": pair["metal_key"],
            "date_range": date_range,
            "current": current,
            "timeseries": timeseries,
        })

        # Build alert if anomalous
        if latest_is_anomaly:
            dir_label = latest_dir or "unknown"
            z_val = safe_round(latest_z)
            if latest_dir == "metals_undervalued":
                msg = f"{pair['name']} ratio is {z_val:.2f}σ above historical mean — metals appear undervalued vs equities"
            else:
                msg = f"{pair['name']} ratio is {abs(z_val):.2f}σ below historical mean — metals appear overvalued vs equities"

            alerts.append({
                "pair_id": pid,
                "pair_name": pair["name"],
                "z_score": z_val,
                "direction": latest_dir,
                "signal": latest_signal,
                "message": msg,
            })

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "pairs": pairs_output,
        "alerts": alerts,
    }

    # --- 7. Write output ---
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2, default=str)

    print(f"\nOutput written to: {OUTPUT_PATH}")
    print(f"Total pairs: {len(pairs_output)}")
    print(f"Active alerts: {len(alerts)}")
    if alerts:
        for alert in alerts:
            print(f"  ALERT: {alert['message']}")
    print("\nDone!")


if __name__ == "__main__":
    main()
