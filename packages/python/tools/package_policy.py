"""Closed archive/source policy for the experimental Python SDK candidate."""
from __future__ import annotations

import base64
import csv
from email.parser import BytesParser
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import tarfile
import tomllib
import zipfile

PACKAGE = "bota-api-sdk"
VERSION = "0.1.0b0"
DIST = f"bota_api_sdk-{VERSION}"
DIST_INFO = f"{DIST}.dist-info"
WHEEL_NAME = f"{DIST}-py3-none-any.whl"
SDIST_NAME = f"{DIST}.tar.gz"
SOURCE_DATE_EPOCH = "946684800"
SHARED_INPUTS = ("LICENSE", "package.json", "package-lock.json", "scripts/check-licenses.mjs",
    "packages/typescript/cohort.json", "packages/typescript/input.json", "packages/typescript/source-openapi.json.gz",
    "packages/typescript/conformance/corpus.json", "packages/typescript/conformance/corpus.schema.json",
    "packages/typescript/conformance/policy.json", "packages/typescript/mutation-cohort.json",
    "packages/typescript/mutation-input.json", "packages/typescript/mutation-source-openapi.json.gz",
    "packages/typescript/mutations/corpus.json", "packages/typescript/mutations/policy.json")
MAX_ARCHIVE = 8 * 1024 * 1024
MAX_EXPANDED = 16 * 1024 * 1024
SOURCE_FILES = (
    "__init__.py", "client.py", "runtime.py", "native_transport.py", "py.typed",
    "generated/__init__.py", "generated/client.py", "generated/models.py",
    "generated/operations.py", "generated/methods.json", "generated/provenance.json",
    "generated/mutations/__init__.py", "generated/mutations/models.py", "generated/mutations/operations.py",
    "generated/mutations/methods.json", "generated/mutations/provenance.json",
)
PAYLOAD_FILES = tuple(sorted((*SOURCE_FILES, "package_provenance.json")))
WHEEL_FILES = tuple(sorted((*[f"bota_api_sdk/{name}" for name in PAYLOAD_FILES],
    *[f"{DIST_INFO}/{name}" for name in ("METADATA", "WHEEL", "RECORD", "licenses/LICENSE")])) )
SDIST_FILES = tuple(sorted(("pyproject.toml", "README.md", "LICENSE", "PKG-INFO",
    *[f"src/bota_api_sdk/{name}" for name in PAYLOAD_FILES])))
PACKAGE_ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = PACKAGE_ROOT.parents[1]
PLATFORM_ENV = {"path", "pathext", "systemroot", "systemdrive", "windir", "comspec", "temp", "tmp", "os"}


def require(value: object, message: str) -> None:
    if not value:
        raise ValueError(message)


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def json_bytes(value: object) -> bytes:
    return (json.dumps(value, sort_keys=True, ensure_ascii=True, indent=2, allow_nan=False) + "\n").encode()


def canonical_source(value: bytes) -> bytes:
    """Text is canonical LF; binary generation inputs retain their exact bytes."""
    try:
        value.decode("utf-8", errors="strict")
    except UnicodeDecodeError:
        return value
    return value.replace(b"\r\n", b"\n")


def child_environment() -> dict[str, str]:
    env = {key: value for key, value in os.environ.items() if key.lower() in PLATFORM_ENV}
    env.update(SOURCE_DATE_EPOCH=SOURCE_DATE_EPOCH, PIP_CONFIG_FILE=os.devnull,
               PIP_DISABLE_PIP_VERSION_CHECK="1", PYTHONNOUSERSITE="1", NETRC=os.devnull, NO_PROXY="*")
    return env


def run(executable: Path | str, args: list[str], cwd: Path, timeout: int = 180) -> str:
    result = subprocess.run([str(executable), *args], cwd=cwd, env=child_environment(),
        stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, encoding="utf-8", errors="strict", timeout=timeout, check=False)
    if result.returncode:
        # Child diagnostics contain synthetic test inputs only; no ambient env survives.
        raise RuntimeError(f"child_failed:{result.returncode}\n{result.stdout}\n{result.stderr}")
    return result.stdout


