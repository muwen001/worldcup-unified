# 2026世界杯预测系统 - 统一版

这是一个合并了两个独立世界杯预测系统的统一应用，采用 React 前端 + Node.js 后端的架构。

## 项目结构

```
worldcup-unified/
├── client/                 # React 前端
│   ├── src/
│   │   ├── components/    # UI 组件
│   │   ├── pages/         # 页面组件
│   │   ├── services/      # API 服务层
│   │   ├── context/       # 状态管理
│   │   ├── types/         # TypeScript 类型
│   │   └── utils/         # 工具函数
│   └── package.json
├── server/                 # Node.js 后端
│   ├── src/
│   │   ├── api/           # API 路由
│   │   ├── services/      # 业务逻辑
│   │   └── data/          # 静态数据
│   └── package.json
└── README.md
```

## 功能特性

- **实时数据**: 通过 CCTV Sports API 获取实时比赛数据
- **赔率数据**: 通过 Sporttery.cn API 获取实时赔率
- **智能预测**: 基于 Elo + Dixon-Coles 模型的预测引擎
- **响应式设计**: 支持桌面和移动设备
- **多页面**: 比赛列表、球队信息、预测历史

## 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install
```

### 2. 启动应用

```bash
# 启动后端 (在 server 目录)
npm run dev

# 启动前端 (在 client 目录，新终端)
npm run dev
```

### 3. 访问应用

- 前端: http://localhost:5173
- 后端 API: http://localhost:3001

## API 端点

### 比赛数据
- `GET /api/matches` - 获取所有比赛
- `GET /api/matches/:id` - 获取特定比赛
- `GET /api/matches/date/:date` - 按日期获取比赛
- `GET /api/matches/group/:group` - 按小组获取比赛

### 预测数据
- `GET /api/predictions` - 获取所有预测
- `GET /api/predictions/:matchId` - 获取特定比赛预测
- `GET /api/predictions/champion/odds` - 获取夺冠赔率

### 其他数据
- `GET /api/data/teams` - 获取球队数据
- `GET /api/data/groups` - 获取小组数据
- `GET /api/data/standings` - 获取积分榜
- `GET /api/data/status` - 获取数据源状态

## 技术栈

### 前端
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Recharts (图表)
- Lucide React (图标)

### 后端
- Node.js
- Express
- TypeScript
- CCTV Sports API
- Sporttery.cn API

## 数据源

1. **CCTV Sports API**: 提供实时比赛数据、比分、状态
2. **Sporttery.cn API**: 提供实时赔率数据
3. **静态数据**: 作为备用数据源

## 预测引擎

预测引擎使用以下算法:
- **Elo 评分系统**: 基于 FIFA 排名计算球队实力
- **Dixon-Coles 模型**: 用于比分预测
- **泊松分布**: 计算比分概率
- **混合预测**: 结合赔率和球队实力

## 开发说明

### 添加新页面
1. 在 `client/src/pages/` 创建新页面组件
2. 在 `App.tsx` 添加路由
3. 在 `Navigation.tsx` 添加导航项

### 修改预测算法
1. 编辑 `server/src/services/predictionEngine.ts`
2. 调整 `calculateProbabilities` 方法
3. 测试预测结果

### 添加新数据源
1. 在 `server/src/services/` 创建新的 API 服务
2. 在 `dataService.ts` 集成新数据源
3. 更新数据合并逻辑

## 部署

### Docker 部署
```bash
# 构建镜像
docker build -t worldcup-unified .

# 运行容器
docker run -p 3000:3000 worldcup-unified
```

### 手动部署
1. 构建前端: `cd client && npm run build`
2. 构建后端: `cd server && npm run build`
3. 启动服务: `cd server && npm start`

## 许可证

ISC License
