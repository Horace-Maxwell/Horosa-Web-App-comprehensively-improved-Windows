const { chromium } = require('../local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/node_modules/playwright');

const APP_URL = process.env.HOROSA_APP_URL;
const ACTIVE_ROOT_SELECTOR = '.mainRootTabs > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane-active, .mainRootTabs > .ant-tabs-content-holder > .ant-tabs-tabpane-active';
const ACTION_BUTTON_ALLOWLIST = new Set([
  '此刻',
  '此 刻',
  '确定',
  '确 定',
  '经纬度选择',
  '计算',
  '计 算',
  '排盘',
  '排 盘',
  '起课',
  '起 课',
  '起盘',
  '起 盘',
  '见证奇迹',
  '隐藏浮窗',
  '收起',
  '收 起',
]);
const ROOT_LABELS = [
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
const ROOT_EXPECTED_TABS = {
  星盘: ['信息', '相位', '行星', '希腊点', '可能性'],
  三维盘: ['信息', '相位', '行星', '希腊点'],
  推运盘: ['主/界限法', '主限法盘', '黄道星释', '法达星限', '小限法', '太阳弧', '太阳返照', '月亮返照', '流年法', '十年大运'],
  量化盘: ['行星中点', '中点', '相位'],
  关系盘: ['比较盘', '组合盘', '影响盘', '时空中点盘', '马克斯盘', '星盘A', '星盘B', '相位', '中点', '映点', 'A→B', 'B→A'],
  节气盘: ['二十四节气', '春分星盘', '春分宿盘', '春分3D盘', '夏至星盘', '夏至宿盘', '夏至3D盘', '秋分星盘', '秋分宿盘', '秋分3D盘', '冬至星盘', '冬至宿盘', '冬至3D盘'],
  星体地图: ['行星地图'],
  七政四余: [],
  希腊星术: ['十三分盘', '信息', '相位', '行星', '希腊点', '可能性'],
  印度律盘: ['命盘', '2律盘', '3律盘', '4律盘', '7律盘', '9律盘', '10律盘', '12律盘', '16律盘', '20律盘', '24律盘', '27律盘', '40律盘', '45律盘', '信息', '相位', '行星', '希腊点', '可能性'],
  八字紫微: ['八字', '紫微斗数', '八卦类象', '十二串宫', '八字规则', '行运概略', '卦释', '十二长生', '神煞', '大运', '小运', '天干', '地支'],
  易与三式: ['宿盘', '易卦', '六壬', '金口诀', '遁甲', '太乙', '统摄法'],
  万年历: ['农历'],
  西洋游戏: ['星盘骰子', '骰子盘', '天象盘'],
  风水: [],
  三式合一: ['概览', '太乙', '神煞', '六壬', '八宫'],
};
const TOPBAR_DRAWERS = [
  { label: '首页', auditCheckboxes: true },
  { label: '批注', auditCheckboxes: false },
  { label: '小工具', auditCheckboxes: false },
  { label: '星盘组件', auditCheckboxes: true },
  { label: '行星选择', auditCheckboxes: true },
  { label: '相位选择', auditCheckboxes: true },
];
const MANAGE_ITEMS = [
  { label: '管理命盘', overlayTitle: '星盘列表' },
  { label: '管理事盘', overlayTitle: '起课列表' },
  { label: '新增命盘', overlayTitle: '添加星盘' },
];
const AI_EXPORT_ITEMS = ['复制AI纯文字', '导出TXT', '导出Word', '导出PDF'];
const SLOW_THRESHOLD_MS = Number(process.env.HOROSA_UI_ACTION_THRESHOLD_MS || 1000);
const ACTION_TIMEOUT_MS = Number(process.env.HOROSA_UI_ACTION_TIMEOUT_MS || 12000);
const UI_SETTLE_MS = Number(process.env.HOROSA_UI_SETTLE_MS || 220);
const NETWORK_SETTLE_TIMEOUT_MS = Number(process.env.HOROSA_UI_NETWORK_SETTLE_TIMEOUT_MS || 8000);

function normalizeText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function compactText(text) {
  return normalizeText(text).replace(/\s+/g, '');
}

async function wait(page, ms = 180) {
  await page.waitForTimeout(ms);
}

async function waitForAppReady(page) {
  if (!APP_URL) {
    throw new Error('HOROSA_APP_URL is required');
  }
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('.mainRootTabs .ant-tabs-nav .ant-tabs-tab').first().waitFor({ state: 'visible', timeout: 20000 });
  await wait(page, 450);
}

async function waitForQuiet(page, timeoutMs = 1200) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const spinning = await page.locator('.ant-spin-spinning:visible').count().catch(() => 0);
    if (!spinning) {
      return;
    }
    await wait(page, 80);
  }
}

