#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import io
import json
import os
import subprocess
import sys
import tempfile
import time
import zipfile
import base64
from pathlib import Path

from playwright.sync_api import sync_playwright


SCRIPT_DIR = Path(__file__).resolve().parent
DESKTOP_ROOT = SCRIPT_DIR.parent
REPO_ROOT = DESKTOP_ROOT.parent
DEFAULT_UNPACKED_EXE = DESKTOP_ROOT / "release" / "win-unpacked" / "Horosa.exe"
DEFAULT_INSTALLED_EXE = Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Horosa" / "Horosa.exe"


def load_module(module_path: Path, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load module from {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


INSTALLED = load_module(SCRIPT_DIR / "installed_desktop_smoke_check.py", "installed_desktop_smoke_check")
DEEP = load_module(REPO_ROOT / "local" / "workspace" / "Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c" / "scripts" / "browser_ai_analysis_deep_check.py", "browser_ai_analysis_deep_check")
BROWSER_HELPERS = load_module(REPO_ROOT / "local" / "workspace" / "Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c" / "scripts" / "browser_horosa_targeted_self_check.py", "browser_horosa_targeted_self_check")


def wait_for_file(path_value: Path, timeout_seconds: int = 20) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if path_value.exists():
            return True
        time.sleep(0.5)
    return False


def click_material_action(page, card_text: str, action_index: int) -> None:
    card = page.locator(".ant-card").filter(has_text=card_text).first
    card.wait_for(timeout=15000)
    action = card.locator(".ant-card-actions li").nth(action_index)
    try:
        action.click(force=True)
    except Exception:
        action.evaluate(
            """
            (node) => {
              node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
              node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
              node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              const child = node.querySelector('span[role="img"], .anticon, svg');
              if (child) {
                child.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                child.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                child.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              }
            }
            """
        )
    page.wait_for_timeout(500)


def dismiss_blocking_modals(page) -> None:
    for _ in range(6):
        handled = False
        know_button = page.get_by_role("button", name="知道了")
        if know_button.count():
            know_button.last.click(force=True)
            page.wait_for_timeout(500)
            handled = True
        close_button = page.locator(".ant-modal-wrap .ant-modal-close")
        if close_button.count():
            close_button.last.click(force=True)
            page.wait_for_timeout(500)
            handled = True
        if not handled:
            break


def seed_desktop_material_workspace(page, imported_files: list[dict], sync_directory: str) -> dict:
    return page.evaluate(
        """
        ({ importedFiles, syncDirectory }) => {
          const raw = localStorage.getItem('horosa_ai_analysis_workspace_v2') || '{}';
          const workspace = JSON.parse(raw);
          const now = '2026-04-05T00:00:00.000Z';
          const nextMaterials = (importedFiles || []).map((file, index) => {
            const extension = `${file.extension || ''}`.replace(/^\\./, '') || 'txt';
            const baseName = `${file.name || `desktop-material-${index}`}`.replace(/\\.[^.]+$/, '');
            return {
              id: `desktop-material-${index + 1}`,
              name: baseName,
              sourceType: 'file',
              format: extension,
              originalFileName: file.name,
              originalBlob: file.base64 || '',
              originalMime: file.mime || 'application/octet-stream',
              byteSize: Number(file.byteSize || 0) || 0,
              extractedText: `桌面导入资料：${file.name || baseName}`,
              folderId: '',
              tagIds: [],
              tags: [],
              sortKey: baseName,
              extractMeta: { importedViaDesktopIPC: true },
              chunkStats: { isSmallMaterial: 1 },
              createdAt: now,
              updatedAt: now,
            };
          });
          workspace.materials = nextMaterials;
          workspace.materialChunks = [];
          workspace.materialIndex = [];
          const currentMeta = Array.isArray(workspace.workspaceMeta) && workspace.workspaceMeta[0] ? workspace.workspaceMeta[0] : {};
          workspace.workspaceMeta = [{
            ...currentMeta,
            id: 'workspace',
            schemaVersion: 2,
            migrationVersion: 2,
            syncDirectory,
            createdAt: currentMeta.createdAt || now,
            updatedAt: now,
          }];
          localStorage.setItem('horosa_ai_analysis_workspace_v2', JSON.stringify(workspace));
          return workspace;
        }
        """,
        {"importedFiles": imported_files, "syncDirectory": sync_directory},
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", default=str(REPO_ROOT / "local" / "workspace" / "Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c"))
    default_exe = DEFAULT_UNPACKED_EXE if DEFAULT_UNPACKED_EXE.exists() else DEFAULT_INSTALLED_EXE
    parser.add_argument("--exe-path", default=str(default_exe))
    parser.add_argument("--remote-debugging-port", type=int, default=9333)
    parser.add_argument("--json-out", default="")
    args = parser.parse_args()

    exe_path = Path(args.exe_path).resolve()
    if not exe_path.exists():
        raise FileNotFoundError(f"desktop exe not found: {exe_path}")

    tmp_dir = Path(tempfile.mkdtemp(prefix="horosa-desktop-ai-"))
    import_dir = tmp_dir / "import-materials"
    sync_dir = tmp_dir / "sync-dir"
    backup_file = tmp_dir / "desktop-materials-backup.zip"
    sync_file = sync_dir / "horosa-ai-workspace.json"
    import_dir.mkdir(parents=True, exist_ok=True)
    sync_dir.mkdir(parents=True, exist_ok=True)
    (import_dir / "desktop-note.txt").write_text("桌面端 txt 资料。", encoding="utf-8")
    (import_dir / "desktop-md.md").write_text("# 桌面端 md 资料\n\n用于目录导入。", encoding="utf-8")
    (import_dir / "desktop-pdf.pdf").write_bytes(b"%PDF-1.4 desktop pdf")
    (import_dir / "desktop-doc.doc").write_bytes(b"desktop doc")
    probe_zip_buffer = io.BytesIO()
    with zipfile.ZipFile(probe_zip_buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps({"probe": 1}, ensure_ascii=False))
    probe_backup_base64 = base64.b64encode(probe_zip_buffer.getvalue()).decode("ascii")

    result = {"status": "FAIL", "exePath": str(exe_path), "artifacts": {"tempDir": str(tmp_dir)}, "checks": []}
    failure_screenshot = tmp_dir / "desktop-ai-failure.png"

    INSTALLED.kill_running_app()
    INSTALLED.free_port(args.remote_debugging_port)
    app_proc = subprocess.Popen([str(exe_path), f"--remote-debugging-port={args.remote_debugging_port}"])

    try:
        if not INSTALLED.wait_for_horosa_window(60):
            raise RuntimeError("desktop app window did not appear")
        INSTALLED.resize_horosa_window(app_proc.pid)
        INSTALLED.wait_for_debug_port(args.remote_debugging_port)

        with sync_playwright() as p:
            browser = p.chromium.connect_over_cdp(f"http://127.0.0.1:{args.remote_debugging_port}")
            context = browser.contexts[0]
            page = context.pages[0]
            page.add_init_script(DEEP.build_init_script())
            page.route("**/aianalysis/**", DEEP.BASE.route_handler)
            page.reload(wait_until="domcontentloaded", timeout=120000)
            BROWSER_HELPERS.wait_for_main_shell(page, timeout_ms=120000)
            page.wait_for_timeout(2500)
            dismiss_blocking_modals(page)

            bridge_info = page.evaluate(
                """
                async ({ importDir, backupFile, syncDir, probeBackupBase64 }) => {
                  const api = window.horosaDesktop && window.horosaDesktop.aiAnalysis;
                  if(!api){
                    return { ok: false };
                  }
                  const exportResult = await api.exportBackup({ filePath: backupFile, base64Data: probeBackupBase64, mimeType: 'application/zip' });
                  return {
                    ok: true,
                    selectImport: await api.selectImportDirectory({ directoryPath: importDir }),
                    importDirectory: await api.importDirectory({ directoryPath: importDir, extensions: ['.txt', '.md', '.doc', '.pdf'] }),
                    exportResult,
                    importResult: await api.importBackup({ filePath: backupFile }),
                    selectSync: await api.selectSyncDirectory({ directoryPath: syncDir }),
                  };
                }
                """,
                {"importDir": str(import_dir), "backupFile": str(backup_file), "syncDir": str(sync_dir), "probeBackupBase64": probe_backup_base64},
            )
            if not bridge_info.get("ok"):
                raise RuntimeError("desktop aiAnalysis bridge unavailable")
            if len(bridge_info["importDirectory"]["files"]) < 4:
                raise RuntimeError("desktop importDirectory IPC did not return expected files")
            if not bridge_info["selectImport"].get("directoryPath") or not bridge_info["selectSync"].get("directoryPath"):
                raise RuntimeError("desktop directory selection IPC did not echo requested paths")
            seeded_workspace = seed_desktop_material_workspace(page, bridge_info["importDirectory"]["files"], str(sync_dir))
            backup_payload = {
                "materials": seeded_workspace.get("materials", []),
                "materialFolders": seeded_workspace.get("materialFolders", []),
                "tagGroups": seeded_workspace.get("tagGroups", []),
            }
            backup_buffer = io.BytesIO()
            with zipfile.ZipFile(backup_buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                archive.writestr(
                    "manifest.json",
                    json.dumps(
                        {
                            "type": "horosa-ai-analysis-workspace-backup",
                            "version": "1.2.1",
                            "workspace": backup_payload,
                        },
                        ensure_ascii=False,
                        indent=2,
                    ),
                )
            backup_base64 = base64.b64encode(backup_buffer.getvalue()).decode("ascii")
            bridge_roundtrip = page.evaluate(
                """
                async ({ backupFile, backupBase64, syncDir }) => {
                  const api = window.horosaDesktop.aiAnalysis;
                  const workspace = JSON.parse(localStorage.getItem('horosa_ai_analysis_workspace_v2') || '{}');
                  return {
                    exportResult: await api.exportBackup({ filePath: backupFile, base64Data: backupBase64, mimeType: 'application/zip' }),
                    importResult: await api.importBackup({ filePath: backupFile }),
                    syncResult: await api.syncWorkspace({ directoryPath: syncDir, workspace }),
                  };
                }
                """,
                {
                    "backupFile": str(backup_file),
                    "backupBase64": backup_base64,
                    "syncDir": str(sync_dir),
                },
            )
            imported_zip = zipfile.ZipFile(io.BytesIO(base64.b64decode(bridge_roundtrip["importResult"]["base64Data"])))
            imported_backup = json.loads(imported_zip.read("manifest.json").decode("utf-8"))
            if not bridge_roundtrip["exportResult"].get("ok") or not imported_backup.get("workspace", {}).get("materials"):
                raise RuntimeError("desktop backup IPC roundtrip failed")
            if not bridge_roundtrip["syncResult"].get("ok"):
                raise RuntimeError("desktop sync IPC roundtrip failed")
            result["checks"].append({"name": "desktop-native-ipc-roundtrip", "status": "PASS"})

            DEEP.BASE.click_tab(page, "AI分析")
            dismiss_blocking_modals(page)
            DEEP.BASE.click_inner_tab(page, "资料")
            DEEP.BASE.expect_card(page, "desktop-note")
            DEEP.BASE.expect_card(page, "desktop-md")
            DEEP.BASE.expect_card(page, "desktop-pdf")
            DEEP.BASE.expect_card(page, "desktop-doc")
            click_material_action(page, "desktop-doc", 3)
            removed = False
            for _ in range(20):
                page.wait_for_timeout(500)
                remaining_cards = DEEP.BASE.active_pane(page).locator(".ant-card").filter(has_text="desktop-doc")
                if remaining_cards.count() == 0:
                    removed = True
                    break
            if not removed:
                raise RuntimeError("desktop materials UI delete did not remove the card")
            result["checks"].append({"name": "desktop-materials-ui", "status": "PASS"})

            DEEP.BASE.click_inner_tab(page, "设置")
            page.locator("body").get_by_text(str(sync_dir), exact=False).wait_for(timeout=10000)
            if not wait_for_file(sync_file, 20):
                raise RuntimeError("desktop sync did not write workspace file")
            sync_payload = json.loads(sync_file.read_text(encoding="utf-8"))
            if not sync_payload.get("materials"):
                raise RuntimeError("desktop sync workspace missing materials")
            result["checks"].append({"name": "desktop-sync-settings-visibility", "status": "PASS"})

            DEEP.BASE.click_inner_tab(page, "分析")
            page.get_by_role("button", name="新会话").click()
            DEEP.BASE.select_in_active_pane(page, 2, "深度命盘案例 / 命盘 / 2024-02-02 08:00:00")
            DEEP.BASE.select_in_active_pane(page, 3, "desktop-note")
            DEEP.BASE.active_pane(page).locator("textarea").last.fill("请做一次桌面端 AI 分析。")
            DEEP.BASE.active_pane(page).get_by_role("button", name="发送").click()
            DEEP.BASE.active_pane(page).get_by_text("深度根会话", exact=False).wait_for(timeout=15000)
            result["checks"].append({"name": "desktop-analysis-stream-smoke", "status": "PASS"})

            result["status"] = "PASS"
            browser.close()
    except Exception:
        try:
            with sync_playwright() as p:
                browser = p.chromium.connect_over_cdp(f"http://127.0.0.1:{args.remote_debugging_port}")
                page = browser.contexts[0].pages[0]
                page.screenshot(path=str(failure_screenshot), full_page=True)
                browser.close()
        except Exception:
            pass
        raise
    finally:
        try:
            INSTALLED.close_app_window(app_proc.pid)
            INSTALLED.wait_for_process_exit(30, process_id=app_proc.pid)
        except Exception:
            pass
        try:
            app_proc.kill()
        except Exception:
            pass

    if args.json_out:
        Path(args.json_out).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
