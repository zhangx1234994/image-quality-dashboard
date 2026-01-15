const mysql = require('mysql2/promise');

(async () => {
    try {
        console.log('开始测试数据库连接...\n');
        
        const pool = mysql.createPool({
            host: 'rm-bp1r74bu12nt8ibs5.mysql.rds.aliyuncs.com',
            port: 3306,
            user: 'kanban',
            password: 'Chrd5@0987',
            database: 'ai_design_test'
        });
        
        console.log('✅ 连接池创建成功');
        console.log('配置信息:');
        console.log('  - Host: rm-bp1r74bu12nt8ibs5.mysql.rds.aliyuncs.com');
        console.log('  - Database: ai_design_test');
        console.log('  - User: kanban\n');
        
        // 测试连接
        const connection = await pool.getConnection();
        console.log('✅ 数据库连接成功!\n');
        connection.release();
        
        // 查询总记录数
        const [total] = await pool.query('SELECT COUNT(*) as count FROM workflow_task');
        console.log('📊 总记录数:', total[0].count);
        
        // 查询子任务数
        const [subTasks] = await pool.query(`
            SELECT COUNT(*) as count 
            FROM workflow_task 
            WHERE sub_task_id IS NOT NULL AND sub_task_id != ''
        `);
        console.log('📊 子任务记录数:', subTasks[0].count);
        
        // 时间范围
        const [timeRange] = await pool.query(`
            SELECT 
                DATE_FORMAT(MIN(created_at), '%Y-%m-%d %H:%i:%s') as earliest,
                DATE_FORMAT(MAX(created_at), '%Y-%m-%d %H:%i:%s') as latest
            FROM workflow_task
        `);
        console.log('📅 最早记录:', timeRange[0].earliest);
        console.log('📅 最新记录:', timeRange[0].latest);
        
        // 最新的5条子任务
        const [latest] = await pool.query(`
            SELECT id, task_id, sub_task_id, action, status,
                   DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at
            FROM workflow_task 
            WHERE sub_task_id IS NOT NULL AND sub_task_id != ''
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        console.log('\n📝 最新5条子任务:');
        latest.forEach((task, idx) => {
            console.log(`  ${idx + 1}. ID:${task.id} | Action:${task.action} | Status:${task.status} | ${task.created_at}`);
        });
        
        await pool.end();
        console.log('\n✅ 测试完成!');
        
    } catch (error) {
        console.error('\n❌ 错误:', error.message);
        console.error('完整错误:', error);
        process.exit(1);
    }
})();
