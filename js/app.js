/* ============================================
   大学生DDL神器 - Application Logic
   ============================================ */
;(function() {
'use strict';

// ===================== STATE =====================
const state = {
    user: { name: '', useAPI: false, apiKey: '', apiEndpoint: '', apiModel: 'gpt-4o', apiPreset: '' },
    tasks: [],
    editId: null,
    currentModalFiles: [],   // files in the modal before saving
    scheduleCompletion: {},  // { "date_idx": true/false }
    scheduleFilter: 'all',   // 'all' | 'today' | 'week'
    generated: { schedule: [], homework: [], knowledge: [], presentation: [] }
};

// ===================== DOM REFS =====================
const $ = id => document.getElementById(id);
const el = {
    // Loading
    loading: $('loadingScreen'),
    // Steps
    step1: $('step1Page'),
    step2: $('step2Page'),
    step3: $('step3Page'),
    stepDots: document.querySelectorAll('.step-dot'),
    stepIndicator: $('stepIndicator'),
    // Step 1
    userName: $('userNameInput'),
    apiSwitch: $('apiSwitch'),
    apiConfig: $('apiConfigArea'),
    apiEndpoint: $('apiEndpoint'),
    apiKey: $('apiKey'),
    apiModel: $('apiModel'),
    apiPreset: $('apiPreset'),
    step1Next: $('step1Next'),
    // Step 2
    taskList: $('taskList'),
    taskEmpty: $('taskEmpty'),
    addTaskBtn: $('addTaskBtn'),
    step2Back: $('step2Back'),
    step2Next: $('step2Next'),
    // Step 3 / Dashboard
    dashUserName: $('dashUserName'),
    dashDate: $('dashDate'),
    dashStats: $('dashStats'),
    dashTabs: $('dashTabs'),
    tabBtns: document.querySelectorAll('.dash-tab'),
    // Tab contents
    tabSchedule: $('tabSchedule'),
    tabHomework: $('tabHomework'),
    tabKnowledge: $('tabKnowledge'),
    tabPresentation: $('tabPresentation'),
    schedContent: $('scheduleContent'),
    hwContent: $('homeworkContent'),
    knowContent: $('knowledgeContent'),
    preContent: $('preContent'),
    // Action buttons
    refreshScheduleBtn: $('refreshScheduleBtn'),
    refreshHomeworkBtn: $('refreshHomeworkBtn'),
    refreshKnowledgeBtn: $('refreshKnowledgeBtn'),
    refreshPreBtn: $('refreshPreBtn'),
    exportPreWordBtn: $('exportPreWordBtn'),
    exportBtn: $('exportBtn'),
    dashBackBtn: $('dashBackBtn'),
    resetBtn: $('resetBtn'),
    // Modal
    taskModal: $('taskModal'),
    modalTitle: $('modalTitle'),
    modalClose: $('modalClose'),
    modalCancel: $('modalCancel'),
    modalSave: $('modalSave'),
    taskSubject: $('taskSubject'),
    taskDeadline: $('taskDeadline'),
    taskDescription: $('taskDescription'),
    taskMaterials: $('taskMaterials'),
    // File upload
    fileDropZone: $('fileDropZone'),
    fileInput: $('fileInput'),
    fileList: $('fileList'),
    fileUploadPlaceholder: $('fileUploadPlaceholder'),
    // Confirm
    confirmModal: $('confirmModal'),
    confirmBody: $('confirmBody'),
    confirmCancel: $('confirmCancel'),
    confirmOk: $('confirmOk'),
    // Toast
    toastContainer: $('toastContainer')
};

// ===================== UTILITY =====================
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function getToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(dateStr) {
    if (!dateStr) return '未设置';
    const parts = dateStr.split('-');
    return `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日`;
}

function daysUntil(dateStr) {
    if (!dateStr) return 999;
    const now = new Date(); now.setHours(0,0,0,0);
    const target = new Date(dateStr);
    return Math.ceil((target - now) / (1000*60*60*24));
}

function getWeekday(dateStr) {
    const days = ['周日','周一','周二','周三','周四','周五','周六'];
    return days[new Date(dateStr).getDay()];
}

function diffDays(a, b) {
    return Math.ceil((new Date(b) - new Date(a)) / (1000*60*60*24));
}

function addDays(dateStr, n) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ===================== LOCAL STORAGE =====================
const STORAGE_KEY = 'final_assistant_data';

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            user: state.user,
            tasks: state.tasks,
            scheduleCompletion: state.scheduleCompletion
        }));
    } catch(e) {}
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            if (data.user) state.user = data.user;
            if (data.tasks) state.tasks = data.tasks;
            if (data.scheduleCompletion) state.scheduleCompletion = data.scheduleCompletion;
        }
    } catch(e) {}
}

// ===================== TOAST =====================
function showToast(msg, type='info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const iconMap = { success: 'check-circle', error: 'times-circle', info: 'info-circle' };
    t.innerHTML = `<i class="fas fa-${iconMap[type] || 'info-circle'}"></i> ${msg}`;
    el.toastContainer.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(40px)'; t.style.transition = '0.3s'; setTimeout(() => t.remove(), 300); }, 2800);
}

// ===================== STEP NAVIGATION =====================
function goToStep(step) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pages = {1: el.step1, 2: el.step2, 3: el.step3};
    if (pages[step]) pages[step].classList.add('active');

    el.stepDots.forEach((dot, i) => {
        const idx = i + 1;
        dot.classList.remove('active', 'done');
        if (idx === step) dot.classList.add('active');
        else if (idx < step) dot.classList.add('done');
    });

    if (step === 3) {
        generateAll();
        renderDashboard();
    }
    window.scrollTo(0, 0);
}

// ===================== TASK CRUD =====================
function renderTaskList() {
    el.taskList.innerHTML = '';
    if (state.tasks.length === 0) {
        el.taskList.appendChild(el.taskEmpty);
        el.step2Next.disabled = true;
        return;
    }
    el.step2Next.disabled = false;

    state.tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'task-card';
        const typeMap = {
            '作业': { cls: 'badge-homework', icon: 'fa-file-alt' },
            '考试': { cls: 'badge-exam', icon: 'fa-pencil-alt' },
            'Pre': { cls: 'badge-presentation', icon: 'fa-chalkboard' }
        };
        const t = typeMap[task.type] || typeMap['作业'];
        const left = daysUntil(task.deadline);
        const deadlineStr = task.deadline ? `${formatDate(task.deadline)} (${getWeekday(task.deadline)})` : '未设置';
        const urgent = left <= 3 && left >= 0;
        const files = task.materialsFiles || [];
        const hasFiles = files.length > 0 ? files.length + '个文件' : '';

        card.innerHTML = `
            <span class="task-type-badge ${t.cls}"><i class="fas ${t.icon}"></i> ${task.type}</span>
            <div class="task-info">
                <h4>${task.subject} ${hasFiles ? '<span style="font-size:0.7rem;font-weight:400;color:var(--primary-400);background:var(--primary-50);padding:1px 8px;border-radius:4px;margin-left:6px;"><i class="fas fa-paperclip"></i> '+hasFiles+'</span>' : ''}</h4>
                <p>${task.description || '无描述'}</p>
            </div>
            <div class="task-deadline ${urgent ? 'urgent' : ''}">
                ${deadlineStr} ${left >= 0 ? `（${left === 0 ? '今天截止！' : left + '天后'}）` : '（已截止）'}
            </div>
            <button class="task-delete" data-id="${task.id}" title="删除"><i class="fas fa-times"></i></button>
        `;
        card.querySelector('.task-delete').addEventListener('click', () => deleteTask(task.id));
        // Double click to edit
        card.addEventListener('dblclick', () => openEditModal(task.id));
        el.taskList.appendChild(card);
    });
}

function addTask(data) {
    const task = { id: uid(), ...data };
    state.tasks.push(task);
    saveState();
    renderTaskList();
    showToast('任务已添加', 'success');
}

function updateTask(id, data) {
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx === -1) return;
    state.tasks[idx] = { ...state.tasks[idx], ...data };
    saveState();
    renderTaskList();
    showToast('任务已更新', 'success');
}

function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState();
    renderTaskList();
    showToast('任务已删除');
}

// ===================== MODAL =====================
function openAddModal() {
    state.editId = null;
    state.currentModalFiles = [];
    el.modalTitle.textContent = '添加任务';
    el.taskSubject.value = '';
    document.querySelector('input[name="taskType"]:checked') || (document.querySelector('input[name="taskType"]').checked = true);
    el.taskDeadline.value = '';
    el.taskDescription.value = '';
    el.taskMaterials.value = '';
    renderFileList();
    el.taskModal.classList.add('active');
    setTimeout(() => el.taskSubject.focus(), 100);
}

function openEditModal(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    state.editId = id;
    state.currentModalFiles = (task.materialsFiles || []).map(f => ({ ...f }));
    el.modalTitle.textContent = '编辑任务';
    el.taskSubject.value = task.subject;
    const radio = document.querySelector(`input[name="taskType"][value="${task.type}"]`);
    if (radio) radio.checked = true;
    el.taskDeadline.value = task.deadline || '';
    el.taskDescription.value = task.description || '';
    el.taskMaterials.value = task.materials || '';
    renderFileList();
    el.taskModal.classList.add('active');
}

function closeModal() {
    el.taskModal.classList.remove('active');
    state.editId = null;
    state.currentModalFiles = [];
}

function saveModal() {
    const subject = el.taskSubject.value.trim();
    const type = document.querySelector('input[name="taskType"]:checked');
    const deadline = el.taskDeadline.value;
    const description = el.taskDescription.value.trim();
    const materials = el.taskMaterials.value.trim();

    if (!subject) { showToast('请输入科目名称', 'error'); el.taskSubject.focus(); return; }
    if (!type) { showToast('请选择任务类型', 'error'); return; }
    if (!deadline) { showToast('请选择截止日期', 'error'); return; }

    const data = {
        subject,
        type: type.value,
        deadline,
        description: description || '',
        materials: materials || '',
        materialsFiles: state.currentModalFiles || []
    };

    if (state.editId) {
        updateTask(state.editId, data);
    } else {
        addTask(data);
    }
    closeModal();
}

