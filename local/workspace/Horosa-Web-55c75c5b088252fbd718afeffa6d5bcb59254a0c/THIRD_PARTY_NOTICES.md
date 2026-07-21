# Third-Party Notices

This project includes and adapts open-source components from the following projects.

## kintaiyi

- Project: Kintaiyi / Python 太乙神數
- Repository: https://github.com/kentang2017/kintaiyi
- Copyright: Copyright (c) 2023-2026 kentang2017
- License: MIT License
- Use in Horosa: the Taiyi calculation engine is vendored under `Horosa-Web/vendor/kintaiyi` and is used as the backend calculation source for the Horosa 太乙 page. Horosa keeps its own UI and adapts kintaiyi calculation output for display.

The original MIT license text is preserved at:

- `Horosa-Web/vendor/kintaiyi/LICENSE`

## kinjinkou

- Project: kinjinkou / Python 金口诀
- Repository: https://github.com/kentang2017/kinjinkou
- Copyright: kentang2017 and contributors
- License: MIT License, as stated in the upstream README
- Use in Horosa: the 金口诀 calculation engine is vendored under `Horosa-Web/vendor/kinjinkou` and is used as the backend calculation source for the Horosa 金口诀 page. Horosa keeps its own UI and adapts kinjinkou calculation output for display.

The MIT license text is preserved in the vendored snapshot at:

- `Horosa-Web/vendor/kinjinkou/LICENSE`

## kinwangji

- Project: Kinwangji / Python 皇極經世
- Repository: https://github.com/kentang2017/kinwangji
- Copyright: kentang2017 and contributors
- License: MIT License, as stated in the upstream README and `pyproject.toml`
- Use in Horosa: the 皇极经世 calculation engine is vendored under `Horosa-Web/vendor/kinwangji` and is used as the backend calculation source for the Horosa 其他 / 皇极经世 page. Horosa keeps its own UI and adapts kinwangji calculation output for display.

The MIT license text is preserved in the vendored snapshot at:

- `Horosa-Web/vendor/kinwangji/LICENSE`

## kinwuzhao

- Project: Kinwuzhao / Python 五兆卜法
- Repository: https://github.com/kentang2017/kinwuzhao
- Copyright: Copyright (c) 2023-2026 kentang
- License: MIT License
- Use in Horosa: the 五兆 calculation engine is vendored under `Horosa-Web/vendor/kinwuzhao` and is used as the backend calculation source for the Horosa 其他 / 五兆 page. Horosa keeps its own UI and adapts kinwuzhao calculation output for display.

The original MIT license text is preserved at:

- `Horosa-Web/vendor/kinwuzhao/LICENSE`

## taixuanshifa

- Project: Taixuanshifa / Python 太玄筮法
- Repository: https://github.com/kentang2017/taixuanshifa
- Copyright: Ken Tang / kentang2017 and contributors
- License: no explicit open-source license file or license declaration was found in the vendored upstream snapshot.
- Use in Horosa: the 太玄筮法 calculation engine is vendored under `Horosa-Web/vendor/taixuanshifa` and is used as the backend calculation source for the Horosa 其他 / 太玄 page. Horosa keeps its own UI and adapts taixuanshifa calculation output for display.

Note: because no explicit upstream license was found, this notice intentionally does not label the project as MIT/Apache/GPL/BSD.

## jingjue

- Project: Jingjue / Python 荆诀
- Repository: https://github.com/kentang2017/jingjue
- Copyright: Ken Tang / kentang2017 and contributors
- License: no explicit open-source license file or license declaration was found in the vendored upstream snapshot.
- Use in Horosa: the 荆诀 calculation engine is vendored under `Horosa-Web/vendor/jingjue` and is used as the backend calculation source for the Horosa 其他 / 荆诀 page. Horosa keeps its own UI and adapts jingjue calculation output for display.

Note: because no explicit upstream license was found, this notice intentionally does not label the project as MIT/Apache/GPL/BSD.

## shenyishu

- Project: Shenyishu / 神易數兵占
- Repository: https://github.com/kentang2017/shenyishu
- Copyright: Ken Tang / kentang2017 and contributors
- License: no explicit open-source license file was found in the vendored upstream snapshot. The upstream README states that the project is for academic research and cultural heritage purposes.
- Use in Horosa: the 神易数 calculation engine is vendored under `Horosa-Web/vendor/shenyishu` and is used as the backend calculation source for the Horosa 其他 / 神易数 page. Horosa keeps its own UI and adapts shenyishu calculation output for display.

Note: because no explicit upstream license was found, this notice intentionally does not label the project as MIT/Apache/GPL/BSD.

## kinastro

- Project: Kin Astro / 堅占星
- Repository: https://github.com/kentang2017/kinastro
- Copyright: kentang2017 and contributors
- License: MIT License, as stated in the upstream README and `pyproject.toml`
- Use in Horosa: the 邵子神数、铁板神数、鬼谷分定经、北极神数、南极神数、蠢子数、万化仙禽、策天飞星、七政四余 calculation engines are vendored under `Horosa-Web/vendor/kinastro` and are used as backend calculation sources for the Horosa 命 / 数算、命 / 演禽、命 / 其他 and 七政 pages. Horosa keeps its own UI and adapts kinastro calculation output for display.

