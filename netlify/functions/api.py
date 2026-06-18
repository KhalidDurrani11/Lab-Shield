import os
import sys
import json

try:
    root_dir = os.environ.get("LAMBDA_TASK_ROOT", os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    sys.path.insert(0, root_dir)

    from mangum import Mangum
    from app import app

    handler = Mangum(app, api_gateway_base_path="/.netlify/functions/api")
except Exception as e:
    import traceback
    error_msg = traceback.format_exc()
    def handler(event, context):
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Failed to initialize function", "traceback": error_msg})
        }

