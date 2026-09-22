import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { network } from 'hardhat';
import { keccak256, toHex } from 'viem';

describe('ChatLogAnchor', () => {
  const roomId = keccak256(toHex('01JB0000000000000000000000'));
  const rootA = keccak256(toHex('root-a'));
  const rootB = keccak256(toHex('root-b'));

  let connection: Awaited<ReturnType<typeof network.getOrCreate>>;

  before(async () => {
    connection = await network.getOrCreate();
  });

  async function deploy() {
    const { viem } = connection;
    const [owner, backend, outsider] = await viem.getWalletClients();
    assert.ok(owner && backend && outsider);

    const anchor = await viem.deployContract('ChatLogAnchor', [owner.account.address]);

    return { viem, anchor, owner, backend, outsider };
  }

  it('デプロイ時点で owner は anchorer になっている', async () => {
    const { anchor, owner } = await deploy();
    assert.equal(await anchor.read.isAnchorer([owner.account.address]), true);
  });

  it('anchor で root が記録され、最新 root と連番が更新される', async () => {
    const { anchor, owner } = await deploy();

    await anchor.write.anchor([roomId, rootA, 4n], { account: owner.account });

    assert.equal(await anchor.read.latestRoot([roomId]), rootA);
    assert.equal(await anchor.read.anchorCount([roomId]), 1n);
    assert.equal(await anchor.read.isAnchored([roomId, rootA]), true);

    const record = await anchor.read.anchorOf([roomId, rootA]);
    assert.equal(record.messageCount, 4n);
    assert.equal(record.sequence, 1n);
    assert.ok(record.anchoredAt > 0n);

    await anchor.write.anchor([roomId, rootB, 6n], { account: owner.account });
    assert.equal(await anchor.read.latestRoot([roomId]), rootB);
    assert.equal(await anchor.read.anchorCount([roomId]), 2n);
    // 過去の root も引き続き検証できる
    assert.equal(await anchor.read.isAnchored([roomId, rootA]), true);
  });

  it('未記録の root は isAnchored が false', async () => {
    const { anchor } = await deploy();
    assert.equal(await anchor.read.isAnchored([roomId, rootA]), false);
  });

  it('anchorer でないアドレスは記録できない', async () => {
    const { viem, anchor, outsider } = await deploy();

    await viem.assertions.revertWithCustomErrorWithArgs(
      anchor.write.anchor([roomId, rootA, 1n], { account: outsider.account }),
      anchor,
      'NotAnchorer',
      [outsider.account.address],
    );
  });

  it('setAnchorer で権限を付け外しできる', async () => {
    const { viem, anchor, owner, backend } = await deploy();

    await anchor.write.setAnchorer([backend.account.address, true], {
      account: owner.account,
    });
    await anchor.write.anchor([roomId, rootA, 2n], { account: backend.account });
    assert.equal(await anchor.read.isAnchored([roomId, rootA]), true);

    await anchor.write.setAnchorer([backend.account.address, false], {
      account: owner.account,
    });
    await viem.assertions.revertWithCustomError(
      anchor.write.anchor([roomId, rootB, 3n], { account: backend.account }),
      anchor,
      'NotAnchorer',
    );
  });

  it('同じ root は二度記録できない', async () => {
    const { viem, anchor, owner } = await deploy();
    await anchor.write.anchor([roomId, rootA, 2n], { account: owner.account });

    await viem.assertions.revertWithCustomErrorWithArgs(
      anchor.write.anchor([roomId, rootA, 5n], { account: owner.account }),
      anchor,
      'AlreadyAnchored',
      [roomId, rootA],
    );
  });

  it('メッセージ件数が増えない root は拒否される（ログは追記のみ）', async () => {
    const { viem, anchor, owner } = await deploy();
    await anchor.write.anchor([roomId, rootA, 5n], { account: owner.account });

    await viem.assertions.revertWithCustomErrorWithArgs(
      anchor.write.anchor([roomId, rootB, 5n], { account: owner.account }),
      anchor,
      'MessageCountNotIncreasing',
      [5n, 5n],
    );
  });

  it('空の root は拒否される', async () => {
    const { viem, anchor, owner } = await deploy();

    await viem.assertions.revertWithCustomError(
      anchor.write.anchor([roomId, `0x${'0'.repeat(64)}`, 1n], {
        account: owner.account,
      }),
      anchor,
      'EmptyRoot',
    );
  });

  it('ルームが違えば同じ root を記録できる', async () => {
    const { anchor, owner } = await deploy();
    const otherRoom = keccak256(toHex('01JB0000000000000000000001'));

    await anchor.write.anchor([roomId, rootA, 1n], { account: owner.account });
    await anchor.write.anchor([otherRoom, rootA, 1n], { account: owner.account });

    assert.equal(await anchor.read.isAnchored([otherRoom, rootA]), true);
    assert.equal(await anchor.read.anchorCount([otherRoom]), 1n);
  });
});
