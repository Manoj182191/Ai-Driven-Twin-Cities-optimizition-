import json

with open("data/research_experiments/EXP-B1F1EEB4.json", "r") as f:
    d = json.load(f)

comps = d["scenario_summaries"]["normal"]["paired_comparisons"]
valid_comps = [c for c in comps if c["p_value_parametric"] is not None]
m = len(valid_comps)
sorted_comps = sorted(valid_comps, key=lambda c: c["p_value_parametric"])

print(f"Total hypotheses in family: {len(comps)} (valid with p_param: {m})")
header = f"{'Rank':<4} | {'Metric ID':<30} | {'Raw t p':<10} | {'Wilcox p':<10} | {'Multiplier':<10} | {'Holm p':<10} | {'Cohen dz':<9} | {'Mean Diff':<10} | {'95% CI Diff':<22} | {'Sig (<0.05)'}"
print(header)
print("-" * len(header))

for rank, c in enumerate(sorted_comps, start=1):
    raw_p = c["p_value_parametric"]
    wilc_p = c["p_value_wilcoxon"]
    holm_p = c["p_value_adjusted_holm"]
    mult = m - rank + 1
    dz = c["effect_size_cohen_dz"]
    diff = c["mean_difference"]
    ci = f"[{c['ci_95_diff_lower']:.4f}, {c['ci_95_diff_upper']:.4f}]"
    sig = str(c["is_statistically_significant"])
    print(f"{rank:<4} | {c['metric_id']:<30} | {raw_p:<10.6f} | {wilc_p:<10.6f} | {mult:<10} | {holm_p:<10.6f} | {dz:<9.4f} | {diff:<10.4f} | {ci:<22} | {sig}")

# Also check any invalid ones (e.g. constant 0 difference)
invalid = [c for c in comps if c["p_value_parametric"] is None]
for c in invalid:
    print(f"{'-':<4} | {c['metric_id']:<30} | {'None':<10} | {'None':<10} | {'-':<10} | {'None':<10} | {'None':<9} | {c['mean_difference']:<10.4f} | Zero variance")
