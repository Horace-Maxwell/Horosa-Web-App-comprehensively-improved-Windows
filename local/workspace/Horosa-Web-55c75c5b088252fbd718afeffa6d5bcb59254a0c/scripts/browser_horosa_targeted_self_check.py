#!/usr/bin/env python3
"""Targeted browser self-check for current Horosa blockers."""

from __future__ import annotations

import argparse
import json
import os
import re
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
RUNTIME_DIR = ROOT / "runtime" / "self-check"
SANSHI_MIN_BOTTOM_GAP = 24
SANSHI_MAX_HEIGHT_DRIFT = 8
DUNJIA_MIN_BOTTOM_GAP = 24
DUNJIA_MAX_HEIGHT_DRIFT = 8
MIN_VISIBLE_SVG_SIZE = 360


def ensure_parent(path_value: Path) -> None:
    path_value.parent.mkdir(parents=True, exist_ok=True)


def read_case_payload(case_file: str | None) -> list[dict]:
    if case_file:
        payload = json.loads(Path(case_file).read_text(encoding="utf-8"))
    else:
        payload = json.loads((ROOT / "scripts" / "self_check_cases.default.json").read_text(encoding="utf-8"))
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and isinstance(payload.get("cases"), list):
        return payload["cases"]
    return []


def normalized_text(text: str) -> str:
    return " ".join((text or "").split())


def with_cache_buster(url: str, stamp: int) -> str:
    text = (url or "").strip()
    if not text:
        return text
    glue = "&" if "?" in text else "?"
    return f"{text}{glue}__selfcheck_ts={stamp}"


def visible_tablists(page):
    lists = page.locator("[role='tablist']")
    result = []
    for idx in range(lists.count()):
        item = lists.nth(idx)
        try:
            if item.is_visible():
                result.append(item)
        except Exception:
            continue
    return result


def clear_blocking_spin(page) -> None:
    page.evaluate(
        """
        () => {
          document.querySelectorAll('.ant-spin-blur').forEach((node) => {
            node.classList.remove('ant-spin-blur');
          });
          document.querySelectorAll('.ant-spin-spinning').forEach((node) => {
            const text = (node.textContent || '').trim();
            if (text.includes('载入中') || node.classList.contains('ant-spin')) {
              node.style.display = 'none';
            }
          });
        }
        """
    )


def click_tab_from_visible_tablists(page, label: str) -> bool:
    clear_blocking_spin(page)
    for tablist in visible_tablists(page):
        tabs = tablist.locator(".ant-tabs-tab")
        texts = []
        for idx in range(tabs.count()):
            try:
                if not tabs.nth(idx).is_visible():
                    continue
                texts.append(normalized_text(tabs.nth(idx).inner_text()))
            except Exception:
                continue
        if label not in texts:
            continue
        for idx in range(tabs.count()):
            tab = tabs.nth(idx)
            try:
                if not tab.is_visible():
                    continue
                if normalized_text(tab.inner_text()) != label:
                    continue
                tab.click(force=True, timeout=10_000)
                page.wait_for_timeout(2200)
                return True
            except Exception:
                continue
    return False


def click_tab_path(page, labels: list[str]) -> bool:
    for label in labels:
        if not click_tab_from_visible_tablists(page, label):
            return False
    return True


def click_button_by_labels(page, labels: list[str]) -> bool:
    clear_blocking_spin(page)
    normalized_labels = {normalized_text(label) for label in labels}
    compact_labels = {label.replace(" ", "") for label in normalized_labels}
    buttons = page.get_by_role("button")
    for idx in range(buttons.count()):
        item = buttons.nth(idx)
        try:
            if not item.is_visible():
                continue
            text = normalized_text(item.inner_text())
            if text in normalized_labels or text.replace(" ", "") in compact_labels:
                item.click(force=True, timeout=8_000)
                page.wait_for_timeout(1500)
                return True
        except Exception:
            continue
    for label in labels:
        locator = page.get_by_role("button", name=label, exact=True)
        for idx in range(locator.count()):
            item = locator.nth(idx)
            try:
                if item.is_visible():
                    item.click(force=True, timeout=8_000)
                    page.wait_for_timeout(1500)
                    return True
            except Exception:
                continue
        alt = page.get_by_text(label, exact=True)
        for idx in range(alt.count()):
            item = alt.nth(idx)
            try:
                if item.is_visible():
                    item.click(force=True, timeout=8_000)
                    page.wait_for_timeout(1500)
                    return True
            except Exception:
                continue
    return False


