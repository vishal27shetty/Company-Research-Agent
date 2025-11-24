import os
import json
import asyncio
from dotenv import load_dotenv
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

from typing import Dict, Any, List
from pydantic import BaseModel, Field
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from backend.schema import AgentState
from backend.utils import search_perplexity, search_tavily
from backend.prompts import (
    INTAKE_SYSTEM_PROMPT,
    JUDGE_PROMPT,
    COMPANY_BRIEFING_PROMPT,
    INDUSTRY_BRIEFING_PROMPT,
    FINANCIAL_BRIEFING_PROMPT,
    NEWS_BRIEFING_PROMPT,
    COMPILE_CONTENT_PROMPT,
    COMPANY_ANALYZER_QUERY_PROMPT,
    FINANCIAL_ANALYZER_QUERY_PROMPT,
    INDUSTRY_ANALYZER_QUERY_PROMPT,
    NEWS_SCANNER_QUERY_PROMPT,
    TARGETED_RESEARCH_QUERY_PROMPT,
    QUERY_FORMAT_GUIDELINES
)
import langchain
try:
    langchain.verbose = False
except AttributeError:
    pass

from google import genai
from google.genai import types

# Initialize LLM (Use 1.5 Pro for better instruction following)
llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0,
    google_api_key=os.getenv("GOOGLE_API_KEY")
)

# Initialize Gemini 3.0 Client
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

# ============================================================================
# NODE 1: INTAKE (ROUTER)
# ============================================================================
class IntakeDecision(BaseModel):
    intent: str = Field(..., description="The user's intent: RESEARCH, CHAT, UPDATE, or RESOLVE")
    company_name: str | None = Field(None, description="The company name if present")
    research_type: str = Field("full", description="Type of research: 'full' for comprehensive, 'targeted' for specific.")
    research_focus: str | None = Field(None, description="Specific area of focus if research_type is 'targeted'.")
    user_feedback: str | None = Field(None, description="Any specific feedback or constraints from the user.")
    reasoning: str = Field(..., description="Reasoning for the classification")

async def intake_node(state: AgentState):
    """
    Analyzes user input to determine intent, company name, and research type.
    """
    print("\n--- INTAKE NODE ---")
    user_input = state["messages"][-1].content
    logger.info(f"User Input: {user_input}")

    # Use the structured output model
    structured_llm = llm.with_structured_output(IntakeDecision)
    
    # Create the prompt with history awareness
    # We pass the last few messages to help with context (e.g., "it" references)
    history = state.get("messages", [])[-5:] 
    
    # Check if we have a report or artifacts to provide context
    has_context = bool(state.get("final_report") or state.get("artifacts"))
    context_status = f"Report available for {state.get('company_name')}" if has_context else "No report available yet."
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", INTAKE_SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="messages"),
    ])
    
    chain = prompt | structured_llm
    result = await chain.ainvoke({
        "messages": history,
        "context_status": context_status
    })

    logger.info(f"Intent Detected: {result.intent}")
    if result.company_name:
        logger.info(f"Company Name: {result.company_name}")
    if result.research_type == "targeted":
        logger.info(f"Targeted Research: {result.research_focus}")

    # FIX: If intent is RESEARCH but no company name, force CHAT/CLARIFY to ask for it
    if result.intent == "RESEARCH" and not result.company_name and not state.get("company_name"):
        logger.info("Research intent detected but no company name. Overriding to CHAT to ask for clarification.")
        result.intent = "CHAT"

    return {
        "intent": result.intent,
        "company_name": result.company_name or state.get("company_name"), # Persist company name if already known
        "research_type": result.research_type,
        "research_focus": result.research_focus,
        "user_feedback": result.user_feedback,
        # If needs_clarification is True, we might want to handle that, 
        # but for now we'll rely on CLARIFY intent.
    }

