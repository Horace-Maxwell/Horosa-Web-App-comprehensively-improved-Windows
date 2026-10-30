// horosa_aux_render_slice_v1 覆盖面用例(Windows overlay,gotcha #114):90° 中点盘的「环装配」签名记忆(ringsKey)
// 必须盖住 buildRings 及其经 this.xxx() 调到的方法读到的全部 this.state / this.props 输入。
// 漏一键 = 该输入变了却命中旧签名,盘面不更新;v3.13.0 上游新增次限推运层(showProgressed + progressedPoints)
// 时我方签名没跟上,打开该层后褐色环永不出现。本用例从源码现读,上游下次再给 buildRings 加输入即红。
import fs from 'fs';
import path from 'path';

const SRC = fs.readFileSync(path.join(__dirname, '..', 'UranianDialMain.js'), 'utf8').replace(/\r\n/g, '\n');

function methodBody(src, name){
	const re = new RegExp(`\\n\\t${name}\\s*\\([^)]*\\)\\s*\\{`);
	const m = re.exec(src);
	if(!m){ return null; }
	let i = m.index + m[0].length;
	let depth = 1;
	while(depth > 0 && i < src.length){
		const c = src[i];
		if(c === '{'){ depth += 1; }
		else if(c === '}'){ depth -= 1; }
		i += 1;
	}
	return src.slice(m.index, i);
}

function readsOf(body){
	const out = new Set();
	const re = /this\.(state|props)\.([A-Za-z0-9_]+)/g;
	let m;
	while((m = re.exec(body))){ out.add(`${m[1]}.${m[2]}`); }
	return out;
}

function ringsPathReads(src){
	const seen = new Set();
	const todo = ['buildRings'];
	const reads = new Set();
	while(todo.length){
		const name = todo.pop();
		if(seen.has(name)){ continue; }
		seen.add(name);
		const body = methodBody(src, name);
		if(!body){ continue; }
		readsOf(body).forEach((k)=>reads.add(k));
		const callRe = /this\.([A-Za-z0-9_]+)\(/g;
		let m;
		while((m = callRe.exec(body))){
			if(!seen.has(m[1]) && methodBody(src, m[1])){ todo.push(m[1]); }
		}
	}
	return { seen, reads };
}

function ringsKeyMembers(src){
	const m = /const ringsKey = memoEnabled\(\) \? refSig\(\[([\s\S]*?)\]\) : null;/.exec(src);
	return m ? readsOf(m[1]) : null;
}

describe('90° 中点盘环装配签名记忆覆盖面', ()=>{
	test('源码锚点在位(签名数组 + buildRings 方法)', ()=>{
		expect(ringsKeyMembers(SRC)).not.toBeNull();
		expect(methodBody(SRC, 'buildRings')).not.toBeNull();
	});

	test('buildRings 及其被调方读到的每个 state / props 输入都在 ringsKey 里', ()=>{
		const key = ringsKeyMembers(SRC);
		const { seen, reads } = ringsPathReads(SRC);
		expect(seen.size).toBeGreaterThanOrEqual(2);
		const missing = [...reads].filter((k)=>!key.has(k)).sort();
		expect(missing).toEqual([]);
	});

	test('判据有分辨力:签名里去掉次限推运两键即报出这两键', ()=>{
		const stripped = SRC.replace('this.state.showProgressed, this.state.progressedPoints,', '');
		expect(stripped).not.toBe(SRC);
		const key = ringsKeyMembers(stripped);
		const { reads } = ringsPathReads(stripped);
		const missing = [...reads].filter((k)=>!key.has(k)).sort();
		expect(missing).toEqual(['state.progressedPoints', 'state.showProgressed']);
	});
});
