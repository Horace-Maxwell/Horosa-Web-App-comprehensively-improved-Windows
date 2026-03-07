#!/usr/bin/env python3
"""Deep browser-level Horosa UI audit for modules, exports, and settings."""

from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path


if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except OSError:
        pass

try:
    from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
    from playwright.sync_api import sync_playwright
except Exception as exc:  # pragma: no cover - optional dependency path
    print(json.dumps({"status": "skipped", "reason": f"playwright unavailable: {exc}"}, ensure_ascii=False))
    raise SystemExit(0)


ROOT = Path(__file__).resolve().parents[1]
RUNTIME_DIR = ROOT / "runtime"


IGNORED_REMOTE_URL_SNIPPETS = (
    "jsapi-data",
    "amap.com/tile/",
    "chart3d.horosa.com/gltf/",
)

EXPECTED_AI_TECHNIQUES = [
    "星盘",
    "印度律盘",
    "希腊/星体地图",
    "关系盘",
    "推运盘-主/界限法",
    "推运盘-黄道星释",
    "推运盘-法达星限",
    "推运盘-小限法",
    "推运盘-太阳弧",
    "推运盘-太阳返照",
    "推运盘-月亮返照",
    "推运盘-流年法",
    "八字",
    "紫微斗数",
    "宿占",
    "易卦",
    "统摄法",
    "六壬",
    "金口诀",
    "奇门遁甲",
    "三式合一",
    "太乙",
    "七政四余",
    "量化盘",
    "节气盘",
    "节气盘-通用参数",
    "节气盘-春分",
    "节气盘-夏至",
    "节气盘-秋分",
    "节气盘-冬至",
    "西洋游戏",
    "风水",
    "其他页面",
]

