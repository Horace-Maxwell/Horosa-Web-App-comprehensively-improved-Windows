#!/usr/bin/env python3
"""Browser verification for Guangde primary direction table + chart page."""

from __future__ import annotations

import csv
import hashlib
import json
import os
import sys
import time
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except Exception as exc:  # pragma: no cover
    print(json.dumps({"status": "skipped", "reason": f"playwright unavailable: {exc}"}, ensure_ascii=False))
    raise SystemExit(0)


def _configure_stdio() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


_configure_stdio()


ROOT = Path(__file__).resolve().parents[1]
RUNTIME_DIR = ROOT / "runtime"
KIT_ROOT = ROOT.parents[2] / "WINDOWS_CODEX_PRIMARY_DIRECTION_CHART_REPRO_KIT"
KIT_EXPECTED_RUNTIME_DIR = KIT_ROOT / "expected_results" / "runtime"

ASTROAPP_SUPPORTED_BASE_IDS = {
    "Sun",
    "Moon",
    "Mercury",
    "Venus",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune",
    "Pluto",
    "North Node",
    "Asc",
    "MC",
}


def is_ignorable_request_failure(url: str, failure: str | None) -> bool:
    txt = f"{failure or ''}"
    if 'net::ERR_ABORTED' not in txt:
        return False
    lower_url = f"{url or ''}".lower()
    return (
        'amap.com/tile/' in lower_url
        or 'amap.com' in lower_url
        or '/static/ywastro' in lower_url
        or '/static/ywastrochart' in lower_url
    )


def is_ignorable_console_error(text: str) -> bool:
    normalized = f"{text or ''}".strip()
    return normalized == "Failed to load resource: the server responded with a status of 404 (File not found)"


def click_visible_text(page, label: str, *, exact: bool = True, timeout_ms: int = 10_000) -> bool:
    locator = page.get_by_text(label, exact=exact)
    count = locator.count()
    for idx in range(count):
        item = locator.nth(idx)
        try:
            if not item.is_visible():
                continue
            item.scroll_into_view_if_needed(timeout=timeout_ms)
            try:
                item.click(timeout=timeout_ms)
            except Exception:
                item.click(timeout=timeout_ms, force=True)
            page.wait_for_timeout(400)
            return True
        except Exception:
            continue
    return False


def visible_select_texts(page) -> list[str]:
    selectors = page.locator(".ant-select-selector")
    texts: list[str] = []
    for idx in range(selectors.count()):
        try:
            item = selectors.nth(idx)
            if item.is_visible():
                texts.append(" ".join(item.inner_text().split()))
        except Exception:
            continue
    return texts


def select_visible_dropdown(page, visible_index: int, label: str) -> None:
    selectors = page.locator(".ant-select-selector")
    visible = []
    for idx in range(selectors.count()):
        item = selectors.nth(idx)
        try:
            if item.is_visible():
                visible.append(item)
        except Exception:
            continue
    target = visible[visible_index]
    target.click(force=True)
    page.wait_for_timeout(250)
    option = page.locator(".ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option-content", has_text=label).first
    option.click(force=True, timeout=10_000)
    page.wait_for_timeout(350)


def find_visible_select_index(page, current_text: str) -> int:
    texts = visible_select_texts(page)
    for idx, txt in enumerate(texts):
        if current_text in txt:
            return idx
    raise AssertionError(f"找不到当前文本为 {current_text!r} 的可见下拉框；当前可见：{texts}")


def click_recompute_button(page) -> None:
    locator = page.get_by_role("button")
    for idx in range(locator.count()):
        btn = locator.nth(idx)
        try:
            if not btn.is_visible() or btn.is_disabled():
                continue
            label = "".join(btn.inner_text().split())
            if label not in {"计算", "重新计算"} and "计算" not in label:
                continue
            btn.click(force=True, timeout=10_000)
            page.wait_for_timeout(2200)
            return
        except Exception:
            continue
    raise AssertionError("找不到可点击的 计算/重新计算 按钮")