// ===================== FILE UPLOAD =====================
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;

function getFileIcon(type) {
    if (type.includes('pdf')) return 'fa-file-pdf';
    if (type.includes('word') || type.includes('doc')) return 'fa-file-word';
    if (type.includes('presentation') || type.includes('ppt')) return 'fa-file-powerpoint';
    if (type.includes('image') || type.includes('png') || type.includes('jpg') || type.includes('jpeg')) return 'fa-file-image';
    if (type.includes('zip') || type.includes('rar') || type.includes('7z')) return 'fa-file-archive';
    if (type.includes('text') || type.includes('txt') || type.includes('md')) return 'fa-file-alt';
    return 'fa-file';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

function renderFileList() {
    el.fileList.innerHTML = '';
    if (state.currentModalFiles.length === 0) {
        el.fileList.style.display = 'none';
        return;
    }
    el.fileList.style.display = 'flex';
    state.currentModalFiles.forEach((file, idx) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `
            <i class="fas ${getFileIcon(file.type)} file-icon"></i>
            <div class="file-info">
                <div class="file-name"><i class="fas fa-paperclip" style="font-size:0.65rem;color:var(--neutral-400);margin-right:4px;"></i>${file.name}</div>
                <div class="file-size">${formatFileSize(file.size)}</div>
            </div>
            <button class="file-remove" data-idx="${idx}" title="移除文件"><i class="fas fa-times"></i></button>
        `;
        div.querySelector('.file-remove').addEventListener('click', () => {
            state.currentModalFiles.splice(idx, 1);
            renderFileList();
        });
        el.fileList.appendChild(div);
    });
}

function handleFiles(files) {
    Array.from(files).forEach(file => {
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            showToast(`文件 "${file.name}" 超过2MB限制`, 'error');
            return;
        }
        // Check file count
        if (state.currentModalFiles.length >= MAX_FILES) {
            showToast(`最多上传${MAX_FILES}个文件`, 'error');
            return;
        }
        // Check for duplicates
        if (state.currentModalFiles.some(f => f.name === file.name && f.size === file.size)) {
            showToast(`文件 "${file.name}" 已存在`, 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            state.currentModalFiles.push({
                id: uid(),
                name: file.name,
                size: file.size,
                type: file.type || 'application/octet-stream',
                data: e.target.result
            });
            renderFileList();
            showToast(`已添加：${file.name}`, 'success');
        };
        reader.onerror = function() {
            showToast(`读取文件失败：${file.name}`, 'error');
        };
        reader.readAsDataURL(file);
    });
}

// ===================== PLANNING GENERATOR =====================
// Generates structured plans from user tasks

function generateAll() {
    if (state.tasks.length === 0) return;
    state.generated.schedule = generateSchedule();
    state.generated.homework = generateHomework();
    state.generated.knowledge = generateKnowledge();
    state.generated.presentation = generatePresentation();
}

function generateSchedule() {
    const tasks = [...state.tasks].sort((a, b) => (a.deadline || '9999') > (b.deadline || '9999') ? 1 : -1);
    const days = [];

    // Determine date range
    const today = getToday();
    const deadlines = tasks.map(t => t.deadline).filter(Boolean).sort();
    const endDate = deadlines[deadlines.length - 1] || addDays(today, 14);
    const totalDays = Math.min(diffDays(today, endDate), 30);

    if (totalDays <= 0) {
        // Already past deadline - just create 7 days plan
        for (let i = 0; i < 7; i++) {
            const date = addDays(today, i);
            days.push({ date, weekday: getWeekday(date), items: [] });
        }
    } else {
        for (let i = 0; i <= totalDays && days.length < 21; i++) {
            const date = addDays(today, i);
            days.push({ date, weekday: getWeekday(date), items: [] });
        }
    }

    // Assign tasks to days
    tasks.forEach(task => {
        const left = daysUntil(task.deadline);
        const isUrgent = left <= 5 && left >= 0;

        // Find which day to place this task
        let placed = false;
        for (let i = 0; i < days.length; i++) {
            const d = days[i];
            const dLeft = daysUntil(d.date);
            if (dLeft < 0) continue; // skip past days

            // Urgent tasks need earlier slots
            if (isUrgent && i <= 2 && dLeft >= 0) {
                days[i].items.push({
                    subject: task.subject,
                    type: task.type,
                    detail: '【紧急】' + (task.description || task.subject) + ' - 优先处理'
                });
                placed = true;
                break;
            }
        }
        if (!placed) {
            // Place proportionally by deadline
            for (let i = 0; i < days.length; i++) {
                const d = days[i];
                const dLeft = daysUntil(d.date);
                if (dLeft < 0) continue;
                const ratio = dLeft / (daysUntil(deadlines[deadlines.length-1] || task.deadline) || 1);
                if (ratio < 0.3 || i === 0) {
                    days[i].items.push({
                        subject: task.subject,
                        type: task.type,
                        detail: task.description || task.subject + ' - 开始准备'
                    });
                    break;
                }
            }
        }
    });

    // Add break/review items to fill gaps
    days.forEach(day => {
        if (day.items.length === 0) {
            day.items.push({ subject: '自习', type: '复习', detail: '自由复习 / 休息调整' });
        }
        // Add a review item
        day.items.push({ subject: '复习巩固', type: '总结', detail: '回顾当日所学内容' });
    });

    return days;
}

function generateHomework() {
    const hwTasks = state.tasks.filter(t => t.type === '作业');
    if (hwTasks.length === 0) {
        return [{
            subject: '暂无作业任务',
            content: '你目前没有添加作业类型的任务。可在上一步修改任务分类。'
        }];
    }
    return hwTasks.map(task => {
        const fullContent = generateFullHomework(task);
        return {
            subject: task.subject,
            desc: task.description,
            deadline: task.deadline,
            sections: fullContent
        };
    });
}

function generateFullHomework(task) {
    const desc = (task.description || '').toLowerCase();
    const subj = task.subject;
    // More nuanced detection
    const isThesis = /论文|作文|文章|essay|报告|综述/.test(desc);
    const isCode = /编程|代码|程序|项目|开发|系统|软件|website|app/.test(desc) || /c[+＋+]{1,2}|java|python|javascript|html/.test(desc);
    const isExercise = /习题|练习|作业题|计算题|证明题/.test(desc);

    if (isThesis) return generateEssay(task);
    if (isCode) return generateCode(task);
    if (isExercise) return generateExercise(task);
    // Default: generate based on subject
    return generateGeneralHomework(task);
}

function generateEssay(task) {
    const topic = task.description || task.subject + '相关主题';
    return [
        { type: 'title', content: `${topic} —— 研究报告` },
        { type: 'section', title: '摘要', content: `本文围绕"${topic}"展开系统研究，旨在探讨其核心内涵、发展现状与未来趋势。通过文献调研与理论分析，本文从多个维度对该主题进行了深入剖析，并提出了具有建设性的观点与建议。研究发现，${topic}在当代学术与实践领域中具有重要意义，但同时也面临着一系列挑战。本文的研究成果可为后续相关研究提供参考。` },
        { type: 'section', title: '一、引言', content: `${topic}作为一个兼具理论价值与现实意义的研究课题，近年来受到广泛关注。本研究的目的是系统梳理该领域的研究现状，分析存在的问题，并探索可能的解决路径。本文采用文献研究法、案例分析法和比较研究法，力求全面、客观地呈现该主题的全貌。` },
        { type: 'section', title: '二、核心概念与理论基础', content: `首先需要明确${topic}的基本概念与范畴。在已有的研究文献中，不同学者对这一概念有着不同的界定方式。本文在综合各家观点的基础上，将其界定为……（此处根据你的教材与课堂笔记补充具体定义）。该领域的主要理论基础包括……（列出相关理论），这些理论为我们理解和分析${topic}提供了重要的分析框架。` },
        { type: 'section', title: '三、现状分析与问题探讨', content: `当前，${topic}领域的研究与实践呈现出以下特点：第一……（结合你的资料补充）。第二……（补充第二点）。然而，在快速发展的同时也暴露出一些突出问题：①……（问题一）；②……（问题二）；③……（问题三）。这些问题在一定程度上制约了该领域的进一步发展。` },
        { type: 'section', title: '四、案例分析', content: `为了更具体地说明上述问题，本文选取了以下典型案例进行分析：（此处请根据你的讲义或教材补充1-2个具体案例）。通过对这些案例的深入剖析，我们可以更清晰地看到${topic}在实际应用中的表现与挑战。` },
        { type: 'section', title: '五、对策与建议', content: `针对上述问题，本文提出以下建议：第一，完善相关理论体系，加强基础研究；第二，推动跨学科融合，借鉴其他领域的先进经验；第三，加强实践探索，鼓励创新性应用。这些建议的落实需要多方力量的协同配合。` },
        { type: 'section', title: '六、结论', content: `本文从多角度对${topic}进行了系统研究，梳理了其发展脉络，分析了现存问题并提出了改进建议。本研究仍然存在一定局限性，如样本范围有限、数据获取不够全面等，未来研究可在这些方面进一步深化。` },
        { type: 'refs', content: `[1] 请补充第一条参考文献\n[2] 请补充第二条参考文献\n[3] 请补充第三条参考文献\n（提示：请根据你实际使用的参考资料替换上述引用）` }
    ];
}

