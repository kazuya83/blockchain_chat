/**
 * ChatCredit / ChatLogAnchor をデプロイする。
 *
 *   DEPLOYER_PRIVATE_KEY=0x... npx hardhat run scripts/deploy.ts --network amoy
 *
 * デプロイ後に出力されるアドレスを backend の .env（CHAIN_CHAT_CREDIT_ADDRESS /
 * CHAIN_CHAT_LOG_ANCHOR_ADDRESS）へ設定する。
 */
import { network } from 'hardhat';
import { formatEther } from 'viem';

const minDeposit = BigInt(process.env.CHAT_CREDIT_MIN_DEPOSIT_WEI ?? '1000000000000000');

const { viem, networkName } = await network.getOrCreate();

const [deployer] = await viem.getWalletClients();
if (!deployer) {
  throw new Error('デプロイ用のアカウントがない。DEPLOYER_PRIVATE_KEY を設定する。');
}

const publicClient = await viem.getPublicClient();
const balance = await publicClient.getBalance({ address: deployer.account.address });

console.log(`network:  ${networkName}`);
console.log(`deployer: ${deployer.account.address} (${formatEther(balance)})`);

const credit = await viem.deployContract('ChatCredit', [
  deployer.account.address,
  minDeposit,
]);
console.log(`ChatCredit:     ${credit.address} (minDeposit=${formatEther(minDeposit)})`);

const anchor = await viem.deployContract('ChatLogAnchor', [deployer.account.address]);
console.log(`ChatLogAnchor:  ${anchor.address}`);

console.log('');
console.log('backend/chat/.env に設定する:');
console.log(`CHAIN_CHAT_CREDIT_ADDRESS=${credit.address}`);
console.log(`CHAIN_CHAT_LOG_ANCHOR_ADDRESS=${anchor.address}`);
