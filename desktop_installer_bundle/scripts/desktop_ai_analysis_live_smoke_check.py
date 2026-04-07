#!/usr/bin/env python3
from __future__ import annotations

import argparse
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

SCRIPT_DIR = Path(__file__).resolve().parent
DESKTOP_ROOT = SCRIPT_DIR.parent
REPO_ROOT = DESKTOP_ROOT.parent
PROJECT_ROOT = REPO_ROOT / 'local' / 'workspace' / 'Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c'
DEFAULT_EXE = Path(os.environ.get('LOCALAPPDATA', '')) / 'Programs' / 'Horosa' / 'Horosa.exe'
VERIFY_RUNTIME_SCRIPT = PROJECT_ROOT / 'astrostudyui' / 'scripts' / 'verifyHorosaPerformanceRuntime.js'
WINDOWS_SYSTEM_PATH = ';'.join([
    str(Path(os.environ.get('SystemRoot', r'C:\Windows')) / 'System32'),
    os.environ.get('SystemRoot', r'C:\Windows'),
])


def load_module(module_path: Path, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f'unable to load module from {module_path}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


INSTALLED = load_module(SCRIPT_DIR / 'installed_desktop_smoke_check.py', 'installed_desktop_smoke_check')
AI_E2E = load_module(PROJECT_ROOT / 'scripts' / 'browser_ai_analysis_e2e.py', 'browser_ai_analysis_e2e')
BROWSER_HELPERS = load_module(PROJECT_ROOT / 'scripts' / 'browser_horosa_targeted_self_check.py', 'browser_horosa_targeted_self_check')


def configure_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, 'reconfigure', None)
        if callable(reconfigure):
            try:
                reconfigure(encoding='utf-8', errors='replace')
            except Exception:
                pass


configure_stdio()


def ensure_parent(path_value: Path) -> None:
    path_value.parent.mkdir(parents=True, exist_ok=True)


def kill_running_app() -> None:
    subprocess.run(['taskkill', '/IM', 'Horosa.exe', '/T', '/F'], capture_output=True, check=False)


def wait_for_runtime_ready(log_path: Path, timeout_seconds: int = 180) -> dict:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if log_path.exists():
            lines = log_path.read_text(encoding='utf-8', errors='replace').splitlines()
            for line in reversed(lines):
                marker = 'Local runtime ready '
                if marker not in line:
                    continue
                payload = line.split(marker, 1)[1].strip()
                try:
                    state = json.loads(payload)
                except json.JSONDecodeError:
                    continue
                if isinstance(state, dict) and state.get('serverRoot'):
                    return state
        time.sleep(1)
    raise RuntimeError(f'timed out waiting for runtime ready line in {log_path}')


def wait_for_http_ok(url: str, timeout_seconds: int = 120) -> dict:
    deadline = time.time() + timeout_seconds
    last_error = ''
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                body = response.read().decode('utf-8', errors='replace')
                return {
                    'ok': 200 <= int(getattr(response, 'status', 0)) < 300,
                    'status': int(getattr(response, 'status', 0)),
                    'bodyExcerpt': ' '.join(body.split())[:240],
                    'url': url,
                }
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
            time.sleep(2)
    return {
        'ok': False,
        'status': 0,
        'error': last_error or 'timeout',
        'url': url,
    }


def post_json(url: str, payload: dict, timeout_seconds: int = 120) -> dict:
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            'Content-Type': 'application/json;charset=utf-8',
            'Accept': 'application/json',
        },
        method='POST',
    )
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        text = response.read().decode('utf-8', errors='replace')
        data = json.loads(text or '{}')
    if isinstance(data, dict) and data.get('ResultCode') not in (None, 0, '0'):
        raise RuntimeError(data.get('ResultMessage') or data.get('Result') or f'{url} failed')
    if isinstance(data, dict) and 'Result' in data:
        return data['Result']
    return data


