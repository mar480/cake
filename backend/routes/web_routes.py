import os

from flask import render_template, send_from_directory


def register_web_routes(app):
    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/assets/<path:filename>")
    def serve_assets(filename):
        return send_from_directory(os.path.join(app.static_folder, "assets"), filename)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def catch_all(path):
        if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return render_template("index.html")
