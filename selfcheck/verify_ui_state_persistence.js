const { chromium } = require('../local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/node_modules/playwright');

function normalizeText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

async function wait(page, ms = 120) {
  await page.waitForTimeout(ms);
}

async function waitForAppReady(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('.mainRootTabs .ant-tabs-nav .ant-tabs-tab').first().waitFor({ state: 'visible', timeout: 20000 });
  await wait(page, 500);
}

async function clickVisibleTab(page, selector, label) {
  const expected = normalizeText(label);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const matchIndex = await page.locator(selector).evaluateAll((nodes, exp) => {
      for (let i = 0; i < nodes.length; i += 1) {
        const node = nodes[i];
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
        const visible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        if (visible && text === exp) {
          return i;
        }
      }
      return -1;
    }, expected);
    if (matchIndex >= 0) {
      const target = page.locator(selector).nth(matchIndex);
      await target.scrollIntoViewIfNeeded().catch(() => {});
      const buttonLike = target.locator('.ant-tabs-tab-btn');
      if (await buttonLike.count().catch(() => 0)) {
        await buttonLike.first().click({ force: true });
      } else {
        await target.click({ force: true });
      }
      await wait(page, 180);
      return;
    }
    await wait(page, 180);
  }
  throw new Error(`Visible tab not found: ${expected}`);
}

const ROOT_TAB_ORDER = [
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

async function clickRoot(page, label) {
  const expected = normalizeText(label);
  const targetIndex = ROOT_TAB_ORDER.indexOf(expected);
  if (targetIndex < 0) {
    throw new Error(`Root tab not registered: ${expected}`);
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const ok = await page.evaluate((index) => {
      const buttons = Array.from(document.querySelectorAll('.mainRootTabs .ant-tabs-nav .ant-tabs-tab .ant-tabs-tab-btn'))
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          const style = window.getComputedStyle(node);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && rect.left < 220;
        })
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      const target = buttons[index];
      if (!target) {
        return false;
      }
      target.scrollIntoView({ block: 'nearest' });
      target.click();
      return true;
    }, targetIndex);
    if (ok) {
      await wait(page, 220);
      return;
    }
    await wait(page, 180);
  }
  throw new Error(`Root tab not found: ${expected}`);
}

async function clickCnYiBuSideTab(page, label) {
  const expected = normalizeText(label);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const ok = await page.evaluate((exp) => {
      const visible = (node) => {
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const legacyButtons = Array.from(document.querySelectorAll('[class*="cnYiBuSideNav"] button'))
        .filter((node) => visible(node));
      const legacyTarget = legacyButtons.find((node) => ((node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim() === exp));
      if (legacyTarget) {
        legacyTarget.click();
        return true;
      }
      const activePane = Array.from(document.querySelectorAll('.mainRootTabs > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane-active .ant-tabs-tab'))
        .find((node) => {
          if (!visible(node)) {
            return false;
          }
          const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
          return text === exp || text.indexOf(exp) >= 0;
        });
      if (!activePane) {
        return false;
      }
      const btn = activePane.querySelector('.ant-tabs-tab-btn') || activePane;
      btn.click();
      return true;
    }, expected);
    if (ok) {
      await wait(page, 200);
      return;
    }
    await wait(page, 180);
  }
  throw new Error(`CnYiBu tab not found: ${expected}`);
}

async function closeOverlay(page) {
  const closeButtons = page.locator('.ant-drawer-close:visible, .ant-modal-close:visible');
  if (await closeButtons.count().catch(() => 0)) {
    await closeButtons.last().click({ force: true }).catch(() => {});
  }
  await page.keyboard.press('Escape').catch(() => {});
  await wait(page, 120);
}

async function openTopbarDrawer(page, label) {
  const button = page.getByRole('button', { name: label, exact: true });
  if (await button.count().catch(() => 0)) {
    await button.first().click({ force: true });
  } else {
    const clicked = await page.evaluate((expected) => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const target = buttons.find((node) => {
        const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return text === expected && rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      });
      if (!target) {
        return false;
      }
      target.click();
      return true;
    }, label);
    if (!clicked) {
      throw new Error(`Topbar button not found: ${label}`);
    }
  }
  const drawer = page.locator('.ant-drawer-content-wrapper').last();
  await drawer.waitFor({ state: 'visible', timeout: 10000 });
  await wait(page, 180);
}

