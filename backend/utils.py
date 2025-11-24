import os
import httpx
import json
from typing import List, Dict, Any

async def search_perplexity(query: str) -> Dict[str, Any]:
    """
    Searches Perplexity API (sonar-pro) for the given query.
    Returns a dictionary with 'content' and 'citations'.
    """
    api_key = os.getenv("PERPLEXITY_API_KEY")
    if not api_key:
        return {"content": "Error: PERPLEXITY_API_KEY not found.", "citations": []}

    url = "https://api.perplexity.ai/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "sonar-pro",
        "messages": [
            {"role": "system", "content": "You are a helpful research assistant. Provide detailed, factual information. Cite numbers clearly."},
            {"role": "user", "content": query}
        ]
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload, timeout=60.0)
            response.raise_for_status()
            data = response.json()
            return {
                "content": data["choices"][0]["message"]["content"],
                "citations": data.get("citations", [])
            }
        except Exception as e:
            return {"content": f"Error querying Perplexity: {str(e)}", "citations": []}

async def search_tavily(query: str) -> List[str]:
    """
    Searches Tavily API for the given query and returns a list of results.
    """
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return ["Error: TAVILY_API_KEY not found."]

    url = "https://api.tavily.com/search"
    headers = {
        "Content-Type": "application/json"
    }
    
    payload = {
        "api_key": api_key,
        "query": query,
        "search_depth": "advanced",
        "include_answer": True,
        "max_results": 5
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload, timeout=30.0)
            response.raise_for_status()
            data = response.json()
            
            results = []
            # Include the generated answer if available
            if data.get("answer"):
                results.append(f"Tavily Answer: {data['answer']}")
            
            # Include individual search results
            for result in data.get("results", []):
                results.append(f"Source: {result.get('title', 'Unknown')}\nURL: {result.get('url', 'Unknown')}\nContent: {result.get('content', '')}")
            
            return results
        except Exception as e:
            return [f"Error querying Tavily: {str(e)}"]