# ============================================================================
# NODE 2: HUNTER (PERPLEXITY RESEARCHER)
# ============================================================================
async def hunter_node(state: AgentState):
    """
    Generates and executes Perplexity searches based on the company and research focus.
    """
    logger.info("--- HUNTER NODE ---")
    company = state["company_name"]
    research_focus = state["research_focus"]
    
    # 1. Generate Queries
    
    # Check if this is a targeted research run
    research_type = state.get("research_type", "full")
    
    if research_type == "targeted" and research_focus:
        logger.info(f"Generating TARGETED queries for: {research_focus}")
        prompt = ChatPromptTemplate.from_messages([
            ("system", TARGETED_RESEARCH_QUERY_PROMPT + "\n" + QUERY_FORMAT_GUIDELINES),
            ("user", "Generate queries.")
        ])
        chain = prompt | llm
        response = await chain.ainvoke({"company": company, "research_focus": research_focus})
        
        try:
            content = response.content.replace("```json", "").replace("```", "").strip()
            queries_json = json.loads(content)
            selected_queries = queries_json.get("queries", [])
        except json.JSONDecodeError:
            logger.error(f"Failed to decode queries for targeted research. Response: {response.content}")
            # Fallback to simple queries based on focus
            selected_queries = [f"{company} {research_focus}", f"{company} {research_focus} details"]
            
    else:
        # Full Research Flow
        query_generation_prompts = {
            "company": COMPANY_ANALYZER_QUERY_PROMPT,
            "financial": FINANCIAL_ANALYZER_QUERY_PROMPT,
            "industry": INDUSTRY_ANALYZER_QUERY_PROMPT,
            "news": NEWS_SCANNER_QUERY_PROMPT,
        }

        async def generate_queries_for_category(category_prompt):
            # Determine if the prompt needs 'industry'
            input_vars = {"company": company, "research_focus": research_focus}
            if "{industry}" in category_prompt:
                 input_vars["industry"] = "Technology" # Default or extracted industry

            prompt = ChatPromptTemplate.from_messages([
                ("system", category_prompt + "\n" + QUERY_FORMAT_GUIDELINES),
                ("user", f"Generate queries for {company} focusing on {research_focus if research_focus else 'general overview'}."),
            ])
            chain = prompt | llm
            response = await chain.ainvoke(input_vars)
            # Assuming the LLM returns a JSON string with a "queries" key
            try:
                content = response.content.replace("```json", "").replace("```", "").strip()
                queries_json = json.loads(content)
                return queries_json.get("queries", [])
            except json.JSONDecodeError:
                logger.error(f"Failed to decode queries for category. Response: {response.content}")
                return []

        query_lists = await asyncio.gather(*[
            generate_queries_for_category(p) for p in query_generation_prompts.values()
        ])

        # Flatten and select queries
        all_queries = [q for sublist in query_lists for q in sublist]
        
        # Limit to reasonable number to avoid rate limits or excessive noise, e.g., top 2 from each category = 8 total
        selected_queries = []
        for q_list in query_lists:
            selected_queries.extend(q_list[:2]) # Take top 2 from each category
            
        # If no specific focus, ensure we have a general set of queries
        if not selected_queries and all_queries:
            selected_queries = all_queries[:8] # Fallback to top 8 overall if category selection yields nothing

    if not selected_queries:
        selected_queries = [f"{company} overview", f"{company} recent news"] # Absolute fallback

    logger.info(f"Generated {len(selected_queries)} queries: {selected_queries}")
    
    # 2. Execute Perplexity Searches
    async def perplexity_search(query):
        try:
            return await search_perplexity(query)
        except Exception as e:
            logger.error(f"Error during Perplexity search for query '{query}': {e}")
            return None # Return None or an empty dict to handle gracefully

    search_results = await asyncio.gather(*[perplexity_search(q) for q in selected_queries])
    
    contents = []
    citations = []
    for res in search_results:
        if res: # Only process successful results
            contents.append(res["content"])
            citations.extend(res["citations"])
    
    citations = list(set(citations)) # Deduplicate

    logger.info(f"Performed {len(selected_queries)} searches on Perplexity.")
    return {
        "raw_perplexity_data": contents,
        "citations": citations,
        "messages": [SystemMessage(content=f"Performed {len(selected_queries)} searches on Perplexity.")]
    }

