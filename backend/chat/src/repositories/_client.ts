import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';
import { validate } from '../libs/validate';

// 起動時検証
const DB_USERNAME = validate(process.env.DB_USERNAME, 'DB_USERNAME');
const DB_PASSWORD = process.env.DB_PASSWORD || undefined;
const DB_HOST = validate(process.env.DB_HOST, 'DB_HOST');
const DB_PORT = validate(process.env.DB_PORT, 'DB_PORT');
const DB_DATABASE = validate(process.env.DB_DATABASE, 'DB_DATABASE');
const DB_SSL = process.env.DB_SSL === 'true';

const adapter = new PrismaMariaDb({
  host: DB_HOST,
  port: Number(DB_PORT),
  user: DB_USERNAME,
  password: DB_PASSWORD,
  database: DB_DATABASE,
  ssl: DB_SSL,
});

// Singleton
const prisma = new PrismaClient({ adapter });
export const getPrisma = () => prisma;

/** トランザクション内で使うクライアント。repository の引数で受け渡す。 */
export type PrismaTx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
export type Db = PrismaClient | PrismaTx;
