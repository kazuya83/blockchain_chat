import { getPrisma, type Db } from './_client';

export type ChainSyncState = {
  id: string;
  chainId: number;
  contractAddress: string;
  lastSyncedBlock: bigint;
};

export const getChainSyncState = async (
  params: { id: string; chainId: number; contractAddress: string; fromBlock: bigint },
  db: Db = getPrisma(),
): Promise<ChainSyncState> => {
  const existing = await db.chain_sync_states.findUnique({ where: { id: params.id } });

  // 対象のチェーンやコントラクトが変わったら、取り込み位置を引き継がずに作り直す。
  if (
    existing != null &&
    existing.chain_id === params.chainId &&
    existing.contract_address === params.contractAddress
  ) {
    return {
      id: existing.id,
      chainId: existing.chain_id,
      contractAddress: existing.contract_address,
      lastSyncedBlock: existing.last_synced_block,
    };
  }

  const row = await db.chain_sync_states.upsert({
    where: { id: params.id },
    create: {
      id: params.id,
      chain_id: params.chainId,
      contract_address: params.contractAddress,
      last_synced_block: params.fromBlock,
    },
    update: {
      chain_id: params.chainId,
      contract_address: params.contractAddress,
      last_synced_block: params.fromBlock,
    },
  });

  return {
    id: row.id,
    chainId: row.chain_id,
    contractAddress: row.contract_address,
    lastSyncedBlock: row.last_synced_block,
  };
};

export const advanceChainSyncState = async (
  params: { id: string; lastSyncedBlock: bigint },
  db: Db = getPrisma(),
): Promise<void> => {
  await db.chain_sync_states.update({
    where: { id: params.id },
    data: { last_synced_block: params.lastSyncedBlock },
  });
};