def body_text(page) -> str:
    return normalized_text(page.locator("body").inner_text())


def wait_for_main_shell(page, timeout_ms: int = 90_000) -> dict:
    deadline = time.time() + (timeout_ms / 1000)
    last_body = ""
    while time.time() < deadline:
        try:
            current_url = page.url
        except Exception:
            current_url = ""
        try:
            last_body = body_text(page)
        except Exception:
            last_body = ""
        if (
            "loading.html" not in current_url
            and "公众号" in last_body
            and "星盘" in last_body
            and "推运盘" in last_body
        ):
            return {
                "status": "PASS",
                "url": current_url,
                "bodyExcerpt": last_body[:400],
            }
        page.wait_for_timeout(1000)
    raise AssertionError(f"主界面未在预期时间内就绪: url={current_url} body={last_body[:240]}")


def get_largest_visible_svg(page) -> dict | None:
    info = page.evaluate(
        """
        () => {
          const items = Array.from(document.querySelectorAll('svg')).map((el, idx) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return {
              idx,
              width: rect.width,
              height: rect.height,
              htmlLength: (el.innerHTML || '').length,
              visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
            };
          }).filter((item) => item.visible);
          if (!items.length) {
            return null;
          }
          items.sort((a, b) => (b.width * b.height) - (a.width * a.height));
          return items[0];
        }
        """
    )
    return info


def get_sanshi_board_metrics(page) -> dict | None:
    return page.evaluate(
        """
        () => {
          const tops = Array.from(document.querySelectorAll('[class*="topBox"]'))
            .filter((node) => {
              const rect = node.getBoundingClientRect();
              const style = window.getComputedStyle(node);
              return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
            });
          const middles = Array.from(document.querySelectorAll('[class*="middleBoard"]'))
            .filter((node) => {
              const rect = node.getBoundingClientRect();
              const style = window.getComputedStyle(node);
              return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
            });
          const bottoms = Array.from(document.querySelectorAll('[class*="bottomBox"]'))
            .filter((node) => {
              const rect = node.getBoundingClientRect();
              const style = window.getComputedStyle(node);
              return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
            });
          if (!middles.length) {
            return null;
          }
          const middle = middles
            .map((node) => ({ node, rect: node.getBoundingClientRect() }))
            .filter((item) => item.rect.width > 0 && item.rect.height > 0)
            .sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height))[0];
          if (!middle) {
            return null;
          }
          const stackRects = [];
          const middleRect = middle.rect;
          stackRects.push(middleRect);
          const collectNearest = (items) => {
            if (!items.length) {
              return;
            }
            const picked = items
              .map((node) => ({ rect: node.getBoundingClientRect() }))
              .sort((a, b) => {
                const da = Math.abs(a.rect.left - middleRect.left) + Math.abs(a.rect.width - middleRect.width);
                const db = Math.abs(b.rect.left - middleRect.left) + Math.abs(b.rect.width - middleRect.width);
                return da - db;
              })[0];
            if (picked) {
              stackRects.push(picked.rect);
            }
          };
          collectNearest(tops);
          collectNearest(bottoms);
          const top = Math.min(...stackRects.map((rect) => rect.top));
          const bottom = Math.max(...stackRects.map((rect) => rect.bottom));
          const left = Math.min(...stackRects.map((rect) => rect.left));
          const right = Math.max(...stackRects.map((rect) => rect.right));
          return {
            width: middleRect.width,
            height: middleRect.height,
            top,
            bottom,
            stackHeight: bottom - top,
            stackWidth: right - left,
            middleTop: middleRect.top,
            middleBottom: middleRect.bottom,
            viewportHeight: window.innerHeight,
            gapToViewportBottom: window.innerHeight - bottom,
          };
        }
        """
    )


