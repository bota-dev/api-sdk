"""Runner policy and artifact binding without installing or contacting a registry."""
from __future__ import annotations

import importlib.util
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("bota_python_ci_test", ROOT / "tools/ci.py")
assert SPEC is not None and SPEC.loader is not None
ci = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ci)


def facts(system="Linux", version="3.12.15"):
    return {"implementation": "cpython", "version": version, "system": system, "machine": "x86_64", "bits": 64,
            "debug": False, "free_threaded": False, "gil_enabled": True, "jit_enabled": False}


def candidate(directory: Path, source=None):
    source = source or {"commit": "a" * 40, "dirty": False, "state": "committed", "files": {"fixture": "b" * 64}}
    package = {"name": ci.PACKAGE, "version": ci.VERSION, "license": "MIT"}
    blobs = {ci.WHEEL_NAME: b"synthetic-wheel", ci.SDIST_NAME: b"synthetic-sdist"}
    receipt = {"status": ci.QUALIFICATION_STATUS, "mode": "producer", "source": source, "package": package,
               "repeated_builds_performed": 2, "repeated_builds_equal": True,
               "artifacts": {"wheel_sha256": ci.digest(blobs[ci.WHEEL_NAME]), "sdist_sha256": ci.digest(blobs[ci.SDIST_NAME])}}
    blobs[ci.QUALIFICATION] = ci.json_bytes(receipt)
    record = {"format_version": 1, "status": ci.STATUS, "mode": "producer", "source": source, "package": package,
              "development": False, "runtime": facts(), "artifacts": {name: ci.digest(value) for name, value in blobs.items()}}
    blobs[ci.CI_RECEIPT] = ci.json_bytes(record)
    directory.mkdir()
    for name, value in blobs.items():
        (directory / name).write_bytes(value)
    return source, receipt, record