async function setCheckboxStateInLastDrawer(page, label, targetChecked) {
  const drawer = page.locator('.ant-drawer-content-wrapper').last();
  await drawer.waitFor({ state: 'visible', timeout: 10000 });
  const result = await drawer.locator('.ant-checkbox-wrapper').evaluateAll((nodes, data) => {
    const expected = data.label.replace(/\s+/g, ' ').trim();
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
      const visible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      if (!visible || text !== expected) {
        continue;
      }
      const input = node.querySelector('input[type="checkbox"]');
      const checked = !!(input && input.checked);
      return { index: i, checked };
    }
    return { index: -1, checked: false };
  }, { label });
  if (result.index < 0) {
    throw new Error(`Checkbox not found in drawer: ${label}`);
  }
  if (result.checked !== targetChecked) {
    await drawer.locator('.ant-checkbox-wrapper').nth(result.index).click({ force: true });
    await wait(page, 300);
  }
}

async function readCheckboxStateInLastDrawer(page, label) {
  const drawer = page.locator('.ant-drawer-content-wrapper').last();
  await drawer.waitFor({ state: 'visible', timeout: 10000 });
  const result = await drawer.locator('.ant-checkbox-wrapper').evaluateAll((nodes, expected) => {
    const normalized = expected.replace(/\s+/g, ' ').trim();
    for (let i = 0; i < nodes.length; i += 1) {
      const node = nodes[i];
      const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      const visible = rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      if (!visible || text !== normalized) {
        continue;
      }
      const input = node.querySelector('input[type="checkbox"]');
      return !!(input && input.checked);
    }
    return null;
  }, label);
  if (result === null) {
    throw new Error(`Checkbox not found in drawer: ${label}`);
  }
  return !!result;
}

