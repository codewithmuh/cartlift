"""Long-running scheduler that re-runs Thompson-sampling allocation on a
fixed interval — turns the bandit allocator into the actual daemon described
in the README, instead of a manual-cron command.

Run as its own container (see docker-compose service `scheduler`) so it doesn't
share lifecycle with gunicorn workers and stays single-instance.

Usage:
    python manage.py run_allocator_loop                       # default 1800s
    python manage.py run_allocator_loop --interval 60         # tick every minute
    BANDIT_ALLOCATOR_INTERVAL=120 python manage.py run_allocator_loop
"""
from __future__ import annotations

import os
import signal
import time

from django.core.management.base import BaseCommand
from django.utils import timezone

from experiments.models import Experiment
from .allocate_bandits import _allocate


class Command(BaseCommand):
    help = "Run the Thompson-sampling allocator on a fixed interval."

    def add_arguments(self, parser):
        parser.add_argument(
            "--interval", type=int,
            default=int(os.environ.get("BANDIT_ALLOCATOR_INTERVAL", "1800")),
            help="Seconds between allocator ticks (default 1800 = 30 min).",
        )
        parser.add_argument("--draws", type=int, default=5000)

    def handle(self, *args, **opts):
        interval = max(10, opts["interval"])
        draws = opts["draws"]

        self._stop = False
        for sig in (signal.SIGINT, signal.SIGTERM):
            signal.signal(sig, self._handle_stop)

        self.stdout.write(self.style.SUCCESS(
            f"[allocator-loop] starting · interval={interval}s · draws={draws}"
        ))

        while not self._stop:
            tick_started = time.monotonic()
            try:
                self._tick(draws=draws)
            except Exception as exc:  # noqa: BLE001 — loop must not die on transient errors
                self.stderr.write(self.style.ERROR(f"[allocator-loop] tick failed: {exc!r}"))

            # Interruptible sleep so SIGTERM exits promptly
            elapsed = time.monotonic() - tick_started
            remaining = max(1.0, interval - elapsed)
            slept = 0.0
            while slept < remaining and not self._stop:
                time.sleep(min(1.0, remaining - slept))
                slept += 1.0

        self.stdout.write("[allocator-loop] stopped")

    def _tick(self, draws: int) -> None:
        qs = Experiment.objects.filter(status="trial").prefetch_related("variants")
        count = 0
        shipped = 0
        for exp in qs:
            r = _allocate(exp, draws=draws)
            count += 1
            if r.get("shipped"):
                shipped += 1
        if count:
            now = timezone.now().strftime("%H:%M:%S")
            msg = f"[{now}] allocated {count} trial experiment(s)"
            if shipped:
                msg += f" · shipped {shipped}"
            self.stdout.write(msg)

    def _handle_stop(self, *_):
        self._stop = True
