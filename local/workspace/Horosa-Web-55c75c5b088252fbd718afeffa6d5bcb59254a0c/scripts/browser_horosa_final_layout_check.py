#!/usr/bin/env python3
"""Browser-level final desktop layout check for the latest Horosa regressions."""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

try:
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

JIEQI_ENTRY_LABELS = [
    "二十四节气",
    "春分星盘",
    "春分宿盘",
    "春分3D盘",
    "夏至星盘",
    "夏至宿盘",
    "夏至3D盘",
    "秋分星盘",
    "秋分宿盘",
    "秋分3D盘",
    "冬至星盘",
    "冬至宿盘",
    "冬至3D盘",
]


def click_visible_text(page, label: str, *, exact: bool = True, timeout_ms: int = 12_000) -> bool:
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
            page.wait_for_timeout(1_000)
            return True
        except Exception:
            continue
    return False


def read_label_box(page, labels: list[str]) -> dict | None:
    return page.evaluate(
        """
        (labels) => {
          const isVisible = (el) => {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
          };
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
          const hits = [];
          while (walker.nextNode()) {
            const el = walker.currentNode;
            const text = (el.innerText || '').trim();
            if (!text || !labels.includes(text) || !isVisible(el)) {
              continue;
            }
            const rect = el.getBoundingClientRect();
            hits.push({
              text,
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              right: rect.right,
              bottom: rect.bottom,
            });
          }
          hits.sort((a, b) => (b.x - a.x) || (a.y - b.y));
          return hits[0] || null;
        }
        """,
        labels,
    )


def collect_metrics(page) -> dict:
    return page.evaluate(
        r"""
        () => {
          const isVisible = (el) => {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
          };
          const toBox = (el) => {
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            return {
              x: rect.x,
              y: rect.y,
              right: rect.right,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height,
            };
          };
          const svgs = Array.from(document.querySelectorAll('svg')).filter(isVisible);
          svgs.sort((a, b) => {
            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();
            return (rb.width * rb.height) - (ra.width * ra.height);
          });
          const chart = toBox(svgs[0] || null);
          const footer = toBox(document.getElementById('globalFooter'));
          const navOps = document.querySelector('.mainRootTabs .ant-tabs-nav-operations');
          const footerEl = document.getElementById('globalFooter');
          return {
            chart,
            footer,
            footerGap: chart && footer ? footer.y - chart.bottom : null,
            footerHasImg: footerEl ? footerEl.querySelectorAll('img').length > 0 : null,
            footerHas996: !!(footerEl && /996\.icu/i.test(footerEl.innerText || '')),
            bodyHas996: /996\.icu/i.test(document.body.innerText || ''),
            navOpsDisplay: navOps ? window.getComputedStyle(navOps).display : null,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
          };
        }
        """
    )