MODULE_SPECS = [
    {
        "module": "星盘",
        "clicks": [
            {"label": "信息", "export_header": "星盘"},
            {"label": "相位", "export_header": "星盘"},
            {"label": "行星", "export_header": "星盘"},
            {"label": "希腊点", "export_header": "星盘"},
            {"label": "可能性", "export_header": "星盘"},
        ],
    },
    {
        "module": "三维盘",
        "clicks": [
            {"label": "信息", "export_header": "星盘"},
            {"label": "相位", "export_header": "星盘"},
            {"label": "行星", "export_header": "星盘"},
            {"label": "希腊点", "export_header": "星盘"},
        ],
        "checkbox_toggles": ["隐藏地球", "有云地球"],
    },
    {
        "module": "推运盘",
        "clicks": [
            {"label": "主/界限法", "export_header": "推运盘-主/界限法", "pd_check": True},
            {"label": "黄道星释", "export_header": "推运盘-黄道星释"},
            {"label": "法达星限", "export_header": "推运盘-法达星限"},
            {"label": "小限法", "export_header": "推运盘-小限法"},
            {"label": "太阳弧", "export_header": "推运盘-太阳弧"},
            {"label": "太阳返照", "export_header": "推运盘-太阳返照"},
            {"label": "月亮返照", "export_header": "推运盘-月亮返照"},
            {"label": "流年法", "export_header": "推运盘-流年法"},
            {"label": "天象盘"},
            {"label": "原命盘"},
            {"label": "对比盘"},
        ],
    },
    {
        "module": "量化盘",
        "clicks": [{"label": "行星中点", "export_header": "量化盘", "allow_click_miss": True}],
        "module_export_header": "量化盘",
    },
    {
        "module": "关系盘",
        "clicks": [
            {"label": "比较盘"},
            {"label": "组合盘"},
            {"label": "影响盘"},
            {"label": "时空中点盘"},
            {"label": "马克斯盘"},
        ],
        "module_export_header": "关系盘",
        "allow_empty_export": True,
    },
    {
        "module": "节气盘",
        "clicks": [{"label": "二十四节气", "export_header": "节气盘", "post_wait_ms": 4500}],
    },
    {
        "module": "星体地图",
        "clicks": [{"label": "行星地图", "export_header": "希腊/星体地图"}],
    },
    {
        "module": "七政四余",
        "clicks": [],
        "module_export_header": "七政四余",
    },
    {
        "module": "希腊星术",
        "clicks": [
            {"label": "十三分盘", "export_header": "希腊/星体地图"},
            {"label": "信息"},
            {"label": "相位"},
            {"label": "行星"},
            {"label": "希腊点"},
            {"label": "可能性"},
        ],
    },
    {
        "module": "印度律盘",
        "clicks": [
            {"label": "命盘", "export_header": "印度律盘"},
            {"label": "2律盘"},
            {"label": "3律盘"},
            {"label": "4律盘"},
            {"label": "7律盘"},
            {"label": "9律盘"},
            {"label": "10律盘"},
            {"label": "12律盘"},
            {"label": "16律盘"},
            {"label": "20律盘"},
            {"label": "24律盘"},
            {"label": "27律盘"},
            {"label": "40律盘"},
            {"label": "45律盘"},
            {"label": "信息"},
            {"label": "相位"},
            {"label": "行星"},
            {"label": "希腊点"},
            {"label": "可能性"},
        ],
    },
    {
        "module": "八字紫微",
        "clicks": [
            {"label": "八字", "export_header": "八字"},
            {"label": "紫微斗数", "export_header": "紫微斗数"},
            {"label": "八卦类象"},
            {"label": "十二串宫"},
            {"label": "八字规则"},
        ],
    },
    {
        "module": "易与三式",
        "clicks": [
            {"label": "宿盘", "export_header": "宿占"},
            {"label": "易卦", "export_header": "易卦", "activate_labels": ["时间起卦"], "post_wait_ms": 1500},
            {"label": "六壬", "export_header": "大六壬", "activate_labels": ["起 课"], "post_wait_ms": 1500},
            {"label": "金口诀", "export_header": "金口诀"},
            {"label": "遁甲", "export_header": "奇门遁甲", "activate_labels": ["起 盘"], "post_wait_ms": 1500},
            {"label": "太乙", "export_header": "太乙"},
            {"label": "统摄法", "export_header": "统摄法"},
        ],
    },
    {
        "module": "万年历",
        "clicks": [],
        "allow_empty_export": True,
    },
    {
        "module": "西洋游戏",
        "clicks": [
            {"label": "星盘骰子", "export_header": "西洋游戏", "allow_click_miss": True, "activate_labels": ["见证奇迹"], "post_wait_ms": 1200},
            {"label": "骰子盘", "export_header": "西洋游戏"},
            {"label": "天象盘", "export_header": "西洋游戏"},
        ],
    },
    {
        "module": "风水",
        "clicks": [],
        "module_export_header": "风水",
    },
    {
        "module": "三式合一",
        "clicks": [
            {"label": "概览", "export_header": "三式合一"},
            {"label": "太乙"},
            {"label": "神煞"},
            {"label": "六壬"},
            {"label": "八宫"},
        ],
    },
]


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


def xpath_literal(value: str) -> str:
    if "'" not in value:
        return f"'{value}'"
    if '"' not in value:
        return f'"{value}"'
    parts = value.split("'")
    return "concat(" + ", \"'\", ".join(f"'{part}'" for part in parts) + ")"


def checkbox_state(page, label: str) -> bool | None:
    locator = page.get_by_label(label, exact=True)
    count = locator.count()
    for idx in range(count):
        item = locator.nth(idx)
        try:
            if item.is_visible():
                return bool(item.is_checked())
        except Exception:
            continue
    fallback = page.locator(f"xpath=//div[span[normalize-space(.)={xpath_literal(label)}]]//input[@type='checkbox']")
    for idx in range(fallback.count()):
        item = fallback.nth(idx)
        try:
            if item.is_visible():
                return bool(item.is_checked())
        except Exception:
            continue
    return None


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
    page.wait_for_timeout(700)


