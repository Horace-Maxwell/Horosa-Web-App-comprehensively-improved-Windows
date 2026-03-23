import fs from 'fs';
import path from 'path';

import * as LRConst from '../LRConst';
import {
	getLiuRengXunMeta,
	getLiuRengBranchDunGan,
	solveLiuRengSanChuanDetailed,
} from '../LRRuleHelper';

function ensureDirForFile(filePath){
	if(!filePath){
		return;
	}
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function makeShiftedLayout(shift = 0){
	const downZi = LRConst.ZiList.slice();
	const upZi = downZi.map((_, index)=>downZi[(index + shift + 12) % 12]);
	return {
		downZi,
		upZi,
		houseTianJiang: LRConst.TianJiang.slice(),
	};
}

function stableClone(value){
	return JSON.parse(JSON.stringify(value));
}

function buildCuangFromDetailed(detail){
	if(!detail || !detail.result || !Array.isArray(detail.result.rawBranches)){
		return [];
	}
	return detail.result.rawBranches.map((branch)=>getLiuRengBranchDunGan(detail.dayGanZi || '', branch) ? `${getLiuRengBranchDunGan(detail.dayGanZi || '', branch)}${branch}` : `空${branch}`);
}

function isPlainObject(value){
	return !!value && typeof value === 'object' && !Array.isArray(value);
}

function pickComparableResult(result){
	if(!result){
		return null;
	}
	const detailRoot = result.sanChuan && result.sanChuan.result ? result.sanChuan : null;
	const sanChuanResult = detailRoot
		? detailRoot.result
		: (result.sanChuan && result.sanChuan.sanChuan ? result.sanChuan.sanChuan : result.sanChuan);
	const xunMeta = result.xunMeta ? {
		xunName: result.xunMeta.xunName,
		xunHead: result.xunMeta.xunHead,
		xunTail: result.xunMeta.xunTail,
		xunDing: result.xunMeta.xunDing,
		xunKong: Array.isArray(result.xunMeta.xunKong) ? result.xunMeta.xunKong.slice() : [],
	} : null;
	const sanChuan = sanChuanResult ? {
		name: sanChuanResult.name,
		rawBranches: Array.isArray(sanChuanResult.rawBranches) ? sanChuanResult.rawBranches.slice() : [],
		cuang: detailRoot
			? (buildCuangFromDetailed(detailRoot) || [])
			: (Array.isArray(sanChuanResult.cuang) ? sanChuanResult.cuang.slice() : []),
		ruleStage: sanChuanResult.ruleStage || '',
		decisionPath: Array.isArray(sanChuanResult.decisionPath) ? sanChuanResult.decisionPath.slice() : [],
	} : null;
	return {
		xunMeta,
		branchDunGan: result.branchDunGan || '',
		sanChuan,
	};
}

function partialMatch(actual, expected, pathLabel = 'result'){
	if(Array.isArray(expected)){
		if(!Array.isArray(actual)){
			return `${pathLabel}: expected array, got ${typeof actual}`;
		}
		if(actual.length < expected.length){
			return `${pathLabel}: expected length >= ${expected.length}, got ${actual.length}`;
		}
		for(let i=0; i<expected.length; i++){
			const msg = partialMatch(actual[i], expected[i], `${pathLabel}[${i}]`);
			if(msg){
				return msg;
			}
		}
		return '';
	}
	if(isPlainObject(expected)){
		if(!isPlainObject(actual)){
			return `${pathLabel}: expected object, got ${typeof actual}`;
		}
		const keys = Object.keys(expected);
		for(let i=0; i<keys.length; i++){
			const key = keys[i];
			const msg = partialMatch(actual[key], expected[key], `${pathLabel}.${key}`);
			if(msg){
				return msg;
			}
		}
		return '';
	}
	if(actual !== expected){
		return `${pathLabel}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
	}
	return '';
}

function runLiuRengRuleCase(one){
	const input = isPlainObject(one && one.input) ? stableClone(one.input) : {};
	const shift = Number.isFinite(Number(input.shift)) ? Number(input.shift) : null;
	const baseLayout = shift === null ? {} : makeShiftedLayout(shift);
	const upZi = Array.isArray(input.upZi) ? input.upZi.slice() : baseLayout.upZi;
	const downZi = Array.isArray(input.downZi) ? input.downZi.slice() : baseLayout.downZi;
	const houseTianJiang = Array.isArray(input.houseTianJiang)
		? input.houseTianJiang.slice()
		: (baseLayout.houseTianJiang || []);
	const xunMeta = getLiuRengXunMeta(input.dayGanZi || '');
	const branchKey = `${input.branch || ''}`.trim();
	const output = {
		normalizedInput: {
			dayGanZi: input.dayGanZi || '',
			branch: branchKey,
			shift,
			mode: input.mode || '',
			upZi: Array.isArray(upZi) ? upZi.slice() : [],
			downZi: Array.isArray(downZi) ? downZi.slice() : [],
			keRaw: Array.isArray(input.keRaw) ? stableClone(input.keRaw) : [],
		},
		xunMeta: {
			xunName: xunMeta.xunName,
			xunHead: xunMeta.xunHead,
			xunTail: xunMeta.xunTail,
			xunDing: xunMeta.xunDing,
			xunKong: Array.isArray(xunMeta.xunKong) ? xunMeta.xunKong.slice() : [],
		},
		branchDunGan: branchKey ? getLiuRengBranchDunGan(input.dayGanZi || '', branchKey) : '',
		sanChuan: null,
	};
	if(Array.isArray(upZi) && upZi.length === 12 && Array.isArray(downZi) && downZi.length === 12
		&& Array.isArray(input.keRaw) && input.keRaw.length === 4){
		output.sanChuan = solveLiuRengSanChuanDetailed({
			dayGanZi: input.dayGanZi || '',
			upZi,
			downZi,
			houseTianJiang,
			keRaw: input.keRaw,
			mode: input.mode,
		});
	}
	return output;
}

function buildDefaultCases(){
	return [
		{
			type: 'liureng-rule',
			label: '甲子旬旬丁为卯',
			input: {
				dayGanZi: '甲子',
				branch: '卯',
			},
			expected: {
				xunMeta: {
					xunName: '甲子旬',
					xunDing: '卯',
					xunKong: ['戌', '亥'],
				},
				branchDunGan: '丁',
			},
		},
		{
			type: 'liureng-rule',
			label: '丁未属甲辰旬且未遁丁',
			input: {
				dayGanZi: '丁未',
				branch: '未',
			},
			expected: {
				xunMeta: {
					xunName: '甲辰旬',
					xunDing: '未',
				},
				branchDunGan: '丁',
			},
		},
		{
			type: 'liureng-rule',
			label: '乙亥阴日别责初传为卯',
			input: {
				dayGanZi: '乙亥',
				shift: 1,
				keRaw: [
					['', '子', '乙'],
					['', '卯', '子'],
					['', '寅', '亥'],
					['', '卯', '寅'],
				],
			},
			expected: {
				sanChuan: {
					name: '芜淫课',
					rawBranches: ['卯', '子', '子'],
					ruleStage: '别责',
				},
			},
		},
	];
}

function readCases(){
	const caseFile = process.env.HOROSA_SELF_CHECK_CASE_FILE;
	if(caseFile && fs.existsSync(caseFile)){
		const payload = JSON.parse(fs.readFileSync(caseFile, 'utf8'));
		if(Array.isArray(payload)){
			return payload;
		}
		if(Array.isArray(payload.cases)){
			return payload.cases;
		}
	}
	return buildDefaultCases();
}

function writeReports(report){
	const jsonPath = process.env.HOROSA_SELF_CHECK_RULE_JSON;
	const mdPath = process.env.HOROSA_SELF_CHECK_RULE_MD;
	if(jsonPath){
		ensureDirForFile(jsonPath);
		fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
	}
	if(mdPath){
		ensureDirForFile(mdPath);
		const lines = ['# Horosa Rule Self Check', ''];
		lines.push(`Overall: ${report.failed === 0 ? 'PASS' : 'FAIL'}`);
		lines.push(`Passed: ${report.passed}`);
		lines.push(`Failed: ${report.failed}`);
		lines.push('');
		report.cases.forEach((one, index)=>{
			lines.push(`## ${index + 1}. ${one.label}`);
			lines.push(`Status: ${one.pass ? 'PASS' : 'FAIL'}`);
			lines.push(`Type: ${one.type}`);
			if(one.mismatch){
				lines.push(`Mismatch: ${one.mismatch}`);
			}
			lines.push('');
			lines.push('```json');
			lines.push(JSON.stringify({
				input: one.normalizedInput,
				output: one.output,
				expected: one.expected,
			}, null, 2));
			lines.push('```');
			lines.push('');
		});
		fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');
	}
}

describe('Horosa rule self-check runner', ()=>{
	test('writes report and enforces expected cases', ()=>{
		const rawCases = readCases();
		const cases = rawCases.filter((one)=>`${one && one.type || ''}`.trim() === 'liureng-rule');
		const reportCases = cases.map((one)=>{
			const output = runLiuRengRuleCase(one);
			const comparable = pickComparableResult(output);
			const mismatch = partialMatch(comparable, one.expected || {});
			return {
				type: one.type,
				label: one.label || 'unnamed-case',
				pass: !mismatch,
				mismatch,
				normalizedInput: output.normalizedInput,
				output: comparable,
				expected: one.expected || {},
			};
		});
		const report = {
			type: 'rule-check',
			passed: reportCases.filter((one)=>one.pass).length,
			failed: reportCases.filter((one)=>!one.pass).length,
			cases: reportCases,
		};
		writeReports(report);
		const failedLabels = reportCases.filter((one)=>!one.pass).map((one)=>`${one.label}: ${one.mismatch}`);
		expect(failedLabels).toEqual([]);
	});
});
