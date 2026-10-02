import { describe, expect, it } from 'vitest';
import { corruptionKey, readHeroTolerances } from '../src/lib/tolerances';

describe('hero tolerances', () => {
  it('normalises corruption names from bosses, stats and sets', () => {
    expect(corruptionKey('Manashock')).toBe('manashock');
    expect(corruptionKey('ManaShockTolerance')).toBe('manashock');
    expect(corruptionKey('Blood Rot Tolerance')).toBe('bloodrot');
  });

  it('reads tolerances from heroes.json fields or Tolerance skills, ignoring unknown names', () => {
    const map = readHeroTolerances(
      [{ id: 'A', tolerances: [{ stat: 'DazeTolerance' }, { stat: 'NotATolerance' }] }, { id: 'B' }],
      [
        { heroId: 'A', skills: [{ type: 'Tolerance2', title: 'Blight Tolerance' }] },
        { heroId: 'B', skills: [{ type: 'Tolerance1', title: '<b>Mindfog Tolerance</b>' }, { type: 'Combo', title: 'Frost Tolerance' }] },
      ],
    );
    expect(map.get('A')).toEqual(['daze', 'blight']);
    expect(map.get('B')).toEqual(['mindfog']);
  });
});
