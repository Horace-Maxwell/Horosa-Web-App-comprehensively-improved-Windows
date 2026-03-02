import { Form, Input, Button, Select, Row, Col,  } from 'antd';
import { randomStr, } from '../../utils/helper';

const Option = Select.Option;

export function getHousesOption(){
	let houses = [
		{key: 0, label: '整宫制'},
		{key: 1, label: 'Alcabitus'},
		{key: 2, label: 'Regiomontanus'},
		{key: 3, label: 'Placidus'},
		{key: 4, label: 'Koch'},
		{key: 5, label: 'Vehlow Equal'},
		{key: 6, label: 'Polich Page'},
		{key: 7, label: 'Sripati'},
		{key: 8, label: '天顶为10宫中点等宫制'}
	]

	let dom = houses.map((item, idx)=>{
		return (
			<Option key={idx} value={item.key}>{item.label}</Option>
		);
	});

	return dom;
}