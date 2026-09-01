# -*- coding: utf-8 -*-
"""[Z7] 征象搜索内核抽取 —— 供多技法扫描引擎共用的树校验/树求值工厂。

election_scan.py **一字不动**(天星引擎原地);本内核把其 _validate_tree/_eval_node
两函数泛化成工厂(条件表/求值表/区间代数注入),七政(qizheng_election_scan)与印度
(india_election_scan)引擎 import 本内核 + election_scan 的区间代数(norm_intervals/
iv_and/iv_or/iv_not/iv_xor/true_intervals/negative_intervals 直接 import,零复制)。

树形状契约(与前端 compile*Tree 产物同构):
  组 {'type': 'all'|'any'|'not'|'xor', 'conditions': [...]}
  叶 {'type': <条件类键>, 'params': {...}}
"""

GROUP_TYPES = ('all', 'any', 'not', 'xor')


def make_validate(condition_types, group_types=GROUP_TYPES):
    """condition_types: {type: {'required': [param 键...]}};返回 validate(node)->None|raise。"""
    def validate(node):
        if not isinstance(node, dict):
            raise ValueError('condition node must be an object')
        t = node.get('type')
        if t in group_types:
            subs = node.get('conditions')
            if not isinstance(subs, list) or not subs:
                raise ValueError('group {0!r} needs non-empty conditions'.format(t))
            if t == 'not' and len(subs) != 1:
                raise ValueError('not group takes exactly one child')
            for c in subs:
                validate(c)
            return
        spec = condition_types.get(t)
        if spec is None:
            raise ValueError('unknown condition type: {0!r}'.format(t))
        params = node.get('params') or {}
        for key in spec.get('required', ()):
            if key not in params:
                raise ValueError('condition {0!r} missing param {1!r}'.format(t, key))
    return validate


def make_tree_evaluator(evaluators, iv_and, iv_or, iv_not, iv_xor, group_types=GROUP_TYPES):
    """evaluators: {type: fn(params, ctx, domain)->[(jd0,jd1)...]};返回 eval_node(node, ctx, domain)。"""
    def eval_node(node, ctx, domain):
        t = node.get('type')
        if t in group_types:
            subs = node.get('conditions') or []
            if t == 'all':
                acc = None
                for c in subs:
                    ivs = eval_node(c, ctx, domain)
                    acc = ivs if acc is None else iv_and(acc, ivs)
                    if not acc:
                        return []
                return acc or []
            if t == 'any':
                acc = []
                for c in subs:
                    acc = iv_or(acc, eval_node(c, ctx, domain))
                return acc
            if t == 'not':
                return iv_not(eval_node(subs[0], ctx, domain), domain)
            if t == 'xor':
                return iv_xor([eval_node(c, ctx, domain) for c in subs], domain)
        return evaluators[t](node.get('params') or {}, ctx, domain)
    return eval_node
