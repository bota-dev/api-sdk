"""Qualify exact normal CPython builds and one canonical offline SDK candidate."""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import platform
import shutil
import struct
import subprocess
import sys
import sysconfig

sys.path.insert(0, str(Path(__file__).resolve().parent))
from package_policy import (  # noqa: E402
    PACKAGE_ROOT, WORKSPACE, PACKAGE, VERSION, WHEEL_NAME, SDIST_NAME,
    digest, git_source, json_bytes, regular_file, require,
)
import dependencies  # noqa: E402
from install_dependencies import verify_wheelhouse  # noqa: E402


STATUS = "experimental-python-ci-qualification-not-publication"
QUALIFICATION_STATUS = "experimental-python-offline-packed-consumers-not-publication"
QUALIFICATION = "qualification-receipt.json"
CI_RECEIPT = "ci-receipt.json"
STAGED = (WHEEL_NAME, SDIST_NAME, QUALIFICATION)
ARTIFACTS = (*STAGED, CI_RECEIPT)
HOSTED = {"Linux": ("3.12.15", "3.13.16", "3.14.8", "3.15.0"),
          "Windows": ("3.13.16", "3.14.8", "3.15.0")}
ENVIRONMENT = {"path", "pathext", "systemroot", "systemdrive", "windir", "comspec", "temp", "tmp", "os"}


def safe_environment() -> dict[str, str]:
    result = {key: value for key, value in os.environ.items() if key.lower() in ENVIRONMENT}
    result.update(PIP_CONFIG_FILE=os.devnull, NETRC=os.devnull, NO_PROXY="*", PIP_DISABLE_PIP_VERSION_CHECK="1",
                  PYTHONNOUSERSITE="1", PYTHONDONTWRITEBYTECODE="1")
    return result


def runtime_facts() -> dict[str, object]:
    jit = getattr(sys, "_jit", None)
    enabled = getattr(jit, "is_enabled", None)
    gil_enabled = getattr(sys, "_is_gil_enabled", None)
    return {"implementation": sys.implementation.name, "version": platform.python_version(),
            "system": platform.system(), "machine": platform.machine().lower(), "bits": struct.calcsize("P") * 8,
            "debug": bool(sysconfig.get_config_var("Py_DEBUG")) or hasattr(sys, "gettotalrefcount"),
            "free_threaded": bool(sysconfig.get_config_var("Py_GIL_DISABLED")),
            "gil_enabled": bool(gil_enabled()) if callable(gil_enabled) else True,
            "jit_enabled": bool(enabled()) if callable(enabled) else False}


def validate_runtime(facts: dict[str, object], expected: str, development: bool = False) -> None:
    require(isinstance(facts, dict), "runtime_record_required")
    require(facts.get("implementation") == "cpython" and facts.get("version") == expected, "exact_cpython_required")
    require(facts.get("system") in HOSTED and facts.get("machine") in {"amd64", "x86_64"}
            and facts.get("bits") == 64, "supported_x64_platform_required")
    require(facts.get("debug") is False and facts.get("free_threaded") is False
            and facts.get("gil_enabled") is True and facts.get("jit_enabled") is False, "normal_gil_nondebug_nojit_required")
    require(expected in HOSTED[str(facts["system"])] or development and expected == "3.12.14", "unqualified_python_version")


def no_links(path: Path) -> None:
    require(path.is_absolute(), "absolute_ci_path_required")
    require(all(not part.is_symlink() and not part.is_junction() for part in (path, *path.parents)), "linked_ci_path")


def new_external_output(path: Path) -> None:
    no_links(path)
    require(not path.exists() and path.parent.is_dir(), "new_ci_output_required")
    require(not path.resolve().is_relative_to(WORKSPACE.resolve()), "ci_output_inside_checkout")


def fixed_files(directory: Path, names: tuple[str, ...] = ARTIFACTS) -> dict[str, bytes]:
    no_links(directory)
    require(directory.is_dir() and {path.name for path in directory.iterdir()} == set(names), "ci_artifact_inventory")
    result = {}
    for name in names:
        path = regular_file(directory, name)
        require(path.stat().st_size <= 8 * 1024 * 1024, "ci_artifact_byte_limit")
        result[name] = path.read_bytes()
    return result


def qualification_receipt(blobs: dict[str, bytes], source: dict[str, object]) -> dict:
    receipt = json.loads(blobs[QUALIFICATION])
    require(isinstance(receipt, dict), "qualification_receipt_object_required")
    require(receipt.get("status") == QUALIFICATION_STATUS and json_bytes(receipt.get("source")) == json_bytes(source), "qualification_source_or_status_drift")
    require(receipt.get("package") == {"name": PACKAGE, "version": VERSION, "license": "MIT"}, "qualification_package_drift")
    evidence = receipt.get("artifacts", {})
    require(isinstance(evidence, dict), "qualification_artifact_record_required")
    require(evidence.get("wheel_sha256") == digest(blobs[WHEEL_NAME])
            and evidence.get("sdist_sha256") == digest(blobs[SDIST_NAME]), "qualification_archive_digest_drift")
    return receipt


