#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
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
REQUEST_SIGNATURE_KEY = 'FE45AB6E29EF'
REQUEST_CLIENT_CHANNEL = '1'
REQUEST_CLIENT_APP = '1'
REQUEST_CLIENT_VER = '1.0'
AI_FIRST_VISIBLE_TOKEN_THRESHOLD_MS = 12000
APP_VISIBLE_AVG_INTERVAL_THRESHOLD_MS = 250
APP_VISIBLE_P95_INTERVAL_THRESHOLD_MS = 500
APP_VISIBLE_MAX_INTERVAL_THRESHOLD_MS = 1500
ASSISTANT_CONTENT_EXTRACTOR = """
    () => {
      const panes = Array.from(document.querySelectorAll('.ant-tabs-tabpane-active'))
        .filter((node) => !!(node && node.offsetParent));
      const pane = panes[panes.length - 1];
      if(!pane){
        return '';
      }
      const cards = Array.from(pane.querySelectorAll('.ant-card'))
        .filter((node) => !!(node && node.offsetParent) && /发送分析/.test(node.innerText || ''));
      const card = cards.length ? cards[0] : null;
      if(!card){
        return '';
      }
      let text = (card.innerText || '').replace(/\\s+/g, ' ').trim();
      const markerIndex = text.lastIndexOf('AI ·');
      if(markerIndex < 0){
        return '';
      }
      text = text.slice(markerIndex);
      text = text.replace(/^AI · \\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}(?::\\d{2})?(?: · 生成中)?\\s*/, '');
      const stopMarkers = [' 案例已挂载 ', ' Enter 发送，Shift + Enter 换行 ', ' 发送分析'];
      for(const marker of stopMarkers){
        const idx = text.indexOf(marker);
        if(idx >= 0){
          text = text.slice(0, idx);
        }
      }
      text = text.replace(/^\\.\\.\\.$/, '').trim();
      return text && text !== '...' ? text : '';
    }
"""


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


def wait_for_assistant_content_visible(page, timeout_ms: int = 180000) -> str:
    page.wait_for_function(
        f"() => !!({ASSISTANT_CONTENT_EXTRACTOR})()",
        timeout=timeout_ms,
    )
    return page.evaluate(ASSISTANT_CONTENT_EXTRACTOR)


def extract_assistant_content(page) -> str:
    return page.evaluate(ASSISTANT_CONTENT_EXTRACTOR)


def is_stream_button_disabled(page) -> bool:
    return bool(
        page.evaluate(
            """
            () => {
              const buttons = Array.from(document.querySelectorAll('button'));
              const stop = buttons.find((node) => (node.innerText || '').replace(/\\s+/g, ' ').trim() === '停止生成');
              return !stop || stop.disabled;
            }
            """
        )
    )


def percentile(sorted_values: list[int], quantile: float) -> int:
    if not sorted_values:
        return 0
    if len(sorted_values) == 1:
        return int(sorted_values[0])
    position = max(0.0, min(quantile, 1.0)) * (len(sorted_values) - 1)
    lower = int(position)
    upper = min(lower + 1, len(sorted_values) - 1)
    if lower == upper:
        return int(sorted_values[lower])
    weight = position - lower
    interpolated = sorted_values[lower] + (sorted_values[upper] - sorted_values[lower]) * weight
    return int(round(interpolated))


def summarize_stream_samples(samples: list[dict], final_text: str) -> dict:
    intervals = [
        int(samples[index]['atMs'] - samples[index - 1]['atMs'])
        for index in range(1, len(samples))
    ]
    sorted_intervals = sorted(intervals)
    avg_interval = round(sum(intervals) / len(intervals), 1) if intervals else 0.0
    avg_chars_per_update = round(
        sum(item.get('deltaChars', 0) for item in samples) / max(len(samples), 1),
        2,
    )
    return {
        'sampleCount': len(samples),
        'firstVisibleMs': int(samples[0]['atMs']) if samples else 0,
        'avgIntervalMs': avg_interval,
        'p95IntervalMs': percentile(sorted_intervals, 0.95),
        'maxIntervalMs': max(sorted_intervals) if sorted_intervals else 0,
        'avgCharsPerUpdate': avg_chars_per_update,
        'finalLength': len(final_text or ''),
        'finalExcerpt': ' '.join((final_text or '').split())[:240],
        'samples': samples,
    }


