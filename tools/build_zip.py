#!/usr/bin/env python3
"""Package a Chrome Web Store-ready zip of the extension.

Only runtime files are included, and the `update_url` key (used for
self-hosted .crx updates) is stripped from the packaged manifest, since the
Chrome Web Store rejects it.

Usage:
    python tools/build_zip.py
"""
import json
import os
import shutil
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")

# Files loaded by the extension at runtime.
FILES = [
    "background.js",
    "editor.html",
    "editor.js",
    "editor.css",
]
# Directories included entirely.
DIRS = [
    "icons",
    "lib",
]


def build():
    with open(os.path.join(ROOT, "manifest.json"), encoding="utf-8") as fh:
        manifest = json.load(fh)
    version = manifest.get("version", "0.0.0")
    manifest.pop("update_url", None)

    if os.path.isdir(DIST):
        shutil.rmtree(DIST)
    os.makedirs(DIST)

    for name in FILES:
        shutil.copy2(os.path.join(ROOT, name), os.path.join(DIST, name))
    for name in DIRS:
        shutil.copytree(os.path.join(ROOT, name), os.path.join(DIST, name))

    manifest_path = os.path.join(DIST, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")

    zip_path = os.path.join(DIST, f"markdown_this_page-{version}.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for base, _dirs, files in os.walk(DIST):
            for filename in files:
                full = os.path.join(base, filename)
                if full == zip_path:
                    continue
                zf.write(full, os.path.relpath(full, DIST))

    print("wrote", zip_path)


if __name__ == "__main__":
    build()
