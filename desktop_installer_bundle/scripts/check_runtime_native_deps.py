#!/usr/bin/env python3
"""Build-time guard: verify every native extension in the bundled Python runtime
can resolve its DLL imports on a CLEAN Windows machine (no VC++ Redistributable,
no system Python).

The classic failure this catches: a compiled ``*.pyd`` imports ``MSVCP140.dll``
(the C++ runtime) which python.org does NOT ship and a fresh Windows install does
NOT have. If such a DLL is not bundled next to ``python.exe`` (or inside the
importing package's own tree), the extension fails at import with
``ImportError: DLL load failed``.

Usage:
    python check_runtime_native_deps.py <python_runtime_root> [--survey]

Exit code 0 = all imports resolvable; non-zero = at least one unresolved
non-OS dependency (build should fail).

Pure standard library on purpose: it can run with the bundled runtime's own
python.exe, no third-party packages required.
"""
import os
import struct
import sys

# Windows DLLs that are part of the OS / Universal CRT and are present on every
# supported clean Windows 10/11 machine. These never need bundling.
OS_DLLS = {
    'ntdll.dll', 'kernel32.dll', 'kernelbase.dll', 'user32.dll', 'gdi32.dll',
    'gdi32full.dll', 'advapi32.dll', 'shell32.dll', 'shlwapi.dll', 'ole32.dll',
    'oleaut32.dll', 'combase.dll', 'ws2_32.dll', 'wsock32.dll', 'crypt32.dll',
    'wininet.dll', 'winhttp.dll', 'secur32.dll', 'sspicli.dll', 'bcrypt.dll',
    'bcryptprimitives.dll', 'ncrypt.dll', 'rpcrt4.dll', 'comdlg32.dll',
    'comctl32.dll', 'setupapi.dll', 'iphlpapi.dll', 'dnsapi.dll', 'mswsock.dll',
    'netapi32.dll', 'userenv.dll', 'version.dll', 'winmm.dll', 'psapi.dll',
    'dbghelp.dll', 'imagehlp.dll', 'powrprof.dll', 'propsys.dll', 'dwmapi.dll',
    'uxtheme.dll', 'msimg32.dll', 'gdiplus.dll', 'dxgi.dll', 'd3d9.dll',
    'd3d11.dll', 'opengl32.dll', 'glu32.dll', 'wintrust.dll', 'cryptbase.dll',
    'cryptsp.dll', 'msvcrt.dll', 'ucrtbase.dll', 'imm32.dll', 'oleacc.dll',
    'msasn1.dll', 'cfgmgr32.dll', 'winspool.drv', 'avifil32.dll', 'avicap32.dll',
    'msvfw32.dll', 'mf.dll', 'mfplat.dll', 'mfreadwrite.dll', 'dwrite.dll',
    'd2d1.dll', 'windowscodecs.dll', 'wtsapi32.dll', 'wevtapi.dll', 'pdh.dll',
    'authz.dll', 'sechost.dll', 'profapi.dll', 'normaliz.dll', 'urlmon.dll',
    'odbc32.dll', 'dsound.dll', 'winusb.dll', 'devobj.dll', 'cabinet.dll',
    'clbcatq.dll', 'dhcpcsvc.dll', 'fwpuclnt.dll', 'rasapi32.dll', 'wlanapi.dll',
    'msi.dll', 'webservices.dll', 'mpr.dll', 'wldap32.dll', 'crypt32.dll',
    'kernel.appcore.dll', 'win32u.dll', 'ntmarta.dll', 'rstrtmgr.dll',
}

# The VC++ runtime DLLs that MUST be bundled next to python.exe. These are the
# files that are missing on a clean machine and break swisseph / _sxtwl /
# greenlet / scikit-learn etc.
REQUIRED_IN_ROOT = {'msvcp140.dll', 'vcruntime140.dll', 'vcruntime140_1.dll'}


def is_os_dll(name):
    n = name.lower()
    return n.startswith(('api-ms-win-', 'ext-ms-')) or n in OS_DLLS


