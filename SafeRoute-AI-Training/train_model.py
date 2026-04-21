import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression

DATA_CSV = "route_data.csv"

df = pd.read_csv(DATA_CSV)

feature_cols = [
    "harassment_count",
    "dark_area_count",
    "robbery_count",
    "other_count",
    "route_length_km"
]

X = df[feature_cols]
y = df["safe_label"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Model 1: Logistic
log_model = LogisticRegression(max_iter=1000)
log_model.fit(X_train, y_train)

# Model 2: Random Forest
rf_model = RandomForestClassifier(n_estimators=100)
rf_model.fit(X_train, y_train)

print("Logistic Accuracy:", log_model.score(X_test, y_test))
print("RandomForest Accuracy:", rf_model.score(X_test, y_test))

# Save models
joblib.dump(log_model, "log_model.pkl")
joblib.dump(rf_model, "rf_model.pkl")

print("Models saved!")