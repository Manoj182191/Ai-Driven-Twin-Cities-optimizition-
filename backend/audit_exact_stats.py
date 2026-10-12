import json
import numpy as np
import scipy.stats as stats

with open("data/research_experiments/EXP-B1F1EEB4.json") as f:
    d = json.load(f)

runs = d["run_records"]
# Filter normal runs
normal_runs = [r for r in runs if r["scenario"] == "normal"]
by_strat = {}
for r in normal_runs:
    by_strat.setdefault(r["strategy"], []).append(r)

indep_recs = sorted(by_strat["independent"], key=lambda r: r["seed"])
coord_recs = sorted(by_strat["coordinated"], key=lambda r: r["seed"])

print(f"Matched runs: Indep={len(indep_recs)}, Coord={len(coord_recs)}")

# Recompute raw paired t-test for all metrics directly from the run records!
metric_keys = [
    "system_avg_travel_time",
    "system_avg_congestion",
    "system_avg_queue_length",
    "system_objective_cost",
    "city_a_travel_time",
    "city_a_congestion",
    "city_a_queue_length",
    "city_b_travel_time",
    "city_b_congestion",
    "city_b_queue_length",
    "intercity_travel_time",
    "intercity_congestion",
    "intercity_queue_length",
    "total_intervention_cost",
    "total_vehicles_served",
    "optimization_execution_time_ms"
]

results = []
for k in metric_keys:
    b_vals = np.array([r[k] for r in indep_recs], dtype=float)
    t_vals = np.array([r[k] for r in coord_recs], dtype=float)
    diff = b_vals - t_vals  # or target - base
    std_diff = np.std(diff, ddof=1)
    mean_diff = np.mean(diff)
    
    if std_diff > 1e-9:
        res = stats.ttest_rel(b_vals, t_vals)
        raw_p = float(res.pvalue)
        t_stat = float(res.statistic)
        w_res = stats.wilcoxon(b_vals, t_vals, zero_method="wilcox")
        wilc_p = float(w_res.pvalue)
        dz = float(mean_diff / std_diff)
        sem = std_diff / np.sqrt(len(diff))
        ci_lower = mean_diff - stats.t.ppf(0.975, df=len(diff)-1) * sem
        ci_upper = mean_diff + stats.t.ppf(0.975, df=len(diff)-1) * sem
    else:
        raw_p = None
        t_stat = None
        wilc_p = None
        dz = None
        ci_lower = mean_diff
        ci_upper = mean_diff
    
    results.append({
        "metric_id": k,
        "mean_base": np.mean(b_vals),
        "mean_target": np.mean(t_vals),
        "mean_diff": mean_diff,
        "std_diff": std_diff,
        "t_stat": t_stat,
        "raw_p": raw_p,
        "wilc_p": wilc_p,
        "dz": dz,
        "ci_lower": ci_lower,
        "ci_upper": ci_upper
    })

# Now perform Holm-Bonferroni correction correctly!
valid = [r for r in results if r["raw_p"] is not None]
m = len(valid)
# Sort by raw p ascending
sorted_valid = sorted(valid, key=lambda r: r["raw_p"])

running_max = 0.0
for rank, r in enumerate(sorted_valid, start=1):
    raw_p = r["raw_p"]
    multiplier = m - rank + 1
    p_adj = min(1.0, max(running_max, raw_p * multiplier))
    running_max = p_adj
    r["rank"] = rank
    r["multiplier"] = multiplier
    r["p_adj"] = p_adj

print("\n" + "="*120)
print("AUDITED PAIRED COMPARISONS (INDEPENDENT vs. COORDINATED, NORMAL SCENARIO, N=10 SEEDS)")
print("="*120)
header = f"{'Rank':<4} | {'Metric ID':<30} | {'Raw t p':<12} | {'Wilcox p':<12} | {'Mult':<5} | {'Holm p':<12} | {'Cohen dz':<9} | {'Mean Diff':<10} | {'95% CI':<24} | {'Sig (<0.05)'}"
print(header)
print("-" * len(header))
for r in sorted_valid:
    print(f"{r['rank']:<4} | {r['metric_id']:<30} | {r['raw_p']:<12.4e} | {r['wilc_p']:<12.4e} | {r['multiplier']:<5} | {r['p_adj']:<12.4e} | {r['dz']:<9.4f} | {r['mean_diff']:<10.4f} | [{r['ci_lower']:<9.4f}, {r['ci_upper']:<9.4f}] | {r['p_adj'] < 0.05}")

for r in [x for x in results if x["raw_p"] is None]:
    print(f"{'-':<4} | {r['metric_id']:<30} | {'None':<12} | {'None':<12} | {'-':<5} | {'None':<12} | {'None':<9} | {r['mean_diff']:<10.4f} | [Zero variance]           | False")
