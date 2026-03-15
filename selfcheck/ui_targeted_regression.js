const { chromium } = require('../local/workspace/Horosa-Web-55c75c5b088252fbd718afeffa6d5bcb59254a0c/astrostudyui/node_modules/playwright');

const APP_URL = process.env.HOROSA_APP_URL;
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

function normalizeText(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

async function wait(page, ms = 120) {
  await page.waitForTimeout(ms);
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
        if (visible && (text === exp || text.includes(exp) || exp.includes(text))) {
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

async function clickPaneTab(page, label) {
  const paneTabsSelector = '.mainRootTabs .ant-tabs-content-holder .ant-tabs-tabpane-active .ant-tabs-nav .ant-tabs-tab';
  await clickVisibleTab(page, paneTabsSelector, label);
  await wait(page, 180);
}

async function clickCnYiBuSideTab(page, label) {
  const expected = normalizeText(label);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const customOk = await page.evaluate((exp) => {
      const buttons = Array.from(document.querySelectorAll('[class*="cnYiBuSideNav"] button'));
      const target = buttons.find((node) => ((node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim() === exp));
      if (!target) {
        return false;
      }
      target.click();
      return true;
    }, expected);
    if (customOk) {
      await wait(page, 180);
      return;
    }
    const genericOk = await page.evaluate((exp) => {
      const activeRootPane = Array.from(document.querySelectorAll('.mainRootTabs > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane-active, .mainRootTabs > .ant-tabs-content-holder > .ant-tabs-tabpane-active'))
        .find((node) => {
          const rect = node.getBoundingClientRect();
          const style = window.getComputedStyle(node);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        });
      if (!activeRootPane) {
        return false;
      }
      const candidates = Array.from(activeRootPane.querySelectorAll('.ant-tabs-nav .ant-tabs-tab, .ant-tabs-nav .ant-tabs-tab .ant-tabs-tab-btn'))
        .filter((node) => {
          const rect = node.getBoundingClientRect();
          const style = window.getComputedStyle(node);
          const text = (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && (text === exp || text.includes(exp) || exp.includes(text));
        })
        .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
      const target = candidates[0];
      if (!target) {
        return false;
      }
      target.click();
      return true;
    }, expected);
    if (genericOk) {
      await wait(page, 220);
      return;
    }
    try {
      await clickPaneTab(page, label);
      return;
    } catch {}
    await wait(page, 180);
  }
  throw new Error(`CnYiBu tab not found: ${expected}`);
}

async function waitForAppReady(page) {
  if (!APP_URL) {
    throw new Error('HOROSA_APP_URL is required');
  }
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.locator('.mainRootTabs .ant-tabs-nav .ant-tabs-tab').first().waitFor({ state: 'visible', timeout: 20000 });
  await wait(page, 400);
}

async function verifyPrimaryDirection(page) {
  await clickRoot(page, '推运盘');
  await clickPaneTab(page, '主/界限法');
  const pane = page.locator('.mainRootTabs > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane-active').first();
  await pane.locator('.ant-table').first().waitFor({ state: 'visible', timeout: 10000 });
  return await page.evaluate(() => {
    const activePane = document.querySelector('.mainRootTabs > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane-active');
    const tableBody = activePane ? (activePane.querySelector('.ant-table-body') || activePane.querySelector('.ant-table')) : null;
    const pager = activePane ? activePane.querySelector('.ant-table-pagination') : null;
    if (!tableBody) {
      return { ok: false, reason: 'table body missing' };
    }
    const tableRect = tableBody.getBoundingClientRect();
    const pagerRect = pager ? pager.getBoundingClientRect() : null;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const gap = pagerRect ? Math.max(0, viewportHeight - pagerRect.bottom) : Math.max(0, viewportHeight - tableRect.bottom);
    return {
      ok: gap <= 90,
      gap,
      tableBottom: tableRect.bottom,
      pagerBottom: pagerRect ? pagerRect.bottom : null,
      viewportHeight,
    };
  });
}

async function verifyCnYiBuTabs(page) {
  await clickRoot(page, '易与三式');
  const labels = ['宿盘', '易卦', '六壬', '金口诀', '遁甲', '太乙', '统摄法'];
  const passes = [];
  const readActive = async () => {
    return await page.evaluate((validLabels) => {
      const normalized = (txt) => (txt || '').replace(/\s+/g, ' ').trim();
      const validSet = new Set(validLabels);
      const candidates = Array.from(document.querySelectorAll('.ant-tabs-nav .ant-tabs-tab-active .ant-tabs-tab-btn, .ant-tabs-nav .ant-tabs-tab-active'))
        .map((node) => {
          const text = normalized(node.innerText || node.textContent || '');
          const rect = node.getBoundingClientRect();
          return {
            text,
            right: rect.right,
            width: rect.width,
            height: rect.height,
          };
        })
        .filter((item) => item.width > 0 && item.height > 0 && validSet.has(item.text))
        .sort((a, b) => b.right - a.right);
      return candidates.length ? candidates[0].text : '';
    }, labels);
  };
  const initialActive = await readActive();
  passes.push({ round: 0, label: '宿盘', active: initialActive, ok: initialActive === '宿盘' });
  for (let round = 0; round < 2; round += 1) {
    for (const label of labels.slice(1)) {
      await clickCnYiBuSideTab(page, label);
      const active = await readActive();
      passes.push({ round, label, active, ok: active === label });
      if (label === '六壬') {
        await wait(page, 160);
      }
    }
    await clickCnYiBuSideTab(page, '宿盘');
    const backActive = await readActive();
    passes.push({ round, label: '宿盘', active: backActive, ok: backActive === '宿盘' });
  }
  return {
    ok: passes.every((item) => item.ok),
    passes,
  };
}

async function verifyLiuRengScroll(page) {
  await clickRoot(page, '易与三式');
  await clickCnYiBuSideTab(page, '六壬');
  const calcButton = page.getByRole('button', { name: '起课' }).last();
  if (await calcButton.count()) {
    await calcButton.click();
  }
  await page.waitForFunction(() => {
    const nodes = Array.from(document.querySelectorAll('[class*="judgeTabBody"]'));
    return nodes.some((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, { timeout: 10000 });
  await wait(page, 1200);
  return await page.evaluate(() => {
    const body = Array.from(document.querySelectorAll('[class*="judgeTabBody"]')).find((node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    }) || null;
    const divider = Array.from(document.querySelectorAll('span,div')).find((node) => ((node.textContent || '').trim() === '格局判断'));
    const inputRoot = body ? body.closest('div[style*="flex-direction: column"]') : null;
    const fixedTopHost = body ? body.parentElement?.parentElement?.parentElement : null;
    const overflowY = body ? window.getComputedStyle(body).overflowY : '';
    const bodyClientHeight = body ? body.clientHeight : null;
    const bodyScrollHeight = body ? body.scrollHeight : null;
    const beforeScroll = body ? body.scrollTop : null;
    if (body) {
      body.scrollTop = Math.min(body.scrollHeight, 320);
    }
    const afterScroll = body ? body.scrollTop : null;
    const dividerRect = divider ? divider.getBoundingClientRect() : null;
    const bodyRect = body ? body.getBoundingClientRect() : null;
      const hostRect = fixedTopHost ? fixedTopHost.getBoundingClientRect() : null;
      return {
        ok: !!body && overflowY === 'auto' && !!fixedTopHost && (afterScroll > beforeScroll || (bodyScrollHeight !== null && bodyClientHeight !== null && bodyScrollHeight <= bodyClientHeight)),
        overflowY,
        beforeScroll,
        afterScroll,
        bodyClientHeight,
        bodyScrollHeight,
        dividerTop: dividerRect ? dividerRect.top : null,
        inputRootFound: !!inputRoot,
        bodyTop: bodyRect ? bodyRect.top : null,
        hostTop: hostRect ? hostRect.top : null,
      hostBottom: hostRect ? hostRect.bottom : null,
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  page.setDefaultTimeout(10000);
  const pageErrors = [];
  const consoleErrors = [];
  const failedResponses = [];
  const failedRequests = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('response', async (response) => {
    const status = response.status();
    if (status < 400) {
      return;
    }
    const request = response.request();
    failedResponses.push({
      status,
      url: response.url(),
      method: request.method(),
      resourceType: request.resourceType(),
    });
  });
  page.on('requestfailed', (request) => {
    failedRequests.push({
      url: request.url(),
      method: request.method(),
      resourceType: request.resourceType(),
      failure: request.failure() ? request.failure().errorText : '',
    });
  });

  await waitForAppReady(page);

  const primaryDirection = await verifyPrimaryDirection(page);
  const cnYiBuTabs = await verifyCnYiBuTabs(page);
  const liuRengScroll = await verifyLiuRengScroll(page);

  const result = {
    primaryDirection,
    cnYiBuTabs,
    liuRengScroll,
    pageErrors,
    consoleErrors,
    failedResponses,
    failedRequests,
  };

  console.log(JSON.stringify(result, null, 2));
  await browser.close();

  if (!primaryDirection.ok || !cnYiBuTabs.ok || !liuRengScroll.ok || pageErrors.length) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
