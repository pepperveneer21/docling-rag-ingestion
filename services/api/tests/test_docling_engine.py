"""Fast unit tests for the Docling engine helpers.

These touch only the light helpers (no `docling`/`torch` import), so they run in
the standard verify:api suite without the ML stack installed — proving the
device policy is CPU-safe and the export-format → extension map is correct.
"""

from app.repo import docling_engine


def test_select_device_defaults_to_cpu_without_torch(monkeypatch):
    """With torch unavailable, device selection must fall back to CPU, not crash
    and never hard-require a GPU."""
    import builtins

    real_import = builtins.__import__

    def _no_torch(name, *args, **kwargs):
        if name == "torch":
            raise ImportError("torch not installed")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", _no_torch)
    assert docling_engine._select_device() == "cpu"


def test_parsed_extension_maps_every_format():
    assert docling_engine.parsed_extension("markdown") == "md"
    assert docling_engine.parsed_extension("json") == "json"
    assert docling_engine.parsed_extension("html") == "html"
    assert docling_engine.parsed_extension("text") == "txt"
    # Unknown formats degrade to markdown's extension.
    assert docling_engine.parsed_extension("weird") == "md"
