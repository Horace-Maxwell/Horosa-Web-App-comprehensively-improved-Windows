export const BAGONG_PALACE_ORDER = [8, 7, 4, 1, 2, 3, 6, 9];

export const BAGONG_PALACE_NAME = {
  1: '巽',
  2: '离',
  3: '坤',
  4: '震',
  6: '兑',
  7: '艮',
  8: '坎',
  9: '乾',
};

const BAGONG_GUA_NAME = {
  1: '巽卦',
  2: '离卦',
  3: '坤卦',
  4: '震卦',
  6: '兑卦',
  7: '艮卦',
  8: '坎卦',
  9: '乾卦',
};

const GOD_NAME_MAP = {
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
};

function normalizeList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function normalizeGodName(value) {
  if (!value) {
    return '';
  }
  return GOD_NAME_MAP[value] || `${value}`;
}

function getCell(pan, palaceNum) {
  const cells = pan && Array.isArray(pan.cells) ? pan.cells : [];
  return cells.find((item) => item && item.palaceNum === palaceNum) || null;
}

export function buildQimenBaGongPanelData(pan, palaceNum) {
  const cell = getCell(pan, palaceNum);
  const palaceName = BAGONG_PALACE_NAME[palaceNum] || `${palaceNum}`;
  const renDoor = cell ? (cell.doorHead || cell.door || '') : '';
  const baseDoor = cell ? (cell.baseDoor || '') : '';
  const tianGan = cell ? (cell.tianGan || '') : '';
  const diGan = cell ? (cell.diGan || '') : '';
  const godFull = normalizeGodName(cell ? cell.god : '');
  const menFangYiGua = renDoor ? `${renDoor}门` : '';

  return {
    palaceNum,
    palaceName,
    jiPatterns: normalizeList(cell ? cell.jiPatterns : []),
    jiPatternDetails: normalizeList(cell ? cell.jiPatterns : []),
    xiongPatterns: normalizeList(cell ? cell.xiongPatterns : []),
    xiongPatternDetails: normalizeList(cell ? cell.xiongPatterns : []),
    tianGan,
    diGan,
    renDoor,
    baseDoor,
    tenGanText: cell && cell.tenGanResponse ? cell.tenGanResponse : '无',
    doorBaseText: cell && cell.doorBaseResponse ? cell.doorBaseResponse : '无',
    doorTianText: cell && cell.doorGanResponse ? cell.doorGanResponse : '无',
    godFull,
    godDoorText: godFull && renDoor ? `${godFull}临${renDoor}门` : '无',
    menFangYiGua,
    menFangYiGuaText: menFangYiGua ? `${palaceName}宫对应${BAGONG_GUA_NAME[palaceNum] || palaceName}，门方为${menFangYiGua}` : '无',
  };
}
