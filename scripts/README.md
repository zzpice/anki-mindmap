# 构建与验证入口

| 脚本 | 用途 |
| --- | --- |
| `check_react.py` | 原生身份、字段、源码范围和离线约束；由 npm run check 调用 |
| `build_react_package.py` | 唯一正常构包入口；生成独立测试 APKG、摘要及本地调试面 |
| `prepare_visual_comparison.py` | 从固定旧版 f67c932 准备官方原生渲染和 reviewer 资源 |
| `build_layout_comparison.py` | 可选的旧版／React 诊断包；含匿名长图及布局数据面板 |
| `mindmap_examples.py` | 构包样例的 HTML 辅助函数，不参与客户端分卡 |
| `sources.py` | 仅供固定旧版编译器使用的 include 展开；不是 React 运行时依赖 |
| `requirements-build.txt` / `requirements-test.txt` | 官方 Anki 后端／测试 reviewer 的锁定版本 |

命令顺序见[开发说明](../docs/development.md)。React 和所有运行时资源在构包前本地编译；Anki 客户端不使用这些 Python 脚本、开发服务器或仓库路径。

已移除 build_package.py、build_preview.py、check_templates.py 和 release_assets.py 等旧入口别名。它们曾转发到当前构包，但并不创建正式 Release；统一入口避免误用。旧版实际工具可从[固定历史](../docs/history/README.md)查回。
