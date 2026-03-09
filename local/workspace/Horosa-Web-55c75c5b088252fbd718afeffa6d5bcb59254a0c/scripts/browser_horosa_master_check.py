#!/usr/bin/env python3
"""Browser-level Horosa smoke check for major modules and PD recalculation."""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

try:
    from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
    from playwright.sync_api import sync_playwright
except Exception as exc:  # pragma: no cover - optional dependency path
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


TOP_MODULES = [
    ("星盘", ["信息", "相位", "行星", "希腊点", "可能性"]),
    ("三维盘", ["信息", "相位", "行星", "希腊点"]),
    ("推运盘", ["主/界限法", "主限法盘", "黄道星释", "法达星限", "小限法", "太阳弧", "太阳返照", "月亮返照", "流年法", "十年大运"]),
    ("量化盘", []),
    ("关系盘", []),
    ("节气盘", ["二十四节气"]),
    ("星体地图", ["行星地图"]),
    ("七政四余", []),
    ("希腊星术", ["十三分盘"]),
    ("印度律盘", ["命盘", "2律盘", "3律盘", "4律盘", "7律盘", "9律盘", "10律盘", "12律盘", "16律盘", "20律盘", "24律盘", "27律盘", "40律盘", "45律盘"]),
    ("八字紫微", ["八字", "紫微斗数", "八卦类象", "十二串宫", "八字规则"]),
    ("易与三式", ["宿盘", "易卦", "六壬", "金口诀", "遁甲", "太乙", "统摄法"]),
    ("万年历", []),
    ("西洋游戏", []),
    ("风水", []),
    ("三式合一", []),
]

IGNORED_REMOTE_URL_SNIPPETS = (
    "jsapi-data",
    "amap.com/tile/",
    "chart3d.horosa.com/gltf/",
)


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
            page.wait_for_timeout(500)
            return True
        except Exception:
            continue
    return False


def first_table_row_text(page) -> str:
    rows = page.locator("tbody tr")
    for idx in range(rows.count()):
        try:
            raw = " ".join(rows.nth(idx).inner_text().split())
        except Exception:
            continue
        if raw:
            return raw
    return ""


def visible_select_indices(page) -> list[int]:
    selectors = page.locator(".ant-select-selector")
    indices: list[int] = []
    for idx in range(selectors.count()):
        try:
            if selectors.nth(idx).is_visible():
                indices.append(idx)
        except Exception:
            continue
    return indices


def select_dropdown_value(page, select_index: int, label: str) -> None:
    selectors = page.locator(".ant-select-selector")
    target = selectors.nth(select_index)
    target.click(force=True)
    page.wait_for_timeout(400)
    option = page.locator(".ant-select-dropdown:visible").get_by_text(label, exact=True)
    option.first.click(force=True, timeout=10_000)
    page.wait_for_timeout(600)


def click_compute_and_wait_chart(page) -> None:
    button = page.get_by_role("button", name="重新计算")
    if button.count() == 0 or not button.first.is_visible():
        button = page.get_by_role("button", name="计算")
    with page.expect_response(lambda resp: "/chart" in resp.url and resp.request.method == "POST" and resp.status == 200, timeout=120_000):
        button.first.click(force=True)
    page.wait_for_timeout(1200)


def ensure_pd_recalc(page, result: dict) -> None:
    if not click_visible_text(page, "主/界限法"):
        raise AssertionError("无法切到主/界限法")
    page.wait_for_timeout(1200)

    visible_indices = visible_select_indices(page)
    if len(visible_indices) < 3:
        raise AssertionError(f"主限法页可见 select 数不足，found={visible_indices}")

    method_select_index = visible_indices[1]
    before = first_table_row_text(page)

    select_dropdown_value(page, method_select_index, "Horosa原方法")
    click_compute_and_wait_chart(page)
    legacy = first_table_row_text(page)

    select_dropdown_value(page, method_select_index, "AstroAPP-Alchabitius")
    click_compute_and_wait_chart(page)
    astroapp = first_table_row_text(page)

    if not legacy or not astroapp:
        raise AssertionError("主限法表格为空")
    if legacy == astroapp:
        raise AssertionError("切换 Horosa原方法 / AstroAPP-Alchabitius 后主限法首行未变化")

    result["primary_direction_switch"] = {
        "before": before,
        "legacy_first_row": legacy,
        "astroapp_first_row": astroapp,
    }