# ============================================================================
# NODE 3: JUDGE (ADVERSARIAL CRITIC - GEMINI 3.0)
# ============================================================================
async def judge_node(state: AgentState):
    """
    Analyzes Perplexity results for conflicts using Gemini.
    """
    logger.info("--- JUDGE NODE ---")
    raw_data = "\n\n".join(state["raw_perplexity_data"])
    company = state["company_name"]
    logger.info(f"Analyzing data for {company} for conflicts.")
    
    # Define schema for Gemini 3.0
    judge_schema = {
        "type": "object",
        "properties": {
            "status": {"type": "string", "enum": ["CONFLICT", "CLEAN"]},
            "reason": {"type": "string"},
            "tie_breaker_query": {"type": "string"}
        },
        "required": ["status", "reason"]
    }

    try:
        # Call Gemini 3.0
        response = client.models.generate_content(
            model="gemini-3-pro-preview",
            contents=f"System: {JUDGE_PROMPT}\n\nUser: Here is the research data:\n\n{raw_data}",
            config={
                "response_mime_type": "application/json",
                "response_json_schema": judge_schema,
                # "thinking_level": "high" # Default is high
            }
        )
        
        result = json.loads(response.text)
        logger.info(f"Judge Status: {result['status']} - Reason: {result['reason']}")
        
        return {
            "conflict_status": result["status"],
            "conflict_reason": result["reason"],
            # Store tie_breaker_query in state if we want to use it in deep_dive_node
            # For now, deep_dive_node generates its own, but we could pass it.
            # We'll stick to the existing flow but maybe use the reason more effectively.
            "messages": [SystemMessage(content=f"Judge Status: {result['status']}\nReason: {result['reason']}")]
        }
    except Exception as e:
        # Fallback or error handling
        logger.error(f"Error in Judge Node: {e}")
        return {
            "conflict_status": "CLEAN", # Default to clean on error to proceed
            "conflict_reason": "Error in judge node, proceeding as clean.",
            "messages": [SystemMessage(content=f"Judge Node Error: {str(e)}")]
        }

# ============================================================================
# NODE 4: DEEP DIVE (FORENSIC INVESTIGATOR) - FIXED TAVILY QUERY
# ============================================================================
class DeepDiveQuery(BaseModel):
    query: str = Field(..., description="A concise, keyword-optimized search query. No conversational text.")

async def deep_dive_node(state: AgentState):
    """
    Executes deep dive using Tavily. FIXED: Strict query generation.
    """
    logger.info("--- DEEP DIVE NODE ---")
    company = state["company_name"]
    conflict_reason = state["conflict_reason"]
    reason = state.get("conflict_reason", "Verification needed")
    logger.info(f"Deep Dive Reason: {reason}")
    
    # FIX: Use Structured Output to ensure Tavily gets a clean string
    prompt = f"Conflict: {reason} for company {company}. Generate ONE clean search query to resolve this via official sources."
    structured_llm = llm.with_structured_output(DeepDiveQuery)
    query_obj = await structured_llm.ainvoke(prompt)
    
    logger.info(f"Deep Dive Query: {query_obj.query}")
    
    tavily_results = await search_tavily(query_obj.query)
    logger.info("Performed deep dive search with Tavily.")
    
    # Append to existing data so Drafter sees it
    new_data = state["raw_perplexity_data"] + [f"DEEP DIVE EVIDENCE:\n{tavily_results}"]
    
    return {
        "raw_perplexity_data": new_data,
        "messages": [SystemMessage(content="Performed deep dive search with Tavily.")]
    }

