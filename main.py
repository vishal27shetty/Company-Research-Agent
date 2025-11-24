import json
import asyncio
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_core.messages import HumanMessage
from backend.graph import app as agent_app

app = FastAPI(title="Company Research Agent")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    thread_id: str

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    """
    SSE Endpoint that streams agent progress and final report.
    """
    async def event_generator():
        config = {"configurable": {"thread_id": request.thread_id}}
        
        # Check if we are resuming from an interrupt (i.e., user said "resolve" or "fix")
        # We need to see if the last state was interrupted at judge_node
        current_state = await agent_app.aget_state(config)
        
        inputs = None
        if current_state.next:
            # We are in an interrupted state.
            # If user message implies resolution, we update state to proceed to deep_dive_node
            # But wait, intake_node handles the intent "RESOLVE".
            # So we just pass the new message to intake_node?
            # No, if we are interrupted at judge_node, the next node is empty or we are halted.
            # Actually, we need to pass the new message to the graph.
            # The graph entry point is intake_node.
            # If we just invoke, it starts from intake_node.
            # intake_node will see "RESOLVE" and route to "deep_dive_node".
            # So we just pass the message as usual.
            inputs = {"messages": [HumanMessage(content=request.message)]}
        else:
            # New conversation or clean state
            inputs = {"messages": [HumanMessage(content=request.message)]}
        
        try:
            async for output in agent_app.astream(inputs, config=config):
                for node_name, state_update in output.items():
                    
                    # 1. Intake Node -> Hunter (Status Update)
                    if node_name == "intake_node":
                        intent = state_update.get("intent")
                        if intent == "RESEARCH":
                            yield f"data: {json.dumps({'type': 'status', 'content': 'Querying Perplexity for detailed analysis...'})}\n\n"
                        elif intent == "RESOLVE":
                             yield f"data: {json.dumps({'type': 'status', 'content': 'Resolving conflict with deep dive...'})}\n\n"
                        elif intent == "CLARIFY":
                            yield f"data: {json.dumps({'type': 'report', 'content': 'Could you please clarify which company you would like to research?'})}\n\n"
                    
                    # 2. Hunter Node -> Judge (Status Update)
                    elif node_name == "hunter_node":
                        citations = state_update.get("citations", [])
                        if citations:
                            yield f"data: {json.dumps({'type': 'citations', 'content': citations})}\n\n"
                        yield f"data: {json.dumps({'type': 'status', 'content': 'Analyzing consistency of gathered data...'})}\n\n"
                    
                    # 3. Judge Node -> Deep Dive or Drafter (Warning or Status)
                    elif node_name == "judge_node":
                        status = state_update.get("conflict_status")
                        reason = state_update.get("conflict_reason", "Unknown conflict")
                        
                        # Stream detailed conflict info
                        yield f"data: {json.dumps({'type': 'conflict', 'status': status, 'reason': reason})}\n\n"
                        
                        if status == "CONFLICT":
                            yield f"data: {json.dumps({'type': 'warning', 'content': f'⚠️ Conflict found: {reason}. Shall I resolve this with a deep dive?'})}\n\n"
                        else:
                            yield f"data: {json.dumps({'type': 'status', 'content': 'Data is clean. Drafting report sections...'})}\n\n"
                    
                    # 4. Deep Dive Node -> Drafter (Status Update)
                    elif node_name == "deep_dive_node":
                         yield f"data: {json.dumps({'type': 'status', 'content': 'Conflict resolved. Drafting report sections...'})}\n\n"

                    # 5. Compiler Node -> Final Report
                    elif node_name == "compiler_node":
                        report = state_update.get("final_report")
                        yield f"data: {json.dumps({'type': 'report', 'content': report})}\n\n"
                    
                    # 6. Chat Node -> Text Response
                    elif node_name == "chat_node":
                        messages = state_update.get("messages", [])
                        if messages:
                            content = messages[-1].content
                            import logging
                            logging.info(f"STREAMING CHAT RESPONSE: {content[:100]}")
                            yield f"data: {json.dumps({'type': 'text', 'content': content})}\n\n"
                        else:
                            import logging
                            logging.warning("Chat node returned no messages!")
                    
                    # 7. Updater Node -> Direct Answer
                    elif node_name == "updater_node":
                        yield f"data: {json.dumps({'type': 'status', 'content': 'Updating research with new information...'})}\n\n"
                        messages = state_update.get("messages", [])
                        if messages:
                            content = messages[-1].content
                            yield f"data: {json.dumps({'type': 'text', 'content': content})}\n\n"
                        
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