async function selectOptionInActivePane(page, selectIndex, optionLabel) {
  const activePaneSelector = '.mainRootTabs .ant-tabs-content-holder .ant-tabs-tabpane-active[aria-hidden="false"], .mainRootTabs .ant-tabs-content-holder .ant-tabs-tabpane-active';
  await page.waitForFunction((selector) => document.querySelectorAll(selector).length > 0 || document.querySelector('[class*="cnYiBuPaneActive"]'), activePaneSelector, { timeout: 10000 });
  const opened = await page.evaluate(({ selector, selectIndex }) => {
    const globalCnYiBuPane = Array.from(document.querySelectorAll('[class*="cnYiBuPaneActive"]')).find((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    const panes = Array.from(document.querySelectorAll(selector));
    const rootPane = panes[panes.length - 1];
    const pane = globalCnYiBuPane || rootPane;
    if (!pane) {
      return false;
    }
    const selects = Array.from(pane.querySelectorAll('.ant-select')).filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    const target = selects[selectIndex];
    if (!target) {
      return false;
    }
    target.scrollIntoView({ block: 'nearest' });
    target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    target.click();
    return true;
  }, { selector: activePaneSelector, selectIndex });
  if (!opened) {
    throw new Error(`Active pane select not found at index ${selectIndex}`);
  }
  await wait(page, 200);
  const option = page.locator('.ant-select-dropdown:visible .ant-select-item-option-content', { hasText: optionLabel }).first();
  await option.waitFor({ state: 'visible', timeout: 10000 });
  await option.click({ force: true });
  await wait(page, 450);
}

async function readActivePaneSelectText(page, selectIndex) {
  const activePaneSelector = '.mainRootTabs .ant-tabs-content-holder .ant-tabs-tabpane-active[aria-hidden="false"], .mainRootTabs .ant-tabs-content-holder .ant-tabs-tabpane-active';
  await page.waitForFunction((selector) => document.querySelectorAll(selector).length > 0 || document.querySelector('[class*="cnYiBuPaneActive"]'), activePaneSelector, { timeout: 10000 });
  const text = await page.evaluate(({ selector, selectIndex }) => {
    const globalCnYiBuPane = Array.from(document.querySelectorAll('[class*="cnYiBuPaneActive"]')).find((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    const panes = Array.from(document.querySelectorAll(selector));
    const rootPane = panes[panes.length - 1];
    const pane = globalCnYiBuPane || rootPane;
    if (!pane) {
      return null;
    }
    const selects = Array.from(pane.querySelectorAll('.ant-select')).filter((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    const target = selects[selectIndex];
    return target ? (target.innerText || target.textContent || '') : null;
  }, { selector: activePaneSelector, selectIndex });
  if (text === null) {
    throw new Error(`Active pane select text not found at index ${selectIndex}`);
  }
  return normalizeText(text);
}

async function selectVisiblePaneOptionByCurrentText(page, currentTextCandidates, optionLabel) {
  const normalizedCandidates = currentTextCandidates.map((item) => normalizeText(item));
  const activePaneSelector = '.mainRootTabs .ant-tabs-content-holder .ant-tabs-tabpane-active[aria-hidden="false"], .mainRootTabs .ant-tabs-content-holder .ant-tabs-tabpane-active';
  await page.waitForFunction((selector) => document.querySelectorAll(selector).length > 0 || document.querySelector('[class*="cnYiBuPaneActive"]'), activePaneSelector, { timeout: 10000 });
  const opened = await page.evaluate(({ selector, candidates }) => {
    const visible = (node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const globalCnYiBuPane = Array.from(document.querySelectorAll('[class*="cnYiBuPaneActive"]')).find((node) => {
      return visible(node);
    });
    const panes = Array.from(document.querySelectorAll(selector));
    const rootPane = panes[panes.length - 1];
    const pane = globalCnYiBuPane || rootPane;
    const findTarget = (scope) => Array.from(scope.querySelectorAll('.ant-select')).filter((node) => {
      if (!visible(node)) {
        return false;
      }
      const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
      return candidates.indexOf(text) >= 0;
    })[0];
    let target = pane ? findTarget(pane) : null;
    if (!target) {
      target = findTarget(document);
    }
    if (!target) {
      return false;
    }
    target.scrollIntoView({ block: 'nearest' });
    const selectorNode = target.querySelector('.ant-select-selector') || target;
    selectorNode.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    selectorNode.click();
    return true;
  }, { selector: activePaneSelector, candidates: normalizedCandidates });
  if (!opened) {
    throw new Error(`Visible pane select not found for candidates: ${normalizedCandidates.join(', ')}`);
  }
  await wait(page, 200);
  const option = page.locator('.ant-select-dropdown:visible .ant-select-item-option-content', { hasText: optionLabel }).first();
  await option.waitFor({ state: 'visible', timeout: 10000 });
  await option.click({ force: true });
  await wait(page, 450);
}

async function readVisiblePaneSelectByCandidates(page, currentTextCandidates) {
  const normalizedCandidates = currentTextCandidates.map((item) => normalizeText(item));
  const activePaneSelector = '.mainRootTabs .ant-tabs-content-holder .ant-tabs-tabpane-active[aria-hidden="false"], .mainRootTabs .ant-tabs-content-holder .ant-tabs-tabpane-active';
  await page.waitForFunction((selector) => document.querySelectorAll(selector).length > 0 || document.querySelector('[class*="cnYiBuPaneActive"]'), activePaneSelector, { timeout: 10000 });
  const text = await page.evaluate(({ selector, candidates }) => {
    const findMatchingVisibleSelect = (root) => Array.from(root.querySelectorAll('.ant-select')).find((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      if (!(rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden')) {
        return false;
      }
      const value = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
      return candidates.some((candidate) => value.indexOf(candidate) >= 0);
    });
    const globalCnYiBuPane = Array.from(document.querySelectorAll('[class*="cnYiBuPaneActive"]')).find((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    const panes = Array.from(document.querySelectorAll(selector));
    const rootPane = panes[panes.length - 1];
    const pane = globalCnYiBuPane || rootPane;
    if (pane) {
      const target = findMatchingVisibleSelect(pane);
      if (target) {
        return target.innerText || target.textContent || '';
      }
    }
    const fallback = findMatchingVisibleSelect(document);
    return fallback ? (fallback.innerText || fallback.textContent || '') : null;
  }, { selector: activePaneSelector, candidates: normalizedCandidates });
  if (text === null) {
    throw new Error(`Visible pane select text not found for candidates: ${normalizedCandidates.join(', ')}`);
  }
  return normalizeText(text);
}

async function openChartDisplayDrawer(page) {
  await openTopbarDrawer(page, '星盘组件');
}

async function openAspDrawer(page) {
  await openTopbarDrawer(page, '相位选择');
}

async function captureLocalState(page) {
  return await page.evaluate(() => ({
    globalSetup: localStorage.getItem('globalSetup'),
    aspKey: localStorage.getItem('AspKey'),
    suzhanChartType: localStorage.getItem('suzhanChartType'),
    liurengChartType: localStorage.getItem('liurengChartType'),
  }));
}

async function setValues(url, userDataDir) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    viewport: { width: 1600, height: 1000 },
  });
  const page = context.pages()[0] || await context.newPage();
  try {
    await waitForAppReady(page, url);

    await openChartDisplayDrawer(page);
    await setCheckboxStateInLastDrawer(page, '显示星/宫/座/相释义', true);
    await setCheckboxStateInLastDrawer(page, '仅按照本垣擢升计算互容接纳', true);
    await closeOverlay(page);

    await clickRoot(page, '易与三式');
    await clickCnYiBuSideTab(page, '宿盘');
    await selectVisiblePaneOptionByCurrentText(page, ['无外盘', '星座外盘', '分野外盘', '八卦外盘', '遁甲外盘', '太乙外盘', '方位外盘', '逆向外盘'], '方位外盘');

    await clickCnYiBuSideTab(page, '六壬');
    await selectVisiblePaneOptionByCurrentText(page, ['圆形盘', '方形盘'], '方形盘');

    const localState = await captureLocalState(page);
    await wait(page, 1200);

    return {
      localState,
      suzhanSelected: '方位外盘',
      liurengSelected: '方形盘',
    };
  } finally {
    await context.close();
  }
}

async function readValues(url, userDataDir) {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    viewport: { width: 1600, height: 1000 },
  });
  const page = context.pages()[0] || await context.newPage();
  try {
    await waitForAppReady(page, url);
    await wait(page, 1200);

    await openChartDisplayDrawer(page);
    const astroMeaningChecked = await readCheckboxStateInLastDrawer(page, '显示星/宫/座/相释义');
    const strongReceptionChecked = await readCheckboxStateInLastDrawer(page, '仅按照本垣擢升计算互容接纳');
    await closeOverlay(page);

    await clickRoot(page, '易与三式');
    await clickCnYiBuSideTab(page, '宿盘');
    const suzhanPaneText = await readVisiblePaneSelectByCandidates(page, ['无外盘', '星座外盘', '分野外盘', '八卦外盘', '遁甲外盘', '太乙外盘', '方位外盘', '逆向外盘']);

    await clickCnYiBuSideTab(page, '六壬');
    const liurengPaneText = await readVisiblePaneSelectByCandidates(page, ['圆形盘', '方形盘']);

    const localState = await captureLocalState(page);
    return {
      localState,
      astroMeaningChecked,
      strongReceptionChecked,
      suzhanSelected: suzhanPaneText.includes('方位外盘') ? '方位外盘' : suzhanPaneText,
      liurengSelected: liurengPaneText.includes('方形盘') ? '方形盘' : liurengPaneText,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const [url, userDataDir] = process.argv.slice(2);
  if (!url || !userDataDir) {
    throw new Error('usage: verify_ui_state_persistence.js <url> <userDataDir>');
  }

  const setResult = await setValues(url, userDataDir);
  const readResult = await readValues(url, userDataDir);

  let parsedSetup = {};
  try {
    parsedSetup = JSON.parse(readResult.localState.globalSetup || '{}') || {};
  } catch (error) {
    parsedSetup = {};
  }

  const ok = readResult.astroMeaningChecked === true
    && parsedSetup.showAstroMeaning === 1
    && parsedSetup.showOnlyRulExaltReception === 1
    && normalizeText(readResult.suzhanSelected).includes('方位外盘')
    && normalizeText(readResult.liurengSelected).includes('方形盘')
    && `${readResult.localState.suzhanChartType}` === '5'
    && `${readResult.localState.liurengChartType}` === '1'
    && !!readResult.localState.globalSetup;

  console.log(JSON.stringify({
    ok,
    url,
    userDataDir,
    setResult,
    readResult,
    parsedSetup,
  }, null, 2));

  if (!ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