def inspect_candidate(directory: Path, receipt_path: Path, source: dict[str, object], development: bool = False) -> dict:
    no_links(receipt_path)
    require(receipt_path.resolve() == (directory / QUALIFICATION).resolve(), "candidate_receipt_path_drift")
    blobs = fixed_files(directory)
    qualification = qualification_receipt(blobs, source)
    ci = json.loads(blobs[CI_RECEIPT])
    require(isinstance(ci, dict), "canonical_ci_receipt_object_required")
    require(type(ci.get("format_version")) is int and ci["format_version"] == 1 and ci.get("status") == STATUS and ci.get("mode") == "producer"
            and json_bytes(ci.get("source")) == json_bytes(source) and ci.get("package") == qualification["package"], "canonical_ci_identity_drift")
    require(ci.get("development") is False or development, "development_candidate_not_hosted_qualified")
    require(ci.get("artifacts") == {name: digest(blobs[name]) for name in STAGED}, "canonical_ci_artifact_digest_drift")
    require(qualification.get("mode") == "producer" and type(qualification.get("repeated_builds_performed")) is int
            and qualification["repeated_builds_performed"] == 2 and qualification.get("repeated_builds_equal") is True,
            "canonical_repeated_build_proof_required")
    validate_runtime(ci["runtime"], str(ci["runtime"]["version"]), bool(ci.get("development")))
    return {"ci_receipt_sha256": digest(blobs[CI_RECEIPT]), "qualification_receipt_sha256": digest(blobs[QUALIFICATION]),
            "wheel_sha256": digest(blobs[WHEEL_NAME]), "sdist_sha256": digest(blobs[SDIST_NAME])}


def stage_results(directory: Path, destination: Path, source: dict[str, object], ci: dict, candidate: dict | None = None) -> None:
    no_links(directory)
    no_links(destination)
    require(not destination.exists(), "new_ci_staging_required")
    blobs = {name: regular_file(directory, name).read_bytes() for name in STAGED}
    qualification = qualification_receipt(blobs, source)
    if candidate is not None:
        require(digest(blobs[WHEEL_NAME]) == candidate["wheel_sha256"]
                and digest(blobs[SDIST_NAME]) == candidate["sdist_sha256"], "canonical_archive_replaced")
        require(qualification.get("mode") == "candidate" and type(qualification.get("repeated_builds_performed")) is int
                and qualification["repeated_builds_performed"] == 0
                and qualification.get("producer_receipt_sha256") == candidate["qualification_receipt_sha256"]
                and qualification.get("producer_ci_receipt_sha256") == candidate["ci_receipt_sha256"], "candidate_receipt_binding_drift")
    else:
        require(qualification.get("mode") == "producer" and type(qualification.get("repeated_builds_performed")) is int
                and qualification["repeated_builds_performed"] == 2
                and qualification.get("repeated_builds_equal") is True, "producer_receipt_binding_drift")
    destination.mkdir()
    ci["artifacts"] = {name: digest(value) for name, value in blobs.items()}
    for name, value in blobs.items():
        (destination / name).write_bytes(value)
    (destination / CI_RECEIPT).write_bytes(json_bytes(ci))
    staged = fixed_files(destination)
    require(all(staged[name] == value for name, value in blobs.items()), "ci_staging_changed")


