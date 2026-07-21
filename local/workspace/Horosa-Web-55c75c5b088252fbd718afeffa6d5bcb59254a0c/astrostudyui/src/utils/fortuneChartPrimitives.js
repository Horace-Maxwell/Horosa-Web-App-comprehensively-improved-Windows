// [WP-34] 盘面原语单源(只移不改):getObjectsMap/sect/dignityScore 此前散落 4 处逐字节同语义副本
// (fortuneTechniqueAdapters/fortuneChartProfile/astroAiSnapshot/fortuneSignificators)。
// 收敛为单源;adapters 的 WeakMap 缓存层保留在其本地(性能包装,核走此处纯函数)。
import * as AstroConst from '../constants/AstroConst';

/** {chart:{objects},lots} → {id: obj}(lots 覆盖同 id)。纯函数无缓存。 */
export function getObjectsMapPure(chartObj){
  const map = {};
  const chart = chartObj && chartObj.chart ? chartObj.chart : null;
  if(chart && chart.objects){ for(let i = 0; i < chart.objects.length; i++){ const o = chart.objects[i]; map[o.id] = o; } }
  if(chartObj && chartObj.lots){ for(let i = 0; i < chartObj.lots.length; i++){ const o = chartObj.lots[i]; map[o.id] = o; } }
  return map;
}

/** 昼夜区分(sect):昼=木吉土凶(区内)火凶(区外);夜=金吉火凶土凶(区外)。 */
export function sect(chart){
  const day = !!(chart && chart.isDiurnal);
  return { day, benefic: day ? AstroConst.JUPITER : AstroConst.VENUS, malefic: day ? AstroConst.SATURN : AstroConst.MARS, outMalefic: day ? AstroConst.MARS : AstroConst.SATURN };
}

/** 必然尊贵计分:庙+5 旺+4 三分+3 界+2 面+1;陷−5 落−4。 */
export function dignityScore(obj){
  const d = (obj && obj.selfDignity) || []; let s = 0;
  if(d.includes('ruler')) s += 5; if(d.includes('exalt')) s += 4; if(d.includes('triplicity')) s += 3; if(d.includes('term')) s += 2; if(d.includes('face')) s += 1;
  if(d.includes('exile')) s -= 5; if(d.includes('fall')) s -= 4; return s;
}
