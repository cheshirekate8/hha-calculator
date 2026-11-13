import { describe, expect, it } from 'vitest';
import pkg from '../../package.json' with { type: 'json' };
import config from '../../pipeline.config.json' with { type: 'json' };

// The three dependency lists (package.json, pipeline.config.json, Dockerfile) must match:
// the container cannot install anything, so a package.json entry the image lacks fails
// only inside a run. The Dockerfile half is cross-checked at planning time.
describe('dependency manifest', () => {
  it('package.json pins exactly the packages pipeline.config.json declares', () => {
    const declared = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
    const fromPkg = Object.entries(declared).map(([n, v]) => `${n}@${v}`).sort();
    expect(fromPkg).toEqual([...config.dependencies.npm].sort());
  });
});