def get_dunjia_metrics(page, *, scroll_active: bool = False) -> dict | None:
    return page.evaluate(
        """
        (scrollActive) => {
          const board = document.querySelector('[data-self-check="dunjia-board-visual"]');
          const viewport = document.querySelector('[data-self-check="dunjia-board-viewport"]');
          const panelHost = document.querySelector('[data-self-check="dunjia-right-panel-host"]');
          if (!board || !viewport || !panelHost) {
            return null;
          }
          const activePane = panelHost.querySelector('.ant-tabs-tabpane-active');
          const scrollBody = activePane ? activePane.querySelector('.ant-card-body') : null;
          if (scrollActive && scrollBody) {
            scrollBody.scrollTop = scrollBody.scrollHeight;
          }
          const endMarker = activePane ? activePane.querySelector('[data-self-check^="dunjia-pane-end-"]') : null;
          const boardRect = board.getBoundingClientRect();
          const viewportRect = viewport.getBoundingClientRect();
          const panelRect = panelHost.getBoundingClientRect();
          const scrollRect = scrollBody ? scrollBody.getBoundingClientRect() : null;
          const markerRect = endMarker ? endMarker.getBoundingClientRect() : null;
          return {
            viewportHeight: window.innerHeight,
            boardHeight: boardRect.height,
            boardBottom: boardRect.bottom,
            boardTop: boardRect.top,
            boardViewportHeight: viewportRect.height,
            gapToViewportBottom: window.innerHeight - boardRect.bottom,
            panelBottom: panelRect.bottom,
            panelGapToViewportBottom: window.innerHeight - panelRect.bottom,
            scrollClientHeight: scrollBody ? scrollBody.clientHeight : 0,
            scrollHeight: scrollBody ? scrollBody.scrollHeight : 0,
            scrollTop: scrollBody ? scrollBody.scrollTop : 0,
            scrollTopMax: scrollBody ? Math.max(0, scrollBody.scrollHeight - scrollBody.clientHeight) : 0,
            endMarkerVisible: !!(scrollRect && markerRect && markerRect.bottom <= scrollRect.bottom + 1 && markerRect.top >= scrollRect.top - 1),
          };
        }
        """,
        scroll_active,
    )


def check_jieqi(page) -> dict:
    if not click_tab_from_visible_tablists(page, "节气盘"):
        raise AssertionError("无法切到节气盘")
    click_tab_from_visible_tablists(page, "二十四节气")
    body = ""
    for _ in range(4):
        page.wait_for_timeout(1600)
        body = body_text(page)
        if "undefined" not in body and "黄道" in body and "宫制" in body:
            break
    if "undefined" in body:
        raise AssertionError("节气盘页面仍包含 undefined")
    if "黄道" not in body or "宫制" not in body:
        raise AssertionError("节气盘页面缺少黄道/宫制文案")
    return {
        "status": "PASS",
        "excerpt": body[:300],
    }


def check_primary_direction_chart(page) -> dict:
    if not click_tab_from_visible_tablists(page, "推运盘"):
        raise AssertionError("无法切到推运盘")
    if not click_tab_from_visible_tablists(page, "主限法盘"):
        raise AssertionError("无法切到主限法盘")
    page.wait_for_timeout(3200)
    body = body_text(page)
    if "时间选择" not in body or "主限法设置" not in body:
        page.wait_for_timeout(2200)
        body = body_text(page)
    if "当前主限法盘暂未生成" in body:
        raise AssertionError("主限法盘仍显示暂未生成")
    required = ["时间选择", "主限法设置", "当前主限法年龄", "外圈时间"]
    missing = [item for item in required if item not in body]
    if missing:
        raise AssertionError(f"主限法盘缺少关键文案: {missing}")
    svg_info = get_largest_visible_svg(page)
    if not svg_info:
        raise AssertionError("主限法盘没有可见 SVG")
    if svg_info["htmlLength"] < 5000 or svg_info["width"] < 400 or svg_info["height"] < 400:
        raise AssertionError(f"主限法盘 SVG 过小: {svg_info}")
    return {
        "status": "PASS",
        "svg": svg_info,
        "excerpt": body[:300],
    }


def check_firdaria(page) -> dict:
    if not click_tab_path(page, ["推运盘", "法达星限"]):
        raise AssertionError("无法切到法达星限")
    body = ""
    date_matches: list[str] = []
    for _ in range(5):
        page.wait_for_timeout(1800)
        body = body_text(page)
        date_matches = re.findall(r"\b20\d{2}-\d{2}-\d{2}\b", body)
        if "法达数据加载失败" not in body and "暂无法达数据" not in body and len(date_matches) >= 3:
            break
    if "法达数据加载失败" in body or "暂无法达数据" in body:
        raise AssertionError(f"法达星限仍处于空态或错误态: {body[:240]}")
    required = ["主限", "子限", "日期"]
    missing = [item for item in required if item not in body]
    if missing:
        raise AssertionError(f"法达星限缺少关键表头: {missing}")
    if len(date_matches) < 3:
        raise AssertionError("法达星限日期行数不足")
    return {
        "status": "PASS",
        "excerpt": body[:300],
        "dateMatches": date_matches[:8],
    }