def try_click_recompute_button(page) -> bool:
    try:
        click_recompute_button(page)
        return True
    except AssertionError:
        return False


def set_visible_datetime_selector(page, year: int, month: int, day: int, hour: int, minute: int, second: int, zone: str = "+08:00", visible_index: int = 0, confirm: bool = False) -> None:
    page.evaluate(
        """
        ([visibleIndex, year, month, day, hour, minute, second, zone, confirm]) => {
          const yearInputs = Array.from(document.querySelectorAll('input[placeholder="年"]')).filter((el) => {
            const style = window.getComputedStyle(el);
            return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
          });
          const target = yearInputs[visibleIndex];
          if (!target) {
            throw new Error(`visible year input ${visibleIndex} not found`);
          }
          const fiberKey = Object.keys(target).find((k) => k.startsWith('__reactFiber$'));
          let fiber = fiberKey ? target[fiberKey] : null;
          let inst = null;
          while (fiber) {
            if (fiber.stateNode && typeof fiber.stateNode.changeYear === 'function' && typeof fiber.stateNode.changeSecond === 'function') {
              inst = fiber.stateNode;
              break;
            }
            fiber = fiber.return;
          }
          if (!inst) {
            throw new Error('DateTimeSelector instance not found');
          }
          inst.changeZone(zone);
          inst.changeYear(year);
          inst.changeMonth(month);
          inst.changeDate(day);
          inst.changeHour(hour);
          inst.changeMinute(minute);
          inst.changeSecond(second);
          if (confirm && typeof inst.clickOk === 'function') {
            inst.clickOk();
          }
        }
        """,
        [visible_index, year, month, day, hour, minute, second, zone, confirm],
    )
    page.wait_for_timeout(800)


def split_degree_text(value: float) -> str:
    num = float(value)
    sign = "-" if num < 0 else ""
    value = abs(num)
    deg = int(value + 1e-12)
    minute = int(round((value - deg) * 60))
    if minute >= 60:
        deg += 1
        minute = 0
    return f"{sign}{deg}度{minute}分"


def is_bound_direction_row(pd: list) -> bool:
    prom = f"{pd[1] or ''}"
    sig = f"{pd[2] or ''}"
    return prom.startswith("T_") or sig.startswith("T_")


def is_antiscia_direction_row(pd: list) -> bool:
    prom = f"{pd[1] or ''}"
    sig = f"{pd[2] or ''}"
    return prom.startswith("A_") or prom.startswith("C_") or sig.startswith("A_") or sig.startswith("C_")


def base_direction_object_id(text: str) -> str:
    parts = f"{text or ''}".split("_")
    if len(parts) < 3:
        if len(parts) == 2 and parts[0] in {"A", "C"}:
            return parts[1]
        return f"{text or ''}".strip()
    if parts[0] == "T":
        return parts[1].strip()
    return "_".join(parts[1:-1]).strip()


def is_astroapp_unsupported_direction_row(pd: list) -> bool:
    if is_bound_direction_row(pd):
        return True
    prom_base = base_direction_object_id(pd[1])
    sig_base = base_direction_object_id(pd[2])
    return prom_base not in ASTROAPP_SUPPORTED_BASE_IDS or sig_base not in ASTROAPP_SUPPORTED_BASE_IDS


def build_display_rows(chart_obj: dict) -> list[dict]:
    params = chart_obj.get("params") or {}
    pd_method = params.get("pdMethod") or "astroapp_alchabitius"
    show_pd_bounds = params.get("showPdBounds", 1)
    hide_bounds = show_pd_bounds in (0, False)
    raw = ((chart_obj.get("predictives") or {}).get("primaryDirection")) or []
    rows = []
    for pd in raw:
        if pd_method == "astroapp_alchabitius":
            if is_astroapp_unsupported_direction_row(pd):
                continue
            if is_antiscia_direction_row(pd):
                continue
        if hide_bounds and is_bound_direction_row(pd):
            continue
        rows.append(
            {
                "arc_value": float(pd[0]),
                "arc_text": split_degree_text(float(pd[0])),
                "promittor": pd[1],
                "significator": pd[2],
                "date": pd[4],
            }
        )
    return rows


