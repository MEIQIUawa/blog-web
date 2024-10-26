const express = require('express');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const session = require('express-session');
const os = require('os');
const app = express();

// 读取 setting.json 文件
const settingsPath = path.join(process.cwd(), 'setting.json');
let settings;

try {
  const data = fs.readFileSync(settingsPath, 'utf8');
  settings = JSON.parse(data);
} catch (err) {
  console.error('Error reading settings:', err);
  process.exit(1);
}

// 使用读取的数据
const emailaddress = settings.emailaddress;
const emailcode = settings.emailcode;
const vercode = settings.vercode;

console.log('QQ邮件地址:', emailaddress);
console.log('邮箱授权码:', emailcode);
console.log('请仔细核对数据');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// 设置静态文件目录
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/', express.static(path.join(__dirname, 'public')));
app.use('/music', express.static(path.join(__dirname, 'public', 'music')));

app.use(bodyParser.urlencoded({ extended: true }));

const logFile = path.join(os.tmpdir(), 'log.json');
let logData = { hourly: [], daily: [], weekly: [], monthly: [] };

// API 路径来获取音乐列表
app.get('/api/music-list', (req, res) => {
    const musicDir = path.join(__dirname, 'public/music'); // 音乐目录
    fs.readdir(musicDir, (err, files) => {
        if (err) {
            return res.status(500).send('无法读取音乐目录');
        }
        const musicList = files.filter(file => file.endsWith('.mp3')).map(file => `music/${file}`);
        res.json(musicList);
    });
});

app.get('/list', (req, res) => {
    const listDir = path.join(__dirname, 'public/list'); // list 目录
    fs.readdir(listDir, (err, files) => {
        if (err) {
            return res.status(500).send('无法读取 list 目录');
        }
        // 过滤出 HTML 文件
        const htmlFiles = files.filter(file => file.endsWith('.html'));
        res.json(htmlFiles); // 返回 HTML 文件名的数组
    });
});
app.use(express.json());

// 邮件发送设置
const transporter = nodemailer.createTransport({
  service: 'QQ',
  auth: {
    user: emailaddress,
    pass: emailcode // QQ邮箱授权码
  }
});

// 中间件配置
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 20 * 60 * 1000 } // 20分钟
}));

// 读取日志文件
if (fs.existsSync(logFile)) {
  const data = fs.readFileSync(logFile, 'utf-8');
  logData = JSON.parse(data);
} else {
  fs.writeFileSync(logFile, JSON.stringify(logData));
}

// 更新日志函数
function updateLog() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDate();
  const week = now.getDay();
  const month = now.getMonth();

  const data = {
    time: now.getTime(),
    traffic: Math.floor(Math.random() * 500)
  };

  logData.hourly[hour] = logData.hourly[hour] || [];
  logData.daily[day] = logData.daily[day] || [];
  logData.weekly[week] = logData.weekly[week] || [];
  logData.monthly[month] = logData.monthly[month] || [];

  logData.hourly[hour].push(data);
  logData.daily[day].push(data);
  logData.weekly[week].push(data);
  logData.monthly[month].push(data);

  fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
}

// 验证码逻辑
let verificationCodes = {};
let failedAttempts = {};
let lockedIPs = {};

function sendVerificationEmail(email, code) {
  const mailOptions = {
    from: emailaddress,
    to: email,
    subject: '验证码',
    text: `您的验证码是: ${code}`
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error('邮件发送失败:', error);
    } else {
      console.log('邮件发送成功:', info.response);
    }
  });
}

// 访问页面时记录IP地址
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  req.session.ip = ip; // 记录IP地址
  updateLog(); // 更新日志
  next();
});

app.post('/save', (req, res) => {
    const { filename, content } = req.body;
    const htmlFilePath = path.join(__dirname, 'public/list', `${filename}.html`);
    const jsonFilePath = path.join(__dirname, 'public/time.json');

    // 复制内容到 HTML 文件
    fs.writeFile(htmlFilePath, content, err => {
        if (err) {
            return res.status(500).json({ message: '保存HTML文件失败' });
        }

        // 更新 JSON 文件
        fs.readFile(jsonFilePath, 'utf8', (err, data) => {
            if (err) {
                return res.status(500).json({ message: '读取 JSON 文件失败' });
            }

            let jsonData;
            try {
                jsonData = JSON.parse(data);
            } catch (err) {
                return res.status(500).json({ message: '解析 JSON 文件失败' });
            }

            // 获取当前时间，格式为 YYYY-MM-DDTHH:MM:SS
            const currentDateTime = new Date().toISOString().replace('T', ' ').split('.')[0];

            // 更新 JSON 数据
            jsonData[`${filename}.html`] = currentDateTime;

            // 将更新后的 JSON 写回文件
            fs.writeFile(jsonFilePath, JSON.stringify(jsonData, null, 4), err => {
                if (err) {
                    return res.status(500).json({ message: '更新 JSON 文件失败' });
                }
                res.json({ message: '保存成功' });
            });
        });
    });
});

