# Anki 测试包 · 0.2.0-alpha.14

| 下载 | 用途 | 独立模型 |
| --- | --- | --- |
| [正常 React 测试包](https://raw.githubusercontent.com/zzpice/anki-mindmap/main/test-packages/anki-mindmap-react-test.apkg) | 推荐体验入口；21 条匿名笔记、27 张原生 Cloze 卡，无布局诊断面板 | 1792748414 |
| [旧版／React 布局对照包](https://raw.githubusercontent.com/zzpice/anki-mindmap/main/test-packages/anki-mindmap-layout-comparison.apkg) | 专项排查；14 条匿名笔记、14 张卡，含深树、宽表格、8400px 长图及布局数据 | 1792748514 / 1792748524 |

均可直接导入 Anki，完全离线，无需网页或开发服务器。**不要将真实笔记转换为这些测试模型。** 模型、GUID、牌组和媒体命名与正式模型 1303378414 分开；官方临时集合已检查现有正式笔记／排程不变、重复导入不增副本。建议新建资料并关闭同步；手机端只复习新增测试牌组。

## alpha.14 的变化与限制

边栏采用当前根布局高度，不再跟随展开其他分支引起的可见高度扩张；没有缓存正面坐标。用户在一张实际 iOS 卡上报告该步骤保持稳定。另给最外层树增加 10px 留白，解决折叠圆点外圈被裁；圆点手机观感尚待反馈。不能据此声称所有 iOS／Android 场景都已认证，Android 轻微翻面短闪仍待确认。

折叠、定位、当前答案显隐、其他组显隐、搜索、导图、批注、互链、主题和输入适配保留。已删除独立填写笔记弹窗，字段和数据保留；正文图片交给客户端原生手势。入口详见[使用说明](../docs/usage.md)。

## 需要排查布局时

对照包的 `main` 子组固定为旧版 **f67c932**，不是合并后的 main。仅修改独立测试身份与等价媒体路径，原版业务代码不变。两版各有「长图复现」子组，A01–A12 / B01–B12 标记供上中下翻面观察。

先测旧版，完全退出并重开 Anki，再测 React，排除旧版全局事件残留。也可在正面展开其他分支，点「布局数据」比较最初正面与当前尺寸。诊断只记录本地布局数字，不改变应用位置或答案。个人原卡对照不会公开上传。

## 摘要与验证

- [SHA256SUMS](SHA256SUMS)：对应本目录两份 APKG 的实际字节。
- [正常包 manifest](react-test-manifest.json)／[诊断包 manifest](layout-comparison-manifest.json)：版本、独立身份、内容和导入检查。
- [验证摘要](verification.json)／[验证说明](../docs/validation.md)：客户端与自动化证据分开。
- [精选视觉对照](visual-comparison/README.md)／[布局依据](../docs/ios-layout-viewport.md)／[历史诊断数字](layout-diagnosis.json)。

GitHub 下载文件名保持不变；这是 main 的测试快照，不是正式 Release。完整运行日志、100 次循环明细和视觉测量由 CI 保存，不在这里堆积每轮产物。
