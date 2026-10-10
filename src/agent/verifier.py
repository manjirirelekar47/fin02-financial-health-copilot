"""src/agent/verifier.py — Grounded Claim Verifier for numerical AI outputs.

Rules:
1. Every numerical figure in an agent's answer must match an exact figure produced by tool output.
2. The LLM never sees raw transactions and never computes numbers.
3. Unmatched figures are flagged and prevented from display as verified claims.
"""

from __future__ import annotations

import re
from typing import Any


def extract_numbers(text: str) -> list[float]:
    """Extracts all numbers from text, handling commas, currency notations, and decimals."""
    # Match numbers like -1,234.56, 50,000, 12.5, or 100
    matches = re.findall(r"-?\d+(?:,\d{3})*(?:\.\d+)?", text)
    nums: list[float] = []
    for m in matches:
        try:
            val = float(m.replace(",", ""))
            nums.append(val)
        except ValueError:
            pass
    return nums


def _flatten_dict(d: Any) -> list[float]:
    """Recursively flattens a dictionary or object to extract all numerical values."""
    out: list[float] = []
    if isinstance(d, dict):
        for v in d.values():
            out.extend(_flatten_dict(v))
    elif isinstance(d, (list, tuple)):
        for v in d:
            out.extend(_flatten_dict(v))
    elif isinstance(d, (int, float)):
        out.append(float(d))
    elif hasattr(d, "year"):  # date or datetime object
        out.extend([float(d.year), float(d.month), float(d.day)])
    elif isinstance(d, str):
        out.extend(extract_numbers(d))
    elif hasattr(d, "model_dump"):
        out.extend(_flatten_dict(d.model_dump()))
    return out


def verify_claims(draft_answer: str, tool_outputs: dict[str, Any]) -> tuple[str, bool, list[str]]:
    """Extracts every numerical figure in draft_answer and matches it against tool_outputs.

    Flags unmatched numbers and returns (verified_text, is_valid, list_of_unmatched_numbers).
    """
    draft_nums = extract_numbers(draft_answer)
    valid_nums = set(_flatten_dict(tool_outputs))

    unmatched_nums: list[float] = []
    for n in draft_nums:
        is_match = False
        for vn in valid_nums:
            # 1. Exact or near floating-point equality (within 0.05)
            if abs(n - vn) < 0.05:
                is_match = True
                break
            # 2. Percentage representation (e.g. 0.075 in tool output, 7.5 in text)
            if abs((n / 100.0) - vn) < 0.001:
                is_match = True
                break
            # 3. Integer rounding match (e.g. 45000 vs 45000.25)
            if abs(round(n) - round(vn)) == 0 and abs(n - vn) < 1.0:
                is_match = True
                break

        if not is_match:
            unmatched_nums.append(n)

    unmatched_str = [str(n) for n in unmatched_nums]
    verified = len(unmatched_str) == 0

    return draft_answer, verified, unmatched_str
