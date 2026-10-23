"""Public anonymous stress scenes shared by visual tests and the template preview."""

from mindmap_examples import blank, node, fields as mindmap_fields

def scenes():
    table = '<table><tr><th>规则</th><th>example.cn</th><th>www.example.cn</th><th>处理结果</th></tr>' \
        '<tr><td><code>domain: www.example.cn</code></td><td>不匹配</td><td>匹配</td><td>只比较完整域名</td></tr>' \
        '<tr><td><code>domain_suffix: example.cn</code></td><td>匹配</td><td>匹配</td><td>包括子域名，保留原始规则含义</td></tr></table>'
    paragraphs = '<p>先判断条件的适用范围，再核对结论；相似表达不一定代表相同的匹配行为。保留必要上下文，避免只记住选项位置。</p>' * 5
    image = '<img src="_rule-build.svg" alt="规则构建示意图">'
    # Deep branches include prose, an image and a table, not just short labels.
    deep = node(blank(2, '深层答案先理解定义，再核对适用边界。' * 60, 'long-answer') + table + image)
    for _ in range(9):
        deep = node('深层上下文', deep)
    return [
        ('mindmap', mindmap_fields('规则学习：结构与边界', node('匹配范围', node('完整域名 '+blank(1,'domain','complex-domain')+'，域名家族 '+blank(1,'domain_suffix','complex-suffix')+table)+node('构建过程'+image)+node('扩展阅读',deep)), '<p>个人错因：先回忆范围，再核对例子。</p>'+image, image), []),
    ]
