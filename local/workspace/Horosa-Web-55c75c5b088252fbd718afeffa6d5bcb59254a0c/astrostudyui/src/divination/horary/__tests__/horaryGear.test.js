import { getTechniqueSettingsSchema } from '../../../utils/techniqueMountSettings';
describe('AI导出设置 gear: horary schema 含判读流派', () => {
  test('getTechniqueSettingsSchema(horary) 含 topicId + horarySchool 七档(批4 扩档,默认档不变)', () => {
    const s = getTechniqueSettingsSchema('horary');
    expect(s).toBeTruthy();
    const names = s.fields.map(f => f.name);
    expect(names).toContain('topicId');
    expect(names).toContain('horarySchool');
    const hs = s.fields.find(f => f.name === 'horarySchool');
    expect(hs.default).toBe('classical');
    expect(hs.options.map(o => o.value)).toEqual(['classical','renaissance','strict','sequence','hellenistic','medieval','modern']);
  });
});