def probe_chart_service(chart_port: int) -> dict:
    payload = {
        'date': '2028/04/06',
        'time': '09:33:00',
        'zone': '+00:00',
        'lat': '41n26',
        'lon': '174w30',
        'gpsLat': -41.433333,
        'gpsLon': 174.5,
        'hsys': 1,
        'tradition': False,
        'predictive': True,
        'zodiacal': 0,
        'simpleAsp': False,
        'strongRecption': False,
        'virtualPointReceiveAsp': True,
        'southchart': False,
        'ad': 1,
        'name': 'Horosa Stability Probe',
        'pos': 'Wellington',
    }
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    request = urllib.request.Request(
        f'http://127.0.0.1:{chart_port}/',
        data=body,
        headers={'Content-Type': 'application/json;charset=utf-8'},
        method='POST',
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        text = response.read().decode('utf-8', errors='replace')
        data = json.loads(text or '{}')
        status = int(getattr(response, 'status', 0))
    params = data.get('params') if isinstance(data, dict) else {}
    if not isinstance(params, dict) or not params.get('birth'):
        raise RuntimeError('chart service probe did not return params.birth')
    return {
        'ok': 200 <= status < 300,
        'status': status,
        'birth': params.get('birth'),
        'path': f'http://127.0.0.1:{chart_port}/',
    }


def normalize_models_payload(data: object) -> list[str]:
    if isinstance(data, list):
        result = []
        for item in data:
            if isinstance(item, str):
                result.append(item)
            elif isinstance(item, dict):
                model_id = item.get('id') or item.get('name') or item.get('label')
                if model_id:
                    result.append(str(model_id))
        return result
    if isinstance(data, dict):
        for key in ('models', 'chatModels', 'data'):
            if key in data:
                return normalize_models_payload(data.get(key))
    return []


def build_deepseek_provider(api_key: str) -> dict:
    return {
        'id': 'provider-deepseek-live',
        'providerType': 'deepseek',
        'kind': 'openai-compatible',
        'protocolFamily': 'openai-compatible',
        'name': 'DeepSeek Live',
        'apiKey': api_key,
        'baseUrl': 'https://api.deepseek.com',
        'enabled': 1,
        'headers': {},
        'query': {},
        'models': [
            {
                'id': 'deepseek-chat',
                'label': 'DeepSeek Chat',
                'contextWindow': 128000,
                'maxOutputTokens': 8192,
                'streamMode': 'native',
                'providerOptions': {},
            },
            {
                'id': 'deepseek-reasoner',
                'label': 'DeepSeek Reasoner',
                'contextWindow': 128000,
                'maxOutputTokens': 65536,
                'streamMode': 'native',
                'providerOptions': {},
            },
        ],
        'modelIds': ['deepseek-chat', 'deepseek-reasoner'],
        'providerOptions': {
            'streamMode': 'sse',
            'temperature': 0.2,
            'maxTokens': 1024,
        },
        'requestTimeoutMs': 120000,
    }


def seed_workspace(page, provider: dict) -> None:
    page.evaluate(
        """
        ({ provider }) => {
          const now = new Date().toISOString();
          localStorage.setItem('horosa.localCharts.v1', JSON.stringify([
            {
              cid: 'live-chart-1',
              name: 'Live 命盘案例',
              birth: '2024-01-01 10:00:00',
              zone: '+08:00',
              pos: 'Beijing',
              updateTime: '2026-04-07 09:00:00',
            }
          ]));
          localStorage.setItem('horosa.localCases.v1', JSON.stringify([
            {
              cid: 'live-case-1',
              event: 'Live 事盘案例',
              caseType: 'liuyao',
              divTime: '2026-04-07 12:00:00',
              zone: '+08:00',
              pos: 'Shanghai',
              sourceModule: 'liuyao',
              payload: JSON.stringify({ snapshot: { content: 'Live AI 导出案例正文。' } }),
              updateTime: '2026-04-07 09:30:00',
            }
          ]));
          localStorage.setItem('horosa_ai_analysis_workspace_v2', JSON.stringify({
            schemaVersion: 3,
            providerConfigs: [{
              ...provider,
              createdAt: now,
              updatedAt: now,
            }],
            materials: [],
            templates: [],
            bundles: [],
            sessions: [],
            materialFolders: [],
            tagGroups: [],
            materialChunks: [],
            materialIndex: [],
            templateVersions: [],
            workspaceMeta: [{
              id: 'workspace',
              schemaVersion: 3,
              migrationVersion: 3,
              createdAt: now,
              updatedAt: now,
            }],
          }));
          localStorage.setItem('horosa_ai_analysis_last_tab', 'analysis');
          localStorage.removeItem('horosa_ai_analysis_last_session');
        }
        """,
        {'provider': provider},
    )


def run_runtime_verify(server_root: str, workdir: Path) -> dict:
    env = os.environ.copy()
    env['HOROSA_SERVER_ROOT'] = server_root
    env['HOROSA_PERF_THRESHOLD_MS'] = '30000'
    result = subprocess.run(
        ['node', str(VERIFY_RUNTIME_SCRIPT)],
        cwd=str(workdir),
        capture_output=True,
        text=True,
        encoding='utf-8',
        errors='replace',
        check=False,
        env=env,
        timeout=1800,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stdout or result.stderr or 'verifyHorosaPerformanceRuntime.js failed')
    payload = json.loads(result.stdout)
    return {
        'status': payload.get('status'),
        'slowestScenario': payload.get('slowestScenario'),
        'failingScenarios': payload.get('failingScenarios'),
        'modules': payload.get('modules'),
    }


def cleanup_runtime_root(runtime_root: Path) -> None:
    for _ in range(6):
        try:
            if runtime_root.exists():
                shutil.rmtree(runtime_root, ignore_errors=False)
            return
        except Exception:  # noqa: BLE001
            time.sleep(1)
    shutil.rmtree(runtime_root, ignore_errors=True)


def sort_sessions_by_recency(sessions: list[dict]) -> list[dict]:
    def sort_key(item: dict) -> tuple[str, str]:
        return (
            str(item.get('updatedAt') or ''),
            str(item.get('createdAt') or ''),
        )

    return sorted(sessions or [], key=sort_key, reverse=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--exe-path', default=str(DEFAULT_EXE))
    parser.add_argument('--provider-key', default=os.environ.get('HOROSA_DEEPSEEK_API_KEY', ''))
    parser.add_argument('--remote-debugging-port', type=int, default=9341)
    parser.add_argument('--json-out', default='')
    args = parser.parse_args()

    exe_path = Path(args.exe_path).resolve()
    if not exe_path.exists():
        raise FileNotFoundError(f'desktop exe not found: {exe_path}')
    if not args.provider_key:
        raise RuntimeError('missing DeepSeek API key: pass --provider-key or HOROSA_DEEPSEEK_API_KEY')

    work_root = Path(tempfile.mkdtemp(prefix='horosa-live-release-verify-'))
    isolated_localappdata = work_root / 'localappdata'
    log_path = isolated_localappdata / 'HorosaDesktop' / 'logs' / 'horosa-desktop.log'
    result = {
        'status': 'FAIL',
        'exePath': str(exe_path),
        'artifacts': {
            'tempRoot': str(work_root),
            'isolatedLocalAppData': str(isolated_localappdata),
        },
        'checks': [],
    }

    ensure_parent(log_path)
    kill_running_app()
    INSTALLED.free_port(args.remote_debugging_port)

    env = os.environ.copy()
    env['LOCALAPPDATA'] = str(isolated_localappdata)
    env['PATH'] = WINDOWS_SYSTEM_PATH

    provider = build_deepseek_provider(args.provider_key)
    app_proc = subprocess.Popen([str(exe_path), f'--remote-debugging-port={args.remote_debugging_port}'], env=env)

    try:
        runtime_state = wait_for_runtime_ready(log_path)
        server_root = str(runtime_state.get('serverRoot') or '').rstrip('/')
        chart_port = int(runtime_state.get('chartPort') or 0)
        if not server_root or chart_port <= 0:
            raise RuntimeError(f'invalid runtime state: {runtime_state}')
        heartbeat = wait_for_http_ok(f'{server_root}/heartbeat', timeout_seconds=60)
        if not heartbeat.get('ok'):
            raise RuntimeError(f'backend heartbeat failed: {heartbeat}')
        chart_probe = probe_chart_service(chart_port)
        runtime_verify = run_runtime_verify(server_root, REPO_ROOT)
        result['checks'].append({'name': 'isolated-runtime-launch', 'status': 'PASS', 'details': runtime_state})
        result['checks'].append({'name': 'backend-heartbeat', 'status': 'PASS', 'details': heartbeat})
        result['checks'].append({'name': 'chart-service-probe', 'status': 'PASS', 'details': chart_probe})
        result['checks'].append({'name': 'backend-business-runtime-verify', 'status': 'PASS', 'details': runtime_verify})

        models_result = post_json(f'{server_root}/aianalysis/providers/models', {'provider': provider}, timeout_seconds=120)
        model_ids = normalize_models_payload(models_result)
        if 'deepseek-chat' not in model_ids:
            raise RuntimeError(f'DeepSeek model fetch missing deepseek-chat: {models_result}')
        diagnose_result = post_json(f'{server_root}/aianalysis/providers/diagnose', {'provider': provider}, timeout_seconds=180)
        if not (diagnose_result.get('ok') or diagnose_result.get('healthy')):
            raise RuntimeError(f'DeepSeek diagnose failed: {diagnose_result}')
        result['checks'].append({'name': 'deepseek-model-fetch', 'status': 'PASS', 'details': {'models': model_ids}})
        result['checks'].append({'name': 'deepseek-diagnose', 'status': 'PASS', 'details': diagnose_result})

        INSTALLED.wait_for_debug_port(args.remote_debugging_port)
        with sync_playwright() as p:
            browser = p.chromium.connect_over_cdp(f'http://127.0.0.1:{args.remote_debugging_port}')
            context = browser.contexts[0]
            page = context.pages[0]
            page.add_init_script("Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });")
            page.reload(wait_until='domcontentloaded', timeout=120000)
            BROWSER_HELPERS.wait_for_main_shell(page, timeout_ms=120000)
            AI_E2E.dismiss_blocking_modals(page)
            seed_workspace(page, provider)
            page.reload(wait_until='domcontentloaded', timeout=120000)
            BROWSER_HELPERS.wait_for_main_shell(page, timeout_ms=120000)
            AI_E2E.dismiss_blocking_modals(page)

            AI_E2E.click_tab(page, 'AI分析')
            AI_E2E.click_inner_tab(page, '资料')
            AI_E2E.set_upload_files(page, [{
                'name': 'live-note.txt',
                'mimeType': 'text/plain',
                'buffer': '这是一份真实联网 AI 自检资料。'.encode('utf-8'),
            }])
            AI_E2E.expect_card(page, 'live-note')
            result['checks'].append({'name': 'ai-material-upload-live', 'status': 'PASS'})

            AI_E2E.click_inner_tab(page, '分析')
            AI_E2E.active_pane(page).get_by_role('button', name='新会话').click()
            page.wait_for_timeout(800)
            AI_E2E.select_in_active_pane(page, 0, 'DeepSeek Live')
            AI_E2E.select_in_active_pane(page, 1, 'deepseek-chat')
            AI_E2E.select_in_active_pane(page, 2, 'Live 事盘案例 / 六爻 / 2026-04-07 12:00:00')
            AI_E2E.select_in_active_pane(page, 3, 'live-note')
            composer = AI_E2E.active_pane(page).locator('textarea').last
            composer.fill('请用一句话总结这个案例，并说明资料是否被纳入分析。')
            AI_E2E.active_pane(page).get_by_role('button', name='发送').click()
            AI_E2E.active_pane(page).get_by_role('button', name='停止').wait_for(timeout=30000)
            page.wait_for_function(
                """
                () => {
                  const workspace = JSON.parse(localStorage.getItem('horosa_ai_analysis_workspace_v2') || '{}');
                  return (workspace.sessions || []).some((session) =>
                    (session.messages || []).some((message) => message.role === 'assistant' && (message.content || '').length >= 12)
                  );
                }
                """,
                timeout=180000,
            )
            page.wait_for_timeout(3000)
            workspace = AI_E2E.read_workspace(page)
            sessions = workspace.get('sessions', []) or []
            if not sessions:
                raise RuntimeError('live AI analysis did not create any saved session')
            selected_session_id = page.evaluate("localStorage.getItem('horosa_ai_analysis_last_session') || ''")
            ordered_sessions = sort_sessions_by_recency(sessions)
            latest_session = next((item for item in ordered_sessions if item.get('id') == selected_session_id), None)
            if latest_session is None:
                latest_session = next(
                    (
                        item for item in ordered_sessions
                        if any(message.get('role') == 'assistant' and (message.get('content') or '').strip() for message in (item.get('messages') or []))
                    ),
                    ordered_sessions[0],
                )
            assistant_messages = [item for item in (latest_session.get('messages') or []) if item.get('role') == 'assistant']
            if not assistant_messages:
                raise RuntimeError(f'live AI analysis session missing assistant message: {latest_session.get("id")}')
            assistant_text = assistant_messages[-1].get('content') or ''
            if len(assistant_text.strip()) < 12:
                raise RuntimeError(f'live AI assistant message too short: {assistant_text!r}')
            result['checks'].append({
                'name': 'ai-analysis-live-stream',
                'status': 'PASS',
                'details': {
                    'sessionTitle': latest_session.get('title'),
                    'assistantExcerpt': ' '.join(assistant_text.split())[:160],
                },
            })

            AI_E2E.click_inner_tab(page, '历史')
            rows = page.locator('.ant-table-tbody tr[data-row-key]')
            rows.first.wait_for(timeout=15000)
            history_text = rows.first.inner_text()
            if 'Live' not in history_text and 'live' not in history_text:
                raise RuntimeError(f'live AI history row not found: {history_text}')
            result['checks'].append({'name': 'ai-history-save-live', 'status': 'PASS'})
            browser.close()

        result['status'] = 'PASS'
    except Exception as exc:  # noqa: BLE001
        result['error'] = str(exc)
        if args.json_out:
            output_path = Path(args.json_out)
            ensure_parent(output_path)
            output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(result, ensure_ascii=False))
        raise
    finally:
        kill_running_app()
        try:
            app_proc.kill()
        except Exception:  # noqa: BLE001
            pass
        if result.get('status') == 'PASS':
            cleanup_runtime_root(work_root)

    if args.json_out:
        output_path = Path(args.json_out)
        ensure_parent(output_path)
        output_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
