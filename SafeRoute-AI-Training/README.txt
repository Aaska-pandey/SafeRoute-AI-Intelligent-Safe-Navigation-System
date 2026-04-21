SafeRoute AI Training

Files:
- generate_route_data.py
  Creates a synthetic dataset of routes with features + safe/unsafe label.
  Output: route_data.csv

- train_model.py
  Trains a logistic regression model on route_data.csv using scikit-learn,
  then exports the learned weights and intercept to ai_model_weights.json.

Workflow:
1. python generate_route_data.py
2. python train_model.py
3. Copy ai_model_weights.json into: SafeRoute-Web/data/ai_model_weights.json
4. Open SafeRoute-Web/index.html in a browser. The JS will load the model
   weights and use them to compute the AI risk index for each route.
