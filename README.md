# TravelPlan

一个基于高德地图的自驾游行程规划工具。按天组织景点 / 酒店 / 餐饮节点，自动计算驾车路线、距离、时间，并基于时序自动顺延整个行程时间线。支持节点拖拽排序、行程复制 / 锁定、行程摘要导出为图片。

---

## 功能特性

- **多日行程编排**：按天组织节点（景点 / 酒店 / 餐饮 / 驻车 / 休整 / 自定义），每张日程卡片可视化展示到达 / 离开时间、游玩时长、驾车段距离与时长。
- **高德地图集成**：地点搜索、坐标拾取、驾车路线规划（v5 API）、路线偏好（默认 / 优先高速 / 避开高速）。
- **时序自动顺延**：开启后，根据上一节点离开时间 + 驾车时长 + 游玩时长，自动计算下一节点到达时间；修改任一节点时仅重算相邻节点，避免全量重算。
- **跨日酒店衔接**：自动将前一天酒店作为次日虚拟起点，无需重复添加。
- **节点拖拽排序**：基于 `@dnd-kit`，支持日内拖拽与跨日移动，移动后只重算受影响段。
- **行程管理**：列表页创建 / 编辑 / 复制 / 删除行程；编辑页可锁定整段行程防止误改。
- **路线缓存**：驾驶路线结果持久化到浏览器 IndexedDB（按 token 隔离），重进行程无需重新调用高德 API。
- **行程摘要导出**：一键将每日日期、行车里程、行车时间、酒店名称、抵达时间、酒店备注导出为 PNG 表格图片。
- **图片上传**：每个节点支持上传多张图片，本地存储在服务端 `uploads/` 目录。
- **Docker 一键部署**：多阶段构建，环境变量配置高德 Key，数据卷持久化。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 18、TypeScript、Vite、TailwindCSS、Zustand、@dnd-kit、@amap/amap-jsapi-loader、dayjs |
| 后端 | Node.js、Express、TypeScript（ESM）、文件系统 JSON 数据库 |
| 存储 | 服务端：文件系统（`data/` + `uploads/`）；浏览器：IndexedDB（路线缓存）+ localStorage（兜底） |
| 部署 | Docker、docker-compose |

## 项目结构

```
TravelPlan/
├── client/                   # 前端（React + Vite）
│   ├── src/
│   │   ├── components/       # UI 组件（layout / node / map）
│   │   ├── stores/           # Zustand 状态管理（tripStore / uiStore）
│   │   ├── hooks/            # 自动保存、防抖算路、疲劳驾驶提醒
│   │   ├── services/         # apiClient、高德 JS API 封装
│   │   ├── utils/            # format、geo、timeChain、idbCache、exportTripImage
│   │   └── types/            # 领域类型定义
│   └── vite.config.ts
├── server/                   # 后端（Express + TypeScript）
│   ├── src/
│   │   ├── routes/           # trip / driving / upload / config
│   │   ├── middleware/       # tokenAuth、errorHandler
│   │   ├── db/               # 文件系统 JSON 存储
│   │   ├── utils/            # logger、高德 driving 客户端
│   │   ├── config.ts         # 环境变量配置
│   │   └── index.ts          # 入口
│   └── package.json
├── Dockerfile                # 多阶段构建
├── docker-compose.yml        # 服务编排 + 数据卷
└── package.json              # 工作区根（npm workspaces）
```

## 快速开始

### 环境要求

- Node.js ≥ 20
- npm ≥ 10（工作区需要）
- 高德开放平台账号，已申请以下 Key：
  - **JS API Key**（用于前端地图 SDK），2021-12-02 之后申请的 Key 还需要 **安全密钥**

### 方式一：Docker 部署（推荐）

1. 复制并修改 `docker-compose.yml` 中的高德 Key：

   ```yaml
   environment:
     AMAP_JS_KEY: "你的JS API Key"
     AMAP_JS_SECURITY: "你的安全密钥"
   ```

2. 启动：

   ```bash
   docker compose up -d --build
   ```

3. 浏览器访问 `http://localhost:8787`。

数据持久化通过两个 named volume：
- `travelplan-data`：行程 JSON 数据
- `travelplan-uploads`：上传的节点图片

### 方式二：本地开发

1. 克隆仓库：

   ```bash
   git clone https://github.com/majsma2/TravelPlan.git
   cd TravelPlan
   ```

2. 安装依赖（npm 工作区一次性安装前后端依赖）：

   ```bash
   npm install
   ```

