import {
  QIMEN_TEN_GAN_TOOLTIP_TEXT,
  QIMEN_DOOR_TOOLTIP_TEXT,
  QIMEN_STAR_TOOLTIP_TEXT,
  QIMEN_GOD_TOOLTIP_TEXT,
} from '../../constants/QimenTooltipTexts';

const QIMEN_TEN_GAN_TEXT = QIMEN_TEN_GAN_TOOLTIP_TEXT;
const QIMEN_DOOR_TEXT = QIMEN_DOOR_TOOLTIP_TEXT;
const QIMEN_STAR_TEXT = QIMEN_STAR_TOOLTIP_TEXT;
const QIMEN_GOD_TEXT = QIMEN_GOD_TOOLTIP_TEXT;

const QIMEN_TOOLTIP_CHAR_MAP = {
  門: '门',
  開: '开',
  傷: '伤',
  驚: '惊',
  陰: '阴',
  陽: '阳',
  離: '离',
  兌: '兑',
  黃: '黄',
  綠: '绿',
  藍: '蓝',
  騰: '腾',
  內: '内',
  沖: '冲',
  輔: '辅',
  麗: '丽',
  風: '风',
  險: '险',
  鬥: '斗',
  體: '体',
  臺: '台',
  與: '与',
  廣: '广',
  層: '层',
  醫: '医',
  氣: '气',
  關: '关',
  貴: '贵',
  龍: '龙',
  變: '变',
  遠: '远',
  飛: '飞',
  壯: '壮',
  闊: '阔',
  圖: '图',
  樓: '楼',
  處: '处',
  書: '书',
  證: '证',
  經: '经',
  網: '网',
};

function safe(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return `${value}`.trim();
}

function normalizeQimenTooltipZh(raw) {
  const txt = `${safe(raw)}`;
  if (!txt) {
    return '';
  }
  return txt.replace(/[門開傷驚陰陽離兌黃綠藍騰內沖輔麗風險鬥體臺與廣層醫氣關貴龍變遠飛壯闊圖樓處書證經網]/g, (ch)=>QIMEN_TOOLTIP_CHAR_MAP[ch] || ch);
}

function normalizeDoorKey(door) {
  const txt = `${safe(door)}`.replace(/\s/g, '').replace(/门/g, '').replace(/門/g, '');
  if (!txt) {
    return '';
  }
  const head = txt.substring(0, 1);
  return ({
    開: '开',
    傷: '伤',
    驚: '惊',
  })[head] || head;
}

function normalizeStarKey(star) {
  const txt = `${safe(star)}`.replace(/\s/g, '');
  if (!txt) {
    return '';
  }
  if (txt.indexOf('芮') >= 0 || txt.indexOf('内') >= 0 || txt.indexOf('內') >= 0) {
    return '芮';
  }
  if (txt.indexOf('禽') >= 0) {
    return '禽';
  }
  if (txt.indexOf('蓬') >= 0) {
    return '蓬';
  }
  if (txt.indexOf('任') >= 0) {
    return '任';
  }
  if (txt.indexOf('冲') >= 0 || txt.indexOf('沖') >= 0) {
    return '冲';
  }
  if (txt.indexOf('辅') >= 0 || txt.indexOf('輔') >= 0) {
    return '辅';
  }
  if (txt.indexOf('英') >= 0) {
    return '英';
  }
  if (txt.indexOf('柱') >= 0) {
    return '柱';
  }
  if (txt.indexOf('心') >= 0) {
    return '心';
  }
  return txt.substring(0, 1);
}

function normalizeGodKey(god) {
  const txt = `${safe(god)}`.replace(/\s/g, '');
  if (!txt) {
    return '';
  }
  return ({
    值符: '值符',
    符: '值符',
    腾蛇: '螣蛇',
    螣蛇: '螣蛇',
    騰蛇: '螣蛇',
    蛇: '螣蛇',
    太阴: '太阴',
    太陰: '太阴',
    阴: '太阴',
    陰: '太阴',
    六合: '六合',
    合: '六合',
    白虎: '白虎',
    虎: '白虎',
    元武: '玄武',
    玄武: '玄武',
    玄: '玄武',
    九地: '九地',
    地: '九地',
    九天: '九天',
    天: '九天',
  })[txt] || txt;
}

function getStemInterpretation(gan) {
  return normalizeQimenTooltipZh(QIMEN_TEN_GAN_TEXT[`${safe(gan)}`.trim()] || '');
}

function getDoorInterpretation(door) {
  const key = normalizeDoorKey(door);
  return normalizeQimenTooltipZh(QIMEN_DOOR_TEXT[key] || '');
}

function getStarInterpretation(star) {
  const key = normalizeStarKey(star);
  return normalizeQimenTooltipZh(QIMEN_STAR_TEXT[key] || '');
}

function getGodInterpretation(god) {
  const key = normalizeGodKey(god);
  return normalizeQimenTooltipZh(QIMEN_GOD_TEXT[key] || '');
}

function buildTip(title, text) {
  const body = safe(text);
  if (!body) {
    return null;
  }
  return {
    title: safe(title),
    blocks: [
      { type: 'subTitle', text: '释义' },
      { type: 'text', text: body },
    ],
  };
}

export function buildQimenXiangTipObj(type, rawValue) {
  const kind = safe(type).toLowerCase();
  if (kind === 'stem') {
    return buildTip('天盘干释义', getStemInterpretation(rawValue));
  }
  if (kind === 'door') {
    const doorVal = normalizeQimenTooltipZh(safe(rawValue, '—'));
    const text = getDoorInterpretation(doorVal) || (doorVal ? `八门为${doorVal}，暂无条目释义。` : '');
    return buildTip('八门释义', text);
  }
  if (kind === 'star') {
    return buildTip('九星释义', getStarInterpretation(rawValue));
  }
  if (kind === 'god') {
    return buildTip('八神释义', getGodInterpretation(rawValue));
  }
  return null;
}
