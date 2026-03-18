import React from 'react';

jest.mock('../AstroMeaningData', () => ({
	buildMeaningTipByCategory: jest.fn((category, id) => ({
		title: `${category}:${id}`,
		tips: ['meaning'],
	})),
}));

jest.mock('../AstroMeaningPopover', () => ({
	isMeaningEnabled: jest.fn(() => true),
	wrapWithMeaning: jest.fn((node, enabled, tipobj) => ({
		node,
		enabled,
		tipobj,
	})),
}));

describe('AstroObjectLabel', () => {
	beforeEach(() => {
		jest.resetModules();
		global.React = React;
	});

	test('uses shared meaning popup for planets', () => {
		const AstroObjectLabel = require('../AstroObjectLabel').default;
		const { buildMeaningTipByCategory } = require('../AstroMeaningData');
		const { wrapWithMeaning } = require('../AstroMeaningPopover');

		const wrapped = AstroObjectLabel({ id: 'Sun', chartSources: {} });

		expect(buildMeaningTipByCategory).toHaveBeenCalledWith('planet', 'Sun');
		expect(wrapWithMeaning).toHaveBeenCalled();
		expect(wrapped.enabled).toBe(true);
		expect(wrapped.tipobj.title).toBe('planet:Sun');
		expect(wrapped.node.props.title).toBeUndefined();
	});

	test('detects sign and house meaning categories', () => {
		const AstroObjectLabel = require('../AstroObjectLabel').default;
		const { buildMeaningTipByCategory } = require('../AstroMeaningData');

		AstroObjectLabel({ id: 'Aries', chartSources: {} });
		AstroObjectLabel({ id: 'House1', chartSources: {} });
		AstroObjectLabel({ id: 'Asp90', chartSources: {} });

		expect(buildMeaningTipByCategory).toHaveBeenCalledWith('sign', 'Aries');
		expect(buildMeaningTipByCategory).toHaveBeenCalledWith('house', 'House1');
		expect(buildMeaningTipByCategory).toHaveBeenCalledWith('aspect', 'Asp90');
	});

	test('keeps native title when popup is disabled', () => {
		const meaningPopover = require('../AstroMeaningPopover');
		meaningPopover.isMeaningEnabled.mockReturnValue(false);
		meaningPopover.wrapWithMeaning.mockImplementation((node) => node);
		const AstroObjectLabel = require('../AstroObjectLabel').default;

		const node = AstroObjectLabel({ id: 'Sun', chartSources: {} });

		expect(node.props.title).toBeTruthy();
	});
});
