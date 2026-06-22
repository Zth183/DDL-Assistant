# 🧊 大学生DDL神器

> 专为大学生设计的AI智能期末助教 —— 输入各科任务，自动生成学习计划、作业答案、知识清单和 Pre 材料。

🌐 **在线使用**：https://zth183.github.io/DDL-Assistant/（GitHub Pages，打开即用）

![预览](images/icetea.jpg)

---

## 🚀 快速开始

### 💻 在线使用（推荐）
直接打开上面的链接，无需下载安装，浏览器打开就能用。

### 📦 本地运行
```bash
git clone https://github.com/Zth183/DDL-Assistant.git
cd DDL-Assistant
# 双击 index.html 打开
```

### 📱 三步上手
1. **输入昵称** → 2. **添加任务**（科目+类型+截止日期）→ 3. **自动生成全套方案**

无需注册、无需下载、即开即用。

### 📅 截止日历
- 按截止日期排列的日历视图，一目了然
- 🔴 紧急（≤3天）· 🟡 提醒（≤7天）· 🟢 充足 · ⚫ 已截止
- 每天显示紧急任务数量
- ✅ 点击 🧊 冰红茶按钮完成任务 + 🎉 庆祝动效

### 📝 作业自动生成
根据科目和任务描述，自动生成完整作业内容：
| 类型 | 生成内容 |
|:---|:---|
| **论文类** | 摘要 → 引言 → 正文 → 结论，完整论文框架 |
| **编程类** | Python / Java / C++ 完整代码 + 注释 + 使用说明 |
| **习题类** | 解题步骤 + 答案 + 错题总结 |
| **通用类** | 按章节生成知识点梳理报告 |

### 📖 考试知识点清单
内置常见科目知识库（高数、线代、概率论等），自动提炼重难点、易错点和常考题型。

### 🎤 Pre 辅助材料
- 10页完整 PPT 大纲（封面→目录→背景→核心→重点→案例→应用→总结→互动）
- 每页附完整演讲稿，可直接上台使用
- 📄 **导出 Word 演讲稿** 功能

### 💬 智能反馈面板
对 Pre 材料提问改进建议，AI 自动回复：
- "怎么让PPT更吸引人？"
- "演讲稿怎么改得更流畅？"
- "内容结构怎么优化？"

### 🔧 其他特性
- 📎 **文件上传**：支持 PDF/Word/PPT/TXT/图片/ZIP，单个文件 ≤ 10MB
- 🔌 **个人 API 接入**：支持 OpenAI 兼容格式（DeepSeek、通义千问、智谱等）
- 💾 **数据本地存储**：刷新不丢失（localStorage）
- 📱 **响应式设计**：手机 / 平板 / 桌面全适配

---

## 🚀 快速开始

1. **打开页面** → 输入你的昵称
2. **添加任务** → 科目、类型（作业/考试/Pre）、截止日期、描述
3. **生成方案** → 自动得到完整计划 + 作业 + 知识点 + Pre材料

无需注册、无需下载、即开即用。

---

## 🔌 接入个人 AI API（可选）

支持 OpenAI 兼容格式的 API：

| 服务 | API 地址 |
|:---|:---|
| OpenAI | `https://api.openai.com/v1/chat/completions` |
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` |
| SiliconFlow | `https://api.siliconflow.cn/v1` |

在 Step 1 打开「接入个人 AI API」开关，填写地址和 Key 即可。

---

## 🛠️ 技术栈

- 纯前端 · 无后端依赖
- HTML5 + CSS3 + JavaScript (ES6+)
- 数据持久化：localStorage
- 字体图标：Font Awesome 6
- 字体：Noto Sans SC

---

## 📂 项目结构

```
├── index.html          # 主页面
├── css/
│   └── style.css       # 样式表
├── js/
│   └── app.js          # 完整应用逻辑
├── images/
│   └── icetea.jpg      # 冰红茶 🧊
├── .gitignore
└── README.md
```

---

## 📄 开源协议

MIT License

---

## 🧊 关于冰红茶

完成按钮用冰红茶，因为——DDL 赶完喝一口，**透心凉，心飞扬** ✨
