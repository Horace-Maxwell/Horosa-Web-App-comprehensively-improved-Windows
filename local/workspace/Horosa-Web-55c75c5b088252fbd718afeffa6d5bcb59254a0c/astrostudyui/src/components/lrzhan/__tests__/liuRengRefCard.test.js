// 六壬参考条目卡的排版合同:文本产出(AI 快照 / 导出共用)不动,显示层按行分层;
// 大六壬页与三式合一页共用同一组件,不得各写一套内联卡片。
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import LiuRengRefCard, { parseLiuRengRefText, LiuRengRefFacts, LiuRengRefDoc } from '../LiuRengRefCard';
import { buildReferenceDocumentText, buildOverviewReferenceText } from '../main/referenceMatch';

const { readSource } = require('../../../utils/__tests__/helpers/sourceSet');
const { jsxNodesInFile } = require('../../../utils/__tests__/helpers/jsxProps');

const SRC = path.resolve(__dirname, '..', '..', '..');
const read = (rel)=>readSource(path.join(SRC, rel));

describe('六壬参考条目卡 · 文本分层', ()=>{
	test('口诀 / 段标 / 行首小标 / 正文 / 空行 各归其类', ()=>{
		const text = [
			'口诀第一句，口诀第二句。',
			'口诀第三句。',
			'',
			'荀注：',
			'注文第一段。',
			'',
			'增注：增补一句。',
			'局式： 甲课乙传',
			'局义： 主事迟滞',
			'',
			'依据：',
			'孤辰： 寅',
		].join('\n');
		const rows = parseLiuRengRefText(text);
		expect(rows.map((r)=>r.type)).toEqual([
			'poem', 'poem', 'gap', 'section', 'text', 'gap', 'section', 'text', 'kv', 'kv', 'gap', 'section', 'kv',
		]);
		expect(rows[3]).toEqual({ type: 'section', label: '荀注' });
		expect(rows[6]).toEqual({ type: 'section', label: '增注' });
		expect(rows[7]).toEqual({ type: 'text', text: '增补一句。' });
		expect(rows[8]).toEqual({ type: 'kv', label: '局式', text: '甲课乙传' });
		expect(rows[12]).toEqual({ type: 'kv', label: '孤辰', text: '寅' });
	});

	test('词典缺失时的回退文本(只有局式 / 局义)不出口诀块', ()=>{
		const rows = parseLiuRengRefText('局式： 条件\n局义： 摘要');
		expect(rows.map((r)=>r.type)).toEqual(['kv', 'kv']);
	});

	test('空文本 / 首尾空行不产生空块', ()=>{
		expect(parseLiuRengRefText('')).toEqual([]);
		expect(parseLiuRengRefText(null)).toEqual([]);
		expect(parseLiuRengRefText('\n\n只有一句。\n\n')).toEqual([{ type: 'poem', text: '只有一句。' }]);
	});

	test('句中带冒号的长句不被当成小标(小标至多 6 字且不含标点)', ()=>{
		const rows = parseLiuRengRefText('口诀。\n\n经云此课占病，主：凶。');
		expect(rows[2].type).toBe('text');
	});

	test('显示层不改文本产出:两个 build 函数仍是纯字符串', ()=>{
		const doc = buildReferenceDocumentText({ name: '不存在的格', condition: '甲', summary: '乙' }, 'dage');
		expect(typeof doc).toBe('string');
		expect(typeof buildOverviewReferenceText({ verse: '句', note: '注' })).toBe('string');
	});
});

