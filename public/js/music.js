const musicButton = document.getElementById('musicButton');
const audioPlayer = document.getElementById('audioPlayer');
const commandContainer = document.getElementById('commandContainer');
const commandInput = document.getElementById('commandInput');
const commandHistoryElement = document.getElementById('commandHistory');
const feedbackModal = document.getElementById('feedbackModal');
const feedbackContent = document.getElementById('feedbackContent');
let musicList = []; // 初始化音乐列表
let isPlaying = false; // 用于跟踪音乐状态
let isLooping = false; // 用于跟踪循环状态
let commandHistory = [];
let historyIndex = -1; // 用于追踪命令历史导航
let commandActive = false;

// 获取音乐列表
fetch('/api/music-list')
    .then(response => response.json())
    .then(data => {
        musicList = data; // 更新音乐列表
        // 自动播放指定音乐
        playSpecificMusic('china-u'); // 在这里输入你想要自动播放的音乐
    })
    .catch(error => console.error('获取音乐列表失败:', error));

// 播放指定音乐
function playSpecificMusic(musicName) {
    const musicPath = `music/${musicName}.mp3`;
    if (musicList.includes(musicPath)) {
        audioPlayer.src = musicPath;
        audioPlayer.play().catch(error => {
            console.log('自动播放因某种原因被阻止，可能需要用户互动:', error);
        });
        musicButton.classList.add('rotate'); // 添加旋转效果
        isPlaying = true; // 更新播放状态
    } else {
        console.log('指定音乐未找到');
    }
}

// 播放或暂停音乐
function toggleMusic() {
    if (musicList.length === 0) {
        alert('音乐列表为空');
        return;
    }

    if (isPlaying) {
        audioPlayer.pause();
        musicButton.classList.remove('rotate'); // 移除旋转效果
    } else {
        if (audioPlayer.paused || audioPlayer.ended) {
            playRandomMusic();
        }
    }
    isPlaying = !isPlaying; // 切换播放状态
}

// 播放随机音乐
function playRandomMusic() {
    const randomIndex = Math.floor(Math.random() * musicList.length);
    audioPlayer.src = musicList[randomIndex];
    audioPlayer.play();
    musicButton.classList.add('rotate'); // 添加旋转效果
    isPlaying = true; // 更新播放状态
}

// 监听音乐播放完事件
audioPlayer.addEventListener('ended', () => {
    if (isLooping) {
        // 如果开启了循环，重新播放当前乐曲
        audioPlayer.currentTime = 0; // 重置播放时间
        audioPlayer.play();
    } else {
        playRandomMusic(); // 自动播放下一首
    }
});

// 每次点击切换音乐
musicButton.addEventListener('click', toggleMusic);

// 监听 '/' 键显示命令输入界面
document.addEventListener('keydown', (event) => {
    if (event.key === '/') {
        event.preventDefault(); // 阻止默认行为
        commandContainer.style.display = 'block';
        commandInput.focus();
    }
});

// 监听输入框相关按键
commandInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        const command = commandInput.value.trim();
        if (command) {
            commandHistory.unshift(command); // 新命令加入历史
            if (commandHistory.length > 50) { // 限制历史最多保存50条命令
                commandHistory.pop();
            }
            historyIndex = -1; // 重置历史索引
            updateCommandHistoryView();
            handleCommand(command);
            commandInput.value = ''; // 执行后清除输入框
        }
    } else if (event.key === 'Escape') {
        hideCommandInterface();
    } else if (event.key === 'ArrowUp') {
        // 导航上一个命令
        if (historyIndex + 1 < commandHistory.length) {
            historyIndex++;
            commandInput.value = commandHistory[historyIndex];
        }
        event.preventDefault();
    } else if (event.key === 'ArrowDown') {
        // 导航下一个命令
        if (historyIndex > 0) {
            historyIndex--;
            commandInput.value = commandHistory[historyIndex];
        } else {
            historyIndex = -1;
            commandInput.value = '';
        }
        event.preventDefault();
    }
});

// 失去焦点时隐藏命令界面
commandInput.addEventListener('blur', () => {
    hideCommandInterface();
});

// 隐藏命令输入界面
function hideCommandInterface() {
    commandContainer.style.display = 'none';
    commandInput.value = ''; // 清空输入框内容
}

// 更新命令历史视图
function updateCommandHistoryView() {
    commandHistoryElement.innerHTML = commandHistory.map(cmd => `<div>${cmd}</div>`).join('');
}

function showFeedback(message) {
    feedbackContent.innerHTML = `<div>${message}</div>`;
    feedbackModal.style.display = 'block';
}