class CiPolicyTests(unittest.TestCase):
    def test_exact_seven_runtime_matrix_and_explicit_development_exception(self):
        count = 0
        for system, versions in ci.HOSTED.items():
            for version in versions:
                ci.validate_runtime(facts(system, version), version)
                count += 1
        self.assertEqual(count, 7)
        for system, version, development in [("Windows", "3.12.15", False), ("Linux", "3.12.14", False),
                                             ("Linux", "3.15.1", False), ("Darwin", "3.15.0", False)]:
            with self.assertRaises(ValueError):
                ci.validate_runtime(facts(system, version), version, development)
        ci.validate_runtime(facts("Windows", "3.12.14"), "3.12.14", True)

    def test_wrong_implementation_architecture_build_or_enabled_jit_refuses(self):
        for changes in ({"implementation": "pypy"}, {"machine": "arm64"}, {"bits": 32}, {"debug": True},
                        {"free_threaded": True}, {"gil_enabled": False}, {"jit_enabled": True}, {"version": "3.12.14"}):
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                ci.validate_runtime({**facts(), **changes}, "3.12.15")

    def test_child_environment_drops_credentials_proxies_python_and_pip_overrides(self):
        with patch.dict(os.environ, {"BOTA_API_KEY": "synthetic", "AWS_SECRET_ACCESS_KEY": "synthetic", "PYTHONPATH": "synthetic",
                                     "PIP_EXTRA_INDEX_URL": "https://synthetic.invalid", "HTTP_PROXY": "synthetic", "PYTHON_JIT": "1",
                                     "NETRC": "synthetic-ambient-netrc-must-not-survive"}):
            env = ci.safe_environment()
        self.assertFalse(set(env) & {"BOTA_API_KEY", "AWS_SECRET_ACCESS_KEY", "PYTHONPATH", "PIP_EXTRA_INDEX_URL", "HTTP_PROXY", "PYTHON_JIT"})
        self.assertEqual(env["PIP_CONFIG_FILE"], os.devnull)
        self.assertEqual(env["NETRC"], os.devnull)

    def test_default_dirty_source_refuses_before_creating_venv_or_fetching(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "new"
            with patch.object(ci, "runtime_facts", return_value=facts()), patch.object(ci, "git_source", return_value={"dirty": True}), patch.object(ci, "execute") as execute:
                with self.assertRaisesRegex(ValueError, "clean_source_required"):
                    ci.main(["--expected-python", "3.12.15", "--output-dir", str(output), "--fetch"])
                execute.assert_not_called()
                self.assertFalse(output.exists())

    def test_failed_child_keeps_complete_logs_and_fixed_stage_diagnostic(self):
        with tempfile.TemporaryDirectory() as temporary:
            logs = Path(temporary)
            result = subprocess.CompletedProcess([], 7, b"complete synthetic stdout\n", b"complete synthetic stderr\n")
            with patch.object(ci.subprocess, "run", return_value=result) as run, patch.object(sys, "stdout", io.StringIO()), patch.object(sys, "stderr", io.StringIO()):
                with self.assertRaisesRegex(ValueError, "^ci_stage_failed:source-tests$"):
                    ci.execute("source-tests", Path(sys.executable), ["-I", "-B", "fixture.py"], ROOT, logs)
            self.assertEqual((logs / "source-tests.stdout").read_bytes(), result.stdout)
            self.assertEqual((logs / "source-tests.stderr").read_bytes(), result.stderr)
            self.assertEqual(run.call_args.args[0][:3], [sys.executable, "-I", "-B"])
            self.assertNotIn("PYTHONPATH", run.call_args.kwargs["env"])

    def test_output_must_be_new_absolute_outside_checkout_and_unlinked(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            ci.new_external_output(root / "new")
            with self.assertRaises(ValueError):
                ci.new_external_output(root)
            with self.assertRaises(ValueError):
                ci.new_external_output(Path("relative"))
            with self.assertRaises(ValueError):
                ci.new_external_output(ci.WORKSPACE / "unowned-ci-output")
            target = root / "target"
            target.mkdir()
            link = root / "linked"
            if os.name == "nt":
                # A junction requires no developer-mode symlink privilege.
                result = subprocess.run([os.environ.get("COMSPEC", "cmd.exe"), "/c", "mklink", "/J", str(link), str(target)],
                                        capture_output=True, check=False)
                self.assertEqual(result.returncode, 0)
            else:
                link.symlink_to(target, target_is_directory=True)
            with self.assertRaises(ValueError):
                ci.new_external_output(link / "new")

    def test_canonical_candidate_binds_both_archives_receipts_source_and_runtime(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary) / "canonical"
            source, _, _ = candidate(directory)
            result = ci.inspect_candidate(directory, directory / ci.QUALIFICATION, source)
            self.assertEqual(result["wheel_sha256"], ci.digest((directory / ci.WHEEL_NAME).read_bytes()))
            self.assertEqual(result["ci_receipt_sha256"], ci.digest((directory / ci.CI_RECEIPT).read_bytes()))
            with self.assertRaises(ValueError):
                ci.inspect_candidate(directory, directory / "wrong.json", source)

    def test_linked_artifact_directory_is_refused_before_reading_its_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            directory = root / "canonical"
            source, _, _ = candidate(directory)
            link = root / "artifact-link"
            if os.name == "nt":
                result = subprocess.run([os.environ.get("COMSPEC", "cmd.exe"), "/c", "mklink", "/J", str(link), str(directory)],
                                        capture_output=True, check=False)
                self.assertEqual(result.returncode, 0)
            else:
                link.symlink_to(directory, target_is_directory=True)
            with self.assertRaisesRegex(ValueError, "linked_ci_path"):
                ci.inspect_candidate(link, link / ci.QUALIFICATION, source)

    def test_archive_tamper_extra_file_and_wrong_source_are_refused(self):
        for mutation in ("wheel", "sdist", "receipt", "ci", "extra", "source"):
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as temporary:
                directory = Path(temporary) / "canonical"
                source, _, _ = candidate(directory)
                if mutation == "source":
                    source = {**source, "commit": "c" * 40}
                elif mutation == "extra":
                    (directory / "environment.txt").write_bytes(b"must never be staged")
                else:
                    name = {"wheel": ci.WHEEL_NAME, "sdist": ci.SDIST_NAME, "receipt": ci.QUALIFICATION, "ci": ci.CI_RECEIPT}[mutation]
                    (directory / name).write_bytes(b"tampered")
                with self.assertRaises((ValueError, json.JSONDecodeError)):
                    ci.inspect_candidate(directory, directory / ci.QUALIFICATION, source)

    def test_recirculated_consumer_or_development_candidate_cannot_be_canonical_hosted_proof(self):
        for changes in ({"mode": "candidate"}, {"development": True}, {"format_version": True}, {"runtime": facts("Windows", "3.12.15")}):
            with self.subTest(changes=changes), tempfile.TemporaryDirectory() as temporary:
                directory = Path(temporary) / "canonical"
                source, _, record = candidate(directory)
                (directory / ci.CI_RECEIPT).write_bytes(ci.json_bytes({**record, **changes}))
                with self.assertRaises(ValueError):
                    ci.inspect_candidate(directory, directory / ci.QUALIFICATION, source)

    def test_malformed_receipt_shapes_refuse_with_bounded_validation_errors(self):
        for name, value in ((ci.QUALIFICATION, []), (ci.CI_RECEIPT, [])):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temporary:
                directory = Path(temporary) / "canonical"
                source, _, _ = candidate(directory)
                (directory / name).write_bytes(ci.json_bytes(value))
                with self.assertRaises(ValueError):
                    ci.inspect_candidate(directory, directory / ci.QUALIFICATION, source)
        with self.assertRaises(ValueError):
            ci.validate_runtime([], "3.12.15")

    def test_staging_emits_only_four_known_files_and_preserves_canonical_archive_bytes(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source_dir = root / "verifier"
            source, _, record = candidate(source_dir)
            (source_dir / ci.CI_RECEIPT).unlink()
            (source_dir / "internal-build-log.txt").write_bytes(b"not uploaded")
            destination = root / "artifacts"
            ci.stage_results(source_dir, destination, source, record)
            self.assertEqual({p.name for p in destination.iterdir()}, set(ci.ARTIFACTS))
            self.assertEqual((destination / ci.WHEEL_NAME).read_bytes(), b"synthetic-wheel")
            with self.assertRaises(ValueError):
                ci.stage_results(source_dir, destination, source, record)

    def test_consumer_staging_requires_same_archive_and_producer_receipt_binding(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            original = root / "canonical"
            source, receipt, record = candidate(original)
            proof = ci.inspect_candidate(original, original / ci.QUALIFICATION, source)
            consumer = root / "consumer"
            consumer.mkdir()
            for name in (ci.WHEEL_NAME, ci.SDIST_NAME):
                (consumer / name).write_bytes((original / name).read_bytes())
            receipt.update(mode="candidate", repeated_builds_performed=0, producer_receipt_sha256=proof["qualification_receipt_sha256"],
                           producer_ci_receipt_sha256=proof["ci_receipt_sha256"])
            (consumer / ci.QUALIFICATION).write_bytes(ci.json_bytes(receipt))
            ci.stage_results(consumer, root / "staged", source, {**record, "mode": "candidate"}, proof)
            receipt["producer_ci_receipt_sha256"] = "f" * 64
            (consumer / ci.QUALIFICATION).write_bytes(ci.json_bytes(receipt))
            with self.assertRaises(ValueError):
                ci.stage_results(consumer, root / "tampered", source, record, proof)

    def test_workflow_produces_once_before_exact_matrix_consumes_same_artifact(self):
        text = (ci.WORKSPACE / ".github/workflows/python.yml").read_text("utf-8")
        self.assertEqual(re.findall(r"^  ([A-Za-z0-9_-]+):$", text.split("jobs:\n", 1)[1], re.M), ["canonical", "consumers"])
        self.assertIn("needs: canonical", text)
        expected = {(system, version) for system, versions in (("ubuntu-24.04", ci.HOSTED["Linux"]), ("windows-2025", ci.HOSTED["Windows"])) for version in versions}
        actual = re.findall(r"- \{ os: ([a-z0-9.-]+), python: '([0-9.]+)' \}", text)
        self.assertEqual(len(actual), 7)
        self.assertEqual(set(actual), expected)
        self.assertEqual(text.count("name: python-sdk-canonical-${{ github.sha }}"), 2)
        self.assertEqual(text.count("freethreaded: false"), 2)
        self.assertEqual(text.count("persist-credentials: false"), 2)
        self.assertIn("permissions:\n  contents: read", text)
        self.assertIn("--candidate-receipt", text)
        self.assertIn("--expected-python 3.12.15", text)
        self.assertNotRegex(text, r"--development|\b(?:publish|deploy|twine|id-token|secrets)\b")


if __name__ == "__main__":
    unittest.main()
