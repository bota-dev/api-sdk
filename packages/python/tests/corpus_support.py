"""Bounded validator and normalization for the unchanged shared test corpus."""
from __future__ import annotations

import json
import hashlib
import math
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit


KEYWORDS = {"$schema", "$id", "$defs", "$ref", "title", "description", "type", "const", "enum",
            "oneOf", "required", "properties", "additionalProperties", "items", "minItems", "maxItems",
            "minLength", "maxLength", "minimum", "maximum"}
PINS = {"corpus.json": "f21f2511c968d540383d3ebb37795c15a35217d1e18af1497850f34093c7b16c",
        "corpus.schema.json": "bd52147b27ac68ed6cbcb9374911240cbebf192eeb3a72ef6ed26b85c3d9de56",
        "policy.json": "17f255b8d3e4bccad41607e7589b3f47e6be736e37070b1dfdcd94137b2ddc71"}


def load_shared(directory: Path):
    files = {}
    for name, expected in PINS.items():
        path = directory / name
        if path.is_symlink() or not path.is_file():
            raise ValueError("nonregular_shared_fixture")
        value = path.read_bytes()
        if hashlib.sha256(value).hexdigest() != expected:
            raise ValueError("shared_fixture_digest_mismatch")
        files[name] = json.loads(value.decode("utf-8", errors="strict"))
    schema = files["corpus.schema.json"]
    corpus = assert_corpus(schema, files["corpus.json"])
    if len(corpus["cases"]) != 94 or corpus["policyId"] != files["policy.json"]["id"]:
        raise ValueError("shared_fixture_scope_mismatch")
    return schema, corpus


def equal(left, right):
    if type(left) is bool or type(right) is bool:
        return type(left) is type(right) and left == right
    if isinstance(left, (float, int)) and isinstance(right, (float, int)):
        return left == right
    if type(left) is not type(right):
        return False
    if isinstance(left, list):
        return len(left) == len(right) and all(equal(a, b) for a, b in zip(left, right))
    if isinstance(left, dict):
        return left.keys() == right.keys() and all(equal(value, right[key]) for key, value in left.items())
    return left == right


def assert_corpus(schema, corpus):
    """Only the checked corpus schema keyword subset; never resolve external refs."""
    def check(rule, value, depth=0):
        if not isinstance(rule, dict) or depth > 32 or not set(rule) <= KEYWORDS:
            raise ValueError("unsupported_conformance_schema")
        valid = True
        if "$ref" in rule:
            ref = rule["$ref"]
            if not isinstance(ref, str) or not ref.startswith("#/$defs/") or not ref[8:].isalnum():
                raise ValueError("unsupported_conformance_reference")
            target = schema.get("$defs", {}).get(ref[8:])
            if target is None:
                raise ValueError("missing_conformance_reference")
            valid = check(target, value, depth + 1) and valid
        if "oneOf" in rule:
            valid = sum(check(part, value, depth + 1) for part in rule["oneOf"]) == 1 and valid
        if "const" in rule:
            valid = equal(rule["const"], value) and valid
        if "enum" in rule:
            valid = any(equal(part, value) for part in rule["enum"]) and valid
        kind = rule.get("type")
        if kind:
            matches = {"object": isinstance(value, dict), "array": isinstance(value, list),
                       "integer": type(value) in (int, float) and math.isfinite(value) and int(value) == value and abs(value) <= 2 ** 53 - 1,
                       "null": value is None, "string": isinstance(value, str), "boolean": type(value) is bool}
            valid = matches.get(kind, False) and valid
        if type(value) in (int, float):
            valid = rule.get("minimum", -math.inf) <= value <= rule.get("maximum", math.inf) and valid
        if isinstance(value, str):
            valid = rule.get("minLength", 0) <= len(value) <= rule.get("maxLength", math.inf) and valid
        if isinstance(value, list):
            valid = rule.get("minItems", 0) <= len(value) <= rule.get("maxItems", math.inf) and valid
            if "items" in rule:
                valid = all(check(rule["items"], part, depth + 1) for part in value) and valid
        if isinstance(value, dict):
            valid = all(key in value for key in rule.get("required", [])) and valid
            for key, part in value.items():
                if key in rule.get("properties", {}):
                    valid = check(rule["properties"][key], part, depth + 1) and valid
                elif rule.get("additionalProperties") is False:
                    valid = False
                elif isinstance(rule.get("additionalProperties"), dict):
                    valid = check(rule["additionalProperties"], part, depth + 1) and valid
        return valid

    if not check(schema, corpus):
        raise ValueError("invalid_conformance_corpus")
    ids = set()
    for fixture in corpus["cases"]:
        if fixture["id"] in ids:
            raise ValueError("duplicate_conformance_case")
        ids.add(fixture["id"])
        expected = fixture["expect"]
        if len(fixture["script"]) != len(expected["calls"]):
            raise ValueError("invalid_conformance_script_calls")
        mode = fixture["invoke"]["mode"]
        if (int("result" in expected) + int("error" in expected) > 1
                or mode == "read" and (not ({"result", "error"} & expected.keys()) or "pages" in expected)
                or mode == "pages" and ("pages" not in expected or "result" in expected)):
            raise ValueError("invalid_conformance_outcome")
        if expected["credentialCalls"] != len(expected["calls"]) and "error" not in expected:
            raise ValueError("invalid_conformance_calls")
        for step in fixture["script"]:
            if step["type"] == "response" and sum(key in step for key in ("body", "bodyText", "bodyBytes", "bodyFault")) != 1:
                raise ValueError("invalid_conformance_response")
    return corpus


def semantic_url(value: str):
    split = urlsplit(value)
    if "@" in split.netloc or "#" in value or split.username is not None or split.password is not None:
        raise ValueError("unsafe_conformance_url")
    pairs = sorted(parse_qsl(split.query, keep_blank_values=True, encoding="utf-8", errors="strict"),
                   key=lambda pair: (pair[0].encode("utf-8"), pair[1].encode("utf-8")))
    return {"origin": f"{split.scheme}://{split.netloc}", "pathname": split.path, "query": pairs}


def encoded_secret(value: str) -> str:
    from urllib.parse import quote
    return quote(value, safe="~()*!.'-_")


def renamed_options(value):
    if not isinstance(value, dict):
        return value
    names = {"baseUrl": "base_url", "allowLoopbackHttp": "allow_loopback_http", "maxRetries": "max_retries",
             "maxResponseBytes": "max_response_bytes", "timeoutMs": "timeout_ms", "maxPages": "max_pages", "maxItems": "max_items"}
    return {names.get(key, key): part for key, part in value.items()}


def json_body(value) -> bytes:
    return json.dumps(value, ensure_ascii=False, allow_nan=False).encode("utf-8")
