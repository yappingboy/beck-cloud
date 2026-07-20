from django.urls import path
from django.views.generic import TemplateView
from django.views.static import serve
import os

hosting = os.environ.get("HOSTING_DIR", "/hosting")

urlpatterns = [
    path("", TemplateView.as_view(template_name="index.html"), name="home"),
    path("robots.txt", serve, {"path": "robots.txt", "document_root": hosting}),
    path("favicon.svg", serve, {"path": "favicon.svg", "document_root": hosting}),
    path("css/<path:path>", serve, {"document_root": os.path.join(hosting, "css")}),
    path("js/<path:path>", serve, {"document_root": os.path.join(hosting, "js")}),
]
