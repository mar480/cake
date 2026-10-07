"""Local delivery benchmark. Network and browser timings must be measured separately."""
import argparse
import contextlib
import gzip
import io
import json
import time


def main():
    from app import app
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--suite', default='2027')
    parser.add_argument('--href', default='https://xbrl.frc.org.uk/FRS-102/2027-01-01/FRS-102-2027-01-01.xsd')
    args = parser.parse_args()
    client = app.test_client()
    query = {'year': args.suite, 'href': args.href}
    rows = []
    for iteration in range(2):
        start = time.perf_counter()
        with contextlib.redirect_stdout(io.StringIO()):
            response = client.get('/api/entrypoint-manifest', query_string=query)
            if response.status_code != 200:
                raise RuntimeError(response.json)
            bundle = client.get(response.json['bundleUrl'], headers={'Accept-Encoding':'gzip'})
            compressed = bundle.data
        delivery = time.perf_counter()-start
        start = time.perf_counter()
        identity = gzip.decompress(compressed)
        payload = json.loads(identity)
        parse = time.perf_counter()-start
        rows.append({'load':iteration+1, 'server_ms':round(delivery*1000,2),
                     'gzip_bytes':len(compressed), 'identity_bytes':len(identity),
                     'python_decompress_parse_ms':round(parse*1000,2),
                     'networks':len(payload['trees']),
                     'ideal_transfer_at_10_mbps_seconds':round(len(compressed)*8/10_000_000,3)})
    print(json.dumps(rows, indent=2))


if __name__ == '__main__':
    main()
