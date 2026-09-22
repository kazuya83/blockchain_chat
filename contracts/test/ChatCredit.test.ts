import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { network } from 'hardhat';
import { parseEther } from 'viem';

describe('ChatCredit', () => {
  const minDeposit = parseEther('0.001');

  let connection: Awaited<ReturnType<typeof network.getOrCreate>>;

  before(async () => {
    connection = await network.getOrCreate();
  });

  async function deploy() {
    const { viem } = connection;
    const [owner, user, payer] = await viem.getWalletClients();
    assert.ok(owner && user && payer);

    const credit = await viem.deployContract('ChatCredit', [
      owner.account.address,
      minDeposit,
    ]);

    return { viem, credit, owner, user, payer };
  }

  it('deposit で入金額が累計され、depositId が 1 から採番される', async () => {
    const { credit, user } = await deploy();
    const amount = parseEther('1');

    await credit.write.deposit({ value: amount, account: user.account });

    assert.equal(await credit.read.lastDepositId(), 1n);
    assert.equal(await credit.read.totalDeposited([user.account.address]), amount);

    const events = await credit.getEvents.Deposited();
    assert.equal(events.length, 1);
    assert.equal(events[0]?.args.depositId, 1n);
    assert.equal(
      events[0]?.args.user?.toLowerCase(),
      user.account.address.toLowerCase(),
    );
    assert.equal(events[0]?.args.amount, amount);
  });

  it('depositFor では受益者に積まれ、payer には積まれない', async () => {
    const { credit, user, payer } = await deploy();
    const amount = parseEther('2');

    await credit.write.depositFor([user.account.address], {
      value: amount,
      account: payer.account,
    });

    assert.equal(await credit.read.totalDeposited([user.account.address]), amount);
    assert.equal(await credit.read.totalDeposited([payer.account.address]), 0n);
  });

  it('素の送金も入金として扱う', async () => {
    const { credit, user } = await deploy();
    const amount = parseEther('0.5');

    await user.sendTransaction({ to: credit.address, value: amount });

    assert.equal(await credit.read.totalDeposited([user.account.address]), amount);
  });

  it('minDeposit 未満は DepositTooSmall で失敗する', async () => {
    const { viem, credit, user } = await deploy();

    await viem.assertions.revertWithCustomErrorWithArgs(
      credit.write.deposit({ value: 1n, account: user.account }),
      credit,
      'DepositTooSmall',
      [1n, minDeposit],
    );
  });

  it('owner 以外は setMinDeposit / withdraw を呼べない', async () => {
    const { viem, credit, user } = await deploy();

    await viem.assertions.revertWithCustomError(
      credit.write.setMinDeposit([0n], { account: user.account }),
      credit,
      'OwnableUnauthorizedAccount',
    );
    await viem.assertions.revertWithCustomError(
      credit.write.withdraw([user.account.address], { account: user.account }),
      credit,
      'OwnableUnauthorizedAccount',
    );
  });

  it('withdraw でコントラクト残高が空になる', async () => {
    const { viem, credit, owner, user } = await deploy();
    const amount = parseEther('3');
    await credit.write.deposit({ value: amount, account: user.account });

    const publicClient = await viem.getPublicClient();
    assert.equal(await publicClient.getBalance({ address: credit.address }), amount);

    await credit.write.withdraw([owner.account.address], { account: owner.account });

    assert.equal(await publicClient.getBalance({ address: credit.address }), 0n);
  });
});