def ensure(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def save_screenshot(page, name: str) -> None:
    page.screenshot(path=str(RUNTIME_DIR / name), full_page=True)


def main() -> None:
    web_port = os.environ.get("HOROSA_WEB_PORT", "8000")
    server_root = os.environ.get("HOROSA_SERVER_ROOT", f"http://127.0.0.1:{os.environ.get('HOROSA_SERVER_PORT', '9999')}")
    base_url = os.environ.get(
        "HOROSA_WEB_ROOT",
        f"http://127.0.0.1:{web_port}/index.html?srv={server_root.replace(':', '%3A').replace('/', '%2F')}&v={int(time.time())}",
    )

    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    json_path = Path(os.environ.get("HOROSA_FINAL_LAYOUT_CHECK_JSON", str(RUNTIME_DIR / "final_layout_master_check.json")))

    result: dict = {
        "status": "ok",
        "base_url": base_url,
        "server_root": server_root,
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1720, "height": 1184})
        page.goto(base_url, wait_until="domcontentloaded", timeout=120_000)
        page.wait_for_timeout(5_000)

        result["global_shell"] = collect_metrics(page)
        ensure(result["global_shell"]["navOpsDisplay"] == "none", "left root tabs overflow menu is visible again")
        ensure(not result["global_shell"]["footerHasImg"], "footer filing image returned")
        ensure(not result["global_shell"]["footerHas996"], "footer 996 badge returned")
        ensure(not result["global_shell"]["bodyHas996"], "page body still contains 996 badge text")
        save_screenshot(page, "mastercheck_global_shell.png")

        ensure(click_visible_text(page, "节气盘"), "cannot open 节气盘")
        page.wait_for_timeout(1_500)
        result["jieqi_entries"] = {label: bool(read_label_box(page, [label])) for label in JIEQI_ENTRY_LABELS}
        missing_jieqi_entries = [label for label, present in result["jieqi_entries"].items() if not present]
        ensure(not missing_jieqi_entries, f"missing jieqi entries: {missing_jieqi_entries}")
        save_screenshot(page, "mastercheck_jieqi_entries.png")

        ensure(click_visible_text(page, "推运盘"), "cannot open 推运盘")
        ensure(click_visible_text(page, "太阳弧"), "cannot open 太阳弧")
        page.wait_for_timeout(1_800)
        solar_std = collect_metrics(page)
        solar_std["rightMarker"] = read_label_box(page, ["主/界限法", "太阳弧", "相位", "行运☉"])
        ensure(solar_std["chart"] is not None, "solar arc chart missing in standard viewport")
        ensure(solar_std["rightMarker"] is not None, "solar arc right-side marker missing in standard viewport")
        ensure(solar_std["chart"]["right"] < solar_std["rightMarker"]["x"], "solar arc chart overlaps right column in standard viewport")
        ensure(solar_std["footerGap"] is not None and solar_std["footerGap"] >= 0, "solar arc chart overflows footer in standard viewport")
        save_screenshot(page, "mastercheck_solararc_std.png")
        page.set_viewport_size({"width": 1366, "height": 900})
        page.wait_for_timeout(1_800)
        solar_compact = collect_metrics(page)
        solar_compact["rightMarker"] = read_label_box(page, ["主/界限法", "太阳弧", "相位", "行运☉"])
        ensure(solar_compact["chart"] is not None, "solar arc chart missing in compact viewport")
        ensure(solar_compact["rightMarker"] is not None, "solar arc right-side marker missing in compact viewport")
        ensure(solar_compact["chart"]["right"] < solar_compact["rightMarker"]["x"], "solar arc chart overlaps right column in compact viewport")
        ensure(solar_compact["footerGap"] is not None and solar_compact["footerGap"] >= 0, "solar arc chart overflows footer in compact viewport")
        result["solararc"] = {"std": solar_std, "compact": solar_compact}
        save_screenshot(page, "mastercheck_solararc_compact.png")

        ensure(click_visible_text(page, "易与三式"), "cannot open 易与三式")
        ensure(click_visible_text(page, "宿盘"), "cannot open 宿盘")
        page.wait_for_timeout(1_800)
        suzhan = collect_metrics(page)
        suzhan["rightMarker"] = read_label_box(page, ["易卦", "六壬", "金口诀", "遁甲", "太乙", "统摄法"])
        ensure(suzhan["chart"] is not None, "suzhan chart missing")
        ensure(suzhan["footerGap"] is not None and suzhan["footerGap"] >= 30, "suzhan chart is too close to footer")
        ensure(suzhan["rightMarker"] is not None and suzhan["chart"]["right"] < suzhan["rightMarker"]["x"], "suzhan chart overlaps right column")
        result["suzhan"] = suzhan
        save_screenshot(page, "mastercheck_suzhan_compact.png")

        ensure(click_visible_text(page, "七政四余"), "cannot open 七政四余")
        page.wait_for_timeout(1_800)
        guolao = collect_metrics(page)
        ensure(guolao["chart"] is not None, "guolao chart missing")
        ensure(guolao["footerGap"] is not None and guolao["footerGap"] >= 20, "guolao chart is too close to footer")
        result["guolao"] = guolao
        save_screenshot(page, "mastercheck_guolao_compact.png")

        page.set_viewport_size({"width": 1720, "height": 1184})
        page.wait_for_timeout(1_000)
        ensure(click_visible_text(page, "三式合一"), "cannot open 三式合一")
        if not click_visible_text(page, "起 盘"):
            ensure(click_visible_text(page, "起盘", exact=False), "cannot click 三式合一起盘")
        page.wait_for_timeout(2_800)
        sanshi_std = collect_metrics(page)
        sanshi_std_body = " ".join(page.locator("body").inner_text().split())
        sanshi_std["hasDirectTime"] = "直接时间" in sanshi_std_body
        sanshi_std["hasTrueSolar"] = "真太阳时" in sanshi_std_body
        ensure(sanshi_std["hasDirectTime"], "sanshi direct time missing in standard viewport")
        ensure(sanshi_std["hasTrueSolar"], "sanshi true solar time missing in standard viewport")
        ensure(sanshi_std["footerGap"] is not None and sanshi_std["footerGap"] >= 40, "sanshi chart is too close to footer in standard viewport")
        save_screenshot(page, "mastercheck_sanshi_std.png")
        page.set_viewport_size({"width": 1366, "height": 900})
        page.wait_for_timeout(1_800)
        sanshi_compact = collect_metrics(page)
        sanshi_compact_body = " ".join(page.locator("body").inner_text().split())
        sanshi_compact["hasDirectTime"] = "直接时间" in sanshi_compact_body
        sanshi_compact["hasTrueSolar"] = "真太阳时" in sanshi_compact_body
        ensure(sanshi_compact["hasDirectTime"], "sanshi direct time missing in compact viewport")
        ensure(sanshi_compact["hasTrueSolar"], "sanshi true solar time missing in compact viewport")
        ensure(sanshi_compact["footerGap"] is not None and sanshi_compact["footerGap"] >= 40, "sanshi chart is too close to footer in compact viewport")
        result["sanshi"] = {"std": sanshi_std, "compact": sanshi_compact}
        save_screenshot(page, "mastercheck_sanshi_compact.png")

        browser.close()

    json_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