def click_compute_and_wait_chart(page, *, previous_row: str = "") -> str:
    button = page.get_by_role("button", name="\u91cd\u65b0\u8ba1\u7b97")
    if button.count() == 0 or not button.first.is_visible():
        button = page.get_by_role("button", name="\u8ba1\u7b97")

    last_timeout = None
    last_row = first_table_row_text(page)
    for attempt in range(3):
        try:
            with page.expect_response(lambda resp: "/chart" in resp.url and resp.request.method == "POST" and resp.status == 200, timeout=45_000):
                button.first.click(force=True)
        except PlaywrightTimeoutError as exc:
            last_timeout = exc
            try:
                button.first.click(force=True)
            except Exception:
                pass
        page.wait_for_timeout(1800 + attempt * 700)
        last_row = first_table_row_text(page)
        if last_row and previous_row and last_row != previous_row:
            return last_row
        if last_row and not previous_row:
            return last_row
        page.wait_for_timeout(900)

    if last_row:
        return last_row
    if last_timeout is not None:
        raise last_timeout
    raise AssertionError("\u70b9\u51fb\u8ba1\u7b97\u540e\u4e3b\u9650\u6cd5\u8868\u683c\u4ecd\u4e3a\u7a7a")


def ensure_pd_recalc(page, result: dict) -> None:
    visible_indices = visible_select_indices(page)
    if len(visible_indices) < 3:
        raise AssertionError(f"主限法页可见 select 数不足，found={visible_indices}")

    method_select_index = visible_indices[1]
    before = first_table_row_text(page)

    select_dropdown_value(page, method_select_index, "Horosa原方法")
    legacy = click_compute_and_wait_chart(page, previous_row=before)

    select_dropdown_value(page, method_select_index, "AstroAPP-Alchabitius")
    astroapp = click_compute_and_wait_chart(page, previous_row=legacy)

    if not legacy or not astroapp:
        raise AssertionError("主限法表格为空")
    if legacy == astroapp:
        raise AssertionError("切换 Horosa原方法 / AstroAPP-Alchabitius 后主限法首行未变化")

    result["primary_direction_switch"] = {
        "before": before,
        "legacy_first_row": legacy,
        "astroapp_first_row": astroapp,
    }


def get_body_excerpt(page, limit: int = 480) -> str:
    try:
        body_txt = page.locator("body").inner_text()
    except Exception:
        return ""
    return body_txt[:limit]


def extract_export_header(text: str) -> str:
    match = re.search(r"技术[:：]\s*(.+)", text)
    if match:
        return match.group(1).strip()
    return ""


def extract_export_content(text: str) -> str:
    lines = text.splitlines()
    cleaned: list[str] = []
    skip_next_blank = False
    for line in lines:
        if re.match(r"^\s*技术[:：]\s*", line):
            skip_next_blank = True
            continue
        if skip_next_blank and not line.strip():
            continue
        skip_next_blank = False
        cleaned.append(line)
    return "\n".join(cleaned).strip()


def clear_clipboard(page) -> None:
    try:
        page.evaluate(
            """async () => {
                window.__horosaCopiedText = '';
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText('');
                }
            }"""
        )
    except Exception:
        page.evaluate("window.__horosaCopiedText = '';")


def read_clipboard(page) -> str:
    try:
        return page.evaluate(
            """async () => {
                if (navigator.clipboard && navigator.clipboard.readText) {
                    try {
                        const txt = await navigator.clipboard.readText();
                        if (txt) {
                            return txt;
                        }
                    } catch (e) {}
                }
                return window.__horosaCopiedText || '';
            }"""
        )
    except Exception:
        return ""


def read_toast_message(page) -> str:
    notices = page.locator(".ant-message-notice")
    if notices.count() == 0:
        return ""
    try:
        return " ".join(notices.last.inner_text().split())
    except Exception:
        return ""


