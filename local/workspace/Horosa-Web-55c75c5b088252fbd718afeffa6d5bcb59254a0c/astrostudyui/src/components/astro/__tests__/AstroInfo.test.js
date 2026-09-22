jest.mock('../../../utils/helper', ()=>({
	randomStr: ()=> 'astro-info-test',
}));

import { resolveAstroDisplayMode, } from '../AstroInfo';

describe('AstroInfo display mode', ()=>{
	// [Q-254/T-233] 请求入参(fields 标签)优先、echo 兜底 —— 与 AI 快照 [起盘信息] 同序(此前 echo 优先 → 两处分叉)。
	test('prefers field labels (request params) and falls back to chart echo labels otherwise', ()=>{
		expect(resolveAstroDisplayMode({
			zodiacal: 'Sidereal',
			hsys: 'Alcabitus',
		}, {
			zodiacal: '回归黄道',
			hsys: '整宫制',
		})).toEqual({
			zodiacal: '回归黄道',
			hsys: '整宫制',
		});
		expect(resolveAstroDisplayMode({
			zodiacal: 'Sidereal',
			hsys: 'Alcabitus',
		}, {})).toEqual({
			zodiacal: '恒星黄道',
			hsys: 'Alcabitus',
		});
		// 派生盘:宫位实为「变换后上升整宫」→ 标注只认实算口径,不报请求分宫制。
		expect(resolveAstroDisplayMode({
			hsys: 'Alcabitus',
			houses: [{ hsysDerived: 'wholeFromAsc' }],
		}, { hsys: 'Alcabitus' }).hsys).toBe('整宫(变换后上升)');

		expect(resolveAstroDisplayMode({}, {
			zodiacal: '回归黄道',
			hsys: '整宫制',
		})).toEqual({
			zodiacal: '回归黄道',
			hsys: '整宫制',
		});
	});
});
