# 视觉对照

所有图片使用匿名内容。浏览器手机视口不是 AnkiMobile / AnkiDroid 实机认证，当前手机反馈见[验证说明](../../docs/validation.md)。

## 当前 alpha.15 与固定旧版

旧版固定为 f67c932，不跟随合并后的 main。相同字段经官方 Anki 后端渲染，以下为 WebKit 390 × 780 视口：

| 内容 | 旧版 | React alpha.15 |
| --- | --- | --- |
| 同一张卡正面 | [旧版正面](legacy-front.png) | [当前正面](react-front.png) |
| 同一张卡背面 | [旧版背面](legacy-back.png) | [当前背面](react-back.png) |
| 长图中段 | [旧版长图](layout-long-main-middle.png) | [当前长图](layout-long-react-middle.png) |

[圆点裁切修复局部对比](alpha14-marker-gutter.png)：同一 React 运行时，左侧恢复旧的 28px 外层缩进，右侧为当前 38px。内层缩进和边栏不变；该图证明裁切差异，不表示手机已复测圆点。

## 视觉还原基线

以下精选图记录 alpha.2 恢复视觉语言时的原版／React 对照，**不作为当前控件位置的截图**：

- [桌面正反面](visual-restore-desktop.png)
- [手机视口正反面](visual-restore-phone.png)
- [竹露和夜间主题](visual-restore-themes.png)
- [展开后的图片、表格与公式](visual-restore-expanded.png)
- [搜索、导图与批注](visual-restore-controls.png)

两版保留文楷、原主题色、树形连接线和挖空毛玻璃。当前批准的紧凑标题、两侧分区、原生图片手势与外层留白见[变更记录](../../docs/changelog.md)。已删除的填写笔记弹窗不恢复，字段继续保留。

每轮视觉回归包含两引擎、三宽度、两主题和夜间，108 对默认卡面及 60 个交互场景。完整 JSON 和逐场景截图生成在 build/ 并保存在 CI artifacts；本目录只选留有解释价值的图。已过期版本截图和旧测量可从[整理前提交](https://github.com/zzpice/anki-mindmap/tree/a2fa9761fe545ce7635effa69da7415e12f4beeb/test-packages/visual-comparison)查看。

复现命令见[开发说明](../../docs/development.md)。这些是样例证据，不承诺任意历史 HTML 与旧版逐像素相同。

alpha.15 修正夜间可读性：[当前夜间样例](react-night.png)。树线为完整 1px 点段；其他整体视觉沿用原版。
