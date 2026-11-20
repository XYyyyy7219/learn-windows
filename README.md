# learn-windows

原项目 [amosblomqvist/learn](https://github.com/amosblomqvist/learn) 由 Amos Blomqvist 创建。原作者在 [How I Use AI to Learn Things](https://www.youtube.com/watch?v=kzcI5F4tGiU) 中介绍了这套教学系统。这里是个人维护的 Windows 原生适配，V2.2 提供教材教学和独立解题训练两种模式。

在 Windows Terminal 中运行 Pi，按课程和章节保存会话，把 Markdown 学习记录交给 Obsidian 阅读。教学过程中可检索和阅读来源，也可生成 SVG、Mermaid 配图。

## 安装与启动

1. 准备 Windows、Node.js 24（含 npm）和 Windows Terminal。需要图形时安装 Chrome 或 Edge。需要在 Obsidian 中查看章节记录时，先把项目文件夹添加为 Obsidian 库。
2. 克隆本仓库，在项目目录运行 `Install-Windows.cmd`。安装脚本会按锁定的版本下载 Pi、网页与 PDF 读取和绘图依赖。
3. 运行 `Start-Learn.cmd`，选择课程与章节。首次使用，在 Pi 输入 `/login`，选择账号登录及 OpenAI Codex，在浏览器完成登录。需要时退出并重新进入章节。当前适配以账号有权使用的 GPT‑6.2 Sol 为默认模型，推理强度为极高。
4. 将本地教材位置写入课程目录的 `Materials.md`，再告诉 Pi 本次学习目标。若要读取或渲染本地 PDF，可给本机 Python 安装 `PyMuPDF`（`python -m pip install pymupdf`）。

从 Pi 中用 `/learn` 打开另一门课或另一个章节。仅用终端学习时，启动参数 `--no-obsidian` 可跳过打开阅读器。

## V2.1 测评

Pi 按教材组织章节、小节和知识单元，以小节结束为主要测评时机，分别记录概念理解、独立推导和解题应用的实际证据。测评轮到时输入「继续」开始，也可说「跳过测评」或「直接下一节」。

推导和证明可用文字、LaTeX 或手写截图分段提交。提交完后说「我答完了」，也可在中途请求部分检查或提示。章末可主动请求练习试卷或模拟考试。学习证据随章节会话和 Markdown 回顾留存，跨会话汇总需要回看相关记录。

## V2.2 独立解题训练

输入 `/skill:problem-solving`，或说「开始刷《物理学难题集萃》」，然后贴题面、截图或可核对的来源。Pi 先确认题意和条件，等你在纸上或 OneNote 中独立尝试。可以请求一点提示、只检查一步，或直接查看完整解析。手写答卷可分段提交，交完后请 Pi 做整体批改。

批改和完整解析先从题干重建并验证解法，再按需对照参考答案。题面和答案已同时进入对话时，独立分析可能受可见答案影响。复盘沿用已有章节会话和 Markdown 记录。

用 `/skill:teach` 或「继续按教材学习」回到体系化教学。课内偶遇习题时，Pi 延续当前教学模式。`/learn` 仍用于切换课程或章节。

## 后续修改

| 修改内容 | 文件位置 |
| --- | --- |
| 全局学习约定 | `AGENTS.md` |
| 教学节奏、测评与可视化流程 | `.pi/skills/` |
| 研究与绘图助手模型 | `.pi/agents/` |
| 教学窗口默认模型 | `setup/learning-model.mjs` 和 `.pi/settings.json` |
| 课程与章节 | `setup/courses.json` 和各课程的 `setup/course-session.json` |
| Windows 启动和助手进程 | `setup/start-menu.mjs`、`setup/windows-runtime.mjs` 和 `setup/windows-learning.ts` |

仓库带有原子物理、力学、理论力学和数学物理方法的空白章节入口。首次进入时在本机生成记录。会话和登录凭据保存在项目的 `.private/` 目录。个人笔记、讲义、教材、学习记录和生成图像由 Git 忽略。

代码沿用上游仓库的作者记录。上游目前未声明开源许可证，项目来源及原始代码见 [上游仓库](https://github.com/amosblomqvist/learn)。
