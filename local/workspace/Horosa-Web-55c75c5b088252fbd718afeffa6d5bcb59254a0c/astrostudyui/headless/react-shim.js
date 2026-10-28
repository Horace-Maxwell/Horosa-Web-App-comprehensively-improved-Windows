// 经典 JSX 运行时:部分组件文件没有显式 import React(umi 的 babel 预设同样走经典运行时),打包时统一注入
import * as React from 'react';
export { React };
