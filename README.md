# 春日部大冒险 · 小新跑酷

> 我的第一个用 WorkBuddy 做的游戏。

一个零依赖的横版跑酷网页游戏：选角色、闯三关、踩敌人、吃金币、冲旗杆，类似超级玛丽的玩法手感。

纯 HTML + CSS + 原生 JavaScript 实现，Canvas 2D 手绘角色与场景，另附一个可选的轻量 Node 后端（排行榜 / 存档续玩 / 游玩统计）。

## 玩法

| 操作 | 按键 |
| --- | --- |
| 移动 | `←` `→` 或 `A` `D` |
| 跳跃（可二段跳，长按跳更高） | `空格` / `↑` / `W` |
| 角色专属技能 | `Shift` / `J` |
| 暂停 | `Esc` |

手机端会自动显示虚拟按键。

## 角色

五位角色有不同的速度 / 跳跃 / 生命属性与专属技能：

- **小新** 动感光波：发射贯穿光波
- **风间** 精英冲刺：短时间极速且无敌
- **妮妮** 兔子布偶：抛物线砸击
- **正男** 龟壳防御：免疫一次伤害，且多一条命
- **阿呆** 鼻涕绳索：弹射升空并缓降滑翔

## 运行

### 方式一：直接玩（离线模式）

双击 `index.html` 即可，无需安装任何东西。排行榜会自动降级为本机榜单。

### 方式二：带后端（排行榜 / 存档）

```bash
npm start
# 或：node server/server.js
```

然后打开 <http://127.0.0.1:3000/>。Windows 用户也可以直接双击 `start.bat`。

后端未启动时游戏依然完整可玩，只是排行榜和存档走浏览器本地存储。

## 目录结构

```
index.html          游戏入口
css/style.css       界面样式
js/
  core.js           常量与工具
  audio.js          合成音效、程序化 BGM、角色声线
  characters.js     角色矢量绘制与属性
  levels.js         种子化关卡生成与主题背景
  entities.js       敌人 / 金币 / 道具 / 投射物 / 粒子
  engine.js         主循环、物理碰撞、技能、流程
  input.js          键盘与触屏输入
  api.js            后端客户端（在线 / 离线自动切换）
  ui.js             选人、HUD、结算、排行榜
  main.js           启动引导
server/
  server.js         零依赖 HTTP 服务：静态托管 + REST API
  lib/store.js      JSON 文件存储（防抖 + 原子写）
  data/             运行时数据（已 gitignore）
tools/              测试脚本
assets/audio/       放入同名 mp3 可覆盖合成音效
```

## 后端接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET / POST | `/api/leaderboard` | 排行榜查询 / 提交成绩 |
| GET / POST / DELETE | `/api/save` | 存档读取 / 写入 / 删除 |
| GET / POST | `/api/stats` | 游玩统计读取 / 事件上报 |

## 关于音效

动漫原声受版权保护，不便内置。本项目音效由 Web Audio 程序化合成，角色声线用浏览器语音合成按角色区分音高与语速。

想换成自己的素材，把文件按 `assets/audio/README.md` 的命名放进目录即可自动生效，文件不存在则静默回退。

## 测试

```bash
npm test          # 关卡生成、五角色自动驾驶通关、渲染冒烟
npm run test:ui   # jsdom：界面点击流程
npm run test:api  # 后端接口用例（需先启动服务）
npm run test:browser  # 无头 Chrome：真实渲染与交互
```

## 声明

非官方同人练习作品，角色形象为原创卡通绘制，音频由程序合成，仅用于学习交流。