def parse_row_time(value: str) -> tuple[int, int, int, int, int, int]:
    date_part, time_part = value.strip().split(" ")
    year, month, day = [int(x) for x in date_part.split("-")]
    hour, minute, second = [int(x) for x in time_part.split(":")]
    return year, month, day, hour, minute, second


def table_rows(page, limit: int = 7) -> list[dict]:
    rows = []
    table_rows = page.locator("tbody tr")
    count = table_rows.count()
    for idx in range(count):
        cells = table_rows.nth(idx).locator("td")
        if cells.count() < 4:
            continue
        row = {
            "arc_text": " ".join(cells.nth(0).inner_text().split()),
            "promittor_text": " ".join(cells.nth(1).inner_text().split()),
            "significator_text": " ".join(cells.nth(2).inner_text().split()),
            "date_text": " ".join(cells.nth(3).inner_text().split()),
        }
        if not row["arc_text"] and not row["date_text"]:
            continue
        rows.append(row)
        if len(rows) >= limit:
            break
    return rows


def wait_table_rows(page, limit: int = 7, rounds: int = 30, delay_ms: int = 500) -> list[dict]:
    rows: list[dict] = []
    for _ in range(rounds):
        rows = table_rows(page, limit=limit)
        if len(rows) >= limit:
            return rows
        page.wait_for_timeout(delay_ms)
    return rows


def extract_primary_direction_chart_obj(page) -> dict:
    data = page.evaluate(
        """
        () => {
          const tr = document.querySelector('tbody tr');
          if (!tr) {
            return null;
          }
          const fiberKey = Object.keys(tr).find((k) => k.startsWith('__reactFiber$'));
          let fiber = fiberKey ? tr[fiberKey] : null;
          while (fiber) {
            const props = fiber.memoizedProps || {};
            const stateNode = fiber.stateNode;
            const value = props.value || (stateNode && stateNode.props && stateNode.props.value);
            if (value && value.predictives && value.predictives.primaryDirection) {
              return value;
            }
            fiber = fiber.return;
          }
          return null;
        }
        """
    )
    if not data:
        raise AssertionError("无法从主/界限法表格组件中提取当前 chart 数据")
    return data


def first_svg_hash(page) -> str:
    data = page.evaluate(
        """
        () => {
          const svgs = Array.from(document.querySelectorAll('svg')).filter((el) => {
            const style = window.getComputedStyle(el);
            return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
          });
          if (!svgs.length) {
            return null;
          }
          let best = '';
          svgs.forEach((el) => {
            const markup = el.innerHTML || '';
            if (markup.length > best.length) {
              best = markup;
            }
          });
          return best;
        }
        """
    )
    if not data:
        raise AssertionError("当前页面找不到可见 SVG")
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def wait_svg_hash_change(page, previous_hash: str, rounds: int = 12, delay_ms: int = 400) -> str:
    latest = first_svg_hash(page)
    if latest != previous_hash:
        return latest
    for _ in range(rounds):
        page.wait_for_timeout(delay_ms)
        latest = first_svg_hash(page)
        if latest != previous_hash:
            return latest
    return latest


def read_term_highlight(page) -> dict:
    data = page.evaluate(
        """
        () => {
          const target = document.querySelector('g.astro-term-highlight[data-highlight-marker="Asc"], g.astro-term-highlight[data-highlight-marker="ASC"]');
          if (!target) {
            return null;
          }
          const path = target.querySelector('path');
          return {
            sign: target.getAttribute('data-term-sign') || '',
            owner: target.getAttribute('data-highlight-owner') || target.getAttribute('data-term-owner') || '',
            marker: target.getAttribute('data-highlight-marker') || '',
            stroke: path ? (path.getAttribute('stroke') || '') : '',
            strokeWidth: path ? (path.getAttribute('stroke-width') || '') : '',
            markerCount: target.querySelectorAll('circle').length,
            lineCount: target.querySelectorAll('line').length,
          };
        }
        """
    )
    if not data:
        raise AssertionError("主限法盘未渲染 ASC 所在 Term 高亮")
    if not data.get("sign") or not data.get("owner"):
        raise AssertionError(f"ASC Term 高亮数据不完整: {data}")
    if data.get("markerCount", 0) < 1 or data.get("lineCount", 0) < 1:
        raise AssertionError(f"ASC Term 高亮缺少标记元素: {data}")
    return data


