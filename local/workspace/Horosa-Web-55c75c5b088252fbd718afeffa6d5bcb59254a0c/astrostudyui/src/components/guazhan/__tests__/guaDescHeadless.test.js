// 卦辞取数单源:页面与无头起卦 / 重算同一算法(本 / 之 / 互三卦键);无头卦象没带卦辞时补取,取不到原样返回、不抛
jest.mock('../../../utils/request', ()=>({ __esModule: true, default: jest.fn() }));
import fs from 'fs';
import path from 'path';
import request from '../../../utils/request';
import { guaDescIdsOf, withGuaDesc, buildGuaSnapshotText } from '../GuaZhanMain';
import { Gua64 } from '../../gua/GuaConst';
import { ResultKey } from '../../../utils/constants';

const idxOf = (bits)=>Gua64.findIndex((g)=>g && g.value.join('') === bits);
const yaoOf = (bits, moving)=>bits.split('').map((b, i)=>({ value: Number(b), change: moving.indexOf(i) >= 0 }));

beforeEach(()=>{ request.mockReset(); window.localStorage.clear(); });

it('三卦键:本卦 = 线值,之卦 = 动爻翻转,互卦 = 二至四 + 三至五爻', ()=>{
	const bits = '000110';
	const ids = guaDescIdsOf({ currentGua: idxOf(bits), yao: yaoOf(bits, [1]) });
	expect(ids.guaOrg).toBe('000110');
	expect(ids.guaRes).toBe('010110');
	expect(ids.guaMiddle).toBe('001011');
	expect(guaDescIdsOf({ currentGua: null })).toBe(null);
});

it('无头补卦辞:取到就进「卦辞与断语」段;已带卦辞不重取;后端没回且无缓存 → 原样返回', async ()=>{
	const bits = '000110';
	const st = { currentGua: idxOf(bits), yao: yaoOf(bits, [1]), nongli: {} };
	request.mockResolvedValueOnce({ [ResultKey]: { '000110': { name: '萃', '卦辞': '亨，王假有庙。' } } });
	const out = await withGuaDesc(st);
	expect(out.guaDesc.guaOrg['卦辞']).toBe('亨，王假有庙。');
	expect(buildGuaSnapshotText(null, out)).toMatch(/\[卦辞与断语\][\s\S]*卦辞：亨，王假有庙。/);
	expect(await withGuaDesc(out)).toBe(out);
	expect(request).toHaveBeenCalledTimes(1);
	request.mockResolvedValueOnce(undefined);
	const other = { currentGua: idxOf('111111'), yao: yaoOf('111111', []) };
	expect(await withGuaDesc(other)).toBe(other);
});

it('无头三条路(按爻成卦 / 时间卦 / 存卦重算)都先补卦辞再出快照', ()=>{
	const src = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'utils', 'aiAnalysisContext', 'regenCase.js'), 'utf8');
	expect(src).toMatch(/const gua = await withGuaDesc\(\{ \.\.\.base, guaOrigin: 'cast'/);
	expect(src).toMatch(/buildGuaSnapshotText\(fields, await withGuaDesc\(st\)\)/);
	expect(src).toMatch(/await withGuaDesc\(\{ \.\.\.p\.gua, liuyaoSettings: merged \}\)/);
});
