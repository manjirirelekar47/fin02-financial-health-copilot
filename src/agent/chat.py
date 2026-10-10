import os
import re
from typing import Dict, Any
import pandas as pd

from api.schemas import AgentChatRequest, AgentChatResponse, SimulatorRequest, SimulatorPreset, SimulatorPriority
from src.agent.tools import get_summary, get_recurring, forecast, simulate_decision, optimize_plan
from src.agent.verifier import verify_claims, extract_numbers

def handle_chat(request: AgentChatRequest, df: pd.DataFrame) -> AgentChatResponse:
    query = request.query.lower()
    
    tool_outputs = {}
    draft_answer = ""
    
    # 1. Medical emergency / hospital shock queries
    if "hospital" in query or "medical" in query or "emergency" in query:
        nums = extract_numbers(query)
        amt = nums[0] if nums else 200000.0
        if "lakh" in query and amt < 100:
            amt = amt * 100000.0
        req = SimulatorRequest(
            presets=[SimulatorPreset.medical_emergency],
            custom_amount=amt,
            priority=SimulatorPriority.safest
        )
        out = simulate_decision(df, req)
        tool_outputs["medical_emergency"] = out
        tool_outputs["shock_amount"] = amt
        paths = out.get("paths", []) if isinstance(out, dict) else []
        path = paths[0] if paths else {}
        shortfall = path.get("shortfall_prob_90d", 0.0)
        runway = path.get("survival_runway_days", 90)
        tool_outputs["shortfall_pct"] = round(shortfall * 100.0, 1)
        tool_outputs["runway_days"] = runway
        draft_answer = (
            f"Under a Rs {amt:,.0f} medical shock, shortfall probability is {shortfall*100:.0f}% "
            f"with a survival runway of {runway} days."
        )

    # 2. Affordability / laptop / major purchase queries
    elif "afford" in query or "laptop" in query or "buy" in query:
        nums = extract_numbers(query)
        amt = nums[0] if nums else 80000.0
        if "lakh" in query and amt < 100:
            amt = amt * 100000.0
        req = SimulatorRequest(
            presets=[SimulatorPreset.buy_or_new_emi],
            custom_amount=amt,
            custom_months=6,
            priority=SimulatorPriority.safest
        )
        out = simulate_decision(df, req)
        tool_outputs["simulate"] = out
        tool_outputs["purchase_amount"] = amt
        tool_outputs["tenure_months"] = 6
        paths = out.get("paths", []) if isinstance(out, dict) else []
        path = paths[0] if paths else {}
        shortfall = path.get("shortfall_prob_90d", 0.0)
        tool_outputs["shortfall_pct"] = round(shortfall * 100.0, 1)
        draft_answer = (
            f"For a Rs {amt:,.0f} purchase with 6 months financing, the 90-day shortfall risk is {shortfall*100:.0f}%. "
            f"You can afford this safely with minimal adjustments."
        )

    # 3. Recurring subscriptions / monthly burden queries
    elif "recurring" in query or "subscription" in query:
        out = get_recurring(df)
        tool_outputs["recurring"] = out
        val = out.get("total_monthly_burden", 0)
        draft_answer = f"Your total monthly recurring burden is Rs {val:.2f}."

    # 4. Cash flow forecast / next month queries
    elif "forecast" in query or "next month" in query or "cashflow" in query:
        out = forecast(df)
        out["horizon_days"] = 30
        tool_outputs["forecast"] = out
        val = out.get("predicted_net_cashflow_30d", 0)
        draft_answer = f"Your predicted net cashflow for the next 30 days is Rs {val:.2f}."

    # 5. Optimizer / minimum-change plan queries
    elif "optimize" in query or "minimum change" in query or "plan" in query:
        out = optimize_plan(df, 90000.0)
        tool_outputs["optimizer"] = out
        draft_answer = out.get("explanation", "Found a safe plan with balanced category cuts.")

    # 6. Savings rate / health summary queries
    else:
        out = get_summary(df)
        tool_outputs["summary"] = out
        draft_answer = "Based on your verified transactions, your financial health ratios and safety buffer have been computed securely."

    # External LLM hook
    api_key = os.environ.get("OPENAI_API_KEY")
    if api_key:
        pass

    # Verification Step: The draft answer goes through the deterministic Claim Verifier
    final_answer, verified, unmatched = verify_claims(draft_answer, tool_outputs)
    
    return AgentChatResponse(
        answer=final_answer,
        verified_claims=verified,
        unmatched_numbers_flagged=unmatched
    )
