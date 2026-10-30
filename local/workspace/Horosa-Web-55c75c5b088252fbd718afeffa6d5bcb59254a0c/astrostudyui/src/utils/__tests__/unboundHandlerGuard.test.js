// 🔴 类组件回调未绑定守卫:把原型方法以 `={this.x}` 传给子组件 / 控件,方法体里又用到 this,
// 却既没在构造函数里 `this.x = this.x.bind(this)`、也不在 `[...].forEach((f)=>{ this[f] = this[f].bind(this); })`
// 批量名单里 → 回调触发时 this 为空,当场 TypeError(主限法扩展面板勾选应星 / 迫星即崩,就是这一类)。
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', '..');

function walk(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((d)=>{
		const p = path.join(dir, d.name);
		if(d.isDirectory()){
			if(d.name !== '__tests__' && d.name !== '.umi' && d.name !== '.umi-production'){ walk(p, out); }
		}else if(/\.jsx?$/.test(d.name)){
			out.push(p);
		}
	});
	return out;
}

function boundNames(src){
	const out = new Set();
	let m;
	const direct = /this\.(\w+)\s*=\s*this\.\1\.bind\(this\)/g;
	while((m = direct.exec(src)) !== null){ out.add(m[1]); }
	const bulk = /\[([^\]]*)\]\s*\.forEach\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\{?\s*this\[\2\]\s*=\s*this\[\2\]\.bind\(this\)/g;
	while((m = bulk.exec(src)) !== null){
		(m[1].match(/['"](\w+)['"]/g) || []).forEach((q)=>out.add(q.slice(1, -1)));
	}
	return out;
}

function unboundPassedMethods(src){
	if(!/extends\s+(React\.)?(Pure)?Component\b/.test(src)){ return []; }
	const passed = new Set();
	let m;
	const ref = /=\{this\.(\w+)\}/g;
	while((m = ref.exec(src)) !== null){ passed.add(m[1]); }
	const bound = boundNames(src);
	const bad = [];
	passed.forEach((name)=>{
		if(bound.has(name)){ return; }
		if(new RegExp(`^\\s*${name}\\s*=\\s*(async\\s*)?(\\([^)]*\\)|\\w+)\\s*=>`, 'm').test(src)){ return; }   // 箭头类属性
		const def = new RegExp(`^\\s+(async\\s+)?${name}\\s*\\([^)]*\\)\\s*\\{`, 'm').exec(src);
		if(!def){ return; }   // 不是原型方法(可能是普通属性 / 值)
		const body = src.slice(def.index + def[0].length, def.index + def[0].length + 800);
		if(/\bthis\./.test(body)){ bad.push(name); }
	});
	return bad.sort();
}

describe('类组件回调未绑定守卫', ()=>{
	it('🔴 以 ={this.x} 传出的原型方法必须绑定(单独 bind / 批量 forEach bind / 箭头类属性)', ()=>{
		const offenders = [];
		walk(path.join(SRC, 'components'), []).forEach((f)=>{
			const bad = unboundPassedMethods(fs.readFileSync(f, 'utf8'));
			if(bad.length){ offenders.push(`${path.relative(SRC, f)}: ${bad.join(', ')}`); }
		});
		expect(offenders).toEqual([]);
	});

	it('判据自证:未绑定即判红,单独绑定 / 批量绑定 / 箭头属性放行', ()=>{
		const base = (ctor)=>`class A extends Component{ constructor(p){ super(p); ${ctor} }\n\tonPick(v){\n\t\tthis.setState({ v });\n\t}\n\trender(){ return <X onChange={this.onPick} />; }\n}`;
		expect(unboundPassedMethods(base(''))).toEqual(['onPick']);
		expect(unboundPassedMethods(base('this.onPick = this.onPick.bind(this);'))).toEqual([]);
		expect(unboundPassedMethods(base("['onPick', 'other'].forEach((f)=>{ this[f] = this[f].bind(this); });"))).toEqual([]);
		expect(unboundPassedMethods('class A extends Component{\n\tonPick = (v)=>{ this.setState({ v }); }\n\trender(){ return <X onChange={this.onPick} />; }\n}')).toEqual([]);
	});
});