def click_ai_export_copy(page) -> dict:
    last_result = None
    for attempt in range(3):
        clear_clipboard(page)
        if not click_visible_text(page, "AI\u5bfc\u51fa"):
            raise AssertionError("AI\u5bfc\u51fa \u6309\u94ae\u4e0d\u53ef\u70b9\u51fb")
        if not click_visible_text(page, "\u590d\u5236AI\u7eaf\u6587\u5b57"):
            raise AssertionError("AI\u5bfc\u51fa\u83dc\u5355\u4e2d\u7684 \u590d\u5236AI\u7eaf\u6587\u5b57 \u4e0d\u53ef\u70b9\u51fb")
        page.wait_for_timeout(900 + attempt * 400)
        toast = read_toast_message(page)
        clip_text = ""
        for _ in range(12 + attempt * 6):
            latest_clip = read_clipboard(page)
            if latest_clip:
                clip_text = latest_clip
                break
            latest_toast = read_toast_message(page)
            if latest_toast:
                toast = latest_toast
            if "\u5f53\u524d\u9875\u9762\u6ca1\u6709\u53ef\u5bfc\u51fa\u6587\u672c" in toast:
                break
            page.wait_for_timeout(250)
        content = extract_export_content(clip_text)
        last_result = {
            "toast": toast,
            "header": extract_export_header(clip_text),
            "clipboard_length": len(clip_text),
            "content_length": len(content),
            "content_excerpt": content[:260],
        }
        if content or "\u5f53\u524d\u9875\u9762\u6ca1\u6709\u53ef\u5bfc\u51fa\u6587\u672c" in toast or "AI\u7eaf\u6587\u5b57\u5df2\u590d\u5236" in toast:
            return last_result
        page.wait_for_timeout(800)
    return last_result or {
        "toast": "",
        "header": "",
        "clipboard_length": 0,
        "content_length": 0,
        "content_excerpt": "",
    }


def expect_export(export_result: dict, expected_header: str | None, *, allow_empty: bool = False) -> None:
    toast = export_result.get("toast", "")
    content_length = export_result.get("content_length", 0)
    if allow_empty and ("当前页面没有可导出文本" in toast or content_length == 0):
        return
    if content_length <= 0 and "AI纯文字已复制" not in toast:
        raise AssertionError(f"AI导出 toast 异常: {toast}")
    if content_length <= 0:
        raise AssertionError("AI导出内容为空")
    if expected_header:
        actual_header = export_result.get("header", "")
        if actual_header != expected_header:
            raise AssertionError(f"AI导出技法头不匹配，expected={expected_header}, actual={actual_header}")


def open_ai_settings(page) -> None:
    if not click_visible_text(page, "AI导出设置"):
        raise AssertionError("AI导出设置 按钮不可点击")
    page.wait_for_timeout(800)
    if page.locator(".ant-modal:visible").count() == 0:
        raise AssertionError("AI导出设置弹窗未显示")


def close_modal(page) -> None:
    if page.locator(".ant-modal:visible").count() == 0:
        return
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    if page.locator(".ant-modal:visible").count():
        close_buttons = page.locator(".ant-modal:visible .ant-modal-close")
        if close_buttons.count():
            close_buttons.first.click(force=True)
            page.wait_for_timeout(300)


def save_ai_settings(page) -> None:
    modal = page.locator(".ant-modal:visible")
    ok_btn = modal.get_by_role("button", name="确 定")
    if ok_btn.count() == 0:
        ok_btn = modal.get_by_role("button", name="确定")
    ok_btn.first.click(force=True)
    page.wait_for_timeout(700)


def select_ai_setting_technique(page, label: str) -> None:
    modal = page.locator(".ant-modal:visible")
    selectors = modal.locator(".ant-select-selector")
    if selectors.count() == 0:
        raise AssertionError("AI导出设置技法下拉不存在")
    dropdown = None
    for _ in range(3):
        selectors.first.click(force=True)
        page.wait_for_timeout(300)
        visible_dropdowns = page.locator(".ant-select-dropdown:visible")
        if visible_dropdowns.count():
            dropdown = visible_dropdowns.last
            break
        try:
            selectors.first.press("ArrowDown")
        except Exception:
            pass
        page.wait_for_timeout(300)
        visible_dropdowns = page.locator(".ant-select-dropdown:visible")
        if visible_dropdowns.count():
            dropdown = visible_dropdowns.last
            break
    if dropdown is None:
        raise AssertionError(f"AI导出设置技法下拉未展开: {label}")

    holder = dropdown.locator(".rc-virtual-list-holder")
    option = None
    for attempt in range(24):
        current = dropdown.locator(f'.ant-select-item-option[title="{label}"]')
        if current.count():
            option = current.first
            break
        if holder.count() == 0:
            break
        if attempt == 0:
            holder.first.evaluate("(el) => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll', { bubbles: true })); }")
        else:
            holder.first.evaluate("(el) => { el.scrollTop += 220; el.dispatchEvent(new Event('scroll', { bubbles: true })); }")
        page.wait_for_timeout(180)
    if option is None:
        raise AssertionError(f"AI导出设置中未找到技法选项: {label}")

    option.scroll_into_view_if_needed(timeout=10_000)
    option.click(force=True, timeout=10_000)
    page.wait_for_timeout(700)


