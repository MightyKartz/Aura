# Aura 使用说明

## 支持范围

当前版本：
- 浏览器：Chrome
- 官方支持站点：腾讯视频

## 安装

1. 进入 Aura 项目目录
2. 执行：

```bash
npm run build
```

3. 在 Chrome 打开 `chrome://extensions`
4. 开启开发者模式
5. 选择“加载已解压的扩展程序”
6. 选择 `dist/`

## 基础使用

1. 打开腾讯视频播放页
2. 开始播放影视剧内容
3. 点击 Aura 插件图标打开 popup
4. 查看：
   - 当前剧集
   - 当前皮肤
   - 当前观影模式
5. 调节：
   - 开关
   - 动效强度
   - 自动推荐 / 手动皮肤

## 快捷键

- Windows / Linux：`Ctrl + Shift + A`
- macOS：`Command + Shift + A`

## 主题切换

### 自动推荐
Aura 会优先根据剧名和页面标签推荐皮肤：
- 类型皮肤优先
- 默认皮肤兜底

### 手动主题
也可以在 popup 中手动切换：
- 默认小猫
- 悬疑猫
- 古偶猫
- 热血猫

## 调试信息

点击 popup 中的“查看调试信息”，可以展开：
- `videoDetected`
- `containerSource`
- `controlsVisible`
- `adActive`
- `skinContext`
- `lastSyncReason`
- `moduleLoadState`
- `registryLoadState`
- `syncState`
- `errorStage`
- `errorMessage`
- `pageUrl`

## 常见问题

### 1. 插件没有显示效果
- 确认已在腾讯视频播放页
- 刷新页面
- 确认插件开关已开启
- 打开 popup 查看当前是否停留在“等待播放器容器”

### 2. 快捷键无效
- 先确认页面或 popup 已获得焦点
- 优先使用 `Ctrl + Shift + A` / `Command + Shift + A`
- 如果仍无效，尝试到 Chrome 扩展快捷键页重新绑定

### 3. 页面关闭后还有残留挂件
- 正常情况下现在应立即消失
- 如果仍出现，请打开 popup 查看 `lastSyncReason` 与 `errorStage`
