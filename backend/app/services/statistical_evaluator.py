import math
from typing import List, Dict, Optional, Tuple
import numpy as np
import scipy.stats as stats

from ..models.research_models import (
    DescriptiveStatistics,
    PairedComparisonResult,
    OptimizationStrategy
)


def compute_descriptive_stats(values: List[float]) -> DescriptiveStatistics:
    """
    Computes rigorous descriptive statistics including 95% Student's t confidence intervals.
    """
    if not values:
        return DescriptiveStatistics(
            mean=0.0,
            median=0.0,
            std_dev=0.0,
            min_val=0.0,
            max_val=0.0,
            ci_95_lower=0.0,
            ci_95_upper=0.0,
            sample_size=0
        )
    
    n = len(values)
    mean_val = float(np.mean(values))
    median_val = float(np.median(values))
    min_val = float(np.min(values))
    max_val = float(np.max(values))
    
    if n > 1:
        # Sample standard deviation (ddof=1)
        std_val = float(np.std(values, ddof=1))
        # 95% two-tailed critical t-value for n-1 degrees of freedom
        t_crit = float(stats.t.ppf(0.975, df=n - 1))
        stderr = std_val / math.sqrt(n)
        ci_lower = mean_val - t_crit * stderr
        ci_upper = mean_val + t_crit * stderr
    else:
        std_val = 0.0
        ci_lower = mean_val
        ci_upper = mean_val

    return DescriptiveStatistics(
        mean=round(mean_val, 4),
        median=round(median_val, 4),
        std_dev=round(std_val, 4),
        min_val=round(min_val, 4),
        max_val=round(max_val, 4),
        ci_95_lower=round(ci_lower, 4),
        ci_95_upper=round(ci_upper, 4),
        sample_size=n
    )


