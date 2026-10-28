import { XQSelect } from '../xq-ui';
import { HOUSE_SYSTEM_OPTIONS } from '../../constants/AstroConst';

const Option = XQSelect.Option;

// expanded=false 给常用 9 种短表;传入 currentValue 且它不在短表里(如别处选了 Porphyry)时把它补进来,
// 下拉显示宫制名而不是裸数字。
export function getHousesOption(expanded=false, currentValue){
	let houses = expanded ? HOUSE_SYSTEM_OPTIONS : HOUSE_SYSTEM_OPTIONS.slice(0, 9);
	if(!expanded && currentValue !== undefined && currentValue !== null && currentValue !== ''
		&& !houses.some((h)=>`${h.value}` === `${currentValue}`)){
		const extra = HOUSE_SYSTEM_OPTIONS.find((h)=>`${h.value}` === `${currentValue}`);
		if(extra){ houses = houses.concat([extra]); }
	}

	let dom = houses.map((item, idx)=>{
		return (
			<Option key={idx} value={item.value}>{item.label}</Option>
		);
	});

	return dom;
}
