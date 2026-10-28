// 请求代次号「一条路径一个」合同(全 src 的类组件):
// 同一个 this._xxxSeq 若在两个方法里都「自增 + 按它判过期」,两条独立请求路径就会互相作废 ——
// 一条把另一条在途的结果判成过期丢掉,而被丢的那条往往还挂着 loading / 在途标记,界面永远停在「载入…」。
// (故事页列表与朝代下拉共用代次、主限表计算与主限盘请求共用代次,都是这一形状。)
// 只自增不比较的方法(卸载、载入存案时「作废在途」)不算请求路径,不计入。
// 确属同一条逻辑路径的(动画令牌:开始 / 结束同一段动画;载入存案覆盖在途起盘并自清 loading)登记在 EXEMPT 并写理由。
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const SRC = path.join(__dirname, '..', '..');

const EXEMPT = {
	'components/astro3d/Astro3D.js|Astro3D|_morphToken': '动画令牌:startMorph / finishMorph 是同一段过渡动画的起止,后一段动画作废前一段正是本意',
	'components/astro3d/PDSphereEngine.js|PDSphereEngine|_playToken': '动画令牌:播放 / 旋转 / 复位共用一条动画时间线,新动作作废旧动画正是本意',
	'components/dunjia/DunJiaMain.js|DunJiaMain|requestSeq': '同一张盘的两条起法(改时间取历法再出盘 / 改档就地重算)写同一处 state.pan:后发的那次代表最新的时间 + 档位,先发的不论哪条都该作废;被作废那次挂的加载态由后发那次收(落屏或去重命中时清)',
	'components/huangji/HuangJiMain.js|HuangJiMain|requestSeq': '载入存案覆盖在途起盘(覆盖语义),载入时自己清 loading;载入后补正文按同一代次防被新起盘覆盖',
};

function listJs(dir, out){
	fs.readdirSync(dir, { withFileTypes: true }).forEach((d)=>{
		if(d.name === 'node_modules' || d.name === '__tests__' || d.name === '.umi' || d.name === '.umi-production'){ return; }
		const p = path.join(dir, d.name);
		if(d.isDirectory()){ listJs(p, out); return; }
		if(/\.(js|jsx)$/.test(d.name) && !/\.test\.js$/.test(d.name)){ out.push(p); }
	});
	return out;
}
const parse = (text)=>parser.parse(text, { sourceType: 'module', plugins: ['jsx', 'classProperties', 'optionalChaining', 'objectRestSpread', 'dynamicImport', 'nullishCoalescingOperator'], errorRecovery: true });
const thisProp = (n)=>(n && n.type === 'MemberExpression' && n.object.type === 'ThisExpression' && !n.computed && n.property.type === 'Identifier') ? n.property.name : null;
function mentions(node, prop){
	let hit = false;
	const visit = (x)=>{
		if(hit || !x || typeof x.type !== 'string'){ return; }
		if(thisProp(x) === prop){ hit = true; return; }
		Object.keys(x).forEach((k)=>{
			if(k === 'loc' || k === 'start' || k === 'end'){ return; }
			const v = x[k];
			if(Array.isArray(v)){ v.forEach(visit); } else if(v && typeof v === 'object'){ visit(v); }
		});
	};
	visit(node);
	return hit;
}
// this.x++ / ++this.x / this.x += k / this.x = (this.x || 0) + 1
function incrementedProp(n){
	if(n.type === 'UpdateExpression' && n.operator === '++'){ return thisProp(n.argument); }
	if(n.type === 'AssignmentExpression'){
		const t = thisProp(n.left);
		if(!t){ return null; }
		if(n.operator === '+='){ return t; }
		if(n.operator === '=' && n.right.type === 'BinaryExpression' && n.right.operator === '+' && mentions(n.right.left, t)){ return t; }
	}
	return null;
}

