"""Synthetic adversarial archive tests; no install, network or live credentials."""
from __future__ import annotations

import base64
import csv
import gzip
import hashlib
import io
import copy
import json
import os
from pathlib import Path
import stat
import sys
import tarfile
import tempfile
import tomllib
import unittest
import warnings
import zipfile
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import package_policy as policy


def fixture() -> tuple[dict[str, bytes], dict[str, bytes], dict[str, bytes]]:
    payload = {name: f"fixture:{name}\n".encode() for name in policy.SOURCE_FILES}
    payload["package_provenance.json"] = policy.json_bytes({"package": {"name": policy.PACKAGE,
        "version": policy.VERSION, "license": "MIT"}, "payload": {name: policy.digest(value) for name, value in payload.items()}})
    metadata = (f"Metadata-Version: 2.4\nName: {policy.PACKAGE}\nVersion: {policy.VERSION}\n"
                "Requires-Python: >=3.12,<3.16\nLicense-Expression: MIT\nLicense-File: LICENSE\n"
                "Requires-Dist: aiohttp==3.14.5\nRequires-Dist: yarl==1.25.1\n\nSynthetic fixture\n").encode()
    wheel = {f"bota_api_sdk/{name}": value for name, value in payload.items()}
    wheel.update({f"{policy.DIST_INFO}/METADATA": metadata,
        f"{policy.DIST_INFO}/WHEEL": b"Wheel-Version: 1.0\nRoot-Is-Purelib: true\nTag: py3-none-any\n\n",
        f"{policy.DIST_INFO}/licenses/LICENSE": b"MIT fixture\n"})
    record = io.StringIO(newline="")
    rows = csv.writer(record, lineterminator="\n")
    for name, value in wheel.items():
        encoded = base64.urlsafe_b64encode(hashlib.sha256(value).digest()).rstrip(b"=").decode()
        rows.writerow((name, f"sha256={encoded}", len(value)))
    rows.writerow((f"{policy.DIST_INFO}/RECORD", "", ""))
    wheel[f"{policy.DIST_INFO}/RECORD"] = record.getvalue().encode()
    sdist = {f"src/bota_api_sdk/{name}": value for name, value in payload.items()}
    sdist.update({"PKG-INFO": metadata, "LICENSE": b"MIT fixture\n", "README.md": b"Synthetic fixture\n",
        "pyproject.toml": (policy.PACKAGE_ROOT / "pyproject.toml").read_bytes()})
    return payload, wheel, sdist


def zip_bytes(files: dict[str, bytes], extra: tuple[str, bytes, int] | None = None) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, value in files.items():
            archive.writestr(name, value)
        if extra:
            entry = zipfile.ZipInfo(extra[0])
            entry.create_system = 3
            entry.external_attr = extra[2] << 16
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", UserWarning)
                archive.writestr(entry, extra[1])
    return output.getvalue()


def tar_bytes(files: dict[str, bytes], extra: tarfile.TarInfo | None = None) -> bytes:
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode="w:") as archive:
        for name, value in files.items():
            entry = tarfile.TarInfo(f"{policy.DIST}/{name}")
            entry.size = len(value)
            archive.addfile(entry, io.BytesIO(value))
        if extra:
            archive.addfile(extra, io.BytesIO(b""))
    return gzip.compress(output.getvalue(), mtime=0)


