from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from backend.schema import AgentState
from backend.nodes import (
    intake_node,
    hunter_node,
    judge_node,
    deep_dive_node,
    drafter_node,
    compiler_node,
    chat_node,
    updater_node
)
import logging

# Configure logging
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------
# ROUTING LOGIC
# ------------------------------------------------------------------
def route_intake(state: AgentState):
    intent = state["intent"]
    logger.info(f"Routing Intake: Intent={intent}")
    
    if intent == "RESEARCH":
        return "hunter_node"
    elif intent == "RESOLVE":
        return "deep_dive_node"  # <--- The "Yes, fix it" path
    elif intent == "CHAT" or intent == "CLARIFY":
        return "chat_node"
    elif intent == "UPDATE":
        return "updater_node"  # <--- The Surgical Update path
    return END

def route_judge(state: AgentState):
    status = state["conflict_status"]
    logger.info(f"Routing Judge: Status={status}")
    
    if status == "CONFLICT":
        # We STOP here and return to the user.
        # The user sees "Conflict Detected" and must say "Resolve" to trigger deep_dive_node.
        # Alternatively, you can auto-route to deep_dive_node if you don't want human confirmation.
        # Based on your "Yes, resolve it" flow, we return END to wait for user input.
        return END 
    else:
        return "drafter_node"

# ------------------------------------------------------------------
# GRAPH DEFINITION
# ------------------------------------------------------------------
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("intake_node", intake_node)
workflow.add_node("hunter_node", hunter_node)
workflow.add_node("judge_node", judge_node)
workflow.add_node("deep_dive_node", deep_dive_node)
workflow.add_node("drafter_node", drafter_node)
workflow.add_node("compiler_node", compiler_node)
workflow.add_node("chat_node", chat_node)
workflow.add_node("updater_node", updater_node)

# Set entry point
workflow.set_entry_point("intake_node")

# ------------------------------------------------------------------
# EDGES
# ------------------------------------------------------------------

# 1. From Intake
workflow.add_conditional_edges(
    "intake_node",
    route_intake,
    {
        "hunter_node": "hunter_node",
        "deep_dive_node": "deep_dive_node",
        "chat_node": "chat_node",
        "updater_node": "updater_node",
        END: END
    }
)

# 2. Research Flow
workflow.add_edge("hunter_node", "judge_node")

# 3. Judge Flow
workflow.add_conditional_edges(
    "judge_node",
    route_judge,
    {
        END: END,  # Wait for user to say "Resolve"
        "drafter_node": "drafter_node"
    }
)

# 4. Conflict Resolution Flow
# After deep dive, we proceed to DRAFTING (Assume conflict resolved by new data)
workflow.add_edge("deep_dive_node", "drafter_node")

# 5. Drafting Flow
workflow.add_edge("drafter_node", "compiler_node")
workflow.add_edge("compiler_node", END)

# 6. Chat Flow
workflow.add_edge("chat_node", END)

# 7. Surgical Update Flow
# UPDATER goes to END because it modifies the final_report directly (Append-Only)
workflow.add_edge("updater_node", END)

# Compile the graph with checkpointer
memory = MemorySaver()
app = workflow.compile(checkpointer=memory)
