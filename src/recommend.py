def rank_recommendations(simulated_paths, priority="safest", history_length_days=180):
    """
    Ranks simulator outputs.
    Each path in `simulated_paths` is a dict with:
      - name: e.g. "Do nothing", "Cut spend", "Refinance"
      - shortfall_prob: float (0 to 1)
      - total_cost: float
      - action_taken: bool
      
    Priority can be "safest" (lowest shortfall chance) or "cheapest" (lowest cost).
    """
    if history_length_days < 60:
        return {"status": "insufficient data", "recommendation": None, "ranked_paths": []}
        
    # Sort based on priority
    if priority == "safest":
        # Lowest shortfall prob, then lowest cost
        ranked = sorted(simulated_paths, key=lambda x: (x["shortfall_prob"], x["total_cost"]))
    elif priority == "cheapest":
        # Lowest cost, then lowest shortfall prob
        ranked = sorted(simulated_paths, key=lambda x: (x["total_cost"], x["shortfall_prob"]))
    else:
        ranked = simulated_paths
        
    best = ranked[0]
    do_nothing = next((p for p in simulated_paths if not p.get("action_taken")), None)
    
    if do_nothing and best["name"] != do_nothing["name"]:
        reason = f"{best['name']}: {int(best['shortfall_prob']*100)}% chance of a cash gap vs {int(do_nothing['shortfall_prob']*100)}% if you do nothing."
    else:
        reason = f"{best['name']} is the optimal path based on {priority} priority."
        
    return {
        "status": "success",
        "recommended_path": best["name"],
        "reason": reason,
        "ranked_paths": ranked
    }

if __name__ == "__main__":
    paths = [
        {"name": "Do nothing", "shortfall_prob": 0.41, "total_cost": 0, "action_taken": False},
        {"name": "Cut spend", "shortfall_prob": 0.06, "total_cost": 0, "action_taken": True},
        {"name": "Borrow", "shortfall_prob": 0.15, "total_cost": 5000, "action_taken": True}
    ]
    
    res = rank_recommendations(paths)
    print("Safest Priority:")
    print(res["reason"])
    
    res_cheap = rank_recommendations(paths, priority="cheapest")
    print("\nCheapest Priority:")
    print(res_cheap["reason"])
