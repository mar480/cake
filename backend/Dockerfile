FROM python:3.12-slim AS dependencies
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

FROM dependencies AS taxonomy-build
COPY . .
RUN python -m taxonomy_pipeline prepare-all

FROM dependencies AS runtime
COPY app.py wsgi.py state.py reference_utils.py ./
COPY routes ./routes
COPY services ./services
COPY search ./search
COPY xbrl ./xbrl
COPY taxonomy_pipeline ./taxonomy_pipeline
COPY templates ./templates
COPY static ./static
COPY --from=taxonomy-build /app/taxonomies/releases ./taxonomies/releases
COPY --from=taxonomy-build /app/taxonomies/catalog.json ./taxonomies/catalog.json
EXPOSE 8000
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "1", "--threads", "4", "--timeout", "180", "wsgi:app"]