function scanText(text, rel){
	const classes = [];
	const walk = (n, cls, meth)=>{
		if(!n || typeof n.type !== 'string'){ return; }
		if(n.type === 'ClassDeclaration' || n.type === 'ClassExpression'){
			cls = { name: (n.id && n.id.name) || '(anonymous)', inc: {}, cmp: {} };
			classes.push(cls);
			meth = null;
		}
		if(cls && (n.type === 'ClassMethod' || (n.type === 'ClassProperty' && n.value && /Function/.test(n.value.type)))){
			meth = (n.key && (n.key.name || n.key.value)) || '?';
		}
		if(cls && meth){
			const p = incrementedProp(n);
			if(p){ (cls.inc[p] = cls.inc[p] || new Set()).add(meth); }
			if(n.type === 'BinaryExpression' && /^[!=]==?$/.test(n.operator)){
				const t = thisProp(n.left) || thisProp(n.right);
				if(t){ (cls.cmp[t] = cls.cmp[t] || new Set()).add(meth); }
			}
		}
		Object.keys(n).forEach((k)=>{
			if(k === 'loc' || k === 'start' || k === 'end'){ return; }
			const v = n[k];
			if(Array.isArray(v)){ v.forEach((c)=>walk(c, cls, meth)); } else if(v && typeof v === 'object'){ walk(v, cls, meth); }
		});
	};
	walk(parse(text).program, null, null);
	const hits = [];
	classes.forEach((cls)=>{
		Object.keys(cls.inc).forEach((p)=>{
			const owners = [...cls.inc[p]].filter((m)=>cls.cmp[p] && cls.cmp[p].has(m));
			if(owners.length > 1){ hits.push({ id: `${rel}|${cls.name}|${p}`, owners: owners.sort() }); }
		});
	});
	return hits;
}

describe('请求代次号一条路径一个(全 src 类组件)', ()=>{
	it('没有两条请求路径共用同一个代次号', ()=>{
		const bad = [];
		const seen = new Set();
		listJs(SRC, []).forEach((abs)=>{
			const rel = path.relative(SRC, abs).split(path.sep).join('/');
			scanText(fs.readFileSync(abs, 'utf8'), rel).forEach((h)=>{
				seen.add(h.id);
				if(!EXEMPT[h.id]){ bad.push(`${h.id} ← ${h.owners.join(' / ')}`); }
			});
		});
		expect(bad).toEqual([]);
		// 豁免过期即红
		expect(Object.keys(EXEMPT).filter((id)=>!seen.has(id))).toEqual([]);
	});
	it('判据自证:共用代次的两条请求路径必红,各用各的必绿,只作废不比较的方法不算', ()=>{
		const shared = `class S extends C {
			async load(){ const s = (this._loadSeq = (this._loadSeq || 0) + 1); this.setState({ loading: true }); const r = await f(); if(s !== this._loadSeq){ return; } this.setState({ loading: false, r }); }
			async loadDynastyOptions(){ const s = (this._loadSeq = (this._loadSeq || 0) + 1); const r = await g(); if(s !== this._loadSeq){ return; } this.setState({ d: r }); }
		}`;
		expect(scanText(shared, 'x.js').map((h)=>h.id)).toEqual(['x.js|S|_loadSeq']);
		const split = shared.replace(/loadDynastyOptions\(\)\{ const s = \(this\._loadSeq = \(this\._loadSeq \|\| 0\) \+ 1\); const r = await g\(\); if\(s !== this\._loadSeq\)/, 'loadDynastyOptions(){ const s = (this._dynSeq = (this._dynSeq || 0) + 1); const r = await g(); if(s !== this._dynSeq)');
		expect(split).not.toBe(shared);
		expect(scanText(split, 'x.js')).toEqual([]);
		const cancelOnly = `class K extends C {
			async fetchPan(){ const s = ++this.requestSeq; const r = await f(); if(s !== this.requestSeq){ return; } this.setState({ r }); }
			componentWillUnmount(){ this.requestSeq += 1; }
		}`;
		expect(scanText(cancelOnly, 'x.js')).toEqual([]);
	});
});