function generateCode(task) {
    const subj = task.subject;
    const lang = /java/i.test(task.description) ? 'Java' : /python/i.test(task.description) ? 'Python' : /javascript|js/i.test(task.description) ? 'JavaScript' : /c[+＋+]{1,2}/i.test(task.description) ? 'C++' : 'Python';
    return [
        { type: 'title', content: `${task.description || subj + '编程作业'} —— 完整代码实现` },
        { type: 'code', lang: lang, content: getCodeSample(lang, task) },
        { type: 'section', title: '📋 代码说明', content: `以上代码实现了${task.description || subj + '的相关功能'}。程序采用${lang}语言编写，遵循模块化设计原则，主要包含以下核心模块：数据输入模块、逻辑处理模块、结果输出模块。代码结构清晰，关键部分已添加注释便于理解。` },
        { type: 'section', title: '🔧 使用方法', content: `1. 确保已安装${lang}运行环境\n2. 将代码复制到文件（如 main.${lang === 'Python' ? 'py' : lang === 'Java' ? 'java' : lang === 'JavaScript' ? 'js' : 'cpp'}）\n3. ${lang === 'Python' ? '运行: python main.py' : lang === 'Java' ? '编译: javac main.java\n   运行: java main' : lang === 'JavaScript' ? '在浏览器控制台或 Node.js 中运行' : '编译: g++ main.cpp -o main\n   运行: ./main'}\n4. 按提示输入相关数据即可查看结果` },
        { type: 'section', title: '⚠️ 注意事项', content: `• 请根据实际题目要求调整输入输出格式\n• 建议增加边界条件测试以确保程序健壮性\n• 代码中预留了扩展接口，可根据需要添加功能\n• 如果题目有特定的输入格式要求，请相应调整 input() 或 Scanner 部分` }
    ];
}

function getCodeSample(lang, task) {
    const desc = task.description || '';
    if (lang === 'Python') {
        return `# -*- coding: utf-8 -*-
# ${task.subject} - ${desc || '编程作业'}
# 实现功能：根据题目要求实现核心逻辑

def main():
    print("=" * 50)
    print("  ${task.subject} - 编程作业")
    print("=" * 50)

    # ===== 数据输入 =====
    print("\\n【数据输入】")
    try:
        n = int(input("请输入数据量: "))
        data = []
        for i in range(n):
            val = float(input(f"请输入第{i+1}个数据: "))
            data.append(val)
    except ValueError:
        print("输入格式错误，请确保输入有效数字！")
        return

    # ===== 核心处理 =====
    print("\\n【处理结果】")
    result = process_data(data)

    # ===== 结果输出 =====
    print("\\n【输出结果】")
    print(f"处理结果: {result}")
    print("\\n程序执行完毕！")

def process_data(data):
    """核心处理函数 - 请根据题目要求修改此函数"""
    if not data:
        return "无数据"
    # 示例：计算平均值
    # （请替换为题目要求的实际逻辑）
    total = sum(data)
    avg = total / len(data)
    return {
        "total": total,
        "avg": round(avg, 2),
        "max": max(data),
        "min": min(data),
        "count": len(data)
    }

if __name__ == "__main__":
    main()`;
    } else if (lang === 'Java') {
        return `import java.util.*;

public class Main {
    public static void main(String[] args) {
        System.out.println("=" .repeat(50));
        System.out.println("  ${task.subject} - 编程作业");
        System.out.println("=" .repeat(50));

        Scanner scanner = new Scanner(System.in);

        // ===== 数据输入 =====
        System.out.println("\\n【数据输入】");
        System.out.print("请输入数据量: ");
        int n = scanner.nextInt();
        double[] data = new double[n];
        for (int i = 0; i < n; i++) {
            System.out.print("请输入第" + (i+1) + "个数据: ");
            data[i] = scanner.nextDouble();
        }

        // ===== 核心处理 =====
        System.out.println("\\n【处理结果】");
        Map<String, Object> result = processData(data);

        // ===== 结果输出 =====
        System.out.println("\\n【输出结果】");
        System.out.println("处理结果: " + result);
        System.out.println("\\n程序执行完毕！");

        scanner.close();
    }

    public static Map<String, Object> processData(double[] data) {
        // 请根据题目要求修改此函数
        double total = 0;
        double max = data[0];
        double min = data[0];
        for (double v : data) {
            total += v;
            if (v > max) max = v;
            if (v < min) min = v;
        }
        double avg = total / data.length;
        Map<String, Object> result = new HashMap<>();
        result.put("total", total);
        result.put("avg", Math.round(avg * 100.0) / 100.0);
        result.put("max", max);
        result.put("min", min);
        result.put("count", data.length);
        return result;
    }
}`;
    } else {
        return `// ${task.subject} - ${desc || '编程作业'}
// 请根据具体要求修改此代码

#include <iostream>
#include <vector>
#include <algorithm>
#include <numeric>
using namespace std;

struct Result {
    double total;
    double avg;
    double maxVal;
    double minVal;
    int count;
};

Result processData(const vector<double>& data) {
    // 请根据题目要求修改此函数
    Result r;
    r.total = accumulate(data.begin(), data.end(), 0.0);
    r.avg = r.total / data.size();
    r.maxVal = *max_element(data.begin(), data.end());
    r.minVal = *min_element(data.begin(), data.end());
    r.count = data.size();
    return r;
}

int main() {
    cout << string(50, '=') << endl;
    cout << "  ${task.subject} - 编程作业" << endl;
    cout << string(50, '=') << endl;

    // 数据输入
    cout << "\\n【数据输入】" << endl;
    int n;
    cout << "请输入数据量: ";
    cin >> n;
    vector<double> data(n);
    for (int i = 0; i < n; i++) {
        cout << "请输入第" << (i+1) << "个数据: ";
        cin >> data[i];
    }

    // 核心处理
    cout << "\\n【处理结果】" << endl;
    Result result = processData(data);

    // 结果输出
    cout << "\\n【输出结果】" << endl;
    cout << "总和: " << result.total << endl;
    cout << "平均: " << result.avg << endl;
    cout << "最大: " << result.maxVal << endl;
    cout << "最小: " << result.minVal << endl;
    cout << "个数: " << result.count << endl;
    cout << "\\n程序执行完毕！" << endl;

    return 0;
}`;
    }
}

function generateExercise(task) {
    return [
        { type: 'title', content: `${task.description || task.subject + '习题作业'} —— 完整解答` },
        { type: 'section', title: '📝 解题过程', content: '以下是对各题目的详细解答过程，包含步骤推导和最终结果。' },
        { type: 'qa', q: '题目1（基础题）', a: `【解】\n步骤1：分析题意，确定已知条件和待求量。\n步骤2：根据相关定理/公式列出方程。\n步骤3：代入数据并计算。\n步骤4：验证结果的合理性。\n\n答案：（请根据你的教材补充具体数字结果）\n\n⚠️ 提示：请根据你的教材或讲义中的具体题目替换上述内容。` },
        { type: 'qa', q: '题目2（综合题）', a: `【解】\n首先，我们需要将题目中的信息转化为数学模型。设……（根据题目条件设未知数）。\n由题意可得方程：……（列出方程或不等式）。\n求解得：……（给出求解过程）。\n\n答案：（请根据你的教材补充具体结果）\n\n⚠️ 提示：解完后建议代入原题验证。` },
        { type: 'qa', q: '题目3（提高题）', a: `【解】\n本题需要综合运用多个知识点。\n第一步：……（分析条件）。\n第二步：……（应用核心定理/公式）。\n第三步：……（计算并得出结论）。\n\n答案：（请根据你的教材补充具体结果）\n\n💡 思路提示：遇到这类综合题时，建议先画出思维导图，理清各知识点之间的关系。` },
        { type: 'section', title: '📌 错题总结', content: '在做题过程中应注意以下几点：\n1. 审题要仔细，注意题目中的关键条件和限定词\n2. 计算过程要规范，避免粗心导致的失误\n3. 解题后最好换一种方法验证答案的合理性\n4. 将错题整理到错题本，定期复习' }
    ];
}

function generateGeneralHomework(task) {
    const subj = task.subject;
    const topic = task.description || subj + '相关作业';
    return [
        { type: 'title', content: `${subj} —— ${topic}` },
        { type: 'section', title: '一、核心概念梳理', content: `本章节的核心概念主要包括：${subj}的基本定义、主要特征、分类体系以及与其他相关概念的区别与联系。在理解这些概念时，需要注意以下几点：\n\n1. 概念的内涵与外延\n2. 概念之间的逻辑关系\n3. 概念在实际问题中的应用场景\n\n建议结合教材第X章进行深入学习。` },
        { type: 'section', title: '二、重点内容分析', content: `在${subj}的学习中，以下内容是本次作业的重点：\n\n（一）……（请补充第一个重点内容）\n这是该科目的核心知识点，需要掌握其基本原理和应用方法。\n\n（二）……（请补充第二个重点内容）\n这部分内容较为抽象，建议结合实际案例理解。\n\n（三）……（请补充第三个重点内容）\n这是考试中的常见考点，务必熟练掌握。` },
        { type: 'section', title: '三、知识拓展与应用', content: `将理论知识应用于实际问题，是学习${subj}的重要目的。以下是几个拓展思考方向：\n\n• 方向一：……（结合实际场景的思考题）\n• 方向二：……（跨章节的综合应用）\n• 方向三：……（与前沿发展的联系）\n\n建议与同学讨论，拓宽思路。` },
        { type: 'section', title: '四、自我检测', content: `完成作业后，可以通过以下问题检验自己的掌握程度：\n\n✅ 我是否理解所有核心概念？\n✅ 我是否能独立推导重要公式/定理？\n✅ 我是否能将所学知识应用到新情境中？\n✅ 我是否能清楚地向别人解释这些内容？\n\n如果有回答"否"的地方，建议回顾教材相关内容并做针对性的练习。` },
        { type: 'refs', content: `参考资料：\n• 《${subj}》教材第X章至第X章\n• 课堂笔记与课件\n• （请补充你实际使用的参考资料）` }
    ];
}

function generateKnowledge() {
    const examTasks = state.tasks.filter(t => t.type === '考试');
    if (examTasks.length === 0) {
        return [{
            subject: '暂无考试任务',
            chapters: [{ name: '提示', points: ['你目前没有添加考试类型的任务。可在上一步修改任务分类。'], tips: [] }]
        }];
    }
    return examTasks.map(task => {
        const chs = generateChapters(task);
        return { subject: task.subject, desc: task.description, chapters: chs };
    });
}

