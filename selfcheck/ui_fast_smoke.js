const { chromium } = require('../local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/node_modules/playwright');

const APP_URL = process.env.HOROSA_APP_URL || 'http://127.0.0.1:8000/index.html?srv=http%3A%2F%2F127.0.0.1%3A9999#/';

function normalizeText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

async function wait(page, ms = 100) {
  await page.waitForTimeout(ms);
}

async function clickVisibleTab(page, selector, label) {
  const normalizedLabel = normalizeText(label);
  let matchIndex = -1;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    matchIndex = await page.locator(selector).evaluateAll((nodes, expected) => {
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
        const visible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        if (visible && text === expected) {
          return i;
        }
      }
      return -1;
    }, normalizedLabel);
    if (matchIndex >= 0) {
      break;
    }
    await wait(page, 180);
  }
  if (matchIndex < 0) {
    throw new Error(`Visible tab not found: ${normalizedLabel}`);
  }
  const locator = page.locator(selector).nth(matchIndex);
  await locator.waitFor({ state: 'visible', timeout: 8000 });
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click({ force: true });
  await wait(page, 120);
}

async function clickRoot(page, label) {
  await clickVisibleTab(page, '.mainRootTabs .ant-tabs-tab', label);
  await wait(page, 220);
}

async function bodyHasError(page) {
  const text = normalizeText(await page.locator('body').textContent());
  return /排盘失败|param error|Traceback|未就绪|白屏/i.test(text);
}

function activePane(page) {
  return page.locator('.mainRootTabs > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane-active').first();
}

async function clickPaneText(page, label) {
  await activePane(page).waitFor({ state: 'visible', timeout: 8000 });
  await clickVisibleTab(page, '.mainRootTabs > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane-active .ant-tabs-tab', label);
  await wait(page, 80);
}

async function closeOverlay(page) {
  const closeButtons = page.locator('.ant-drawer-close:visible, .ant-modal-close:visible');
  if (await closeButtons.count().catch(() => 0)) {
    await closeButtons.last().click({ force: true }).catch(() => {});
  }
  await page.keyboard.press('Escape').catch(() => {});
  await wait(page, 100);
}

async function waitForAppReady(page) {
  await page.goto(APP_URL, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  });
  await page.locator('.mainRootTabs .ant-tabs-nav .ant-tabs-tab').first().waitFor({ state: 'visible', timeout: 20000 });
  await wait(page, 250);
}

async function clickAiExportItem(page, itemText) {
  const button = page.getByRole('button', { name: 'AI导出', exact: true }).first();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await button.click({ force: true });
    await wait(page, 150);
    const menuItem = page.locator('.ant-dropdown:visible').getByText(itemText, { exact: true }).first();
    if (await menuItem.isVisible().catch(() => false)) {
      await menuItem.click({ force: true });
      return;
    }
    await page.keyboard.press('Escape').catch(() => {});
    await wait(page, 100);
  }
  throw new Error(`AI导出菜单未出现：${itemText}`);
}

async function main() {
  const startedAt = Date.now();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.setDefaultTimeout(8000);
  const pageErrors = [];
  const consoleErrors = [];
  const failures = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await waitForAppReady(page);

  const results = {
    topbar: {},
    rootTabs: [],
    representatives: [],
    timings: {},
  };

  // Topbar quick checks
  const memoStarted = Date.now();
  try {
    await page.getByRole('button', { name: '批 注', exact: true }).click({ force: true });
    await page.locator('.ant-drawer-content-wrapper').last().waitFor({ state: 'visible', timeout: 8000 });
    const memoDrawer = page.locator('.ant-drawer-content-wrapper').last();
    results.topbar.memoVisible = await memoDrawer.isVisible().catch(() => false);
    results.topbar.memoText = normalizeText(await memoDrawer.innerText().catch(() => '')).slice(0, 120);
    await closeOverlay(page);
  } catch (error) {
    failures.push({ area: 'topbar', item: '批注', error: error.message });
  }
  results.timings.memoMs = Date.now() - memoStarted;

  const chartStarted = Date.now();
  try {
    await page.getByRole('button', { name: '星盘组件', exact: true }).click({ force: true });
    await page.locator('.ant-drawer-content-wrapper').last().waitFor({ state: 'visible', timeout: 8000 });
    const chartDrawer = page.locator('.ant-drawer-content-wrapper').last();
    results.topbar.annotationToggle = await chartDrawer.locator('.ant-checkbox-wrapper').evaluateAll((nodes) => {
      const node = nodes.find((n) => ((n.innerText || n.textContent || '').replace(/\s+/g, ' ').trim()) === '显示星/宫/座/相释义');
      if (!node) return { found: false };
      const input = node.querySelector('input[type="checkbox"]');
      const before = input ? !!input.checked : null;
      node.click();
      const after = input ? !!input.checked : null;
      return { found: true, before, after, toggled: before !== after };
    });
    await closeOverlay(page);
  } catch (error) {
    failures.push({ area: 'topbar', item: '星盘组件', error: error.message });
  }
  results.timings.chartComponentsMs = Date.now() - chartStarted;

  const aiStarted = Date.now();
  try {
    await clickAiExportItem(page, '复制AI纯文字');
    await wait(page, 250);
    results.topbar.aiExportMessage = normalizeText(await page.locator('.ant-message-notice').last().innerText().catch(() => ''));
    await closeOverlay(page);
  } catch (error) {
    failures.push({ area: 'topbar', item: 'AI导出', error: error.message });
  }
  results.timings.aiExportMs = Date.now() - aiStarted;

  const manageStarted = Date.now();
  try {
    const manageTrigger = page.getByText('管理', { exact: true }).last();
    await manageTrigger.click({ force: true });
    await wait(page, 120);
    await page.locator('.ant-dropdown:visible').getByText('新增命盘', { exact: true }).first().click({ force: true });
    await page.locator('.ant-drawer-content-wrapper').last().waitFor({ state: 'visible', timeout: 8000 });
    const manageDrawer = page.locator('.ant-drawer-content-wrapper').last();
    results.topbar.manageDrawerTitle = normalizeText(await manageDrawer.locator('.ant-drawer-title').innerText().catch(() => ''));
    await closeOverlay(page);
  } catch (error) {
    failures.push({ area: 'topbar', item: '管理', error: error.message });
  }
  results.timings.manageMs = Date.now() - manageStarted;

  const rootLabels = [
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
  const rootStarted = Date.now();
  for (const label of rootLabels) {
    try {
      await clickRoot(page, label);
      results.rootTabs.push({
        label,
        hasError: await bodyHasError(page),
      });
    } catch (error) {
      results.rootTabs.push({
        label,
        hasError: true,
        clickError: error.message,
      });
      failures.push({ area: 'rootTabs', item: label, error: error.message });
    }
  }
  results.timings.rootTabsMs = Date.now() - rootStarted;

  const reps = [];
  const repsStarted = Date.now();
  for (const [rootLabel, tabLabel] of reps) {
    try {
      await clickRoot(page, rootLabel);
      await clickPaneText(page, tabLabel);
      results.representatives.push({
        rootLabel,
        tabLabel,
        hasError: await bodyHasError(page),
      });
    } catch (error) {
      results.representatives.push({
        rootLabel,
        tabLabel,
        hasError: true,
        clickError: error.message,
      });
      failures.push({ area: 'representatives', item: `${rootLabel}/${tabLabel}`, error: error.message });
    }
  }
  results.timings.representativesMs = Date.now() - repsStarted;
  results.timings.totalMs = Date.now() - startedAt;

  console.log(JSON.stringify({ results, failures, pageErrors, consoleErrors }, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
