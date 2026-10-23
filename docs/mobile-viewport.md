# Alpha.7：宽答案撑大手机视口与启动背景

用户确认正文位置已稳定，但揭示／翻面会让边栏移动、变长，安卓还会单纯短闪。

启用真正的手机布局模式（`isMobile: true`）后，12 列不换行表格能够复现边栏问题：Chromium 中揭示前布局视口为 390 × 780，揭示后变为 1560 × 3120 CSS px；每个半屏边栏高度也从 390 变为 1560。仅调整浏览器窗口宽度无法覆盖这种行为。WebKit 在同一样例中保持视口尺寸，但正文也会横向溢出。

正文容器现在接住横向溢出，宽表格或历史 HTML 可在知识区内横向滚动，不再把整个页面和固定边栏一起撑大。所有文字、单元格和图片仍保留；不使用裁切或删除来隐藏问题。正文与边栏宽度、原来的视觉样式及已验证的纵向阅读定位逻辑不变。测试包增加「宽表格与边栏稳定性」原生 Cloze 样例。

另外，在本地 React 资源尚未加载时，提前匹配卡片的纸色、竹露或夜间背景，避免先露出宿主默认白底、再切换主题色。bootstrap 中的主题值仅用于这段初始绘制；不写偏好、不改变 body 所有权，不参与业务状态。

安卓每面使用新文档加载，宿主还会在 load 时重置滚动、在公式排版时隐藏正文。这一轮保留已有呈现等待，避免重新出现错位的树或答案图片。因此，背景修复不等于证明宿主换页的短暂空白已完全消失；仍须 Android 实机复测。依据见 [AnkiDroid card.js](https://github.com/ankidroid/Anki-Android/blob/main/AnkiDroid/src/main/assets/scripts/card.js) 与 [客户端加载实现](https://github.com/ankidroid/Anki-Android/blob/main/AnkiDroid/src/main/java/com/ichi2/anki/AbstractFlashcardViewer.kt)。

新增回归分别在 Chromium／WebKit 的手机模式检查揭示前后和原生背面的四个边栏几何、页面宽度、表格最后一列可达，以及故意延迟运行时资源时三种背景在挂载前后一致。浏览器模拟不能代替手机客户端认证。

## Alpha.8：去掉就绪后的额外一帧

实机反馈仍有很轻微的纯短闪。这轮只缩短模板自己的等待：文档加载完成、字体就绪、宿主公式排版完成后，在同一任务中定位并显示，不再另排一帧。此前的正文定位、横向溢出处理和未就绪保护保留。iOS／Desktop 路径不变。

新增加载门控回归：先让运行时与字体就绪，再释放图片加载，检查宿主 load 重置之后、下一个帧之前，正文已经定位并显示。AnkiDroid 的 [card.js 在正文之前加载](https://github.com/ankidroid/Anki-Android/blob/main/AnkiDroid/src/main/assets/card_template.html)，因此其 load 回调先于卡片模板注册的监听器。这个改动只证明移除了模板的一次可避免等待，不能证明手机宿主换页完全无闪烁。
