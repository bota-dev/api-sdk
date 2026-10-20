"""Acquire only reviewed public wheels explicitly; install hash-locked inputs offline."""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

TOOLS = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('bota_dependency_policy', TOOLS / 'dependencies.py')
policy_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy_module)
ROOT = TOOLS.parent


def safe_environment() -> dict[str, str]:
    allowed = {'path', 'pathext', 'systemroot', 'systemdrive', 'windir', 'comspec', 'temp', 'tmp', 'os'}
    result = {key: value for key, value in os.environ.items() if key.lower() in allowed}
    result['PIP_CONFIG_FILE'] = os.devnull
    result['NETRC'] = os.devnull
    result['NO_PROXY'] = '*'
    return result


def verify_wheelhouse(directory: Path, policy: dict[str, object]) -> dict[str, str]:
    if directory.is_symlink() or not directory.is_dir() or any(part.is_symlink() for part in directory.parents):
        raise ValueError('Wheelhouse must be a regular directory without linked parents')
    allowed = {wheel['filename']: wheel['sha256'] for item in policy['packages'].values() for wheel in item['wheels']}
    result = {}
    for path in sorted(directory.iterdir()):
        if path.is_symlink() or not path.is_file() or path.name not in allowed:
            raise ValueError('Unknown or linked wheelhouse file')
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != allowed[path.name]:
            raise ValueError('Wheelhouse integrity mismatch')
        result[path.name] = digest
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--wheelhouse', type=Path, required=True)
    parser.add_argument('--fetch', action='store_true', help='Explicitly fetch reviewed wheels from public PyPI before offline installation.')
    parser.add_argument('--runtime-only', action='store_true')
    options = parser.parse_args()
    if sys.prefix == sys.base_prefix or not options.wheelhouse.is_absolute():
        raise ValueError('Use an explicit virtual environment and absolute wheelhouse path')
    options.wheelhouse.mkdir(parents=True, exist_ok=True)
    policy = json.loads((ROOT / 'requirements/policy.json').read_text(encoding='utf-8'))
    policy_module.validate_policy(policy)
    verify_wheelhouse(options.wheelhouse, policy)
    requirement = ROOT / 'requirements' / ('runtime.txt' if options.runtime_only else 'qualification.txt')
    for tooling, filename in [(False, 'runtime.txt'), (True, 'qualification.txt')]:
        if (ROOT / 'requirements' / filename).read_text(encoding='utf-8') != policy_module.render_lock(policy, tooling):
            raise ValueError('Dependency hash lock drift')
    pip = [sys.executable, '-I', '-m', 'pip', '--isolated', '--disable-pip-version-check', '--no-input']
    common = ['--no-cache-dir', '--require-hashes', '--only-binary=:all:', '--keyring-provider=disabled', '-r', str(requirement)]
    def invoke(arguments: list[str]) -> None:
        subprocess.run(pip + arguments, check=True, env=safe_environment(), timeout=240)
    if options.fetch:
        invoke(['download', '--index-url', 'https://pypi.org/simple', '--dest', str(options.wheelhouse), *common])
        verify_wheelhouse(options.wheelhouse, policy)
    invoke(['install', '--no-index', '--find-links', str(options.wheelhouse), *common])
    invoke(['check'])
    print(policy_module.canonical(policy_module.installed(policy, options.runtime_only)), end='')


if __name__ == '__main__':
    main()
