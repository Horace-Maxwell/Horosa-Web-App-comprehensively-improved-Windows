import {
	appendPlanetHouseInfo,
	appendPlanetHouseInfoById,
	splitPlanetHouseInfoText,
} from '../planetHouseInfo';

function buildChartSource() {
	return {
		chart: {
			objects: [
				{
					id: 'Sun',
					house: 'House 7',
					ruleHouses: ['House 5'],
				},
				{
					id: 'Moon',
					house: 'House 11',
					ruleHouses: ['House 4'],
				},
			],
		},
	};
}

describe('planetHouseInfo utilities', ()=>{
	test('appendPlanetHouseInfoById appends both house and ruler when postnatal display is enabled', ()=>{
		const text = appendPlanetHouseInfoById('太阳', buildChartSource(), 'Sun', {
			showHouse: 1,
			showRuler: 1,
		});
		expect(text).toBe('太阳 (7th; 5R)');
	});

	test('appendPlanetHouseInfo can use the object id directly for non-table callers', ()=>{
		const text = appendPlanetHouseInfo('太阳', {
			id: 'Sun',
			house: 'House 7',
			ruleHouses: ['House 5'],
		}, {
			showHouse: 1,
			showRuler: 1,
		});
		expect(text).toBe('太阳 (7th; 5R)');
	});

	test('appendPlanetHouseInfoById suppresses suffix when postnatal display is disabled', ()=>{
		const text = appendPlanetHouseInfoById('太阳', buildChartSource(), 'Sun', {
			showPostnatal: 0,
			showHouse: 1,
			showRuler: 1,
		});
		expect(text).toBe('太阳');
	});

	test('splitPlanetHouseInfoText separates the visible label and suffix info', ()=>{
		const parsed = splitPlanetHouseInfoText('太阳 (7th; 5R)');
		expect(parsed).toEqual({
			label: '太阳',
			info: '7th; 5R',
		});
	});
});
