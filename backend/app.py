import os
import argparse

from flask import Flask, jsonify, request

from routes.api_routes import register_api_routes
from routes.web_routes import register_web_routes

app = Flask(__name__, static_folder="static", template_folder="templates")

TAXONOMY_BASE_DIR = os.path.join(os.path.dirname(__file__), "taxonomies")


@app.errorhandler(404)
def handle_404(err):
    """
    Ensure API clients always receive JSON, not HTML error pages.
    """
    if request.path.startswith("/api/"):
        return jsonify({"error": "Not found", "path": request.path}), 404
    return err


@app.errorhandler(405)
def handle_405(err):
    """
    Ensure API clients always receive JSON, not HTML error pages.
    """
    if request.path.startswith("/api/"):
        return (
            jsonify(
                {
                    "error": "Method not allowed",
                    "path": request.path,
                    "method": request.method,
                }
            ),
            405,
        )
    return err


@app.errorhandler(Exception)
def handle_unexpected_error(err):
    """
    Prevent Flask's default HTML 500 page for API routes.
    """
    if request.path.startswith("/api/"):
        print(f"[api-error] {request.path}: {err}")
        return jsonify({"error": "Internal server error"}), 500
    raise err


register_web_routes(app)
register_api_routes(app, TAXONOMY_BASE_DIR)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=5000, help="Port to run the Flask app on")
    args = parser.parse_args()

    app.run(debug=True, port=args.port)