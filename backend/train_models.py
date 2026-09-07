"""Train ML models on Operation Mumbai synthetic data."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
os.environ.setdefault("PYTHONPATH", ".")

import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(message)s")

from app.database import neo4j_connection as neo
from app.ml_models.risk_scorer import get_risk_scorer

logger = logging.getLogger("train_models")

def train_risk_model():
    scorer = get_risk_scorer()
    rows = neo.run_query("MATCH (p:Person) RETURN properties(p) AS props LIMIT 500")
    X, y = [], []
    for row in rows:
        props = row["props"]
        features = scorer.extract_features(props)
        X.append(features)
        y.append(float(props.get("risk_score", 50) or 50) / 100.0)
    if X:
        scorer.train_xgboost(X, y)
        logger.info("XGBoost trained on %d samples", len(X))
    else:
        logger.warning("No person data found in Neo4j")

def train_anomaly_model():
    try:
        from sklearn.ensemble import IsolationForest
        import pickle
        from pathlib import Path

        rows = neo.run_query("""
            MATCH (a:Account)-[t:TRANSFERRED_TO]->(b:Account)
            RETURN t.amount AS amount, t.frequency AS frequency,
                   t.is_suspicious AS suspicious
            LIMIT 1000
        """)
        if not rows:
            logger.warning("No transaction data for anomaly model")
            return

        features = []
        for r in rows:
            amt = float(r.get("amount", 0) or 0)
            freq = float(r.get("frequency", 1) or 1)
            features.append([amt, freq, amt / max(freq, 1)])

        model = IsolationForest(n_estimators=100, contamination=0.15, random_state=42)
        model.fit(features)

        model_path = Path("data/models/anomaly_iforest.pkl")
        model_path.parent.mkdir(parents=True, exist_ok=True)
        with open(model_path, "wb") as f:
            pickle.dump(model, f)
        logger.info("IsolationForest trained on %d transactions, saved to %s", len(features), model_path)
    except Exception as exc:
        logger.warning("Anomaly model training failed: %s", exc)

if __name__ == "__main__":
    train_risk_model()
    train_anomaly_model()
    print("[OK] All ML models trained successfully")
