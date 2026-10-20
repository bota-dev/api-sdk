"""Qualify repeated archives and external offline installed wheel/sdist consumers."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_package import build  # noqa: E402
from package_policy import (  # noqa: E402
    PACKAGE_ROOT, WORKSPACE, VERSION, DIST_INFO, PAYLOAD_FILES, SOURCE_FILES, WHEEL_NAME,
    SDIST_NAME, canonical_source, child_environment, digest, git_source, json_bytes,
    regular_file, require, run, source_files, verify_archives, wheel_files, sdist_files, validate_provenance,
)


def consumer_python(directory: Path) -> Path:
    return directory / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")


def load_candidate(directory: Path, receipt_path: Path, source: dict) -> tuple[dict[str, bytes], dict, str, str]:
    require(directory.is_absolute() and receipt_path.is_absolute() and directory.is_dir() and not directory.is_symlink(), "canonical_candidate_paths")
    require(receipt_path == directory / "qualification-receipt.json", "canonical_candidate_receipt_path")
    require(sorted(path.name for path in directory.iterdir()) == sorted((WHEEL_NAME, SDIST_NAME,
            "qualification-receipt.json", "ci-receipt.json")), "canonical_candidate_inventory")
    for name in (WHEEL_NAME, SDIST_NAME, "qualification-receipt.json", "ci-receipt.json"):
        require(regular_file(directory, name).stat().st_size <= 8 * 1024 * 1024, "canonical_candidate_byte_limit")
    receipt_bytes = receipt_path.read_bytes()
    producer = json.loads(receipt_bytes)
    require(receipt_bytes == json_bytes(producer), "canonical_candidate_receipt_encoding")
    require(producer.get("format_version") == 1 and producer.get("status") ==
            "experimental-python-offline-packed-consumers-not-publication" and producer.get("mode") == "producer"
            and producer.get("repeated_builds_performed") == 2 and producer.get("repeated_builds_equal") is True,
            "canonical_candidate_producer_proof")
    require(producer.get("source") == source and producer.get("package") ==
            {"name": "bota-api-sdk", "version": VERSION, "license": "MIT"}, "canonical_candidate_source")
    require(producer.get("qualification_lock_sha256") == digest(canonical_source(
            regular_file(PACKAGE_ROOT, "requirements/qualification.txt").read_bytes())), "canonical_candidate_lock_digest")
    require({item.get("kind") for item in producer.get("consumers", [])} == {"wheel", "sdist"}
            and len(producer["consumers"]) == 2 and all(item.get("offline") is True and
            item.get("runtime", {}).get("passed") is True and item.get("strict_types", {}).get("negative_exit") == 1
            for item in producer["consumers"]), "canonical_candidate_consumer_proof")
    wheel_blob = (directory / WHEEL_NAME).read_bytes()
    sdist_blob = (directory / SDIST_NAME).read_bytes()
    require(digest(wheel_blob) == producer["artifacts"]["wheel_sha256"] and
            digest(sdist_blob) == producer["artifacts"]["sdist_sha256"], "canonical_candidate_archive_digest")
    wheel = wheel_files(wheel_blob)
    expected = {name: wheel[f"bota_api_sdk/{name}"] for name in PAYLOAD_FILES}
    for name in SOURCE_FILES:
        require(expected[name] == canonical_source(regular_file(PACKAGE_ROOT, f"src/bota_api_sdk/{name}").read_bytes()), "canonical_candidate_current_payload")
    evidence = verify_archives(wheel_blob, sdist_blob, expected)
    require(evidence == producer["artifacts"], "canonical_candidate_artifact_evidence")
    sdist = sdist_files(sdist_blob)
    for name in ("pyproject.toml", "LICENSE", "README.md"):
        require(sdist[name] == canonical_source(regular_file(PACKAGE_ROOT, name).read_bytes())
                and digest(sdist[name]) == source["files"][f"packages/python/{name}"], "canonical_candidate_source_metadata")
    provenance = json.loads(expected["package_provenance.json"])
    require(expected["package_provenance.json"] == json_bytes(provenance), "canonical_candidate_provenance_encoding")
    validate_provenance(provenance, source, expected, json.loads((PACKAGE_ROOT / "requirements/policy.json").read_text()))
    return expected, evidence, digest(receipt_bytes), digest((directory / "ci-receipt.json").read_bytes())


def qualify(python: Path, wheelhouse: Path, lock: Path, output: Path, typechecker: Path | None = None,
            candidate_dir: Path | None = None, candidate_receipt: Path | None = None) -> dict[str, object]:
    for path in (python, wheelhouse, lock, output):
        require(path.is_absolute(), "absolute_qualification_paths_required")
    require(python.is_file() and wheelhouse.is_dir() and not wheelhouse.is_symlink(), "invalid_qualification_inputs")
    require(lock.resolve() == (PACKAGE_ROOT / "requirements/qualification.txt").resolve(), "reviewed_qualification_lock_required")
    require(not output.exists() and output.parent.is_dir() and not output.parent.is_symlink()
            and not output.resolve().is_relative_to(WORKSPACE.resolve()), "new_external_qualification_output_required")
    require(Path(sys.executable).resolve() == python.resolve(), "run_verifier_with_explicit_builder_python")
    if typechecker is not None:
        require(typechecker.is_absolute() and typechecker.is_file(), "explicit_typechecker_required")
        require(re.fullmatch(r"ty 0\.0\.90(?: \([a-f0-9]{7,40} \d{4}-\d{2}-\d{2}\))?",
                             run(typechecker, ["--version"], output.parent).strip()), "typechecker_version_drift")
    before = git_source()
    require((candidate_dir is None) == (candidate_receipt is None), "paired_canonical_candidate_arguments_required")
    output.mkdir()
    producer_receipt_sha = producer_ci_sha = None
    if candidate_dir is not None and candidate_receipt is not None:
        expected, archive_evidence, producer_receipt_sha, producer_ci_sha = load_candidate(candidate_dir, candidate_receipt, before)
        candidate = candidate_dir
    else:
        builds = [build(output / f"build-{index}") for index in range(2)]
        require(builds[0] == builds[1], "repeated_build_provenance_drift")
        candidate = output / "build-0/dist"
        for name in (WHEEL_NAME, SDIST_NAME):
            require((candidate / name).read_bytes() == (output / "build-1/dist" / name).read_bytes(), "repeated_archive_drift")
        wheel = wheel_files((candidate / WHEEL_NAME).read_bytes())
        expected = {name: wheel[f"bota_api_sdk/{name}"] for name in PAYLOAD_FILES}
        archive_evidence = verify_archives((candidate / WHEEL_NAME).read_bytes(), (candidate / SDIST_NAME).read_bytes(), expected)
    wheel_blob = (candidate / WHEEL_NAME).read_bytes()
    sdist_blob = (candidate / SDIST_NAME).read_bytes()
    for name in (WHEEL_NAME, SDIST_NAME):
        shutil.copyfile(candidate / name, output / name)
    candidate = output
    wheel = wheel_files(wheel_blob)
    require(archive_evidence == verify_archives(wheel_blob, sdist_blob, expected), "candidate_changed_before_consumers")
    consumers = []
    for kind, name in (("wheel", WHEEL_NAME), ("sdist", SDIST_NAME)):
        directory = Path(tempfile.mkdtemp(prefix=f"bota-python-{kind}-consumer-"))
        require(not directory.resolve().is_relative_to(WORKSPACE.resolve()), "consumer_inside_checkout")
        venv = directory / "venv"
        run(python, ["-I", "-B", "-m", "venv", str(venv)], directory)
        executable = consumer_python(venv)
        # The maintained installer validates the exact wheelhouse, reviewed hash
        # lock and installed licenses. No --fetch flag or package registry occurs.
        run(executable, ["-I", "-B", str(PACKAGE_ROOT / "tools/install_dependencies.py"),
                        "--wheelhouse", str(wheelhouse), *(["--runtime-only"] if kind == "wheel" else [])], directory)
        candidate_path = directory / name
        shutil.copyfile(candidate / name, candidate_path)
        requirement = directory / "candidate.txt"
        requirement.write_text(f"{candidate_path.as_uri()} --hash=sha256:{digest(candidate_path.read_bytes())}\n", encoding="utf-8")
        run(executable, ["-I", "-B", "-m", "pip", "--isolated", "--disable-pip-version-check", "--no-input", "install",
                        "--keyring-provider=disabled",
                        "--no-index", "--no-cache-dir", "--no-deps", "--no-build-isolation", "--no-compile",
                        "--require-hashes", "-r", str(requirement)], directory)
        run(executable, ["-I", "-B", "-m", "pip", "--isolated", "check"], directory)
        licenses = json.loads(run(executable, ["-I", "-B", str(PACKAGE_ROOT / "tools/dependencies.py"), "--installed", "--include-sdk",
                                               *(["--runtime-only"] if kind == "wheel" else [])], directory))
        destination = directory / "consumer.py"
        destination.write_bytes(canonical_source(regular_file(PACKAGE_ROOT, "tests/package_consumer.py").read_bytes()))
        smoke = json.loads(run(executable, ["-I", "-B", str(destination), *(["--runtime-only"] if kind == "wheel" else [])], directory))
        require(smoke["passed"] is True and smoke["named_methods"] == 11 and smoke["named_mutations"] == 2
                and smoke["single_attempt_unknown_mutation"] is True
                and smoke["task_cancellation_preserved"] is True, "installed_consumer_smoke")
        installed = Path(smoke["installed"]).parent
        require(installed.resolve().is_relative_to(venv.resolve()) and source_files(installed) == list(PAYLOAD_FILES), "installed_payload_inventory")
        for payload_name, value in expected.items():
            require(regular_file(installed, payload_name).read_bytes() == value, "installed_payload_bytes")
        # Match immutable distribution metadata too; installer-owned RECORD,
        # INSTALLER, REQUESTED and direct_url.json are expected pip additions.
        info = installed.parent / DIST_INFO
        for info_name in ("METADATA", "WHEEL", "licenses/LICENSE"):
            require(regular_file(info, info_name).read_bytes() == wheel[f"{DIST_INFO}/{info_name}"], "installed_metadata_bytes")
        typed = None
        if typechecker is not None:
            config = directory / "ty.toml"
            config.write_text('[rules]\nall = "error"\n[analysis]\nrespect-type-ignore-comments = false\n', encoding="utf-8")
            common = ["check", "--config-file", str(config), "--python", str(executable), "--python-version", ".".join(smoke["python"].split(".")[:2])]
            positive = run(typechecker, [*common, str(destination)], directory)
            negative = directory / "negative.py"
            negative.write_bytes(canonical_source(regular_file(PACKAGE_ROOT, "tests/package_consumer_negative.py").read_bytes()))
            failed = subprocess.run([str(typechecker), *common, str(negative)], cwd=directory, env=child_environment(),
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=120, check=False)
            diagnostics = failed.stdout + failed.stderr
            require(failed.returncode == 1 and all(f"negative.py:{line}:" in diagnostics for line in (6, 7, 9, 11, 12, 13, 14))
                    and "unresolved-import" not in diagnostics, "negative_installed_type_consumer")
            typed = {"checker": "ty 0.0.90", "positive": positive.strip(), "negative_exit": failed.returncode,
                     "negative_diagnostics_sha256": digest(diagnostics.encode())}
        require(candidate_path.read_bytes() == (candidate / name).read_bytes(), "candidate_changed_during_install")
        consumers.append({"kind": kind, "directory": str(directory), "runtime": smoke,
                          "licenses": licenses, "strict_types": typed, "offline": True, "build_isolation": False,
                          "dependency_scope": "runtime" if kind == "wheel" else "qualification-for-sdist-build"})
    require(git_source() == before, "candidate_source_changed_during_qualification")
    receipt = {"format_version": 1, "status": "experimental-python-offline-packed-consumers-not-publication",
               "package": {"name": "bota-api-sdk", "version": VERSION, "license": "MIT"},
               "source": before, "artifacts": archive_evidence, "repeated_builds_equal": True,
               "mode": "candidate" if candidate_dir is not None else "producer",
               "repeated_builds_performed": 0 if candidate_dir is not None else 2,
               "producer_receipt_sha256": producer_receipt_sha, "producer_ci_receipt_sha256": producer_ci_sha,
               "qualification_lock_sha256": digest(canonical_source(lock.read_bytes())),
               "typechecker_sha256": digest(typechecker.read_bytes()) if typechecker is not None else None,
               "consumers": consumers}
    (output / "qualification-receipt.json").write_bytes(json_bytes(receipt))
    return receipt


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--python", type=Path, required=True)
    parser.add_argument("--wheelhouse", type=Path, required=True)
    parser.add_argument("--lock", type=Path, default=PACKAGE_ROOT / "requirements/qualification.txt")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--typechecker", type=Path, required=True)
    parser.add_argument("--candidate-dir", type=Path)
    parser.add_argument("--candidate-receipt", type=Path)
    options = parser.parse_args()
    receipt = qualify(options.python, options.wheelhouse, options.lock, options.output_dir, options.typechecker,
                      options.candidate_dir, options.candidate_receipt)
    print(json_bytes({"receipt": str(options.output_dir / "qualification-receipt.json"),
                      "artifacts": receipt["artifacts"], "repeated_builds_equal": receipt["repeated_builds_equal"],
                      "mode": receipt["mode"], "repeated_builds_performed": receipt["repeated_builds_performed"],
                      "consumers": [{"kind": item["kind"], "python": item["runtime"]["python"],
                                     "strict_types": item["strict_types"] is not None} for item in receipt["consumers"]]}).decode(), end="")
