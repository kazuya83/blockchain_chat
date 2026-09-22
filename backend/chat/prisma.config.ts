import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// .env はパッケージごとに持つ（このファイルの cwd は backend/chat）
config({ path: '.env' });

const { DB_USERNAME, DB_HOST, DB_PORT, DB_DATABASE } = process.env;
const DB_PASSWORD = process.env.DB_PASSWORD || null;
const userInfo = DB_PASSWORD != null ? `${DB_USERNAME}:${DB_PASSWORD}` : DB_USERNAME;
const DATABASE_URL = `mysql://${userInfo}@${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    // env() を使うと db:generate 時に DB 接続を要求されるため process.env を直接使う
    // NOTE: https://github.com/prisma/prisma/issues/28590
    url: DATABASE_URL,
  },
});
