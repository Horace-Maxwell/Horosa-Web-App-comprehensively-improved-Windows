/**
 * 排查轮压测矩阵：P1/P0/P2 新面全组合穷举（不抛+结构封闭+枚举值域锁定）。
 * 覆盖：格局引擎 10 日主×12 月支×3 旺衰、虚邀 60 日柱、神煞分组 2^4 幂集、
 * 三维分列月支全域、流派标记 7 派×开关×缺数据。
 */
import { computeGejuYongShen } from '../baziGejuYongShen';
import { computeZaGe } from '../baziZaGe';
import { filterShenShaByGroups, SHENSHA_GROUP_TAGS, calcFourPillarShenSha } from '../baziShenShaLocal';
import computeWuxingStrength from '../baziWuxing';
import { buildLocalBaziResult } from '../baziLunarLocal';
import React from 'react';
import BaZiFineChart from '../../components/cntradition/BaZiFineChart';

const GANS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHIS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN_EL = { 甲: 'Wood', 乙: 'Wood', 丙: 'Fire', 丁: 'Fire', 戊: 'Earth', 己: 'Earth', 庚: 'Metal', 辛: 'Metal', 壬: 'Water', 癸: 'Water' };
const ZHI_BEN = { 子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙', 午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬' };
const SHISHEN = (dayGan, gan) => {
	const rel = { same: ['比', '劫'], child: ['食', '伤'], wealth: ['才', '财'], officer: ['杀', '官'], resource: ['枭', '印'] };
	const GEN = { Wood: 'Fire', Fire: 'Earth', Earth: 'Metal', Metal: 'Water', Water: 'Wood' };
	const d = GAN_EL[dayGan], g = GAN_EL[gan];
	const yinSame = (GANS.indexOf(dayGan) % 2) === (GANS.indexOf(gan) % 2);
	let group;
	if(g === d){ group = 'same'; }
	else if(GEN[d] === g){ group = 'child'; }
	else if(GEN[g] === d){ group = 'resource'; }
	else if(GEN[GEN[d]] === g){ group = 'wealth'; }
	else { group = 'officer'; }
	return rel[group][yinSame ? 0 : 1];
};
function stem(cell, dayGan){ return { cell, element: GAN_EL[cell], relative: dayGan ? SHISHEN(dayGan, cell) : '日元' }; }
function pillar(gan, zhi, dayGan){
	const ben = ZHI_BEN[zhi];
	return { stem: stem(gan, dayGan), branch: { cell: zhi }, stemInBranch: [stem(ben, dayGan || gan)] };
}
function ws(verdict, samePercent, scores){ return { dayMaster: { verdict, samePercent }, scores }; }
const EVEN = [
	{ label: '木', key: 'Wood', percent: 20 }, { label: '火', key: 'Fire', percent: 20 },
	{ label: '土', key: 'Earth', percent: 20 }, { label: '金', key: 'Metal', percent: 20 }, { label: '水', key: 'Water', percent: 20 },
];

describe('压测 · computeGejuYongShen 10日主×12月支×3旺衰（360 组合）', () => {
	test('全组合不抛 + chengBai.verdict 值域封闭 + 格局派忌列有据', () => {
		const VERDICTS = new Set(['成格', '破格', '败中复成', '待复核']);
		let gejuJiFilled = 0, gejuRows = 0;
		GANS.forEach((dg) => {
			ZHIS.forEach((mz) => {
				[['身强', 60], ['身弱', 30], ['中和', 50]].forEach(([v, sp]) => {
					const four = {
						day: pillar(dg, '子', null),
						month: pillar(GANS[(GANS.indexOf(dg) + 3) % 10], mz, dg),
						year: pillar(GANS[(GANS.indexOf(dg) + 6) % 10], '辰', dg),
						time: pillar(GANS[(GANS.indexOf(dg) + 1) % 10], '亥', dg),
					};
					const r = computeGejuYongShen(four, ws(v, sp, EVEN));
					expect(r).toBeTruthy();
					if(r.chengBai){ expect(VERDICTS.has(r.chengBai.verdict)).toBe(true); }
					(r.schools || []).forEach((s) => {
						expect(Array.isArray(s.xi)).toBe(true);
						expect(Array.isArray(s.ji)).toBe(true);
						if(s.school === '格局派'){ gejuRows++; if(s.ji.length){ gejuJiFilled++; } }
					});
				});
			});
		});
		expect(gejuRows).toBeGreaterThan(300);
		// 忌列有据率：绝大多数格局有忌（xi 覆盖忌行时让位而空，属少数）
		expect(gejuJiFilled / gejuRows).toBeGreaterThan(0.6);
	});
});

