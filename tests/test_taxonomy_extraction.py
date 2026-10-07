"""Exercise ZIP registration, offline extraction and notebook parity on real Arelle models."""
from pathlib import Path
import json
import sys
import zipfile

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'backend'))
from taxonomy_pipeline.pipeline import build
from taxonomy_pipeline.artifacts import read_json, validate_release


def taxonomy_zip(tmp_path, namespace='http://xbrl.frc.org.uk/test', kind='uk', missing=False):
    package = tmp_path/f'{kind}.zip'
    schema = f'''<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xbrli="http://www.xbrl.org/2003/instance" xmlns:link="http://www.xbrl.org/2003/linkbase" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:core="{namespace}" targetNamespace="{namespace}" elementFormDefault="qualified">
      <xs:import namespace="http://www.xbrl.org/2003/instance" schemaLocation="{'https://missing.example.test/dependency.xsd' if missing else 'http://www.xbrl.org/2003/xbrl-instance-2003-12-31.xsd'}"/>
      <xs:annotation><xs:appinfo><link:linkbaseRef xlink:type="simple" xlink:href="labels.xml" xlink:role="http://www.xbrl.org/2003/role/link" xlink:arcrole="http://www.w3.org/1999/xlink/properties/linkbase"/></xs:appinfo></xs:annotation>
      <xs:element id="Revenue" name="Revenue" substitutionGroup="xbrli:item" type="xbrli:monetaryItemType" xbrli:periodType="duration" xbrli:balance="credit" nillable="true"/>
    </xs:schema>'''
    metadata = f'''<taxonomyPackage xmlns="http://xbrl.org/2016/taxonomy-package" xml:lang="en"><identifier>urn:test:{kind}</identifier><name>{kind}</name><version>1</version><publisher>Test</publisher><publicationDate>2026-10-07</publicationDate><entryPoints><entryPoint><name>Main</name><entryPointDocument href="https://example.test/{kind}/main.xsd"/></entryPoint></entryPoints></taxonomyPackage>'''
    catalog = f'''<catalog xmlns="urn:oasis:names:tc:entity:xmlns:xml:catalog"><rewriteURI uriStartString="https://example.test/{kind}/" rewritePrefix="../"/></catalog>'''
    labels = '''<link:linkbase xmlns:link="http://www.xbrl.org/2003/linkbase" xmlns:xlink="http://www.w3.org/1999/xlink"><link:labelLink xlink:type="extended" xlink:role="http://www.xbrl.org/2003/role/link"><link:loc xlink:type="locator" xlink:href="main.xsd#Revenue" xlink:label="r"/><link:label xlink:type="resource" xlink:label="en" xlink:role="http://www.xbrl.org/2003/role/label" xml:lang="en">Revenue</link:label><link:label xlink:type="resource" xlink:label="cy" xlink:role="http://www.xbrl.org/2003/role/label" xml:lang="cy">Refeniw</link:label><link:labelArc xlink:type="arc" xlink:arcrole="http://www.xbrl.org/2003/arcrole/concept-label" xlink:from="r" xlink:to="en"/><link:labelArc xlink:type="arc" xlink:arcrole="http://www.xbrl.org/2003/arcrole/concept-label" xlink:from="r" xlink:to="cy"/></link:labelLink></link:linkbase>'''
    with zipfile.ZipFile(package, 'w') as z:
        for relative, content in [('META-INF/taxonomyPackage.xml', metadata), ('META-INF/catalog.xml',catalog), ('main.xsd',schema), ('labels.xml',labels)]:
            z.writestr(f'{kind}/{relative}', content)
    return package


@pytest.mark.parametrize('kind,namespace', [('uk','http://xbrl.frc.org.uk/test'), ('charities','http://xbrl.frc.org.uk/char/test'), ('irish','http://xbrl.frc.org.uk/ireland/test'), ('uk','https://www.ifrs.org/test'), ('lloyds','http://www.lloyds.com/test')])
def test_real_offline_zip_build_profiles_and_reuse(tmp_path, kind, namespace):
    package = taxonomy_zip(tmp_path, namespace, kind)
    release = build('2099', 'Test suite', [(kind,str(package))], [], tmp_path/'output')
    manifest = validate_release(release)
    concepts = read_json(release/manifest['entrypoints'][0]['data_path']/'concepts.json.gz')
    assert len(concepts) == 1
    labels = next(iter(concepts.values()))['labels']
    assert {item['label_text'] for item in labels} == {'Revenue','Refeniw'}
    assert build('2099', 'Test suite', [(kind,str(package))], [], tmp_path/'output') == release


