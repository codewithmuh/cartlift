import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "conf.settings")
application = get_wsgi_application()
# Vercel's @vercel/python builder looks for `app` by default.
app = application
