#!/usr/bin/env python3
"""Guard the two things about a release that cannot be undone once published.

1. THE ABI LANE RULE.  Jellyfin's per-version filter is a floor, not a match:
   a version is offered whenever ApplicationVersion >= targetAbi.  So a
   net10.0 assembly published under targetAbi 10.11.0.0 is offered to every
   10.11 server, where it loads, throws ReflectionTypeLoadException from
   PluginManager's GetTypes() probe, and is marked PluginStatus.NotSupported
   — and 12.0 never re-enables a disabled plugin on restart.  The lanes are
   therefore split by version number as well as by targetAbi:

       version <  3.0.0.0  ->  targetAbi 10.x  (net9.0,  Jellyfin 10.11)
       version >= 3.0.0.0  ->  targetAbi 12.x  (net10.0, Jellyfin 12.0)

   The numeric split matters because auto-update picks the highest-numbered
   version that survives ABI filtering, not the closest ABI match.

2. THE VERSION STAMPS.  Five files carry the version.  When they disagree the
   theme's settings drawer reports "(MISMATCH)", which the project treats as
   proof that a release was not delivered — so a stale stamp costs a whole
   debugging session.  headerButton.js carries the three-part form because
   that is what CssGenerator stamps into --nf-version.
"""

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FIRST_12_VERSION = (3, 0, 0, 0)

errors = []


def fail(msg):
    errors.append(msg)


def parse_version(text):
    parts = text.split('.')
    if len(parts) != 4 or not all(p.isdigit() for p in parts):
        return None
    return tuple(int(p) for p in parts)


# ---- 1. the ABI lane rule -------------------------------------------------

manifest = json.loads((ROOT / 'manifest.json').read_text())
for package in manifest:
    versions = package.get('versions', [])
    for index, entry in enumerate(versions):
        raw_version = entry.get('version', '')
        abi = entry.get('targetAbi', '')
        version = parse_version(raw_version)
        if version is None:
            fail(f'manifest.json: version {raw_version!r} is not a 4-part version')
            continue
        # Version.Parse throws on anything non-numeric, and the exception
        # surfaces as a 500 from /Packages — taking the whole catalogue down.
        if parse_version(abi) is None:
            fail(f'manifest.json: {raw_version} has targetAbi {abi!r}, which .NET Version.Parse rejects')
            continue
        if version >= FIRST_12_VERSION and not abi.startswith('12.'):
            fail(f'manifest.json: {raw_version} is in the 12.0 lane but targets ABI {abi}')
        if version < FIRST_12_VERSION and not abi.startswith('10.'):
            fail(f'manifest.json: {raw_version} is in the 10.11 lane but targets ABI {abi}')

    # The dashboard installs versions[0] by ARRAY POSITION, not by number, so
    # the newest release must be first or 12.0 servers are offered the old one.
    if versions:
        ordered = [parse_version(v.get('version', '')) for v in versions]
        if any(v is None for v in ordered):
            pass  # already reported above
        elif ordered != sorted(ordered, reverse=True):
            fail('manifest.json: versions[] must be newest-first — the dashboard installs versions[0] by array position')


# ---- 2. the five version stamps ------------------------------------------

meta = json.loads((ROOT / 'meta.json').read_text())
expected = meta['version']
expected_parts = parse_version(expected)
if expected_parts is None:
    fail(f'meta.json: version {expected!r} is not a 4-part version')

stamps = {}

for name in ('Jellyfin.Plugin.CustomTheme.csproj',
             'FileTransformation/CustomTheme.FileTransformation.csproj'):
    text = (ROOT / name).read_text()
    for tag in ('Version', 'AssemblyVersion', 'FileVersion'):
        for value in re.findall(rf'<{tag}>([^<]+)</{tag}>', text):
            stamps[f'{name} <{tag}>'] = value

js = (ROOT / 'headerButton.js').read_text()
match = re.search(r"var NF_JS_VERSION = '([^']+)'", js)
if match:
    stamps['headerButton.js NF_JS_VERSION'] = match.group(1)
else:
    fail('headerButton.js: NF_JS_VERSION not found')

for where, value in stamps.items():
    # headerButton.js carries Major.Minor.Build to match CssGenerator's
    # --nf-version stamp; everything else carries the full 4-part version.
    want = '.'.join(expected.split('.')[:3]) if 'NF_JS_VERSION' in where else expected
    if value != want:
        fail(f'{where} is {value}, expected {want} (from meta.json)')

if expected_parts and not any(v.get('version') == expected for p in manifest for v in p.get('versions', [])):
    fail(f'manifest.json has no entry for the version being built ({expected}) — '
         'add it with "checksum": "" before pushing; CI only pins the MD5 into an existing entry')

# The ABI in meta.json is the one that sticks: PluginManager's ReconcileManifest
# lets the on-disk value win over the repository's, permanently, for that install.
if expected_parts:
    meta_abi = meta.get('targetAbi', '')
    want_prefix = '12.' if expected_parts >= FIRST_12_VERSION else '10.'
    if not meta_abi.startswith(want_prefix):
        fail(f'meta.json: version {expected} needs a targetAbi starting {want_prefix}, got {meta_abi!r}')

if errors:
    for err in errors:
        print(f'::error::{err}')
    sys.exit(1)

print(f'Release metadata OK: version {expected}, targetAbi {meta.get("targetAbi")}, '
      f'{sum(len(p.get("versions", [])) for p in manifest)} manifest entries')