def test_missing_dependency_is_explicit_and_never_installed(tmp_path):
    package = taxonomy_zip(tmp_path, missing=True)
    with pytest.raises(ValueError, match='Offline load failed'):
        build('2099','Test', [('uk',str(package))], [], tmp_path/'output')
    assert not list((tmp_path/'output').glob('*/manifest.json'))


def notebook_namespace():
    """Execute definitions only; never notebook orchestration or machine-specific examples."""
    import ast
    from taxonomy_pipeline.helpers import elr_sort_key, extract_elr_numeric_part
    candidates = [ROOT/'archive/taxonomy-notebooks/unified_tree_generator.ipynb', ROOT/'backend/taxonomies/unified_tree_generator.ipynb']
    notebook = next(path for path in candidates if path.exists())
    source = ''.join(json.loads(notebook.read_text())['cells'][0]['source'])
    tree = ast.parse(source)
    tree.body = [node for node in tree.body if not isinstance(node, ast.Try)]
    namespace = {'elr_sort_key': elr_sort_key, 'extract_elr_numeric_part': extract_elr_numeric_part}
    exec(compile(tree, str(notebook), 'exec'), namespace)
    return namespace


@pytest.mark.parametrize('kind,namespace', [('uk','http://xbrl.frc.org.uk/test'), ('charities','http://xbrl.frc.org.uk/char/test'), ('irish','http://xbrl.frc.org.uk/ireland/test'), ('uk','https://www.ifrs.org/test'), ('lloyds','http://www.lloyds.com/test')])
def test_extracted_module_matches_notebook_on_real_models(tmp_path, kind, namespace):
    from arelle import Cntlr, PackageManager
    from taxonomy_pipeline import extraction
    from taxonomy_pipeline.helpers import STANDARD_HINTS, LLOYDS_HINTS
    package = taxonomy_zip(tmp_path, namespace, kind)
    legacy = notebook_namespace()
    hints = LLOYDS_HINTS if kind == 'lloyds' else STANDARD_HINTS
    legacy['TAXONOMY_NAMESPACE_HINTS'] = hints
    controller = Cntlr.Cntlr(logFileName='logToBuffer', disable_persistent_config=True)
    controller.webCache.workOffline = True
    controller.webCache.cacheDir = str(tmp_path/'isolated-cache')
    PackageManager.init(controller, loadPackagesConfig=False)
    try:
        assert PackageManager.addPackage(controller, str(package))
        PackageManager.rebuildRemappings(controller)
        model = controller.modelManager.load(f'https://example.test/{kind}/main.xsd')
        try:
            assert not model.errors
            assert extraction.ConceptDetailsExtractor(model, hints).get_all_concept_details() == legacy['ConceptDetailsExtractor'](model).get_all_concept_details()
            for name in ['extract_hypercubes','extract_dimensions','extract_hypercube_primary_items']:
                assert getattr(extraction,name)(model) == legacy[name](model)
        finally:
            model.close()
    finally:
        controller.close()


def test_new_occurrence_ids_distinguish_repeated_paths_and_are_reproducible():
    from types import SimpleNamespace
    from taxonomy_pipeline.extraction import recurse_concept
    concept = SimpleNamespace(qname='core:Revenue', typeQname=None, substitutionGroupQname=None, isAbstract=False, label=lambda **kwargs: 'Revenue')
    relset = SimpleNamespace(fromModelObject=lambda c: [])
    first = recurse_concept(concept,relset,'urn:elr',arcrole='urn:presentation',occurrence_path=(0,))
    assert first == recurse_concept(concept,relset,'urn:elr',arcrole='urn:presentation',occurrence_path=(0,))
    assert first['uuid'] != recurse_concept(concept,relset,'urn:elr',arcrole='urn:presentation',occurrence_path=(1,))['uuid']
    assert first['uuid'] != recurse_concept(concept,relset,'urn:elr',arcrole='urn:definition',occurrence_path=(0,))['uuid']


def test_relative_entrypoint_identity_is_stable(tmp_path):
    package = taxonomy_zip(tmp_path)
    rewritten = tmp_path/'relative.zip'
    with zipfile.ZipFile(package) as src, zipfile.ZipFile(rewritten,'w') as dest:
        for name in src.namelist():
            data = src.read(name)
            if name.endswith('taxonomyPackage.xml'):
                data = data.replace(b'https://example.test/uk/main.xsd',b'../main.xsd')
            dest.writestr(name,data)
    release = build('2099','Relative',[('uk',str(rewritten))],[],tmp_path/'output')
    assert validate_release(release)['entrypoints'][0]['href'] == '../main.xsd'
