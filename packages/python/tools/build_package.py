"""Build an allowlisted wheel/sdist without changing tracked package sources."""
from __future__ import annotations

import argparse
import importlib.metadata
import json
from pathlib import Path
import platform
import sys
import sysconfig
import tempfile
import tomllib

sys.path.insert(0, str(Path(__file__).resolve().parent))
from package_policy import (  # noqa: E402
    PACKAGE, VERSION, PACKAGE_ROOT, WORKSPACE, SOURCE_FILES, WHEEL_NAME, SDIST_NAME,
    SOURCE_DATE_EPOCH, SHARED_INPUTS, assert_manifest, canonical_source, digest, git_source,
    json_bytes, regular_file, require, run, source_files, verify_archives,
)


def build(output: Path) -> dict[str, object]:
    require(sys.implementation.name == "cpython" and (3, 12) <= sys.version_info[:2] < (3, 16), "unsupported_build_python")
    require(not sysconfig.get_config_var("Py_GIL_DISABLED") and not sysconfig.get_config_var("Py_DEBUG"), "normal_gil_build_required")
    require(platform.system() in {"Windows", "Linux"} and platform.machine().lower() in {"amd64", "x86_64"}, "reviewed_build_platform_required")
    require(importlib.metadata.version("flit_core") == "4.1.0", "build_backend_version")
    require(output.is_absolute() and not output.exists(), "new_absolute_build_output_required")
    require(not output.resolve().is_relative_to(WORKSPACE.resolve()), "build_output_must_be_outside_checkout")
    require(output.parent.is_dir() and not output.parent.is_symlink(), "unsafe_build_parent")
    before = git_source()
    assert_manifest(tomllib.loads(regular_file(PACKAGE_ROOT, "pyproject.toml").read_text(encoding="utf-8")))
    require(source_files(PACKAGE_ROOT / "src/bota_api_sdk") == sorted(SOURCE_FILES), "python_source_payload_inventory")
    require(canonical_source(regular_file(PACKAGE_ROOT, "LICENSE").read_bytes()) ==
            canonical_source(regular_file(WORKSPACE, "LICENSE").read_bytes()), "source_license_mismatch")
    run(sys.executable, ["-I", "-B", "tools/generate.py", "--check"], PACKAGE_ROOT)
    run(sys.executable, ["-I", "-B", "tools/generate_mutations.py", "--check"], PACKAGE_ROOT)
    run(sys.executable, ["-I", "-B", "tools/dependencies.py", "--check"], PACKAGE_ROOT)
    installed = json.loads(run(sys.executable, ["-I", "-B", "tools/dependencies.py", "--installed"], PACKAGE_ROOT))
    # Include the exact package, reviewed shared contract/corpus and lock/license
    # tooling. The complete source snapshot also guards unrelated candidate edits.
    package_inputs = {name: value for name, value in before["files"].items()
                      if name.startswith("packages/python/")}
    shared = {name: before["files"][name] for name in SHARED_INPUTS}
    payload = {name: canonical_source(regular_file(PACKAGE_ROOT, f"src/bota_api_sdk/{name}").read_bytes()) for name in SOURCE_FILES}
    require(all(digest(value) == before["files"][f"packages/python/src/bota_api_sdk/{name}"]
                for name, value in payload.items()), "payload_differs_from_source_snapshot")
    provenance = {
        "format_version": 1, "status": "experimental-python-packed-candidate-not-publication",
        "package": {"name": PACKAGE, "version": VERSION, "license": "MIT"}, "source": before,
        "input_hashing": "SHA-256 of UTF-8 text with CRLF normalized to LF; non-UTF-8 binary inputs remain byte-exact.",
        "package_inputs": package_inputs, "shared_inputs": shared,
        "payload": {name: digest(value) for name, value in payload.items()},
        "builder": {"implementation": sys.implementation.name, "python": platform.python_version(),
                    "flit_core": "4.1.0", "source_date_epoch": SOURCE_DATE_EPOCH,
                    "gil_enabled": True, "debug": False, "system": platform.system(), "machine": platform.machine()},
        "installed_dependencies": installed,
        "limitations": "Source/archive evidence only; no publication, hosted/runtime-matrix or live backend acceptance is inferred.",
    }
    payload["package_provenance.json"] = json_bytes(provenance)
    output.mkdir()
    stage = Path(tempfile.mkdtemp(prefix="allowlisted-stage-", dir=output))
    for name in ("pyproject.toml", "README.md", "LICENSE"):
        value = canonical_source(regular_file(PACKAGE_ROOT, name).read_bytes())
        require(digest(value) == before["files"][f"packages/python/{name}"], "metadata_differs_from_source_snapshot")
        (stage / name).write_bytes(value)
    for name, value in payload.items():
        target = stage / "src/bota_api_sdk" / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(value)
        target.chmod(0o644)
    archives = output / "dist"
    archives.mkdir()
    code = ("from flit_core.buildapi import build_wheel,build_sdist; "
            f"assert build_wheel({str(archives)!r}) == {WHEEL_NAME!r}; "
            f"assert build_sdist({str(archives)!r}) == {SDIST_NAME!r}")
    run(sys.executable, ["-I", "-B", "-c", code], stage)
    require(source_files(archives) == sorted((WHEEL_NAME, SDIST_NAME)), "build_artifact_inventory")
    evidence = verify_archives((archives / WHEEL_NAME).read_bytes(), (archives / SDIST_NAME).read_bytes(), payload)
    require(git_source() == before, "candidate_source_changed_during_build")
    receipt = {"format_version": 1, "status": "experimental-python-build-not-publication", "source": before,
               "builder": provenance["builder"], "artifacts": evidence}
    (output / "receipt.json").write_bytes(json_bytes(receipt))
    return receipt


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", required=True, type=Path)
    options = parser.parse_args()
    receipt = build(options.output_dir)
    print(json_bytes({"receipt": str(options.output_dir / "receipt.json"),
                      "artifacts": receipt["artifacts"], "builder": receipt["builder"]}).decode(), end="")