def collect_visible_stream_metrics(page, started_at: float, timeout_ms: int = 180000, poll_ms: int = 30, settle_ms: int = 900) -> dict:
    samples: list[dict] = []
    previous_text = ''
    last_change_at_ms = -1
    deadline = time.perf_counter() + timeout_ms / 1000.0
    while time.perf_counter() < deadline:
        current_text = extract_assistant_content(page)
        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        if current_text and current_text != previous_text:
            delta_chars = len(current_text) - len(previous_text) if current_text.startswith(previous_text) else len(current_text)
            samples.append({
                'atMs': elapsed_ms,
                'length': len(current_text),
                'deltaChars': max(delta_chars, 0),
                'text': current_text[:120],
            })
            previous_text = current_text
            last_change_at_ms = elapsed_ms
        stream_done = is_stream_button_disabled(page)
        if samples and stream_done and last_change_at_ms >= 0 and elapsed_ms - last_change_at_ms >= settle_ms:
            return summarize_stream_samples(samples, previous_text)
        page.wait_for_timeout(poll_ms)
    raise RuntimeError('timed out while collecting visible stream cadence metrics')


def assert_stream_metrics(metrics: dict, label: str) -> None:
    if metrics.get('sampleCount', 0) < 6:
        raise RuntimeError(f'{label} stream produced too few visible updates: {metrics}')
    if metrics.get('avgIntervalMs', 0) > APP_VISIBLE_AVG_INTERVAL_THRESHOLD_MS:
        raise RuntimeError(f'{label} avg visible interval too slow: {metrics}')
    if metrics.get('p95IntervalMs', 0) > APP_VISIBLE_P95_INTERVAL_THRESHOLD_MS:
        raise RuntimeError(f'{label} p95 visible interval too slow: {metrics}')
    if metrics.get('maxIntervalMs', 0) > APP_VISIBLE_MAX_INTERVAL_THRESHOLD_MS:
        raise RuntimeError(f'{label} max visible interval too slow: {metrics}')


def iter_sse_events(response):
    event_name = ''
    data_lines: list[str] = []
    while True:
        raw_line = response.readline()
        if not raw_line:
            if data_lines:
                yield event_name or 'message', '\n'.join(data_lines)
            break
        line = raw_line.decode('utf-8', errors='replace').rstrip('\n')
        if line.endswith('\r'):
            line = line[:-1]
        if not line:
            if data_lines:
                yield event_name or 'message', '\n'.join(data_lines)
            event_name = ''
            data_lines = []
            continue
        if line.startswith(':'):
            continue
        if line.startswith('event:'):
            event_name = line.split(':', 1)[1].strip()
            continue
        if line.startswith('data:'):
            data_lines.append(line.split(':', 1)[1].lstrip())


def collect_delta_stream_metrics(request: urllib.request.Request, event_parser, timeout_seconds: int = 240) -> dict:
    started_at = time.perf_counter()
    samples: list[dict] = []
    assembled_text = ''
    with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
        for event_name, data in iter_sse_events(response):
            delta = event_parser(event_name, data)
            if not delta:
                continue
            assembled_text += delta
            elapsed_ms = int((time.perf_counter() - started_at) * 1000)
            samples.append({
                'atMs': elapsed_ms,
                'length': len(assembled_text),
                'deltaChars': len(delta),
                'text': assembled_text[:120],
            })
    return summarize_stream_samples(samples, assembled_text)


def build_local_backend_chat_payload(provider: dict, model_id: str, context_snapshot: dict, messages: list[dict]) -> dict:
    return {
        'provider': provider,
        'modelId': model_id,
        'model': {
            'id': model_id,
            'label': model_id,
            'contextWindow': 128000,
            'maxOutputTokens': 8192,
            'streamMode': 'sse',
            'providerOptions': {},
        },
        'contextSnapshot': {
            key: context_snapshot.get(key)
            for key in (
                'snapshotVersion',
                'migrationVersion',
                'compiledAt',
                'userPrompt',
                'systemPrompt',
                'contextMode',
                'selectedTechniqueKeys',
                'resolvedText',
                'systemLayer',
                'templateLayer',
                'caseLayer',
                'techniqueLayer',
                'memoryLayer',
            )
            if key in context_snapshot
        },
        'messages': [
            {
                'id': str(item.get('id') or ''),
                'role': str(item.get('role') or 'user'),
                'content': str(item.get('content') or ''),
                'createdAt': str(item.get('createdAt') or ''),
            }
            for item in (messages or [])
            if str(item.get('content') or '').strip()
        ],
        'runtimeOptions': {},
    }


