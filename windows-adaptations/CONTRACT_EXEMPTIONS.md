# 五层契约 —— 显式豁免表(tracked)

> **为什么这个文件是 tracked 的**:`desktop_installer_bundle/scripts/release_selfcheck.py`(所有门的载体)
> 按政策 **gitignored**。它丢失是「可检测」的(`HARNESS_MANIFEST.md` 有 sha256),但**不可从 git 恢复**。
> 一个零上下文的 session 至少必须能读到「哪些东西被刻意放过、为什么」—— 否则它只会看到一堆门,
> 却不知道缺口在哪。豁免必须留在 **tracked 树**里。
>
> **判据(由 selfcheck 强制)**:
> * 理由必须 ≥ 40 字符且不得是占位符 —— 空理由 / 「TODO」 / 「暂时」 / 「同上」 一律视同**未登记**,门 FAIL。
>   (「同上」被明确拒绝是有来由的:该门首跑就抓到了一条写着「同上」的豁免。零上下文的读者无从知道「上」是哪一条。)
> * 键指向的路径若已不存在 ⇒ **陈旧豁免 = FAIL**。陈旧豁免会烂成盲区:它让门以为「这里已解释过」,
>   而实际上被解释的东西早就没了。
> * 想加豁免?先问一遍「能不能改成不需要豁免」。这张表越短越好。

## 哨兵层豁免(有实物、但不走 `SENT` needle 门)

| 层 | 键 | 理由 |
| --- | --- | --- |
| sentinel | `start_horosa_local.sh` | Web 一键启动脚本;其内容由 `check_local_launchers()` 的 `sh_specs` 单独钉住(存在性 + `bash -n` + marker 三重),口径与 needle 门不同,重复登记会造成两处判据漂移 |
| sentinel | `verify_horosa_local.sh` | 同上;`bash -n` 语法门 + marker 双验已在 `check_local_launchers`,不进 `SENT` |

## 运行期缺口(结构性钉住,但发布门里不真跑)

| 层 | 键 | 理由 |
| --- | --- | --- |
| test-run | `astrostudyui/src/utils/__tests__/idleWarmQueue.test.js` | jest 冷启在本机 >4 分钟、曾与 `dist:win` 同跑到 889 秒;把它接进发布门,两轮之内必被人绕过,那比现在更糟。**已改为结构性覆盖**:`SENT` 钉住文件在 + 三条关键断言在;真跑走人工 `npx umi-test <file>`。这个缺口是**明写**的,不是粉饰的 |

## 清单层豁免(`update-harness-manifest.py` 的 `EXEMPT`)

| 层 | 键 | 理由 |
| --- | --- | --- |
| manifest | `desktop_installer_bundle/electron/__pycache__` | Python 字节码副产物,非源文件;内容随解释器版本变化,收编只会制造无意义的 sha 漂移 |
| manifest | `desktop_installer_bundle/scripts/__pycache__` | Python 字节码副产物,非源文件;与 electron/ 下那个同理,内容随解释器版本变化,收编只会制造无意义的 sha 漂移 |

## 与 apply.sh 的耦合(改一处必须同时改另一处)

| 耦合 | 说明 |
| --- | --- |
| `files/` 逐字节等价断言 ↔ `apply.sh` §1 | 台账 #1/#2 的还原方式是直接 `cp` / `cp -r`,所以「工作区文件 sha256 == overlay 文件 sha256」这条断言才成立(它比 marker 更强:能抓到截断/损坏的部分还原)。**若 apply.sh 将来在拷贝后追加任何编辑,这条断言必须同步改**,否则会变成假红 |
| `package.json` 结构比对 ↔ `apply.sh` §3 | 判据镜像的是 §3 用 node 合并写入的字段(`name` + `scripts` 全量),而非整文件比对 —— Mac 的依赖变更不应触发红 |
