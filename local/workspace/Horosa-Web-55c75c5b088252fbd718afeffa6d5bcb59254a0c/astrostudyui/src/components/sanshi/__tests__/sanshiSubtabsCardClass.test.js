// 三式右栏:卡身直接装内层页签(.horosa-sanshi-liureng-tabs)的卡片必须打 .horosa-sanshi-subtabs-card ——
// 样式靠这个类让卡身不滚、内层页签条固定在卡顶、只有它下面的内容滚;不用 :has(旧 WebView 不认)。
// 三张卡(太乙 / 六壬 / 遁甲)同一套:哪张漏了,那张的内层页签就会跟着内容一起滚走。
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'SanShiUnitedMain.js'), 'utf8');
const LESS = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'layouts', 'app', '22-tail-fixes.less'), 'utf8');
const LINES = SRC.split('\n');

// 每组内层页签往上找最近的一张卡;中间不许再套元素(套一层 div 卡身的直接子就不是页签了,样式落空)
function cardsHoldingNestedTabs(){
	const out = [];
	LINES.forEach((l, i)=>{
		if(l.indexOf('className="horosa-sanshi-liureng-tabs"') < 0){ return; }
		let tabsAt = i;
		while(tabsAt >= 0 && !/^\s*<Tabs\b/.test(LINES[tabsAt])){ tabsAt -= 1; }
		let cardAt = tabsAt - 1;
		while(cardAt >= 0 && !/<Card\b/.test(LINES[cardAt])){ cardAt -= 1; }
		const wrappers = [];
		for(let j = cardAt + 1; j < tabsAt; j += 1){
			if(/^\s*<[A-Za-z]/.test(LINES[j])){ wrappers.push(j + 1); }
		}
		out.push({ tabsLine: tabsAt + 1, cardLine: cardAt + 1, card: LINES[cardAt] || '', wrappers });
	});
	return out;
}

test('装内层页签的卡片都带 horosa-sanshi-subtabs-card,卡与页签之间不套别的元素', ()=>{
	const holders = cardsHoldingNestedTabs();
	expect(holders.length).toBeGreaterThanOrEqual(3);      // 太乙 / 六壬 / 遁甲
	holders.forEach((h)=>{
		expect({ line: h.cardLine, tagged: h.card.indexOf('horosa-sanshi-subtabs-card') >= 0 }).toEqual({ line: h.cardLine, tagged: true });
		expect({ line: h.tabsLine, wrappers: h.wrappers }).toEqual({ line: h.tabsLine, wrappers: [] });
		// 卡身四边都不留白:内层页签条紧跟外层页签条(两行页签是一组);右侧安全距离由内层内容区自己留
		expect(h.card).toContain('bodyStyle={{ padding: 0 }}');
	});
});

test('没装内层页签的卡片不带这个类', ()=>{
	const holderLines = cardsHoldingNestedTabs().map((h)=>h.cardLine);
	const tagged = [];
	LINES.forEach((l, i)=>{ if(/<Card\b/.test(l) && l.indexOf('horosa-sanshi-subtabs-card') >= 0){ tagged.push(i + 1); } });
	expect(tagged).toEqual(holderLines);
});

test('样式按类命中,不用 :has', ()=>{
	expect(LESS).toContain('.ant-card.horosa-sanshi-subtabs-card > .ant-card-body {');
	expect(LESS).not.toMatch(/:has\(> \.horosa-sanshi-liureng-tabs\)/);
});

// 两行页签(外层 概览/太乙/六壬/遁甲/紫微四化 + 内层二级页签)是一组:外层页签条下只留 4px、卡身上方不留白;
// 没有二级页签的两页(概览 / 紫微四化)在自己的滚动容器里把上留白补到 16px,内容起点不变。
test('两行页签贴成一组:外层条下 4px、卡身上 0;无二级页签的两页上留白 16px', ()=>{
	const P = '.horosa-workspace-shell .horosa-sanshi-redesign .horosa-sanshi-info-panel .horosa-sanshi-right-tabs';
	const block = (sel)=>{
		const at = LESS.indexOf(sel + ' {');
		expect({ sel, found: at >= 0 }).toEqual({ sel, found: true });
		return LESS.slice(at, LESS.indexOf('}', at));
	};
	expect(block(P + ' > .ant-tabs-nav')).toMatch(/margin-bottom: 4px !important;/);
	expect(block(P + ' > .ant-tabs-nav')).toMatch(/margin-left: 12px !important;/);      // 左侧安全距
	expect(block(P + ' > .ant-tabs-content-holder')).toMatch(/padding-left: 12px;/);     // 左侧安全距
	expect(block(P + ' > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane > .ant-card.horosa-sanshi-subtabs-card > .ant-card-body')).toMatch(/padding: 0 !important;/);
	expect(block(P + ' > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane > .ant-card.horosa-sanshi-kv-host > .ant-card-body')).toMatch(/padding: 16px 3px 12px 0 !important;/);
	expect(block(P + ' > .ant-tabs-content-holder > .ant-tabs-content > .ant-tabs-tabpane > .horosa-sanshi-ziwei-sihua')).toMatch(/padding: 16px 3px 12px 0;/);
	expect(SRC).toContain("bodyStyle={{ padding: '16px 3px 12px 0' }} className=\"horosa-sanshi-kv-host\"");
});