def ai_settings_state(page) -> dict:
    modal = page.locator(".ant-modal:visible")
    options = modal.locator(".ant-checkbox-wrapper")
    visible_options = []
    for idx in range(options.count()):
        try:
            if options.nth(idx).is_visible():
                visible_options.append(" ".join(options.nth(idx).inner_text().split()))
        except Exception:
            continue
    placeholder = ""
    placeholder_locator = modal.get_by_text("当前技法暂未检测到可选分段", exact=False)
    if placeholder_locator.count():
        try:
            placeholder = " ".join(placeholder_locator.first.inner_text().split())
        except Exception:
            placeholder = "当前技法暂未检测到可选分段"
    return {
        "options_count": len(visible_options),
        "options_preview": visible_options[:12],
        "supports_planet_meta": modal.get_by_text("显示星曜宫位", exact=True).count() > 0,
        "supports_annotation": modal.get_by_text("占星注释", exact=True).count() > 0,
        "placeholder": placeholder,
    }


def toggle_checkbox_in_modal(page, label: str, checked: bool) -> None:
    modal = page.locator(".ant-modal:visible")
    target = modal.get_by_label(label, exact=True)
    if target.count() == 0:
        raise AssertionError(f"AI导出设置中缺少复选框: {label}")
    box = target.first
    if bool(box.is_checked()) != checked:
        box.click(force=True)
        page.wait_for_timeout(250)


def toggle_visible_checkbox(page, label: str) -> dict:
    before = checkbox_state(page, label)
    if before is None:
        raise AssertionError(f"未找到可见复选框: {label}")
    target = page.get_by_label(label, exact=True)
    if target.count() == 0:
        target = page.locator(f"xpath=//div[span[normalize-space(.)={xpath_literal(label)}]]//input[@type='checkbox']")
    item = target.first
    try:
        item.click(force=True)
    except Exception:
        pass
    page.wait_for_timeout(500)
    after = checkbox_state(page, label)
    if after is None or before == after:
        item.evaluate(
            """
            (el) => {
              el.checked = !el.checked;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
            """
        )
        page.wait_for_timeout(500)
        after = checkbox_state(page, label)
    if after is None or before == after:
        raise AssertionError(f"复选框切换后状态未变化: {label}")

    try:
        item.click(force=True)
    except Exception:
        pass
    page.wait_for_timeout(500)
    restored = checkbox_state(page, label)
    if restored is None or restored != before:
        item.evaluate(
            """
            (el) => {
              el.checked = !el.checked;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }
            """
        )
        page.wait_for_timeout(500)
        restored = checkbox_state(page, label)
    return {"before": before, "after": after, "restored": restored}