function showInputForm(placeholder, callback) {
    feedbackContent.innerHTML = `
        <input type="text" id="modalInput" placeholder="${placeholder}" style="width: 100%; padding: 10px; box-sizing: border-box; margin-top: 10px;" />
        <button id="submitBtn" style="padding: 10px 20px; margin-top: 20px;">提交</button>
    `;
    feedbackModal.style.display = 'block';

    document.getElementById('submitBtn').onclick = () => {
        const inputValue = document.getElementById('modalInput').value.trim();
        callback(inputValue);
        hideFeedback();
    };
}

function showEmailForm() {
    feedbackContent.innerHTML = `
        <input type="text" id="recipientInput" placeholder="收件人电子邮箱" style="width: 100%; padding: 10px; box-sizing: border-box; margin-top: 10px;" />
        <textarea id="emailContentInput" placeholder="邮件内容" style="width: 100%; height: 150px; padding: 10px; box-sizing: border-box; margin-top: 10px;"></textarea>
        <button id="submitEmailBtn" style="padding: 10px 20px; margin-top: 20px;">发送</button>
    `;
    feedbackModal.style.display = 'block';

    document.getElementById('submitEmailBtn').onclick = () => {
        const recipient = document.getElementById('recipientInput').value.trim();
        const emailContent = document.getElementById('emailContentInput').value.trim();
        if (recipient && emailContent) {
            const emailUrl = `/api/email?user=${encodeURIComponent(recipient)}&text=${encodeURIComponent(emailContent)}`;
            window.open(emailUrl, '_blank');
            showFeedback('邮件已发送。');
        } else {
            showFeedback('请填写完整的收件人和邮件内容。');
        }
    };
}

function hideFeedback() {
    feedbackModal.style.display = 'none';
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        hideFeedback();
    }
});

document.addEventListener('click', (event) => {
    if (!feedbackModal.contains(event.target)) {
        hideFeedback();
    }
}, true);

commandInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        const command = commandInput.value.trim();
        if (command) {
            commandHistory.unshift(command);
            if (commandHistory.length > 50) {
                commandHistory.pop();
            }
            historyIndex = -1;
            updateCommandHistoryView();
            handleCommand(command);
            commandInput.value = '';
        }
    } else if (event.key === 'Escape') {
        hideCommandInterface();
    } else if (event.key === 'ArrowUp') {
        if (historyIndex + 1 < commandHistory.length) {
            historyIndex++;
            commandInput.value = commandHistory[historyIndex];
        }
        event.preventDefault();
    } else if (event.key === 'ArrowDown') {
        if (historyIndex > 0) {
            historyIndex--;
            commandInput.value = commandHistory[historyIndex];
        } else {
            historyIndex = -1;
            commandInput.value = '';
        }
        event.preventDefault();
    }
});

function handleCommand(input) {
    const [cmd, arg] = input.split(' ');

    if (cmd === 'help') {
        const helpText = `
<p>可用命令：</p>
<p>- list: 显示所有音乐文件列表</p>
<p>- play &lt;music_name&gt;: 播放指定音乐</p>
<p>- loop on/off: 开启或关闭单曲循环</p>
<p>- edit: 跳转到后台管理页面</p>
<p>- send: 发送反馈给屑作者</p>
<p>- email: 发送邮件</p>
<p>- help: 显示所有可用命令及用法</p>
        `;
        showFeedback(helpText.trim());
    } else if (cmd === 'list') {
        const formattedList = musicList.map(filename => 
            filename.replace('music/', '').replace('.mp3', '')
        );
        showFeedback('音乐列表：<p/>' + formattedList.join('<p/>'));
    } else if (cmd === 'play') {
        if (arg) {
            showFeedback(`正在播放音乐: ${arg}`);
        const musicPath = `music/${arg}.mp3`;
        if (musicList.includes(musicPath)) {
            audioPlayer.src = musicPath;
            audioPlayer.play();
            musicButton.classList.add('rotate');
            isPlaying = true; // 更新播放状态
        } else {
            showFeedback('请输入音乐名称。');
        }
      }
    } else if (cmd === 'loop') {
        if (arg === 'on') {
            showFeedback('单曲循环已开启。');
            isLooping = true; // 开启单曲循环
        } else if (arg === 'off') {
            showFeedback('单曲循环已关闭。');
            isLooping = false; // 关闭单曲循环
        } else {
            showFeedback('未知的 loop 指令，请使用 on 或 off');
        }
    } else if (cmd === 'edit') {
        window.location.href = '/edit';
    } else if (cmd === 'send') {
        showInputForm("输入反馈内容", (feedback) => {
            if (feedback) {
                const sendUrl = `/api/send?text=${encodeURIComponent(feedback)}`;
                window.open(sendUrl, '_blank');
                showFeedback('反馈已发送。');
            }
        });
    } else if (cmd === 'email') {
        showEmailForm();
    } else {
        showFeedback('未知命令');
    }
}