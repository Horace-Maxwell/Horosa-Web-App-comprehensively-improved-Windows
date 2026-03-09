#!/usr/bin/env python3
"""Static integration checks for Horosa major modules and AI export wiring."""

from __future__ import annotations

import json
import re
from pathlib import Path


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _project_root(root: Path | None = None) -> Path:
    base = root or _repo_root()
    horosa_web = base / "Horosa-Web"
    return horosa_web if horosa_web.exists() else base


def _read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _assert_contains(path: Path, needle: str) -> None:
    text = _read(path)
    if needle not in text:
        raise AssertionError(f"{path} missing expected text: {needle}")


def _assert_regex(path: Path, pattern: str) -> None:
    text = _read(path)
    if re.search(pattern, text, re.S) is None:
        raise AssertionError(f"{path} missing expected pattern: {pattern}")


def _assert_tab(path: Path, label: str, key: str) -> None:
    _assert_regex(path, rf'<TabPane tab="{re.escape(label)}" key="{re.escape(key)}"')


def main() -> None:
    root = _repo_root()
    project_root = _project_root(root)

    index_js = project_root / "astrostudyui" / "src" / "pages" / "index.js"
    page_header = project_root / "astrostudyui" / "src" / "components" / "homepage" / "PageHeader.js"
    ai_export = project_root / "astrostudyui" / "src" / "utils" / "aiExport.js"
    astro_snapshot = project_root / "astrostudyui" / "src" / "utils" / "astroAiSnapshot.js"
    module_snapshot = project_root / "astrostudyui" / "src" / "utils" / "moduleAiSnapshot.js"
    precise_bridge = project_root / "astrostudyui" / "src" / "utils" / "preciseCalcBridge.js"
    astro_model = project_root / "astrostudyui" / "src" / "models" / "astro.js"
    verify_sh = project_root / "verify_horosa_local.sh"

    cntrad_main = project_root / "astrostudyui" / "src" / "components" / "cntradition" / "CnTraditionMain.js"
    cnyibu_main = project_root / "astrostudyui" / "src" / "components" / "cnyibu" / "CnYiBuMain.js"
    direct_main = project_root / "astrostudyui" / "src" / "components" / "direction" / "AstroDirectMain.js"
    pd_table = project_root / "astrostudyui" / "src" / "components" / "astro" / "AstroPrimaryDirection.js"
    hellen_main = project_root / "astrostudyui" / "src" / "components" / "hellenastro" / "HellenAstroMain.js"
    chart13 = project_root / "astrostudyui" / "src" / "components" / "hellenastro" / "AstroChart13.js"
    astro_chart_main = project_root / "astrostudyui" / "src" / "components" / "astro" / "AstroChartMain.js"
    astro_chart_main3d = project_root / "astrostudyui" / "src" / "components" / "astro3d" / "AstroChartMain3D.js"
    astro_chart3d = project_root / "astrostudyui" / "src" / "components" / "astro3d" / "AstroChart3D.js"
    astro3d_core = project_root / "astrostudyui" / "src" / "components" / "astro3d" / "Astro3D.js"
    loc_main = project_root / "astrostudyui" / "src" / "components" / "loc" / "LocAstroMain.js"
    acg = project_root / "astrostudyui" / "src" / "components" / "acg" / "AstroAcg.js"

    snapshot_expectations = {
        "bazi": project_root / "astrostudyui" / "src" / "components" / "cntradition" / "BaZi.js",
        "ziwei": project_root / "astrostudyui" / "src" / "components" / "ziwei" / "ZiWeiMain.js",
        "suzhan": project_root / "astrostudyui" / "src" / "components" / "suzhan" / "SuZhanMain.js",
        "guazhan": project_root / "astrostudyui" / "src" / "components" / "guazhan" / "GuaZhanMain.js",
        "liureng": project_root / "astrostudyui" / "src" / "components" / "lrzhan" / "LiuRengMain.js",
        "jinkou": project_root / "astrostudyui" / "src" / "components" / "jinkou" / "JinKouMain.js",
        "qimen": project_root / "astrostudyui" / "src" / "components" / "dunjia" / "DunJiaMain.js",
        "taiyi": project_root / "astrostudyui" / "src" / "components" / "taiyi" / "TaiYiMain.js",
        "tongshefa": project_root / "astrostudyui" / "src" / "components" / "tongshefa" / "TongSheFaMain.js",
        "sanshiunited": project_root / "astrostudyui" / "src" / "components" / "sanshi" / "SanShiUnitedMain.js",
        "jieqi": project_root / "astrostudyui" / "src" / "components" / "jieqi" / "JieQiChartsMain.js",
        "guolao": project_root / "astrostudyui" / "src" / "components" / "guolao" / "GuoLaoChartMain.js",
        "germany": project_root / "astrostudyui" / "src" / "components" / "germany" / "AstroMidpoint.js",
        "primarydirect": direct_main,
        "relative": project_root / "astrostudyui" / "src" / "components" / "astro" / "AstroRelative.js",
        "indiachart": project_root / "astrostudyui" / "src" / "components" / "astro" / "IndiaChart.js",
        "fengshui": project_root / "astrostudyui" / "src" / "components" / "fengshui" / "FengShuiMain.js",
        "otherbu": project_root / "astrostudyui" / "src" / "components" / "dice" / "DiceMain.js",
        "solararc": project_root / "astrostudyui" / "src" / "components" / "astro" / "AstroSolarArc.js",
        "solarreturn": project_root / "astrostudyui" / "src" / "components" / "astro" / "AstroSolarReturn.js",
        "lunarreturn": project_root / "astrostudyui" / "src" / "components" / "astro" / "AstroLunarReturn.js",
        "givenyear": project_root / "astrostudyui" / "src" / "components" / "astro" / "AstroGivenYear.js",
        "profection": project_root / "astrostudyui" / "src" / "components" / "astro" / "AstroProfection.js",
        "zodialrelease": project_root / "astrostudyui" / "src" / "components" / "astro" / "AstroZR.js",
    }

    top_level_tabs = {
        "星盘": "astrochart",
        "三维盘": "astrochart3D",
        "推运盘": "direction",
        "量化盘": "germanytech",
        "关系盘": "relativechart",
        "节气盘": "jieqichart",
        "星体地图": "locastro",
        "七政四余": "guolao",
        "希腊星术": "hellenastro",
        "印度律盘": "indiachart",
        "八字紫微": "cntradition",
        "易与三式": "cnyibu",
        "万年历": "calendar",
        "风水": "fengshui",
        "三式合一": "sanshiunited",
    }
    for label, key in top_level_tabs.items():
        _assert_tab(index_js, label, key)

    cntrad_tabs = {
        "八字": "bazi",
        "紫微斗数": "ziwei",
        "八卦类象": "guasym",
        "十二串宫": "cuangong12",
        "八字规则": "pithy",
    }
    for label, key in cntrad_tabs.items():
        _assert_tab(cntrad_main, label, key)

    cnyibu_tabs = {
        "宿盘": "suzhan",
        "易卦": "guazhan",
        "六壬": "liureng",
        "金口诀": "jinkou",
        "遁甲": "dunjia",
        "太乙": "taiyi",
        "统摄法": "tongshefa",
    }
    for label, key in cnyibu_tabs.items():
        _assert_tab(cnyibu_main, label, key)

    _assert_contains(index_js, "type: 'astro/fetchByFields'")
    for key in [
        "'jieqichart'",
        "'guolao'",
        "'hellenastro'",
        "'indiachart'",
        "'locastro'",
        "'cnyibu'",
        "'cntradition'",
        "'sanshiunited'",
        "'germanytech'",
        "'astrochart'",
        "'astrochart3D'",
        "'fengshui'",
    ]:
        _assert_contains(index_js, key)
    for hook_key in [
        "hook={predictHook.astrochart}",
        "hook={predictHook.astrochart3D}",
        "hook={predictHook.direction}",
        "hook={predictHook.relativechart}",
        "hook={predictHook.germanytech}",
        "hook={predictHook.jieqichart}",
        "hook={predictHook.locastro}",
        "hook={predictHook.guolao}",
        "hook={predictHook.hellenastro}",
        "hook={predictHook.indiachart}",
        "hook={predictHook.cntradition}",
        "hook={predictHook.cnyibu}",
        "hook={predictHook.sanshiunited}",
    ]:
        _assert_contains(index_js, hook_key)

    _assert_contains(page_header, "runAIExport")
    _assert_contains(page_header, "loadAIExportSettings")
    _assert_contains(page_header, "saveAIExportSettings")
    _assert_contains(page_header, "listAIExportTechniqueSettings")
    _assert_contains(page_header, "getCurrentAIExportContext")
    _assert_contains(page_header, "<Button size='small'>AI导出</Button>")
    _assert_contains(page_header, "AI导出设置")
    _assert_contains(page_header, "Checkbox.Group")
    _assert_contains(page_header, "message.success('AI导出设置已保存')")

    for needle in [
        "PlusMinusTime value={dt}",
        "GeoCoordModal",
        "<TabPane tab=\"信息\" key=\"1\">",
        "<TabPane tab=\"相位\" key=\"2\">",
        "<TabPane tab=\"行星\" key=\"3\">",
        "<TabPane tab=\"希腊点\" key=\"4\">",
        "<TabPane tab=\"可能性\" key=\"5\">",
    ]:
        _assert_contains(astro_chart_main, needle)

    for needle in [
        "AstroChart3D",
        "needChart3D",
        "PlusMinusTime value={dt}",
        "GeoCoordModal",
        "<TabPane tab=\"信息\" key=\"1\">",
        "<TabPane tab=\"相位\" key=\"2\">",
        "<TabPane tab=\"行星\" key=\"3\">",
        "<TabPane tab=\"希腊点\" key=\"4\">",
    ]:
        _assert_contains(astro_chart_main3d, needle)

    _assert_contains(astro_chart3d, "new Astro3D(opt)")
    _assert_contains(astro_chart3d, "this.astro3d.init()")
    _assert_contains(astro3d_core, "const ChartOptKey = 'chart3dOpt';")
    _assert_contains(astro3d_core, "const ModelUnavailableAtKey = 'horosa3dModelUnavailableAt';")

    _assert_contains(hellen_main, "currentTab: \"Chart13\"")
    _assert_contains(hellen_main, "<TabPane tab='十三分盘' key=\"Chart13\" >")
    _assert_contains(hellen_main, "hook={this.state.hook.Chart13}")
    _assert_contains(chart13, "fetchChart13Cached")
    _assert_contains(chart13, "request(`${Constants.ServerRoot}/chart13`")

    _assert_contains(loc_main, "<TabPane tab='行星地图' key=\"Acg\" >")
    _assert_contains(loc_main, "hook={this.state.hook.Acg}")
    _assert_contains(acg, "request(`${Constants.ServerRoot}/location/acg`")

    for needle in [
        "currentTab: \"Natal\"",
        "currentFractal: 1",
        "Hora:{",
        "Drekkana:{",
        "Navamsa:{",
        "Dasamsa:{",
        "Shodasamsa:{",
        "Chaturvimsamsa:{",
        "tab={this.state.hook.Natal.txt}",
        "<span>{hook.fractal}律盘</span>",
        "saveModuleAISnapshot('indiachart_current'",
        "saveModuleAISnapshot(`indiachart_${fractal}`",
    ]:
        _assert_contains(snapshot_expectations["indiachart"], needle) if "saveModuleAISnapshot" in needle else _assert_contains(project_root / "astrostudyui" / "src" / "components" / "astro" / "IndiaChartMain.js", needle)

    for needle in [
        "currentTab: '二十四节气'",
        "saveModuleAISnapshot('jieqi'",
        "saveModuleAISnapshot('jieqi_current'",
        "<TabPane tab='二十四节气' key='二十四节气'>",
        "tab={title+'星盘'}",
        "tab={title+'宿盘'}",
        "tab={title+'3D盘'}",
        "AstroChartMain3D",
    ]:
        _assert_contains(snapshot_expectations["jieqi"], needle)

    for needle in [
        "<TabPane tab=\"主/界限法\" key=\"primarydirect\">",
        "<TabPane tab=\"黄道星释\" key=\"zodialrelease\">",
        "<TabPane tab=\"法达星限\" key=\"firdaria\">",
        "<TabPane tab=\"小限法\" key=\"profection\">",
        "<TabPane tab=\"太阳弧\" key=\"solararc\">",
        "<TabPane tab=\"太阳返照\" key=\"solarreturn\">",
        "<TabPane tab=\"月亮返照\" key=\"lunarreturn\">",
        "<TabPane tab=\"流年法\" key=\"givenyear\">",
        "<TabPane tab=\"十年大运\" key=\"decennials\">",
    ]:
        _assert_contains(direct_main, needle)

    _assert_contains(module_snapshot, "export function saveModuleAISnapshot")
    _assert_contains(module_snapshot, "export function loadModuleAISnapshot")
    _assert_contains(astro_snapshot, "export function saveAstroAISnapshot")
    _assert_contains(astro_snapshot, "export function loadAstroAISnapshot")
    _assert_contains(astro_snapshot, "export function getAstroAISnapshotForCurrent")
    _assert_contains(astro_model, "saveAstroAISnapshot(Result, values)")
    _assert_contains(astro_model, "saveAstroAISnapshot(Result, fields)")
    _assert_contains(astro_model, "saveAstroAISnapshot(Result, fieldValues)")

    for module_name, path in snapshot_expectations.items():
        _assert_contains(path, f"saveModuleAISnapshot('{module_name}'")

    for module_name in ["liureng", "jinkou", "qimen", "tongshefa", "guazhan"]:
        path = snapshot_expectations[module_name]
        _assert_contains(path, f"loadModuleAISnapshot('{module_name}')")

    _assert_contains(snapshot_expectations["jieqi"], "saveModuleAISnapshot('jieqi_current'")
    _assert_contains(snapshot_expectations["indiachart"], "saveModuleAISnapshot('indiachart_current'")
    _assert_contains(snapshot_expectations["indiachart"], "saveModuleAISnapshot(`indiachart_${fractal}`")

    _assert_contains(ai_export, "const AI_EXPORT_TECHNIQUES = [")
    _assert_contains(ai_export, "const AI_EXPORT_PRESET_SECTIONS = {")
    _assert_contains(ai_export, "export function listAIExportTechniqueSettings()")
    _assert_contains(ai_export, "export function getCurrentAIExportContext()")
    _assert_contains(ai_export, "export async function runAIExport(")

    ai_keys = [
        "astrochart",
        "indiachart",
        "astrochart_like",
        "relative",
        "primarydirect",
        "zodialrelease",
        "firdaria",
        "profection",
        "solararc",
        "solarreturn",
        "lunarreturn",
        "givenyear",
        "bazi",
        "ziwei",
        "suzhan",
        "sixyao",
        "tongshefa",
        "liureng",
        "jinkou",
        "qimen",
        "sanshiunited",
        "taiyi",
        "guolao",
        "germany",
        "jieqi",
        "otherbu",
        "fengshui",
    ]
    for key in ai_keys:
        _assert_contains(ai_export, f"key: '{key}'")
        _assert_contains(ai_export, f"{key}: [")

    for refresh_key in [
        "guazhan",
        "sixyao",
        "liureng",
        "jinkou",
        "qimen",
        "sanshiunited",
        "tongshefa",
        "taiyi",
        "germany",
        "jieqi_current",
        "jieqi",
        "primarydirect",
        "zodialrelease",
        "firdaria",
        "profection",
        "solararc",
        "solarreturn",
        "lunarreturn",
        "givenyear",
        "relative",
        "otherbu",
        "fengshui",
    ]:
        _assert_contains(ai_export, f"requestModuleSnapshotRefresh('{refresh_key}')")

    for extractor in [
        "extractPrimaryDirectContent",
        "extractJieQiContent",
        "extractGermanyContent",
        "extractSanShiUnitedContent",
        "extractQiMenContent",
        "extractLiuRengContent",
        "extractJinKouContent",
        "extractSixYaoContent",
        "extractTongSheFaContent",
        "extractRelativeContent",
        "extractSimpleModuleContent",
    ]:
        _assert_contains(ai_export, f"function {extractor}(")

    _assert_contains(ai_export, "return extractPrimaryDirectContent(context);")
    _assert_contains(ai_export, "return extractJieQiContent(context);")
    _assert_contains(ai_export, "return extractGermanyContent(context);")
    _assert_contains(ai_export, "return extractSanShiUnitedContent(context);")
    _assert_contains(ai_export, "return extractRelativeContent(context);")
    _assert_contains(ai_export, "return extractSimpleModuleContent('guolao');")
    _assert_contains(ai_export, "return extractSimpleModuleContent('bazi');")
    _assert_contains(ai_export, "return extractSimpleModuleContent('ziwei');")
    _assert_contains(ai_export, "return extractSimpleModuleContent('suzhan');")

    _assert_contains(precise_bridge, "export async function fetchPreciseNongli(params)")
    _assert_contains(precise_bridge, "export async function fetchPreciseJieqiYear(params)")
    _assert_contains(precise_bridge, "export async function fetchPreciseJieqiSeed(params)")
    _assert_contains(precise_bridge, "request(`${ServerRoot}/nongli/time`")
    _assert_contains(precise_bridge, "request(`${ServerRoot}/jieqi/year`")

    _assert_contains(chart13, "request(`${Constants.ServerRoot}/chart13`")
    _assert_contains(acg, "request(`${Constants.ServerRoot}/location/acg`")
    _assert_contains(hellen_main, "this.props.hook.fun = (fields)=>")
    _assert_contains(loc_main, "this.props.hook.fun = (fields)=>")
    _assert_contains(direct_main, "applyPrimaryDirectionConfig(pdMethod, pdTimeKey)")
    _assert_contains(pd_table, "const pdTypeOutOfSync = appliedPdState.pdtype !== DEFAULT_PD_TYPE;")
    _assert_contains(pd_table, "needsPdRecompute(){")
    _assert_contains(pd_table, "if(!this.needsPdRecompute())")
    _assert_contains(pd_table, "disabled={!needsPdRecompute}")
    _assert_contains(pd_table, "needsPdRecompute ? (isPdConfigDirty ? '重新计算' : '计算') : '已同步'")
    _assert_contains(direct_main, "cache: false")
    _assert_contains(astro_model, "pdtype: fields.pdtype ? fields.pdtype.value : 0")

    _assert_contains(verify_sh, "verifyPrimaryDirectionRuntime.js")
    _assert_contains(verify_sh, "verifyHorosaRuntimeFull.js")
    _assert_contains(verify_sh, "check_primary_direction_astroapp_integration.py")
    _assert_contains(verify_sh, "check_horosa_full_integration.py")

    report = {
        "status": "ok",
        "top_level_tabs_checked": len(top_level_tabs),
        "cntradition_tabs_checked": len(cntrad_tabs),
        "cnyibu_tabs_checked": len(cnyibu_tabs),
        "snapshot_modules_checked": sorted(snapshot_expectations.keys()),
        "ai_export_keys_checked": ai_keys,
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
