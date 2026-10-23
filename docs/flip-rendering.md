# Alpha.3：翻面时图片与布局的短暂闪现

用户在 Android / iOS 普通翻面时报告闪烁，怀疑是一张导图图片。未取得手机逐帧录像，因此不能断言手机上只存在这一种原因。

用 alpha.2 原测试包的原生卡片输出模拟「宿主先替换 HTML、再执行脚本」，Chromium 和 WebKit 均复现：其他编号挖空中的图片在脚本设置 hidden 之前可见。导图字段的隐藏源区域在这个实验中没有显示。旧实现还会重新执行整个 bundle，并在 100 ms 后定位，增加中间布局可见的机会。

修复只改变加载和呈现时序，业务核心与视觉设计保持原样：

- 构包时把同一份编译 CSS 放在两面的正文之前，消除外链样式等待；字体仍为原本的本地媒体。
- 初始化期间暂时遮住自定义挖空答案，当前原生答案继续由 Anki 控制。初始化完成后仍完全按业务状态投影；加载失败时恢复原生可读内容。
- 导图源使用 inert template 保存，打开弹窗时才创建图片，字段和数据不变。
- 文档只缓存与精确媒体文件名绑定的可执行 API。翻面仍建立新 store、清理旧 runtime，不复用答案状态。加载中的快速切卡只挂载最新且仍连接的宿主。
- React 初次 UI 提交同步完成；自动定位改在下一次绘制前执行，不再设置 100 ms 定时器。用户输入仍可取消自动定位。

验证：两种浏览器各 360 / 390 px、每个尺寸 40 次翻面，未揭示图片在插入 HTML 后、挂载后、绘制边界均不可见；翻面期间 bundle 请求为零；导图源图片只在主动打开后请求。另覆盖资源加载失败、加载中替换卡片、每个引擎 100 次正面/背面/切卡与卸载清理，以及 52 个原生卡片面。Anki Desktop 26.9.3 隔离资料完成 52 个预览面和 5 个实际 reviewer 阶段；原生 Cloze、离线媒体和测试包身份检查通过。

这些结果证明已消除可复现的中间状态，不是 AnkiMobile / AnkiDroid 实机认证。手机宿主自身的翻面动画或 WebView 替换行为仍需实际复测。

## Alpha.4：Android 整页重载与 iOS 触控补修

后续实机反馈：alpha.3 的 iOS 闪烁已消失，Android 仍有树或图片跳动；iOS 的其他分支也无法通过轻触展开。因此 alpha.3 的同文档翻面模拟不足以覆盖手机验收。

[AnkiDroid 的宿主源码](https://github.com/ankidroid/Anki-Android/blob/main/AnkiDroid/src/main/java/com/ichi2/anki/AbstractFlashcardViewer.kt)通过 loadDataWithBaseURL 加载每一面；[card.js](https://github.com/ankidroid/Anki-Android/blob/main/AnkiDroid/src/main/assets/scripts/card.js)还在 window.onload 中重置滚动位置。alpha.4 对 Android 单独等待文档、字体和宿主公式布局就绪，再定位并呈现树，避免旧的提前定位被宿主覆盖。等待有两秒可读回退，全部事件、观察器、帧和期限随卡片卸载清理。iOS 保留原有呈现路径。

原版针对 iOS 有 touchstart/touchend 处理，React 版遗漏了不合成 click 的情况。现在触摸和点击共用 activateContent，再进入唯一的 dispatch；滑动、多指和取消不触发业务动作。兼容 click 去重，以免一次轻触展开后又折回；替换答案占位内容时仍能识别同一次触摸。聚焦节点支持 Enter/Space。

新增回归不依赖浏览器自动生成 click，另覆盖每个引擎十次 Android 式整页导航、慢图片、宿主加载后重置滚动、首个可见帧的字体和位置，以及等待中卸载。现有每引擎一百次生命周期测试继续执行。该模拟仍不是 Android/iOS 实机认证，alpha.4 两项修复均待手机复测。
