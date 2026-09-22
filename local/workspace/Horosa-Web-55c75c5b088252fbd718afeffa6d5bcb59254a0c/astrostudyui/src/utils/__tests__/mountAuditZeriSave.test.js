// [挂载自检 F-36·P1] 择日宿主(太乙/六壬/三式)存档链:宿主传 dispatch(此前死钮);三母组件按 techniqueScope 存 module/caseType/sourceModule 与宿主槽快照。
import fs from 'fs';
import path from 'path';
const UI = path.join(__dirname, '..', '..');
const read = (rel)=>fs.readFileSync(path.join(UI, rel), 'utf8');

it('ZeriMain 把 dispatch 传给三个宿主;三宿主再传给子 Main', ()=>{
	const zm = read('components/zeri/ZeriMain.js');
	['TaiyiZeriMain', 'LiurengZeriMain', 'SanshiZeriMain'].forEach((h)=>{
		expect(zm).toContain(`<${h} height={childHeight} dispatch={this.props.dispatch} />`);
	});
	['TaiyiZeriMain', 'LiurengZeriMain', 'SanshiZeriMain'].forEach((h)=>{
		const src = read(`components/zeri/${h}.js`);
		expect(src).toMatch(/techniqueScope="[a-z]+zeri"\n\s*dispatch=\{this\.props\.dispatch\}/);
	});
});

it('🔴 三母组件存档按 techniqueScope(不再硬编母键),快照取宿主槽', ()=>{
	const ty = read('components/taiyi/TaiYiMain.js');
	expect(ty).toContain("const scope = this.props.techniqueScope || 'taiyi';");
	expect(ty).toContain('module: scope,');
	expect(ty).not.toMatch(/module: 'taiyi',\n\s*label: '太乙',/);
	const lr = read('components/lrzhan/LiuRengMain.js');
	expect(lr).toContain("const lrScope = this.props.techniqueScope || 'liureng';");
	expect(lr).toContain('caseType: lrScope,');
	expect(lr).toContain('sourceModule: lrScope,');
	expect(lr).not.toContain("caseType: 'liureng',");
	const ss = read('components/sanshi/SanShiUnitedMain.js');
	expect(ss).toContain("const ssScope = this.props.techniqueScope || 'sanshiunited';");
	expect(ss).toContain('caseType: ssScope,');
	expect(ss).toContain('sourceModule: ssScope,');
	expect(ss).not.toContain("caseType: 'sanshiunited',");
});