3. 在 `server/` 下创建 `.env` 文件：

   ```env
   PORT=8787
   AMAP_JS_KEY=你的JS API Key
   AMAP_JS_SECURITY=你的安全密钥
   DAILY_QUOTA=2000
   DRIVING_TTL_DAYS=7
   ```

4. 启动开发服务器（前后端并行）：

   ```bash
   npm run dev
   ```

   - 前端：`http://127.0.0.1:5300`（Vite dev server，自动代理 `/api` 到后端）
   - 后端：`http://localhost:8787`

5. 生产构建：

   ```bash
   npm run build
   ```

   构建产物：`client/dist/`、`server/dist/`。生产模式下后端会自动托管 `client/dist`。

## 配置项

所有配置通过环境变量传入，无需修改源码。

| 变量 | 必填 | 默认值 | 说明 |
| --- | :---: | --- | --- |
| `AMAP_JS_KEY` | 是 | — | 高德 JS API Key（前端地图 SDK） |
| `AMAP_JS_SECURITY` | 视情况 | — | JS API 安全密钥（2021-12-02 后申请的 Key 必填） |
| `PORT` | 否 | `8787` | 后端服务端口 |
| `DAILY_QUOTA` | 否 | `2000` | 每日高德驾车算路配额上限，超出后服务端返回缓存或 `429` |
| `DRIVING_TTL_DAYS` | 否 | `7` | 服务端路线缓存有效期（天），超期重新调用高德 API |

## API 概览

所有接口前缀 `/api`，行程类接口通过路径参数 `:token` 标识行程。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/config` | 返回前端需要的高德 Key 等公共配置 |
| `GET` | `/api/health` | 健康检查 |
| `GET` | `/api/trip` | 行程列表摘要 |
| `POST` | `/api/trip` | 新建行程 |
| `GET` | `/api/trip/:token` | 获取行程详情（含天数与节点） |
| `PUT` | `/api/trip/:token` | 保存行程（全量覆盖） |
| `DELETE` | `/api/trip/:token` | 删除行程 |
| `POST` | `/api/trip/:token/copy` | 复制行程（生成新 token，标题追加" 的副本"） |
| `GET` | `/api/driving` | 驾车路线查询（参数：起点 / 终点坐标、策略） |
| `POST` | `/api/upload` | 上传节点图片（multipart/form-data） |

## 浏览器存储说明

前端会使用以下浏览器存储：

- **IndexedDB**（`travelplan` 数据库 → `driving_cache` 对象仓库）：按 token 持久化驾车路线缓存（距离 / 时长 / polyline），重进行程不重复算路。容量上限通常为 GB 级。
- **localStorage**：IndexedDB 不可用时（部分浏览器在 HTTP + IP 访问场景下限制 IDB）的兜底，受 5MB 配额限制；写入失败时会清理其他 token 的旧缓存。
- **`tp_token`**：记录当前正在编辑的行程 token，便于刷新后恢复。

可以在浏览器 DevTools → Application → IndexedDB / Local Storage 中查看与清理。

## 使用指南

### 创建第一段行程

1. 进入首页，点击"新建行程"，输入标题与开始日期。
2. 在日程卡片中点击"添加节点"，选择类型（景点 / 酒店 / 餐饮 等）。
3. 在节点编辑弹窗中输入地址，系统会调用高德地点搜索自动补全；选中后自动填入坐标。
4. 设置游玩时长（分钟），关闭弹窗后系统自动计算到达 / 离开时间。
5. 拖拽节点可调整顺序，系统自动重算受影响段。

### 时序自动顺延

开启"时序自动顺延"后，修改任一节点的离开时间或游玩时长，后续所有节点的到达 / 离开时间会自动顺延。关闭后所有时间手动维护。

### 锁定行程

点击"锁定行程"按钮后，整段行程进入只读状态：
- 开始日期、所有节点输入框置灰
- 拖拽、添加、删除按钮隐藏
- "重算行程时间"按钮禁用
- 节点仍可点击查看，但不可编辑

适合行程定稿后防止误改。点击"解锁"恢复编辑。

### 重算行程时间

点击"重算行程时间"会清空当前行程的驾车路线缓存并重新拉取所有段的高德路线。适用于：
- 路线偏好调整后想全量刷新
- 缓存数据异常需要重建
- 高德道路数据更新后想获取最新路线

### 导出行程摘要

点击"导出"按钮，系统将每日的日期、行车里程、行车时间、酒店名称、抵达时间、酒店备注绘制成表格图片（PNG）并下载。文件名为行程标题。适用于行前快速浏览或分享给同行人。

## 许可证

私有项目，未开放源代码许可。如需使用，请联系作者。