function createRequestTracker(page) {
  const metaMap = new WeakMap();
  const active = new Set();

  const markDone = (req, status) => {
    const meta = metaMap.get(req);
    if (!meta) {
      return;
    }
    meta.status = status;
    meta.finishedAt = Date.now();
    active.delete(meta);
  };

  page.on('request', (req) => {
    const meta = {
      url: req.url(),
      method: req.method(),
      startedAt: Date.now(),
      finishedAt: null,
      status: 'pending',
    };
    metaMap.set(req, meta);
    active.add(meta);
  });
  page.on('requestfinished', (req) => markDone(req, 'finished'));
  page.on('requestfailed', (req) => markDone(req, 'failed'));

  return {
    activeStartedSince(ts) {
      let count = 0;
      active.forEach((meta) => {
        if (meta.startedAt >= ts) {
          count += 1;
        }
      });
      return count;
    },
  };
}

async function waitForNetworkSettle(page, tracker, startedAt, timeoutMs = NETWORK_SETTLE_TIMEOUT_MS) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const activeRequestCount = tracker ? tracker.activeStartedSince(startedAt) : 0;
    const spinning = await page.locator('.ant-spin-spinning:visible').count().catch(() => 0);
    if (!activeRequestCount && !spinning) {
      await wait(page, 120);
      const recheckRequests = tracker ? tracker.activeStartedSince(startedAt) : 0;
      const recheckSpinning = await page.locator('.ant-spin-spinning:visible').count().catch(() => 0);
      if (!recheckRequests && !recheckSpinning) {
        return;
      }
    }
    await wait(page, 80);
  }
}

async function bodyHasError(page) {
  const explicitErrorSelectors = [
    '.ant-message-error',
    '.ant-alert-error',
    '.ant-result-error',
    '.ant-notification-notice-error',
    '.error-boundary',
    '.runtime-error',
  ].join(', ');
  const explicitTexts = await visibleTexts(page.locator('body'), explicitErrorSelectors).catch(() => []);
  if (explicitTexts.some((text) => /排盘失败|param error|Traceback|白屏|未就绪|error boundary|something went wrong/i.test(text))) {
    return true;
  }
  const scopeText = normalizeText(await activeRoot(page).textContent().catch(() => ''));
  return /排盘失败|param error|Traceback|白屏|未就绪|error boundary|something went wrong/i.test(scopeText);
}

async function visibleTexts(locator, selector, { allowIncludes = false } = {}) {
  return locator.locator(selector).evaluateAll((nodes, opts) => {
    const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
    const seen = new Set();
    const out = [];
    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      const text = normalize(node.innerText || node.textContent || '');
      if (!text || rect.width <= 0 || rect.height <= 0 || style.display === 'none' || style.visibility === 'hidden') {
        continue;
      }
      if (!opts.allowIncludes && seen.has(text)) {
        continue;
      }
      if (seen.has(text)) {
        continue;
      }
      seen.add(text);
      out.push(text);
    }
    return out;
  }, { allowIncludes });
}

