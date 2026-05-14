"""Re-allocate variant traffic weights via Thompson sampling.

Run periodically (cron, every 30-60 min). For each Experiment in `trial`:
  * Treat each Variant as a Beta(α=conversions+1, β=samples-conversions+1) arm
  * Sample 5,000 times from each arm; weight = fraction of samples it won
  * Update Variant.weight + Experiment.confidence + Experiment.uplift_pct
  * If a clear winner emerges with >95% confidence and >500 samples on the lead,
    flip the experiment to status="winner" and pin the winning variant to weight=1

Usage:
    python manage.py allocate_bandits                  # all trial experiments
    python manage.py allocate_bandits --experiment 12  # one specific experiment
"""
from __future__ import annotations

import random
from statistics import mean
from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from experiments.models import Experiment, Variant, WeightSnapshot


def _beta_sample(alpha: float, beta: float) -> float:
    """Sample from Beta(alpha, beta) using gamma variates — stdlib only."""
    x = random.gammavariate(alpha, 1.0)
    y = random.gammavariate(beta, 1.0)
    return x / (x + y) if (x + y) > 0 else 0.0


def _allocate(experiment: Experiment, draws: int = 5000) -> dict[str, Any]:
    variants = list(experiment.variants.all())
    if not variants:
        return {"variants": 0}

    # Beta posterior parameters per arm
    arms = []
    for v in variants:
        s = max(v.samples, 0)
        c = max(min(v.conversions, s), 0)
        arms.append((v, c + 1, (s - c) + 1))

    wins = {v.id: 0 for v, *_ in arms}
    for _ in range(draws):
        best_id, best_x = None, -1.0
        for v, a, b in arms:
            x = _beta_sample(a, b)
            if x > best_x:
                best_x, best_id = x, v.id
        if best_id is not None:
            wins[best_id] += 1

    new_weights = {vid: wins[vid] / draws for vid in wins}

    # Persist + compute uplift vs control
    control = next((v for v, *_ in arms if v.is_control), None)
    control_rate = control.conversion_rate if control else 0.0
    leader = max(arms, key=lambda t: new_weights[t[0].id])[0]
    leader_rate = leader.conversion_rate

    uplift_pct = (
        (leader_rate - control_rate) / control_rate * 100.0
        if control_rate > 0 else 0.0
    )
    confidence = new_weights[leader.id]  # share of posterior wins == probability leader is best

    # Auto-ship: leader is non-control, has ≥500 samples, ≥95% posterior confidence
    shipping = (
        not leader.is_control
        and leader.samples >= 500
        and confidence >= 0.95
        and uplift_pct > 0
    )

    with transaction.atomic():
        for v, *_ in arms:
            final_weight = (
                (1.0 if v.id == leader.id else 0.0) if shipping else new_weights[v.id]
            )
            Variant.objects.filter(id=v.id).update(weight=final_weight)

        exp_updates: dict[str, Any] = {
            "uplift_pct": round(uplift_pct, 2),
            "confidence": round(confidence, 4),
        }
        if shipping:
            exp_updates["status"] = "winner"
            exp_updates["decided_at"] = timezone.now()

        Experiment.objects.filter(id=experiment.id).update(**exp_updates)

        # Frozen snapshot of the post-allocation state — powers the dashboard
        # weight-history chart. Captures the variant name inline so the chart
        # keeps rendering even if a variant is later deleted.
        snapshot_arms = []
        for v, *_ in arms:
            w = (
                (1.0 if v.id == leader.id else 0.0) if shipping else new_weights[v.id]
            )
            rate = (v.conversions / v.samples) if v.samples else 0.0
            snapshot_arms.append({
                "variant_id": v.id,
                "name": v.name,
                "is_control": v.is_control,
                "weight": round(w, 4),
                "samples": v.samples,
                "conversions": v.conversions,
                "rate": round(rate, 4),
            })
        WeightSnapshot.objects.create(
            experiment=experiment,
            confidence=round(confidence, 4),
            uplift_pct=round(uplift_pct, 2),
            leader_variant_id=leader.id,
            shipped=shipping,
            arms=snapshot_arms,
        )

    return {
        "experiment": experiment.id,
        "variants": len(arms),
        "leader": leader.id,
        "leader_name": leader.name,
        "confidence": round(confidence, 4),
        "uplift_pct": round(uplift_pct, 2),
        "shipped": shipping,
    }


class Command(BaseCommand):
    help = "Re-allocate variant traffic weights via Thompson sampling."

    def add_arguments(self, parser):
        parser.add_argument("--experiment", type=int, default=None,
                            help="Allocate just this experiment id.")
        parser.add_argument("--draws", type=int, default=5000,
                            help="Posterior sample count per allocation.")

    def handle(self, *args, **opts):
        qs = Experiment.objects.filter(status="trial").prefetch_related("variants")
        if opts["experiment"]:
            qs = qs.filter(id=opts["experiment"])

        results = []
        for exp in qs:
            r = _allocate(exp, draws=opts["draws"])
            results.append(r)
            self.stdout.write(
                f"  · exp {r['experiment']:>4} · variants={r['variants']} · "
                f"leader={r['leader_name'][:24]:<24} · conf={r['confidence']:.2%} · "
                f"uplift={r['uplift_pct']:+.2f}%"
                + (self.style.SUCCESS("  → SHIPPED") if r["shipped"] else "")
            )

        if not results:
            self.stdout.write("  (no trial experiments)")
        else:
            avg_conf = mean(r["confidence"] for r in results)
            self.stdout.write(
                self.style.SUCCESS(f"\n✓ allocated {len(results)} experiments · avg confidence {avg_conf:.2%}")
            )