The MIT license text is preserved in the vendored snapshot at:

- `Horosa-Web/vendor/kinastro/LICENSE`

## kinqimen

- Project: KinQiMen / Python 奇门遁甲排盘系统
- Repository: https://github.com/kentang2017/kinqimen
- Copyright: kentang2017 and contributors
- License: MIT License, as stated in the upstream README
- Use in Horosa: the 奇门遁甲 calculation engine is vendored under `Horosa-Web/vendor/kinqimen` and is used as the backend calculation source for the Horosa 遁甲 page. Horosa keeps its own UI and adapts kinqimen calculation output for display.

The MIT license text is preserved in the vendored snapshot at:

- `Horosa-Web/vendor/kinqimen/LICENSE`

### v2.1.6 奇门历法修复 — 算法参考与对照标尺

v2.1.6 对 vendored `kinqimen`（MIT）做了历法修复（月柱交节边界、置闰超神接气定局）。所采用的**超神接气置闰定局规则属古典公有算法**（非任何项目独有）。实现为本项目自写 Python；在研究与验证阶段参考过以下公开项目的结构、并将其作为对照标尺/参考，**未拷贝其任何源文件**：

- **Taogram/taobi** — https://github.com/Taogram/taobi — License: **MPL-2.0**。基于 VSOP87D 的精确节气与拆补法在线排盘，作拆补法对照参考。
- **redrockhorse/qimenpaipan** — https://github.com/redrockhorse/qimenpaipan — 置闰/拆补 Python 实现，作结构参考（其局数表部分条目与古典不符，未采用）。
- **qfdk/qimen** — https://github.com/qfdk/qimen — License: **MIT**。奇门在线排盘参考。

局数表、阴阳遁、三元规则以古典转盘文献及 vendored kinqimen 既有数据为准。本项目整体许可：AGPL-3.0-only。

## d3-celestial（天球坐标参考数据）

- Project: d3-celestial — celestial map data (constellation lines / IAU boundaries / Chinese asterisms)
- Repository: https://github.com/ofrohn/d3-celestial
- Copyright: Copyright (c) 2015, Olaf Frohn
- License: BSD 3-Clause License
- Use in Horosa: the 天文馆 3D celestial sphere uses J2000 RA/Dec polylines **derived from** this dataset for the Western 88-constellation stick figures, IAU constellation boundaries, and the Chinese Three-Enclosures (三垣) walls. The data is reshaped into Horosa's own JSON schema under `Horosa-Web/astrostudyui/src/data/{constellationLines,constellationBounds,sanyuanWalls}.json`; Horosa keeps its own renderer and styling.

BSD 3-Clause requires retaining the above copyright notice in redistributions; it is preserved here.

## flatlib

- Project: flatlib — Python library for traditional astrology
- Repository: https://github.com/flatangle/flatlib
- Copyright: Copyright (c) João Ventura and contributors
- License: MIT License
- Use in Horosa: a maintained fork is vendored under `Horosa-Web/flatlib-ctrad2` and used by the Python calculation engine for traditional / Hellenistic chart computations. Horosa keeps its own UI and adapts flatlib output for display.

The upstream flatlib MIT license applies to the vendored fork.

## Swiss Ephemeris

- Project: Swiss Ephemeris (used via the `pyswisseph` Python binding)
- Repository: https://github.com/astrorigin/pyswisseph (binding); upstream https://www.astro.com/swisseph/
- Copyright: Copyright (c) Astrodienst AG, Zürich
- License: GNU Affero General Public License, version 3 (AGPL-3.0)
- Use in Horosa: the Swiss Ephemeris provides the high-precision planetary and lunar ephemeris underlying Horosa's astrological and astronomical calculations (positions, houses, eclipses, declinations, etc.).

Horosa is distributed under the AGPL-3.0, satisfying the Swiss Ephemeris licensing requirement; the full AGPL-3.0 license text applies.

## Stellarium（界面交互设计灵感）

- Project: Stellarium — open-source planetarium
- Repository: https://github.com/Stellarium/stellarium
- Copyright: Copyright (c) Stellarium contributors
- License: GNU General Public License, version 2 (GPL-2.0)
- Use in Horosa: no code, assets, or data from Stellarium are bundled or vendored. Horosa's built-in planetarium independently implements its own rendering, camera controls, and time playback; certain user-facing interaction conventions (e.g. click-to-track an object with the camera, drag-to-release tracking, seamless time-based extrapolation between server samples) are inspired by long-standing planetarium UX as exemplified by Stellarium. Source-level references to the name appear only in code comments describing the design intent.

No GPL-licensed source from Stellarium is incorporated; this notice is provided as an acknowledgment of design inspiration.