function generateChapters(task) {
    const subj = task.subject;
    const knownChapters = {
        '高等数学': [
            { name: '函数与极限', points: ['ε-δ语言理解函数极限', '夹逼准则与两个重要极限', '无穷小/无穷大的比较', '函数的连续性与间断点类型'], tips: ['重要极限公式必须熟记', '间断点判断是常考题'] },
            { name: '导数与微分', points: ['导数的定义与几何意义', '基本求导公式与法则', '隐函数/参数方程求导', '高阶导数'], tips: ['复合函数求导链式法则易错', '微分中值定理证明题是难点'] },
            { name: '积分学', points: ['不定积分的换元法与分部法', '定积分的计算与性质', '定积分在几何中的应用（面积/体积）', '广义积分收敛性判断'], tips: ['换元法注意变量替换后积分限变化', '旋转体体积公式要分清绕x/y轴'] },
            { name: '微分方程', points: ['一阶微分方程（可分离/齐次/线性）', '二阶常系数齐次线性方程', '特解求法'], tips: ['注意通解中任意常数的个数', '初始条件代入确定特解'] },
            { name: '级数', points: ['数项级数的收敛性判断（比值/根值/积分判别法）', '幂级数的收敛半径与收敛域', '函数的幂级数展开'], tips: ['比值判别法最常用但注意失效情况', '收敛域端点要单独判断'] }
        ],
        '线性代数': [
            { name: '行列式与矩阵', points: ['行列式的性质与计算', '矩阵的运算与逆矩阵', '矩阵的秩'], tips: ['行列式按行/列展开是核心方法', '初等变换求逆需熟练'] },
            { name: '线性方程组', points: ['齐次/非齐次线性方程组解的结构', '解的存在性判断（秩判定）', '基础解系与通解'], tips: ['自由变量的选取要规范', '解的结构证明题要理解逻辑链条'] },
            { name: '特征值与特征向量', points: ['特征多项式与特征值求解', '特征向量的性质', '矩阵对角化的条件与步骤', '实对称矩阵的对角化'], tips: ['重特征值对应的特征向量个数易错', '施密特正交化是常考计算题'] }
        ],
        '概率论与数理统计': [
            { name: '概率基础', points: ['古典概型与几何概型', '条件概率与全概率公式', '贝叶斯公式', '事件独立性'], tips: ['全概率公式找完备事件组是关键', '贝叶斯常与全概率结合考大题'] },
            { name: '随机变量', points: ['离散型（0-1/二项/泊松）', '连续型（均匀/指数/正态）', '分布函数与概率密度', '随机变量函数的分布'], tips: ['正态分布的标准化变换要熟练', '泊松分布逼近二项分布的条件'] },
            { name: '数字特征', points: ['数学期望的定义与性质', '方差与标准差', '协方差与相关系数', '大数定律与中心极限定理'], tips: ['方差公式D(X)=E(X²)-[E(X)]²常用', '中心极限定理用于近似计算'] }
        ]
    };

    if (knownChapters[subj]) {
        return knownChapters[subj];
    }

    // Generate generic chapters based on description
    const desc = task.description || '';
    if (desc) {
        const words = desc.replace(/[，。、；：？！]/g, ' ').split(/\s+/).filter(w => w.length >= 2);
        const chapters = words.slice(0, 4).map((w, i) => ({
            name: `第${i+1}部分：${w}`,
            points: [`掌握${w}的基本概念与定义`, `理解${w}的核心原理`, `${w}的典型计算/分析方法`, `${w}的常见考试题型`],
            tips: ['建议结合教材例题理解', '课后习题是重点练习方向']
        }));
        if (chapters.length > 0) return chapters;
    }

    return [
        { name: '基础知识', points: ['掌握基本概念和定义', '理解核心定理和公式', '熟悉常见题型和解题方法'], tips: ['重点关注教材中标注的定义和定理'] },
        { name: '重点章节', points: ['梳理各章节知识框架图', '标记重难点和易混淆概念', '整理典型例题和解题模板'], tips: ['建议用思维导图整理知识体系'] },
        { name: '综合应用', points: ['跨章节综合题的解题策略', '实际问题的建模与求解', '历年真题的命题规律分析'], tips: ['先做真题再针对薄弱环节强化训练'] }
    ];
}

function generatePresentation() {
    const preTasks = state.tasks.filter(t => t.type === 'Pre');
    if (preTasks.length === 0) {
        return [{
            subject: '暂无Pre任务',
            slides: [{ num: 1, title: '提示', points: ['你目前没有添加Pre类型的任务。可以在上一步修改任务分类。'], speech: '建议在任务中添加Pre类型，即可自动生成PPT大纲和演讲稿。' }]
        }];
    }
    return preTasks.map(task => {
        const slides = generateSlides(task);
        return { subject: task.subject, desc: task.description, slides };
    });
}

function generateSlides(task) {
    const topic = task.description || task.subject;
    const subj = task.subject;
    const todayStr = formatDate(getToday());
    return [
        {
            num: 1, title: `${topic}`,
            subtitle: `${subj} · 课程展示`,
            points: [`汇报人：_______________`, `学　号：_______________`, `日　期：${todayStr}`],
            speech: `尊敬的老师、亲爱的同学们，大家好！今天我为大家带来的展示主题是《${topic}》。在接下来的${Math.floor(Math.random() * 5 + 10)}分钟里，我将围绕${subj}的相关内容，从背景、核心理论、案例分析和实践应用等多个维度进行分享。希望我的展示能帮助大家更好地理解和掌握这一主题。`
        },
        {
            num: 2, title: '展示目录',
            points: ['1. 选题背景与研究意义', '2. 核心概念与理论基础', '3. 重点内容深度剖析', '4. 典型案例分析', '5. 实践应用与拓展思考', '6. 总结回顾与展望', '7. 互动交流环节'],
            speech: `今天的展示主要分为七个部分。首先我会介绍选题的背景和研究意义，然后梳理核心概念和理论基础，接着对重点内容进行深度剖析，通过具体的案例来帮助大家理解，最后进行总结并欢迎大家提问交流。`
        },
        {
            num: 3, title: '一、选题背景与研究意义',
            points: [
                `为什么选择"${topic}"作为展示主题？`,
                '该主题在学科中的地位和作用',
                '当前研究/实践的发展现状',
                '本展示要解决的核心问题'
            ],
            speech: `首先来看选题背景。"${topic}"在${subj}的学习中占据着重要地位。随着……（结合你的课程内容补充）的发展，这一主题越来越受到关注。本次展示的目的是帮助大家系统理解这一主题的核心内容，并探讨其在实际中的应用价值。`
        },
        {
            num: 4, title: '二、核心概念与理论基础',
            points: [
                `${topic}的核心定义与内涵`,
                '主要理论框架梳理',
                '关键术语解释',
                '理论之间的逻辑关系'
            ],
            speech: `接下来进入核心概念部分。要理解${topic}，首先需要明确它的基本定义。根据教材第X章的阐述，${topic}是指……（引用教材定义）。围绕着这一定义，我们需要掌握以下几个关键理论……（列出2-3个核心理论）。这些理论相互联系，共同构成了理解该主题的知识框架。`
        },
        {
            num: 5, title: '三、重点内容深度剖析（上）',
            points: [
                '核心要点一：……（请补充）',
                '核心要点二：……（请补充）',
                '核心要点三：……（请补充）',
                '各要点之间的关联与区别'
            ],
            speech: `现在我们来深入分析${topic}的核心要点。首先来看第一个要点……（根据你的教材展开）。这部分的内容比较抽象，我建议大家结合图例来理解。接下来是第二个要点……（继续展开）。这部分与前面讲的内容有着密切的联系，可以对比记忆。`
        },
        {
            num: 6, title: '三、重点内容深度剖析（下）',
            points: [
                '难点一：常见错误与易混淆点',
                '难点二：解题/分析中的关键技巧',
                '难点三：综合性问题的应对策略',
                '【易错提醒】特别需要注意的地方'
            ],
            speech: `接下来我们继续分析，这部分主要聚焦在难点和易错点上。在学习${topic}时，同学们容易在以下几个方面出错……（列举1-2个典型错误）。针对这些问题，我建议大家采用以下方法……（给出应对策略）。请特别注意我标注的易错提醒部分，考试中经常会考到。`
        },
        {
            num: 7, title: '四、典型案例分析',
            points: [
                '案例背景介绍',
                '问题描述与分析',
                '解决方案/思路',
                '案例启示与思考'
            ],
            speech: `理论需要联系实际。下面我们来看一个具体案例。（此处请根据你的教材或讲义补充1-2个案例）。通过这个案例我们可以发现，${topic}在实际中的应用非常广泛。这个案例给我们的启示是……（总结案例启示）。希望大家在今后的学习中也能举一反三。`
        },
        {
            num: 8, title: '五、实践应用与拓展思考',
            points: [
                '该主题在前沿领域的应用',
                '与其他学科的交叉融合',
                '未来发展趋势',
                '值得进一步探索的方向'
            ],
            speech: `让我们把视野拓宽，看看${topic}在更广泛领域的应用。当前，这一主题在……（补充应用领域）中发挥着重要作用。未来，随着……的发展，${topic}将会朝着……（补充趋势）方向演进。对此，我们可以进一步思考……（提出思考题）。这部分内容也可能会出现在考试的综合题中。`
        },
        {
            num: 9, title: '六、总结回顾与展望',
            points: [
                '本次展示核心要点回顾',
                '主要结论与收获',
                '对后续学习的建议',
                '参考资料与延伸阅读'
            ],
            speech: `最后来进行总结。今天我们围绕"${topic}"，从背景、概念、重点、案例和应用五个维度进行了系统梳理。希望通过今天的展示，大家对这一主题有了更全面、更深入的理解。后续学习中，建议重点复习：①……（列出1-2个重点）；②……（列出1-2个重点）。推荐的参考资料包括教材第X章、……（补充参考资料）。`
        },
        {
            num: 10, title: '七、互动交流环节',
            points: [
                '💡 核心观点回顾',
                '❓ 欢迎大家提问',
                '📢 感谢聆听',
                '🙏 请老师批评指正'
            ],
            speech: `以上就是我今天的全部展示内容。再次感谢大家的聆听！如果对我的展示有任何疑问或建议，欢迎随时提出。同时，也恳请老师批评指正，帮助我进一步完善和提高。谢谢大家！`
        }
    ];
}

