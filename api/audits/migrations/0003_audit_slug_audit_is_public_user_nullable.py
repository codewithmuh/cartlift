"""Adds slug + is_public to Audit, and makes user nullable for guest audits.

Backfill: every existing row gets a fresh slug. `is_public=False` for all
historical rows — those were dashboard-created, not landing-page guest audits.
"""
from django.conf import settings
from django.db import migrations, models

import audits.models


def backfill_slugs(apps, schema_editor):
    Audit = apps.get_model("audits", "Audit")
    for a in Audit.objects.filter(slug=""):
        a.slug = audits.models._gen_slug()
        a.save(update_fields=["slug"])


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("audits", "0002_audit_audit_type_audit_report"),
    ]

    operations = [
        migrations.AlterField(
            model_name="audit",
            name="user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.CASCADE,
                related_name="audits",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        # Add slug as a plain CharField first (no index, no unique) so existing
        # rows can be backfilled without colliding on the empty default. The
        # final AlterField below promotes it to unique+indexed in one step,
        # which avoids the "_like index already exists" intra-transaction clash
        # that happens when you flip db_index→unique on a varchar column.
        migrations.AddField(
            model_name="audit",
            name="slug",
            field=models.CharField(blank=True, default="", max_length=24),
        ),
        migrations.RunPython(backfill_slugs, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="audit",
            name="slug",
            field=models.CharField(
                db_index=True, default=audits.models._gen_slug, max_length=24, unique=True,
                help_text="Short URL-safe id used for public /audit/<slug> share pages.",
            ),
        ),
        migrations.AddField(
            model_name="audit",
            name="is_public",
            field=models.BooleanField(
                default=False,
                help_text="Created via the landing-page URL input; safe to render on /audit/<slug>.",
            ),
        ),
    ]
