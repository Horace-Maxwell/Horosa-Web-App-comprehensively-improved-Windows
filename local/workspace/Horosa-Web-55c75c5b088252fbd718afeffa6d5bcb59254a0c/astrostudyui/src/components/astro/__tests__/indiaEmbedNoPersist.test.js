// 印度择日里内嵌的印占盘:改选项只改本盘,不记新盘缺省、不写主盘字段(此前 astro/save 把择日自造的整包字段写进主盘,
// 名字变「印度择日」、cid 丢失);独立印占页照常记种子并写进当前盘。
import IndiaChartMain from '../IndiaChartMain';
const seeds = require('../../../utils/newChartSeeds');

beforeEach(()=>{ window.localStorage.clear(); seeds.__resetNewChartSeedsForTest(); });

test('🔴 择日内嵌:不派发、不记种子;独立页:派发并记种子', ()=>{
	const AstroConst = require('../../../constants/AstroConst');
	const alt = AstroConst.INDIA_HOUSE_SYSTEM_OPTIONS.map((o)=>o.value).find((v)=>v !== AstroConst.INDIA_HOUSE_SYSTEM_DEFAULT);
	const embedded = jest.fn();
	IndiaChartMain.prototype.persistIndiaOption.call({ props: { dispatch: embedded, techniqueScope: 'indiazeri', fields: { name: { value: '印度择日' } } } }, { indiaHsys: alt });
	expect(embedded).not.toHaveBeenCalled();
	expect(seeds.newChartSeedOverrides().indiaHsys).toBeUndefined();
	const page = jest.fn();
	IndiaChartMain.prototype.persistIndiaOption.call({ props: { dispatch: page, fields: { cid: { value: 'c1' } } } }, { indiaHsys: alt });
	expect(page).toHaveBeenCalledWith(expect.objectContaining({ type: 'astro/saveUserFields' }));
	expect(seeds.newChartSeedOverrides().indiaHsys).toBe(alt);
});
