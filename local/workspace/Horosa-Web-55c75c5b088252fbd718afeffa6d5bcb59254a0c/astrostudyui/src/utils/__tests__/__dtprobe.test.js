import DateTime from '../../components/comp/DateTime';
test('probe', () => {
	const d = new DateTime();
	d.parse('2026-07-19 17:23:00', 'YYYY-MM-DD HH:mm:ss');
	d.setYear(-8025);
	console.log('after setYear(-8025):', 'ad=', d.ad, 'year=', d.year, 'str=', d.format ? d.format('YYYY-MM-DD') : String(d));
	console.log('toString:', d.toString ? d.toString() : '(none)');
	const d2 = new DateTime();
	d2.parse('-8025-07-19 17:23:00', 'YYYY-MM-DD HH:mm:ss');
	console.log('parse -8025:', 'ad=', d2.ad, 'year=', d2.year, 'month=', d2.month, 'jdn=', d2.jdn);
});