# ============================================================================
# NODE 5: DRAFTER (WRITER)
# ============================================================================
async def drafter_node(state: AgentState):
    """
    Generates the briefing artifacts.
    """
    logger.info("--- DRAFTER NODE ---")
    company = state["company_name"]
    research_type = state.get("research_type", "full")
    research_focus = state.get("research_focus", "")
    
    # Gather all data
    perplexity_data = "\n\n".join(state.get("raw_perplexity_data", []))
    tavily_data = "\n\n".join(state.get("raw_tavily_data", []))
    all_data = f"Perplexity Data:\n{perplexity_data}\n\nTavily Data:\n{tavily_data}"
    
    artifacts = {}

    if research_type == "targeted":
        logger.info(f"Drafting TARGETED response for: {research_focus}")
        
        prompt = f"""
        You are a Research Analyst. The user asked for specific information about '{company}'.
        Focus: {research_focus}
        
        Data:
        {all_data}
        
        Task:
        Write a detailed, comprehensive answer to the user's specific question based on the data.
        Do NOT write a full report. Write a focused response.
        Use bullet points where appropriate.
        """
        
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        artifacts["targeted_response"] = response.content
        logger.info("Generated targeted response.")

    else:
        # Full Research Flow
        logger.info(f"Drafting artifacts for {company}")
        
        # 1. Extract Metadata (Industry, HQ, etc.)
        # ... (Existing metadata extraction logic)
        
        # 2. Draft Sections
        section_prompts = {
            "company": COMPANY_BRIEFING_PROMPT,
            "financial": FINANCIAL_BRIEFING_PROMPT,
            "industry": INDUSTRY_BRIEFING_PROMPT,
            "news": NEWS_BRIEFING_PROMPT
        }
        
        # Helper for parallel drafting
        # Since we are replacing the whole function, we need to rewrite the full logic
        # Let's use the existing logic but wrapped in the else block
        
        # Re-implementing the full logic briefly for the replacement:
        # 1. Metadata
        meta_prompt = f"Extract the Industry and HQ Location of {company} from the data below. Return JSON {{'industry': '...', 'hq_location': '...'}}\n\nData:\n{all_data[:5000]}"
        try:
            meta_llm = llm | JsonOutputParser()
            meta_data = await meta_llm.ainvoke(meta_prompt)
            # Handle list/dict return types safely
            if isinstance(meta_data, list): meta_data = meta_data[0]
            industry = meta_data.get("industry", "Technology")
            hq_location = meta_data.get("hq_location", "Unknown")
            logger.info(f"Extracted metadata: Industry={industry}, HQ={hq_location}")
        except:
            industry = "Technology"
            hq_location = "Unknown"
            
        async def generate_section(key, prompt_tmpl):
            p = prompt_tmpl.format(company=company, industry=industry, hq_location=hq_location)
            msg = await llm.ainvoke([
                SystemMessage(content="You are a senior analyst. Write a briefing based on the provided data."),
                HumanMessage(content=f"Data:\n{all_data}\n\nTask:\n{p}")
            ])
            return key, msg.content

        tasks = [generate_section(k, v) for k, v in section_prompts.items()]
        results = await asyncio.gather(*tasks)
        
        for key, content in results:
            artifacts[key] = content
            logger.info(f"Generated {key} artifact.")
            
        logger.info("Drafted all briefing sections.")

    return {"artifacts": artifacts}

# ============================================================================
# NODE 6: COMPILER (PUBLISHER)
# ============================================================================
async def compiler_node(state: AgentState):
    """
    Compiles the final report.
    Handles 'targeted' research by returning just the targeted response.
    """
    logger.info("--- COMPILER NODE ---")
    company = state["company_name"]
    artifacts = state["artifacts"]
    research_type = state.get("research_type", "full")

    # Handle Targeted Research
    if research_type == "targeted":
        logger.info("Compiling TARGETED report.")
        targeted_response = artifacts.get("targeted_response", "No response generated.")
        
        # Format it simply
        final_report = f"# Research Response: {company}\n\n{targeted_response}"
        
        return {
            "final_report": final_report,
            "messages": [SystemMessage(content="Targeted research complete.")]
        }

    # Full Research Flow
    # Combine all artifacts
    combined_content = "\n\n".join([
        f"--- {k.upper()} BRIEFING ---\n{v}" 
        for k, v in artifacts.items()
    ])
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", COMPILE_CONTENT_PROMPT),
        ("user", "Compile the report.")
    ])
    
    chain = prompt | llm
    result = await chain.ainvoke({
        "company": state["company_name"],
        "combined_content": combined_content,
        "industry": state.get("industry", "Technology"),
        "hq_location": state.get("hq_location", "Global")
    })
    
    return {
        "final_report": result.content,
        "messages": [SystemMessage(content="Report compilation complete.")]
    }

# ============================================================================
# NODE 7: UPDATER (FIXED - NO CTO HALLUCINATION)
# ============================================================================
class UpdateAction(BaseModel):
    search_query: str = Field(..., description="The specific search query to find the missing info")
    target_section: str = Field(..., description="Which section to update: 'company', 'industry', 'financial', or 'news'")
    
