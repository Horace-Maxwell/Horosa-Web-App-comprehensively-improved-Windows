import * as AstroConst from '../../constants/AstroConst';
import {
	appendPlanetHouseInfo,
	appendPlanetHouseInfoById,
	splitPlanetHouseInfoText,
} from '../planetHouseInfo';

jest.mock('../storageutil', () => ({
	getStore: jest.fn(() => null),
}));

function buildChartObj(){
	return {
		chart: {
			objects: [{
				id: AstroConst.NEPTUNE,
				house: 'House8',
				ruleHouses: ['House4', 'House7'],
			}],
		},
	};
}

describe('planetHouseInfo', ()=>{
	test('appends postnatal house info for legacy boolean flag', ()=>{
		expect(appendPlanetHouseInfoById('海', buildChartObj(), AstroConst.NEPTUNE, 1))
			.toBe('海 (8th; 4R7R)');
	});

	test('supports partial legacy objects and direct object input', ()=>{
		const obj = {
			id: AstroConst.NEPTUNE,
			house: 'House8',
			ruleHouses: ['House4', 'House7'],
		};
		expect(appendPlanetHouseInfoById('海', buildChartObj(), AstroConst.NEPTUNE, {
			showHouse: 1,
			showRuler: 0,
		})).toBe('海 (8th)');
		expect(appendPlanetHouseInfo('海', obj, {
			showPostnatal: 1,
			showHouse: 0,
			showRuler: 1,
		})).toBe('海 (4R7R)');
	});

	test('splits label text and suffix info cleanly', ()=>{
		expect(splitPlanetHouseInfoText('海 (8th; 4R7R)')).toEqual({
			label: '海',
			info: '8th; 4R7R',
		});
		expect(splitPlanetHouseInfoText('海')).toEqual({
			label: '海',
			info: '',
		});
	});
});