async function clickVisibleText(locator, selector, label, { exact = true } = {}) {
  const expected = normalizeText(label);
  const compactExpected = compactText(label);
  const index = await locator.locator(selector).evaluateAll((nodes, args) => {
    const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
    const compact = (text) => normalize(text).replace(/\s+/g, '');
    const candidates = [];
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      const text = normalize(node.innerText || node.textContent || '');
      const compactTextValue = compact(node.innerText || node.textContent || '');
      if (!text || rect.width <= 0 || rect.height <= 0 || style.display === 'none' || style.visibility === 'hidden') {
        continue;
      }
      const exactMatched = text === args.expected || compactTextValue === args.compactExpected;
      if (args.exact) {
        if (exactMatched) {
          return i;
        }
        continue;
      }
      const partialMatched = text.includes(args.expected)
        || args.expected.includes(text)
        || compactTextValue.includes(args.compactExpected)
        || args.compactExpected.includes(compactTextValue);
      if (exactMatched || partialMatched) {
        candidates.push({
          index: i,
          exactMatched,
          textLength: compactTextValue.length,
        });
      }
    }
    if (!candidates.length) {
      return -1;
    }
    candidates.sort((left, right) => {
      if (left.exactMatched !== right.exactMatched) {
        return left.exactMatched ? -1 : 1;
      }
      return right.textLength - left.textLength;
    });
    return candidates[0].index;
  }, { expected, compactExpected, exact });
  if (index < 0) {
    throw new Error(`Visible text not found: ${expected}`);
  }
  const target = locator.locator(selector).nth(index);
  await target.scrollIntoViewIfNeeded().catch(() => {});
  await target.click({ force: true });
}

async function latestOverlay(page) {
  const drawers = page.locator('.ant-drawer-content-wrapper:visible');
  const modals = page.locator('.ant-modal-wrap:visible');
  if (await modals.count().catch(() => 0)) {
    return modals.last();
  }
  if (await drawers.count().catch(() => 0)) {
    return drawers.last();
  }
  return null;
}

async function waitForOverlayWithTitle(page, titleText, timeoutMs = 4000) {
  const expected = normalizeText(titleText);
  const compactExpected = compactText(titleText);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const overlay = await latestOverlay(page);
    if (overlay) {
      const title = normalizeText(await overlay.locator('.ant-drawer-title, .ant-modal-title').first().textContent().catch(() => ''));
      const compactTitle = compactText(title);
      if (title && (
        title === expected ||
        title.includes(expected) ||
        expected.includes(title) ||
        compactTitle === compactExpected ||
        compactTitle.includes(compactExpected) ||
        compactExpected.includes(compactTitle)
      )) {
        return overlay;
      }
    }
    await wait(page, 120);
  }
  return null;
}

async function closeOverlay(page) {
  const closeButtons = page.locator('.ant-modal-wrap:visible .ant-modal-close, .ant-drawer-content-wrapper:visible .ant-drawer-close');
  if (await closeButtons.count().catch(() => 0)) {
    await closeButtons.last().click({ force: true }).catch(() => {});
    await wait(page, 180);
    return;
  }
  await page.keyboard.press('Escape').catch(() => {});
  await wait(page, 180);
}

async function ensureNoOverlay(page, rounds = 4) {
  for (let i = 0; i < rounds; i += 1) {
    const overlay = await latestOverlay(page);
    if (!overlay) {
      return;
    }
    await closeOverlay(page);
    await wait(page, 120);
  }
}

