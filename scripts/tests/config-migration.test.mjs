import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { __migrateLegacyConfigDirForTest } from '../config.mjs';

describe('config migration', () => {
  it('migrates when legacy exists and new path is absent', () => {
    const renamed = [];
    const exists = new Set(['/home/u/.config/hyperliquid-dpro']);
    const migrated = __migrateLegacyConfigDirForTest(
      '/home/u/.config/dpro-hl',
      '/home/u/.config/hyperliquid-dpro',
      {
        existsSync: (p) => exists.has(p),
        renameSync: (from, to) => {
          renamed.push([from, to]);
          exists.delete(from);
          exists.add(to);
        },
      },
    );

    assert.equal(migrated, true);
    assert.deepEqual(renamed, [['/home/u/.config/hyperliquid-dpro', '/home/u/.config/dpro-hl']]);
  });

  it('does nothing when new path already exists', () => {
    const renamed = [];
    const migrated = __migrateLegacyConfigDirForTest(
      '/home/u/.config/dpro-hl',
      '/home/u/.config/hyperliquid-dpro',
      {
        existsSync: (p) => p === '/home/u/.config/dpro-hl' || p === '/home/u/.config/hyperliquid-dpro',
        renameSync: (from, to) => renamed.push([from, to]),
      },
    );

    assert.equal(migrated, false);
    assert.equal(renamed.length, 0);
  });

  it('throws clear error when migration fails', () => {
    const existing = new Set(['/home/u/.config/hyperliquid-dpro']);
    assert.throws(
      () => __migrateLegacyConfigDirForTest(
        '/home/u/.config/dpro-hl',
        '/home/u/.config/hyperliquid-dpro',
        {
          existsSync: (p) => existing.has(p),
          renameSync: () => {
            throw new Error('EPERM');
          },
        },
      ),
      /Failed to migrate config directory/,
    );
  });
});