def safe_name(name: str) -> str:
    require(isinstance(name, str) and bool(name) and "\\" not in name and ":" not in name
            and not name.startswith("/") and all(32 <= ord(char) < 127 for char in name), "unsafe_archive_path")
    parts = name.split("/")
    require(all(part and part not in {".", ".."} for part in parts), "unsafe_archive_path")
    require(str(PurePosixPath(name)) == name, "noncanonical_archive_path")
    return name


def is_link(path: Path) -> bool:
    return path.is_symlink() or path.is_junction()


def regular_file(root: Path, name: str) -> Path:
    safe_name(name)
    current = root
    require(current.is_dir() and not is_link(current), "unsafe_input_root")
    for index, part in enumerate(name.split("/")):
        current /= part
        require(not is_link(current), "symlink_input")
        require(current.is_file() if index == len(name.split("/")) - 1 else current.is_dir(), "nonregular_input")
    require(current.resolve().is_relative_to(root.resolve()), "escaping_input")
    return current


def source_files(root: Path) -> list[str]:
    require(root.is_dir() and not is_link(root), "unsafe_source_root")
    files: list[str] = []
    for directory, directories, names in os.walk(root, followlinks=False):
        parent = Path(directory)
        for name in [*directories, *names]:
            require(not is_link(parent / name), "symlink_source")
        directories[:] = [name for name in directories if name != "__pycache__"]
        for name in names:
            require((parent / name).is_file(), "nonregular_source")
            files.append((parent / name).relative_to(root).as_posix())
    return sorted(files)


