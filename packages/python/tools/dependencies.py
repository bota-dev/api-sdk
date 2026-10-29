"""Frozen public wheel inputs and installed SDK/build dependency qualification."""
from __future__ import annotations

import argparse
import hashlib
import importlib.metadata as metadata
import json
from pathlib import Path
import re
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
RELEASES = {
    'aiohappyeyeballs': '2.7.1', 'aiohttp': '3.14.5', 'aiosignal': '1.4.0',
    'attrs': '26.1.0', 'flit-core': '4.1.0', 'frozenlist': '1.8.0',
    'idna': '3.20', 'multidict': '7.2.0', 'propcache': '0.5.4',
    'ty': '0.0.91', 'typing-extensions': '4.16.0', 'yarl': '1.25.1',
}
LICENSES = {
    'aiohappyeyeballs': 'PSF-2.0', 'aiohttp': 'Apache-2.0 AND MIT',
    'aiosignal': 'Apache-2.0', 'attrs': 'MIT', 'flit-core': 'BSD-3-Clause',
    'frozenlist': 'Apache-2.0', 'idna': 'BSD-3-Clause', 'multidict': 'Apache-2.0',
    'propcache': 'Apache-2.0', 'ty': 'MIT', 'typing-extensions': 'PSF-2.0',
    'yarl': 'Apache-2.0',
}
BUILD_ONLY = {'flit-core', 'ty'}
ADMITTED = {'MIT', 'Apache-2.0', 'Apache-2.0 AND MIT', 'BSD-3-Clause', 'PSF-2.0'}


def normalize(name: str) -> str:
    return re.sub(r'[-_.]+', '-', name).lower()


def canonical(value: object) -> str:
    return json.dumps(value, sort_keys=True, indent=2, ensure_ascii=True) + '\n'


def license_fields(info: dict[str, object]) -> dict[str, object]:
    return {
        'expression': info.get('license_expression'), 'legacy': info.get('license'),
        'classifiers': sorted(x for x in info.get('classifiers', []) if isinstance(x, str) and x.startswith('License ::')),
    }


def recognized_license(fields: dict[str, object]) -> str:
    expression = fields.get('expression')
    if expression is not None:
        if expression not in ADMITTED:
            raise ValueError('Unreviewed declared license expression')
        return str(expression)
    legacy = fields.get('legacy')
    if legacy in ADMITTED:
        return str(legacy)
    if legacy == 'Apache 2.0':
        return 'Apache-2.0'
    if legacy is None and fields.get('classifiers') == ['License :: OSI Approved :: MIT License']:
        return 'MIT'
    raise ValueError('Missing, ambiguous or unreviewed declared license')


def dependency_declarations(values: list[str]) -> list[tuple[str, ...]]:
    """Compare bounded declaration tokens; preserve names, markers and quoted text."""
    result = []
    pattern = re.compile(r'''\s+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z0-9_.+\-]+|===|==|!=|<=|>=|~=|[<>,;()\[\]@/:*]''')
    for value in values:
        if not isinstance(value, str) or len(value) > 4096:
            raise ValueError('Unsupported dependency declaration')
        position = 0
        tokens = []
        while position < len(value):
            match = pattern.match(value, position)
            if match is None or len(tokens) >= 512:
                raise ValueError('Unsupported dependency declaration')
            token = match.group()
            if not token.isspace():
                tokens.append(token)
            position = match.end()
        if not tokens:
            raise ValueError('Empty dependency declaration')
        result.append(tuple(tokens))
    return sorted(result)


def validate_policy(policy: dict[str, object]) -> None:
    if set(policy) != {'format_version', 'boundary', 'packages'} or policy['format_version'] != 1:
        raise ValueError('Unsupported dependency policy')
    packages = policy['packages']
    if not isinstance(packages, dict) or set(packages) != set(RELEASES):
        raise ValueError('Dependency inventory drift')
    for name, version in RELEASES.items():
        item = packages[name]
        if set(item) != {'version', 'source', 'release_json_sha256', 'license', 'admitted_license', 'requires_dist', 'wheels'}:
            raise ValueError('Unsupported release metadata')
        if item['version'] != version or item['source'] != f'https://pypi.org/pypi/{name}/{version}/json':
            raise ValueError('Dependency source drift')
        if recognized_license(item['license']) != item['admitted_license'] or item['admitted_license'] != LICENSES[name]:
            raise ValueError('Dependency license drift')
        if not re.fullmatch('[a-f0-9]{64}', item['release_json_sha256']) or not isinstance(item['requires_dist'], list):
            raise ValueError('Invalid release identity')
        if not item['wheels'] or item['wheels'] != sorted(item['wheels'], key=lambda x: x['filename']):
            raise ValueError('Invalid wheel inventory')
        seen: set[str] = set()
        for wheel in item['wheels']:
            if set(wheel) != {'filename', 'sha256', 'url'} or not re.fullmatch(r'[A-Za-z0-9_.+\-]+\.whl', wheel['filename']):
                raise ValueError('Invalid wheel file')
            if wheel['filename'] in seen or not re.fullmatch('[a-f0-9]{64}', wheel['sha256']):
                raise ValueError('Duplicate or unhashed wheel')
            if not wheel['url'].startswith('https://files.pythonhosted.org/packages/') or not wheel['url'].endswith('/' + wheel['filename']) or '?' in wheel['url'] or '#' in wheel['url']:
                raise ValueError('Untrusted wheel origin')
            seen.add(wheel['filename'])


