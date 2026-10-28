// 择日宿主(太乙/六壬/三式)存档链:宿主传 dispatch(此前死钮);三母组件按 techniqueScope 存 module/caseType/sourceModule 与宿主槽快照。
import fs from 'fs';
import path from 'path';
const { readSource } = require('./helpers/sourceSet');   // 拆成子模块的大文件按「门面 + 子模块」全集读,其余文件原样读
const UI = path.join(__dirname, '..', '..');
const read = (rel)=>readSource(path.join(UI, rel));

// 接线按 JSX 属性认(helpers/jsxProps):只认「元素 + 属性名 + 值」,与属性先后、中间插了别的属性无关
const { jsxElements } = require('./helpers/jsxProps');
const { sourceSetFiles } = require('./helpers/sourceSet');
const elementsIn = (rel, name)=>sourceSetFiles(path.join(UI, rel)).flatMap((f)=>jsxElements(fs.readFileSync(f, 'utf8'), name));
const HOSTS = [['TaiyiZeriMain', 'TaiYiMain'], ['LiurengZeriMain', 'LiuRengMain'], ['SanshiZeriMain', 'SanShiUnitedMain']];

it('ZeriMain 把 dispatch 传给三个宿主;三宿主再传给子 Main', ()=>{
	HOSTS.forEach(([host])=>{
		const els = elementsIn('components/zeri/ZeriMain.js', host);
		expect(`${host}:${els.length}`).toBe(`${host}:1`);
		expect(els[0]).toMatchObject({ height: 'childHeight', dispatch: 'this.props.dispatch' });
	});
	HOSTS.forEach(([host, child])=>{
		const els = elementsIn(`components/zeri/${host}.js`, child);
		expect(`${host}>${child}:${els.length}`).toBe(`${host}>${child}:1`);
		expect(`${host}>${child}:${els[0].techniqueScope}`).toMatch(/:[a-z]+zeri$/);
		expect(`${host}>${child}:${els[0].dispatch}`).toBe(`${host}>${child}:this.props.dispatch`);
	});
});

it('判别力:属性换先后 / 中间插别的属性照认;漏传 dispatch、传错值、作用域不是择日槽都红', ()=>{
	const one = (code)=>jsxElements(code, 'TaiYiMain')[0];
	expect(one('const a = <TaiYiMain techniqueScope="taiyizeri" dispatch={this.props.dispatch} />;')).toMatchObject({ techniqueScope: 'taiyizeri', dispatch: 'this.props.dispatch' });
	expect(one('const a = <TaiYiMain dispatch={this.props.dispatch}\n\tzeriLocked={X}   /* 注释 */\n\ttechniqueScope="taiyizeri" />;')).toMatchObject({ techniqueScope: 'taiyizeri', dispatch: 'this.props.dispatch' });
	expect(one('const a = <TaiYiMain techniqueScope="taiyizeri" zeriLocked={X} />;').dispatch).toBeUndefined();
	expect(one('const a = <TaiYiMain techniqueScope="taiyizeri" dispatch={noop} />;').dispatch).toBe('noop');
	expect(one('const a = <TaiYiMain techniqueScope="taiyi" dispatch={this.props.dispatch} />;').techniqueScope).not.toMatch(/^[a-z]+zeri$/);
	expect(jsxElements('const a = <Other dispatch={this.props.dispatch} />;', 'TaiYiMain')).toEqual([]);
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
