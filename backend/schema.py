from typing import List, Dict, Annotated, Optional
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage, AnyMessage # Assuming AnyMessage is from here
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field # Added for IntakeDecision

class IntakeDecision(BaseModel):
    intent: str = Field(description="One of: RESEARCH, UPDATE, RESOLVE, CHAT, CLARIFY")
    company_name: str = Field(description="Extracted company name for RESEARCH/UPDATE/RESOLVE", default="")
    research_type: str = Field(description="Type of research: 'full' (default) or 'targeted'", default="full")
    research_focus: str = Field(description="Specific topic for targeted research (e.g., 'market size', 'competitors')", default="")
    user_feedback: str = Field(description="Extracted feedback/instructions for UPDATE", default="")
    needs_clarification: bool = Field(description="True if the request is vague", default=False)
    clarification_question: str = Field(description="Question to ask if clarification is needed", default="")

class AgentState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    intent: str  # RESEARCH, UPDATE, RESOLVE, CHAT, CLARIFY
    company_name: str
    research_type: str # 'full' or 'targeted'
    research_focus: str # Specific topic if targeted
    user_feedback: str
    raw_perplexity_data: List[str]
    raw_tavily_data: List[str]
    citations: List[str]
    conflict_status: str  # "CLEAN" or "CONFLICT"
    conflict_reason: str
    artifacts: Dict[str, str]  # "financial", "leadership", etc.
    final_report: str
    industry: str
    hq_location: str