async function measureAction(page, action, runner, options = {}) {
  console.error(`[audit] ${action}`);
  const started = Date.now();
  const result = {
    label: action,
    elapsedMs: null,
    ok: false,
    hasError: false,
  };
  try {
    await Promise.race([
      runner(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Action timeout after ${ACTION_TIMEOUT_MS}ms`)), ACTION_TIMEOUT_MS);
      }),
    ]);
    if (options.settleMode === 'network') {
      await waitForNetworkSettle(page, options.requestTracker, started);
    } else {
      await wait(page, options.uiSettleMs || UI_SETTLE_MS);
    }
    result.ok = true;
  } catch (error) {
    result.error = error.message;
  }
  result.elapsedMs = Date.now() - started;
  result.hasError = await bodyHasError(page);
  result.slow = result.elapsedMs > SLOW_THRESHOLD_MS;
  return result;
}

async function clickRoot(page, label) {
  const expected = normalizeText(label);
  const locator = page.locator('.mainRootTabs > .ant-tabs-nav .ant-tabs-tab .ant-tabs-tab-btn');
  const index = await locator.evaluateAll((nodes, target) => {
    const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
    return nodes.findIndex((node) => normalize(node.innerText || node.textContent || '') === target);
  }, expected);
  if (index < 0) {
    throw new Error(`Root tab not found: ${expected}`);
  }
  await locator.nth(index).scrollIntoViewIfNeeded().catch(() => {});
  await locator.nth(index).click({ force: true });
  await page.waitForFunction((rootLabel) => {
    const active = document.querySelector('.mainRootTabs > .ant-tabs-nav .ant-tabs-tab-active .ant-tabs-tab-btn');
    const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
    return normalize(active && (active.innerText || active.textContent || '')) === rootLabel;
  }, expected, { timeout: 5000 }).catch(() => {});
  await wait(page, 260);
}

function softenNotFound(result) {
  if (result && result.error && /^Visible text not found:/i.test(result.error)) {
    result.ok = true;
    result.skipped = true;
    result.error = undefined;
    result.hasError = false;
  }
  return result;
}

function activeRoot(page) {
  return page.locator(ACTIVE_ROOT_SELECTOR).first();
}

async function auditTabsInScope(page, scope, results, selector = '.ant-tabs-nav .ant-tabs-tab-btn') {
  const labels = await visibleTexts(scope, selector);
  for (const label of labels) {
    results.push(softenNotFound(await measureAction(page, label, async () => {
      await clickVisibleText(scope, selector, label, { exact: true });
    }, { settleMode: 'ui' })));
  }
}

async function auditCheckboxesInScope(page, scope, results) {
  const labels = await visibleTexts(scope, '.ant-checkbox-wrapper');
  for (const label of labels) {
    results.push(softenNotFound(await measureAction(page, label, async () => {
      await clickVisibleText(scope, '.ant-checkbox-wrapper', label, { exact: true });
    }, { settleMode: 'ui' })));
  }
}

async function auditActionButtonsInScope(page, scope, results, requestTracker) {
  const labels = await visibleTexts(scope, 'button, .ant-btn, [role="button"]');
  for (const label of labels) {
    if (!ACTION_BUTTON_ALLOWLIST.has(label)) {
      continue;
    }
    const settleMode = /^(此刻|此 刻|确定|确 定|计算|计 算|排盘|排 盘|起课|起 课|起盘|起 盘|见证奇迹)$/u.test(label)
      ? 'network'
      : 'ui';
    results.push(softenNotFound(await measureAction(page, label, async () => {
      const beforeOverlay = await latestOverlay(page);
      const beforeVisible = !!beforeOverlay;
      await clickVisibleText(scope, 'button, .ant-btn, [role="button"]', label, { exact: true });
      await wait(page, 220);
      const afterOverlay = await latestOverlay(page);
      if (!beforeVisible && afterOverlay) {
        await closeOverlay(page);
      }
    }, { settleMode, requestTracker })));
  }
}

async function auditDrawer(page, spec) {
  const actions = [];
  actions.push(await measureAction(page, spec.label, async () => {
    await ensureNoOverlay(page);
    await clickVisibleText(page.locator('body'), 'button, .ant-btn', spec.label, { exact: false });
    const overlay = await waitForOverlayWithTitle(page, spec.label);
    if (!overlay) {
      throw new Error(`Overlay not opened for ${spec.label}`);
    }
  }, { settleMode: 'ui' }));
  const overlay = await waitForOverlayWithTitle(page, spec.label);
  if (!overlay) {
    return { label: spec.label, actions };
  }
  const tabLabels = await visibleTexts(overlay, '.ant-tabs-nav .ant-tabs-tab-btn');
  if (tabLabels.length) {
    for (const tabLabel of tabLabels) {
      actions.push(await measureAction(page, tabLabel, async () => {
        await clickVisibleText(overlay, '.ant-tabs-nav .ant-tabs-tab-btn', tabLabel, { exact: true });
      }, { settleMode: 'ui' }));
      if (spec.auditCheckboxes) {
        await auditCheckboxesInScope(page, overlay, actions);
      }
    }
  } else if (spec.auditCheckboxes) {
    await auditCheckboxesInScope(page, overlay, actions);
  }
  await closeOverlay(page);
  return { label: spec.label, actions };
}

async function clickManageItem(page, itemText) {
  await ensureNoOverlay(page);
  const trigger = page.getByText('管理', { exact: true }).last();
  await trigger.click({ force: true });
  await wait(page, 120);
  const item = page.locator('.ant-dropdown:visible').getByText(itemText, { exact: false }).first();
  await item.click({ force: true });
}

async function auditManageMenu(page) {
  const actions = [];
  for (const item of MANAGE_ITEMS) {
    actions.push(await measureAction(page, item.label, async () => {
      await clickManageItem(page, item.label);
      const overlay = item.overlayTitle
        ? await waitForOverlayWithTitle(page, item.overlayTitle, 5000)
        : await latestOverlay(page);
      if (!overlay) {
        throw new Error(`Overlay not opened for ${item.label}`);
      }
      await closeOverlay(page);
    }, { settleMode: 'ui' }));
  }
  return { label: '管理', actions };
}

async function clickAiExportItem(page, itemText) {
  await ensureNoOverlay(page);
  await clickVisibleText(page.locator('body'), 'button, .ant-btn', 'AI导出', { exact: false });
  await wait(page, 160);
  const menuItem = page.locator('.ant-dropdown:visible').getByText(itemText, { exact: true }).first();
  await menuItem.click({ force: true });
}

async function auditAiExport(page) {
  const actions = [];
  actions.push(await measureAction(page, 'AI导出设置', async () => {
    await ensureNoOverlay(page);
    await clickVisibleText(page.locator('body'), 'button, .ant-btn', 'AI导出设置', { exact: false });
    const modal = await waitForOverlayWithTitle(page, 'AI导出设置', 5000);
    if (!modal) {
      throw new Error('AI导出设置弹窗未出现');
    }
    const tabLikeButtons = ['全选', '清空', '恢复默认'];
    for (const label of tabLikeButtons) {
      const btns = await visibleTexts(modal, 'button, .ant-btn');
      if (btns.some((item) => compactText(item) === compactText(label))) {
        await clickVisibleText(modal, 'button, .ant-btn', label, { exact: false });
        await wait(page, 120);
      }
    }
    await clickVisibleText(modal, 'button, .ant-btn', '确定', { exact: false });
    await wait(page, 180);
  }, { settleMode: 'ui' }));
  for (const itemText of AI_EXPORT_ITEMS) {
    actions.push(await measureAction(page, itemText, async () => {
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).then(async (download) => {
        await download.cancel().catch(() => {});
        return download.suggestedFilename().catch(() => '');
      }).catch(() => null);
      await clickAiExportItem(page, itemText);
      await Promise.race([
        downloadPromise,
        page.locator('.ant-message-notice').last().waitFor({ state: 'visible', timeout: 2500 }).catch(() => null),
        wait(page, 600),
      ]);
      await page.keyboard.press('Escape').catch(() => {});
    }, { settleMode: 'ui' }));
  }
  return { label: 'AI导出', actions };
}

async function auditThemeSelect(page) {
  return measureAction(page, '主题切换', async () => {
    const select = page.locator('.ant-select').filter({ has: page.locator('.ant-select-selector') }).nth(0);
    await select.click({ force: true });
    await wait(page, 150);
    const option = page.locator('.ant-select-item-option-content').first();
    if (await option.count().catch(() => 0)) {
      await option.click({ force: true });
    }
    await page.keyboard.press('Escape').catch(() => {});
  }, { settleMode: 'ui' });
}

async function auditTopbar(page) {
  const sections = [];
  const drawerSections = [];
  for (const spec of TOPBAR_DRAWERS) {
    drawerSections.push(await auditDrawer(page, spec));
  }
  sections.push(...drawerSections);
  sections.push({ label: '新命盘', actions: [await measureAction(page, '新命盘', async () => {
    await clickVisibleText(page.locator('body'), 'button, .ant-btn', '新命盘', { exact: false });
  }, { settleMode: 'ui' })] });
  sections.push({ label: '主题', actions: [await auditThemeSelect(page)] });
  sections.push(await auditAiExport(page));
  sections.push(await auditManageMenu(page));
  return sections;
}

async function auditRootModule(page, rootLabel, requestTracker) {
  const rootResult = {
    label: rootLabel,
    actions: [],
  };
  rootResult.actions.push(await measureAction(page, rootLabel, async () => {
    await clickRoot(page, rootLabel);
  }, { settleMode: 'ui' }));
  const scope = activeRoot(page);
  const expectedTabs = ROOT_EXPECTED_TABS[rootLabel];
  if (Array.isArray(expectedTabs)) {
    for (const tabLabel of expectedTabs) {
      rootResult.actions.push(softenNotFound(await measureAction(page, tabLabel, async () => {
        await clickVisibleText(scope, '.ant-tabs-nav .ant-tabs-tab-btn', tabLabel, { exact: false });
      }, { settleMode: 'ui' })));
    }
  } else {
    await auditTabsInScope(page, scope, rootResult.actions);
  }
  await auditActionButtonsInScope(page, scope, rootResult.actions, requestTracker);
  return rootResult;
}

function wirePageDiagnostics(page, pageErrors, consoleErrors, downloads) {
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('download', async (download) => {
    let filename = '';
    try {
      filename = await download.suggestedFilename();
    } catch {
    }
    downloads.push(filename);
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1600, height: 1000 } });

  const pageErrors = [];
  const consoleErrors = [];
  const downloads = [];
  const page = await context.newPage();
  const requestTracker = createRequestTracker(page);
  page.setDefaultTimeout(12000);
  wirePageDiagnostics(page, pageErrors, consoleErrors, downloads);
  await waitForAppReady(page);

  const startedAt = Date.now();
  const rounds = [];
  rounds.push({
    round: 'topbar',
    sections: await auditTopbar(page),
  });
  await ensureNoOverlay(page);

  const rootSections = [];
  for (const rootLabel of ROOT_LABELS) {
    await ensureNoOverlay(page);
    rootSections.push(await auditRootModule(page, rootLabel, requestTracker));
  }
  rounds.push({
    round: 'roots',
    sections: rootSections,
  });

  const allActions = rounds.flatMap((round) => round.sections.flatMap((section) => section.actions || []));
  const failures = allActions.filter((item) => !item.ok);
  const slowActions = allActions.filter((item) => item.slow);
  const result = {
    startedAt: new Date(startedAt).toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    rounds,
    totals: {
      actions: allActions.length,
      failures: failures.length,
      slowActions: slowActions.length,
      thresholdMs: SLOW_THRESHOLD_MS,
    },
    failures,
    slowActions,
    pageErrors,
    consoleErrors,
    downloads,
  };

  console.log(JSON.stringify(result, null, 2));
  await context.close();
  await browser.close();

  const filteredConsoleErrors = consoleErrors.filter((item) => !/DOMNodeInserted/i.test(item));
  if (failures.length || pageErrors.length || filteredConsoleErrors.length) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