// ===================== DASHBOARD RENDER =====================
function renderDashboard() {
    el.dashUserName.textContent = state.user.name || '同学';
    el.dashDate.textContent = `📅 生成日期：${formatDate(getToday())}  |  📚 共 ${state.tasks.length} 个任务`;

    renderDashStats();

    renderSchedule();
    renderHomework();
    renderKnowledge();
    renderPresentation();

    // Activate first tab
    switchTab('schedule', false);
}

function getSchedKey(date, idx) { return date + '_' + idx; }

/* ========== CELEBRATION EFFECT ========== */
function celebrateComplete(taskName) {
    // Create container
    const container = document.createElement('div');
    container.className = 'celebration-container';
    document.body.appendChild(container);

    // Flash effect
    const flash = document.createElement('div');
    flash.className = 'celebration-flash';
    document.body.appendChild(flash);

    // Text
    const text = document.createElement('div');
    text.className = 'celebration-text';
    text.innerHTML = '🎉 太棒了！<br>' + (taskName || '任务完成') + ' ✓';
    document.body.appendChild(text);

    // Ice tea image in celebration
    const iceImg = document.createElement('img');
    iceImg.src = 'images/icetea.jpg';
    iceImg.className = 'celebration-ice';
    document.body.appendChild(iceImg);

    // Confetti colors
    const colors = ['#6366f1','#ec4899','#06b6d4','#f59e0b','#10b981','#a855f7','#ef4444','#22d3ee','#f472b6','#34d399'];

    // Generate confetti pieces
    const count = 80 + Math.floor(Math.random() * 40);
    for (let i = 0; i < count; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = 6 + Math.floor(Math.random() * 8);
        const left = Math.random() * 100;
        const duration = 1.5 + Math.random() * 2;
        const delay = Math.random() * 0.5;
        const rotate = Math.random() * 720;
        const shapes = ['50%', '2px', '0'];
        piece.style.cssText = `
            left: ${left}%;
            width: ${size}px;
            height: ${size * (0.6 + Math.random() * 0.8)}px;
            background: ${color};
            border-radius: ${shapes[Math.floor(Math.random() * 3)]};
            animation-duration: ${duration}s;
            animation-delay: ${delay}s;
            transform: rotate(${rotate}deg);
        `;
        container.appendChild(piece);
    }

    // Cleanup
    setTimeout(() => {
        if (container.parentNode) container.parentNode.removeChild(container);
        if (flash.parentNode) flash.parentNode.removeChild(flash);
        if (text.parentNode) text.parentNode.removeChild(text);
        if (iceImg.parentNode) iceImg.parentNode.removeChild(iceImg);
    }, 3500);
}

/* ========== DASHBOARD STATS ========== */
function renderDashStats() {
    const total = state.tasks.length;
    let completedCount = 0;
    state.tasks.forEach(t => {
        const key = getSchedKey(t.deadline || 'unknown', state.tasks.indexOf(t));
        if (state.scheduleCompletion[key]) completedCount++;
    });
    const remaining = total - completedCount;
    const remainColor = remaining === 0 ? 'var(--success)' : remaining <= 3 ? 'var(--error)' : 'var(--neutral-600)';
    el.dashStats.innerHTML = `
        <div class="dash-stat"><div class="dash-stat-num">${total}</div><div class="dash-stat-label">总任务数</div></div>
        <div class="dash-stat"><div class="dash-stat-num" style="color:var(--success)">${completedCount}</div><div class="dash-stat-label">✅ 已完成</div></div>
        <div class="dash-stat"><div class="dash-stat-num" style="color:${remainColor}">${remaining}</div><div class="dash-stat-label">⏳ 待完成</div></div>
    `;
}

/* ========== DEADLINE CALENDAR ========== */
function renderSchedule() {
    const tasks = state.tasks;
    if (!tasks || tasks.length === 0) {
        el.schedContent.innerHTML = '<p style="color:var(--neutral-400);text-align:center;padding:40px;">暂无任务数据，请先添加任务。</p>';
        return;
    }

    const today = getToday();

    // Group tasks by deadline date
    const deadlineMap = {};
    tasks.forEach(t => {
        const d = t.deadline || '未知';
        if (!deadlineMap[d]) deadlineMap[d] = [];
        deadlineMap[d].push(t);
    });

    // Build sorted date range (today → last deadline)
    const allDeadlines = Object.keys(deadlineMap).filter(d => d !== '未知').sort();
    const lastDeadline = allDeadlines.length > 0 ? allDeadlines[allDeadlines.length - 1] : addDays(today, 14);
    const rangeEnd = lastDeadline > addDays(today, 30) ? addDays(today, 30) : lastDeadline;
    const days = [];
    for (let d = today; d <= rangeEnd; d = addDays(d, 1)) {
        days.push(d);
        if (days.length >= 21) break;
    }

    // Apply filter
    let filteredDates = days;
    if (state.scheduleFilter === 'today') {
        filteredDates = [today];
    } else if (state.scheduleFilter === 'week') {
        const weekLater = addDays(today, 7);
        filteredDates = days.filter(d => d <= weekLater);
    }

    // Count total & done
    let totalTasks = 0, doneTasks = 0;
    filteredDates.forEach(d => {
        const dayTasks = deadlineMap[d] || [];
        dayTasks.forEach((_, i) => { totalTasks++; if (state.scheduleCompletion[getSchedKey(d, i)]) doneTasks++; });
    });

    // Urgency helper
    function getUrgency(dateStr) {
        const left = daysUntil(dateStr);
        if (left < 0) return { color: '#94a3b8', label: '已截止', cls: 'urg-expired' };
        if (left === 0) return { color: '#ef4444', label: '今天截止！', cls: 'urg-today' };
        if (left <= 3) return { color: '#ef4444', label: '还剩' + left + '天', cls: 'urg-hot' };
        if (left <= 7) return { color: '#f59e0b', label: left + '天后', cls: 'urg-warn' };
        return { color: '#10b981', label: left + '天后', cls: 'urg-safe' };
    }

    const typeConfig = {
        '作业': { icon: 'fa-file-alt', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
        '考试': { icon: 'fa-pencil-alt', color: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
        'Pre': { icon: 'fa-chalkboard', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' }
    };

    // ---- Build HTML ----
    let html = `
    <div class="sched-toolbar">
        <div class="sched-filters">
            <button class="sched-filter-btn ` + (state.scheduleFilter === 'all' ? 'active' : '') + `" data-filter="all">全部</button>
            <button class="sched-filter-btn ` + (state.scheduleFilter === 'today' ? 'active' : '') + `" data-filter="today">今天</button>
            <button class="sched-filter-btn ` + (state.scheduleFilter === 'week' ? 'active' : '') + `" data-filter="week">本周</button>
        </div>
        <span class="sched-progress-label">📊 完成 <strong>` + doneTasks + '/' + totalTasks + `</strong>（` + (totalTasks > 0 ? Math.round(doneTasks/totalTasks*100) : 0) + `%）</span>
    </div>
    <div class="ddl-wrap">
        <div class="ddl-header-row">`;

    const weekDays = ['周日','周一','周二','周三','周四','周五','周六'];
    filteredDates.forEach((date, di) => {
        const dLeft = daysUntil(date);
        const shortDate = date.slice(5);
        const isToday = date === today;
        const wd = weekDays[new Date(date).getDay()];
        const dayTasks = deadlineMap[date] || [];
        const urgentCount = dayTasks.filter(t => daysUntil(t.deadline) <= 3 && daysUntil(t.deadline) >= 0).length;

        html += `<div class="ddl-day-header` + (isToday ? ' ddl-today' : '') + (dLeft < 0 ? ' ddl-past' : '') + `">
            <div class="ddl-day-name">` + wd + `</div>
            <div class="ddl-date-num">` + shortDate + `</div>` +
            (isToday ? '<div class="ddl-badge ddl-badge-today">今天</div>' : '') +
            (urgentCount > 0 && !isToday ? '<div class="ddl-badge ddl-badge-urgent">' + urgentCount + '个紧急</div>' : '') +
        `</div>`;
    });

    html += `</div><div class="ddl-body-row">`;

    filteredDates.forEach((date, di) => {
        const dayTasks = deadlineMap[date] || [];
        const isToday = date === today;
        html += `<div class="ddl-day-cell` + (isToday ? ' ddl-today' : '') + `">`;

        if (dayTasks.length === 0) {
            html += `<div class="ddl-empty">-</div>`;
        } else {
            dayTasks.forEach((task, ti) => {
                const key = getSchedKey(date, ti);
                const done = state.scheduleCompletion[key] || false;
                const urg = getUrgency(date);
                const cfg = typeConfig[task.type] || typeConfig['作业'];

                html += `<div class="ddl-card` + (done ? ' ddl-done' : '') + ' ' + urg.cls + `"
                    style="--card-color:` + cfg.color + `"
                    data-key="` + key + `" data-type="` + task.type + `" data-subject="` + task.subject + `"
                    title="点击查看` + task.type + `方案 · 截止` + date + `">
                    <div class="ddl-card-top">
                        <span class="ddl-type-icon" style="background:` + cfg.bg + `;color:` + cfg.color + `">
                            <i class="fas ` + cfg.icon + `"></i> ` + task.type + `
                        </span>
                        <button class="ice-done-btn ` + (done ? 'iced' : '') + `" data-key="` + key + `" title="` + (done ? '已完成' : '点击完成') + `">
                            <img src="images/icetea.jpg" alt="完成">
                            <span class="ice-done-label">` + (done ? '✓' : '完成') + `</span>
                        </button>
                    </div>
                    <div class="ddl-card-title">` + task.subject + `</div>
                    <div class="ddl-card-desc">` + (task.description || '无描述') + `</div>
                    <div class="ddl-card-footer">
                        <span class="ddl-countdown" style="color:` + urg.color + `">
                            <i class="fas fa-clock"></i> ` + urg.label + `
                        </span>
                        <span class="ddl-date">` + date + `</span>
                    </div>
                </div>`;
            });
        }

        html += `</div>`;
    });

    html += `</div></div>`;
    el.schedContent.innerHTML = html;

    // Bind ice tea done buttons
    el.schedContent.querySelectorAll('.ice-done-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const key = this.dataset.key;
            const wasChecked = !this.classList.contains('iced');
            state.scheduleCompletion[key] = wasChecked;
            saveState();
            if (wasChecked) {
                const card = this.closest('.ddl-card');
                const subject = card ? card.dataset.subject : '任务完成';
                celebrateComplete(subject);
            }
            renderSchedule();
            renderDashStats();
        });
    });

    // Bind filter buttons
    el.schedContent.querySelectorAll('.sched-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.scheduleFilter = btn.dataset.filter;
            renderSchedule();
        });
    });

    // Bind card clicks → navigate to solution
    el.schedContent.querySelectorAll('.ddl-card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (e.target.closest('.ice-done-btn')) return;
            const type = this.dataset.type;
            const subject = this.dataset.subject;
            const tabMap = { '作业':'homework', '考试':'knowledge', 'Pre':'presentation' };
            const targetTab = tabMap[type] || 'schedule';
            switchTab(targetTab, true);
            setTimeout(function() { highlightSubject(targetTab, subject); }, 400);
        });
    });
}

