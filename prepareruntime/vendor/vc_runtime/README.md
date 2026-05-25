# Vendored Microsoft Visual C++ Runtime (x64)

These DLLs are the **Microsoft Visual C++ 2015–2022 Redistributable** runtime
libraries. They are copied next to `python.exe` in the bundled Python runtime so
that compiled Python extensions (`*.pyd`) load on a **clean Windows machine that
does not have the VC++ Redistributable installed**.

## Why this is required

Several bundled native extensions import `MSVCP140.dll` (the C++ standard-library
runtime), which is **not** shipped with the python.org Python distribution and is
**not** present on a fresh Windows install. Without these DLLs the affected
extensions fail at import time with:

```
ImportError: DLL load failed while importing <module>: 找不到指定的模块。
```

Confirmed importers in this project include `swisseph` (pyswisseph), `_sxtwl`
(lunar calendar), `greenlet`, and `scikit-learn`. Placing the DLLs next to
`python.exe` puts them on the loader search path for every extension at once.

`vcruntime140.dll` / `vcruntime140_1.dll` happen to ship next to `python.exe`
already, but `msvcp140.dll` and friends do not — hence this folder.

## Files

`msvcp140*.dll`, `vcruntime140*.dll`, `concrt140.dll`, `vccorlib140.dll`,
`vcomp140.dll` — version 14.44.x (binary-compatible with anything built against
the 14.x / VS2015–2022 toolset).

## License / redistribution

These are Microsoft redistributable runtime files. Microsoft's Visual C++
Redistributable license explicitly permits redistributing these runtime DLLs with
an application. See Microsoft's "Redistributing Visual C++ Files" documentation.

## How to refresh

Re-copy from a machine that has the current VC++ Redistributable installed:

```powershell
$dst = "<repo>\prepareruntime\vendor\vc_runtime\x64"
'msvcp140.dll','msvcp140_1.dll','msvcp140_2.dll','msvcp140_codecvt_ids.dll',
'msvcp140_atomic_wait.dll','vcruntime140.dll','vcruntime140_1.dll',
'concrt140.dll','vccorlib140.dll','vcomp140.dll' |
  ForEach-Object { Copy-Item "$env:WINDIR\System32\$_" "$dst\$_" -Force }
```

Or download `VC_redist.x64.exe` from Microsoft and extract the runtime DLLs.