class SurgicalEdit(BaseModel):
    direct_answer: str = Field(..., description="A conversational answer to the user's question")
    updated_artifact_content: str = Field(..., description="The fully rewritten content for that specific section only")

async def updater_node(state: AgentState):
    """
    Surgically updates a specific section and answers the user.
    FIXED: Prevents CTO hallucination with strict prompting.
    """
    logger.info("--- UPDATER NODE (SURGICAL) ---")
    messages = state["messages"]
    last_message = messages[-1].content
    company = state["company_name"]
    artifacts = state.get("artifacts", {})
    
    # ---------------------------------------------------------
    # STEP 1: PLAN THE UPDATE (FIXED PROMPT)
    # ---------------------------------------------------------
    planner_prompt = f"""
    You are a Planning Agent.
    User Request: "{last_message}"
    Target Company: {company}
    
    1. Analyze the User Request carefully. What EXACTLY do they want to add or change?
    2. Do NOT assume they want "CTO" or "Leadership" info unless they explicitly asked for it.
    3. If they ask for "Pricing" or "Revenue", map it to 'financial'.
    4. Generate a targeted search query for this specific request.
    
    Return the search query and target section.
    """
    
    structured_planner = llm.with_structured_output(UpdateAction)
    plan = await structured_planner.ainvoke(planner_prompt)
    
    logger.info(f"Update Plan: Section={plan.target_section}, Query={plan.search_query}")
    
    # ---------------------------------------------------------
    # STEP 2: SEARCH (Specific Logic)
    # ---------------------------------------------------------
    search_results = await search_perplexity(plan.search_query)
    new_evidence = search_results["content"]
    
    # ---------------------------------------------------------
    # STEP 3: PERFORM SURGICAL EDIT & ANSWER
    # ---------------------------------------------------------
    current_section_content = artifacts.get(plan.target_section, "")
    
    editor_prompt = f"""
    You are an Expert Editor. 
    
    Task 1: Answer the user's question conversationally based on the New Evidence.
    Task 2: Rewrite the Report Section to include the New Evidence. 
    
    CRITICAL EDITING RULES:
    1. Keep all existing valid information.
    2. If the New Evidence introduces a NEW TOPIC (like "Investor Equity", "Recent Lawsuit", etc.), append it as a NEW SUB-HEADING (###) at the VERY END of the section.
    3. DO NOT insert new topics at the top.
    4. DO NOT disrupt the existing flow.
    5. Only modify existing text if it is factually incorrect based on the New Evidence.
    
    User Question: {last_message}
    New Evidence: {new_evidence}
    
    Current Report Section Content:
    {current_section_content}
    
    Return the Direct Answer and the Fully Updated Section.
    """
    
    structured_editor = llm.with_structured_output(SurgicalEdit)
    edit_result = await structured_editor.ainvoke(editor_prompt)
    
    logger.info(f"Surgical edit complete. Answer: {edit_result.direct_answer[:100]}...")
    
    # ---------------------------------------------------------
    # STEP 4: UPDATE STATE
    # ---------------------------------------------------------
    # Update only the specific artifact
    updated_artifacts = artifacts.copy()
    updated_artifacts[plan.target_section] = edit_result.updated_artifact_content
    
    return {
        "artifacts": updated_artifacts,
        # We append the DIRECT ANSWER to messages so the user sees it in chat
        "messages": [SystemMessage(content=edit_result.direct_answer)] 
    }

# ============================================================================
# NODE 8: CHAT NODE (FIXED - RAG + TARGETED SEARCH)
# ============================================================================
class ChatDecision(BaseModel):
    needs_search: bool = Field(..., description="True if the answer is NOT in the report and requires external search.")
    search_query: str | None = Field(None, description="The search query if needed.")

# Initialize a separate LLM for chat with higher temperature for natural conversation
chat_llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0.6,  # Higher temperature for more natural, varied responses
    google_api_key=os.getenv("GOOGLE_API_KEY")
)

