import type { HardhatUserConfig } from 'hardhat/config';
import hardhatToolboxViem from '@nomicfoundation/hardhat-toolbox-viem';

const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
const accounts = deployerPrivateKey ? [deployerPrivateKey] : [];

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViem],
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      type: 'edr-simulated',
      chainType: 'l1',
    },
    localhost: {
      type: 'http',
      chainType: 'l1',
      url: 'http://127.0.0.1:8545',
    },
    amoy: {
      type: 'http',
      chainType: 'l1',
      url: process.env.POLYGON_AMOY_RPC_URL ?? 'https://rpc-amoy.polygon.technology',
      chainId: 80002,
      accounts,
    },
    polygon: {
      type: 'http',
      chainType: 'l1',
      url: process.env.POLYGON_RPC_URL ?? 'https://polygon-rpc.com',
      chainId: 137,
      accounts,
    },
  },
};

export default config;