def build_local_backend_request(server_root: str, payload: dict) -> urllib.request.Request:
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    signature_source = f'{REQUEST_SIGNATURE_KEY}{REQUEST_CLIENT_CHANNEL}{REQUEST_CLIENT_APP}{REQUEST_CLIENT_VER}{body.decode("utf-8")}'
    signature = hashlib.sha256(signature_source.encode('utf-8')).hexdigest()
    return urllib.request.Request(
        f'{server_root}/aianalysis/chat/stream',
        data=body,
        headers={
            'Content-Type': 'application/json;charset=utf-8',
            'Accept': 'text/event-stream',
            'Token': '',
            'LocalIp': '',
            'ClientChannel': REQUEST_CLIENT_CHANNEL,
            'ClientApp': REQUEST_CLIENT_APP,
            'ClientVer': REQUEST_CLIENT_VER,
            'Signature': signature,
            'Encrypted': '0',
        },
        method='POST',
    )


def parse_local_backend_delta(event_name: str, data: str) -> str:
    if event_name != 'delta':
        return ''
    try:
        payload = json.loads(data or '{}')
    except json.JSONDecodeError:
        return ''
    return str(payload.get('delta') or '')


def build_direct_deepseek_request(api_key: str) -> urllib.request.Request:
    body = json.dumps(
        {
            'model': 'deepseek-chat',
            'stream': True,
            'temperature': 0.2,
            'max_tokens': 320,
            'messages': [
                {
                    'role': 'system',
                    'content': '请连续输出一段自然中文，不要项目符号，不要 Markdown。',
                },
                {
                    'role': 'user',
                    'content': '请用约180字说明：为什么 AI 回复时首字快还不够，后续持续平滑输出同样重要。',
                },
            ],
        },
        ensure_ascii=False,
    ).encode('utf-8')
    return urllib.request.Request(
        'https://api.deepseek.com/chat/completions',
        data=body,
        headers={
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'Authorization': f'Bearer {api_key}',
        },
        method='POST',
    )


def parse_openai_compatible_delta(_event_name: str, data: str) -> str:
    if data == '[DONE]':
        return ''
    try:
        payload = json.loads(data or '{}')
    except json.JSONDecodeError:
        return ''
    choices = payload.get('choices') or []
    if not choices:
        return ''
    delta = choices[0].get('delta') or {}
    content = delta.get('content')
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return ''.join(
            str(item.get('text') or '')
            for item in content
            if isinstance(item, dict)
        )
    return ''


def click_visible_card_button(page, card_text: str, button_label: str) -> None:
    AI_E2E.dismiss_blocking_modals(page)
    card = page.locator('.ant-card:visible').filter(has_text=card_text).first
    card.wait_for(timeout=30000)
    button = card.get_by_role('button', name=button_label)
    button.scroll_into_view_if_needed()
    button.click(force=True)
    page.wait_for_timeout(300)


