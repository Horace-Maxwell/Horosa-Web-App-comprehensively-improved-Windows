#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const MAIN_TABS = [
  '星盘',
  '三维盘',
  '推运盘',
  '量化盘',
  '关系盘',
  '节气盘',
  '星体地图',
  '七政四余',
  '希腊星术',
  '印度律盘',
  '八字紫微',
  '易与三式',
  '万年历',
  '西洋游戏',
  '风水',
  '三式合一',
];

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith('--')) continue;
    const idx = item.indexOf('=');
    if (idx > 2) {
      const k = item.slice(2, idx);
      const v = item.slice(idx + 1);
      args[k] = v;
    } else {
      args[item.slice(2)] = '1';
    }
  }
  return args;
}

function nowIso() {
  return new Date().toISOString();
}

function trimText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function regexEsc(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function waitQuiet(page, delay = 250) {
  await page.waitForTimeout(delay);
}

async function dismissBlockingLayers(page) {
  try {
    const closeButtons = page.locator('.ant-modal-wrap .ant-modal-close:visible');
    const closeCount = await closeButtons.count();
    for (let i = 0; i < closeCount; i += 1) {
      try {
        await closeButtons.nth(i).click({ timeout: 1200 });
        await waitQuiet(page, 120);
      } catch (e) {
        // Best effort; modal stacks are dynamic.
      }
    }
    await page.keyboard.press('Escape').catch(() => {});
    await waitQuiet(page, 80);
  } catch (e) {
    // Non-fatal cleanup.
  }
}

async function clickTabByText(page, text) {
  try {
    const exact = new RegExp(`^\\s*${regexEsc(text)}\\s*$`);
    const exactLocator = page.locator('.ant-tabs-tab:visible').filter({
      has: page.locator('.ant-tabs-tab-btn', { hasText: exact }),
    });
    if ((await exactLocator.count()) > 0) {
      await dismissBlockingLayers(page);
      await exactLocator.first().click({ timeout: 4000 });
      return true;
    }

    const fallback = page.locator('.ant-tabs-tab:visible', { hasText: text });
    if ((await fallback.count()) > 0) {
      await dismissBlockingLayers(page);
      await fallback.first().click({ timeout: 4000 });
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

async function collectInnerTabs(page) {
  return page.evaluate((mainTabs) => {
    const result = [];
    const seen = new Set();
    const visible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const st = window.getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.pointerEvents === 'none') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 8 && rect.height > 8;
    };

    const tabs = Array.from(document.querySelectorAll('.ant-tabs-tab'));
    for (const tab of tabs) {
      if (!visible(tab)) continue;
      const btn = tab.querySelector('.ant-tabs-tab-btn');
      const text = (btn ? btn.textContent : tab.textContent) || '';
      const cleaned = text.replace(/\s+/g, ' ').trim();
      if (!cleaned) continue;
      if (mainTabs.includes(cleaned)) continue;
      if (seen.has(cleaned)) continue;
      seen.add(cleaned);
      result.push(cleaned);
    }
    return result;
  }, MAIN_TABS);
}

async function collectVisibleControls(page) {
  return page.evaluate(() => {
    const controls = [];
    const visible = (el) => {
      if (!(el instanceof HTMLElement)) return false;
      const st = window.getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.pointerEvents === 'none') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 8 && rect.height > 8;
    };
    const disabled = (el) => {
      const cls = (el.className || '').toString();
      const aria = el.getAttribute('aria-disabled');
      return Boolean(el.disabled) || aria === 'true' || /\b(disabled|ant-btn-disabled)\b/.test(cls);
    };

    let serial = 1;
    const all = Array.from(document.querySelectorAll('button, .ant-btn, [role="button"], input[type="button"], input[type="submit"]'));
    for (const el of all) {
      if (!visible(el) || disabled(el)) continue;
      const attr = el.getAttribute('data-codex-probe-id');
      const id = attr || `codex-probe-${Date.now()}-${serial++}`;
      if (!attr) el.setAttribute('data-codex-probe-id', id);

      const rect = el.getBoundingClientRect();
      const text = (el.innerText || el.textContent || el.getAttribute('value') || '').replace(/\s+/g, ' ').trim();
      controls.push({
        id,
        text,
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || ''),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
      });
    }

    controls.sort((a, b) => (a.top - b.top) || (a.left - b.left));
    return controls;
  });
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url || 'http://127.0.0.1:8000/index.html';
  const timeoutMs = Number(args.timeout || 180000);
  const maxButtonsPerView = Number(args.maxButtons || 80);
  const maxInnerTabsPerMain = Number(args.maxInnerTabs || 8);
  const maxRuntimeMs = Number(args.maxRuntime || 240000);
  const outputFile = args.output
    ? path.resolve(args.output)
    : path.resolve(process.cwd(), `BUTTON_SELF_CHECK_${Date.now()}.json`);

  const report = {
    startedAt: nowIso(),
    url,
    timeoutMs,
    mainTabsAttempted: [],
    scopeStats: [],
    missingTabs: [],
    clickFailures: [],
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  page.on('dialog', async (dialog) => {
    try {
      await dialog.dismiss();
    } catch (e) {
      report.clickFailures.push({
        at: nowIso(),
        scope: 'dialog',
        control: trimText(dialog.message()).slice(0, 120),
        error: trimText(e && e.message),
      });
    }
  });

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    report.consoleErrors.push({
      at: nowIso(),
      text: trimText(msg.text()),
    });
  });

  page.on('pageerror', (err) => {
    report.pageErrors.push({
      at: nowIso(),
      text: trimText(err && err.message),
    });
  });

  page.on('requestfailed', (req) => {
    const failure = req.failure();
    report.requestFailures.push({
      at: nowIso(),
      method: req.method(),
      url: req.url(),
      reason: failure ? failure.errorText : 'unknown',
    });
  });

  try {
    const runStarted = Date.now();
    const overTime = () => (Date.now() - runStarted) > maxRuntimeMs;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await waitQuiet(page, 1200);

    const visitedInnerTabs = new Set();

    const clickScopeButtons = async (scope) => {
      await dismissBlockingLayers(page);
      const controls = await collectVisibleControls(page);
      const limit = Math.min(controls.length, maxButtonsPerView);
      let clicked = 0;
      let failed = 0;
      const usedKey = new Set();

      for (let i = 0; i < limit; i += 1) {
        if (overTime()) break;
        const one = controls[i];
        const keyText = trimText(one.text).slice(0, 80);
        const dedup = `${one.tag}|${trimText(one.cls)}|${keyText}`;
        if (usedKey.has(dedup)) continue;
        usedKey.add(dedup);
        try {
          const loc = page.locator(`[data-codex-probe-id="${one.id}"]`).first();
          if ((await loc.count()) < 1) {
            failed += 1;
            report.clickFailures.push({
              at: nowIso(),
              scope,
              control: keyText || `${one.tag}.${trimText(one.cls)}`,
              error: 'control not found before click',
            });
            continue;
          }
          await loc.scrollIntoViewIfNeeded();
          await loc.click({ timeout: 450, force: true });
          clicked += 1;
          await dismissBlockingLayers(page);
          await waitQuiet(page, 70);
        } catch (e) {
          failed += 1;
          report.clickFailures.push({
            at: nowIso(),
            scope,
            control: keyText || `${one.tag}.${trimText(one.cls)}`,
            error: trimText(e && e.message),
          });
        }
      }

      report.scopeStats.push({
        scope,
        controlsVisible: controls.length,
        controlsAttempted: limit,
        clicked,
        failed,
      });
    };

    for (const mainTab of MAIN_TABS) {
      if (overTime()) break;
      const opened = await clickTabByText(page, mainTab);
      if (!opened) {
        report.missingTabs.push(mainTab);
        continue;
      }
      report.mainTabsAttempted.push(mainTab);
      await waitQuiet(page, 700);

      await clickScopeButtons(`main:${mainTab}`);

      const innerTabs = await collectInnerTabs(page);
      for (const inner of innerTabs.slice(0, maxInnerTabsPerMain)) {
        if (overTime()) break;
        const tabKey = `${mainTab}::${inner}`;
        if (visitedInnerTabs.has(tabKey)) continue;
        visitedInnerTabs.add(tabKey);

        const ok = await clickTabByText(page, inner);
        if (!ok) continue;
        await waitQuiet(page, 400);
        await clickScopeButtons(`inner:${mainTab}:${inner}`);
      }
    }
  } finally {
    report.endedAt = nowIso();
    const sum = report.scopeStats.reduce((acc, one) => {
      acc.visible += one.controlsVisible;
      acc.attempted += one.controlsAttempted;
      acc.clicked += one.clicked;
      acc.failed += one.failed;
      return acc;
    }, { visible: 0, attempted: 0, clicked: 0, failed: 0 });

    report.summary = {
      mainTabsAttempted: report.mainTabsAttempted.length,
      mainTabsMissing: report.missingTabs.length,
      controlsVisibleTotal: sum.visible,
      controlsAttemptedTotal: sum.attempted,
      controlsClickedTotal: sum.clicked,
      controlsFailedTotal: sum.failed,
      consoleErrorCount: report.consoleErrors.length,
      pageErrorCount: report.pageErrors.length,
      requestFailureCount: report.requestFailures.length,
      clickFailureCount: report.clickFailures.length,
      pass:
        report.missingTabs.length === 0 &&
        report.clickFailures.length === 0 &&
        report.consoleErrors.length === 0 &&
        report.pageErrors.length === 0,
    };

    fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await context.close();
    await browser.close();
    process.stdout.write(`WROTE ${outputFile}\n`);
    process.stdout.write(`SUMMARY ${JSON.stringify(report.summary)}\n`);
  }
}

run().catch((err) => {
  process.stderr.write(`${trimText(err && err.stack ? err.stack : err)}\n`);
  process.exit(1);
});
