"""Release integrity, HTTP caching and revision isolation."""
import gzip
import json
from pathlib import Path
import sys
from concurrent.futures import ThreadPoolExecutor
from threading import Event

import pytest
from flask import Flask

BACKEND = Path(__file__).resolve().parents[1] / 'backend'
sys.path.insert(0, str(BACKEND))
from taxonomy_pipeline.artifacts import NETWORKS, REQUIRED_FILES, read_json, validate_release
from taxonomy_pipeline.pipeline import package_payloads, install, extract_zip
from routes.api_routes import register_api_routes
from search import cache


def make_payload(label='Revenue'):
    payloads = {name: [] for name in REQUIRED_FILES}
    payloads['concepts'] = {'core:Revenue': {'concept': {'local_name': 'Revenue', 'namespace': 'urn:frc:test'}, 'labels': [{'lang': 'en', 'type': 'Standard Label', 'label_text': label}], 'hypercubes': [], 'references': []}}
    payloads['presentation_tree'] = [{'elr': 'urn:statement', 'definition': '100 - Statement', 'numeric_part': 100, 'root_tree': [{'uuid': 'existing-uuid', 'qname': 'core:Revenue', 'name': label, 'children': []}]}]
    return payloads


def make_release(tmp_path, label='Revenue', suite='2099'):
    ep = {'name': 'Main', 'label': 'Main', 'href': 'https://example.test/main.xsd', 'group': None, 'package': 'uk'}
    return package_payloads(suite, suite, [(ep, make_payload(label))], tmp_path/'build', {'mode': 'test'})


def client_for(target):
    app = Flask(__name__)
    app.testing = True
    register_api_routes(app, str(target))
    return app.test_client()


def manifest_url(release):
    m = read_json(release/'manifest.json')
    return {'year': m['suite'], 'href': m['entrypoints'][0]['href']}


def test_bundle_preserves_all_networks_uuid_and_precomputed_filters(tmp_path):
    release = make_release(tmp_path)
    manifest = validate_release(release)
    payload = read_json(release / manifest['entrypoints'][0]['bundle'])
    assert set(payload['trees']) == {n+'_tree' for n in NETWORKS}
    assert payload['trees']['presentation_tree'][0]['root_tree'][0]['uuid'] == 'existing-uuid'
    assert 'concepts' not in payload['trees']
    assert payload['filterOptions']['namespace'] == ['urn:frc:test']
    assert make_release(tmp_path) == release


def test_http_gzip_identity_quality_and_conditional_cache(tmp_path):
    release = make_release(tmp_path)
    target = tmp_path/'installed'
    install(release, target)
    client = client_for(target)
    response = client.get('/api/entrypoint-manifest', query_string=manifest_url(release))
    assert response.status_code == 200
    assert response.headers['Cache-Control'] == 'no-cache'
    assert client.get('/api/entrypoint-manifest', query_string=manifest_url(release), headers={'If-None-Match': response.headers['ETag']}).status_code == 304
    url = response.json['bundleUrl']
    identity = client.get(url)
    compressed = client.get(url, headers={'Accept-Encoding': 'gzip'})
    assert compressed.headers['Content-Encoding'] == 'gzip'
    assert compressed.mimetype == 'application/json'
    assert compressed.headers['Vary'] == 'Accept-Encoding'
    assert 'immutable' in compressed.headers['Cache-Control']
    assert gzip.decompress(compressed.data) == identity.data
    assert 'concepts' not in identity.json['trees']
    assert client.get(url, headers={'Accept-Encoding': 'gzip;q=0'}).data == identity.data
    assert client.get(url, headers={'Accept-Encoding': 'gzip;q=0.5, identity;q=0.8'}).data == identity.data
    assert client.get(url, headers={'Accept-Encoding': 'gzip;q=0, identity;q=0'}).status_code == 406
    assert client.get(url, headers={'Accept-Encoding': 'gzip', 'If-None-Match': compressed.headers['ETag']}).status_code == 304
    assert client.get('/api/taxonomies').json['suites'][0]['value'] == '2099'


def test_corruption_and_incomplete_build_leave_current_release_usable(tmp_path):
    release = make_release(tmp_path)
    target = tmp_path/'installed'
    install(release, target)
    before = (target/'catalog.json').read_bytes()
    manifest = read_json(release/'manifest.json')
    (release/manifest['entrypoints'][0]['bundle']).write_text('{}')
    with pytest.raises(ValueError, match='checksum'):
        install(release, target)
    assert (target/'catalog.json').read_bytes() == before
    payloads = make_payload()
    del payloads['dimensions']
    with pytest.raises(ValueError, match='Missing'):
        package_payloads('2099', '2099', [(manifest['entrypoints'][0], payloads)], tmp_path/'broken', {})
    assert not list((tmp_path/'broken').iterdir())
    client = client_for(target)
    assert client.get('/api/entrypoint-manifest', query_string=manifest_url(release)).status_code == 200