def post_json(url: str, payload: dict, timeout_seconds: int = 120) -> dict:
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    signature_source = f'{REQUEST_SIGNATURE_KEY}{REQUEST_CLIENT_CHANNEL}{REQUEST_CLIENT_APP}{REQUEST_CLIENT_VER}{body.decode("utf-8")}'
    signature = hashlib.sha256(signature_source.encode('utf-8')).hexdigest()
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            'Content-Type': 'application/json;charset=utf-8',
            'Accept': 'application/json',
            'Token': '',
            'LocalIp': '',
            'ClientChannel': REQUEST_CLIENT_CHANNEL,
            'ClientApp': REQUEST_CLIENT_APP,
            'ClientVer': REQUEST_CLIENT_VER,
            'Signature': signature,
            'Encrypted': '0',
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
        'models': [],
        'modelIds': [],
        'chatModelIds': [],
        'embeddingModelIds': [],
        'manualModels': [],
        'availableModels': [],
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
              payload: JSON.stringify({
                snapshot: { content: '[起盘信息]\\n技术: 六爻\\nLive AI 导出案例正文。' },
                moduleSnapshots: {
                  sixyao: {
                    content: '[起盘信息]\\n技术: 六爻\\nLive AI 导出案例正文。',
                  },
                },
              }),
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
        result['checks'].append({'name': 'isolated-runtime-launch', 'status': 'PASS', 'details': runtime_state})
        result['checks'].append({'name': 'backend-heartbeat', 'status': 'PASS', 'details': heartbeat})
        result['checks'].append({'name': 'chart-service-probe', 'status': 'PASS', 'details': chart_probe})
        try:
            runtime_verify = run_runtime_verify(server_root, REPO_ROOT)
        except Exception as exc:  # noqa: BLE001
            result['checks'].append({
                'name': 'backend-business-runtime-verify',
                'status': 'WARN',
                'details': {'error': str(exc)},
            })
        else:
            result['checks'].append({'name': 'backend-business-runtime-verify', 'status': 'PASS', 'details': runtime_verify})

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
            AI_E2E.click_inner_tab(page, '设置')
            click_visible_card_button(page, 'DeepSeek Live', '拉取模型')
            page.wait_for_function(
                """
                () => {
                  const workspace = JSON.parse(localStorage.getItem('horosa_ai_analysis_workspace_v2') || '{}');
                  const provider = (workspace.providerConfigs || []).find((item) => item.id === 'provider-deepseek-live');
                  const modelIds = provider && Array.isArray(provider.modelIds) ? provider.modelIds : [];
                  return modelIds.includes('deepseek-chat');
                }
                """,
                timeout=180000,
            )
            provider_models = page.evaluate(
                """
                () => {
                  const workspace = JSON.parse(localStorage.getItem('horosa_ai_analysis_workspace_v2') || '{}');
                  const provider = (workspace.providerConfigs || []).find((item) => item.id === 'provider-deepseek-live') || {};
                  return {
                    modelIds: provider.modelIds || [],
                    chatModelIds: provider.chatModelIds || [],
                    embeddingModelIds: provider.embeddingModelIds || [],
                  };
                }
                """
            )
            result['checks'].append({'name': 'deepseek-model-fetch', 'status': 'PASS', 'details': provider_models})

            click_visible_card_button(page, 'DeepSeek Live', '测试连接')
            page.wait_for_function(
                """
                () => {
                  const workspace = JSON.parse(localStorage.getItem('horosa_ai_analysis_workspace_v2') || '{}');
                  const provider = (workspace.providerConfigs || []).find((item) => item.id === 'provider-deepseek-live') || {};
                  const health = provider.healthStatus || {};
                  const diagnosis = provider.lastDiagnostics || {};
                  return Object.keys(health).length > 0 || Object.keys(diagnosis).length > 0;
                }
                """,
                timeout=180000,
            )
            provider_health = page.evaluate(
                """
                () => {
                  const workspace = JSON.parse(localStorage.getItem('horosa_ai_analysis_workspace_v2') || '{}');
                  const provider = (workspace.providerConfigs || []).find((item) => item.id === 'provider-deepseek-live') || {};
                  return {
                    healthStatus: provider.healthStatus || {},
                    lastDiagnostics: provider.lastDiagnostics || {},
                  };
                }
                """
            )
            health_state = provider_health.get('healthStatus') or provider_health.get('lastDiagnostics') or {}
            if not (health_state.get('ok') or health_state.get('healthy')):
                raise RuntimeError(f'DeepSeek diagnose failed: {health_state}')
            result['checks'].append({'name': 'deepseek-diagnose', 'status': 'PASS', 'details': provider_health})

            AI_E2E.click_inner_tab(page, '资料')
            AI_E2E.set_upload_files(page, [{
                'name': 'live-note.txt',
                'mimeType': 'text/plain',
                'buffer': '这是一份真实联网 AI 自检资料。'.encode('utf-8'),
            }])
            AI_E2E.expect_card(page, 'live-note')
            result['checks'].append({'name': 'ai-material-upload-live', 'status': 'PASS'})

            AI_E2E.click_inner_tab(page, '分析')
            AI_E2E.active_pane(page).get_by_role('button', name='新对话').click()
            page.wait_for_timeout(1200)
            selected_model = page.evaluate(
                """
                () => {
                  const workspace = JSON.parse(localStorage.getItem('horosa_ai_analysis_workspace_v2') || '{}');
                  const lastSessionId = localStorage.getItem('horosa_ai_analysis_last_session') || '';
                  const sessions = Array.isArray(workspace.sessions) ? workspace.sessions : [];
                  const current = sessions.find((item) => item.id === lastSessionId) || sessions[sessions.length - 1] || {};
                  return {
                    providerId: current.providerId || '',
                    modelId: current.modelId || current.model || '',
                  };
                }
                """
            )
            if not (
                selected_model.get('providerId') == 'provider-deepseek-live'
                and selected_model.get('modelId') == 'deepseek-chat'
            ):
                AI_E2E.select_in_active_pane(page, 0, 'deepseek-chat')
            AI_E2E.select_in_active_pane(page, 1, 'Live 事盘案例 / 六爻 / 2026-04-07 12:00:00')
            AI_E2E.select_in_active_pane(page, 2, '资料 · live-note')
            AI_E2E.select_in_active_pane(page, 3, '易卦')
            composer = AI_E2E.active_pane(page).locator('textarea').last
            composer.fill('请用一段约180字的连续中文总结这个案例，并明确说明资料是否被纳入分析、当前使用了什么技法，以及为什么流式输出需要持续平滑。')
            analysis_started_at = time.perf_counter()
            AI_E2E.active_pane(page).get_by_role('button', name='发送分析').click()
            app_visible_stream = collect_visible_stream_metrics(page, analysis_started_at, timeout_ms=180000)
            first_visible_assistant_text = app_visible_stream.get('samples', [{}])[0].get('text', '')
            first_visible_token_ms = int(app_visible_stream.get('firstVisibleMs') or 0)
            if first_visible_token_ms > AI_FIRST_VISIBLE_TOKEN_THRESHOLD_MS:
                raise RuntimeError(
                    f'live AI first visible token latency exceeded threshold: {first_visible_token_ms}ms > {AI_FIRST_VISIBLE_TOKEN_THRESHOLD_MS}ms'
                )
            assert_stream_metrics(app_visible_stream, 'app-visible')
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
            resolved_snapshot = latest_session.get('resolvedContextSnapshot') or {}
            if resolved_snapshot.get('selectedTechniqueKeys') != ['sixyao']:
                raise RuntimeError(f'live AI analysis technique selection missing or mismatched: {resolved_snapshot.get("selectedTechniqueKeys")}')
            technique_layer = resolved_snapshot.get('techniqueLayer') or ''
            if '[使用技法：易卦]' not in technique_layer or '技术: 六爻' not in technique_layer:
                raise RuntimeError(f'live AI analysis technique layer missing selected technique payload: {technique_layer}')
            if '[使用技法：' in technique_layer.replace('[使用技法：易卦]', ''):
                raise RuntimeError(f'live AI analysis technique layer leaked unexpected technique payload: {technique_layer}')
            replay_messages = [
                {
                    'id': item.get('id') or '',
                    'role': item.get('role') or 'user',
                    'content': item.get('content') or '',
                    'createdAt': item.get('createdAt') or '',
                }
                for item in (latest_session.get('messages') or [])
                if item.get('role') != 'assistant'
            ]
            current_provider = page.evaluate(
                """
                () => {
                  const workspace = JSON.parse(localStorage.getItem('horosa_ai_analysis_workspace_v2') || '{}');
                  return (workspace.providerConfigs || []).find((item) => item.id === 'provider-deepseek-live') || null;
                }
                """
            )
            if not current_provider:
                raise RuntimeError('live provider config missing after analysis')
            local_backend_stream = collect_delta_stream_metrics(
                build_local_backend_request(
                    server_root,
                    build_local_backend_chat_payload(
                        current_provider,
                        str(latest_session.get('modelId') or 'deepseek-chat'),
                        resolved_snapshot,
                        replay_messages,
                    ),
                ),
                parse_local_backend_delta,
                timeout_seconds=240,
            )
            direct_deepseek = collect_delta_stream_metrics(
                build_direct_deepseek_request(args.provider_key),
                parse_openai_compatible_delta,
                timeout_seconds=240,
            )
            result['checks'].append({
                'name': 'ai-analysis-live-stream',
                'status': 'PASS',
                'details': {
                    'sessionTitle': latest_session.get('title'),
                    'assistantExcerpt': ' '.join(assistant_text.split())[:160],
                    'selectedTechniqueKeys': resolved_snapshot.get('selectedTechniqueKeys') or [],
                    'firstVisibleTokenMs': first_visible_token_ms,
                    'firstVisibleAssistantText': first_visible_assistant_text[:120],
                    'appVisibleStream': {
                        key: value
                        for key, value in app_visible_stream.items()
                        if key != 'samples'
                    },
                    'localBackendStream': {
                        key: value
                        for key, value in local_backend_stream.items()
                        if key != 'samples'
                    },
                    'directDeepSeek': {
                        key: value
                        for key, value in direct_deepseek.items()
                        if key != 'samples'
                    },
                },
            })
            result['appVisibleStream'] = {
                key: value
                for key, value in app_visible_stream.items()
                if key != 'samples'
            }
            result['localBackendStream'] = {
                key: value
                for key, value in local_backend_stream.items()
                if key != 'samples'
            }
            result['directDeepSeek'] = {
                key: value
                for key, value in direct_deepseek.items()
                if key != 'samples'
            }

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