async def chat_node(state: AgentState):
    """
    Context-Aware Chat. 
    1. Detects if user is asking a specific question or just chatting
    2. If asking about report content, checks if answer is in the Report
    3. If NOT in report, performs a targeted search (without updating the report)
    """
    logger.info("--- CHAT NODE ---")
    messages = state["messages"]
    last_message = messages[-1].content
    final_report = state.get("final_report", "")
    company = state.get("company_name", "")
    
    # Detect if this is small talk or a specific question
    is_small_talk = any(greeting in last_message.lower() for greeting in [
        "hey", "hi", "hello", "how are you", "what's up", "good morning", 
        "good afternoon", "good evening", "thanks", "thank you"
    ])
    
    context_text = final_report if final_report else "No research report has been generated yet."
    
    # Only check for search if NOT small talk AND user is asking a specific question
    if not is_small_talk and final_report:
        # Step 1: Check if we need external info
        check_prompt = f"""
        User Question: "{last_message}"
        Current Report Context:
        {final_report[:15000]}... (truncated)
        
        Is the user asking a SPECIFIC question about {company or 'the company'} that requires information?
        - If it's a greeting or small talk: needs_search = False
        - If the answer IS in the Report Context: needs_search = False
        - If the answer is NOT in the report and requires external search: needs_search = True and provide a specific query about {company or 'the company'}
        """
        
        decision_llm = llm.with_structured_output(ChatDecision)
        decision = await decision_llm.ainvoke(check_prompt)
        
        # Step 2: Targeted Search (Ephemeral)
        if decision.needs_search and decision.search_query:
            logger.info(f"Chat needs external info. Searching: {decision.search_query}")
            search_res = await search_perplexity(decision.search_query)
            # Add new info to the context just for this turn
            context_text += f"\n\n[EXTERNAL SEARCH RESULTS]:\n{search_res['content']}"
    
    # Step 3: Generate Answer
    system_prompt = """You are the Company Research Assistant.
You have TWO MODES of behavior:
1. **Conversation Mode** – for greetings, small talk, general questions.
2. **Research Mode** – when the user explicitly asks for company research, competitor analysis, account planning, or information retrieval.

### RULES FOR CONVERSATION MODE
- **CRITICAL**: If NO report has been generated yet (Context is empty), you MUST politely steer the user to provide a company name.
  - Example: "I'm here to research companies. Which company would you like to investigate?"
  - Do NOT engage in long off-topic conversations (weather, jokes, etc.) if no work has been done.
- If the user says something casual ("hey", "how are you", "are you a good agent?"), respond naturally and conversationally.
- If a report EXISTS, you can be more conversational but still keep it professional.
- Do NOT ask for a company name unless the user directly expresses research intent.
- Do NOT repeat your purpose repeatedly.
- Do NOT say "I am a research agent" unless the user asks what you do.

### RULES FOR RESEARCH MODE
- Activate Research Mode ONLY when the user asks something related to:
  - researching a company
  - generating an account plan
  - analyzing competitors
  - collecting business insights
- When in Research Mode, guide the user, ask clarifying questions, and perform structured research tasks.

### MODE SWITCHING
- If the user switches from small talk to research → switch to Research Mode.
- If the user stops researching and returns to casual chat → switch back to Conversation Mode.
- Never output two different persona responses in one message.
- Never repeat the same message twice.
- Always maintain natural, human-like conversational quality.

### IMPORTANT
Your goal is to be helpful, natural, and context-aware. Do NOT force research. Respond based on the user's intent, not only on your role.
If you used External Search results, mention that this info was found live."""
    
    # Step 3: Generate Answer - directly invoke with messages
    try:
        logger.info("Invoking chat LLM...")
        response = await chat_llm.ainvoke([
            SystemMessage(content=system_prompt),
            HumanMessage(content=f"Context:\n{context_text}\n\nQuestion: {last_message}")
        ])
        logger.info(f"Chat LLM response received: {response.content[:100] if response.content else 'Empty'}...")
        
        return {
            "messages": [SystemMessage(content=response.content)]
        }
    except Exception as e:
        logger.error(f"Error in chat_node LLM call: {e}")
        return {
            "messages": [SystemMessage(content=f"I'm having trouble responding right now. {str(e)}")]
        }