def test_pinned_data_search_export_and_legacy_loading_survive_new_release(tmp_path):
    old = make_release(tmp_path, 'Old label')
    target = tmp_path/'installed'
    install(old, target)
    client = client_for(target)
    params = manifest_url(old)
    revision = client.get('/api/entrypoint-manifest', query_string=params).json['revision']
    new = make_release(tmp_path, 'New label')
    install(new, target)
    details = client.get('/api/concept-details', query_string={**params, 'revision': revision, 'qname': 'core:Revenue'})
    assert details.json['labels'][0]['label_text'] == 'Old label'
    current = client.get('/api/concept-details', query_string={**params, 'qname': 'core:Revenue'})
    assert current.json['labels'][0]['label_text'] == 'New label'
    body = {**params, 'revision': revision, 'q': 'Old', 'filters': {}, 'limit': 25, 'offset': 0}
    assert client.post('/api/search-concepts', json=body).json['results'][0]['label'] == 'Old label'
    assert client.post('/api/search-concepts/export', json={**body, 'format': 'json', 'fields': ['qname','label']}).json[0]['label'] == 'Old label'
    legacy = client.post('/api/load-entrypoint', json=params)
    assert legacy.status_code == 200 and 'concepts' in legacy.json['trees']
    assert client.get('/api/concept-details', query_string={**params, 'revision': '0'*64, 'qname': 'core:Revenue'}).status_code == 404
    assert client.get('/api/entrypoint-manifest', query_string={**params, 'href':'other.xsd'}).status_code == 404
    assert client.get('/api/search-filter-options', query_string={**params, 'revision': revision}).json['namespace'] == ['urn:frc:test']
    assert client.get('/api/search-filter-options', query_string={**params, 'href': 'other.xsd'}).status_code == 404


def test_lazy_search_cache_is_bounded_and_single_construction():
    cache._search_index_cache.clear()
    entered, finish = Event(), Event()
    calls = []
    def build():
        calls.append(True)
        entered.set()
        assert finish.wait(5)
        return object()
    with ThreadPoolExecutor(max_workers=4) as workers:
        futures = [workers.submit(cache.get_or_build_search_index, 'one', build) for _ in range(4)]
        assert entered.wait(5)
        finish.set()
        values = [f.result() for f in futures]
    assert len(calls) == 1 and all(v is values[0] for v in values)
    for i in range(cache.MAX_INDEXES+2):
        cache.set_search_index(str(i), object())
    assert len(cache._search_index_cache) == cache.MAX_INDEXES
    assert cache.get_search_index('one') is None


def test_zip_escape_and_invalid_zip_are_rejected(tmp_path):
    import zipfile
    zip_path = tmp_path/'bad.zip'
    with zipfile.ZipFile(zip_path, 'w') as z:
        z.writestr('../escape', 'bad')
    with pytest.raises(ValueError, match='escapes'):
        extract_zip(zip_path, tmp_path/'extracted')
    zip_path.write_text('invalid')
    with pytest.raises(zipfile.BadZipFile):
        extract_zip(zip_path, tmp_path/'extracted')


def test_export_roundtrip_preserves_data_mapping_and_provenance(tmp_path):
    from taxonomy_pipeline.pipeline import export_source, package_existing
    release = make_release(tmp_path)
    target = tmp_path/'sources'
    suite = export_source(release, target)
    assert read_json(suite/'source-release.json')['revision'] == release.name
    exported = package_existing(target, '2099', '2099', tmp_path/'repack')
    assert package_existing(target, '2099', '2099', tmp_path/'repack') == exported
    m = validate_release(exported)
    assert read_json(exported/m['entrypoints'][0]['data_path']/'presentation_tree.json.gz') == make_payload()['presentation_tree']
    with pytest.raises(ValueError, match='already exists'):
        export_source(release, target)
    export_source(release, target, replace=True)
    assert len(list((target/'backup').glob('*/2099'))) == 1


def test_gzip_only_loading_and_unknown_revision_never_use_other_release(tmp_path):
    release = make_release(tmp_path)
    target = tmp_path/'installed'
    install(release,target)
    client = client_for(target)
    params = manifest_url(release)
    response = client.post('/api/dimensional-relationships',json={**params,'revision':release.name,'qname':'core:Revenue'})
    assert response.status_code == 200
    assert client.get('/api/entrypoint-manifest',query_string={**params,'revision':'../bad'}).status_code == 400
    assert client.post('/api/search-concepts',json={**params,'revision':'0'*64,'q':'Revenue'}).status_code == 404


def test_legacy_tree_directory_normalization(tmp_path, monkeypatch):
    from services import search_filters
    trees = tmp_path/'2099'/'trees'/'CORE.full'
    trees.mkdir(parents=True)
    monkeypatch.setattr(search_filters, 'get_entrypoints_for_year', lambda *args, **kwargs: [
        {'href': 'https://example.test/main.xsd', 'name': 'Core Full'}
    ])
    assert search_filters.resolve_legacy_tree_dir(str(tmp_path), '2099', 'https://example.test/main.xsd') == str(trees)


def test_filter_order_is_stable_across_processes(tmp_path):
    import os
    import subprocess
    payload = make_payload()
    payload['concepts']['core:Revenue']['references'] = [
        {'name': 'IAS', 'number': '40', 'paragraph': paragraph}
        for paragraph in ['75.a', '75 .a', '81c', '81.c', '82 (b)', '82(b)']
    ]
    source = tmp_path/'concepts.json'
    source.write_text(json.dumps(payload['concepts']))
    script = 'import json,sys; from services.search_filters import build_search_filter_options_from_concepts; print(json.dumps(build_search_filter_options_from_concepts(json.load(open(sys.argv[1]))),sort_keys=True))'
    results = [subprocess.check_output([sys.executable, '-c', script, str(source)],
        env={**os.environ, 'PYTHONPATH': str(BACKEND), 'PYTHONHASHSEED': seed}) for seed in ['1', '2', '3']]
    assert len(set(results)) == 1
