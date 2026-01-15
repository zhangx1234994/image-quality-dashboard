const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// 数据库连接配置 - 使用用户提供的正确地址
const dbConfig = {
    host: 'rm-bp1r74bu12nt8ibs50o.mysql.rds.aliyuncs.com',
    port: 3306,
    user: 'kanban',
    password: 'Chrd5@0987',
    database: 'ai_design_test',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000 // 增加连接超时时间
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// 测试数据库连接
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ 数据库连接测试成功!');
        connection.release();
        console.log('📊 系统将使用数据库作为唯一数据源');
    } catch (error) {
        console.error('❌ 数据库连接测试失败:', error.message);
        console.error('⚠️  请检查网络连接或数据库配置');
    }
}

// 任务类型映射
const actionMap = {
    'extend': '画布扩展',
    'hires': '高清放大',
    'fission': '图片裂变',
    'pattern-extract': '图案提取',
    'img2img': '图生图'
};

// API: 获取统计数据
app.get('/api/stats', async (req, res) => {
    try {
        // 只使用数据库查询
        const [totalResult] = await pool.query(
            'SELECT COUNT(*) as total FROM workflow_task WHERE sub_task_id IS NOT NULL AND sub_task_id != ""'
        );
        
        const [successResult] = await pool.query(
            'SELECT COUNT(*) as success FROM workflow_task WHERE status = 2 AND sub_task_id IS NOT NULL AND sub_task_id != ""'
        );
        
        const [userResult] = await pool.query(
            'SELECT COUNT(DISTINCT user_id) as users FROM workflow_task WHERE sub_task_id IS NOT NULL AND sub_task_id != ""'
        );
        
        const [actionResult] = await pool.query(
            'SELECT COUNT(DISTINCT action) as actions FROM workflow_task WHERE action IS NOT NULL AND sub_task_id IS NOT NULL AND sub_task_id != ""'
        );

        res.json({
            success: true,
            data: {
                total: totalResult[0].total,
                success: successResult[0].success,
                users: userResult[0].users,
                actions: actionResult[0].actions
            }
        });
    } catch (error) {
        console.error('获取统计数据失败:', error);
        res.status(500).json({
            success: false,
            message: '获取统计数据失败',
            error: error.message
        });
    }
});

// API: 获取所有操作类型
app.get('/api/actions', async (req, res) => {
    try {
        // 只使用数据库查询
        const [results] = await pool.query(
            'SELECT DISTINCT action FROM workflow_task WHERE action IS NOT NULL AND sub_task_id IS NOT NULL AND sub_task_id != "" ORDER BY action'
        );
        
        const actions = results.map(row => ({
            value: row.action,
            label: actionMap[row.action] || row.action
        }));

        res.json({
            success: true,
            data: actions
        });
    } catch (error) {
        console.error('获取操作类型失败:', error);
        res.status(500).json({
            success: false,
            message: '获取操作类型失败',
            error: error.message
        });
    }
});

// API: 获取任务列表(支持筛选) - 只查询子任务(图片生成质量对比)
app.get('/api/tasks', async (req, res) => {
    try {
        const { user_id, action, status, limit = 10, offset = 0, start_date, end_date } = req.query;
        
        // 只使用数据库查询，支持分页加载，保留筛选功能
        let sql = `SELECT * FROM workflow_task WHERE sub_task_id IS NOT NULL AND sub_task_id != ''`;
        const params = [];

        // 添加筛选条件
        if (user_id) {
            sql += ' AND user_id LIKE ?';
            params.push(`%${user_id}%`);
        }

        if (action) {
            sql += ' AND action = ?';
            params.push(action);
        }

        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }

        // 时间区间筛选
        if (start_date) {
            sql += ' AND created_at >= ?';
            params.push(start_date);
        }

        if (end_date) {
            sql += ' AND created_at <= ?';
            params.push(end_date);
        }

        // 排序和分页 - 使用id排序避免内存问题，按id降序获取最新数据
        sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [tasks] = await pool.query(sql, params);

        // 处理每个子任务的图片
        const processedTasks = tasks.map(task => processTaskImages(task));

        res.json({
            success: true,
            data: processedTasks,
            count: processedTasks.length
        });
    } catch (error) {
        console.error('获取任务列表失败:', error);
        res.status(500).json({
            success: false,
            message: '获取任务列表失败',
            error: error.message
        });
    }
});

// 处理任务图片的辅助函数
function processTaskImages(task) {
    let originalImages = [];
    let resultImages = [];

    // 解析原图
    try {
        if (task.original_images) {
            if (Array.isArray(task.original_images)) {
                originalImages = task.original_images;
            } else if (typeof task.original_images === 'string' && task.original_images !== 'null') {
                try {
                    const parsed = JSON.parse(task.original_images);
                    originalImages = Array.isArray(parsed) ? parsed : [parsed];
                } catch {
                    originalImages = [task.original_images];
                }
            }
        }
    } catch (e) {
        console.error('解析原图失败:', e.message);
    }

    // 解析结果图
    try {
        if (task.images) {
            if (Array.isArray(task.images)) {
                resultImages = task.images;
            } else if (typeof task.images === 'string' && task.images !== 'null') {
                try {
                    const parsed = JSON.parse(task.images);
                    resultImages = Array.isArray(parsed) ? parsed : [parsed];
                } catch {
                    resultImages = [task.images];
                }
            }
        }
    } catch (e) {
        console.error('解析结果图失败:', e.message);
    }

    // 创建新对象，避免重复字段
    const processedTask = {
        ...task,
        actionLabel: actionMap[task.action] || task.action
    };
    
    // 只添加需要的图片字段
    processedTask.originalImages = originalImages.filter(url => url && typeof url === 'string' && url.startsWith('http'));
    processedTask.resultImages = resultImages.filter(url => url && typeof url === 'string' && url.startsWith('http'));
    
    return processedTask;
}

// API: 获取单个任务详情
app.get('/api/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 只使用数据库查询
        const [results] = await pool.query(
            'SELECT * FROM workflow_task WHERE id = ?',
            [id]
        );

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: '任务不存在'
            });
        }

        const task = results[0];
        
        // 处理图片
        const processedTask = processTaskImages(task);

        res.json({
            success: true,
            data: processedTask
        });
    } catch (error) {
        console.error('获取任务详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取任务详情失败',
            error: error.message
        });
    }
});

// 健康检查
app.get('/api/health', async (req, res) => {
    try {
        // 只检查数据库连接
        await pool.query('SELECT 1');
        res.json({
            success: true,
            message: '服务运行正常',
            database: '已连接'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '服务异常',
            error: error.message,
            database: '未连接'
        });
    }
});

// 启动服务器
app.listen(PORT, async () => {
    console.log('🚀 服务器启动成功!');
    console.log(`📍 服务地址: http://localhost:${PORT}`);
    console.log(`📊 看板地址: http://localhost:${PORT}/index.html`);
    console.log('');
    await testConnection();
});

// 优雅关闭
process.on('SIGINT', async () => {
    console.log('\n正在关闭服务器...');
    await pool.end();
    process.exit(0);
});
