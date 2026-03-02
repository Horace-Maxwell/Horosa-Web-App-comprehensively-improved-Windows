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

const ACTION_HINTS = [
  '起盘',
  '排盘',
  '确定',
  '计算',
  '分析',
  '查询',
  '生成',
  '开始',
  '获取',
  '刷新',
  '执行',
];

const EXCLUDE_HINTS = [
  '导出',
  '设置',
  '保存',
  '删除',
  '新增',
  '关闭',
  '取消',
  '复制',
  '重置',
  '清空',
  '登录',
  '注册',
  'AI',
  '上一',
  '下一',
  '返回',
];

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith('--')) continue;
    const idx = item.indexOf('=');
    if (idx > 2) {
      args[item.slice(2, idx)] = item.slice(idx + 1);
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

function compactText(value) {
  return trimText(value).replace(/\s+/g, '');
}

function regexEsc(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function includesAny(text, list) {
  const t = trimText(text);
  const c = compactText(text);
  if (!t) return false;
  return list.some((k) => {
    const kk = compactText(k);
    return t.includes(k) || c.includes(kk);
  });
}

function toPageId(mainTab, innerTab) {
  return innerTab ? `${mainTab} / ${innerTab}` : mainTab;
}

async function waitQuiet(page, ms = 250) {
  await page.waitForTimeout(ms);
}

async function dismissBlockingLayers(page) {
  try {
    const closeButtons = page.locator('.ant-modal-wrap .ant-modal-close:visible');
    const count = await closeButtons.count();
    for (let i = 0; i < count; i += 1) {
      try {
        await closeButtons.nth(i).click({ timeout: 800 });
        await waitQuiet(page, 80);
      } catch (e) {
        // Best effort only.
      }
    }
    await page.keyboard.press('Escape').catch(() => {});
    await waitQuiet(page, 60);
  } catch (e) {
    // Non-fatal.
  }
}

async function clickTabByText(page, text) {
  const exact = new RegExp(`^\\s*${regexEsc(text)}\\s*$`);
  const exactLocator = page.locator('.ant-tabs-tab:visible').filter({
    has: page.locator('.ant-tabs-tab-btn', { hasText: exact }),
  });
  if ((await exactLocator.count()) > 0) {
    await dismissBlockingLayers(page);
    try {
      await exactLocator.first().click({ timeout: 5000 });
      return true;
    } catch (e1) {
      try {
        await exactLocator.first().click({ timeout: 5000, force: true });
        return true;
      } catch (e2) {
        try {
          await exactLocator.first().evaluate((el) => {
            if (el instanceof HTMLElement) el.click();
          });
          return true;
        } catch (e3) {
          // fallthrough
        }
      }
    }
  }

  const fallback = page.locator('.ant-tabs-tab:visible', { hasText: text });
  if ((await fallback.count()) > 0) {
    await dismissBlockingLayers(page);
    try {
      await fallback.first().click({ timeout: 5000 });
      return true;
    } catch (e1) {
      try {
        await fallback.first().click({ timeout: 5000, force: true });
        return true;
      } catch (e2) {
        try {
          await fallback.first().evaluate((el) => {
            if (el instanceof HTMLElement) el.click();
          });
          return true;
        } catch (e3) {
          // fallthrough
        }
      }
    }
  }
  return false;
}

async function collectInnerTabs(page) {
  return page.evaluate((mainTabs) => {
    const result = [];
    const seen = new Set();

    function visible(el) {
      if (!(el instanceof HTMLElement)) return false;
      const st = window.getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.pointerEvents === 'none') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 8 && rect.height > 8;
    }

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

async function collectVisibleButtons(page) {
  return page.evaluate(() => {
    function visible(el) {
      if (!(el instanceof HTMLElement)) return false;
      const st = window.getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden' || st.pointerEvents === 'none') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 8 && rect.height > 8;
    }

    function disabled(el) {
      const cls = (el.className || '').toString();
      const aria = el.getAttribute('aria-disabled');
      return Boolean(el.disabled) || aria === 'true' || /\b(disabled|ant-btn-disabled)\b/.test(cls);
    }

    const all = Array.from(document.querySelectorAll('button, .ant-btn, [role="button"], input[type="button"], input[type="submit"]'));
    const items = [];

    for (const el of all) {
      if (!visible(el) || disabled(el)) continue;
      const rect = el.getBoundingClientRect();
      const text = (el.innerText || el.textContent || el.getAttribute('value') || '').replace(/\s+/g, ' ').trim();
      let id = el.getAttribute('data-codex-perf-id');
      if (!id) {
        id = `perf-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        el.setAttribute('data-codex-perf-id', id);
      }
      items.push({
        id,
        text,
        cls: String(el.className || ''),
        top: Math.round(rect.top),
        left: Math.round(rect.left),
      });
    }

    items.sort((a, b) => (a.top - b.top) || (a.left - b.left));
    return items;
  });
}

async function tryClickLocator(locator, timeout = 5000) {
  let lastError = null;

  try {
    await locator.first().click({ timeout });
    return { ok: true };
  } catch (e1) {
    lastError = e1;
  }

  try {
    await locator.first().click({ timeout, force: true });
    return { ok: true };
  } catch (e2) {
    lastError = e2;
  }

  try {
    await locator.first().evaluate((el) => {
      if (el instanceof HTMLElement) el.click();
    });
    return { ok: true };
  } catch (e3) {
    lastError = e3;
  }

  return { ok: false, error: lastError };
}

function pickActionButton(buttons) {
  const filtered = buttons.filter((b) => {
    const txt = trimText(b.text);
    if (!txt) return false;
    if (includesAny(txt, EXCLUDE_HINTS)) return false;
    if (!includesAny(txt, ACTION_HINTS)) return false;
    return txt.length <= 16;
  });
  if (filtered.length <= 0) {
    return null;
  }

  const sortByPriority = (arr) => {
    const orderedHints = ['起盘', '排盘', '计算', '确定', '查询', '生成', '开始', '获取', '刷新', '执行'];
    return arr.slice().sort((a, b) => {
      const aa = compactText(a.text);
      const bb = compactText(b.text);
      let ai = 999;
      let bi = 999;
      for (let i = 0; i < orderedHints.length; i += 1) {
        if (aa.includes(orderedHints[i])) {
          ai = i;
          break;
        }
      }
      for (let i = 0; i < orderedHints.length; i += 1) {
        if (bb.includes(orderedHints[i])) {
          bi = i;
          break;
        }
      }
      if (ai !== bi) return ai - bi;
      return a.top - b.top;
    });
  };

  // Prefer action buttons inside the module panel, not top global toolbar.
  const panelButtons = filtered.filter((b) => Number(b.top || 0) >= 240);
  if (panelButtons.length > 0) {
    return sortByPriority(panelButtons)[0];
  }
  return sortByPriority(filtered)[0];
}

function pickSameActionText(buttons, targetAction) {
  if (!targetAction) return null;
  const targetText = compactText(targetAction.text);
  if (!targetText) return null;

  const candidates = buttons.filter((b) => {
    const txt = trimText(b.text);
    if (!txt) return false;
    if (compactText(txt) !== targetText) return false;
    if (includesAny(txt, EXCLUDE_HINTS)) return false;
    if (!includesAny(txt, ACTION_HINTS)) return false;
    return true;
  });
  if (candidates.length <= 0) return null;

  const tTop = Number(targetAction.top || 0);
  const tLeft = Number(targetAction.left || 0);
  candidates.sort((a, b) => {
    const da = Math.abs(Number(a.top || 0) - tTop) + Math.abs(Number(a.left || 0) - tLeft);
    const db = Math.abs(Number(b.top || 0) - tTop) + Math.abs(Number(b.left || 0) - tLeft);
    return da - db;
  });
  return candidates[0];
}

async function clickActionButton(page, initialAction, maxAttempts = 3) {
  let action = initialAction;
  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (!action) {
      const buttons = await collectVisibleButtons(page);
      action = pickActionButton(buttons);
      if (!action) break;
    }

    const locator = page.locator(`[data-codex-perf-id="${action.id}"]`);
    const count = await locator.count();
    if (count > 0) {
      const clicked = await tryClickLocator(locator, 5000);
      if (clicked.ok) {
        return { ok: true, action };
      }
      lastError = clicked.error;
    }

    await waitQuiet(page, 60);

    const refreshedButtons = await collectVisibleButtons(page);
    const sameTextAction = pickSameActionText(refreshedButtons, action);
    action = sameTextAction || pickActionButton(refreshedButtons);
  }

  return { ok: false, action, error: lastError };
}

async function waitComputeFinish(page, state, baselineResponseCount, timeoutMs = 10000) {
  const start = Date.now();
  let sawSpinner = false;
  let gotNewResponse = false;

  while ((Date.now() - start) < timeoutMs) {
    const spinnerVisible = await page.evaluate(() => {
      const q = [
        '.ant-spin-spinning',
        '.ant-spin-dot-spin',
        '.loading',
        '.ant-skeleton-active',
      ];
      return q.some((s) => {
        const nodes = Array.from(document.querySelectorAll(s));
        return nodes.some((n) => {
          if (!(n instanceof HTMLElement)) return false;
          const st = window.getComputedStyle(n);
          if (st.display === 'none' || st.visibility === 'hidden') return false;
          const rect = n.getBoundingClientRect();
          return rect.width > 8 && rect.height > 8;
        });
      });
    });

    if (spinnerVisible) {
      sawSpinner = true;
    }

    const hasNewResponse = state.relevantResponseCount > baselineResponseCount;
    if (hasNewResponse) {
      gotNewResponse = true;
    }

    // Most pages should render after first calc response.
    if (gotNewResponse) {
      if (!spinnerVisible) {
        break;
      }
      if ((Date.now() - start) > 1100) {
        break;
      }
    } else {
      // No response observed: treat as non-calc or instant local update.
      if (!spinnerVisible && (Date.now() - start) > 320) {
        break;
      }
      if (spinnerVisible && sawSpinner && (Date.now() - start) > 900) {
        break;
      }
    }

    await page.waitForTimeout(60);
  }

  await waitQuiet(page, 80);
  return Date.now() - start;
}

async function measurePage(page, state, mainTab, innerTab, thresholdMs) {
  const pageId = toPageId(mainTab, innerTab);

  await dismissBlockingLayers(page);
  const switchStart = Date.now();
  await waitQuiet(page, 180);
  const switchMs = Date.now() - switchStart;

  const buttons = await collectVisibleButtons(page);
  const action = pickActionButton(buttons);

  const item = {
    mainTab,
    innerTab: innerTab || '',
    pageId,
    actionText: action ? trimText(action.text) : '',
    switchMs,
    computeMs: null,
    totalMs: switchMs,
    over1s: false,
    notes: '',
  };

  if (!action) {
    item.notes = 'no-action-button';
    item.over1s = item.totalMs > thresholdMs;
    return item;
  }

  const baseline = state.relevantResponseCount;
  const computeStart = Date.now();

  const clickResult = await clickActionButton(page, action, 3);
  if (!clickResult.ok) {
    item.notes = `action-click-failed: ${trimText(clickResult.error && clickResult.error.message)}`;
    item.over1s = true;
    return item;
  }

  const settleMs = await waitComputeFinish(page, state, baseline, 10000);
  item.computeMs = Date.now() - computeStart;
  item.totalMs = switchMs + settleMs;
  item.over1s = item.totalMs > thresholdMs;
  return item;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url || 'http://127.0.0.1:8000/index.html';
  const timeoutMs = Number(args.timeout || 240000);
  const thresholdMs = Number(args.threshold || 1000);
  const maxInnerTabs = Number(args.maxInnerTabs || 16);
  const maxRuntimeMs = Number(args.maxRuntime || 900000);
  const outputFile = args.output
    ? path.resolve(args.output)
    : path.resolve(process.cwd(), `PAGE_PERF_BENCH_${Date.now()}.json`);

  const report = {
    startedAt: nowIso(),
    url,
    thresholdMs,
    timeoutMs,
    maxInnerTabs,
    pages: [],
    missingMainTabs: [],
    consoleErrors: [],
    pageErrors: [],
    requestFailures: [],
    summary: null,
  };

  const state = {
    pendingRelevant: 0,
    relevantResponseCount: 0,
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  const isRelevantUrl = (urlStr) => {
    const urlTxt = String(urlStr || '');
    if (/\/static\//.test(urlTxt)) return false;
    if (/\.woff2?$|\.ttf$|\.css$|\.png$|\.jpg$|\.jpeg$|\.gif$|\.svg$|\.map$/i.test(urlTxt)) return false;
    return /127\.0\.0\.1:(8899|9999)/.test(urlTxt) || /\/api\//.test(urlTxt);
  };

  page.on('request', (req) => {
    if (isRelevantUrl(req.url())) {
      state.pendingRelevant += 1;
    }
  });
  page.on('requestfinished', (req) => {
    if (isRelevantUrl(req.url())) {
      state.pendingRelevant = Math.max(0, state.pendingRelevant - 1);
      state.relevantResponseCount += 1;
    }
  });
  page.on('requestfailed', (req) => {
    if (isRelevantUrl(req.url())) {
      state.pendingRelevant = Math.max(0, state.pendingRelevant - 1);
    }
    const failure = req.failure();
    report.requestFailures.push({
      at: nowIso(),
      method: req.method(),
      url: req.url(),
      reason: failure ? failure.errorText : 'unknown',
    });
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    report.consoleErrors.push({ at: nowIso(), text: trimText(msg.text()) });
  });
  page.on('pageerror', (err) => {
    report.pageErrors.push({ at: nowIso(), text: trimText(err && err.message) });
  });

  try {
    const runStart = Date.now();
    const overTime = () => (Date.now() - runStart) > maxRuntimeMs;

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await waitQuiet(page, 1200);

    for (const mainTab of MAIN_TABS) {
      if (overTime()) break;

      const clickedMain = await clickTabByText(page, mainTab);
      if (!clickedMain) {
        report.missingMainTabs.push(mainTab);
        continue;
      }
      await waitQuiet(page, 250);

      // Measure the main tab itself.
      const mainRow = await measurePage(page, state, mainTab, '', thresholdMs);
      report.pages.push(mainRow);

      // Measure each inner tab.
      const innerTabs = (await collectInnerTabs(page)).slice(0, maxInnerTabs);
      for (const innerTab of innerTabs) {
        if (overTime()) break;
        const clickedInner = await clickTabByText(page, innerTab);
        if (!clickedInner) continue;
        await waitQuiet(page, 220);
        const innerRow = await measurePage(page, state, mainTab, innerTab, thresholdMs);
        report.pages.push(innerRow);
      }
    }
  } finally {
    await browser.close();
  }

  const over1s = report.pages.filter((p) => p.over1s);
  const noAction = report.pages.filter((p) => p.notes === 'no-action-button');
  const measured = report.pages.filter((p) => p.notes !== 'no-action-button');
  const maxTotal = report.pages.reduce((m, p) => Math.max(m, Number(p.totalMs || 0)), 0);

  report.summary = {
    totalPages: report.pages.length,
    measuredPages: measured.length,
    noActionPages: noAction.length,
    overThresholdPages: over1s.length,
    thresholdMs,
    maxTotalMs: maxTotal,
    pass: over1s.length === 0,
  };
  report.endedAt = nowIso();

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2), 'utf8');

  console.log(`PERF_REPORT=${outputFile}`);
  console.log(`PERF_SUMMARY=${JSON.stringify(report.summary)}`);
  if (!report.summary.pass) {
    console.log('PERF_OVER_1S_PAGES:');
    for (const row of over1s.slice(0, 40)) {
      console.log(` - ${row.pageId} | total=${row.totalMs}ms | action=${row.actionText || '-'} | note=${row.notes || '-'}`);
    }
    process.exitCode = 2;
  }
}

run().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