def parse_imported_dlls(path):
    """Return the list of DLL names imported by a PE file, using only stdlib."""
    with open(path, 'rb') as fh:
        data = fh.read()
    if data[:2] != b'MZ' or len(data) < 0x40:
        return []
    e_lfanew = struct.unpack_from('<I', data, 0x3C)[0]
    if data[e_lfanew:e_lfanew + 4] != b'PE\x00\x00':
        return []
    coff = e_lfanew + 4
    num_sections = struct.unpack_from('<H', data, coff + 2)[0]
    size_opt = struct.unpack_from('<H', data, coff + 16)[0]
    opt = coff + 20
    magic = struct.unpack_from('<H', data, opt)[0]
    if magic == 0x20B:        # PE32+
        dd_offset = opt + 112
    elif magic == 0x10B:      # PE32
        dd_offset = opt + 96
    else:
        return []
    import_rva = struct.unpack_from('<I', data, dd_offset + 1 * 8)[0]
    if import_rva == 0:
        return []

    sections = []
    sec = opt + size_opt
    for _ in range(num_sections):
        va = struct.unpack_from('<I', data, sec + 12)[0]
        vsize = struct.unpack_from('<I', data, sec + 8)[0]
        raw_ptr = struct.unpack_from('<I', data, sec + 20)[0]
        raw_size = struct.unpack_from('<I', data, sec + 16)[0]
        sections.append((va, max(vsize, raw_size), raw_ptr))
        sec += 40

    def rva_to_off(rva):
        for va, size, raw_ptr in sections:
            if va <= rva < va + size:
                return raw_ptr + (rva - va)
        return None

    def read_cstr(off):
        end = data.find(b'\x00', off)
        return data[off:end].decode('ascii', 'ignore') if end != -1 else ''

    dlls = []
    desc = rva_to_off(import_rva)
    if desc is None:
        return []
    while desc + 20 <= len(data):
        fields = struct.unpack_from('<IIIII', data, desc)
        if fields == (0, 0, 0, 0, 0):
            break
        name_off = rva_to_off(fields[3])
        if name_off is not None:
            n = read_cstr(name_off)
            if n:
                dlls.append(n)
        desc += 20
    return dlls


def top_package(rel_parts):
    """Given path parts relative to site-packages, return the owning package
    name (folder), normalising the delvewheel ``<pkg>.libs`` convention."""
    if not rel_parts:
        return None
    first = rel_parts[0]
    if first.lower().endswith('.libs'):
        return first[:-5].lower()
    return first.lower()


def build_index(root):
    """Map package-name -> set of dll/pyd filenames anywhere in that package
    tree (including its sibling ``<pkg>.libs`` folder)."""
    site = os.path.join(root, 'Lib', 'site-packages')
    pkg_files = {}
    if os.path.isdir(site):
        for dp, _dn, fn in os.walk(site):
            rel = os.path.relpath(dp, site)
            parts = [] if rel == '.' else rel.split(os.sep)
            pkg = top_package(parts)
            if pkg is None:
                continue
            bucket = pkg_files.setdefault(pkg, set())
            for f in fn:
                bucket.add(f.lower())
    return site, pkg_files


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    survey = '--survey' in sys.argv
    if not args:
        print('usage: check_runtime_native_deps.py <python_runtime_root> [--survey]')
        return 2
    root = os.path.abspath(args[0])
    py_exe = os.path.join(root, 'python.exe')
    if not os.path.isfile(py_exe):
        print(f'[deps] ERROR python.exe not found under {root}')
        return 2

    root_files = {f.lower() for f in os.listdir(root)
                  if os.path.isfile(os.path.join(root, f))}
    dlls_dir = os.path.join(root, 'DLLs')
    dlls_files = set()
    if os.path.isdir(dlls_dir):
        for dp, _dn, fn in os.walk(dlls_dir):
            dlls_files.update(f.lower() for f in fn)
    site, pkg_files = build_index(root)

    # Guard 1: the must-have VC runtime DLLs sit next to python.exe.
    missing_root = sorted(REQUIRED_IN_ROOT - root_files)
    problems = []
    for m in missing_root:
        problems.append(f'{m}: REQUIRED next to python.exe but missing '
                        f'(clean machines have no VC++ Redistributable)')

    # Guard 2: every extension's imports resolve on a clean machine.
    scanned = 0
    for dp, _dn, fn in os.walk(root):
        for f in fn:
            low = f.lower()
            if not (low.endswith('.pyd') or low.endswith('.dll')):
                continue
            binpath = os.path.join(dp, f)
            try:
                imports = parse_imported_dlls(binpath)
            except Exception:
                continue
            scanned += 1
            own_dir_files = {x.lower() for x in os.listdir(dp)
                             if os.path.isfile(os.path.join(dp, x))}
            pkg = None
            if binpath.lower().startswith(site.lower()):
                rel_parts = os.path.relpath(dp, site).split(os.sep)
                rel_parts = [p for p in rel_parts if p != '.']
                pkg = top_package(rel_parts)
            search = set(root_files) | dlls_files | own_dir_files
            if pkg and pkg in pkg_files:
                search |= pkg_files[pkg]
            for dep in imports:
                dlow = dep.lower()
                if is_os_dll(dep) or dlow.startswith('python3'):
                    continue
                if dlow not in search:
                    problems.append(
                        f'{os.path.relpath(binpath, root)} -> {dep} '
                        f'(not next to python.exe, not in package tree, not an OS DLL)')

    if survey:
        print(f'[deps] scanned {scanned} PE files under {root}')

    if problems:
        print('[deps] FAIL - unresolved native dependencies on a clean Windows machine:')
        for p in problems:
            print(f'   - {p}')
        print('[deps] Fix: vendor the missing DLL next to python.exe '
              '(see prepareruntime/vendor/vc_runtime).')
        return 1

    print(f'[deps] OK - {scanned} native modules scanned, all DLL imports '
          f'resolvable on a clean Windows machine.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