function highlightSubject(tab, subject) {
    const container = tab === 'homework' ? el.hwContent : tab === 'knowledge' ? el.knowContent : tab === 'presentation' ? el.preContent : null;
    if (!container) return;
    // Find and scroll to matching section
    const headers = container.querySelectorAll('h4, h5');
    for (const h of headers) {
        if (h.textContent.includes(subject)) {
            h.style.transition = 'background 0.5s';
            h.style.background = 'rgba(99,102,241,0.12)';
            h.style.borderRadius = '8px';
            h.style.padding = '4px 8px';
            h.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { h.style.background = 'transparent'; }, 2000);
            break;
        }
    }
}

function calcProgress() {
    const days = state.generated.schedule || [];
    let total = 0, done = 0;
    days.forEach(day => {
        day.items.forEach((_, idx) => {
            total++;
            if (state.scheduleCompletion[getSchedKey(day.date, idx)]) done++;
        });
    });
    if (total === 0) return '0%';
    const pct = Math.round(done / total * 100);
    return `${done}/${total}（${pct}%）`;
}

/* ========== ANIMATED TAB SWITCHING ========== */
function switchTab(name, animate = true) {
    // Update tab buttons
    el.tabBtns.forEach(b => b.classList.remove('active'));
    const targetBtn = Array.from(el.tabBtns).find(b => b.dataset.tab === name);
    if (targetBtn) targetBtn.classList.add('active');

    // Update panels with animation
    const panels = document.querySelectorAll('.tab-panel');
    panels.forEach(p => {
        const isTarget = p.id === 'tab' + name.charAt(0).toUpperCase() + name.slice(1);
        if (isTarget) {
            if (animate) {
                p.classList.remove('active');
                void p.offsetWidth; // reflow
                p.style.animation = 'none';
                void p.offsetWidth;
                p.style.animation = '';
                p.classList.add('active');
            } else {
                p.classList.add('active');
            }
        } else {
            p.classList.remove('active');
        }
    });
}

function renderHomework() {
    const data = state.generated.homework;
    if (!data || data.length === 0) {
        el.hwContent.innerHTML = '<p style="color:var(--neutral-400);text-align:center;padding:40px;">暂无作业任务。如有需要，请在上一页添加作业类型的任务。</p>';
        return;
    }
    let html = '';
    data.forEach(hw => {
        html += `<div class="hw-paper">`;
        html += `<div class="hw-header"><h4><i class="fas fa-file-alt" style="color:var(--primary-500);margin-right:8px;"></i>${hw.subject}</h4>`;
        if (hw.desc) html += `<p style="color:var(--neutral-500);font-size:0.88rem;">📌 ${hw.desc}${hw.deadline ? ' | 截止：'+formatDate(hw.deadline) : ''}</p>`;
        html += `</div><div class="hw-body">`;
        (hw.sections || []).forEach(sec => {
            if (sec.type === 'title') {
                html += `<h5 class="hw-title">${sec.content}</h5>`;
            } else if (sec.type === 'section') {
                html += `<div class="hw-section"><h5>${sec.title}</h5><div class="hw-text">${sec.content.replace(/\n/g, '<br>')}</div></div>`;
            } else if (sec.type === 'code') {
                html += `<div class="hw-code"><div class="hw-code-header"><i class="fas fa-code"></i> ${sec.lang}</div><pre><code class="lang-${sec.lang.toLowerCase()}">${escHtml(sec.content)}</code></pre></div>`;
            } else if (sec.type === 'qa') {
                html += `<div class="hw-qa"><div class="hw-q"><i class="fas fa-question-circle" style="color:var(--warning);"></i> ${sec.q}</div><div class="hw-a"><i class="fas fa-check-circle" style="color:var(--success);"></i> ${sec.a.replace(/\n/g, '<br>')}</div></div>`;
            } else if (sec.type === 'refs') {
                html += `<div class="hw-refs"><strong>📚 ${sec.title || '参考资料'}</strong><div class="hw-text">${sec.content.replace(/\n/g, '<br>')}</div></div>`;
            }
        });
        html += `</div></div>`;
        html += `<div class="hw-tip"><i class="fas fa-pen"></i> 以上内容为AI生成的作业范本，请根据你的实际题目和教材进行替换修改。</div>`;
    });
    el.hwContent.innerHTML = html;
}

function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function renderKnowledge() {
    const data = state.generated.knowledge;
    if (!data || data.length === 0) {
        el.knowContent.innerHTML = '<p style="color:var(--neutral-400);text-align:center;padding:40px;">暂无考试任务。如有需要，请在上一页添加考试类型的任务。</p>';
        return;
    }
    let html = '';
    data.forEach(k => {
        html += `<h4>📚 ${k.subject}</h4>`;
        if (k.desc) html += `<p style="margin-bottom:12px;font-size:0.85rem;color:var(--neutral-400)">范围：${k.desc}</p>`;
        k.chapters.forEach(ch => {
            html += `<div class="knowledge-card"><h5>${ch.name}</h5><ul>`;
            ch.points.forEach(p => html += `<li>${p}</li>`);
            html += '</ul>';
            if (ch.tips && ch.tips.length > 0) {
                html += '<div style="margin-top:10px;padding:10px 14px;background:rgba(245,158,11,0.08);border-radius:8px;border-left:3px solid #f59e0b;">';
                html += '<strong style="font-size:0.82rem;color:#f59e0b;">⚠️ 易错/重点提示</strong><ul style="margin-bottom:0;margin-top:4px;">';
                ch.tips.forEach(t => html += `<li style="font-size:0.85rem;">${t}</li>`);
                html += '</ul></div>';
            }
            html += '</div>';
        });
    });
    el.knowContent.innerHTML = html;
}

function renderPresentation() {
    const data = state.generated.presentation;
    if (!data || data.length === 0) {
        el.preContent.innerHTML = '<p style="color:var(--neutral-400);text-align:center;padding:40px;">暂无Pre任务。如有需要，请在上一页添加Pre类型的任务。</p>';
        return;
    }
    let html = '<div class="pre-section">';
    data.forEach(p => {
        html += `<div class="pre-header"><h4>🎯 ${p.subject}</h4>`;
        if (p.desc) html += `<p style="color:var(--neutral-500);font-size:0.88rem;">主题：${p.desc}</p>`;
        html += '<div class="pre-tip"><i class="fas fa-lightbulb"></i> 共 ' + p.slides.length + ' 页PPT，每页附完整演讲稿，可直接修改使用</div>';
        html += `</div><div class="pre-slides">`;
        p.slides.forEach(s => {
            html += `<div class="pre-slide">
                <div class="slide-num">第 ${s.num} / ${p.slides.length} 页</div>
                <h5>${s.title}</h5>`;
            if (s.subtitle) html += `<p style="font-size:0.85rem;color:var(--neutral-400);margin-bottom:8px;">${s.subtitle}</p>`;
            html += `<ul class="slide-points">`;
            s.points.forEach(pt => html += `<li>${pt}</li>`);
            html += `</ul>`;
            if (s.speech) {
                html += `<div class="slide-speech"><div class="speech-label">🎤 演讲稿（约1-2分钟）</div><p>${s.speech}</p></div>`;
            }
            html += `</div>`;
        });
        html += `</div>`;
    });

    // ---- Feedback Section ----
    html += `
    <div class="pre-feedback">
        <div class="feedback-header" id="feedbackHeader">
            <i class="fas fa-comment-dots" style="color:var(--accent-500);"></i>
            <h4>💬 想让我帮你改进展示？</h4>
            <span class="feedback-toggle" id="feedbackToggle"><i class="fas fa-chevron-down"></i></span>
        </div>
        <div class="feedback-body" id="feedbackBody">
            <p style="font-size:0.85rem;color:var(--neutral-500);margin-bottom:12px;">告诉我你想改进的方向，我会给出具体的优化建议 ✨</p>
            <div class="feedback-chat" id="feedbackChat">
                <div class="fb-msg fb-ai">
                    <div class="fb-avatar"><i class="fas fa-robot"></i></div>
                    <div class="fb-bubble">
                        <strong>全能助手</strong>
                        <p>你好！我会根据你的 Pre 内容提供改进建议。你可以问我：</p>
                        <ul style="margin:6px 0 0 18px;font-size:0.85rem;">
                            <li>📄 "怎么让PPT更吸引人？"</li>
                            <li>🎤 "演讲稿怎么改得更流畅？"</li>
                            <li>📊 "内容结构怎么优化？"</li>
                            <li>🎨 "配色和版式有什么建议？"</li>
                            <li>❓ 或直接提问你想了解的任何问题</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="feedback-input-row">
                <textarea class="feedback-input" id="feedbackInput" placeholder="输入你的问题..." rows="1"></textarea>
                <button class="fb-send-btn" id="feedbackSend"><i class="fas fa-paper-plane"></i></button>
            </div>
        </div>
    </div>`;

    el.preContent.innerHTML = html;
    bindFeedbackEvents();
}