def check_liureng(page) -> dict:
    if not click_tab_path(page, ["易与三式", "六壬"]):
        raise AssertionError("无法切到大六壬")
    page.wait_for_timeout(2200)
    before_body = body_text(page)
    if "点击右侧起课后显示六壬盘" not in before_body:
        raise AssertionError("大六壬首屏未保持起课前空态")
    if not click_button_by_labels(page, ["起课", "起 课"]):
        raise AssertionError("无法触发六壬起课")
    page.wait_for_timeout(3200)
    after_body = body_text(page)
    if "点击右侧起课后显示六壬盘" in after_body:
        raise AssertionError("六壬起课后左盘仍未显示")
    if "param error" in after_body.lower():
        raise AssertionError("六壬页面仍出现 param error")
    svg_info = get_largest_visible_svg(page)
    if not svg_info:
        raise AssertionError("六壬起课后没有可见 SVG")
    if svg_info["width"] < MIN_VISIBLE_SVG_SIZE or svg_info["height"] < MIN_VISIBLE_SVG_SIZE:
        raise AssertionError(f"六壬起课后 SVG 过小: {svg_info}")
    return {
        "status": "PASS",
        "beforeExcerpt": before_body[:220],
        "afterExcerpt": after_body[:300],
        "svg": svg_info,
    }


def check_sanshi(page) -> dict:
    if not click_tab_from_visible_tablists(page, "三式合一"):
        raise AssertionError("无法切到三式合一")
    click_button_by_labels(page, ["起盘", "起 盘"])
    page.wait_for_timeout(2500)
    first = get_sanshi_board_metrics(page)
    if not first:
        raise AssertionError("三式合一未找到盘面容器")
    page.wait_for_timeout(3200)
    second = get_sanshi_board_metrics(page)
    if not second:
        raise AssertionError("三式合一二次测量失败")
    if first["gapToViewportBottom"] < SANSHI_MIN_BOTTOM_GAP or second["gapToViewportBottom"] < SANSHI_MIN_BOTTOM_GAP:
        raise AssertionError(f"三式合一底边过贴近窗口底部: first={first} second={second}")
    drift = abs(second["height"] - first["height"])
    if drift > SANSHI_MAX_HEIGHT_DRIFT:
        raise AssertionError(f"三式合一盘面尺寸发生漂移: first={first} second={second}")
    return {
        "status": "PASS",
        "first": first,
        "second": second,
        "heightDrift": drift,
        "requiredBottomGap": SANSHI_MIN_BOTTOM_GAP,
    }


def check_dunjia(page) -> dict:
    page.set_viewport_size({"width": 1600, "height": 900})
    if not click_tab_path(page, ["易与三式", "遁甲"]):
        raise AssertionError("无法切到遁甲")
    page.wait_for_timeout(2200)
    before_body = body_text(page)
    if "点击右侧“起盘”后显示遁甲盘" not in before_body:
        raise AssertionError("遁甲首屏未保持起盘前空态")
    if not click_button_by_labels(page, ["起盘", "起 盘"]):
        raise AssertionError("无法触发遁甲起盘")

    after_body = ""
    for _ in range(8):
        page.wait_for_timeout(1600)
        after_body = body_text(page)
        if "点击右侧“起盘”后显示遁甲盘" not in after_body and "局数" in after_body and "值符" in after_body:
            break
    if "点击右侧“起盘”后显示遁甲盘" in after_body:
        raise AssertionError("遁甲起盘后主盘仍未显示")
    if "param error" in after_body.lower():
        raise AssertionError("遁甲页面仍出现 param error")

    first = get_dunjia_metrics(page)
    if not first:
        raise AssertionError("遁甲首次测量失败")
    page.wait_for_timeout(2600)
    second = get_dunjia_metrics(page)
    if not second:
        raise AssertionError("遁甲二次测量失败")
    if first["gapToViewportBottom"] < DUNJIA_MIN_BOTTOM_GAP or second["gapToViewportBottom"] < DUNJIA_MIN_BOTTOM_GAP:
        raise AssertionError(f"遁甲主盘底边过贴近窗口底部: first={first} second={second}")
    if first["panelGapToViewportBottom"] < 0 or second["panelGapToViewportBottom"] < 0:
        raise AssertionError(f"遁甲右栏仍超出窗口底部: first={first} second={second}")
    drift = abs(second["boardHeight"] - first["boardHeight"])
    if drift > DUNJIA_MAX_HEIGHT_DRIFT:
        raise AssertionError(f"遁甲主盘高度发生漂移: first={first} second={second}")

    if not click_tab_from_visible_tablists(page, "格局"):
        raise AssertionError("无法切到遁甲格局页签")
    page.wait_for_timeout(1200)
    scrolled = get_dunjia_metrics(page, scroll_active=True)
    page.wait_for_timeout(300)
    after_scroll = get_dunjia_metrics(page)
    if not scrolled or not after_scroll:
        raise AssertionError("遁甲右栏滚动测量失败")
    if after_scroll["scrollTopMax"] <= 0:
        raise AssertionError(f"遁甲右栏未形成可滚动宿主: {after_scroll}")
    if not after_scroll["endMarkerVisible"]:
        raise AssertionError(f"遁甲右栏滚动到底后底部内容仍不可见: {after_scroll}")

    return {
        "status": "PASS",
        "beforeExcerpt": before_body[:220],
        "afterExcerpt": after_body[:320],
        "first": first,
        "second": second,
        "afterScroll": after_scroll,
        "heightDrift": drift,
        "requiredBottomGap": DUNJIA_MIN_BOTTOM_GAP,
    }


