# Optimize Image Comparison Dashboard

图像处理结果对比看板。

项目由两部分组成：
- `src/`: Vite + React 前端
- `server/`: Express + MySQL 后端，负责提供 `/api/*` 数据接口并托管打包后的前端静态文件

## 安装

根目录安装前端依赖：

```bash
npm i
```

后端依赖单独安装在 `server/`：

```bash
npm --prefix server i
```

## 启动

开发前端：

```bash
npm run dev
```

构建前端并启动完整项目：

```bash
npm start
```

或直接使用启动脚本：

```bash
./start.sh
```

启动后访问：

- [http://localhost:3000](http://localhost:3000)

## 常用命令

```bash
npm run build
npm run server
```
  