def compute_paired_comparison(
    metric_id: str,
    metric_name: str,
    unit: str,
    higher_is_better: bool,
    comparison_type: str,
    baseline_strategy: OptimizationStrategy,
    target_strategy: OptimizationStrategy,
    baseline_values: List[float],
    target_values: List[float]
) -> PairedComparisonResult:
    """
    Performs paired statistical hypothesis testing and effect size estimation:
    - Paired differences
    - Safe percentage improvement (with zero denominator check)
    - Paired 95% Confidence Interval for difference
    - Paired Student's t-test
    - Non-parametric Wilcoxon signed-rank test
    - Cohen's dz effect size
    """
    n = min(len(baseline_values), len(target_values))
    if n == 0:
        return PairedComparisonResult(
            metric_id=metric_id,
            metric_name=metric_name,
            unit=unit,
            higher_is_better=higher_is_better,
            comparison_type=comparison_type,
            baseline_strategy=baseline_strategy,
            target_strategy=target_strategy,
            mean_baseline=0.0,
            mean_target=0.0,
            mean_difference=0.0,
            mean_improvement_pct=None,
            ci_95_diff_lower=0.0,
            ci_95_diff_upper=0.0,
            is_statistically_significant=False,
            practical_significance_note="Insufficient sample size"
        )

    base_arr = np.array(baseline_values[:n], dtype=float)
    target_arr = np.array(target_values[:n], dtype=float)

    mean_baseline = float(np.mean(base_arr))
    mean_target = float(np.mean(target_arr))

    # Differences: d_i = baseline_i - target_i (if lower is better, positive d_i means target is an improvement)
    if not higher_is_better:
        diff_arr = base_arr - target_arr
    else:
        diff_arr = target_arr - base_arr

    mean_diff = float(np.mean(diff_arr))

    # Improvement percentage: handle zero or non-positive baseline safely
    pct_improvements = []
    for b, t in zip(base_arr, target_arr):
        if b > 1e-6:
            if not higher_is_better:
                pct = ((b - t) / b) * 100.0
            else:
                pct = ((t - b) / b) * 100.0
            pct_improvements.append(pct)
    
    mean_imp_pct = round(float(np.mean(pct_improvements)), 2) if pct_improvements else None

    # Paired 95% Confidence Interval
    if n > 1:
        std_diff = float(np.std(diff_arr, ddof=1))
        t_crit = float(stats.t.ppf(0.975, df=n - 1))
        stderr_diff = std_diff / math.sqrt(n)
        ci_diff_lower = mean_diff - t_crit * stderr_diff
        ci_diff_upper = mean_diff + t_crit * stderr_diff
    else:
        std_diff = 0.0
        ci_diff_lower = mean_diff
        ci_diff_upper = mean_diff

    # Paired Student's t-test
    t_stat = None
    p_param = None
    if n >= 2 and std_diff > 1e-9:
        try:
            res = stats.ttest_rel(base_arr, target_arr)
            if math.isfinite(float(res.pvalue)):
                t_stat = round(float(res.statistic), 4)
                p_param = float(res.pvalue)
        except Exception:
            pass

    # Wilcoxon signed-rank test
    p_wilcox = None
    if n >= 3:
        try:
            # Check if there are non-zero differences
            if np.any(np.abs(diff_arr) > 1e-9):
                w_res = stats.wilcoxon(base_arr, target_arr, zero_method="wilcox")
                if math.isfinite(float(w_res.pvalue)):
                    p_wilcox = float(w_res.pvalue)
        except Exception:
            pass

    # Cohen's dz effect size
    cohen_dz = None
    if std_diff > 1e-9:
        cohen_dz = round(mean_diff / std_diff, 4)

    # Note on practical significance
    if cohen_dz is not None:
        abs_d = abs(cohen_dz)
        if abs_d < 0.2:
            effect_label = "Negligible effect (|dz| < 0.2)"
        elif abs_d < 0.5:
            effect_label = "Small effect size (0.2 <= |dz| < 0.5)"
        elif abs_d < 0.8:
            effect_label = "Medium effect size (0.5 <= |dz| < 0.8)"
        else:
            effect_label = "Large effect size (|dz| >= 0.8)"
    else:
        effect_label = "Zero variance in paired differences"

    return PairedComparisonResult(
        metric_id=metric_id,
        metric_name=metric_name,
        unit=unit,
        higher_is_better=higher_is_better,
        comparison_type=comparison_type,
        baseline_strategy=baseline_strategy,
        target_strategy=target_strategy,
        mean_baseline=round(mean_baseline, 4),
        mean_target=round(mean_target, 4),
        mean_difference=round(mean_diff, 4),
        mean_improvement_pct=mean_imp_pct,
        ci_95_diff_lower=round(ci_diff_lower, 4),
        ci_95_diff_upper=round(ci_diff_upper, 4),
        t_statistic=t_stat,
        p_value_parametric=p_param,
        p_value_wilcoxon=p_wilcox,
        p_value_adjusted_holm=None,
        effect_size_cohen_dz=cohen_dz,
        is_statistically_significant=(p_param is not None and p_param < 0.05),
        practical_significance_note=effect_label
    )


def apply_holm_bonferroni(comparisons: List[PairedComparisonResult]) -> List[PairedComparisonResult]:
    """
    Applies Holm-Bonferroni step-down correction for family-wise error rate across multiple hypotheses.
    """
    valid_indices = []
    for i, comparison in enumerate(comparisons):
        p_value = comparison.p_value_parametric
        if p_value is not None and math.isfinite(p_value) and 0.0 <= p_value <= 1.0:
            valid_indices.append(i)
        else:
            comparison.p_value_adjusted_holm = None
            comparison.is_statistically_significant = False
    m = len(valid_indices)
    if m == 0:
        return comparisons

    # Sort indices by unadjusted p-value ascending
    sorted_pairs = sorted(valid_indices, key=lambda idx: comparisons[idx].p_value_parametric)
    
    running_max = 0.0
    for rank, orig_idx in enumerate(sorted_pairs):
        p_raw = comparisons[orig_idx].p_value_parametric
        assert p_raw is not None
        multiplier = m - rank
        p_adj = min(1.0, max(running_max, p_raw * multiplier))
        running_max = p_adj
        
        comparisons[orig_idx].p_value_adjusted_holm = p_adj
        comparisons[orig_idx].is_statistically_significant = bool(p_adj < 0.05)

    return comparisons
