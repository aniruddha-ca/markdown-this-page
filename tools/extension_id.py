#!/usr/bin/env python3
"""Compute a Chrome extension ID from a packed-extension private key (.pem).

Usage:
    python tools/extension_id.py markdown_this_page.pem

The ID is the first 16 bytes of the SHA-256 of the public key's DER encoding,
with each nibble mapped to the letters a-p.
"""
import hashlib
import subprocess
import sys


def extension_id_from_pem(pem_path):
    der = subprocess.run(
        ["openssl", "pkey", "-in", pem_path, "-pubout", "-outform", "DER"],
        capture_output=True,
        check=True,
    ).stdout
    digest = hashlib.sha256(der).digest()
    return "".join(
        chr(ord("a") + (byte >> 4)) + chr(ord("a") + (byte & 0x0F))
        for byte in digest[:16]
    )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(f"usage: {sys.argv[0]} <key.pem>")
    print(extension_id_from_pem(sys.argv[1]))
