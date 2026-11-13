// 星运 · 操作手册:右侧 33 个页签每个一章(左栏父级菜单按类分组),打开帮助停在当前页签那一章。
// 章节正文分两个文件:direction/chaptersDirectional(方向 / 推运 / 推运图 / 工具)与 direction/chaptersTimelord(时主 / 返照 / 流年 / 历表)。
import { Component } from 'react';
import HelpBook from './HelpBook';
import { DIRECTION_CHAPTERS_A } from './direction/chaptersDirectional';
import { DIRECTION_CHAPTERS_B } from './direction/chaptersTimelord';

const ALL = [...DIRECTION_CHAPTERS_A, ...DIRECTION_CHAPTERS_B];
const pick = (keys)=>keys.map((k)=>ALL.find((c)=>c.key === k)).filter(Boolean);

// 分组 = 推运法的四大类 + 主限法家族单列(三个页签:表 / 盘 / 天球)
const GROUPS = [
	{ key: 'primary', label: '主限法', keys: ['primarydirect', 'primarydirchart', 'primarydirsphere'] },
	{ key: 'arcs', label: '方向类(推星)', keys: ['solararc', 'planetaryarc', 'persiandirected', 'distributions'] },
	{ key: 'prog', label: '推运与推运图', keys: ['progressions', 'jaynesprog', 'vedicprog', 'neroman', 'bezzafigure', 'michon'] },
	{ key: 'timelord', label: '时主类(分段轮值)', keys: ['profection', 'jayprofection', 'firdaria', 'decennials', 'zodialrelease', 'planetaryages', 'yearsystem129', 'balbillus', 'triplicityrulers', 'keypoints', 'timelords'] },
	{ key: 'returns', label: '返照与流年', keys: ['solarreturn', 'lunarreturn', 'extrareturns', 'returntimeline', 'givenyear'] },
	{ key: 'tools', label: '工具与辅助', keys: ['agepoint', 'lunationphase', 'prenatalsyzygy', 'ephemeris'] },
];

export const HELP_BOOK = {
	title: '星运 · 操作手册',
	groups: GROUPS.map((g)=>({ key: g.key, label: g.label, chapters: pick(g.keys) })),
};

class DirectionHelpDoc extends Component{
	static book = HELP_BOOK;

	render(){
		return <HelpBook book={HELP_BOOK} ctx={this.props.ctx} compact={this.props.compact} />;
	}
}

export default DirectionHelpDoc;
