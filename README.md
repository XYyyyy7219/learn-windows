# learn-windows

原项目 [amosblomqvist/learn](https://github.com/amosblomqvist/learn) 由 Amos Blomqvist 创建。原作者在 [How I Use AI to Learn Things](https://www.youtube.com/watch?v=kzcI5F4tGiU) 中介绍了这套教学系统。这里是个人维护的 Windows 原生适配，沿用原项目的探查、规划和教学流程。

在 Windows Terminal 中运行 Pi，按课程和章节保存会话，把 Markdown 学习记录交给 Obsidian 阅读。教学过程中可检索和阅读来源，也可生成 SVG、Mermaid 配图。

## 安装与启动

1. 准备 Windows、Node.js 24（含 npm）和 Windows Terminal。需要图形时安装 Chrome 或 Edge。需要在 Obsidian 中查看章节记录时，先把项目文件夹添加为 Obsidian 库。
2. 克隆本仓库，在项目目录运行 `Install-Windows.cmd`。安装脚本会按锁定的版本下载 Pi、网页与 PDF 读取和绘图依赖。
3. 运行 `Start-Learn.cmd`，选择课程与章节。首次使用，在 Pi 输入 `/login`，选择账号登录及 OpenAI Codex，在浏览器完成登录。需要时退出并重新进入章节。当前适配以账号有权使用的 GPT‑6.2 Sol 为默认模型，推理强度为极高。
4. 将本地教材位置写入课程目录的 `Materials.md`，再告诉 Pi 本次学习目标。若要读取或渲染本地 PDF，可给本机 Python 安装 `PyMuPDF`（`python -m pip install pymupdf`）。

从 Pi 中用 `/learn` 打开另一门课或另一个章节。仅用终端学习时，启动参数 `--no-obsidian` 可跳过打开阅读器。

## 后续修改

| 修改内容 | 文件位置 |
| --- | --- |
| 教学节奏、核查和测评约定 | `AGENTS.md` |
| 教学方式和可视化流程 | `.pi/skills/` |
| 研究与绘图助手模型 | `.pi/agents/` |
| 教学窗口默认模型 | `setup/learning-model.mjs` 和 `.pi/settings.json` |
| 课程与章节 | `setup/courses.json` 和各课程的 `setup/course-session.json` |
| Windows 启动和助手进程 | `setup/start-menu.mjs`、`setup/windows-runtime.mjs` 和 `setup/windows-learning.ts` |

仓库带有原子物理、力学、理论力学和数学物理方法的空白章节入口。首次进入时在本机生成记录。会话和登录凭据保存在项目的 `.private/` 目录。个人笔记、讲义、教材、学习记录和生成图像由 Git 忽略。

代码沿用上游仓库的作者记录。上游目前未声明开源许可证，项目来源及原始代码见 [上游仓库](https://github.com/amosblomqvist/learn)。
