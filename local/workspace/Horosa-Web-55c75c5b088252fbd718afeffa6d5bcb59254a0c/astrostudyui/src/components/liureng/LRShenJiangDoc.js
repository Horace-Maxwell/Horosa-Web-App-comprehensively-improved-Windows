import {
  getLiuRengGodText,
  getLiuRengGeneralText,
  buildLiuRengTooltipObj,
} from '../../constants/LiuRengTexts';

function safeText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return `${value}`.trim();
}

const LIURENG_BRANCH_SET = new Set(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);

function normalizeBranch(value) {
  const txt = safeText(value);
  return LIURENG_BRANCH_SET.has(txt) ? txt : '';
}

function normalizeJiang(value) {
  const txt = safeText(value)
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/^贵神/, '')
    .replace(/^神将/, '');
  return ({
    腾蛇: '螣蛇',
    騰蛇: '螣蛇',
    元武: '玄武',
    阴: '太阴',
    陰: '太阴',
    合: '六合',
    虎: '白虎',
    玄: '玄武',
    天后神: '天后',
    天乙: '贵人',
  })[txt] || txt;
}

export function buildLiuRengShenTipObj(value) {
  const branch = normalizeBranch(value);
  if (!branch) {
    return null;
  }
  return buildLiuRengTooltipObj(
    getLiuRengGodText(branch),
    `${branch}神`
  );
}

export function buildLiuRengHouseTipObj(jiang, tian, di) {
  const name = normalizeJiang(jiang);
  if (!name) {
    return null;
  }
  const branch = normalizeBranch(di) || normalizeBranch(tian);
  return buildLiuRengTooltipObj(
    getLiuRengGeneralText(name, branch),
    name || '天将'
  );
}