describe('六壬参考条目卡 · 渲染', ()=>{
	test('卡片出齐 条目名 / 标签 / 口诀 / 段标 / 小标加粗 / 依据', ()=>{
		const html = renderToStaticMarkup(
			<LiuRengRefCard
				name="元首课"
				tag="课式命中"
				text={'一上克下，顺而有序。\n\n荀注：\n局式： 一上克下\n“元首”者，~~旧~~首也。'}
				evidence={['四课一上克下', '初传子']}
			/>
		);
		expect(html).toContain('class="horosa-lr-ref-name">元首课<');
		expect(html).toContain('class="horosa-lr-ref-tag">课式命中<');
		expect(html).toContain('class="horosa-lr-ref-poem"');
		expect(html).toContain('class="horosa-lr-ref-section">荀注<');
		expect(html).toContain('<strong class="horosa-lr-ref-key">局式</strong>一上克下');
		expect(html).toContain('<span class="horosa-lr-ref-term">“元首”</span>');
		expect(html).toContain('<del class="horosa-lr-ref-del">旧</del>');
		expect(html).toContain('class="horosa-lr-ref-evidence"><strong>依据</strong><span>四课一上克下；初传子</span>');
	});

	test('无依据不出依据行;无文本不出文档块', ()=>{
		const html = renderToStaticMarkup(<LiuRengRefCard name="甲" tag="乙" />);
		expect(html).not.toContain('horosa-lr-ref-evidence');
		expect(html).not.toContain('horosa-lr-ref-doc');
		expect(renderToStaticMarkup(<LiuRengRefDoc text="" />)).toBe('');
	});

	test('摘要条:键弱值强,按全角分号切', ()=>{
		const html = renderToStaticMarkup(<LiuRengRefFacts text="课式：元首；三传：子丑寅；日干支：甲子" />);
		expect((html.match(/horosa-lr-ref-fact"/g) || []).length).toBe(3);
		expect(html).toContain('<span>课式</span><strong>元首</strong>');
		expect(renderToStaticMarkup(<LiuRengRefFacts text="" />)).toBe('');
	});
});

describe('六壬参考条目卡 · 单一来源', ()=>{
	const liureng = read('components/lrzhan/LiuRengMain.js');
	const sanshi = read('components/sanshi/SanShiUnitedMain.js');
	const less = read('layouts/app/08-india-sanshi.less');

	test('大六壬页与三式合一页都走共享组件', ()=>{
		expect(liureng).toContain("from './LiuRengRefCard'");
		expect(sanshi).toContain("from '../lrzhan/LiuRengRefCard'");
		const keysIn = (rel)=>jsxNodesInFile(path.join(SRC, rel), 'LiuRengRefCard').map((n)=>`${n.attrs.key || ''}`);
		const liurengKeys = keysIn('components/lrzhan/LiuRengMain.js');
		const sanshiKeys = keysIn('components/sanshi/SanShiUnitedMain.js');
		['dage_', 'xiaoju_', 'ref_', 'overview_', 'bf_hit_'].forEach((k)=>{
			expect(liurengKeys.some((key)=>key.startsWith(`\`${k}`))).toBe(true);
		});
		['ssu_lr_dage_', 'ssu_lr_xiaoju_', 'ssu_lr_ref_', 'ssu_lr_overview_', 'ssu_bf_hit_'].forEach((k)=>{
			expect(sanshiKeys.some((key)=>key.startsWith(`\`${k}`))).toBe(true);
		});
	});

	test('两页不再用整段 pre-wrap 灰字塞参考文本', ()=>{
		[liureng, sanshi].forEach((src)=>{
			expect(src).not.toMatch(/whiteSpace: 'pre-wrap' \}\}>\s*\{build(Reference|OverviewReference)(Document)?Text\(/);
		});
	});

	test('样式只有一份、只用主题变量(不写死蓝 / 紫)', ()=>{
		const start = less.indexOf('.horosa-workspace-shell .horosa-lr-ref-card {');
		expect(start).toBeGreaterThan(0);
		expect((less.match(/^\s*\.horosa-workspace-shell \.horosa-lr-ref-card \{/gm) || []).length).toBe(1);
		const end = less.lastIndexOf('.horosa-lr-ref-');
		expect(end).toBeGreaterThan(start);
		const block = less.slice(start, less.indexOf('}', end));
		expect(block).toContain('var(--horosa-accent-strong)');
		expect(block).not.toMatch(/#(1890ff|1677ff|722ed1|13c2c2|eb2f96)/i);
	});
});
