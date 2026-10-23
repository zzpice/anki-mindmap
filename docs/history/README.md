# 历史记录

这些文件记录当时的调查和决策，可能包含后来已失效的状态描述。当前使用、架构和测试结论分别见[使用说明](../usage.md)、[开发说明](../development.md)及[验证结果](../validation.md)。

| 记录 | 当时关注点 |
| --- | --- |
| [独立提取](migration.md) | 从 anki-cards 迁出单一模型，保留身份和原模板字节 |
| [翻面呈现](flip-rendering.md) | 短暂答案图片、整页导航与不合成 click 的触控 |
| [边栏触控](edge-controls.md) | 短标签、Android 松手即执行与 DOM 投影去重 |
| [动效与图片](motion-and-images.md) | 原生图片手势、轻量反馈及已撤回的边栏框 |
| [撤回坐标缓存](ios-edge-continuity.md) | alpha.12 的卸载顺序缺陷，以及 alpha.13 的诊断对照 |

## 查回原文件

- [旧版 f67c932](https://github.com/zzpice/anki-mindmap/tree/f67c932a02bef79f0feab1121c6783a9a3ff9e17)：原模板、预览页面、构包工具、旧测试、样例与媒体。
- [合并整理前 a2fa976](https://github.com/zzpice/anki-mindmap/tree/a2fa9761fe545ce7635effa69da7415e12f4beeb)：完整 React 开发过程、历次手机视口截图及旧的视觉测量 JSON。
- [原迁移指纹](../../tests/migration-baseline.json)：固定证据，内容未改。

旧套件要在固定旧版的独立目录运行，不能拿来验收有意改变的搜索、折叠和显隐规则。当前视觉对照自动从 f67c932 提取必要文件到忽略的 build/，不依赖当前源码树中保留失效副本，也不把 main 当作旧版。

常规回退只需从 Git 历史取得对应源码／模板，不需要重写历史或删除个人数据；实际更新已有 Anki 模型时仍须明确范围并保留备份。
