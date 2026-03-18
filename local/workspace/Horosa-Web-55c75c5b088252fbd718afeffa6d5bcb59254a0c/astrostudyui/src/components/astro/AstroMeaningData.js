import * as AstroConst from '../../constants/AstroConst';
import * as AstroText from '../../constants/AstroText';
import {
  getPlanetAnnotation,
  getSignAnnotation,
  getHouseAnnotation,
  getLotAnnotation,
  getAspectAnnotation,
} from '../../constants/AstroInterpretation';

function safeText(value) {
  if (value === undefined || value === null) {
    return '';
  }
  return `${value}`.trim();
}

function displayNameOf(id, fallback = '') {
  const raw = safeText(id);
  return safeText(
    AstroText.AstroMsgCN[raw]
    || AstroText.AstroTxtMsg[raw]
    || AstroText.AstroMsg[raw]
    || fallback
    || raw
  );
}

function normalizeAspectId(id) {
  const raw = safeText(id);
  if (!raw) {
    return '';
  }
  if (raw.indexOf('Asp') === 0) {
    return raw;
  }
  const num = Number(raw);
  if (!Number.isNaN(num)) {
    const key = `ASP${Math.round(num)}`;
    if (AstroConst[key]) {
      return AstroConst[key];
    }
    return `Asp${Math.round(num)}`;
  }
  return raw;
}

function isLotId(id) {
  return Array.isArray(AstroConst.LOTS) && AstroConst.LOTS.indexOf(id) >= 0;
}

function normalizeTipTitle(text, fallbackTitle) {
  const lines = safeText(text)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line)=>safeText(line))
    .filter((line)=>!!line);
  if (lines.length > 0) {
    let title = lines[0]
      .replace(/^#+\s*/, '')
      .replace(/\*\*/g, '')
      .replace(/^●\s*/, '')
      .trim();
    if (title) {
      return title;
    }
  }
  return safeText(fallbackTitle);
}

function buildTip(annotation, fallbackTitle, extraTips) {
  const body = safeText(annotation);
  if (!body) {
    return null;
  }
  const title = normalizeTipTitle(body, fallbackTitle);
  const tips = [];
  if (Array.isArray(extraTips)) {
    extraTips.forEach((item)=>{
      const line = safeText(item);
      if (line) {
        tips.push(line);
      }
    });
  }
  if (tips.length > 0) {
    tips.push('==');
  }
  tips.push(body);
  return {
    title: title || safeText(fallbackTitle),
    tips,
  };
}

function resolveAnnotation(category, id) {
  const cat = safeText(category).toLowerCase();
  if (cat === 'sign' || cat === 'zodiac' || cat === 'constellation') {
    return {
      annotation: getSignAnnotation(id),
      title: displayNameOf(id, safeText(id)),
    };
  }
  if (cat === 'house' || cat === 'houses') {
    return {
      annotation: getHouseAnnotation(id),
      title: displayNameOf(id, safeText(id)),
    };
  }
  if (cat === 'aspect' || cat === 'asp') {
    const aspectId = normalizeAspectId(id);
    return {
      annotation: getAspectAnnotation(aspectId),
      title: displayNameOf(aspectId, aspectId),
    };
  }
  if (cat === 'lot' || cat === 'lots' || cat === 'pars') {
    return {
      annotation: getLotAnnotation(id),
      title: displayNameOf(id, safeText(id)),
    };
  }
  const planetAnnotation = getPlanetAnnotation(id);
  if (planetAnnotation) {
    return {
      annotation: planetAnnotation,
      title: displayNameOf(id, safeText(id)),
    };
  }
  if (isLotId(id)) {
    return {
      annotation: getLotAnnotation(id),
      title: displayNameOf(id, safeText(id)),
    };
  }
  return {
    annotation: '',
    title: displayNameOf(id, safeText(id)),
  };
}

function objectName(obj) {
  if (!obj) {
    return '';
  }
  return safeText(obj.name || displayNameOf(obj.id, obj.id));
}

export function appendAstroMeaningTips(tipobj, category, id) {
  const current = tipobj ? {
    ...tipobj,
    tips: Array.isArray(tipobj.tips) ? tipobj.tips.slice(0) : [],
  } : {
    title: '',
    tips: [],
  };
  const tip = buildMeaningTipByCategory(category, id);
  if (!tip) {
    return current;
  }
  current.title = current.title || tip.title;
  if (tip.tips && tip.tips.length > 0) {
    current.tips = current.tips.concat(tip.tips);
  }
  return current;
}

export function buildSignMeaningTip(signId) {
  return buildMeaningTipByCategory('sign', signId);
}

export function buildMeaningTipByCategory(category, id) {
  const resolved = resolveAnnotation(category, id);
  return buildTip(resolved.annotation, resolved.title, []);
}

export function buildAspectMeaningTip(aspId, objA, objB) {
  const resolved = resolveAnnotation('aspect', aspId);
  const nameA = objectName(objA);
  const nameB = objectName(objB);
  const extraTips = [];
  if (nameA && nameB) {
    extraTips.push(`${nameA} 与 ${nameB}`);
  } else if (nameA || nameB) {
    extraTips.push(nameA || nameB);
  }
  return buildTip(resolved.annotation, resolved.title, extraTips);
}