describe('压测 · 虚邀杂格 60 日柱扫描', () => {
	test('全 60 甲子日柱 × 触发型支组合：quality 值域封闭 + broken 恒数组', () => {
		const Q = new Set(['真', '假', '待复核']);
		for(let i = 0; i < 60; i++){
			const dg = GANS[i % 10], dz = ZHIS[i % 12];
			const four = {
				year: pillar('庚', '子', dg), month: pillar('戊', dz, dg),
				day: pillar(dg, dz, null), time: pillar('丙', '子', dg),
			};
			const r = computeZaGe(four);
			(r || []).forEach((g) => {
				if(g.group === '虚邀暗冲'){
					expect(Q.has(g.quality)).toBe(true);
					expect(Array.isArray(g.broken)).toBe(true);
				}else{
					expect(g.quality).toBeUndefined(); // 既有八格零污染
				}
			});
		}
	});
});

describe('压测 · 神煞分组 2^4 幂集 × 全名单', () => {
	test('16 组合输出 ⊆ 输入、全开=原引用、全关只剩未入表名', () => {
		const names = Object.keys(SHENSHA_GROUP_TAGS).concat(['未入表新煞']);
		for(let mask = 0; mask < 16; mask++){
			const groups = { ji: !!(mask & 1), xiong: !!(mask & 2), yue: !!(mask & 4), ri: !!(mask & 8) };
			const out = filterShenShaByGroups(names, groups);
			expect(out.every((n) => names.indexOf(n) >= 0)).toBe(true);
			if(mask === 15){ expect(out).toBe(names); }
			if(mask === 0){ expect(out).toEqual(['未入表新煞']); }
		}
	});
	test('过滤与逐柱装配组合：任意档位 calcFourPillarShenSha 输出过滤后不抛', () => {
		const four = { year: pillar('丙', '午'), month: pillar('甲', '午'), day: pillar('丁', '卯'), time: pillar('己', '酉') };
		['年', '日', '年日'].forEach((pos) => {
			const r = calcFourPillarShenSha({ year: { stem: { cell: '丙' }, branch: { cell: '午' } }, month: { stem: { cell: '甲' }, branch: { cell: '午' } }, day: { stem: { cell: '丁' }, branch: { cell: '卯' } }, time: { stem: { cell: '己' }, branch: { cell: '酉' } } }, pos);
			['year', 'month', 'day', 'time'].forEach((k) => {
				const filtered = filterShenShaByGroups(r[k], { ji: false, xiong: true, yue: false, ri: true });
				expect(Array.isArray(filtered)).toBe(true);
			});
		});
	});
});

describe('压测 · 三维分列 12 个月全域（真盘）', () => {
	test('每月一盘 dimensions 结构完整、deLing 状态值域封闭', () => {
		const STATES = new Set(['旺', '相', '休', '囚', '死']);
		for(let m = 1; m <= 12; m++){
			const mm = `${m < 10 ? '0' : ''}${m}`;
			const stat = computeWuxingStrength(buildLocalBaziResult({
				date: `2025-${mm}-15`, time: '12:00:00', zone: '+08:00',
				lon: 113.0, gpsLon: 113.0, lat: 23.0, gpsLat: 23.0, gender: 1, timeAlg: 1,
			}).bazi.fourColumns);
			const d = stat.dimensions;
			expect(d).toBeTruthy();
			expect(STATES.has(d.deLing.state)).toBe(true);
			expect(Array.isArray(d.deDi.roots)).toBe(true);
			expect(typeof d.deShi.count).toBe('number');
			expect(typeof d.summary).toBe('string');
		}
	});
});

describe('压测 · 流派标记 7 派 × 开关 × 缺数据', () => {
	const GY = { schools: [
		{ school: '扶抑派', verdict: '身强', xi: ['土'], ji: ['木'] },
		{ school: '格局派', xi: ['火'], ji: ['金'] },
		{ school: '调候派', xi: ['癸', '丙'], ji: [] },
		{ school: '病药派', xi: ['金'], ji: ['木'] },
	] };
	const MP = { cells: [{ label: '年', role: '宾' }, { label: '日', role: '主' }] };
	test('7 派 × showSchoolMarks 开关 × 有/无数据 全 28 态不抛且 null 语义正确', () => {
		['zonghe', 'fuyi', 'geju', 'tiaohou', 'bingyao', 'mangpai', 'nayin'].forEach((school) => {
			[true, false].forEach((show) => {
				[{ gejuYongShen: GY, mangpai: MP }, {}].forEach((value) => {
					const inst = new BaZiFineChart({ school, showSchoolMarks: show, value });
					const mark = inst.buildSchoolMark();
					if(!show || school === 'zonghe' || school === 'nayin' || !Object.keys(value).length){
						expect(mark).toBeNull();
					}
					// markClass 对任意 mark/单元恒返回字符串
					['甲', '子', '', null].forEach((cell) => {
						expect(typeof inst.schoolMarkClass(mark, { cell })).toBe('string');
					});
				});
			});
		});
	});
});
