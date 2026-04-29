#!/usr/bin/env python3
"""
Strategy analysis: logistic regression vs parameter optimization (conceptual split).

(A) CLASSIFY WINNING TRADES (this script)
    - Export one row per trade from TradingView (or your backtest) with features
      known at entry and a binary label: win=1 / loss=0.
    - Fit LogisticRegression with regularization; evaluate with time-ordered CV.
    - Use coefficients / probabilities only as hints for new filters—re-validate
      in Pine on a holdout period.

(B) OPTIMIZE NUMERIC STRATEGY PARAMETERS (not logistic regression)
    - Use TradingView Strategy Tester optimization, or grid/random search
      with walk-forward splits. Each "trial" is a full backtest, not a
      sklearn fit. See validate_holdout() pattern below for a simple
      train/test split workflow.

CSV export (from TradingView)
    - List of trades: Strategy Tester → list of trades → export if available,
      or copy manually. Add columns for indicators at entry by aligning bar
      timestamps in a spreadsheet or Pine `strategy()` trade comments.
    - Required columns:
        * target: default name `win` — 1 for win, 0 for loss (or set --target).
    - Feature columns: any numeric columns you add (ADX, RSI, ATR percentile,
      etc.). All non-feature columns should be excluded via --features or
      --exclude.

Example:
    python strategy_trade_logreg.py --csv example_trades_template.csv \\
        --features adx rsi atr_percentile --target win --n-splits 3
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression, LogisticRegressionCV
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    classification_report,
    roc_auc_score,
)
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Time-series–safe logistic regression on per-trade features (path A)."
    )
    p.add_argument(
        "--csv",
        type=Path,
        required=True,
        help="Path to CSV with one row per trade.",
    )
    p.add_argument(
        "--target",
        default="win",
        help="Binary target column (1=win, 0=loss).",
    )
    p.add_argument(
        "--features",
        nargs="*",
        default=None,
        help="Feature columns. If omitted, uses all numeric columns except target.",
    )
    p.add_argument(
        "--exclude",
        nargs="*",
        default=None,
        help="Columns to drop (e.g. trade_id entry_time).",
    )
    p.add_argument(
        "--test-size",
        type=float,
        default=0.25,
        help="Holdout fraction for final time-ordered split (path: validate).",
    )
    p.add_argument(
        "--n-splits",
        type=int,
        default=5,
        help="TimeSeriesSplit folds for cross-validation.",
    )
    p.add_argument(
        "--use-cv-model",
        action="store_true",
        help="Fit LogisticRegressionCV on training portion (L2 grid).",
    )
    return p.parse_args()


def load_frame(path: Path) -> pd.DataFrame:
    if not path.is_file():
        raise FileNotFoundError(path)
    return pd.read_csv(path)


def resolve_feature_columns(
    df: pd.DataFrame,
    target: str,
    features: list[str] | None,
    exclude: list[str] | None,
) -> list[str]:
    exclude = set(exclude or [])
    exclude.add(target)
    if features:
        missing = [c for c in features if c not in df.columns]
        if missing:
            raise ValueError(f"Missing feature columns: {missing}")
        return [c for c in features if c not in exclude]
    numeric = df.select_dtypes(include=[np.number]).columns.tolist()
    return [c for c in numeric if c not in exclude]


def build_pipeline(
    feature_names: list[str],
    use_cv: bool,
    ts_cv_splits: int = 3,
) -> Pipeline:
    """Pipeline: impute missing -> scale -> logistic regression (time-safe CV when requested)."""
    inner_cv = TimeSeriesSplit(n_splits=max(2, min(ts_cv_splits, 5)))
    if use_cv:
        clf = LogisticRegressionCV(
            Cs=np.logspace(-2, 2, 8),
            cv=inner_cv,
            solver="lbfgs",
            max_iter=2000,
            class_weight="balanced",
        )
    else:
        clf = LogisticRegression(
            C=1.0,
            solver="lbfgs",
            max_iter=2000,
            class_weight="balanced",
        )
    return Pipeline(
        [
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("clf", clf),
        ]
    )


def _get_classifier(model: Pipeline):
    return model.named_steps["clf"]


def fit_timeseries_cv(
    X: pd.DataFrame,
    y: np.ndarray,
    n_splits: int,
    use_cv_model: bool,
) -> tuple[None, dict[str, float]]:
    """Time-ordered k-fold; never shuffles rows."""
    tscv = TimeSeriesSplit(n_splits=n_splits)
    scores: list[float] = []
    aucs: list[float] = []

    for _fold, (train_idx, test_idx) in enumerate(tscv.split(X)):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]
        if len(np.unique(y_train)) < 2:
            continue
        model = build_pipeline(list(X.columns), use_cv_model, ts_cv_splits=3)
        model.fit(X_train, y_train)
        proba = model.predict_proba(X_test)[:, 1]
        pred = (proba >= 0.5).astype(int)
        scores.append(accuracy_score(y_test, pred))
        if len(np.unique(y_test)) > 1:
            aucs.append(roc_auc_score(y_test, proba))

    out: dict[str, float] = {}
    if scores:
        out["cv_accuracy_mean"] = float(np.mean(scores))
        out["cv_accuracy_std"] = float(np.std(scores))
    if aucs:
        out["cv_roc_auc_mean"] = float(np.mean(aucs))
    return None, out


def validate_holdout(
    X: pd.DataFrame,
    y: np.ndarray,
    test_size: float,
    use_cv_model: bool,
) -> tuple[Pipeline, dict[str, float]]:
    """Chronological holdout: last test_size fraction of rows is the test set."""
    n = len(X)
    n_test = max(1, int(n * test_size))
    train_idx = np.arange(0, n - n_test)
    test_idx = np.arange(n - n_test, n)
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

    model = build_pipeline(list(X.columns), use_cv_model, ts_cv_splits=3)
    model.fit(X_train, y_train)
    proba = model.predict_proba(X_test)[:, 1]
    pred = model.predict(X_test)

    metrics = {
        "holdout_accuracy": float(accuracy_score(y_test, pred)),
        "holdout_brier": float(brier_score_loss(y_test, proba)),
    }
    if len(np.unique(y_test)) > 1:
        metrics["holdout_roc_auc"] = float(roc_auc_score(y_test, proba))

    return model, metrics


def print_coefficients(model: Pipeline, feature_names: list[str]) -> None:
    clf = _get_classifier(model)
    coef = np.ravel(clf.coef_)
    intercept = float(clf.intercept_[0])
    print("\n--- Logistic coefficients (standardized features if Pipeline) ---")
    print(f"intercept: {intercept:.6f}")
    for name, c in sorted(zip(feature_names, coef), key=lambda x: -abs(x[1])):
        print(f"  {name}: {c:.6f}")


def main() -> int:
    args = parse_args()
    df = load_frame(args.csv)
    if args.target not in df.columns:
        print(f"Target column '{args.target}' not in CSV.", file=sys.stderr)
        return 1

    y = df[args.target].astype(int).values
    exclude = list(args.exclude or [])
    feat_cols = resolve_feature_columns(df, args.target, args.features, exclude)
    if not feat_cols:
        print("No feature columns resolved.", file=sys.stderr)
        return 1

    X = df[feat_cols].apply(pd.to_numeric, errors="coerce")

    _, cv_metrics = fit_timeseries_cv(
        X, y, n_splits=args.n_splits, use_cv_model=args.use_cv_model
    )
    print("--- TimeSeriesSplit (no shuffle) ---")
    for k, v in cv_metrics.items():
        print(f"  {k}: {v:.4f}")

    _holdout_model, hold_metrics = validate_holdout(
        X,
        y,
        test_size=args.test_size,
        use_cv_model=args.use_cv_model,
    )
    print("\n--- Chronological holdout (last segment) ---")
    for k, v in hold_metrics.items():
        print(f"  {k}: {v:.4f}")

    # Refit on full data for interpretable coefficients (optimistic; use for hints only)
    full_model = build_pipeline(feat_cols, args.use_cv_model, ts_cv_splits=3)
    full_model.fit(X, y)
    print_coefficients(full_model, feat_cols)
    y_hat = full_model.predict(X)
    proba = full_model.predict_proba(X)[:, 1]

    print("\n--- Full-sample fit (for inspection only; optimistic) ---")
    print(classification_report(y, y_hat, digits=3))

    print(
        "\nNote: path (B) parameter optimization is not logistic regression.",
        "Use TradingView optimizer or an outer loop over backtests with walk-forward.",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
