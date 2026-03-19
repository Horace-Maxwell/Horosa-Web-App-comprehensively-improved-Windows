import { buildNormalizedSu28State } from '../su28Data';

describe('buildNormalizedSu28State', ()=>{
	test('fills missing su28 houses with safe placeholders', ()=>{
		const result = buildNormalizedSu28State({
			fixedStarSu28: [{ name: '角', ra: 12 }],
			objects: [],
		}, null);

		expect(result.houses).toHaveLength(28);
		expect(result.houseMap.get('角').ra).toBe(12);
		expect(result.houseMap.get('亢').name).toBe('亢');
		expect(result.houseMap.get('亢').planets).toEqual([]);
		expect(result.missingHouseNames.length).toBe(27);
	});

	test('skips objects with unknown su28 names instead of crashing', ()=>{
		const result = buildNormalizedSu28State({
			fixedStarSu28: [{ name: '角', ra: 12 }],
			objects: [{ id: 'Sun', ra: 20, su28: '未知宿' }],
		}, null);

		expect(result.houseMap.get('角').planets).toEqual([]);
		expect(result.unknownAssignments).toEqual([{ id: 'Sun', su28: '未知宿' }]);
	});
});
