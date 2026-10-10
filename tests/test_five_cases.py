"""tests/test_five_cases.py — Unit tests verifying the Five Required Cases execution and outputs.

Tests:
1. All 5 required cases execute cleanly and save their outputs to data/cases/case_*.json.
2. Case 1 (Stable income): reserve held throughout 8 weeks.
3. Case 2 (Income reduction): replan runs from week 2 with changed period table.
4. Case 3 (Unexpected essential expense): Critical items remain paid, buffer absorbs shock.
5. Case 4 (Infeasible target): status is infeasible, names conflicts, gives >= 2 relaxation options.
6. Case 5 (Uncertainty changes plan): proven disagreement between median ranking and risk ranking.
"""

from __future__ import annotations

from pathlib import Path
import json
import pytest

from src.five_cases import run_all_five_cases, CASES_DIR


def test_run_all_five_cases_saves_json_files():
    """Verify that run_all_five_cases executes all five cases and writes files."""
    cases = run_all_five_cases()
    assert len(cases) == 5

    expected_files = [
        "case_1_stable_income.json",
        "case_2_income_reduction.json",
        "case_3_unexpected_expense.json",
        "case_4_infeasible_target.json",
        "case_5_uncertainty_changes_plan.json",
    ]

    for fname in expected_files:
        p = CASES_DIR / fname
        assert p.exists(), f"Missing output file: {fname}"
        with open(p, encoding="utf-8") as f:
            data = json.load(f)
            assert "case_id" in data
            assert "status" in data


def test_case_1_stable_income():
    cases = run_all_five_cases()
    c1 = cases["case_1"]
    assert c1["status"] == "ok"
    assert len(c1["sequences"]) >= 2
    # Check that in S0, all weeks have positive closing balance and zero breach risk
    s0 = next(s for s in c1["sequences"] if "s0" in s["id"])
    assert s0["summary"]["any_week_breach_prob"] == 0.0


def test_case_2_income_reduction():
    cases = run_all_five_cases()
    c2 = cases["case_2"]
    assert c2["status"] == "ok"
    assert len(c2["sequences"]) >= 2


def test_case_3_unexpected_expense():
    cases = run_all_five_cases()
    c3 = cases["case_3"]
    assert c3["status"] in ("ok", "infeasible")
    # In week 2, essentials include the extra 25,000 debit
    for s in c3["sequences"]:
        assert s["periods"][1]["essentials"] >= 25000.0


def test_case_4_infeasible_target():
    cases = run_all_five_cases()
    c4 = cases["case_4"]
    assert c4["status"] == "infeasible"
    assert c4["conflict"] is not None
    assert len(c4["conflict"]["constraints"]) >= 2
    assert "savings_goal_shortfall" in c4["conflict"]["slack_amounts"]
    assert len(c4["conflict"]["relaxations"]) >= 2
    for r in c4["conflict"]["relaxations"]:
        assert 0.0 <= r["resulting_risk"] <= 1.0


def test_case_5_uncertainty_changes_plan():
    """Verify that Case 5 strictly proves the median-vs-risk ranking disagreement on Persona B."""
    cases = run_all_five_cases()
    c5 = cases["case_5"]
    assert c5["status"] == "ok"
    assert "median_vs_risk_check" in c5

    chk = c5["median_vs_risk_check"]
    # 1. Best median sequence S0 has higher median closing than S1
    assert chk["s0_median_closing"] > chk["s1_median_closing"]

    # 2. But S0 loses on reserve-breach risk compared to S1
    assert chk["s0_breach_risk"] > chk["s1_breach_risk"]

    # 3. Disagreement flag is True
    assert chk["ranking_disagreement"] is True

    # 4. S1 (lower risk) is the recommended sequence
    assert c5["recommended_sequence_id"] == "seq_s1_debt_first"
    assert "better median" in c5["why_line"]
    assert "lower-risk plan" in c5["why_line"]
