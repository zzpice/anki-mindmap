# 原版与 React 视觉还原对比

Alpha.6 当前布局：[手机正面](alpha6-phone-front.png)、[手机背面](alpha6-phone-back.png)、[桌面正面](alpha6-desktop-front.png)、[桌面背面](alpha6-desktop-back.png)。本轮按用户确认压缩知识标题、左右各放两个边栏功能，并稳定翻面阅读位置。下面的拼接图与 `metrics.json` 是此前视觉还原基线的历史记录；本轮结果见上级 `verification.json` 和 [行为说明](../../docs/reading-layout.md)。

左侧为原版 `main f67c932`，右侧为本次 `feat/react-rewrite` 还原版。
采用相同的匿名笔记字段、相同原生 Cloze 卡片及相同浏览器、视口和主题。
原版模板由 Git 提交提取后经官方 Anki 后端生成；两侧都通过官方 reviewer
渲染（包含本地 MathJax）。图片未修饰页面内容，仅拼接并添加对比标签。

- [桌面正反面](visual-restore-desktop.png)：1280 × 900
- [手机视口正反面](visual-restore-phone.png)：390 × 844
- [竹露和夜间主题](visual-restore-themes.png)
- [展开后的完整内容](visual-restore-expanded.png)：包含图片、表格和公式
- [搜索、导图与批注](visual-restore-controls.png)

手机视口截图来自浏览器，不代表 AnkiMobile／AnkiDroid 实机认证。
原版左上侧“填写笔记”入口按既定决定删除，其字段和数据保留。
新版本保留搜索不自动揭示答案的既定规则；逐步揭示／收回按钮移入搜索面板，
不再占用正文顶部。重置宿主默认按钮外边距，避免窄屏搜索栏拥挤。

原版字号、字体、主题色、标题／节点／批注间距、节点圆点、虚线连接、
挖空边框和毛玻璃效果保留。清晰的 React 状态核心保持不变，未恢复旧业务脚本。
浮动控件使用可聚焦按钮，批注在引用旁弹出，导图保持原来的大浮层。

自动比较包含 108 组默认正反面、60 组交互场景；使用 Chromium 与 WebKit，
覆盖 1280、390、320px 宽度、象牙笺／竹露、夜间模式。默认节点几何误差须小于
1px；字体、标题、连接线、圆点、侧边控件和毛玻璃样式逐项断言。

复现：先构建测试包，然后运行 `scripts/prepare_visual_comparison.py` 和
`node tests/react/visual.cjs`。详细结果见 `metrics.json`，实际客户端结果见
上一级 `verification.json`。这些证据仅覆盖样例，不承诺任意历史正文逐像素相同。