def ensure_star_ai_settings_effect(page, result: dict) -> None:
    if not click_visible_text(page, "星盘"):
        raise AssertionError("无法切回星盘进行 AI 设置检查")
    page.wait_for_timeout(900)
    if not click_visible_text(page, "信息"):
        raise AssertionError("星盘 信息 tab 无法点击")
    page.wait_for_timeout(900)

    open_ai_settings(page)
    select_ai_setting_technique(page, "星盘")
    modal_excerpt = page.locator(".ant-modal:visible").inner_text()[:260]
    toggle_checkbox_in_modal(page, "相位", False)
    save_ai_settings(page)

    without_aspect = click_ai_export_copy(page)
    expect_export(without_aspect, "星盘")
    content_without_aspect = extract_export_content(read_clipboard(page))
    if "[相位]" in content_without_aspect:
        raise AssertionError("取消 星盘/相位 导出后，AI导出内容仍包含 [相位]")

    open_ai_settings(page)
    select_ai_setting_technique(page, "星盘")
    restore_btn = page.locator(".ant-modal:visible").get_by_role("button", name="恢复默认")
    restore_btn.first.click(force=True)
    page.wait_for_timeout(400)
    save_ai_settings(page)

    restored = click_ai_export_copy(page)
    expect_export(restored, "星盘")
    content_restored = extract_export_content(read_clipboard(page))
    if "[相位]" not in content_restored:
        raise AssertionError("恢复默认后，星盘 AI导出未恢复 [相位] 段")

    result["ai_export_settings_effect"] = {
        "modal_excerpt": modal_excerpt,
        "toggle_toast": without_aspect.get("toast", ""),
        "restore_toast": restored.get("toast", ""),
        "toggle_aspects_removed": "[相位]" not in content_without_aspect,
        "restore_default_contains_aspects": "[相位]" in content_restored,
    }


def validate_primary_direction_export(page, result: dict) -> None:
    export_result = click_ai_export_copy(page)
    expect_export(export_result, "推运盘-主/界限法")
    clip_text = read_clipboard(page)
    checks = {
        "toast": export_result.get("toast", ""),
        "header": export_result.get("header", ""),
        "has_method": "推运方法：AstroAPP-Alchabitius" in clip_text,
        "has_time_key": "度数换算：Ptolemy" in clip_text,
        "has_arc_table": "| Arc | 迫星 | 应星 | 日期 |" in clip_text,
    }
    if not all(value for key, value in checks.items() if key.startswith("has_")):
        raise AssertionError(f"主限法 AI导出缺少关键字段: {checks}")
    result["primary_direction_export"] = checks