function bindFeedbackEvents() {
    const toggle = document.getElementById('feedbackToggle');
    const header = document.getElementById('feedbackHeader');
    const body = document.getElementById('feedbackBody');
    const input = document.getElementById('feedbackInput');
    const sendBtn = document.getElementById('feedbackSend');
    const chat = document.getElementById('feedbackChat');

    if (!header || !body) return;

    // Toggle open/close
    const toggleOpen = () => {
        const isOpen = body.classList.contains('open');
        body.classList.toggle('open');
        toggle.querySelector('i').className = isOpen ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
    };
    header.addEventListener('click', toggleOpen);
    // Open by default
    body.classList.add('open');
    toggle.querySelector('i').className = 'fas fa-chevron-up';

    // Send message
    const sendMsg = () => {
        const text = input.value.trim();
        if (!text) return;
        addFeedbackMessage(chat, text, 'user');
        input.value = '';
        input.style.height = 'auto';
        // Show typing indicator
        showTyping(chat, () => {
            const reply = generateFeedbackReply(text);
            addFeedbackMessage(chat, reply, 'ai');
        });
    };

    sendBtn.addEventListener('click', sendMsg);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    });
    // Auto-resize textarea
    input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });
}

function addFeedbackMessage(chat, text, role) {
    const div = document.createElement('div');
    div.className = `fb-msg fb-${role}`;
    const avatar = role === 'ai'
        ? '<div class="fb-avatar"><i class="fas fa-robot"></i></div>'
        : '<div class="fb-avatar user-avatar"><i class="fas fa-user"></i></div>';
    const name = role === 'ai' ? '全能助手' : '我';
    div.innerHTML = `${avatar}<div class="fb-bubble"><strong>${name}</strong><p>${text.replace(/\n/g, '<br>')}</p></div>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

function showTyping(chat, callback) {
    const div = document.createElement('div');
    div.className = 'fb-msg fb-ai';
    div.innerHTML = '<div class="fb-avatar"><i class="fas fa-robot"></i></div><div class="fb-bubble fb-typing"><span></span><span></span><span></span></div>';
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
    setTimeout(() => { div.remove(); callback(); }, 800 + Math.random() * 600);
}

function generateFeedbackReply(question) {
    const q = question.toLowerCase();
    const subject = state.tasks.filter(t => t.type === 'Pre').map(t => t.subject).join('、') || '你的展示';

    if (q.includes('ppt') || q.includes('吸引') || q.includes('美观') || q.includes('设计') || q.includes('版式') || q.includes('配色') || q.includes('好看')) {
        return `关于 PPT 设计的几点建议 🎨\n\n1️⃣ **色彩搭配**：建议使用同一色系的渐变配色，主色+辅色不超过3种。背景用浅色或渐变，文字用深色确保可读性。\n\n2️⃣ **排版原则**：每页PPT不超过7行文字，善用"留白"。标题统一字体大小，重点内容用图标或颜色高亮。\n\n3️⃣ **视觉元素**：适当加入图表（柱状图/饼图）替代纯文字，使用高质量图片增强表现力。推荐使用 Canva 或 PowerPoint 内置设计灵感。\n\n4️⃣ **动画效果**：适度使用进入动画（淡入/擦除），避免过度花哨的弹跳动画，保持专业感。`;
    }
    if (q.includes('演讲') || q.includes('讲稿') || q.includes('口语') || q.includes('表达') || q.includes('流畅') || q.includes('怎么说')) {
        return `演讲稿优化建议 🎤\n\n1️⃣ **口语化修改**：把书面语改成口语表达，多用短句。比如"由此可见"改成"所以我们可以发现"。\n\n2️⃣ **增加过渡句**：每页切换时加一句过渡，如"刚刚我们了解了XX，接下来让我们看看……"。这能让演讲更连贯。\n\n3️⃣ **控制语速**：建议每分钟180-220字，你的演讲稿按此标准可以计算出时长。重要概念处适当放慢。\n\n4️⃣ **练习技巧**：对着镜子练习，录制自己的演讲回看，注意眼神交流和肢体语言。\n\n5️⃣ **应急准备**：准备3-5个可能的提问及回答，展示时会更自信。`;
    }
    if (q.includes('结构') || q.includes('内容') || q.includes('逻辑') || q.includes('组织') || q.includes('顺序') || q.includes('框架')) {
        return `内容结构优化建议 📋\n\n1️⃣ **黄金圈法则**：试试"Why → What → How"结构——先讲为什么重要，再讲是什么，最后讲怎么用。\n\n2️⃣ **每页聚焦一个核心点**：一页只说清楚一件事，信息量过大会分散听众注意力。\n\n3️⃣ **增加互动环节**：在展示中穿插1-2个小提问或思考题，能让听众保持专注。\n\n4️⃣ **开头hook**：用一句引人深思的话、一个数据或一个小故事开场，比直接说"大家好"更有吸引力。\n\n5️⃣ **结尾call to action**：结束时给听众一个思考题或行动建议，让展示更有影响力。`;
    }
    if (q.includes('时间') || q.includes('太长') || q.includes('缩短') || q.includes('超时')) {
        return `时间控制建议 ⏱️\n\n1️⃣ **重点分配**：开场和结尾各占10%，主体内容占80%。核心概念和案例分析部分应该分配最多时间。\n\n2️⃣ **排练计时**：至少完整排练2遍并计时。根据时间调整每页的详略程度。\n\n3️⃣ **预留缓冲**：总时长控制在规定时间的85%，留出应对突发情况（设备调试、提问）的时间。\n\n4️⃣ **标记可跳过内容**：在PPT中标记某些页为"时间不够可跳过"，做到游刃有余。`;
    }
    if (q.includes('谢谢') || q.includes('感谢') || q.includes('好') || q.includes('help') || q.includes('有用')) {
        return `不客气！很高兴能帮到你 😊 如果在准备过程中还有其他问题，随时来问我。祝你展示顺利，取得好成绩！加油 💪✨`;
    }
    // Default intelligent reply
    const tips = [
        '增加更多实际案例，让抽象概念更具体。\n\n• 每个核心观点配一个生活化的例子\n• 案例尽量贴近同学们的日常经验\n• 可以用"比如""想象一下"来引入案例',
        '使用数据可视化增强说服力。\n\n• 把统计数据做成图表而不是单纯念数字\n• 用对比图展示变化趋势\n• 关键数据在PPT上突出显示',
        '加强开头吸引力。\n\n• 用提问开场："有多少人遇到过……？"\n• 用惊人数据开场\n• 用简短故事或场景描述开场\n• 避免以"大家好我今天的主题是……"开场',
        '在结尾留下深刻印象。\n\n• 总结3个核心takeaway\n• 留下一句金句或名言\n• 给出可操作的行动建议\n• 邀请大家课后进一步交流'
    ];
    const tip = tips[Math.floor(Math.random() * tips.length)];
    return `感谢你的提问！针对你的问题，我建议从以下角度优化 💡\n\n${tip}\n\n你可以告诉我更具体的需求，我能给出更有针对性的建议！`;
}

// ===================== EXPORT =====================
function exportAll() {
    const name = state.user.name || '同学';
    let text = `========================================\n`;
    text += `  大学生DDL神器 - 完整方案\n`;
    text += `  学生：${name}\n`;
    text += `  生成日期：${formatDate(getToday())}\n`;
    text += `  任务数：${state.tasks.length}\n`;
    text += `========================================\n\n`;

    // Tasks overview
    text += `【任务概览】\n`;
    state.tasks.forEach(t => {
        text += `  · [${t.type}] ${t.subject} - 截止${formatDate(t.deadline)}${t.description ? ' | ' + t.description : ''}\n`;
    });
    text += `\n`;

    // Schedule
    text += `========================================\n`;
    text += `  一、学习计划表\n`;
    text += `========================================\n\n`;
    const days = state.generated.schedule || [];
    days.forEach(day => {
        text += `  📅 ${formatDate(day.date)} (${getWeekday(day.date)})\n`;
        day.items.forEach((item, i) => {
            text += `    ${8+i*2}:00-${10+i*2}:00  [${item.type}] ${item.subject} - ${item.detail}\n`;
        });
        text += `\n`;
    });

    // Homework
    text += `========================================\n`;
    text += `  二、作业清单与指导\n`;
    text += `========================================\n\n`;
    const hw = state.generated.homework || [];
    hw.forEach(h => {
        text += `  📝 ${h.subject}\n`;
        if (h.desc) text += `     主题：${h.desc}\n`;
        h.items && h.items.forEach(item => {
            text += `    ${item.step || item.ref || '•'}：${item.content}\n`;
        });
        text += `\n`;
    });

    // Knowledge
    text += `========================================\n`;
    text += `  三、考试知识点清单\n`;
    text += `========================================\n\n`;
    const know = state.generated.knowledge || [];
    know.forEach(k => {
        text += `  📖 ${k.subject}\n`;
        k.chapters && k.chapters.forEach(ch => {
            text += `    【${ch.name}】\n`;
            ch.points && ch.points.forEach(p => text += `      · ${p}\n`);
            if (ch.tips && ch.tips.length > 0) {
                text += `      ⚠️ 提示：${ch.tips.join('；')}\n`;
            }
        });
        text += `\n`;
    });

    // Presentation
    text += `========================================\n`;
    text += `  四、Pre 辅助材料\n`;
    text += `========================================\n\n`;
    const pre = state.generated.presentation || [];
    pre.forEach(p => {
        text += `  🎯 ${p.subject}\n`;
        p.slides && p.slides.forEach(s => {
            text += `    第${s.num}页：${s.title}\n`;
            s.points && s.points.forEach(pt => text += `      · ${pt}\n`);
            if (s.speech) text += `    🎤 讲稿：${s.speech}\n`;
            text += `\n`;
        });
    });

    // Download
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `期末方案_${name}_${getToday()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('导出成功！', 'success');
}

// ===================== WORD EXPORT (Pre Speech) =====================
function exportPreToWord() {
    const preData = state.generated.presentation;
    if (!preData || preData.length === 0 || preData[0].slides.length <= 1) {
        showToast('请先生成Pre材料', 'error');
        return;
    }

    const name = state.user.name || '同学';
    const today = formatDate(getToday());
    let htmlContent = `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset="utf-8">
<style>
    body { font-family: '微软雅黑', '宋体', sans-serif; font-size: 12pt; line-height: 1.8; padding: 30px; color: #333; }
    h1 { text-align: center; font-size: 22pt; color: #4f46e5; border-bottom: 3px solid #4f46e5; padding-bottom: 12px; margin-bottom: 20px; }
    h2 { font-size: 16pt; color: #4338ca; margin-top: 24px; margin-bottom: 8px; border-left: 4px solid #818cf8; padding-left: 10px; }
    h3 { font-size: 14pt; color: #1e293b; margin-top: 18px; margin-bottom: 6px; }
    .meta { text-align: center; color: #94a3b8; font-size: 10pt; margin-bottom: 30px; }
    .slide { margin-bottom: 24px; page-break-inside: avoid; }
    .slide-num { font-size: 10pt; color: #818cf8; font-weight: bold; }
    .slide-title { font-size: 15pt; font-weight: bold; color: #1e293b; margin: 4px 0 8px; }
    .speech { background: #f8fafc; padding: 12px 16px; border-left: 4px solid #818cf8; margin: 6px 0 12px; font-size: 11.5pt; line-height: 2; }
    .speech-label { font-size: 9pt; color: #6366f1; font-weight: bold; margin-bottom: 4px; }
    .footer { text-align: center; color: #94a3b8; font-size: 9pt; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    ul { padding-left: 20px; margin: 4px 0 8px; }
    li { font-size: 11pt; margin-bottom: 2px; }
</style>
</head><body>`;

    preData.forEach(p => {
        htmlContent += `<h1>${p.subject}</h1>`;
        htmlContent += `<div class="meta">汇报人：${name} | 生成日期：${today}${p.desc ? ' | 主题：' + p.desc : ''}</div>`;
        p.slides.forEach(s => {
            htmlContent += `<div class="slide">
                <div class="slide-num">第 ${s.num} 页 / 共 ${p.slides.length} 页</div>
                <div class="slide-title">${s.title}</div>
                <ul>`;
            s.points.forEach(pt => htmlContent += `<li>${pt}</li>`);
            htmlContent += `</ul>`;
            if (s.speech) {
                htmlContent += `<div class="speech"><div class="speech-label">🎤 演讲稿</div>${s.speech.replace(/\n/g, '<br>')}</div>`;
            }
            htmlContent += `</div>`;
        });
    });

    htmlContent += `<div class="footer">由「大学生DDL神器」AI 自动生成 · 请根据实际情况修改后使用</div>`;
    htmlContent += `</body></html>`;

    const blob = new Blob(['﻿' + htmlContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const subj = preData.map(p => p.subject).join('、');
    a.download = `演讲稿_${subj}_${getToday()}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Word演讲稿下载成功！', 'success');
}

// ===================== EVENT BINDING =====================
function init() {
    loadState();

    // Loading screen
    setTimeout(() => {
        el.loading.classList.add('hide');
    }, 1800);

    // Step 1: User info next
    el.step1Next.addEventListener('click', () => {
        const name = el.userName.value.trim();
        if (!name) { showToast('请输入你的名字或昵称', 'error'); el.userName.focus(); return; }
        state.user.name = name;
        state.user.useAPI = el.apiSwitch.checked;
        state.user.apiEndpoint = el.apiEndpoint.value.trim();
        state.user.apiKey = el.apiKey.value.trim();
        state.user.apiModel = el.apiModel.value.trim();
        state.user.apiPreset = el.apiPreset.value;
        saveState();
        goToStep(2);
    });

    // API toggle
    el.apiSwitch.addEventListener('change', () => {
        el.apiConfig.classList.toggle('open', el.apiSwitch.checked);
    });

    // API preset selection
    const API_PRESETS = {
        openai:       { endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o' },
        deepseek:     { endpoint: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
        qwen:         { endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-plus' },
        glm:          { endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4-plus' },
        siliconflow:  { endpoint: 'https://api.siliconflow.cn/v1/chat/completions', model: 'deepseek-llm' },
        kimi:         { endpoint: 'https://api.moonshot.cn/v1/chat/completions', model: 'moonshot-v1-8k' },
        lingyi:       { endpoint: 'https://api.lingyiwanwu.com/v1/chat/completions', model: 'yi-lightning' },
        api2d:        { endpoint: 'https://openapi.api2d.net/v1/chat/completions', model: 'gpt-4o' }
    };
    el.apiPreset.addEventListener('change', () => {
        const val = el.apiPreset.value;
        if (val && API_PRESETS[val]) {
            const preset = API_PRESETS[val];
            el.apiEndpoint.value = preset.endpoint;
            el.apiModel.value = preset.model;
        } else {
            el.apiEndpoint.value = '';
            el.apiModel.value = 'gpt-4o';
        }
    });

    // Step 2: Add task
    el.addTaskBtn.addEventListener('click', openAddModal);

    // Step 2: Back / Next
    el.step2Back.addEventListener('click', () => goToStep(1));
    el.step2Next.addEventListener('click', () => {
        if (state.tasks.length === 0) { showToast('请至少添加一个任务', 'error'); return; }
        goToStep(3);
    });

    // Modal
    el.modalClose.addEventListener('click', closeModal);
    el.modalCancel.addEventListener('click', closeModal);
    el.modalSave.addEventListener('click', saveModal);
    el.taskModal.addEventListener('click', (e) => { if (e.target === el.taskModal) closeModal(); });

    // Enter key in modal
    el.taskSubject.addEventListener('keydown', (e) => { if (e.key === 'Enter') el.modalSave.click(); });

    // File upload: click zone to open file dialog
    el.fileDropZone.addEventListener('click', (e) => {
        if (e.target.closest('.file-remove')) return;
        el.fileInput.click();
    });

    // File upload: file selected via dialog
    el.fileInput.addEventListener('change', () => {
        if (el.fileInput.files.length) {
            handleFiles(el.fileInput.files);
            el.fileInput.value = '';
        }
    });

    // File upload: drag and drop
    el.fileDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        el.fileDropZone.classList.add('dragover');
    });
    el.fileDropZone.addEventListener('dragleave', () => {
        el.fileDropZone.classList.remove('dragover');
    });
    el.fileDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        el.fileDropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFiles(e.dataTransfer.files);
        }
    });

    // Dashboard tabs
    el.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab, true);
        });
    });

    // Refresh buttons
    el.refreshScheduleBtn.addEventListener('click', () => {
        state.generated.schedule = generateSchedule();
        renderSchedule();
        showToast('计划表已刷新', 'success');
    });
    el.refreshHomeworkBtn.addEventListener('click', () => {
        state.generated.homework = generateHomework();
        renderHomework();
        showToast('作业清单已刷新', 'success');
    });
    el.refreshKnowledgeBtn.addEventListener('click', () => {
        state.generated.knowledge = generateKnowledge();
        renderKnowledge();
        showToast('知识点清单已刷新', 'success');
    });
    el.refreshPreBtn.addEventListener('click', () => {
        state.generated.presentation = generatePresentation();
        renderPresentation();
        showToast('Pre材料已刷新', 'success');
    });

    // Pre Word export
    el.exportPreWordBtn.addEventListener('click', exportPreToWord);

    // Export
    el.exportBtn.addEventListener('click', exportAll);

    // Back to edit
    el.dashBackBtn.addEventListener('click', () => goToStep(2));

    // Reset
    el.resetBtn.addEventListener('click', () => {
        el.confirmBody.innerHTML = '<p>确定要清空所有数据重新开始吗？此操作不可撤销。</p>';
        el.confirmModal.classList.add('active');
    });
    el.confirmCancel.addEventListener('click', () => el.confirmModal.classList.remove('active'));
    el.confirmOk.addEventListener('click', () => {
        state.tasks = [];
        state.user = { name: '', useAPI: false, apiKey: '', apiEndpoint: '', apiModel: 'gpt-4o' };
        state.generated = { schedule: [], homework: [], knowledge: [], presentation: [] };
        state.scheduleCompletion = {};
        state.scheduleFilter = 'all';
        localStorage.removeItem(STORAGE_KEY);
        el.confirmModal.classList.remove('active');
        el.userName.value = '';
        el.apiSwitch.checked = false;
        el.apiConfig.classList.remove('open');
        el.apiEndpoint.value = '';
        el.apiKey.value = '';
        el.apiModel.value = 'gpt-4o';
        el.apiPreset.value = '';
        renderTaskList();
        goToStep(1);
        showToast('已重置所有数据', 'info');
    });

    // Click overlay to close confirm
    el.confirmModal.addEventListener('click', (e) => {
        if (e.target === el.confirmModal) el.confirmModal.classList.remove('active');
    });

    // Set default deadline
    const today = getToday();
    el.taskDeadline.setAttribute('min', today);
    el.taskDeadline.value = addDays(today, 7);

    // If we have saved data, restore state
    if (state.user.name) {
        el.userName.value = state.user.name;
    }
    if (state.tasks.length > 0) {
        renderTaskList();
    }

    console.log('📚 大学生DDL神器已启动！');
}

// ===================== START =====================
document.addEventListener('DOMContentLoaded', init);

})();
