# 2026世界杯预测系统

双引擎 AI 预测系统，React 前端 + Express 后端，实时比赛数据 + 赔率分析。

## 线上地址

| 域名 | 服务器 |
|------|--------|
| https://sgp.muwen.fun/worldcup/ | 54.64.137.190 (AWS) |

## 项目结构

```
worldcup-unified/
├── client/                    # React 前端
│   ├── src/
│   │   ├── components/        # UI 组件
│   │   ├── pages/             # 页面 (比赛/球队/历史)
│   │   ├── services/          # 双引擎预测 & API
│   │   ├── context/           # 全局状态管理
│   │   ├── types/             # TypeScript 类型
│   │   └── utils/             # 工具函数
│   └── public/                # 静态资源 (favicon, logo)
├── server/                    # Express 后端
│   ├── src/
│   │   ├── api/               # REST API 路由
│   │   ├── services/          # 数据服务 & 预测引擎
│   │   └── data/              # 静态数据 & 赔率文件
│   └── package.json
├── Dockerfile
├── docker-compose.yml
└── CLAUDE.md                  # Claude Code 开发指南
```

## 双引擎预测

| 引擎 | 算法 | 特点 |
|------|------|------|
| **A** (Elo+Dixon-Coles) | Elo 评分 + 泊松分布 | 基于 FIFA 排名 & 球队实力 |
| **B** (赔率+实力) | 赔率隐含概率 + 多维对比 | 综合 form/squad/travel 因素 |

预测在**客户端**生成，含平局概率校准（基于已完成比赛的经验平局率）。

## 快速开始

```bash
# 安装依赖
cd server && npm install
cd ../client && npm install

# 开发模式
cd server && npm run dev      # :3001
cd client && npm run dev      # :5173
```

## 数据源

| 来源 | 用途 | 状态 |
|------|------|------|
| CCTV Sports API | 比赛赛程、比分、状态 | ✅ 自动刷新 |
| Sporttery.cn API | 赔率数据 | ⚠️ 服务器被 CDN 拦截，使用静态文件 |

### 赔率数据更新

Sporttery API 从 AWS 服务器被腾讯云 EdgeOne 拦截（HTTP 567），需从本地手动更新：

```bash
# 1. 本地拉取赔率
curl -sL --max-time 10 \
  -H "User-Agent: Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36" \
  -H "Referer: https://m.sporttery.cn/" \
  "https://webapi.sporttery.cn/gateway/uniform/football/getMatchCalculatorV1.qry?channel=c" \
  | python3 -c "
import json, sys
data = json.load(sys.stdin)
team_map = {
    '墨西哥':'mex','南非':'rsa','韩国':'kor','捷克':'cze',
    '加拿大':'can','波黑':'bih','卡塔尔':'qat','瑞士':'sui',
    '巴西':'bra','摩洛哥':'mar','海地':'hai','苏格兰':'sco',
    '美国':'usa','巴拉圭':'par','澳大利亚':'aus','土耳其':'tur',
    '德国':'ger','库拉索':'cuw','科特迪瓦':'civ','厄瓜多尔':'ecu',
    '荷兰':'ned','日本':'jpn','瑞典':'swe','突尼斯':'tun',
    '比利时':'bel','埃及':'egy','伊朗':'irn','新西兰':'nzl',
    '西班牙':'esp','佛得角':'cpv','沙特阿拉伯':'sau','乌拉圭':'uru',
    '法国':'fra','塞内加尔':'sen','伊拉克':'irq','挪威':'nor',
    '阿根廷':'arg','阿尔及利亚':'alg','奥地利':'aut','约旦':'jor',
    '葡萄牙':'por','刚果(金)':'cod','哥伦比亚':'col',
    '乌兹别克斯坦':'uzb','英格兰':'eng','克罗地亚':'cro',
    '加纳':'gha','巴拿马':'pan',
}
odds = []
for g in data['value']['matchInfoList']:
    for m in g.get('subMatchList', []):
        home = team_map.get(m.get('homeTeamAllName',''))
        away = team_map.get(m.get('awayTeamAllName',''))
        had = m.get('had', {})
        if home and away and had.get('h'):
            odds.append({'homeTeam':home,'awayTeam':away,'homeWin':float(had['h']),'draw':float(had['d']),'awayWin':float(had['a'])})
json.dump(odds, open('/tmp/odds.json','w'), ensure_ascii=False)
print(f'{len(odds)} odds entries saved')
"

# 2. 上传到服务器
scp /tmp/odds.json ubuntu@54.64.137.190:/home/ubuntu/worldcup-unified/server/src/data/odds.json

# 3. 重启容器
ssh ubuntu@54.64.137.190 "docker restart worldcup-unified"
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/matches` | 所有比赛 |
| GET | `/api/matches/:id` | 单场比赛 |
| GET | `/api/matches/date/:date` | 按日期 |
| GET | `/api/matches/group/:group` | 按小组 |
| GET | `/api/matches/status/live` | 进行中 |
| GET | `/api/matches/status/completed` | 已结束 |
| GET | `/api/matches/status/upcoming` | 未开始 |
| GET | `/api/predictions` | 所有预测 |
| GET | `/api/predictions/:matchId` | 单场预测 |
| GET | `/api/data/teams` | 球队数据 |
| GET | `/api/data/groups` | 小组数据 |
| GET | `/api/data/standings` | 积分榜 |
| GET | `/api/data/status` | 数据源状态 |
| POST | `/api/data/update` | 手动触发数据更新 |
| GET | `/api/health` | 健康检查 |

## 部署

### Docker

```bash
# 构建前端
cd client && VITE_BASE=/worldcup/ npm run build:nocheck

# 同步代码到服务器
rsync -avz --exclude=node_modules --exclude=.git -e ssh . ubuntu@54.64.137.190:/home/ubuntu/worldcup-unified/

# 构建并启动
ssh ubuntu@54.64.137.190 "cd /home/ubuntu/worldcup-unified && docker build -t worldcup-unified . && docker run -d --name worldcup-unified -p 10880:3000 -e PORT=3000 -v /home/ubuntu/worldcup-unified/client/dist:/app/public:ro --restart unless-stopped --memory=700m worldcup-unified"
```

### Caddy 反向代理

```caddy
sgp.muwen.fun {
    reverse_proxy /worldcup* localhost:10880
    reverse_proxy /api/*     localhost:10880
    reverse_proxy /assets/*  localhost:10880
}
```

## 技术栈

- **前端**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **后端**: Node.js, Express, TypeScript (tsx)
- **部署**: Docker, Caddy (HTTPS)
- **数据**: CCTV Sports API, Sporttery.cn API