def main() -> None:
    web_port = os.environ.get("HOROSA_WEB_PORT", "8000")
    server_root = os.environ.get("HOROSA_SERVER_ROOT", f"http://127.0.0.1:{os.environ.get('HOROSA_SERVER_PORT', '9999')}")
    base_url = os.environ.get(
        "HOROSA_WEB_ROOT",
        f"http://127.0.0.1:{web_port}/index.html?srv={server_root.replace(':', '%3A').replace('/', '%2F')}&v={int(time.time())}",
    )

    screenshot_path = Path(os.environ.get("HOROSA_UI_DEEP_SCREENSHOT", str(RUNTIME_DIR / "browser_horosa_ui_deep_check.png")))
    json_path = Path(os.environ.get("HOROSA_UI_DEEP_JSON", str(RUNTIME_DIR / "browser_horosa_ui_deep_check.json")))
    screenshot_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.parent.mkdir(parents=True, exist_ok=True)

    result: dict = {
        "status": "ok",
        "base_url": base_url,
        "server_root": server_root,
        "modules": [],
        "ai_export_settings_catalog": {},
        "dialogs": [],
        "pageErrors": [],
        "consoleErrors": [],
        "requestFailures": [],
        "warnings": [],
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1760, "height": 1320})
        try:
            context.grant_permissions(["clipboard-read", "clipboard-write"], origin=f"http://127.0.0.1:{web_port}")
        except Exception:
            pass
        context.add_init_script(
            """
            (() => {
              window.__horosaCopiedText = '';
              const originalWrite = navigator.clipboard && navigator.clipboard.writeText
                ? navigator.clipboard.writeText.bind(navigator.clipboard)
                : null;
              if (originalWrite) {
                navigator.clipboard.writeText = async (text) => {
                  window.__horosaCopiedText = text || '';
                  return originalWrite(text);
                };
              }
              const originalExec = document.execCommand ? document.execCommand.bind(document) : null;
              if (originalExec) {
                document.execCommand = function(cmd) {
                  if (cmd === 'copy') {
                    const active = document.activeElement;
                    if (active && typeof active.value === 'string') {
                      window.__horosaCopiedText = active.value;
                    }
                  }
                  return originalExec(cmd);
                };
              }
            })();
            """
        )
        page = context.new_page()

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

        ensure_star_ai_settings_effect(page, result)

        for spec in MODULE_SPECS:
            module_name = spec["module"]
            module_entry = {
                "module": module_name,
                "clicked": False,
                "clicks": [],
                "module_export": None,
                "checkbox_toggles": {},
                "seconds": None,
            }
            step_start = time.perf_counter()
            if not click_visible_text(page, module_name):
                raise AssertionError(f"左侧模块不可点击：{module_name}")
            module_entry["clicked"] = True
            page.wait_for_timeout(1200)

            if spec.get("module_export_header") is not None:
                export_result = click_ai_export_copy(page)
                try:
                    expect_export(
                        export_result,
                        spec.get("module_export_header"),
                        allow_empty=spec.get("allow_empty_export", False),
                    )
                except AssertionError as exc:
                    raise AssertionError(f"{module_name} 页面 AI导出校验失败: {exc}") from exc
                module_entry["module_export"] = export_result

            pending_toggles = list(spec.get("checkbox_toggles", []))
            for click_spec in spec.get("clicks", []):
                click_entry = {
                    "label": click_spec["label"],
                    "clicked": False,
                    "seconds": None,
                    "body_excerpt": "",
                    "export": None,
                }
                sub_start = time.perf_counter()
                clicked = click_visible_text(page, click_spec["label"])
                if not clicked:
                    if click_spec.get("allow_click_miss"):
                        click_entry["note"] = "label not currently visible"
                        module_entry["clicks"].append(click_entry)
                        continue
                    raise AssertionError(f"{module_name} 页面无法点击：{click_spec['label']}")
                click_entry["clicked"] = True
                page.wait_for_timeout(click_spec.get("post_wait_ms", 900))

                for activate_label in click_spec.get("activate_labels", []):
                    if not click_visible_text(page, activate_label):
                        raise AssertionError(f"{module_name}/{click_spec['label']} 预操作不可点击：{activate_label}")
                    page.wait_for_timeout(900)

                if click_spec.get("pd_check"):
                    ensure_pd_recalc(page, result)
                    validate_primary_direction_export(page, result)

                if click_spec.get("export_header"):
                    export_result = click_ai_export_copy(page)
                    try:
                        expect_export(
                            export_result,
                            click_spec.get("export_header"),
                            allow_empty=spec.get("allow_empty_export", False),
                        )
                    except AssertionError as exc:
                        raise AssertionError(f"{module_name}/{click_spec['label']} AI导出校验失败: {exc}") from exc
                    click_entry["export"] = export_result

                click_entry["seconds"] = round(time.perf_counter() - sub_start, 3)
                click_entry["body_excerpt"] = get_body_excerpt(page)
                if click_entry["seconds"] > 35:
                    result["warnings"].append(
                        {
                            "type": "slow_step",
                            "module": module_name,
                            "label": click_spec["label"],
                            "seconds": click_entry["seconds"],
                        }
                    )
                module_entry["clicks"].append(click_entry)

                for label in list(pending_toggles):
                    if checkbox_state(page, label) is None:
                        continue
                    module_entry["checkbox_toggles"][label] = toggle_visible_checkbox(page, label)
                    pending_toggles.remove(label)

            for label in pending_toggles:
                module_entry["checkbox_toggles"][label] = toggle_visible_checkbox(page, label)

            module_entry["seconds"] = round(time.perf_counter() - step_start, 3)
            module_entry["body_excerpt"] = get_body_excerpt(page)
            result["modules"].append(module_entry)

        open_ai_settings(page)
        modal_excerpt = page.locator(".ant-modal:visible").inner_text()[:360]
        result["ai_export_settings_catalog"]["modal_excerpt"] = modal_excerpt
        for technique_label in EXPECTED_AI_TECHNIQUES:
            select_ai_setting_technique(page, technique_label)
            result["ai_export_settings_catalog"][technique_label] = ai_settings_state(page)
        close_modal(page)

        page.screenshot(path=str(screenshot_path), full_page=True)
        context.close()
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
        if (
            "Failed to load resource" in message
            and ("ERR_CONNECTION_TIMED_OUT" in message or "ERR_TIMED_OUT" in message or "ERR_ABORTED" in message)
        ):
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
