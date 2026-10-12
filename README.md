# Qwacky 中文版

Qwacky 是一个浏览器扩展，用于管理 DuckDuckGo Email Protection 提供的 `@duck.com` 地址。本版本将扩展界面和常用提示汉化为简体中文。

## 主要功能

- 生成新的 `@duck.com` 地址
- 搜索、排序、备注和标签管理地址历史
- 将收件人邮箱转换为私密发送地址
- 管理多个 DuckDuckGo 账户
- 查看本地统计数据
- 跨设备同步，以及 JSON 备份和恢复
- 浅色、深色、跟随系统和紧凑模式
- 可选的右键菜单和快捷键自动填充

## 使用说明

### 登录

1. 点击浏览器工具栏中的 Qwacky 图标。
2. 输入 Duck 用户名，点击**继续**。
3. 打开邮箱，找到 DuckDuckGo 发来的密码短语。
4. 输入四个密码短语单词，点击**验证一次性密码**。

没有 `@duck.com` 地址时，可以在登录页点击**立即创建**，前往 DuckDuckGo 注册。

### 生成和管理地址

1. 打开**首页**，点击**生成新地址**。
2. 新地址会自动复制到剪贴板，可直接粘贴使用。
3. 打开**地址**页面，可以搜索、排序、添加备注、管理标签或删除地址。

如果在**设置 → 权限与功能**中关闭历史记录，新生成的地址只会复制到剪贴板，不会保存。

### 使用私密发送地址

1. 打开**发送**页面。
2. 输入收件人邮箱，点击**转换**。
3. 生成的发送地址会自动复制到剪贴板。
4. 将它用于邮件发送，以隐藏真实邮箱地址。

### 开启自动填充

进入**设置 → 权限与功能**，开启**自动填充**并授予浏览器权限。

- `Alt+Shift+Q`：生成并填充 Duck 地址
- `Alt+Shift+S`：将选中的收件人转换为发送地址
- 也可以在可编辑输入框中使用右键菜单

Firefox Android 不支持扩展上下文菜单和键盘快捷键，但弹窗内的其他功能仍可正常使用。

### 同步和备份

进入**设置**：

- 开启**跨设备同步**，通过浏览器同步服务同步数据；
- 在**备份与恢复**中导出或导入 JSON 备份；
- 导出包含会话数据的备份前，请确认文件安全。备份可能包含访问令牌和登录凭据，切勿分享给他人。

## 手动安装

### Chrome、Edge、Brave 等 Chromium 浏览器

1. 执行 `npm run build`，生成 `dist_chrome/`。
2. 打开 `chrome://extensions`，或 Edge 对应的扩展管理页面。
3. 开启**开发者模式**。
4. 点击**加载已解压的扩展程序**，选择 `dist_chrome/` 文件夹。

### Firefox

1. 执行 `npm run build:firefox`，生成 `dist_firefox/`。
2. 打开 `about:debugging`，选择**此 Firefox**。
3. 点击**临时载入附加组件**。
4. 选择 `dist_firefox/manifest.json`。

## 开发与构建

要求 Node.js 16 或更高版本。

```bash
npm install

# Chrome 开发构建，输出到 dist_chrome/
npm run dev

# Firefox 开发构建，输出到 dist_firefox/
npm run dev:firefox

# 生产构建
npm run build
npm run build:firefox
```

## 隐私说明

账户信息、地址、备注、标签和设置默认保存在本地浏览器扩展存储中。Qwacky 主要与 DuckDuckGo Email Protection 及浏览器同步服务通信，不运行独立分析服务，也不会主动收集、出售或共享你的数据。

详细内容请参阅：[隐私政策](PRIVACY.md)。

## 项目信息

- 原项目：[Hotzenplotz-S/Qwacky](https://github.com/Hotzenplotz-S/Qwacky)
- DuckDuckGo Email Protection：[官方页面](https://duckduckgo.com/email)
- 问题反馈：[GitHub Issues](https://github.com/Hotzenplotz-S/Qwacky/issues)

## 许可证

本项目基于原 Qwacky 项目进行中文化。具体许可证信息请参阅 [LICENSE](LICENSE)。
