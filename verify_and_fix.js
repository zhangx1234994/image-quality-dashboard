const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

(async () => {
    console.log('='.repeat(60));
    console.log('开始自动诊断和修复...');
    console.log('='.repeat(60));
    
    // 测试所有可能的数据库
    const configs = [
        { host: 'rm-bp1r74bu12nt8ibs5.mysql.rds.aliyuncs.com', db: 'ai_design_test', name: '测试库(5)' },
        { host: 'rm-bp1r74bu12nt8ibs50o.mysql.rds.aliyuncs.com', db: 'ai_design_test', name: '测试库(0)' },
        { host: 'rm-bp1r74bu12nt8ibs5.mysql.rds.aliyuncs.com', db: 'ai_design_prod', name: '生产库(5)' },
        { host: 'rm-bp1r74bu12nt8ibs50o.mysql.rds.aliyuncs.com', db: 'ai_design_prod', name: '生产库(0)' },
        { host: 'rm-bp1r74bu12nt8ibs50o.mysql.rds.aliyuncs.com', db: 'ai_design_dev', name: '开发库(0)' }
    ];
    
    let bestConfig = null;
    let maxCount = 0;
    
    console.log('\n🔍 第1步: 测试所有数据库连接...\n');
    
    for (const config of configs) {
        try {
            const pool = mysql.createPool({
                host: config.host,
                port: 3306,
                user: 'kanban',
                password: 'Chrd5@0987',
                database: config.db,
                connectTimeout: 5000
            });
            
            const [result] = await pool.query(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN sub_task_id IS NOT NULL AND sub_task_id != '' THEN 1 END) as subtasks
                FROM workflow_task
            `);
            
            const total = result[0].total;
            const subtasks = result[0].subtasks;
            
            console.log(`✅ ${config.name}`);
            console.log(`   Host: ${config.host}`);
            console.log(`   Database: ${config.db}`);
            console.log(`   总记录: ${total} 条`);
            console.log(`   子任务: ${subtasks} 条\n`);
            
            if (subtasks > maxCount) {
                maxCount = subtasks;
                bestConfig = config;
            }
            
            await pool.end();
        } catch (error) {
            console.log(`❌ ${config.name} - 连接失败: ${error.message}\n`);
        }
    }
    
    if (!bestConfig) {
        console.error('\n❌ 所有数据库都连接失败!请检查网络或凭证。');
        process.exit(1);
    }
    
    console.log('='.repeat(60));
    console.log(`\n🎯 找到最佳数据库: ${bestConfig.name}`);
    console.log(`   Host: ${bestConfig.host}`);
    console.log(`   Database: ${bestConfig.db}`);
    console.log(`   子任务数: ${maxCount} 条\n`);
    
    // 更新 server.js 配置
    console.log('🔧 第2步: 自动更新 server.js 配置...\n');
    
    const serverPath = path.join(__dirname, 'server.js');
    let serverContent = fs.readFileSync(serverPath, 'utf8');
    
    const newConfig = `// 数据库连接配置
const dbConfig = {
    host: '${bestConfig.host}',
    port: 3306,
    user: 'kanban',
    password: 'Chrd5@0987',
    database: '${bestConfig.db}',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};`;
    
    serverContent = serverContent.replace(
        /\/\/ 数据库连接配置\s*const dbConfig = \{[\s\S]*?\};/,
        newConfig
    );
    
    fs.writeFileSync(serverPath, serverContent, 'utf8');
    console.log('✅ server.js 配置已更新!\n');
    
    // 验证最终配置
    console.log('='.repeat(60));
    console.log('\n✅ 自动修复完成!\n');
    console.log('📊 最终配置:');
    console.log(`   - 主机: ${bestConfig.host}`);
    console.log(`   - 数据库: ${bestConfig.db}`);
    console.log(`   - 子任务数: ${maxCount} 条`);
    console.log('\n🚀 下一步操作:');
    console.log('   1. 重启服务: npm start');
    console.log('   2. 访问: http://localhost:3000/index.html');
    console.log('\n' + '='.repeat(60));
    
})();