// 读取 time.json 数据并返回给前端
app.get('/files', (req, res) => {
    const jsonFilePath = path.join(__dirname, 'public/time.json');

    fs.readFile(jsonFilePath, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).json({ message: '读取 JSON 文件失败' });
        }

        try {
            const jsonData = JSON.parse(data);
            res.json(jsonData);
        } catch (err) {
            res.status(500).json({ message: '解析 JSON 文件失败' });
        }
    });
});

// Endpoint to delete HTML files
app.delete('/delete', (req, res) => {
    const { filename } = req.body; // 此处会读取请求体中的 filename
    if (!filename) {
        return res.status(400).json({ message: '未提供文件名' });
    }

    const htmlFilePath = path.join(__dirname, 'public/list', filename);

    fs.unlink(htmlFilePath, (err) => {
        if (err) {
            return res.status(500).json({ message: '删除文件失败' });
        }

        // Read and update time.json
        const jsonFilePath = path.join(__dirname, 'public/time.json');

        fs.readFile(jsonFilePath, 'utf8', (err, data) => {
            if (err) {
                return res.status(500).json({ message: '读取 JSON 文件失败' });
            }

            let jsonData;
            try {
                jsonData = JSON.parse(data);
            } catch (err) {
                return res.status(500).json({ message: '解析 JSON 文件失败' });
            }

            // Delete the file entry from JSON
            delete jsonData[filename];

            fs.writeFile(jsonFilePath, JSON.stringify(jsonData, null, 4), (err) => {
                if (err) {
                    return res.status(500).json({ message: '更新 JSON 文件失败' });
                }
                res.json({ message: '删除成功' });
            });
        });
    });
});

// 登录页面
app.get('/login', (req, res) => {
  res.render('login', { message: req.session.message });
  req.session.message = ''; // 清空信息
});

// 登录处理
app.post('/login', (req, res) => {
  const email = req.body.email;
  const code = req.body.code;
  const ip = req.session.ip;

  // 检查是否被锁定
  if (lockedIPs[ip]) {
    const lockTime = lockedIPs[ip] - Date.now();
    if (lockTime > 0) {
      return res.send(`账户被锁定，${Math.ceil(lockTime / 1000 / 60)} 分钟后可重试`);
    } else {
      delete lockedIPs[ip];
    }
  }

  // 验证码检查
  if (verificationCodes[ip] && verificationCodes[ip] === code) {
    req.session.authenticated = true; // 登录成功
    req.session.email = email;
    delete verificationCodes[ip]; // 删除验证码
    res.redirect('/home');
  } else {
    // 错误处理
    failedAttempts[ip] = (failedAttempts[ip] || 0) + 1;
    if (failedAttempts[ip] >= 2) {
      lockedIPs[ip] = Date.now() + 2 * 60 * 60 * 1000; // 锁定 2小时
      return res.send('<h1 style="position: absolute;top: 50%;left: 50%;transform: translate(-50%,-50%);">验证码错误超过两次，账户已被锁定。</h1>');
    }
    return res.render('login', { message: '验证码错误，请重试' });
  }
});

// 生成并发送验证码
app.post('/send-code', (req, res) => {
  const ip = req.session.ip;
  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6位验证码
  verificationCodes[ip] = code;

  sendVerificationEmail(emailaddress, code); // 发送到指定邮箱
  res.send('<h1 style="position: absolute;top: 50%;left: 50%;transform: translate(-50%,-50%);">验证码已发送。请检查您的邮箱。</h1>');
});

// 主页路由
app.get('/home', (req, res) => {
  if (!req.session.authenticated) {
    return res.redirect('/login'); // 未登录，重定向到登录页面
  }
  res.render('layout', { page: 'home.ejs', title: '主页' });
});

// 状态页面 /status
app.get('/status', (req, res) => {
  if (!req.session.authenticated) {
    return res.redirect('/login'); // 未登录，重定向到登录页面
  }
  res.render('layout', { page: 'status.ejs', logData, title: '状态页面' });
});

app.get('/edit', (req, res) => {
  if (!req.session.authenticated) {
    return res.redirect('/login'); // 未登录，重定向到登录页面
  }
  res.render('layout', { page: 'edit.ejs', title: '内容编辑' });
});

// 关于页面 /about
app.get('/about', (req, res) => {
  if (!req.session.authenticated) {
    return res.redirect('/login'); // 未登录，重定向到登录页面
  }
  res.render('layout', { page: 'about.ejs', title: '关于页面' });
});

// 启动服务器
app.listen(8080, () => {
  console.log('服务器运行在 http://localhost:8080');
});