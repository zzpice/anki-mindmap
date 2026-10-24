# Anki Mindmap

[![检查](https://github.com/zzpice/anki-mindmap/actions/workflows/check.yml/badge.svg?branch=main)](https://github.com/zzpice/anki-mindmap/actions/workflows/check.yml)

保留熟悉的文楷字体、纸色主题、知识树与挖空体验，用 React + TypeScript 整理内部状态和交互。完全离线运行，由 Anki 负责原生 Cloze 分卡、翻面、评分和排程。

`main` 已采用 React 实现，当前版本为 **0.2.0-alpha.15**。合并源码不等于发布稳定版；手机客户端的已知限制见[验证结果](docs/validation.md)。原版固定保留在 [f67c932](https://github.com/zzpice/anki-mindmap/tree/f67c932a02bef79f0feab1121c6783a9a3ff9e17)，便于对照和回退。

## 下载体验

**[下载可直接导入 Anki 的测试包](https://raw.githubusercontent.com/zzpice/anki-mindmap/main/test-packages/anki-mindmap-react-test.apkg)** · [包说明与 SHA-256](test-packages/README.md) · [视觉对照](test-packages/visual-comparison/README.md)

测试包包含 22 条匿名笔记、28 张原生 Cloze 卡，无需网页、开发服务器或网络资源。建议在单独的 Anki 资料中导入；手机上只复习新增的测试牌组。**不要把真实笔记转换为测试模型。**

测试模型 **1792748414**、GUID、牌组和媒体命名与正式模型 **1303378414** 分开。导入这个包不会升级既有正式模板；已有笔记的模板维护应另外备份并精准更新，不能靠导入样例替代。

## 保留的体验

- 知识树展开、折叠和当前考查定位；折叠不改变答案。
- 当前挖空单独显隐、按正文顺序揭示／逆序收回，其他编号自定义挖空按组控制。
- 搜索正文及折叠分支，不自动揭示答案；导图、批注、互链和纸色／竹露主题。
- 正反面延续展开状态和阅读位置；下一张卡重置临时状态，主题长期保存。
- 图片交给客户端原生手势；鼠标、触控、键盘和手柄共用业务命令。

已删除独立的「填写笔记」弹窗，**字段、顺序和内容全部保留**。只在该字段出现的当前 Cloze 必要时会在正文补充显示。具体入口和快捷键见[使用说明](docs/usage.md)。

## 文档与目录

| 入口 | 内容 |
| --- | --- |
| [文档导航](docs/README.md) | 使用、开发、验证和历史记录 |
| [开发说明](docs/development.md) | 构建命令、模块职责和资源边界 |
| [验证结果](docs/validation.md) | 后端、浏览器、Desktop 与手机证据分别记录 |
| [变更记录](docs/changelog.md) | 当前版本与主要演进 |
| [历史记录](docs/history/README.md) | 独立迁移、视觉还原和已撤回的诊断方案 |

```text
src/             React 界面、业务核心与正文适配
cards/           Anki 模型约定、正反面模板和字体
scripts/         构包、静态检查与原版对照工具
tests/           React 验收样例、回归与原迁移指纹
docs/            当前说明；history/ 保存过程记录
test-packages/   可下载 APKG、摘要与精选视觉证据
licenses/        字体及诊断资源的独立许可证
```

## 本地构建

已验证的开发环境为 Node.js 24、Python 3.12，依赖版本已锁定。

```sh
npm ci
npm run check
npm run build
python3.12 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements-build.txt
.venv/bin/python scripts/build_react_package.py
npx playwright install chromium webkit
npm test
```

构建产物在 `dist/`；`build/react-site/` 是构包时生成的本地调试页面，不是交付方式。GitHub Actions 对 Anki 25.9.2 / 26.9.3 分别构包和回归，并保存测试包与详细证据。原版视觉对照和隔离 Desktop 的完整命令见[开发说明](docs/development.md)。

本仓库代码采用 [MIT](LICENSE)，字体及其他资源遵循各自许可证，详见 [NOTICE](NOTICE)。不包含个人笔记、集合或授权数据。
