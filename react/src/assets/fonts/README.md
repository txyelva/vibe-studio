# 字体文件

本项目使用 JetBrains Mono 作为英文字体，Noto Sans SC 作为中文字体。

## 字体来源

- **JetBrains Mono**: https://www.jetbrains.com/lp/mono/
- **Noto Sans SC**: https://fonts.google.com/noto/specimen/Noto+Sans+SC

## 配置

如果你需要完整的中文字体支持，请下载 Noto Sans SC 并放入此目录：

```bash
wget https://fonts.google.com/download?family=Noto%20Sans%20SC -O NotoSansSC.zip
unzip NotoSansSC.zip -d NotoSansSC/
```

或者在 `index.html` 中使用 Google Fonts CDN：

```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet">
```

## 当前配置

为了减小仓库体积，默认使用系统字体回退：
```css
font-family: 'JetBrains Mono', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```
