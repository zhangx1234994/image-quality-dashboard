const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'dist')));

// 设置JSON API响应编码为UTF-8（只影响 /api 路由）
app.use('/api', (req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// 数据库连接配置 - 同一实例下按请求切换正式库/测试库
const baseDbConfig = {
    host: 'rm-bp1r74bu12nt8ibs50o.mysql.rds.aliyuncs.com',
    port: 3306,
    user: 'kanban',
    password: 'Chrd5@0987',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000, // 增加连接超时时间
    charset: 'utf8mb4'
};

const databaseOptions = {
    prod: { label: '正式库', database: 'ai_design_prod' },
    test: { label: '测试库', database: 'ai_design_test' }
};

// 创建数据库连接池
const pools = Object.fromEntries(
    Object.entries(databaseOptions).map(([key, option]) => [
        key,
        mysql.createPool({ ...baseDbConfig, database: option.database })
    ])
);

const schemaCapabilities = Object.fromEntries(
    Object.keys(databaseOptions).map((key) => [key, { loadedAt: 0, hasActionSecond: false }])
);
const SCHEMA_CACHE_TTL_MS = 60 * 1000;

function getDatabaseKey(value) {
    return value === 'test' ? 'test' : 'prod';
}

async function getSchemaCapabilities(dbKey) {
    const cached = schemaCapabilities[dbKey];
    const now = Date.now();
    if (cached && now - cached.loadedAt < SCHEMA_CACHE_TTL_MS) {
        return cached;
    }

    const option = databaseOptions[dbKey];
    const pool = pools[dbKey];
    const [columns] = await pool.query(
        `SELECT COLUMN_NAME
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'workflow_task' AND COLUMN_NAME = 'action_second'
        LIMIT 1`,
        [option.database]
    );

    schemaCapabilities[dbKey] = {
        loadedAt: now,
        hasActionSecond: columns.length > 0
    };

    return schemaCapabilities[dbKey];
}

async function getDbContext(req) {
    const dbKey = getDatabaseKey(req.query.db);
    return {
        dbKey,
        pool: pools[dbKey],
        capabilities: await getSchemaCapabilities(dbKey)
    };
}

// 测试数据库连接
async function testConnection() {
    for (const [key, option] of Object.entries(databaseOptions)) {
        try {
            const connection = await pools[key].getConnection();
            console.log(`✅ ${option.label}连接测试成功: ${option.database}`);
            connection.release();
        } catch (error) {
            console.error(`❌ ${option.label}连接测试失败:`, error.message);
        }
    }
    console.log('📊 系统将按页面选择切换正式库/测试库');
}

// 任务类型映射
const actionMap = {
    'extend': '画布扩展',
    'hires': '高清放大',
    'fission': '图片裂变',
    'pattern-extract': '图案提取',
    'img2img': '图生图',
    'edit': '局部编辑',
    'seamless': '无缝平铺'
};

const actionLabelToValue = Object.fromEntries(
    Object.entries(actionMap).map(([value, label]) => [label, value])
);

const actionSecondMap = {
    ComfyUIVL0514: 'ComfyUI 版本',
    GPTImage2VL: '商业模型',
    CozeTextEnhance: '文生图裂变'
};

function normalizeStatus(status) {
    const statusMap = { '成功': 2, '失败': 1, '处理中': 0 };
    if (status === undefined || status === null || status === '') {
        return undefined;
    }
    return statusMap[status] !== undefined ? statusMap[status] : status;
}

function normalizeAction(action) {
    if (!action) {
        return undefined;
    }
    return actionLabelToValue[action] || action;
}

function appendCommonFilters(sql, params, filters = {}, capabilities = {}) {
    const { user_id, action, action_second, status, start_date, end_date, search } = filters;

    if (user_id) {
        sql += ` AND (
            wt.user_id LIKE ?
            OR COALESCE(u.username, '') LIKE ?
            OR COALESCE(u.nickname, '') LIKE ?
        )`;
        params.push(`%${user_id}%`, `%${user_id}%`, `%${user_id}%`);
    }

    const normalizedAction = normalizeAction(action);
    if (normalizedAction) {
        sql += ' AND wt.action = ?';
        params.push(normalizedAction);
    }

    if (normalizedAction === 'fission' && action_second && capabilities.hasActionSecond) {
        sql += ' AND wt.action_second = ?';
        params.push(action_second);
    }

    const normalizedStatus = normalizeStatus(status);
    if (normalizedStatus !== undefined) {
        sql += ' AND wt.status = ?';
        params.push(normalizedStatus);
    }

    if (start_date) {
        sql += ' AND wt.created_at >= ?';
        params.push(`${start_date} 00:00:00`);
    }

    if (end_date) {
        sql += ' AND wt.created_at <= ?';
        params.push(`${end_date} 23:59:59`);
    }

    if (search) {
        sql += ` AND (
            wt.sub_task_id LIKE ?
            OR wt.task_id LIKE ?
            OR CAST(wt.id AS CHAR) LIKE ?
            OR wt.user_id LIKE ?
            OR COALESCE(u.username, '') LIKE ?
            OR COALESCE(u.nickname, '') LIKE ?
            OR wt.prompt_msg LIKE ?
        )`;
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    return sql;
}

// API: 获取统计数据
app.get('/api/stats', async (req, res) => {
    try {
        const { pool } = await getDbContext(req);
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
        const { pool } = await getDbContext(req);
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
        const { pool, capabilities } = await getDbContext(req);
        const { limit = 10, offset = 0 } = req.query;
        
        // 只使用数据库查询，支持分页加载，保留筛选功能
        let sql = `SELECT wt.*, u.username AS username, u.nickname AS nickname
            FROM workflow_task wt
            LEFT JOIN users u ON u.user_id = wt.user_id
            WHERE wt.sub_task_id IS NOT NULL AND wt.sub_task_id != ''`;
        const params = [];

        sql = appendCommonFilters(sql, params, req.query, capabilities);

        // 先获取总数
        const countSql = sql.replace('SELECT wt.*, u.username AS username, u.nickname AS nickname', 'SELECT COUNT(DISTINCT wt.id) as total');
        const [countResult] = await pool.query(countSql, params);
        const total = countResult[0]?.total || 0;

        // 排序和分页 - 使用id排序避免内存问题，按id降序获取最新数据
        sql += ' ORDER BY wt.id DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [tasks] = await pool.query(sql, params);

        // 处理每个子任务的图片
        const processedTasks = tasks.map(task => processTaskImages(task));

        res.json({
            success: true,
            data: processedTasks,
            count: total
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

function parseWorkflowParams(task) {
    if (!task.workflow_params) {
        return {};
    }

    if (typeof task.workflow_params === 'string') {
        try {
            return JSON.parse(task.workflow_params);
        } catch (error) {
            return {};
        }
    }

    return task.workflow_params;
}

function getNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    return null;
}

function formatParamValue(value) {
    if (value === undefined || value === null || value === '') {
        return '';
    }
    if (typeof value === 'boolean') {
        return value ? '开启' : '关闭';
    }
    return String(value);
}

function pushParam(items, label, value) {
    const formatted = formatParamValue(value);
    if (formatted) {
        items.push({ label, value: formatted });
    }
}

function getActionSecond(task, workflowParams) {
    return task.action_second || workflowParams.actionSecond || workflowParams.action_second || '';
}

function getKeyParams(task, workflowParams) {
    const items = [];
    const actionSecond = getActionSecond(task, workflowParams);

    if (task.action === 'fission' || workflowParams.toolType === 'fission') {
        pushParam(items, '裂变模式', actionSecondMap[actionSecond] || actionSecond || '旧版裂变');
        pushParam(items, '生成数量', workflowParams.count);

        if (actionSecond === 'ComfyUIVL0514') {
            pushParam(items, '版本', workflowParams.actionVersion);
            pushParam(items, '参考强度', workflowParams.reference_strength);
            pushParam(items, '参考锁定', workflowParams.reference_lock);
            pushParam(items, '色彩锁定', workflowParams.color_lock);
            pushParam(items, 'Profile', workflowParams.profile);
            pushParam(items, '增强模式', workflowParams.enhanced);
            return items;
        }

        if (actionSecond === 'GPTImage2VL') {
            pushParam(items, '版本', workflowParams.actionVersion);
            pushParam(items, '变化强度', workflowParams.variation_strength);
            pushParam(items, '尺寸', workflowParams.size);
            pushParam(items, '质量', workflowParams.quality);
            return items;
        }

        if (actionSecond === 'CozeTextEnhance') {
            pushParam(items, '比例', workflowParams.ratio);
            return items;
        }

        pushParam(items, '参考强度', workflowParams.reference_strength);
        pushParam(items, '增强模式', workflowParams.enhanced);
    }

    return items;
}

function getDurationSeconds(startedAt, finishedAt) {
    if (!startedAt || !finishedAt) {
        return null;
    }

    const diffMs = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) {
        return null;
    }

    return Math.round(diffMs / 1000);
}

function toImagePair(task) {
    const processedTask = processTaskImages(task);
    const workflowParams = parseWorkflowParams(task);

    const originalImages = processedTask.originalImages || [];
    const resultImages = processedTask.resultImages || [];
    const subtaskIdParts = (task.task_id || '').split('_');
    const subtaskNo = subtaskIdParts.length > 1 ? `#${subtaskIdParts[subtaskIdParts.length - 1]}` : `#${task.id}`;
    const createdAt = task.created_at ? new Date(task.created_at) : new Date();
    const date = `${createdAt.getFullYear()}/${createdAt.getMonth() + 1}/${createdAt.getDate()}`;
    const operationType = actionMap[task.action] || task.action || '图片增强';
    const statusMap = { 0: '处理中', 1: '失败', 2: '成功', 3: '失败', completed: '成功', failed: '失败', processing: '处理中' };
    const status = statusMap[task.status] || '处理中';
    const firstInput = Array.isArray(workflowParams.imageList) ? workflowParams.imageList[0] : null;
    const originalSize = firstInput?.o_size || workflowParams.o_size || {};
    const durationSeconds = getDurationSeconds(task.started_at, task.finished_at);
    const actionSecond = getActionSecond(task, workflowParams);

    return {
        id: task.id,
        name: `${(task.sub_task_id || '').trim() || task.id}.jpg`,
        subtaskNo: subtaskNo,
        subtaskId: task.sub_task_id || '',
        taskId: task.task_id || '',
        operationType: operationType,
        actionSecond: actionSecond,
        keyParams: getKeyParams(task, workflowParams),
        userId: task.user_id || '',
        username: task.username || '',
        nickname: task.nickname || '',
        date: date,
        originalCount: originalImages.length,
        resultCount: resultImages.length,
        subTaskCount: Number(task.sub_task_count) || 1,
        status: status,
        original: originalImages.length > 0 ? originalImages[0] : '',
        result: resultImages.length > 0 ? resultImages[0] : '',
        tag: operationType.replace('图片', ''),
        createdAt: task.created_at || '',
        updatedAt: task.updated_at || '',
        startedAt: task.started_at || '',
        finishedAt: task.finished_at || '',
        durationSeconds: durationSeconds,
        promptId: task.prompt_id || '',
        promptText: (task.prompt_msg || workflowParams.prompt || '').trim(),
        errorMessage: task.error_message || '',
        model: workflowParams.model || '',
        toolType: workflowParams.toolType || '',
        outputResolution: workflowParams.output_resolution || '',
        originalWidth: getNumber(originalSize.width),
        originalHeight: getNumber(originalSize.height),
        requestedWidth: getNumber(workflowParams.width),
        requestedHeight: getNumber(workflowParams.height),
        enhanced: typeof workflowParams.enhanced === 'boolean' ? workflowParams.enhanced : null,
        creativeStrength: getNumber(workflowParams.creative_strength),
        referenceStrength: getNumber(workflowParams.reference_strength),
        requestedCount: getNumber(workflowParams.count),
        auxImageCount: Array.isArray(workflowParams.aux_imageList) ? workflowParams.aux_imageList.length : 0,
        hasMask: Array.isArray(workflowParams.maskElements) && workflowParams.maskElements.length > 0
    };
}

// API: 获取单个任务详情
app.get('/api/tasks/:id', async (req, res) => {
    try {
        const { pool } = await getDbContext(req);
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

// API: 获取图片对比数据（适配前端 ImagePair 接口）
app.get('/api/image-pairs', async (req, res) => {
    try {
        const { pool, capabilities } = await getDbContext(req);
        const { limit = 50, offset = 0, status } = req.query;
        const normalizedStatus = normalizeStatus(status);
        
        // 基础查询条件
        let sql = `SELECT wt.*, u.username AS username, u.nickname AS nickname
            FROM workflow_task wt
            LEFT JOIN users u ON u.user_id = wt.user_id
            WHERE wt.sub_task_id IS NOT NULL AND wt.sub_task_id != ''`;
        const params = [];
        
        // 只有成功状态才要求有结果图
        if (normalizedStatus === 2) {
            sql += ' AND JSON_LENGTH(wt.images) > 0';
        }

        sql = appendCommonFilters(sql, params, req.query, capabilities);

        // 排序和分页
        sql += ' ORDER BY wt.id DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const [tasks] = await pool.query(sql, params);
        
        // 计算总数
        let countSql = `SELECT COUNT(DISTINCT wt.id) as count
            FROM workflow_task wt
            LEFT JOIN users u ON u.user_id = wt.user_id
            WHERE wt.sub_task_id IS NOT NULL AND wt.sub_task_id != ''`;
        const countParams = [];
        
        // 只有成功状态才要求有结果图
        if (normalizedStatus === 2) {
            countSql += ' AND JSON_LENGTH(wt.images) > 0';
        }

        countSql = appendCommonFilters(countSql, countParams, req.query, capabilities);

        const [countResult] = await pool.query(countSql, countParams);
        const totalCount = countResult[0].count;
        
        // 处理每个任务，转换为前端 ImagePair 接口格式
        const imagePairs = tasks.map(toImagePair);
        
        res.json({
            success: true,
            data: imagePairs,
            count: totalCount
        });
    } catch (error) {
        console.error('获取图片对比数据失败:', error);
        res.status(500).json({
            success: false,
            message: '获取图片对比数据失败',
            error: error.message
        });
    }
});

app.get('/api/image-pairs/:id', async (req, res) => {
    try {
        const { pool } = await getDbContext(req);
        const [results] = await pool.query(
            `SELECT wt.*, u.username AS username, u.nickname AS nickname
            FROM workflow_task wt
            LEFT JOIN users u ON u.user_id = wt.user_id
            WHERE wt.id = ? AND wt.sub_task_id IS NOT NULL AND wt.sub_task_id != ""
            LIMIT 1`,
            [req.params.id]
        );

        if (!results.length) {
            return res.status(404).json({
                success: false,
                message: '图片对不存在'
            });
        }

        res.json({
            success: true,
            data: toImagePair(results[0])
        });
    } catch (error) {
        console.error('获取图片对详情失败:', error);
        res.status(500).json({
            success: false,
            message: '获取图片对详情失败',
            error: error.message
        });
    }
});

// 健康检查
app.get('/api/health', async (req, res) => {
    try {
        const { dbKey, pool, capabilities } = await getDbContext(req);
        // 只检查数据库连接
        await pool.query('SELECT 1');
        res.json({
            success: true,
            message: '服务运行正常',
            database: databaseOptions[dbKey].database,
            databaseLabel: databaseOptions[dbKey].label,
            capabilities: {
                actionSecond: capabilities.hasActionSecond
            }
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

// SPA 回退路由 - 只处理非静态文件的路由请求
app.get('*', (req, res) => {
    const ext = path.extname(req.path);
    if (ext && ext !== '.html') {
        return res.status(404).send('Not Found');
    }
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// 启动服务器
app.listen(PORT, '0.0.0.0', async () => {
    console.log('🚀 服务器启动成功!');
    console.log(`📍 服务地址: http://localhost:${PORT}`);
    console.log(`📊 看板地址: http://localhost:${PORT}/index.html`);
    console.log(`🌐 外部访问地址: http://10.60.249.67:${PORT}`);
    console.log('');
    console.log('🔍 服务器配置:');
    console.log('   - 监听地址: 0.0.0.0');
    console.log('   - 监听端口: ' + PORT);
    console.log('   - CORS: 已启用');
    console.log('');
    await testConnection();
});

// 优雅关闭
process.on('SIGINT', async () => {
    console.log('\n正在关闭服务器...');
    await pool.end();
    process.exit(0);
});