class PackagePolicyTests(unittest.TestCase):
    def test_child_environment_disables_netrc_without_forwarding_ambient_authority(self) -> None:
        synthetic = {"NETRC": "synthetic-credential-file", "HOME": "synthetic-home", "USERPROFILE": "synthetic-profile",
                     "BOTA_API_KEY": "synthetic-key", "AWS_SECRET_ACCESS_KEY": "synthetic-secret",
                     "PIP_EXTRA_INDEX_URL": "https://synthetic.invalid", "HTTP_PROXY": "http://synthetic.invalid",
                     "HTTPS_PROXY": "http://synthetic.invalid", "PYTHONPATH": "synthetic-python-path"}
        with patch.dict(os.environ, synthetic):
            environment = policy.child_environment()
        self.assertEqual(environment["NETRC"], os.devnull)
        self.assertEqual(environment["PIP_CONFIG_FILE"], os.devnull)
        names = {name.upper() for name in environment}
        self.assertFalse(names.intersection(set(synthetic) - {"NETRC"}))

    def test_current_manifest_is_frozen_without_extras_or_install_hooks(self) -> None:
        manifest = tomllib.loads((policy.PACKAGE_ROOT / "pyproject.toml").read_text())
        policy.assert_manifest(manifest)
        for field, value in (("dependencies", ["aiohttp[speedups]==3.14.5"]),
                             ("scripts", {"bota": "bota_api_sdk:main"}), ("requires-python", ">=3.11")):
            with self.subTest(field=field), self.assertRaises(ValueError):
                policy.assert_manifest({**manifest, "project": {**manifest["project"], field: value}})
        for ty in ({"rules": {"all": "ignore"}},
                   {"rules": {"all": "error"}, "analysis": {"respect-type-ignore-comments": True}},
                   {"rules": {"all": "error", "unresolved-import": "ignore"},
                    "analysis": {"respect-type-ignore-comments": False}}):
            with self.subTest(ty=ty), self.assertRaisesRegex(ValueError, "python_type_policy_drift"):
                policy.assert_manifest({**manifest, "tool": {**manifest["tool"], "ty": ty}})

    def test_exact_synthetic_wheel_sdist_and_record_roundtrip(self) -> None:
        payload, wheel, sdist = fixture()
        result = policy.verify_archives(zip_bytes(wheel), tar_bytes(sdist), payload)
        self.assertEqual(result["wheel_files"], 15)
        self.assertEqual(result["sdist_files"], 15)

    def test_refuses_absolute_traversal_ambiguous_control_and_drive_paths(self) -> None:
        for name in ("/file", "../file", "a/../file", "a/./file", "a//file", "a\\file", "C:file", "a\x00file", "a\x7ffile", ""):
            with self.subTest(name=name), self.assertRaises(ValueError):
                policy.safe_name(name)

    def test_wheel_refuses_links_duplicates_unknown_and_native_payloads(self) -> None:
        _, wheel, _ = fixture()
        for extra in (("extra.py", b"x", stat.S_IFREG | 0o644),
                      ("bota_api_sdk/native.pyd", b"x", stat.S_IFREG | 0o644),
                      ("bota_api_sdk/runtime.py", b"x", stat.S_IFREG | 0o644),
                      ("bota_api_sdk/link", b"target", stat.S_IFLNK | 0o777),
                      ("../escape", b"x", stat.S_IFREG | 0o644)):
            with self.subTest(extra=extra[0]), self.assertRaises(ValueError):
                policy.wheel_files(zip_bytes(wheel, extra))

    def test_wheel_record_detects_changed_payload_and_unlisted_files(self) -> None:
        _, wheel, _ = fixture()
        for change in ({**wheel, "bota_api_sdk/runtime.py": b"tampered"},
                       {**wheel, f"{policy.DIST_INFO}/RECORD": b""}):
            with self.assertRaisesRegex(ValueError, "wheel_record"):
                policy.wheel_files(zip_bytes(change))

    def test_sdist_refuses_links_special_files_duplicate_unknown_and_traversal(self) -> None:
        _, _, sdist = fixture()
        for name, kind in ((f"{policy.DIST}/../escape", tarfile.REGTYPE),
                           (f"{policy.DIST}/LICENSE", tarfile.REGTYPE),
                           (f"{policy.DIST}/extra", tarfile.REGTYPE),
                           (f"{policy.DIST}/link", tarfile.SYMTYPE),
                           (f"{policy.DIST}/hard", tarfile.LNKTYPE),
                           (f"{policy.DIST}/device", tarfile.CHRTYPE)):
            entry = tarfile.TarInfo(name)
            entry.type = kind
            if kind in {tarfile.SYMTYPE, tarfile.LNKTYPE}:
                entry.linkname = "LICENSE"
            with self.subTest(name=name), self.assertRaises(ValueError):
                policy.sdist_files(tar_bytes(sdist, entry))

    def test_archive_identity_license_dependency_or_platform_drift_is_refused(self) -> None:
        for old, new in ((b"License-Expression: MIT", b"License-Expression: GPL-3.0"),
                         (b"aiohttp==3.14.5", b"aiohttp[speedups]==3.14.5"),
                         (b"Version: 0.1.0b0", b"Version: 1.0.0")):
            _, _, sdist = fixture()
            sdist["PKG-INFO"] = sdist["PKG-INFO"].replace(old, new)
            with self.subTest(old=old), self.assertRaises(ValueError):
                policy.sdist_files(tar_bytes(sdist))

    def test_payload_and_provenance_drift_is_refused_across_archives(self) -> None:
        payload, wheel, sdist = fixture()
        sdist["src/bota_api_sdk/generated/models.py"] = b"tampered"
        with self.assertRaisesRegex(ValueError, "packed_payload_drift"):
            policy.verify_archives(zip_bytes(wheel), tar_bytes(sdist), payload)

    def test_bounds_compressed_and_expanded_archive_sizes(self) -> None:
        with self.assertRaisesRegex(ValueError, "wheel_byte_limit"):
            policy.wheel_files(b"x" * (policy.MAX_ARCHIVE + 1))
        with self.assertRaisesRegex(ValueError, "sdist_expansion_limit"):
            policy.sdist_files(gzip.compress(b"\0" * (policy.MAX_EXPANDED + 1)))

    def test_canonical_text_does_not_modify_binary_inputs(self) -> None:
        self.assertEqual(policy.canonical_source(b"line\r\n"), b"line\n")
        self.assertEqual(policy.canonical_source(b"\xff\r\n"), b"\xff\r\n")

    def test_git_identity_does_not_fall_back_to_wrapper_repository(self) -> None:
        with self.assertRaisesRegex(ValueError, "wrong_git_workspace"):
            policy.git_source(policy.WORKSPACE / "packages")

    def test_input_inventory_excludes_cache_without_packing_unknown_files(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            (root / "__pycache__").mkdir()
            (root / "__pycache__/module.pyc").write_bytes(b"cache")
            (root / "module.py").write_bytes(b"source")
            self.assertEqual(policy.source_files(root), ["module.py"])

    def test_provenance_accepts_reviewed_different_builder_host_and_refuses_drift(self) -> None:
        payload, _, _ = fixture()
        dependency_policy = json.loads((policy.PACKAGE_ROOT / "requirements/policy.json").read_text())
        source = {"commit": "a" * 40, "dirty": False, "state": "committed",
                  "files": {name: "b" * 64 for name in policy.SHARED_INPUTS}}
        source["files"].update({f"packages/python/src/bota_api_sdk/{name}": policy.digest(payload[name])
                                for name in policy.SOURCE_FILES})
        provenance = {"format_version": 1, "status": "experimental-python-packed-candidate-not-publication", "source": source,
            "package_inputs": {name: value for name, value in source["files"].items() if name.startswith("packages/python/")},
            "shared_inputs": {name: "b" * 64 for name in policy.SHARED_INPUTS},
            "payload": {name: policy.digest(payload[name]) for name in policy.SOURCE_FILES},
            "builder": {"implementation": "cpython", "python": "3.12.15", "flit_core": "4.1.0",
                        "source_date_epoch": policy.SOURCE_DATE_EPOCH, "gil_enabled": True, "debug": False,
                        "system": "Linux", "machine": "x86_64"},
            "installed_dependencies": {"status": "qualified-installed-dependency-metadata", "python": "3.12.15",
                "packages": {name: {"version": item["version"], "admitted_license": item["admitted_license"],
                                    "metadata_sha256": "d" * 64} for name, item in dependency_policy["packages"].items()}}}
        policy.validate_provenance(provenance, source, payload, dependency_policy)
        for section, field, value in (("builder", "python", "3.16.0"), ("builder", "debug", True),
                                      ("builder", "gil_enabled", False), ("shared_inputs", "LICENSE", "e" * 64),
                                      ("package_inputs", "extra", "e" * 64), ("payload", "runtime.py", "e" * 64)):
            invalid = copy.deepcopy(provenance)
            invalid[section][field] = value
            with self.subTest(section=section, field=field), self.assertRaises(ValueError):
                policy.validate_provenance(invalid, source, payload, dependency_policy)
        invalid = copy.deepcopy(provenance)
        invalid["installed_dependencies"]["packages"]["aiohttp"]["version"] = "0.0.0"
        with self.assertRaisesRegex(ValueError, "dependency_identity"):
            policy.validate_provenance(invalid, source, payload, dependency_policy)

    def test_candidate_requires_paired_closed_four_file_inventory(self) -> None:
        from verify_package import load_candidate
        with tempfile.TemporaryDirectory() as name:
            directory = Path(name)
            for file in (policy.WHEEL_NAME, policy.SDIST_NAME, "qualification-receipt.json", "ci-receipt.json", "extra"):
                (directory / file).write_bytes(b"{}")
            with self.assertRaisesRegex(ValueError, "canonical_candidate_inventory"):
                load_candidate(directory, directory / "qualification-receipt.json", {})

    def test_candidate_refuses_changed_producer_source_lock_or_archive_before_install(self) -> None:
        from verify_package import load_candidate
        payload, wheel, sdist = fixture()
        wheel_blob, sdist_blob = zip_bytes(wheel), tar_bytes(sdist)
        source = {"commit": "a" * 40, "dirty": False, "state": "committed", "files": {}}
        receipt = {"format_version": 1, "status": "experimental-python-offline-packed-consumers-not-publication",
            "mode": "producer", "repeated_builds_performed": 2, "repeated_builds_equal": True,
            "source": source, "package": {"name": policy.PACKAGE, "version": policy.VERSION, "license": "MIT"},
            "qualification_lock_sha256": policy.digest(policy.canonical_source((policy.PACKAGE_ROOT / "requirements/qualification.txt").read_bytes())),
            "artifacts": policy.verify_archives(wheel_blob, sdist_blob, payload),
            "consumers": [{"kind": kind, "offline": True, "runtime": {"passed": True},
                           "strict_types": {"negative_exit": 1}} for kind in ("wheel", "sdist")]}
        for change, failure in (("mode", "producer_proof"), ("source", "candidate_source"),
                                ("lock", "lock_digest"), ("archive", "archive_digest")):
            changed = copy.deepcopy(receipt)
            archive = wheel_blob
            if change == "mode":
                changed["mode"] = "candidate"
            elif change == "source":
                changed["source"]["commit"] = "b" * 40
            elif change == "lock":
                changed["qualification_lock_sha256"] = "0" * 64
            else:
                archive += b"altered bytes"
            with self.subTest(change=change), tempfile.TemporaryDirectory() as name:
                directory = Path(name)
                (directory / policy.WHEEL_NAME).write_bytes(archive)
                (directory / policy.SDIST_NAME).write_bytes(sdist_blob)
                (directory / "qualification-receipt.json").write_bytes(policy.json_bytes(changed))
                (directory / "ci-receipt.json").write_bytes(b"{}\n")
                with self.assertRaisesRegex(ValueError, failure):
                    load_candidate(directory, directory / "qualification-receipt.json", source)


if __name__ == "__main__":
    unittest.main()
