import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { keccak256, toHex } from 'viem';
import type { Hex } from 'viem';
import { merkleProof, merkleRoot, verifyMerkleProof } from './merkle';

const leavesOf = (count: number): Hex[] =>
  Array.from({ length: count }, (_, i) => keccak256(toHex(`leaf-${i}`)));

describe('merkle', () => {
  it('葉が 1 枚なら root は葉そのもの', () => {
    const leaves = leavesOf(1);
    assert.equal(merkleRoot(leaves), leaves[0]);
    assert.deepEqual(merkleProof(leaves, 0), []);
    assert.equal(verifyMerkleProof(leaves[0]!, [], merkleRoot(leaves)), true);
  });

  it('空なら例外', () => {
    assert.throws(() => merkleRoot([]), /leaves is empty/);
  });

  it('1〜17 枚のどの枚数でも、すべての葉の proof が検証できる', () => {
    for (let count = 1; count <= 17; count += 1) {
      const leaves = leavesOf(count);
      const root = merkleRoot(leaves);
      for (let i = 0; i < count; i += 1) {
        const proof = merkleProof(leaves, i);
        assert.equal(
          verifyMerkleProof(leaves[i]!, proof, root),
          true,
          `count=${count} index=${i} の proof が検証できない`,
        );
      }
    }
  });

  it('別の葉の proof では検証に失敗する', () => {
    const leaves = leavesOf(8);
    const root = merkleRoot(leaves);
    const proof = merkleProof(leaves, 3);
    assert.equal(verifyMerkleProof(leaves[4]!, proof, root), false);
  });

  it('葉を 1 つでも差し替えると root が変わる', () => {
    const leaves = leavesOf(5);
    const before = merkleRoot(leaves);
    const tampered = [...leaves];
    tampered[2] = keccak256(toHex('tampered'));
    assert.notEqual(merkleRoot(tampered), before);
  });

  it('葉を追記すると root が変わり、既存の葉の proof は古い root でのみ通る', () => {
    const leaves = leavesOf(4);
    const oldRoot = merkleRoot(leaves);
    const oldProof = merkleProof(leaves, 1);

    const grown = [...leaves, keccak256(toHex('leaf-4'))];
    const newRoot = merkleRoot(grown);

    assert.notEqual(newRoot, oldRoot);
    assert.equal(verifyMerkleProof(leaves[1]!, oldProof, oldRoot), true);
    assert.equal(verifyMerkleProof(leaves[1]!, oldProof, newRoot), false);
    assert.equal(verifyMerkleProof(leaves[1]!, merkleProof(grown, 1), newRoot), true);
  });

  it('proof の範囲外 index は例外', () => {
    const leaves = leavesOf(3);
    assert.throws(() => merkleProof(leaves, 3), /index out of range/);
    assert.throws(() => merkleProof(leaves, -1), /index out of range/);
  });
});
