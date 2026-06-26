/**
 * 数据库初始化脚本
 * 运行: npm run db:init
 */

import 'dotenv/config';
import { initDB, closeDB } from './db.js';

console.log('🚀 初始化数据库...');
initDB();
closeDB();
