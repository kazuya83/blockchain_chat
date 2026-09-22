import { concatHex, keccak256 } from 'viem';
import type { Hex } from 'viem';

/**
 * ソート済みペアの keccak256 で作る Merkle 木。
 *
 * - 葉はそのまま（追加のハッシュは掛けない）。呼び出し側が葉を作る。
 * - 1 段ごとに隣り合う 2 つを「小さい方 → 大きい方」の順で連結して keccak256 する。
 *   順序を固定するので proof に左右の情報を持たせずに済み、OpenZeppelin の
 *   MerkleProof.verify と同じ計算になる（将来オンチェーン検証へ回せる）。
 * - 要素が奇数のときは余った 1 つをそのまま次の段へ繰り上げる。
 */
const hashPair = (a: Hex, b: Hex): Hex =>
  a.toLowerCase() <= b.toLowerCase() ? keccak256(concatHex([a, b])) : keccak256(concatHex([b, a]));

export const merkleRoot = (leaves: readonly Hex[]): Hex => {
  if (leaves.length === 0) {
    throw new Error('merkleRoot: leaves is empty');
  }

  let level = [...leaves];
  while (level.length > 1) {
    const next: Hex[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1];
      next.push(right === undefined ? left : hashPair(left, right));
    }
    level = next;
  }
  return level[0]!;
};

/** index 番目の葉が root に含まれることを示す proof（兄弟ノードの列）。 */
export const merkleProof = (leaves: readonly Hex[], index: number): Hex[] => {
  if (index < 0 || index >= leaves.length) {
    throw new Error(`merkleProof: index out of range: ${index}`);
  }

  const proof: Hex[] = [];
  let level = [...leaves];
  let position = index;

  while (level.length > 1) {
    const isRight = position % 2 === 1;
    const siblingIndex = isRight ? position - 1 : position + 1;
    const sibling = level[siblingIndex];
    // 繰り上げ（兄弟がいない）ときは proof に何も足さない
    if (sibling !== undefined) {
      proof.push(sibling);
    }

    const next: Hex[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1];
      next.push(right === undefined ? left : hashPair(left, right));
    }
    level = next;
    position = Math.floor(position / 2);
  }

  return proof;
};

export const verifyMerkleProof = (leaf: Hex, proof: readonly Hex[], root: Hex): boolean => {
  let computed = leaf;
  for (const sibling of proof) {
    computed = hashPair(computed, sibling);
  }
  return computed.toLowerCase() === root.toLowerCase();
};
