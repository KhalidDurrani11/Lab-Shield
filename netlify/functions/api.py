import os
import sys

# Add the project root to the python path so it can find app.py and src
root_dir = os.environ.get("LAMBDA_TASK_ROOT", os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.insert(0, root_dir)

from mangum import Mangum
from app import app

# Wrap the FastAPI app with Mangum for AWS Lambda / Netlify Functions
handler = Mangum(app, api_gateway_base_path="/.netlify/functions/api")
