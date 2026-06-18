import os
import json
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from src.agents import run_evaluation

app = FastAPI(title="LabShield AI Security Dashboard")

# Ensure static files directory exists
try:
    os.makedirs("static", exist_ok=True)
except OSError:
    pass


class QueryRequest(BaseModel):
    message: str

def extract_analytics_json(chat_result):
    """
    Extracts the final JSON output from the AnalyticsAgent in the chat result history.
    """
    if not chat_result or not chat_result.chat_history:
        return None
    
    # Iterate backwards through chat history to find the AnalyticsAgent's response
    for msg in reversed(chat_result.chat_history):
        if msg.get("name") == "AnalyticsAgent":
            content = msg.get("content", "").strip()
            try:
                data = json.loads(content)
                return data
            except json.JSONDecodeError:
                try:
                    if "{" in content and "}" in content:
                        start = content.find("{")
                        end = content.rfind("}") + 1
                        return json.loads(content[start:end])
                except Exception:
                    pass
                return {"raw_output": content}
    return None

@app.post("/api/evaluate")
async def evaluate_query(payload: QueryRequest):
    user_input = payload.message.strip()
    if not user_input:
        raise HTTPException(status_code=400, detail="Empty query message.")
        
    api_key = os.getenv("OPENAI_API_KEY", "")
    is_placeholder = not api_key or "your_openai_api_key" in api_key
    
    if is_placeholder:
        # Mock responses for demonstration purposes when API key is a placeholder
        # Check if the user is asking for direct solution/code
        is_direct = any(word in user_input.lower() for word in ["code", "solution", "complete", "give me", "assembly", "lab"])
        
        if is_direct:
            steps = [
                {"sender": "UserProxy", "content": user_input},
                {"sender": "GuardAgent", "content": "BLOCKED: Direct request for complete assembly code solution or lab implementation."},
                {"sender": "HintAgent", "content": "Have you considered starting with writing down the register allocations and instructions one by one?"},
                {"sender": "AnalyticsAgent", "content": '{"integrity_score": 0, "direct_request": true}'}
            ]
            analytics = {"integrity_score": 0, "direct_request": True}
        else:
            steps = [
                {"sender": "UserProxy", "content": user_input},
                {"sender": "GuardAgent", "content": "SAFE"},
                {"sender": "HintAgent", "content": "No hint required."},
                {"sender": "AnalyticsAgent", "content": '{"integrity_score": 100, "direct_request": false}'}
            ]
            analytics = {"integrity_score": 100, "direct_request": False}
            
        return {
            "steps": steps,
            "analytics": analytics,
            "mocked": True
        }
        
    try:
        chat_result = run_evaluation(user_input)
        steps = []
        for msg in chat_result.chat_history:
            steps.append({
                "sender": msg.get("name", "System"),
                "content": msg.get("content", "").strip()
            })
            
        analytics = extract_analytics_json(chat_result)
        return {
            "steps": steps,
            "analytics": analytics,
            "mocked": False
        }
    except Exception as e:
        # Gracefully handle API errors (like insufficient_quota) and fall back to mock workflow
        print(f"[API ERROR] Autogen/OpenAI failed: {e}. Falling back to simulation mode.")
        
        is_direct = any(word in user_input.lower() for word in ["code", "solution", "complete", "give me", "assembly", "lab"])
        
        if is_direct:
            steps = [
                {"sender": "UserProxy", "content": user_input},
                {"sender": "GuardAgent", "content": "BLOCKED: Direct request for complete assembly code solution or lab implementation."},
                {"sender": "HintAgent", "content": "Have you considered starting with writing down the register allocations and instructions one by one?"},
                {"sender": "AnalyticsAgent", "content": '{"integrity_score": 0, "direct_request": true}'}
            ]
            analytics = {"integrity_score": 0, "direct_request": True}
        else:
            steps = [
                {"sender": "UserProxy", "content": user_input},
                {"sender": "GuardAgent", "content": "SAFE"},
                {"sender": "HintAgent", "content": "No hint required."},
                {"sender": "AnalyticsAgent", "content": '{"integrity_score": 100, "direct_request": false}'}
            ]
            analytics = {"integrity_score": 100, "direct_request": False}
            
        return {
            "steps": steps,
            "analytics": analytics,
            "mocked": True,
            "api_error": str(e)
        }

# Serve SPA
@app.get("/")
async def serve_index():
    return FileResponse("static/index.html")

# Mount static folder
app.mount("/", StaticFiles(directory="static"), name="static")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"Starting LabShield AI Web App on http://0.0.0.0:{port} ...")
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=False)
