import ChartDisplaySelector from '../ChartDisplaySelector';

describe('ChartDisplaySelector planet meta toggles', ()=>{
	test('changePlanetMetaFlag keeps existing flags and updates the requested one', ()=>{
		const dispatch = jest.fn();
		const panel = new ChartDisplaySelector({
			dispatch,
			planetMetaDisplay: {
				showPostnatal: 1,
				showHouse: 1,
				showRuler: 0,
			},
		});

		panel.changePlanetMetaFlag('showRuler', true);

		expect(dispatch).toHaveBeenCalledWith({
			type: 'app/save',
			payload: {
				planetMetaDisplay: {
					showPostnatal: 1,
					showHouse: 1,
					showRuler: 1,
				},
			},
		});
	});

	test('changePlanetMetaFlag can read legacy object-valued showPlanetHouseInfo props', ()=>{
		const dispatch = jest.fn();
		const panel = new ChartDisplaySelector({
			dispatch,
			showPlanetHouseInfo: {
				showPostnatal: 1,
				showHouse: 0,
				showRuler: 1,
			},
		});

		panel.changePlanetMetaFlag('showHouse', true);

		expect(dispatch).toHaveBeenCalledWith({
			type: 'app/save',
			payload: {
				planetMetaDisplay: {
					showPostnatal: 1,
					showHouse: 1,
					showRuler: 1,
				},
			},
		});
	});

	test('changeAstroAnnotation updates showAstroMeaning for downstream renderers', ()=>{
		const dispatch = jest.fn();
		const panel = new ChartDisplaySelector({
			dispatch,
			showAstroMeaning: 0,
		});

		panel.changeAstroAnnotation(true);

		expect(dispatch).toHaveBeenCalledWith({
			type: 'app/save',
			payload: {
				showAstroMeaning: 1,
			},
		});
	});
});
