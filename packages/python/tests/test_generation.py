"""Source-only generation boundaries, requiring no installed transport packages."""
from __future__ import annotations

import ast
import copy
import importlib.util
import json
from pathlib import Path
import runpy
import unittest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("python_generation", ROOT / "tools" / "generate.py")
assert SPEC is not None and SPEC.loader is not None
generation = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(generation)


class GenerationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.document, cls.cohort, cls.inputs = generation.load_inputs()

    def test_checked_inputs_projection_and_repeated_generation_are_exact(self):
        self.assertEqual(len(self.inputs), 6)
        generation.generate(check=True)
        first = generation.render(self.document, self.cohort)
        self.assertEqual(first, generation.render(self.document, self.cohort))
        self.assertEqual(set(first), {"__init__.py", "models.py", "client.py", "operations.py", "methods.json"})
        for name, value in first.items():
            if name.endswith(".py"):
                compile(value, name, "exec", dont_inherit=True)

    def test_generated_inventory_and_methods_are_exact_pinned_reads(self):
        metadata = runpy.run_path(str(generation.OUTPUT / "operations.py"))
        methods = json.loads((generation.OUTPUT / "methods.json").read_bytes())
        self.assertEqual(tuple(metadata["OPERATIONS"]), tuple(sorted(generation.IDS)))
        self.assertEqual(tuple(metadata["OPERATION_IDS"]), generation.IDS)
        self.assertEqual([entry["operation_id"] for entry in methods], list(generation.IDS))
        source = ast.parse((generation.OUTPUT / "client.py").read_bytes())
        public = next(node for node in source.body if isinstance(node, ast.ClassDef))
        self.assertEqual(public.name, "BotaApiClient")
        self.assertEqual([node.name for node in public.body if isinstance(node, ast.AsyncFunctionDef)],
                         [generation.snake(name) for name in generation.IDS])
        for node in public.body:
            if isinstance(node, ast.AsyncFunctionDef):
                self.assertEqual(len(node.body), 1)
                self.assertIsInstance(node.body[0], ast.Return)
                # Defaults preserve explicit None as an invalid input, rather than omission.
                self.assertTrue(all(isinstance(default, ast.Name) and default.id == "UNSET" for default in node.args.defaults))

    def test_models_preserve_required_nullable_union_and_annotation_only_scope(self):
        models = runpy.run_path(str(generation.OUTPUT / "models.py"))
        self.assertEqual(models["ProjectIdentityVariant1"].__required_keys__,
                         frozenset({"project_id", "organization_id", "key_id", "is_test_mode", "key_type", "scope_mode", "scopes"}))
        self.assertEqual(models["GetDevicesInput"].__required_keys__, frozenset())
        self.assertEqual(models["GetDevicesByIdInput"].__required_keys__, frozenset({"path"}))
        self.assertIn("audio_url", models["RecordingDetail"].__required_keys__)
        self.assertIn("total", models["GetRecordingsResponse"].__required_keys__)
        text = (generation.OUTPUT / "models.py").read_text("utf-8")
        self.assertIn("file_size_bytes: 'int | str | None'", text)
        self.assertIn("confidence: \"int | float | str | Literal['NaN'] | None\"", text)
        self.assertNotIn("pydantic", text)

    def test_unsupported_schema_keywords_refs_and_intersections_fail_closed(self):
        for schema in [
            {"type": "string", "not": {"const": "hidden"}},
            {"$ref": "https://outside.invalid/schema"},
            {"$ref": "#/components/schemas/Missing"},
            {"$ref": "#/components/schemas/EndUser", "type": "object"},
            {"type": "array"}, {"type": "strange"}, {"anyOf": []},
            {"allOf": [{"type": "string"}, {"type": "integer"}]},
            {"type": "object", "properties": {"field": {"type": "string"}}, "additionalProperties": {"type": "integer"}},
            {"type": "object", "properties": {"class": {"type": "string"}}},
        ]:
            with self.subTest(schema=schema), self.assertRaises(ValueError):
                generation.Renderer(self.document["components"]["schemas"]).annotation(schema, "Synthetic")

    def test_operation_expansion_collisions_or_parameter_drift_refuse_generation(self):
        mutations = [
            lambda document: document["paths"]["/devices"].update(post={}),
            lambda document: document["paths"]["/devices"]["get"].update(operationId="getEndUsers"),
            lambda document: document["paths"]["/devices"]["get"].update(operationId="read"),
            lambda document: document["paths"]["/devices"]["get"].update(requestBody={}),
            lambda document: document["paths"]["/devices"]["get"]["parameters"].append(
                copy.deepcopy(document["paths"]["/devices"]["get"]["parameters"][0])),
            lambda document: document["paths"]["/devices/{id}"]["get"]["parameters"][0].update(required=False),
        ]
        for mutate in mutations:
            document = copy.deepcopy(self.document)
            mutate(document)
            with self.assertRaises(ValueError):
                generation.render(document, self.cohort)

    def test_source_projector_rejects_remote_missing_and_unsupported_references(self):
        source = {"openapi": "3.1.0", "info": {}, "servers": [{"url": "https://fixture.invalid/v1"}],
                  "security": [], "paths": {"/fixture": {"get": {"operationId": "fixture", "responses": {}}}}, "components": {"schemas": {"Fixture": {"type": "string"}}}}
        cohort = {"baseUrl": "https://fixture.invalid/v1", "paths": ["/fixture"]}
        for ref in ["https://outside.invalid/schema", "#/components/schemas/Missing", "#/components/unapproved/Fixture", "#/components/schemas/~2bad"]:
            changed = copy.deepcopy(source)
            changed["paths"]["/fixture"]["get"]["responses"] = {"200": {"$ref": ref}}
            with self.subTest(ref=ref), self.assertRaises(ValueError):
                generation.project(changed, cohort)


if __name__ == "__main__":
    unittest.main()