def set_geo_to_guangde(page) -> None:
    if not click_visible_text(page, "经纬度选择"):
        raise AssertionError("无法打开经纬度选择弹窗")
    page.wait_for_timeout(900)
    page.evaluate(
        """
        () => {
          const target = document.querySelector('input[placeholder="输入关键字搜索地理位置"]');
          if (!target) {
            throw new Error('geo modal search input not found');
          }
          const fiberKey = Object.keys(target).find((k) => k.startsWith('__reactFiber$'));
          let fiber = fiberKey ? target[fiberKey] : null;
          let modalInst = null;
          while (fiber) {
            if (fiber.stateNode && typeof fiber.stateNode.clickOk === 'function') {
              modalInst = fiber.stateNode;
              break;
            }
            fiber = fiber.return;
          }
          if (!modalInst) {
            throw new Error('geo modal instance not found');
          }
          modalInst.setState({
            record: {
              lat: 30.8833333333,
              lng: 119.4166666667,
              gpsLat: 30.8833333333,
              gpsLng: 119.4166666667,
            },
          });
        }
        """
    )
    page.wait_for_timeout(300)
    page.get_by_role("button", name="OK").last.click(force=True)
    page.wait_for_timeout(1200)


def set_main_chart_datetime(page, year: int, month: int, day: int, hour: int, minute: int, second: int) -> None:
    set_visible_datetime_selector(page, year, month, day, hour, minute, second, zone="+08:00", visible_index=0, confirm=True)


def set_pd_chart_datetime(page, year: int, month: int, day: int, hour: int, minute: int, second: int) -> None:
    set_visible_datetime_selector(page, year, month, day, hour, minute, second, zone="+00:00", visible_index=0, confirm=True)
    page.wait_for_timeout(1200)


def sync_chart_store(page, payload: dict) -> None:
    page.evaluate(
        """
        async (payload) => {
          const rootEl = document.querySelector('section.ant-layout') || document.body;
          const rootKey = Object.keys(rootEl).find((key) => key.startsWith('__reactFiber$'));
          const rootFiber = rootKey ? rootEl[rootKey] : null;
          if (!rootFiber) {
            throw new Error('root fiber not found');
          }
          const seen = new Set();
          const queue = [rootFiber];
          let dispatch = null;
          while (queue.length) {
            const fiber = queue.shift();
            if (!fiber || seen.has(fiber)) {
              continue;
            }
            seen.add(fiber);
            const props = fiber.memoizedProps;
            if (props && typeof props.dispatch === 'function') {
              dispatch = props.dispatch;
              break;
            }
            if (fiber.child) {
              queue.push(fiber.child);
            }
            if (fiber.sibling) {
              queue.push(fiber.sibling);
            }
          }
          if (typeof dispatch !== 'function') {
            throw new Error('dva dispatch not found');
          }
          dispatch({
            type: 'astro/fetchByChartData',
            payload,
          });
          const deadline = Date.now() + 30000;
          while (Date.now() < deadline) {
            const queue2 = [rootFiber];
            const seen2 = new Set();
            while (queue2.length) {
              const fiber = queue2.shift();
              if (!fiber || seen2.has(fiber)) {
                continue;
              }
              seen2.add(fiber);
              const props = fiber.memoizedProps;
              const astro = props && props.astro;
              const chartObj = astro && astro.chartObj;
              const chartParams = chartObj && chartObj.params;
              const fields = astro && astro.fields;
              if (
                chartParams
                && chartParams.birth === payload.birth
                && chartParams.lat === payload.lat
                && chartParams.lon === payload.lon
                && fields
                && fields.lat
                && fields.lon
                && fields.lat.value === payload.lat
                && fields.lon.value === payload.lon
              ) {
                return;
              }
              if (fiber.child) {
                queue2.push(fiber.child);
              }
              if (fiber.sibling) {
                queue2.push(fiber.sibling);
              }
            }
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
          throw new Error('timed out waiting for astro/fetchByChartData');
        }
        """,
        payload,
    )
    page.wait_for_timeout(1200)