def render_lock(policy: dict[str, object], tooling: bool) -> str:
    validate_policy(policy)
    lines = ['# Generated from policy.json; wheel hashes only. No source-build fallback.',
             '# CPython 3.12-3.15 normal builds; runtime availability is separately qualified.']
    if tooling:
        lines += ['-r runtime.txt']
    for name, item in policy['packages'].items():
        if (name in BUILD_ONLY) != tooling:
            continue
        marker = '; python_version < "3.13"' if name == 'typing-extensions' else ''
        lines.append(f'{name}=={item["version"]}{marker} \\')
        hashes = sorted({wheel['sha256'] for wheel in item['wheels']})
        lines += [f'    --hash=sha256:{value}' + (' \\' if n + 1 < len(hashes) else '') for n, value in enumerate(hashes)]
    return '\n'.join(lines) + '\n'


def refresh() -> None:
    packages = {}
    for name, version in RELEASES.items():
        source = f'https://pypi.org/pypi/{name}/{version}/json'
        # Only pinned RELEASES entries and this literal HTTPS PyPI origin form the URL.
        # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
        with urllib.request.urlopen(source, timeout=30) as response:
            raw = response.read(8 * 1024 * 1024 + 1)
        if len(raw) > 8 * 1024 * 1024:
            raise ValueError('Release metadata too large')
        data = json.loads(raw)
        if normalize(data['info']['name']) != name or data['info']['version'] != version:
            raise ValueError('Release metadata identity mismatch')
        fields = license_fields(data['info'])
        packages[name] = {
            'version': version, 'source': source, 'release_json_sha256': hashlib.sha256(raw).hexdigest(),
            'license': fields, 'admitted_license': recognized_license(fields),
            'requires_dist': sorted(data['info'].get('requires_dist') or []),
            'wheels': sorted([{'filename': entry['filename'], 'sha256': entry['digests']['sha256'], 'url': entry['url']}
                              for entry in data['urls'] if entry['packagetype'] == 'bdist_wheel' and not entry.get('yanked')], key=lambda x: x['filename']),
        }
    policy = {'format_version': 1, 'boundary': 'Frozen wheel metadata; does not qualify runtime compatibility or registry authority.', 'packages': packages}
    validate_policy(policy)
    destination = ROOT / 'requirements'
    destination.mkdir(exist_ok=True)
    (destination / 'policy.json').write_text(canonical(policy), encoding='utf-8', newline='\n')
    for tooling, name in [(False, 'runtime.txt'), (True, 'qualification.txt')]:
        (destination / name).write_text(render_lock(policy, tooling), encoding='utf-8', newline='\n')


def installed(policy: dict[str, object], runtime_only: bool = False, include_sdk: bool = False) -> dict[str, object]:
    validate_policy(policy)
    expected = set(RELEASES) - (BUILD_ONLY if runtime_only else set())
    if sys.version_info >= (3, 13):
        expected.remove('typing-extensions')
    found: dict[str, metadata.Distribution] = {}
    for item in metadata.distributions():
        name = normalize(item.metadata['Name'])
        if name in found:
            raise ValueError('Duplicate installed distribution')
        found[name] = item
    # The CPython venv seed installer is outside the SDK dependency closure; report it explicitly.
    if include_sdk:
        sdk = found.get('bota-api-sdk')
        if sdk is None or sdk.version != '0.1.0b0' or sdk.metadata.get('License-Expression') != 'MIT':
            raise ValueError('Installed SDK identity/license mismatch')
    if set(found) - expected - ({'pip', 'bota-api-sdk'} if include_sdk else {'pip'}) or not expected.issubset(found):
        raise ValueError('Installed dependency inventory mismatch')
    records = {}
    for name in sorted(expected):
        item = found[name]
        info = item.metadata
        fields = {'expression': info.get('License-Expression'), 'legacy': info.get('License'),
                  'classifiers': sorted(x for x in info.get_all('Classifier', []) if x.startswith('License ::'))}
        if item.version != RELEASES[name] or fields != policy['packages'][name]['license'] or recognized_license(fields) != LICENSES[name]:
            raise ValueError(f'Installed dependency identity/license mismatch: {name}')
        if dependency_declarations(info.get_all('Requires-Dist', [])) != dependency_declarations(policy['packages'][name]['requires_dist']):
            raise ValueError(f'Installed dependency declaration drift: {name}')
        if info.get('Requires-Dist') and not item.files:
            raise ValueError('Installed dependency has no file inventory')
        records[name] = {'version': item.version, 'admitted_license': LICENSES[name],
                         'metadata_sha256': hashlib.sha256(item.read_text('METADATA').encode('utf-8')).hexdigest()}
    return {'status': 'qualified-installed-dependency-metadata', 'python': sys.version.split()[0],
            'seed_installer': {'name': 'pip', 'version': found['pip'].version} if 'pip' in found else None,
            'packages': records}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--refresh', action='store_true', help='Explicit public metadata update; review all resulting changes.')
    group.add_argument('--check', action='store_true')
    group.add_argument('--installed', action='store_true')
    parser.add_argument('--runtime-only', action='store_true')
    parser.add_argument('--include-sdk', action='store_true')
    options = parser.parse_args()
    if options.refresh:
        refresh()
    policy = json.loads((ROOT / 'requirements/policy.json').read_text(encoding='utf-8'))
    validate_policy(policy)
    for tooling, name in [(False, 'runtime.txt'), (True, 'qualification.txt')]:
        if (ROOT / 'requirements' / name).read_text(encoding='utf-8') != render_lock(policy, tooling):
            raise ValueError('Frozen dependency lock drift')
    if options.installed:
        print(canonical(installed(policy, options.runtime_only, options.include_sdk)), end='')
    else:
        print(f'Checked {len(RELEASES)} frozen public releases and wheel-only hash locks.')


if __name__ == '__main__':
    main()