def ensure_pd_chart_smoke(page, result: dict) -> None:
    if not click_visible_text(page, "主限法盘"):
        raise AssertionError("无法切到主限法盘")
    page.wait_for_timeout(1200)

    body = page.locator("body").inner_text()
    required = ["时间选择", "推运方法", "度数换算", "当前主限法年龄", "外圈时间"]
    missing = [item for item in required if item not in body]
    if missing:
        raise AssertionError(f"主限法盘缺少关键文案: {missing}")

    svg_markup = page.evaluate(
        """
        () => {
          const svgs = Array.from(document.querySelectorAll('svg')).filter((el) => {
            const style = window.getComputedStyle(el);
            return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
          });
          if (!svgs.length) {
            return '';
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
    ) or ""
    if len(svg_markup) < 1000:
        raise AssertionError("主限法盘 SVG 内容为空或过短")

    result["primary_direction_chart"] = {
        "svg_length": len(svg_markup),
        "body_excerpt": body[:400],
    }


def open_and_close_modal(page, button_label: str, result_key: str, result: dict) -> None:
    clicked = click_visible_text(page, button_label)
    if not clicked:
        result[result_key] = {"clicked": False}
        return
    page.wait_for_timeout(700)
    modal_count = page.locator(".ant-modal:visible").count()
    result[result_key] = {"clicked": True, "visible_modals": modal_count}
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)
    if page.locator(".ant-modal:visible").count():
        close_buttons = page.locator(".ant-modal:visible .ant-modal-close")
        if close_buttons.count():
            close_buttons.first.click(force=True)
            page.wait_for_timeout(300)


def main() -> None:
    web_port = os.environ.get("HOROSA_WEB_PORT", "8000")
    server_root = os.environ.get("HOROSA_SERVER_ROOT", f"http://127.0.0.1:{os.environ.get('HOROSA_SERVER_PORT', '9999')}")
    base_url = os.environ.get(
        "HOROSA_WEB_ROOT",
        f"http://127.0.0.1:{web_port}/index.html?srv={server_root.replace(':', '%3A').replace('/', '%2F')}&v={int(time.time())}",
    )

    screenshot_path = Path(os.environ.get("HOROSA_BROWSER_CHECK_SCREENSHOT", str(RUNTIME_DIR / "browser_horosa_master_check.png")))
    json_path = Path(os.environ.get("HOROSA_BROWSER_CHECK_JSON", str(RUNTIME_DIR / "browser_horosa_master_check.json")))
    screenshot_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.parent.mkdir(parents=True, exist_ok=True)

    result: dict = {
        "status": "ok",
        "base_url": base_url,
        "server_root": server_root,
        "modules": [],
        "dialogs": [],
        "pageErrors": [],
        "consoleErrors": [],
        "requestFailures": [],
        "warnings": [],
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1720, "height": 1280})

        page.on("dialog", lambda dialog: (result["dialogs"].append(dialog.message), dialog.dismiss()))
        page.on("pageerror", lambda exc: result["pageErrors"].append(str(exc)))

        def on_console(msg):
            if msg.type == "error":
                result["consoleErrors"].append(msg.text)

        page.on("console", on_console)

        def on_request_failed(req):
            result["requestFailures"].append({"url": req.url, "failure": req.failure})

        page.on("requestfailed", on_request_failed)

        start = time.perf_counter()
        page.goto(base_url, wait_until="domcontentloaded", timeout=120_000)
        page.wait_for_timeout(5000)
        result["initial_load_seconds"] = round(time.perf_counter() - start, 3)

        open_and_close_modal(page, "AI导出设置", "ai_export_settings", result)
        open_and_close_modal(page, "AI导出", "ai_export", result)

        for top_label, subtabs in TOP_MODULES:
            entry = {"module": top_label, "clicked": False, "subtabs": [], "seconds": None}
            step_start = time.perf_counter()
            if not click_visible_text(page, top_label):
                entry["error"] = "top module not clickable"
                result["modules"].append(entry)
                raise AssertionError(f"无法点击左侧模块：{top_label}")

            entry["clicked"] = True
            page.wait_for_timeout(1000)

            for subtab in subtabs:
                sub_entry = {"label": subtab, "clicked": False}
                if click_visible_text(page, subtab):
                    sub_entry["clicked"] = True
                    page.wait_for_timeout(700)
                    if top_label == "推运盘" and subtab == "主/界限法":
                        ensure_pd_recalc(page, result)
                    if top_label == "推运盘" and subtab == "主限法盘":
                        ensure_pd_chart_smoke(page, result)
                entry["subtabs"].append(sub_entry)

            entry["seconds"] = round(time.perf_counter() - step_start, 3)
            entry["body_excerpt"] = page.locator("body").inner_text()[:400]
            result["modules"].append(entry)

        page.screenshot(path=str(screenshot_path), full_page=True)
        browser.close()

    local_request_failures = []
    remote_request_warnings = []
    for failure in result["requestFailures"]:
        url = failure.get("url", "")
        if any(snippet in url for snippet in IGNORED_REMOTE_URL_SNIPPETS):
            remote_request_warnings.append(failure)
        else:
            local_request_failures.append(failure)
    result["requestFailures"] = local_request_failures
    if remote_request_warnings:
        result["warnings"].append(
            {
                "type": "remote_request_failures",
                "count": len(remote_request_warnings),
                "samples": remote_request_warnings[:10],
            }
        )

    fatal_console_errors = []
    ignored_console_errors = []
    for message in result["consoleErrors"]:
        if "Failed to load resource" in message and "ERR_CONNECTION_TIMED_OUT" in message:
            ignored_console_errors.append(message)
        else:
            fatal_console_errors.append(message)
    result["consoleErrors"] = fatal_console_errors
    if ignored_console_errors:
        result["warnings"].append(
            {
                "type": "remote_console_errors",
                "count": len(ignored_console_errors),
                "samples": ignored_console_errors[:10],
            }
        )

    if result["dialogs"] or result["pageErrors"] or result["consoleErrors"] or result["requestFailures"]:
        result["status"] = "error"

    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(1 if result["status"] != "ok" else 0)


if __name__ == "__main__":
    main()