def execute(label: str, executable: Path, args: list[str], cwd: Path, logs: Path, timeout: int = 600) -> None:
    require(label.replace("-", "").isalnum(), "unsafe_ci_stage")
    print("Running Python SDK qualification stage:", label, flush=True)
    try:
        result = subprocess.run([str(executable), *args], cwd=cwd, env=safe_environment(), stdin=subprocess.DEVNULL,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout, check=False,
                                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    except subprocess.TimeoutExpired as error:
        (logs / (label + ".stdout")).write_bytes(error.stdout or b"")
        (logs / (label + ".stderr")).write_bytes(error.stderr or b"")
        sys.stdout.write((error.stdout or b"").decode("utf-8", errors="replace"))
        sys.stderr.write((error.stderr or b"").decode("utf-8", errors="replace"))
        raise ValueError("ci_stage_failed:" + label) from None
    (logs / (label + ".stdout")).write_bytes(result.stdout)
    (logs / (label + ".stderr")).write_bytes(result.stderr)
    sys.stdout.write(result.stdout.decode("utf-8", errors="replace"))
    sys.stderr.write(result.stderr.decode("utf-8", errors="replace"))
    if result.returncode:
        raise ValueError("ci_stage_failed:" + label)


def main(args: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected-python", required=True)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--fetch", action="store_true", help="Explicitly acquire reviewed public wheels before offline installation.")
    parser.add_argument("--wheelhouse", type=Path, help="Read-only reviewed wheel seed for an offline run.")
    parser.add_argument("--candidate-dir", type=Path)
    parser.add_argument("--candidate-receipt", type=Path)
    parser.add_argument("--development", action="store_true", help="Permit dirty source and local CPython3.12.14; never hosted qualification.")
    options = parser.parse_args(args)
    facts = runtime_facts()
    validate_runtime(facts, options.expected_python, options.development)
    new_external_output(options.output_dir)
    require(bool(options.candidate_dir) == bool(options.candidate_receipt), "paired_candidate_paths_required")
    source = git_source()
    require(options.development or source.get("dirty") is False, "clean_source_required")
    candidate = inspect_candidate(options.candidate_dir, options.candidate_receipt, source, options.development) if options.candidate_dir else None
    if options.wheelhouse:
        no_links(options.wheelhouse)
    policy = json.loads(regular_file(PACKAGE_ROOT, "requirements/policy.json").read_bytes())
    dependencies.validate_policy(policy)
    seed = verify_wheelhouse(options.wheelhouse, policy) if options.wheelhouse else {}
    require(options.fetch or bool(seed), "reviewed_wheels_or_explicit_fetch_required")
    output = options.output_dir
    output.mkdir()
    logs = output / "logs"
    logs.mkdir()
    wheelhouse = output / "wheelhouse"
    wheelhouse.mkdir()
    for name in seed:
        shutil.copyfile(regular_file(options.wheelhouse, name), wheelhouse / name)
    verify_wheelhouse(wheelhouse, policy)
    venv = output / "venv"
    execute("create-venv", Path(sys.executable), ["-I", "-B", "-m", "venv", "--copies", str(venv)], PACKAGE_ROOT, logs)
    python = venv / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    prefix = ["-I", "-B"]
    execute("dependencies", python, [*prefix, "tools/install_dependencies.py", "--wheelhouse", str(wheelhouse), *(["--fetch"] if options.fetch else [])], PACKAGE_ROOT, logs)
    execute("dependency-policy", python, [*prefix, "tools/dependencies.py", "--check"], PACKAGE_ROOT, logs)
    execute("installed-metadata", python, [*prefix, "tools/dependencies.py", "--installed"], PACKAGE_ROOT, logs)
    execute("generation", python, [*prefix, "tools/generate.py", "--check"], PACKAGE_ROOT, logs)
    execute("source-tests", python, [*prefix, "-m", "unittest", "discover", "-s", "tests", "-v"], PACKAGE_ROOT, logs)
    execute("source-types", python, [*prefix, "-m", "ty", "check", "src", "--python", str(python), "--python-version", ".".join(options.expected_python.split(".")[:2]), "--error", "all", "--error-on-warning"], PACKAGE_ROOT, logs)
    typechecker = venv / ("Scripts/ty.exe" if os.name == "nt" else "bin/ty")
    qualification = output / "qualification"
    verifier = [*prefix, "tools/verify_package.py", "--python", str(python), "--wheelhouse", str(wheelhouse),
                "--output-dir", str(qualification), "--typechecker", str(typechecker)]
    if candidate is not None:
        verifier += ["--candidate-dir", str(options.candidate_dir), "--candidate-receipt", str(options.candidate_receipt)]
    execute("packed-consumers", python, verifier, PACKAGE_ROOT, logs)
    require(git_source() == source, "source_changed_during_ci")
    record = {"format_version": 1, "status": STATUS, "package": {"name": PACKAGE, "version": VERSION, "license": "MIT"},
              "mode": "candidate" if candidate else "producer", "development": options.development, "runtime": facts, "source": source,
              "runner_sha256": digest(Path(__file__).read_bytes()), "dependency_policy_sha256": digest(json_bytes(policy)),
              "producer_ci_receipt_sha256": candidate["ci_receipt_sha256"] if candidate else None,
              "producer_receipt_sha256": candidate["qualification_receipt_sha256"] if candidate else None,
              "checks": ["dependency-policy", "installed-metadata", "generation", "source-tests", "source-types", "packed-consumers"],
              "limitations": "Synthetic source and offline archive qualification; no publication or live backend acceptance."}
    stage_results(qualification, output / "artifacts", source, record, candidate)
    require(git_source() == source, "source_changed_during_ci_staging")
    print(json.dumps({"status": STATUS, "mode": record["mode"], "artifacts": list(ARTIFACTS), "development": options.development}))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, KeyError, TypeError, RecursionError):
        print("Python SDK qualification failed; inspect the fixed stage logs.", file=sys.stderr)
        raise SystemExit(1) from None
