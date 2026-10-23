# 开发说明

## 构建和验收

Node.js 24、Python 3.12 是已验证环境。依赖固定在 package-lock.json 和 Python requirements 中。先按[首页](../README.md)完成构建和正常测试包，再按需要运行下面的检查。

原版视觉对照需要官方 reviewer 资源，浏览器测试无需完整 Qt：

```sh
.venv/bin/python -m pip install --no-deps -r scripts/requirements-test.txt
.venv/bin/python scripts/prepare_visual_comparison.py
.venv/bin/python scripts/build_layout_comparison.py
node tests/react/layout-comparison.cjs
node tests/react/visual.cjs
```

准备器只从固定旧版提交 `f67c932a02bef79f0feab1121c6783a9a3ff9e17` 提取源码，不从正在变化的 main 取得“原版”。浅克隆若缺少该提交，先执行：

```sh
git fetch --no-tags --depth=1 origin f67c932a02bef79f0feab1121c6783a9a3ff9e17
```

真实 Desktop 检查需要图形会话和完整 Qt 依赖：

```sh
.venv/bin/python -m pip install aqt==26.9.3
.venv/bin/python tests/react/desktop.py
```

它只创建独立临时资料，禁用自动同步；不读取个人集合。检查覆盖 54 个预览面和实际 reviewer 的揭示、翻面、评分、下一张卡及卸载。不要把浏览器手机视口当作 AnkiMobile / AnkiDroid 实机。

## 代码如何协作

| 模块 | 唯一职责 |
| --- | --- |
| `src/core.ts` | 树、答案、搜索、弹窗和偏好的纯状态／命令规则，不依赖 React 或 DOM |
| `src/content.ts` | 索引 Anki 原生正文，在拥有的正文区域内投影状态，保留富文本与未知 HTML |
| `src/ui.tsx` | React 控件、搜索、导图和批注界面，订阅同一个 store |
| `src/runtime.tsx` | 组装一次卡片渲染；输入统一派发命令，连接平台、呈现和卸载 |
| `src/resources.ts` | 跟踪事件、计时器、帧、动画、观察器和订阅，随卡片同步释放 |
| `src/reading.ts` / `continuity.ts` | 可取消的阅读锚定与一次性正反面布局交接，不携带答案 |
| `src/viewport.ts` | 将当前根布局高度投影为卡片自己的 CSS 变量，CSS 统一控制边栏几何 |
| `src/tap.ts` / `platform.ts` / `math.ts` | 手势识别、有限客户端能力和宿主公式接口 |
| `src/visual/original.css` / `style.css` | 富文本与主题皮肤／当前控件；每类规则只在所属文件定义 |

React 界面和原生正文是相邻的两个根，不能互相随意改写。所有输入进入同一个 dispatcher；折叠与答案显隐互不修改。搜索只读可公开文字，临时展开路径，关闭时保留后来的手动操作。高亮不重写公式、链接或富文本。

## 生命周期与兼容边界

每次挂载有自己的 store 和资源作用域。宿主替换、重复挂载和 pagehide 都会清理旧卡；异步回调检查当前渲染是否仍有效。卸载只恢复仍由自己拥有的正文，不能覆盖宿主已经换上的下一张卡。

主题是长期偏好。同一张卡的正面到背面可一次性交接展开路径、缩放和阅读位置；新正面重置，答案、搜索和弹窗不交接。匹配依据及局限见[阅读位置](reading-layout.md)。边栏不缓存正面坐标；根高度变化才更新布局投影，卸载移除 CSS 变量和监听。详见[布局边界](ios-layout-viewport.md)。

Anki 在执行模板后可能重置 body 类名。runtime 只恢复自己拥有的两个装饰类，保留 nightMode 等宿主类；观察器仍由同一资源作用域清理。用户滚动或操作只取消自动定位、合并记录阅读位置，不改变业务 store 来触发界面刷新。

正式兼容契约是 [cards/note-types.json](../cards/note-types.json)：原生 Cloze 模型 1303378414，字段为「填写笔记 / 导图 / Text」。不得因视觉维护更改字段、GUID、ordinal 或排程。公开构包只生成独立测试身份；个人模板更新属于另行明确授权的操作。

## 产物与历史资源

- `dist/` 保存新构建的 APKG、manifest 和摘要；`build/` 保存运行时、本地调试页面和完整测量，均不提交。
- `test-packages/` 只保留当前可下载包、简要验证和精选截图；普通包和诊断包用途分开。
- GitHub Actions 上传 `dist/` 和详细测试证据；不会部署 Pages 或发布 Release。
- `scripts/sources.py` 仅支持固定旧版编译器的 include 展开；React 构包不依赖旧业务代码。
- `tests/react/layout-probe.html` 只进入诊断包，记录不含答案的布局数字；不派发命令或改变应用位置。
- 旧版预览壳、脚本别名、重复旧测试和过期截图不再复制到当前树；原文件可从[历史提交](history/README.md)查看。提取指纹文件不变。
