import os
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def run_evaluation(user_message: str):
    """
    Runs the GroupChat to evaluate a user message.
    Agents are created here (lazily) so env vars are available at request time.
    """
    import autogen

    api_key = os.getenv("GROQ_API_KEY", "")
    model_name = "llama-3.3-70b-versatile"

    config_item = {
        "model": model_name,
        "api_key": api_key,
        "base_url": "https://api.groq.com/openai/v1",
    }

    llm_config = {
        "config_list": [config_item],
        "temperature": 0,
    }

    # Define agents fresh per request
    guard_agent = autogen.AssistantAgent(
        name="GuardAgent",
        system_message=(
            "You are the GuardAgent. Check if the user is requesting direct code, complete code snippets, or direct solutions to a task. "
            "If they are, you must block it by starting your response with 'BLOCKED: ' followed by a brief reason, and do not provide the code or solution. "
            "If the request is safe and does not ask for direct code or solutions, you can respond with 'SAFE'."
        ),
        llm_config=llm_config,
    )

    hint_agent = autogen.AssistantAgent(
        name="HintAgent",
        system_message=(
            "You are the HintAgent. If the GuardAgent blocked the request, your task is to analyze the blocked request "
            "and generate a single-sentence Socratic hint to guide the user to the solution without giving them the answer. "
            "If the GuardAgent determined the request is 'SAFE', you should simply output 'No hint required.'"
        ),
        llm_config=llm_config,
    )

    analytics_agent = autogen.AssistantAgent(
        name="AnalyticsAgent",
        system_message=(
            "You are the AnalyticsAgent. Analyze the user's input and the preceding agent responses. "
            "You must output only a raw JSON string of the exact format: "
            '{"integrity_score": <int>, "direct_request": <bool>} '
            "where integrity_score is an integer from 0 to 100 (0 meaning direct code request blocked, 100 meaning completely safe/learning request) "
            "and direct_request is true if the user asked for a direct solution or code, and false otherwise. "
            "Do not include markdown code block formatting (such as ```json) or any explanation or extra text. Output ONLY the raw JSON string."
        ),
        llm_config=llm_config,
    )

    user_proxy = autogen.UserProxyAgent(
        name="UserProxy",
        human_input_mode="NEVER",
        max_consecutive_auto_reply=4,
        is_termination_msg=lambda x: "integrity_score" in (x.get("content") or ""),
        code_execution_config=False,
    )

    # Create group chat
    groupchat = autogen.GroupChat(
        agents=[user_proxy, guard_agent, hint_agent, analytics_agent],
        messages=[],
        max_round=6,
        speaker_selection_method="round_robin",
    )

    manager = autogen.GroupChatManager(
        groupchat=groupchat,
        llm_config=llm_config,
    )

    # Initiate chat
    chat_result = user_proxy.initiate_chat(
        manager,
        message=user_message,
        clear_history=True,
    )
    return chat_result