def read_state_lines(page) -> dict[str, str]:
    data = page.evaluate(
        """
        () => {
          const aliases = {
            "当前已应用方法：": ["当前已应用方法：", "当前盘面方法："],
            "当前度数换算：": ["当前度数换算：", "当前盘面度数换算："],
            "当前主限法年龄：": ["当前主限法年龄："],
            "外圈时间：": ["外圈时间："],
            "当前ASC所在界：": ["当前ASC所在界："],
          };
          const result = {};
          const nodes = Array.from(document.querySelectorAll('div,span,p'));
          const visible = nodes.filter((el) => {
            const style = window.getComputedStyle(el);
            return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
          });
          Object.entries(aliases).forEach(([key, prefixes]) => {
            const hit = visible.find((el) => {
              const txt = (el.textContent || '').trim();
              return prefixes.some((prefix) => txt.startsWith(prefix));
            });
            if (hit) {
              result[key] = (hit.textContent || '').trim();
            }
          });
          return result;
        }
        """
    )
    return data or {}


def wait_state_line(page, key: str, expected: str, rounds: int = 12, delay_ms: int = 400) -> dict[str, str]:
    state = read_state_lines(page)
    if state.get(key) == expected:
        return state
    for _ in range(rounds):
        page.wait_for_timeout(delay_ms)
        state = read_state_lines(page)
        if state.get(key) == expected:
            return state
    return state


def load_astroapp_rows(limit: int = 7) -> list[dict]:
    candidates = [
        ROOT / "runtime" / "pd_auto" / "debug_guangde_case" / "dirs.csv",
        KIT_EXPECTED_RUNTIME_DIR / "pd_auto" / "debug_guangde_case" / "dirs.csv",
    ]
    path = next((candidate for candidate in candidates if candidate.exists()), None)
    if path is None:
        raise FileNotFoundError(
            "missing Guangde dirs.csv fixture in runtime/ or WINDOWS_CODEX_PRIMARY_DIRECTION_CHART_REPRO_KIT/expected_results/"
        )
    rows = []
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        reader = csv.DictReader(fh)
        for idx, row in enumerate(reader):
            if idx >= limit:
                break
            rows.append(
                {
                    "arc_value": float(row["arc"]),
                    "arc_text": split_degree_text(float(row["arc"])),
                    "date_text": row["dirDate"],
                }
            )
    return rows


