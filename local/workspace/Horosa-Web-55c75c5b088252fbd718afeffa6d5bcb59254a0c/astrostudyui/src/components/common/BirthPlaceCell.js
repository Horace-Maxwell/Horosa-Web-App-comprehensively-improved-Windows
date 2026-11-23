// 命盘列表 / 星盘搜索表的「出生地」格(两处同一份):地名一行,经纬度两段各自不折行 ——
// 栏窄时只在两段之间换行(此前整串一起折,会断成「纬 / 度」)。
import React from 'react';

const ROW = { display: 'inline-flex', flexWrap: 'wrap', columnGap: '0.8em' };
const UNIT = { whiteSpace: 'nowrap' };

export function renderBirthPlaceCell(text, record){
	const r = record || {};
	const coord = (
		<span style={ROW}>
			<span style={UNIT}>经度：{r.lon}</span>
			<span style={UNIT}>纬度：{r.lat}</span>
		</span>
	);
	if(!text){ return coord; }
	return (
		<div>
			<div>{text}</div>
			{coord}
		</div>
	);
}

export default renderBirthPlaceCell;
