# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

2026 世界杯预测系统 — 合并了两个独立预测引擎的统一应用。React 前端 + Express 后端，通过 CCTV Sports API 获取实时比赛数据，Sporttery.cn API 获取赔率。

## 常用命令

```bash
# 开发环境
cd client && npm install && npm run dev       # 前端 :5173
cd server && npm install && npm run dev       # 后端 :3001 (tsx watch)

# 构建与部署
cd client && VITE_BASE=/worldcup/ npm run build:nocheck   # 生产构建（子路径部署）
docker build -t worldcup-unified .                         # 构建镜像
docker-compose up -d --build                               # 部署启动
```

## 架构

### 数据流

```
CCTV API (比分/状态) ─┐
                      ├─> DataService.updateData() ─> this.matches (内存)
Sporttery API (赔率) ─┘     ↑ 每 30s setInterval 自动刷新
                            │
              GET /api/matches ─> 客户端 poll 每 60s
```

### 双引擎预测（客户端）

预测在**客户端**生成，不依赖后端 AI。两个独立引擎各自预测，结果经 draw calibration 校准后展示：

| 引擎 | 标签 | 算法 | 文件 |
|------|------|------|------|
| A | Elo+Dixon | Elo 评分 + 泊松分布比分预测 | `client/src/services/predictionEngineA.ts` |
| B | 赔率+实力 | 赔率隐含概率 + 球队实力混合 | `client/src/services/predictionEngineB.ts` |

汇总逻辑在 `client/src/services/dualPredictionEngine.ts`，包含经验平局率校准（`calibrateDraw`）。

### 服务端关键文件

| 文件 | 职责 |
|------|------|
| `server/src/app.ts` | 入口，挂载路由，启动 30s 定时数据刷新 |
| `server/src/services/dataService.ts` | 数据中枢：聚合 CCTV + Sporttery，计算积分榜 |
| `server/src/services/cctvApi.ts` | 解析 CCTV API 原始数据 → `Match[]` |
| `server/src/services/sportteryApi.ts` | 解析 Sporttery 赔率 → `Map<string, Odds>` |
| `server/src/services/predictionEngine.ts` | 服务端预测引擎（Elo + 泊松，API 路由调用） |

### 客户端关键文件

| 文件 | 职责 |
|------|------|
| `client/src/context/AppContext.tsx` | 全局状态（useReducer），60s 轮询，触发预测生成 |
| `client/src/services/dataService.ts` | 调用 `/api/matches`，转换后端数据格式 |
| `client/src/pages/Matches/MatchesPage.tsx` | 比赛列表页（日期选择 + 状态/阶段筛选） |
| `client/src/components/ui/MatchCard.tsx` | 比赛卡片（双引擎预测卡片 + 结果对比） |
| `client/src/components/ui/MatchDetailModal.tsx` | 比赛详情弹窗（完整预测详情 + 赔率表） |
| `client/src/pages/History/HistoryPage.tsx` | 预测历史（准确率统计 + 逐场预测记录） |

### 类型系统

- 服务端和客户端有**各自独立的类型定义**（`server/src/types/` vs `client/src/types/`）
- 服务端 `Match` 的 `homeTeam`/`awayTeam` 是 `string`（ID），客户端是完整的 `Team` 对象
- 服务端 `Match.odds` 是单个 `Odds` 对象，客户端是 `Odds[]` 数组
- 客户端 `dataService.ts` 的 `convertBackendMatches()` 负责格式转换

## 部署架构

- **服务器**: `ubuntu@54.64.137.190` (jp.muwen.fun) / `ubuntu@13.215.140.95` (sgp.muwen.fun)
- **反向代理**: Caddy，HTTPS 自动证书
- **容器**: Docker，端口 `10880:3000` (jp)，`client/dist` 以 volume 挂载
- **域名**: `https://jp.muwen.fun/worldcup/` / `https://sgp.muwen.fun/worldcup/`
- **子路径**: `VITE_BASE=/worldcup/`，API 在根路径 `/api/*`

### Caddy 路由

```
jp.muwen.fun  → /worldcup* /api/* /assets/* → localhost:10880
sgp.muwen.fun → /worldcup* /api/*           → localhost:8081
```

### 部署流程

```bash
cd client && VITE_BASE=/worldcup/ npm run build:nocheck

# 部署到 jp.muwen.fun (54.64.137.190)
rsync -avz --exclude=node_modules --exclude=.git -e ssh . ubuntu@54.64.137.190:/home/ubuntu/worldcup-unified/
ssh ubuntu@54.64.137.190 "docker stop worldcup-unified && docker rm worldcup-unified && cd /home/ubuntu/worldcup-unified && docker build -t worldcup-unified . && docker run -d --name worldcup-unified -p 10880:3000 -e PORT=3000 -v /home/ubuntu/worldcup-unified/client/dist:/app/public:ro --restart unless-stopped --memory=700m worldcup-unified"

# 部署到 sgp.muwen.fun (13.215.140.95)
rsync -avz --exclude=node_modules --exclude=.git -e ssh . ubuntu@13.215.140.95:/home/ubuntu/worldcup-unified/
ssh ubuntu@13.215.140.95 "cd /home/ubuntu/worldcup-unified && docker-compose down && docker-compose up -d --build"
```

## 已知注意事项

- `server/src/services/cctvApi.ts:117` 有预存的 TS 类型错误（`odds: []` 不匹配 `Odds` 类型），不影响运行（tsx 不检查类型）
- `server/src/services/dataService.ts` 中 `calculateStandings()` 使用 `match.score?.home` 而非 `match.homeScore`（已修复）
- 积分榜只在 `updateData()` 成功后重新计算，不会在 GET 请求时实时计算
- Sporttery API 可能因网络限制无法从服务器访问，赔率会回退到默认值