def main() -> None:
    web_port = os.environ.get("HOROSA_WEB_PORT", "8000")
    server_root = os.environ.get("HOROSA_SERVER_ROOT", f"http://127.0.0.1:{os.environ.get('HOROSA_SERVER_PORT', '9999')}")
    base_url = os.environ.get(
        "HOROSA_WEB_ROOT",
        f"http://127.0.0.1:{web_port}/index.html?srv={server_root.replace(':', '%3A').replace('/', '%2F')}&v={int(time.time())}",
    )

    out_json = RUNTIME_DIR / "guangde_primarydirchart_browser_check.json"
    out_table_png = RUNTIME_DIR / "guangde_primarydirect_browser_table.png"
    out_chart_png = RUNTIME_DIR / "guangde_primarydirchart_browser.png"
    out_json.parent.mkdir(parents=True, exist_ok=True)
    result: dict = {
        "status": "ok",
        "base_url": base_url,
        "server_root": server_root,
        "dialogs": [],
        "pageErrors": [],
        "consoleErrors": [],
        "requestFailures": [],
    }

    captured_chart_json: dict | None = None

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1720, "height": 1280})

        page.on("dialog", lambda dialog: (result["dialogs"].append(dialog.message), dialog.dismiss()))
        page.on("pageerror", lambda exc: result["pageErrors"].append(str(exc)))
        def on_console(msg):
            if msg.type != "error":
                return
            if is_ignorable_console_error(msg.text):
                return
            result["consoleErrors"].append(msg.text)
        page.on("console", on_console)
        def on_request_failed(req):
            if is_ignorable_request_failure(req.url, req.failure):
                return
            result["requestFailures"].append({"url": req.url, "failure": req.failure})
        page.on("requestfailed", on_request_failed)

        page.goto(base_url, wait_until="domcontentloaded", timeout=120_000)
        page.wait_for_timeout(5000)
        print("step: loaded page", flush=True)

        set_geo_to_guangde(page)
        print("step: set geo", flush=True)
        set_main_chart_datetime(page, 2006, 10, 4, 9, 58, 0)
        print("step: set natal datetime", flush=True)
        sync_chart_store(
            page,
            {
                "birth": "2006-10-04 09:58:00",
                "zone": "+08:00",
                "ad": 1,
                "lat": "30n53",
                "lon": "119e25",
                "gpsLat": 30.8833333333,
                "gpsLon": 119.4166666667,
                "name": "guangde",
                "pos": "guangde",
            },
        )
        print("step: synced natal chart store", flush=True)
        page.wait_for_timeout(4000)
        print("step: recalculated natal chart", flush=True)

        body_text = page.locator("body").inner_text()
        result["chart_body_excerpt"] = body_text[:1000]

        if not click_visible_text(page, "推运盘"):
            raise AssertionError("无法点击推运盘")
        page.wait_for_timeout(900)
        print("step: opened 推运盘", flush=True)
        if not click_visible_text(page, "主/界限法"):
            raise AssertionError("无法打开主/界限法")
        page.wait_for_timeout(1200)
        print("step: opened 主/界限法", flush=True)
        sync_chart_store(
            page,
            {
                "birth": "2006-10-04 09:58:00",
                "zone": "+08:00",
                "ad": 1,
                "lat": "30n53",
                "lon": "119e25",
                "gpsLat": 30.8833333333,
                "gpsLon": 119.4166666667,
                "name": "guangde",
                "pos": "guangde",
            },
        )
        print("step: synced 推运盘 store", flush=True)

        if try_click_recompute_button(page):
            print("step: computed 主/界限法 table", flush=True)
        else:
            page.wait_for_timeout(2200)
            print("step: waited 主/界限法 table refresh", flush=True)
        browser_table = wait_table_rows(page, limit=7)
        if len(browser_table) < 7:
            raise AssertionError("主/界限法浏览器表格可见行不足")
        out_table_png.parent.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(out_table_png), full_page=True)

        captured_chart_json = extract_primary_direction_chart_obj(page)
        backend_rows = build_display_rows(captured_chart_json)[:7]
        astroapp_rows = load_astroapp_rows(limit=7)

        for idx, (browser_row, backend_row) in enumerate(zip(browser_table, backend_rows), start=1):
            if browser_row["arc_text"] != backend_row["arc_text"]:
                raise AssertionError(f"浏览器第{idx}行 Arc 与后端不一致: {browser_row['arc_text']} != {backend_row['arc_text']}")
            if browser_row["date_text"] != backend_row["date"]:
                raise AssertionError(f"浏览器第{idx}行日期与后端不一致: {browser_row['date_text']} != {backend_row['date']}")

        if not click_visible_text(page, "主限法盘"):
            raise AssertionError("无法打开主限法盘")
        page.wait_for_timeout(1500)
        print("step: opened 主限法盘", flush=True)

        initial_state = read_state_lines(page)
        if "当前已应用方法：" not in initial_state or "AstroAPP-Alchabitius" not in initial_state["当前已应用方法："]:
            raise AssertionError("主限法盘未显示 AstroAPP-Alchabitius 当前盘面状态")
        if "当前ASC所在界：" not in initial_state:
            raise AssertionError("主限法盘未显示当前 ASC 所在界文本")
        initial_term_highlight = read_term_highlight(page)
        initial_svg_hash = first_svg_hash(page)
        visible_selects_initial = visible_select_texts(page)
        method_select_index = find_visible_select_index(page, "AstroAPP-Alchabitius")
        timekey_select_index = find_visible_select_index(page, "Ptolemy")

        row_for_chart = browser_table[4]
        year, month, day, hour, minute, second = parse_row_time(row_for_chart["date_text"])
        set_pd_chart_datetime(page, year, month, day, hour, minute, second)
        print("step: set pd chart to table time", flush=True)
        state_at_row = wait_state_line(page, "外圈时间：", f"外圈时间：{row_for_chart['date_text']}")
        state_at_row = wait_state_line(page, "当前主限法年龄：", f"当前主限法年龄：{row_for_chart['arc_text']}")
        svg_hash_at_row = first_svg_hash(page)
        if state_at_row.get("外圈时间：") != f"外圈时间：{row_for_chart['date_text']}":
            raise AssertionError("主限法盘外圈时间未同步到选定的表格时间")
        if state_at_row.get("当前主限法年龄：") != f"当前主限法年龄：{row_for_chart['arc_text']}":
            raise AssertionError("主限法盘当前Arc未对齐主/界限法表格行")
        if svg_hash_at_row == initial_svg_hash:
            raise AssertionError("主限法盘在切到表格时间后外圈图形未变化")

        set_pd_chart_datetime(page, 2008, 1, 1, 0, 0, 0)
        print("step: set pd chart to arbitrary time", flush=True)
        arbitrary_state = wait_state_line(page, "外圈时间：", "外圈时间：2008-01-01 00:00:00")
        arbitrary_state = wait_state_line(page, "当前主限法年龄：", "当前主限法年龄：1度15分")
        arbitrary_svg_hash = wait_svg_hash_change(page, svg_hash_at_row)
        if arbitrary_state.get("外圈时间：") != "外圈时间：2008-01-01 00:00:00":
            raise AssertionError("主限法盘未能显示任意时间")
        if arbitrary_state.get("当前主限法年龄：") != "当前主限法年龄：1度15分":
            raise AssertionError("主限法盘任意时间 Arc 未达到预期的 1度15分")
        if arbitrary_svg_hash == svg_hash_at_row:
            raise AssertionError("主限法盘切换任意时间后外圈图形未变化")
        arbitrary_term_highlight = read_term_highlight(page)

        select_visible_dropdown(page, method_select_index, "Horosa原方法")
        page.wait_for_timeout(900)
        preview_legacy_state = read_state_lines(page)
        preview_legacy_svg_hash = first_svg_hash(page)
        if "Horosa原方法" not in preview_legacy_state.get("当前已应用方法：", ""):
            raise AssertionError("主限法盘切换到 Horosa原方法 后，盘面方法未立即更新")
        if preview_legacy_svg_hash == arbitrary_svg_hash:
            raise AssertionError("主限法盘切换到 Horosa原方法 后，盘面未立即变化")
        click_recompute_button(page)
        print("step: switched pd chart to Horosa原方法", flush=True)
        legacy_state = read_state_lines(page)
        if "Horosa原方法" not in legacy_state.get("当前已应用方法：", ""):
            raise AssertionError("主限法盘切换到 Horosa原方法 后，当前状态未更新")
        legacy_svg_hash = first_svg_hash(page)
        if legacy_svg_hash == arbitrary_svg_hash and legacy_svg_hash == preview_legacy_svg_hash:
            raise AssertionError("主限法盘切换到 Horosa原方法 后盘面未变化")

        if not click_visible_text(page, "主/界限法"):
            raise AssertionError("切换方法后无法返回主/界限法")
        page.wait_for_timeout(1200)
        legacy_chart_json = extract_primary_direction_chart_obj(page)
        legacy_backend_rows = build_display_rows(legacy_chart_json)[:7]
        if (legacy_chart_json.get("params") or {}).get("pdMethod") != "horosa_legacy":
            raise AssertionError("Horosa原方法 切换后 /chart 参数中的 pdMethod 未更新")
        if legacy_backend_rows[:1] == backend_rows[:1]:
            raise AssertionError("Horosa原方法 切换后，主/界限法结果未发生变化")

        if not click_visible_text(page, "主限法盘"):
            raise AssertionError("无法重新打开主限法盘以回切 AstroAPP 方法")
        page.wait_for_timeout(1200)
        select_visible_dropdown(page, method_select_index, "AstroAPP-Alchabitius")
        if find_visible_select_index(page, "Ptolemy") != timekey_select_index:
            raise AssertionError("度数换算下拉位置在主限法盘中异常漂移")
        page.wait_for_timeout(900)
        preview_restored_state = read_state_lines(page)
        preview_restored_svg_hash = first_svg_hash(page)
        if "AstroAPP-Alchabitius" not in preview_restored_state.get("当前已应用方法：", ""):
            raise AssertionError("回切 AstroAPP-Alchabitius 后，盘面方法未立即恢复")
        if preview_restored_svg_hash == legacy_svg_hash:
            raise AssertionError("回切 AstroAPP-Alchabitius 后，盘面未立即变化")
        click_recompute_button(page)
        print("step: switched pd chart back to AstroAPP-Alchabitius", flush=True)
        restored_state = read_state_lines(page)
        if "AstroAPP-Alchabitius" not in restored_state.get("当前已应用方法：", ""):
            raise AssertionError("回切 AstroAPP-Alchabitius 后，当前状态未恢复")

        if not click_visible_text(page, "主/界限法"):
            raise AssertionError("回切 AstroAPP 方法后无法返回主/界限法")
        page.wait_for_timeout(1200)
        restored_chart_json = extract_primary_direction_chart_obj(page)
        restored_backend_rows = build_display_rows(restored_chart_json)[:7]
        if (restored_chart_json.get("params") or {}).get("pdMethod") != "astroapp_alchabitius":
            raise AssertionError("回切 AstroAPP-Alchabitius 后 /chart 参数中的 pdMethod 未恢复")
        if restored_backend_rows != backend_rows:
            raise AssertionError("回切 AstroAPP-Alchabitius 后，主/界限法结果未恢复到原始 AstroAPP 分支")

        page.screenshot(path=str(out_chart_png), full_page=True)
        browser.close()

    result["browser_table_first_rows"] = browser_table
    result["backend_first_rows"] = backend_rows
    result["astroapp_first_rows"] = astroapp_rows
    result["initial_pd_chart_state"] = initial_state
    result["initial_pd_chart_term_highlight"] = initial_term_highlight
    result["row_time_pd_chart_state"] = state_at_row
    result["arbitrary_pd_chart_state"] = arbitrary_state
    result["arbitrary_pd_chart_term_highlight"] = arbitrary_term_highlight
    result["preview_legacy_pd_chart_state"] = preview_legacy_state
    result["legacy_pd_chart_state"] = legacy_state
    result["preview_restored_pd_chart_state"] = preview_restored_state
    result["restored_pd_chart_state"] = restored_state
    result["visible_selects_initial"] = visible_selects_initial
    result["legacy_backend_first_rows"] = legacy_backend_rows
    result["restored_backend_first_rows"] = restored_backend_rows
    result["svg_hashes"] = {
        "initial": initial_svg_hash,
        "row_time": svg_hash_at_row,
        "arbitrary": arbitrary_svg_hash,
        "preview_legacy": preview_legacy_svg_hash,
        "legacy": legacy_svg_hash,
        "preview_restored": preview_restored_svg_hash,
    }
    if result["dialogs"] or result["pageErrors"] or result["consoleErrors"] or result["requestFailures"]:
        result["status"] = "error"
    out_json.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(1 if result["status"] != "ok" else 0)


if __name__ == "__main__":
    main()
