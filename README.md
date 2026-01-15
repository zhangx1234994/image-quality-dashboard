# 图片处理质量看板系统

一个用于展示和对比图片处理任务结果的可视化看板系统。

## ✨ 功能特性

### 1. 数据库直连
- ✅ 直接连接阿里云RDS MySQL数据库
- ✅ 实时查询 `ai_design_dev.workflow_task` 表数据
- ✅ 无需手动导出CSV文件

### 2. 任务筛选
- 按用户ID筛选
- 按操作类型筛选(画布扩展、高清放大、图片裂变、图案提取、图生图)
- 按处理状态筛选(成功/失败/处理中)

### 3. 图片对比
- 原图与结果图并排展示
- 直接从OSS对象存储加载图片
- 点击图片可放大查看
- 图片加载失败自动提示

### 4. 统计数据
- 总处理任务数
- 成功任务数
- 用户数量
- 操作类型数量

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

这将安装以下依赖：
- express: Web服务器框架
- mysql2: MySQL数据库驱动
- cors: 跨域支持
- dotenv: 环境变量管理

### 2. 启动服务

```bash
npm start
```

或使用开发模式(自动重启):

```bash
npm run dev
```

### 3. 访问看板

启动成功后,在浏览器中打开:

```
http://localhost:3000/index.html
```

## 📁 项目结构

```
生成控制台/
├── server.js           # Node.js后端服务
├── index.html          # 看板前端页面
├── package.json        # 项目配置文件
└── README.md          # 项目说明文档
```

## 🔧 配置说明

### 数据库配置

数据库连接配置在 `server.js` 中:

```javascript
const dbConfig = {
    host: 'rm-bp1r74bu12nt8ibs50o.mysql.rds.aliyuncs.com',
    port: 3306,
    user: 'kanban',
    password: 'Chrd5@0987',
    database: 'ai_design_dev'
};
```

### API端点

后端提供以下API:

- `GET /api/stats` - 获取统计数据
- `GET /api/actions` - 获取所有操作类型
- `GET /api/tasks` - 获取任务列表(支持筛选)
  - 查询参数: `user_id`, `action`, `status`, `limit`, `offset`
- `GET /api/tasks/:id` - 获取单个任务详情
- `GET /api/health` - 健康检查

## 📊 数据库表结构

系统读取 `workflow_task` 表,主要字段:

- `id` - 任务ID
- `task_id` - 任务标识
- `user_id` - 用户ID
- `status` - 状态(1=处理中, 2=成功, 3=失败)
- `action` - 操作类型
- `original_images` - 原图URL(JSON数组)
- `images` - 结果图URL(JSON数组)
- `started_at` - 开始时间
- `finished_at` - 完成时间
- `error_message` - 错误信息

## 🎯 使用场景

1. **质量评估**: 对比原图和处理后的图片,评估算法效果
2. **用户分析**: 查看不同用户的处理任务情况
3. **类型分析**: 按操作类型分析处理效果
4. **问题排查**: 快速定位处理失败的任务

## ⚠️ 注意事项

1. 确保网络可以访问阿里云RDS数据库
2. 图片URL需要是公开可访问的OSS地址
3. 建议在内网环境使用,注意数据安全
4. 数据库密码已包含在代码中,生产环境建议使用环境变量

## 🛠️ 故障排除

### 无法连接数据库
- 检查数据库地址和端口是否正确
- 确认数据库账号密码是否正确
- 检查网络是否可以访问外网地址

### 图片无法加载
- 检查OSS图片URL是否有效
- 确认图片URL可以公开访问
- 查看浏览器控制台的错误信息

### 服务启动失败
- 检查3000端口是否被占用
- 确认Node.js版本 >= 14
- 运行 `npm install` 重新安装依赖

## 📝 开发建议

1. 可以根据需要修改筛选条件
2. 可以调整每页显示的任务数量
3. 可以添加更多统计维度
4. 可以优化图片加载性能

## 🔐 安全建议

生产环境使用时:
- 将数据库密码移至环境变量
- 添加用户认证机制
- 限制API访问频率
- 使用HTTPS协议

---

**开发者**: AI Assistant  
**最后更新**: 2025-01-15
