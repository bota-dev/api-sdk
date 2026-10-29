from copy import deepcopy
from email.message import Message
import base64
from http.server import BaseHTTPRequestHandler, HTTPServer
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

policy_module = load('bota_dependency_policy_test', ROOT / 'tools/dependencies.py')
installer = load('bota_dependency_installer_test', ROOT / 'tools/install_dependencies.py')


class DependencyPolicyTests(unittest.TestCase):
    def setUp(self):
        self.policy = json.loads((ROOT / 'requirements/policy.json').read_text(encoding='utf-8'))

    def test_checked_locks_are_exact_wheel_only_inputs(self):
        policy_module.validate_policy(self.policy)
        for tooling, name in [(False, 'runtime.txt'), (True, 'qualification.txt')]:
            self.assertEqual((ROOT / 'requirements' / name).read_text(encoding='utf-8'), policy_module.render_lock(self.policy, tooling))
        self.assertIn('python_version < "3.13"', policy_module.render_lock(self.policy, False))

    def test_forbidden_unknown_ambiguous_and_substring_licenses_refuse(self):
        for value in ['MPL-2.0', 'GPL-3.0', 'MIT AND GPL-3.0', 'UNKNOWN', '', 'MIT OR UNKNOWN', 'MIT nonsense']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                policy_module.recognized_license({'expression': value, 'legacy': 'MIT', 'classifiers': []})
        with self.assertRaises(ValueError):
            policy_module.recognized_license({'expression': None, 'legacy': None, 'classifiers': ['License :: OSI Approved :: MIT License', 'other']})

    def test_reviewed_legacy_metadata_needs_exact_unambiguous_identity(self):
        self.assertEqual(policy_module.recognized_license({'expression': None, 'legacy': 'Apache 2.0', 'classifiers': []}), 'Apache-2.0')
        self.assertEqual(policy_module.recognized_license({'expression': None, 'legacy': None, 'classifiers': ['License :: OSI Approved :: MIT License']}), 'MIT')

    def test_source_version_inventory_and_license_drift_refuse(self):
        mutations = [lambda x: x['packages'].pop('ty'), lambda x: x['packages']['ty'].update(version='0.0.90'),
                     lambda x: x['packages']['ty'].update(source='https://foreign.example/ty'),
                     lambda x: x['packages']['ty'].update(admitted_license='Apache-2.0')]
        for mutation in mutations:
            candidate = deepcopy(self.policy)
            mutation(candidate)
            with self.assertRaises(ValueError):
                policy_module.validate_policy(candidate)

    def test_untrusted_wheel_names_origins_hashes_and_duplicates_refuse(self):
        mutations = [lambda x: x.update(filename='../escape.whl'), lambda x: x.update(url='https://evil.example/p.whl'),
                     lambda x: x.update(sha256='bad'), lambda x: x.update(url=x['url'] + '?token=untrusted')]
        for mutation in mutations:
            candidate = deepcopy(self.policy)
            mutation(candidate['packages']['ty']['wheels'][0])
            with self.assertRaises(ValueError):
                policy_module.validate_policy(candidate)
        candidate = deepcopy(self.policy)
        candidate['packages']['ty']['wheels'].append(candidate['packages']['ty']['wheels'][-1])
        with self.assertRaises(ValueError):
            policy_module.validate_policy(candidate)

    def test_empty_wheelhouse_is_safe_unknown_bytes_refuse(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            self.assertEqual(installer.verify_wheelhouse(directory, self.policy), {})
            (directory / 'unreviewed.whl').write_bytes(b'not a wheel')
            with self.assertRaises(ValueError):
                installer.verify_wheelhouse(directory, self.policy)

    def test_wheelhouse_hash_tampering_refuses(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            (directory / self.policy['packages']['ty']['wheels'][0]['filename']).write_bytes(b'tampered')
            with self.assertRaises(ValueError):
                installer.verify_wheelhouse(directory, self.policy)

    def test_child_environment_does_not_forward_credentials_or_proxy_config(self):
        environment = installer.safe_environment()
        self.assertFalse(any(key.upper() in {'BOTA_API_KEY', 'HTTP_PROXY', 'HTTPS_PROXY', 'PYTHONPATH', 'PIP_EXTRA_INDEX_URL'} for key in environment))
        self.assertIn('PIP_CONFIG_FILE', environment)
        self.assertEqual(environment['NETRC'], os.devnull)
        self.assertEqual(environment['NO_PROXY'], '*')

    def test_pip_requests_proxy_resolution_is_bypassed_without_system_lookup(self):
        from pip._vendor.requests import utils
        proxy = {'https': 'http://synthetic-proxy.invalid:1234'}
        control = installer.safe_environment()
        control['NO_PROXY'] = ''
        control['HTTPS_PROXY'] = proxy['https']
        with patch.dict(os.environ, control, clear=True), patch.object(utils, 'getproxies', return_value=proxy) as lookup:
            self.assertEqual(utils.get_environ_proxies('https://pypi.org/simple'), proxy)
            lookup.assert_called_once()
        treatment = installer.safe_environment()
        treatment['HTTPS_PROXY'] = proxy['https']
        with patch.dict(os.environ, treatment, clear=True), patch.object(utils, 'getproxies', side_effect=AssertionError('Unexpected system proxy lookup')) as lookup:
            self.assertEqual(utils.get_environ_proxies('https://pypi.org/simple'), {})
            lookup.assert_not_called()

    def test_actual_pip_uses_only_synthetic_netrc_control_and_refuses_it_when_disabled(self):
        observations = []
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                observations.append(self.headers.get('Authorization'))
                self.send_response(404)
                self.send_header('Content-Length', '0')
                self.end_headers()
            def log_message(self, *args):
                pass
        server = HTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=lambda: server.serve_forever(poll_interval=0.01))
        thread.start()
        try:
            with tempfile.TemporaryDirectory() as temporary:
                directory = Path(temporary)
                synthetic = directory / 'synthetic-only.netrc'
                synthetic.write_text('machine 127.0.0.1 login bota_synthetic_user password bota_synthetic_password\n', encoding='ascii')
                synthetic.chmod(0o600)
                expected = 'Basic ' + base64.b64encode(b'bota_synthetic_user:bota_synthetic_password').decode('ascii')
                command = [sys.executable, '-I', '-B', '-m', 'pip', '--isolated', '--disable-pip-version-check', '--no-input',
                           'download', '--no-cache-dir', '--no-deps', '--retries', '0', '--timeout', '3',
                           '--keyring-provider=disabled', '--trusted-host', '127.0.0.1',
                           '--index-url', f'http://127.0.0.1:{server.server_port}/simple', '--dest', str(directory / 'downloads'),
                           'bota-synthetic-does-not-exist==0.0.0']
                control = installer.safe_environment()
                control['NETRC'] = str(synthetic)
                result = subprocess.run(command, env=control, capture_output=True, timeout=20)
                self.assertEqual(result.returncode, 1)
                self.assertTrue(observations)
                self.assertEqual(set(observations), {expected})
                observations.clear()
                result = subprocess.run(command, env=installer.safe_environment(), capture_output=True, timeout=20)
                self.assertEqual(result.returncode, 1)
                self.assertTrue(observations)
                self.assertEqual(set(observations), {None})
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)
            self.assertFalse(thread.is_alive())

    def test_installed_dependency_declarations_match_reviewed_closure(self):
        class Distribution:
            files = ['METADATA']
            def __init__(self, name, item):
                self.version = item['version']
                self.metadata = Message()
                self.metadata['Name'] = name
                for key, value in [('License-Expression', item['license']['expression']), ('License', item['license']['legacy'])]:
                    if value is not None:
                        self.metadata[key] = value
                for value in item['license']['classifiers']:
                    self.metadata['Classifier'] = value
                for value in item['requires_dist']:
                    self.metadata['Requires-Dist'] = value
            def read_text(self, name):
                return str(self.metadata)
        distributions = [Distribution(name, item) for name, item in self.policy['packages'].items() if name != 'typing-extensions' or __import__('sys').version_info < (3, 13)]
        with patch.object(policy_module.metadata, 'distributions', return_value=distributions):
            self.assertEqual(len(policy_module.installed(self.policy)['packages']), len(distributions))
            distributions[0].metadata['Requires-Dist'] = 'unexpected-runtime-dependency>=1'
            with self.assertRaisesRegex(ValueError, 'declaration drift'):
                policy_module.installed(self.policy)

    def test_requirement_spacing_is_insignificant_but_tokens_and_strings_are_exact(self):
        normalize = policy_module.dependency_declarations
        self.assertEqual(normalize(['coverage>=7.10.0; extra == "all"']), normalize(['coverage >= 7.10.0 ; extra == "all"']))
        self.assertNotEqual(normalize(['foo bar>=1']), normalize(['foobar>=1']))
        self.assertNotEqual(normalize(['foo>=1; extra == " all"']), normalize(['foo>=1; extra == "all"']))
        self.assertNotEqual(normalize(['foo>=1; python_version < "3.13"']), normalize(['foo>=1; python_version > "3.13"']))
        with self.assertRaises(ValueError):
            normalize(['foo>=1; extra == "unterminated'])


if __name__ == '__main__':
    unittest.main()