MODULE_CHECKS = {
    "jieqichart": check_jieqi,
    "primarydirchart": check_primary_direction_chart,
    "firdaria": check_firdaria,
    "liureng": check_liureng,
    "sanshiunited": check_sanshi,
    "dunjia": check_dunjia,
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.environ.get("HOROSA_WEB_ROOT", "http://127.0.0.1:8000/index.html?srv=http%3A%2F%2F127.0.0.1%3A9999"))
    parser.add_argument("--case-file", default=os.environ.get("HOROSA_SELF_CHECK_CASE_FILE", ""))
    parser.add_argument("--json-out", default=os.environ.get("HOROSA_SELF_CHECK_UI_JSON", str(RUNTIME_DIR / "ui-check.json")))
    parser.add_argument("--md-out", default=os.environ.get("HOROSA_SELF_CHECK_UI_MD", str(RUNTIME_DIR / "ui-check.md")))
    args = parser.parse_args()

    cases = [case for case in read_case_payload(args.case_file) if f"{case.get('type', '')}".strip() == "ui-like-case"]
    result = {
        "type": "ui-check",
        "baseUrl": args.base_url,
        "generatedAt": int(time.time()),
        "cases": [],
        "pageErrors": [],
        "consoleErrors": [],
    }
    resolved_base_url = with_cache_buster(args.base_url, result["generatedAt"])
    result["resolvedBaseUrl"] = resolved_base_url

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1720, "height": 1280})
        page.on("pageerror", lambda exc: result["pageErrors"].append(str(exc)))
        page.on("console", lambda msg: result["consoleErrors"].append(msg.text) if msg.type == "error" else None)
        for case in cases:
            module = f"{case.get('input', {}).get('module', '')}".strip()
            checker = MODULE_CHECKS.get(module)
            case_result = {
                "type": case.get("type"),
                "label": case.get("label", module or "unnamed-ui-case"),
                "module": module,
                "pass": False,
                "status": "FAIL",
            }
            if not checker:
                case_result["error"] = f"unsupported module: {module}"
                result["cases"].append(case_result)
                continue
            try:
                page.goto(resolved_base_url, wait_until="domcontentloaded", timeout=120_000)
                wait_for_main_shell(page)
                clear_blocking_spin(page)
                output = checker(page)
                case_result["pass"] = True
                case_result["status"] = "PASS"
                case_result["output"] = output
            except Exception as exc:
                case_result["error"] = str(exc)
            result["cases"].append(case_result)

        page.close()
        browser.close()

    result["passed"] = sum(1 for case in result["cases"] if case["pass"])
    result["failed"] = sum(1 for case in result["cases"] if not case["pass"])
    ensure_parent(Path(args.json_out))
    Path(args.json_out).write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    md_lines = ["# Horosa UI Self Check", "", f"Overall: {'PASS' if result['failed'] == 0 else 'FAIL'}", f"Passed: {result['passed']}", f"Failed: {result['failed']}", ""]
    for idx, case in enumerate(result["cases"], start=1):
        md_lines.append(f"## {idx}. {case['label']}")
        md_lines.append(f"Status: {case['status']}")
        if case.get("error"):
            md_lines.append(f"Error: {case['error']}")
        if case.get("output"):
            md_lines.append("")
            md_lines.append("```json")
            md_lines.append(json.dumps(case["output"], ensure_ascii=False, indent=2))
            md_lines.append("```")
        md_lines.append("")
    ensure_parent(Path(args.md_out))
    Path(args.md_out).write_text("\n".join(md_lines) + "\n", encoding="utf-8")

    if result["failed"] > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
