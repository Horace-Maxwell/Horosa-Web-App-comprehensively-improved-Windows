import React from 'react';

jest.mock('../../../utils/helper', () => ({
	genHtml: jest.fn(() => '<div>meaning</div>'),
}));

describe('wrapWithMeaning', () => {
	beforeEach(() => {
		jest.resetModules();
		global.React = React;
	});

	test('keeps host element as tooltip trigger', () => {
		const { wrapWithMeaning } = require('../AstroMeaningPopover');
		const node = <div className='test-node' style={{ position: 'absolute', left: 10 }}>星</div>;

		const wrapped = wrapWithMeaning(node, 1, { text: 'meaning' });
		const trigger = wrapped.props.triggerNode;

		expect(trigger.type).toBe('div');
		expect(trigger.props.className).toBe('test-node');
		expect(trigger.props.style).toMatchObject({
			position: 'absolute',
			left: 10,
			cursor: 'help',
		});
		expect(trigger.props.children).toBe('星');
	});

	test('falls back to span wrapper for plain text', () => {
		const { wrapWithMeaning } = require('../AstroMeaningPopover');

		const wrapped = wrapWithMeaning('星', 1, { text: 'meaning' });
		const trigger = wrapped.props.triggerNode;

		expect(trigger.type).toBe('span');
		expect(trigger.props.style).toMatchObject({ cursor: 'help' });
		expect(trigger.props.children).toBe('星');
	});
});