def git_source(workspace: Path = WORKSPACE) -> dict[str, object]:
    """Refuse the wrapper repository or a directory with no exact Git identity."""
    top = Path(run("git", ["rev-parse", "--show-toplevel"], workspace).strip()).resolve()
    require(top == workspace.resolve(), "wrong_git_workspace")
    commit = run("git", ["rev-parse", "--verify", "HEAD"], workspace).strip()
    require(re.fullmatch(r"[a-f0-9]{40}", commit), "invalid_git_commit")
    dirty = bool(run("git", ["status", "--porcelain", "--untracked-files=all"], workspace).strip())
    names = run("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], workspace).split("\0")
    require(names[-1] == "" and len(set(names[:-1])) == len(names) - 1, "invalid_source_inventory")
    files = {name: digest(canonical_source(regular_file(workspace, name).read_bytes())) for name in sorted(names[:-1])}
    return {"commit": commit, "dirty": dirty, "state": "committed", "files": files}


def assert_manifest(value: dict) -> None:
    require(value.get("build-system") == {"requires": ["flit_core==4.1.0"], "build-backend": "flit_core.buildapi"}, "python_build_backend_drift")
    project = value["project"]
    require(project["name"] == PACKAGE and project["version"] == VERSION, "python_package_identity")
    require(project["requires-python"] == ">=3.12,<3.16" and project["license"] == "MIT"
            and project["license-files"] == ["LICENSE"], "python_support_license_drift")
    require(project["dependencies"] == ["aiohttp==3.14.5", "yarl==1.25.1"], "python_dependency_drift")
    require(project["readme"] == "README.md" and not any(key in project for key in
            ("dynamic", "scripts", "gui-scripts", "entry-points", "optional-dependencies")), "python_build_hook_or_extra")
    require(set(project) == {"name", "version", "description", "readme", "requires-python", "license", "license-files",
                           "authors", "dependencies", "classifiers", "urls"}, "unreviewed_python_metadata")
    require(value.get("tool", {}).get("flit") == {"module": {"name": "bota_api_sdk"}}, "python_flit_plugin_drift")
    require(set(value) == {"build-system", "project", "tool"}
            and set(value["tool"]) <= {"flit", "ty"}, "unreviewed_python_tooling")
    require(value["tool"].get("ty") == {"rules": {"all": "error"},
            "analysis": {"respect-type-ignore-comments": False}}, "python_type_policy_drift")


def metadata(value: bytes) -> None:
    message = BytesParser().parsebytes(value)
    for key, expected in {"Name": PACKAGE, "Version": VERSION, "License-Expression": "MIT"}.items():
        require(message.get_all(key) == [expected], "python_archive_metadata")
    require(set(str(message["Requires-Python"]).replace(" ", "").split(",")) == {">=3.12", "<3.16"}, "python_archive_support")
    require(sorted(message.get_all("Requires-Dist", [])) == ["aiohttp==3.14.5", "yarl==1.25.1"], "python_archive_dependencies")
    require(message.get_all("License-File") == ["LICENSE"] and not message.get_all("Provides-Extra"), "python_archive_license_extras")


def wheel_files(blob: bytes) -> dict[str, bytes]:
    require(len(blob) <= MAX_ARCHIVE, "wheel_byte_limit")
    files: dict[str, bytes] = {}
    with zipfile.ZipFile(io.BytesIO(blob)) as archive:
        require(len(archive.infolist()) <= 100, "wheel_entry_limit")
        total = 0
        for entry in archive.infolist():
            require(entry.orig_filename == entry.filename, "noncanonical_wheel_filename")
            name = safe_name(entry.filename)
            require(name not in files and not entry.is_dir() and not entry.flag_bits & 1, "unsafe_wheel_entry")
            require(stat.S_IFMT(entry.external_attr >> 16) in {0, stat.S_IFREG}, "nonregular_wheel_entry")
            require(entry.compress_type in {zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED}, "unsupported_wheel_compression")
            total += entry.file_size
            require(entry.file_size <= MAX_ARCHIVE and total <= MAX_EXPANDED, "wheel_expansion_limit")
            files[name] = archive.read(entry)
    require(sorted(files) == list(WHEEL_FILES), "wheel_inventory")
    record = f"{DIST_INFO}/RECORD"
    rows = list(csv.reader(io.StringIO(files[record].decode("utf-8"))))
    require(all(len(row) == 3 for row in rows) and len({row[0] for row in rows}) == len(rows)
            and sorted(row[0] for row in rows) == sorted(files), "wheel_record_inventory")
    for name, hash_value, size in rows:
        if name == record:
            require(hash_value == size == "", "wheel_record_self_hash")
        else:
            expected = base64.urlsafe_b64encode(hashlib.sha256(files[name]).digest()).rstrip(b"=").decode()
            require(hash_value == f"sha256={expected}" and size == str(len(files[name])), "wheel_record_digest")
    metadata(files[f"{DIST_INFO}/METADATA"])
    wheel = BytesParser().parsebytes(files[f"{DIST_INFO}/WHEEL"])
    require(wheel.get_all("Wheel-Version") == ["1.0"] and wheel.get_all("Root-Is-Purelib") == ["true"]
            and wheel.get_all("Tag") == ["py3-none-any"], "wheel_platform_drift")
    return files


def sdist_files(blob: bytes) -> dict[str, bytes]:
    require(len(blob) <= MAX_ARCHIVE, "sdist_byte_limit")
    with gzip.GzipFile(fileobj=io.BytesIO(blob)) as compressed:
        raw = compressed.read(MAX_EXPANDED + 1)
    require(len(raw) <= MAX_EXPANDED, "sdist_expansion_limit")
    files: dict[str, bytes] = {}
    seen: set[str] = set()
    parents = {str(parent) for name in SDIST_FILES for parent in PurePosixPath(name).parents if str(parent) != "."}
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:") as archive:
        for index, entry in enumerate(archive):
            require(index < 100, "sdist_entry_limit")
            name = safe_name(entry.name.rstrip("/") if entry.isdir() else entry.name)
            require(name not in seen and not entry.pax_headers and not entry.linkname, "unsafe_sdist_entry")
            seen.add(name)
            require(name == DIST or name.startswith(DIST + "/"), "sdist_root")
            relative = name[len(DIST) + 1:]
            if entry.isdir():
                require(name == DIST or relative in parents, "unknown_sdist_directory")
                continue
            require(entry.type in {tarfile.REGTYPE, tarfile.AREGTYPE} and relative in SDIST_FILES
                    and entry.size <= MAX_ARCHIVE, "nonregular_or_unknown_sdist_entry")
            stream = archive.extractfile(entry)
            require(stream is not None, "missing_sdist_content")
            files[relative] = stream.read()
    require(sorted(files) == list(SDIST_FILES), "sdist_inventory")
    metadata(files["PKG-INFO"])
    assert_manifest(tomllib.loads(files["pyproject.toml"].decode()))
    return files


def verify_archives(wheel_blob: bytes, sdist_blob: bytes, expected: dict[str, bytes]) -> dict[str, object]:
    wheel, sdist = wheel_files(wheel_blob), sdist_files(sdist_blob)
    require(sorted(expected) == list(PAYLOAD_FILES), "expected_payload_inventory")
    for name, value in expected.items():
        require(wheel[f"bota_api_sdk/{name}"] == value == sdist[f"src/bota_api_sdk/{name}"], "packed_payload_drift")
    require(wheel[f"{DIST_INFO}/METADATA"] == sdist["PKG-INFO"], "wheel_sdist_metadata_drift")
    require(wheel[f"{DIST_INFO}/licenses/LICENSE"] == sdist["LICENSE"], "wheel_sdist_license_drift")
    provenance = json.loads(expected["package_provenance.json"])
    require(provenance["package"] == {"name": PACKAGE, "version": VERSION, "license": "MIT"}, "packed_provenance_identity")
    require(provenance["payload"] == {name: digest(expected[name]) for name in SOURCE_FILES}, "packed_provenance_payload")
    return {"wheel_sha256": digest(wheel_blob), "sdist_sha256": digest(sdist_blob),
            "provenance_sha256": digest(expected["package_provenance.json"]), "wheel_files": len(wheel), "sdist_files": len(sdist)}


def validate_provenance(provenance: dict, source: dict, payload: dict[str, bytes], dependency_policy: dict) -> None:
    """Validate canonical builder facts without equating builder and consumer hosts."""
    require(provenance.get("format_version") == 1 and provenance.get("status") ==
            "experimental-python-packed-candidate-not-publication", "candidate_provenance_format")
    require(provenance.get("source") == source, "candidate_source_mismatch")
    require(provenance.get("package_inputs") == {name: value for name, value in source["files"].items()
            if name.startswith("packages/python/")}, "candidate_package_inputs")
    require(provenance.get("shared_inputs") == {name: source["files"][name] for name in SHARED_INPUTS}, "candidate_shared_inputs")
    require(provenance.get("payload") == {name: digest(payload[name]) for name in SOURCE_FILES}, "candidate_current_payload")
    require(all(source["files"].get(f"packages/python/src/bota_api_sdk/{name}") == digest(payload[name])
                for name in SOURCE_FILES), "candidate_payload_source_snapshot")
    builder = provenance.get("builder", {})
    require(set(builder) == {"implementation", "python", "flit_core", "source_date_epoch", "gil_enabled", "debug", "system", "machine"}
            and builder["implementation"] == "cpython" and re.fullmatch(r"3\.(12|13|14|15)\.\d+", builder["python"])
            and builder["flit_core"] == "4.1.0" and builder["source_date_epoch"] == SOURCE_DATE_EPOCH
            and builder["gil_enabled"] is True and builder["debug"] is False
            and builder["system"] in {"Windows", "Linux"} and builder["machine"].lower() in {"amd64", "x86_64"}, "candidate_builder_record")
    installed = provenance.get("installed_dependencies", {})
    require(installed.get("status") == "qualified-installed-dependency-metadata" and installed.get("python") == builder["python"], "candidate_builder_dependencies")
    expected = dependency_policy["packages"]
    names = set(expected) - ({"typing-extensions"} if int(builder["python"].split(".")[1]) >= 13 else set())
    require(set(installed.get("packages", {})) == names, "candidate_builder_dependency_inventory")
    for name in names:
        item = installed["packages"][name]
        require(item["version"] == expected[name]["version"] and item["admitted_license"] == expected[name]["admitted_license"]
                and re.fullmatch(r"[a-f0-9]{64}", item["metadata_sha256"]), "candidate_builder_dependency_identity")
