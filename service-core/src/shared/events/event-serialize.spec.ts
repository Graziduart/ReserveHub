import { toEventJson } from './event-serialize';

describe('toEventJson', () => {
  it('serializa Date para ISO string', () => {
    const d = new Date('2026-05-21T10:00:00.000Z');
    const out = toEventJson({ when: d, name: 'test' });
    expect(out).toEqual({
      when: '2026-05-21T10:00:00.000Z',
      name: 'test',
    });
  });

  it('preserva estruturas aninhadas', () => {
    const input = {
      reservation: { id: 'r1', status: 'PENDING', nested: { a: 1 } },
    };
    expect(toEventJson(input)).toEqual(input);
  });
});
