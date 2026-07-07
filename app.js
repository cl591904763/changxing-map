// ============================================
// 畅行地图 - 无障碍出行地图 App
// ============================================

const STORAGE_KEYS = {
    USERS: 'changxing_users',
    CURRENT_USER: 'changxing_current_user',
    ROUTES: 'changxing_routes',
    APPOINTMENTS: 'changxing_appointments',
    PHOTOS: 'changxing_photos',
    PHOTOS_INDEX: 'changxing_photos_index',
    MESSAGES: 'changxing_messages',
    VERSION: 'changxing_version',
    BACKUP_PREFIX: 'changxing_backup_',
};

const BACKUP_KEYS = ['USERS', 'ROUTES', 'APPOINTMENTS', 'PHOTOS_INDEX', 'MESSAGES', 'CURRENT_USER'];

const APP_VERSION = '2.2';

const DISABILITY_TYPES = {
    'limb-mild': { name: '肢体残疾（轻度）', tag: 'tag-limb-mild' },
    'limb-moderate': { name: '肢体残疾（中度）', tag: 'tag-limb-moderate' },
    'limb-severe': { name: '肢体残疾（重度-轮椅）', tag: 'tag-limb-severe' },
    'visual-mild': { name: '视力障碍（低视力）', tag: 'tag-visual-mild' },
    'visual-severe': { name: '视力障碍（全盲）', tag: 'tag-visual-severe' },
    'hearing-mild': { name: '听力障碍（轻度）', tag: 'tag-hearing-mild' },
    'hearing-severe': { name: '听力障碍（重度）', tag: 'tag-hearing-severe' },
    'speech': { name: '言语障碍', tag: 'tag-speech' },
    'intellectual-mild': { name: '智力障碍（轻度）', tag: 'tag-intellectual-mild' },
    'intellectual-severe': { name: '智力障碍（重度）', tag: 'tag-intellectual-severe' },
    'mental': { name: '精神障碍', tag: 'tag-mental' },
    'autism': { name: '孤独症（自闭症）', tag: 'tag-autism' },
    'cerebral-palsy': { name: '脑瘫', tag: 'tag-cerebral-palsy' },
    'other': { name: '其他', tag: 'tag-other' },
};

const ROLE_NAMES = {
    disabled: '残障伙伴',
    volunteer: '志愿者',
};

// ============================================
// 数据存储层
// ============================================
const Store = {
    get(key, defaultValue = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.warn('Store.get 解析失败，尝试从备份恢复:', key, e);
            const backup = this.getBackup(key);
            if (backup !== null) {
                console.log('从备份恢复成功:', key);
                return backup;
            }
            return defaultValue;
        }
    },

    getRaw(key) {
        return localStorage.getItem(key);
    },

    set(key, value) {
        try {
            this.setBackup(key);
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('存储失败:', key, e);
            if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                if (typeof showToast === 'function') {
                    showToast('存储空间已满！请清理一些照片或路线后再试');
                }
            }
            return false;
        }
    },

    remove(key) {
        this.setBackup(key);
        localStorage.removeItem(key);
    },

    setBackup(key) {
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const backupKey = STORAGE_KEYS.BACKUP_PREFIX + key;
                localStorage.setItem(backupKey, raw);
            }
        } catch (e) {
            console.warn('备份失败:', key, e);
        }
    },

    getBackup(key) {
        try {
            const backupKey = STORAGE_KEYS.BACKUP_PREFIX + key;
            const raw = localStorage.getItem(backupKey);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            console.warn('备份读取失败:', key, e);
            return null;
        }
    },

    restoreFromBackup(key) {
        try {
            const backupKey = STORAGE_KEYS.BACKUP_PREFIX + key;
            const raw = localStorage.getItem(backupKey);
            if (raw) {
                localStorage.setItem(key, raw);
                console.log('已从备份恢复:', key);
                return true;
            }
        } catch (e) {
            console.error('恢复备份失败:', key, e);
        }
        return false;
    },

    checkAndRepair() {
        let repaired = 0;
        BACKUP_KEYS.forEach(keyName => {
            const key = STORAGE_KEYS[keyName];
            try {
                const raw = localStorage.getItem(key);
                if (raw) {
                    JSON.parse(raw);
                }
            } catch (e) {
                console.warn('数据损坏，尝试恢复:', key);
                if (this.restoreFromBackup(key)) {
                    repaired++;
                }
            }
        });
        if (repaired > 0) {
            console.log('修复了', repaired, '个损坏的数据项');
        }
        return repaired;
    }
};

// ============================================
// IndexedDB 服务 - 用于存储照片（更大容量）
// ============================================
const PhotoDB = {
    dbName: 'ChangxingPhotos',
    dbVersion: 1,
    storeName: 'photos',
    db: null,

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => {
                console.warn('IndexedDB 打开失败，将使用 localStorage');
                reject(request.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('IndexedDB 初始化成功');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                    store.createIndex('userId', 'userId', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
        });
    },

    async add(photoId, imageData) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB 未初始化'));
                return;
            }
            
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put({ id: photoId, imageData, createdAt: Date.now() });

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    async get(photoId) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB 未初始化'));
                return;
            }
            
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(photoId);

            request.onsuccess = (event) => {
                const result = event.target.result;
                resolve(result ? result.imageData : null);
            };
            request.onerror = () => reject(request.error);
        });
    },

    async delete(photoId) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('IndexedDB 未初始化'));
                return;
            }
            
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(photoId);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },

    async getStats() {
        return new Promise((resolve) => {
            if (!this.db) {
                resolve({ count: 0, size: 0 });
                return;
            }
            
            try {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAll();
                
                request.onsuccess = (event) => {
                    const photos = event.target.result;
                    const count = photos.length;
                    const size = photos.reduce((sum, p) => sum + (p.imageData?.length || 0), 0);
                    resolve({ count, size: Math.round(size / 1024) });
                };
                request.onerror = () => resolve({ count: 0, size: 0 });
            } catch (e) {
                resolve({ count: 0, size: 0 });
            }
        });
    }
};

// ============================================
// 用户认证模块
// ============================================
const Auth = {
    currentUser: null,

    init() {
        this.currentUser = Store.get(STORAGE_KEYS.CURRENT_USER);
        const users = Store.get(STORAGE_KEYS.USERS, []);
        if (users.length === 0) {
            const rawUsers = Store.getRaw(STORAGE_KEYS.USERS);
            const hasBackup = Store.getBackup(STORAGE_KEYS.USERS) !== null;
            if (rawUsers || hasBackup) {
                console.warn('用户数据可能损坏，原始数据存在但解析失败');
                if (hasBackup) {
                    Store.restoreFromBackup(STORAGE_KEYS.USERS);
                    const restoredUsers = Store.get(STORAGE_KEYS.USERS, []);
                    if (restoredUsers.length > 0) {
                        console.log('从备份恢复了用户数据:', restoredUsers.length);
                        return;
                    }
                }
            }
            this._createDemoUsers();
        }
    },

    _createDemoUsers() {
        const demoUsers = [
            {
                id: 'u1',
                username: 'xiaoming',
                password: '123456',
                nickname: '小明',
                role: 'disabled',
                disabilityType: 'limb-severe',
                phone: '13800138001',
                avatar: '🧑‍🦽',
                createdAt: Date.now()
            },
            {
                id: 'u2',
                username: 'dazhi',
                password: '123456',
                nickname: '大志',
                role: 'volunteer',
                disabilityType: '',
                phone: '13800138002',
                avatar: '🤝',
                createdAt: Date.now()
            },
            {
                id: 'u3',
                username: 'honghong',
                password: '123456',
                nickname: '红红',
                role: 'disabled',
                disabilityType: 'visual-severe',
                phone: '13800138003',
                avatar: '👩‍🦯',
                createdAt: Date.now()
            }
        ];
        Store.set(STORAGE_KEYS.USERS, demoUsers);
    },

    register(userData) {
        const users = Store.get(STORAGE_KEYS.USERS, []);
        console.log('注册-当前用户数:', users.length);
        if (users.find(u => u.username === userData.username)) {
            return { success: false, message: '用户名已存在' };
        }
        const newUser = {
            id: 'u' + Date.now(),
            ...userData,
            avatar: userData.role === 'volunteer' ? '🤝' : '🧑‍🦽',
            createdAt: Date.now()
        };
        users.push(newUser);
        const saved = Store.set(STORAGE_KEYS.USERS, users);
        console.log('注册-保存结果:', saved, '新用户:', newUser.username, newUser.id);
        checkStorageQuota();
        return { success: saved, user: newUser, message: saved ? '注册成功' : '注册失败，存储空间不足' };
    },

    login(username, password) {
        const users = Store.get(STORAGE_KEYS.USERS, []);
        console.log('登录-当前用户数:', users.length, '尝试登录:', username);
        const user = users.find(u => u.username === username && u.password === password);
        if (!user) {
            const userExists = users.find(u => u.username === username);
            if (userExists) {
                console.log('登录失败: 密码错误');
                return { success: false, message: '密码错误，请重试', errorType: 'wrong_password' };
            } else {
                console.log('登录失败: 用户不存在');
                const hasBackup = Store.getBackup(STORAGE_KEYS.USERS) !== null;
                let msg = '用户不存在，请先注册';
                if (users.length === 0 && hasBackup) {
                    msg = '用户数据可能丢失了，请尝试刷新页面恢复';
                }
                return { success: false, message: msg, errorType: 'user_not_found' };
            }
        }
        this.currentUser = user;
        Store.set(STORAGE_KEYS.CURRENT_USER, user);
        console.log('登录成功:', user.username);
        return { success: true, user };
    },

    logout() {
        this.currentUser = null;
        Store.remove(STORAGE_KEYS.CURRENT_USER);
    },

    isLoggedIn() {
        return !!this.currentUser;
    },

    getUser() {
        return this.currentUser;
    },

    getUserById(id) {
        const users = Store.get(STORAGE_KEYS.USERS, []);
        return users.find(u => u.id === id);
    },

    updateProfile(userId, updates) {
        const users = Store.get(STORAGE_KEYS.USERS, []);
        const idx = users.findIndex(u => u.id === userId);
        if (idx === -1) return null;
        users[idx] = { ...users[idx], ...updates };
        Store.set(STORAGE_KEYS.USERS, users);
        if (this.currentUser && this.currentUser.id === userId) {
            this.currentUser = users[idx];
            Store.set(STORAGE_KEYS.CURRENT_USER, users[idx]);
        }
        return users[idx];
    }
};

// ============================================
// 路线模块
// ============================================
const RouteService = {
    initDemoData() {
        const routes = Store.get(STORAGE_KEYS.ROUTES, []);
        if (routes.length > 0) return;

        const demoRoutes = [
            {
                id: 'r1',
                userId: 'u1',
                userName: '小明',
                userAvatar: '🧑‍🦽',
                title: '外滩无障碍路线',
                description: '从南京东路地铁站出发，途经和平饭店，最终到达外滩观景台。全程有坡道和无障碍电梯，路面平整。注意：节假日人很多，建议错峰出行。',
                startPoint: '南京东路地铁站',
                endPoint: '外滩观景台',
                waypoints: ['和平饭店'],
                distance: 1.2,
                difficulty: 'easy',
                tips: '南京东路站3号口有无障碍电梯，外滩观景台有无障碍卫生间',
                coordinates: [
                    [31.2386, 121.4870],
                    [31.2397, 121.4920],
                    [31.2405, 121.4985],
                ],
                district: '黄浦区',
                createdAt: Date.now() - 86400000 * 5
            },
            {
                id: 'r2',
                userId: 'u3',
                userName: '红红',
                userAvatar: '👩‍🦯',
                title: '上海图书馆盲道体验',
                description: '从10号线上海图书馆站到图书馆入口，盲道连续，但有一段被共享单车占用需要绕行。',
                startPoint: '上海图书馆地铁站',
                endPoint: '上海图书馆',
                waypoints: [],
                distance: 0.5,
                difficulty: 'medium',
                tips: '建议有导盲犬或陪同，小心共享单车占道',
                coordinates: [
                    [31.2058, 121.4375],
                    [31.2070, 121.4405],
                ],
                district: '徐汇区',
                createdAt: Date.now() - 86400000 * 3
            },
            {
                id: 'r3',
                userId: 'u2',
                userName: '大志',
                userAvatar: '🤝',
                title: '静安公园轮椅友好路线',
                description: '陪轮椅朋友逛静安公园，公园南门有无障碍入口，内部主要道路都是平路，景色很美。',
                startPoint: '静安寺站',
                endPoint: '静安公园',
                waypoints: [],
                distance: 0.8,
                difficulty: 'easy',
                tips: '公园内有休息座椅，南门进去左转有卫生间',
                coordinates: [
                    [31.2247, 121.4485],
                    [31.2260, 121.4510],
                ],
                district: '静安区',
                createdAt: Date.now() - 86400000 * 1
            },
        ];
        Store.set(STORAGE_KEYS.ROUTES, demoRoutes);
    },

    getAll() {
        return Store.get(STORAGE_KEYS.ROUTES, []).sort((a, b) => b.createdAt - a.createdAt);
    },

    getByUserId(userId) {
        return this.getAll().filter(r => r.userId === userId);
    },

    add(routeData) {
        const routes = Store.get(STORAGE_KEYS.ROUTES, []);
        const user = Auth.getUser();
        const newRoute = {
            id: 'r' + Date.now(),
            userId: user.id,
            userName: user.nickname,
            userAvatar: user.avatar,
            ...routeData,
            createdAt: Date.now()
        };
        routes.push(newRoute);
        Store.set(STORAGE_KEYS.ROUTES, routes);
        return newRoute;
    },

    update(routeId, routeData) {
        const routes = Store.get(STORAGE_KEYS.ROUTES, []);
        const idx = routes.findIndex(r => r.id === routeId);
        if (idx === -1) return null;
        routes[idx] = {
            ...routes[idx],
            ...routeData,
            updatedAt: Date.now()
        };
        Store.set(STORAGE_KEYS.ROUTES, routes);
        return routes[idx];
    },

    delete(routeId) {
        const routes = Store.get(STORAGE_KEYS.ROUTES, []);
        const filtered = routes.filter(r => r.id !== routeId);
        Store.set(STORAGE_KEYS.ROUTES, filtered);
        return filtered.length < routes.length;
    },

    getStats() {
        const routes = this.getAll();
        const totalKm = routes.reduce((sum, r) => sum + (r.distance || 0), 0);
        return {
            count: routes.length,
            km: totalKm.toFixed(1)
        };
    }
};

// ============================================
// 预约模块
// ============================================
const AppointmentService = {
    initDemoData() {
        const appts = Store.get(STORAGE_KEYS.APPOINTMENTS, []);
        if (appts.length > 0) return;

        const demoAppts = [
            {
                id: 'a1',
                requesterId: 'u1',
                requesterName: '小明',
                requesterAvatar: '🧑‍🦽',
                volunteerId: null,
                volunteerName: '',
                volunteerAvatar: '',
                route: '人民广场 - 南京路步行街',
                date: '2026-07-08',
                time: '10:00',
                disabilityType: 'limb-severe',
                needDescription: '需要陪同逛南京路，帮忙推轮椅，午餐一起吃',
                status: 'pending',
                createdAt: Date.now() - 86400000 * 2
            },
            {
                id: 'a2',
                requesterId: 'u3',
                requesterName: '红红',
                requesterAvatar: '👩‍🦯',
                volunteerId: 'u2',
                volunteerName: '大志',
                volunteerAvatar: '🤝',
                route: '陆家嘴地铁站 - 东方明珠',
                date: '2026-07-05',
                time: '14:00',
                disabilityType: 'visual-severe',
                needDescription: '视力障碍，需要引导参观东方明珠，帮忙描述景色',
                status: 'completed',
                createdAt: Date.now() - 86400000 * 5
            },
            {
                id: 'a3',
                requesterId: 'u1',
                requesterName: '小明',
                requesterAvatar: '🧑‍🦽',
                volunteerId: 'u2',
                volunteerName: '大志',
                volunteerAvatar: '🤝',
                route: '徐家汇 - 港汇恒隆广场',
                date: '2026-07-10',
                time: '11:00',
                disabilityType: 'limb-severe',
                needDescription: '想去逛商场买东西，需要帮忙拿东西和推轮椅',
                status: 'accepted',
                createdAt: Date.now() - 86400000 * 1
            },
        ];
        Store.set(STORAGE_KEYS.APPOINTMENTS, demoAppts);
    },

    getAll() {
        return Store.get(STORAGE_KEYS.APPOINTMENTS, []).sort((a, b) => b.createdAt - a.createdAt);
    },

    getMine() {
        const user = Auth.getUser();
        return this.getAll().filter(a =>
            a.requesterId === user.id || a.volunteerId === user.id
        );
    },

    getVolunteerPosts() {
        return this.getAll().filter(a => a.status === 'pending');
    },

    create(apptData) {
        const appts = Store.get(STORAGE_KEYS.APPOINTMENTS, []);
        const user = Auth.getUser();
        const newAppt = {
            id: 'a' + Date.now(),
            requesterId: user.id,
            requesterName: user.nickname,
            requesterAvatar: user.avatar,
            volunteerId: null,
            volunteerName: '',
            volunteerAvatar: '',
            ...apptData,
            status: 'pending',
            createdAt: Date.now()
        };
        appts.push(newAppt);
        Store.set(STORAGE_KEYS.APPOINTMENTS, appts);
        return newAppt;
    },

    accept(apptId) {
        const appts = Store.get(STORAGE_KEYS.APPOINTMENTS, []);
        const user = Auth.getUser();
        const idx = appts.findIndex(a => a.id === apptId);
        if (idx === -1) return null;
        appts[idx].volunteerId = user.id;
        appts[idx].volunteerName = user.nickname;
        appts[idx].volunteerAvatar = user.avatar;
        appts[idx].status = 'accepted';
        Store.set(STORAGE_KEYS.APPOINTMENTS, appts);
        return appts[idx];
    },

    complete(apptId) {
        const appts = Store.get(STORAGE_KEYS.APPOINTMENTS, []);
        const idx = appts.findIndex(a => a.id === apptId);
        if (idx === -1) return null;
        appts[idx].status = 'completed';
        Store.set(STORAGE_KEYS.APPOINTMENTS, appts);
        return appts[idx];
    }
};

// ============================================
// 留言消息模块
// ============================================
const MessageService = {
    initDemoData() {
        const messages = Store.get(STORAGE_KEYS.MESSAGES, []);
        if (messages.length > 0) return;

        const demoMessages = [
            {
                id: 'm1',
                appointmentId: 'a3',
                senderId: 'u1',
                senderName: '小明',
                senderAvatar: '🧑‍🦽',
                content: '你好大志，明天我们几点在哪里见面呀？',
                createdAt: Date.now() - 3600000 * 5
            },
            {
                id: 'm2',
                appointmentId: 'a3',
                senderId: 'u2',
                senderName: '大志',
                senderAvatar: '🤝',
                content: '你好小明，明天11点在徐家汇地铁站1号口见吧，那里有无障碍电梯很方便。',
                createdAt: Date.now() - 3600000 * 4
            },
            {
                id: 'm3',
                appointmentId: 'a3',
                senderId: 'u1',
                senderName: '小明',
                senderAvatar: '🧑‍🦽',
                content: '好的，那我们明天见！需要我带什么东西吗？',
                createdAt: Date.now() - 3600000 * 3
            },
            {
                id: 'm4',
                appointmentId: 'a3',
                senderId: 'u2',
                senderName: '大志',
                senderAvatar: '🤝',
                content: '不用啦，人来就行。我会带瓶水，路上注意安全。',
                createdAt: Date.now() - 3600000 * 2
            },
        ];
        Store.set(STORAGE_KEYS.MESSAGES, demoMessages);
    },

    getByAppointment(apptId) {
        const messages = Store.get(STORAGE_KEYS.MESSAGES, []);
        const user = Auth.getUser();
        const appts = Store.get(STORAGE_KEYS.APPOINTMENTS, []);
        const appt = appts.find(a => a.id === apptId);
        if (!appt) return [];
        const isParticipant = appt.volunteerId === user.id || appt.requesterId === user.id;
        if (!isParticipant) return [];
        return messages.filter(m => m.appointmentId === apptId).sort((a, b) => a.createdAt - b.createdAt);
    },

    send(apptId, content) {
        const messages = Store.get(STORAGE_KEYS.MESSAGES, []);
        const user = Auth.getUser();
        const appts = Store.get(STORAGE_KEYS.APPOINTMENTS, []);
        const appt = appts.find(a => a.id === apptId);
        if (!appt) return null;
        const isParticipant = appt.volunteerId === user.id || appt.requesterId === user.id;
        if (!isParticipant) return null;
        
        const newMsg = {
            id: 'm' + Date.now(),
            appointmentId: apptId,
            senderId: user.id,
            senderName: user.nickname,
            senderAvatar: user.avatar,
            content: content,
            createdAt: Date.now()
        };
        messages.push(newMsg);
        Store.set(STORAGE_KEYS.MESSAGES, messages);
        return newMsg;
    },

    getUnreadCount(apptId, userId) {
        const messages = this.getByAppointment(apptId);
        return messages.filter(m => m.senderId !== userId).length;
    }
};

// ============================================
// 照片墙模块
// ============================================
const PhotoService = {
    initDemoData() {
        const photos = Store.get(STORAGE_KEYS.PHOTOS_INDEX, []);
        if (photos.length > 0) return;

        const rawPhotos = Store.getRaw(STORAGE_KEYS.PHOTOS_INDEX);
        const rawPhotosOld = Store.getRaw(STORAGE_KEYS.PHOTOS);
        const hasBackup = Store.getBackup(STORAGE_KEYS.PHOTOS_INDEX) !== null;
        
        if (rawPhotos || rawPhotosOld || hasBackup) {
            console.warn('照片数据可能损坏，尝试恢复...');
            if (rawPhotosOld && photos.length === 0) {
                Store.set(STORAGE_KEYS.PHOTOS_INDEX, Store.get(STORAGE_KEYS.PHOTOS, []));
                console.log('已从旧PHOTOS恢复照片数据');
                return;
            }
            if (hasBackup) {
                Store.restoreFromBackup(STORAGE_KEYS.PHOTOS_INDEX);
                const restored = Store.get(STORAGE_KEYS.PHOTOS_INDEX, []);
                if (restored.length > 0) {
                    console.log('已从备份恢复照片数据:', restored.length);
                    return;
                }
            }
        }

        const demoPhotos = [
            { id: 'p1', userId: 'u1', userName: '小明', userAvatar: '🧑‍🦽', imageUrl: 'https://picsum.photos/seed/changxing1/400/400', caption: '外滩的日落真的太美了！感谢大志志愿者的陪伴 🌅', createdAt: Date.now() - 86400000 * 4 },
            { id: 'p2', userId: 'u2', userName: '大志', userAvatar: '🤝', imageUrl: 'https://picsum.photos/seed/changxing2/400/400', caption: '和小红一起逛了静安公园，她笑得好开心 😊', createdAt: Date.now() - 86400000 * 3 },
            { id: 'p3', userId: 'u3', userName: '红红', userAvatar: '👩‍🦯', imageUrl: 'https://picsum.photos/seed/changxing3/400/400', caption: '第一次独自完成图书馆路线，我做到了！', createdAt: Date.now() - 86400000 * 2 },
            { id: 'p4', userId: 'u1', userName: '小明', userAvatar: '🧑‍🦽', imageUrl: 'https://picsum.photos/seed/changxing4/400/400', caption: '徐家汇的无障碍设施越来越完善了', createdAt: Date.now() - 86400000 * 1 },
            { id: 'p5', userId: 'u2', userName: '大志', userAvatar: '🤝', imageUrl: 'https://picsum.photos/seed/changxing5/400/400', caption: '周末志愿者活动，大家都很棒！', createdAt: Date.now() - 3600000 * 12 },
            { id: 'p6', userId: 'u3', userName: '红红', userAvatar: '👩‍🦯', imageUrl: 'https://picsum.photos/seed/changxing6/400/400', caption: '咖啡店的无障碍通道好评 ☕', createdAt: Date.now() - 3600000 * 6 },
        ];
        Store.set(STORAGE_KEYS.PHOTOS_INDEX, demoPhotos);
    },

    getAll() {
        return Store.get(STORAGE_KEYS.PHOTOS_INDEX, []).sort((a, b) => b.createdAt - a.createdAt);
    },

    getByUserId(userId) {
        return this.getAll().filter(p => p.userId === userId);
    },

    async add(photoData) {
        const photos = Store.get(STORAGE_KEYS.PHOTOS_INDEX, []);
        const user = Auth.getUser();
        const newPhoto = {
            id: 'p' + Date.now(),
            userId: user.id,
            userName: user.nickname,
            userAvatar: user.avatar,
            caption: photoData.caption || '',
            createdAt: Date.now()
        };

        if (photoData.imageUrl && photoData.imageUrl.startsWith('data:')) {
            try {
                await PhotoDB.add(newPhoto.id, photoData.imageUrl);
                newPhoto.isLocal = true;
            } catch (e) {
                console.warn('IndexedDB 存储失败，回退到 localStorage:', e);
                newPhoto.imageUrl = photoData.imageUrl;
            }
        } else {
            newPhoto.imageUrl = photoData.imageUrl || '';
        }

        photos.unshift(newPhoto);
        Store.set(STORAGE_KEYS.PHOTOS_INDEX, photos);
        return newPhoto;
    },

    async getImage(photoId) {
        const photos = Store.get(STORAGE_KEYS.PHOTOS_INDEX, []);
        const photo = photos.find(p => p.id === photoId);
        if (!photo) return null;
        
        if (photo.imageUrl && !photo.imageUrl.startsWith('data:')) {
            return photo.imageUrl;
        }
        
        if (photo.isLocal) {
            try {
                return await PhotoDB.get(photoId);
            } catch (e) {
                console.warn('从 IndexedDB 获取图片失败:', e);
                return null;
            }
        }
        
        return photo.imageUrl || null;
    },

    async delete(photoId) {
        try {
            await PhotoDB.delete(photoId);
        } catch (e) {
            console.warn('从 IndexedDB 删除图片失败:', e);
        }
        
        const photos = Store.get(STORAGE_KEYS.PHOTOS_INDEX, []);
        const filtered = photos.filter(p => p.id !== photoId);
        Store.set(STORAGE_KEYS.PHOTOS_INDEX, filtered);
    }
};

// ============================================
// 地图模块（高德地图）
// ============================================
let map = null;
let routeLayers = [];
let currentHighlightRouteId = null;
let mapInitialized = false;
let geocoder = null;

function amapReady() {
    return window._amapReady === true && typeof AMap !== 'undefined';
}

function toLngLat(latLng) {
    return [latLng[1], latLng[0]];
}

function toLatLng(lngLat) {
    if (Array.isArray(lngLat)) {
        return [lngLat[1], lngLat[0]];
    }
    return [lngLat.lat, lngLat.lng];
}

// 当高德SDK加载完成后被调用
function onAMapLoaded() {
    // 如果用户已经在地图页面，初始化地图
    const mapPage = document.getElementById('page-map');
    if (mapPage && mapPage.classList.contains('active')) {
        MapModule.init();
    }
}

const MapModule = {
    init() {
        if (mapInitialized && map) {
            this.refreshSize();
            return;
        }
        if (!document.getElementById('map')) return;
        if (!amapReady()) {
            const errMsg = window._amapError || '正在加载中...';
            document.getElementById('map').innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:20px;text-align:center;color:#888;font-size:14px;line-height:1.6;">' + (errMsg === '正在加载中...' ? '🗺️ 地图加载中...' : '⚠️ 地图加载失败：' + errMsg + '<br>请检查 API Key 配置') + '</div>';
            // 如果是正在加载，3秒后重试
            if (!window._amapError) {
                setTimeout(() => { if (amapReady()) this.init(); }, 1500);
            }
            return;
        }

        map = new AMap.Map('map', {
            zoom: 12,
            center: [121.4737, 31.2304],
            mapStyle: 'amap://styles/whitesmoke',
            viewMode: '2D',
            resizeEnable: true,
        });

        map.addControl(new AMap.ToolBar({ position: 'RB', visible: false }));

        geocoder = new AMap.Geocoder({ city: '上海' });

        this._loadDistrictOverlay();

        mapInitialized = true;

        setTimeout(() => {
            this.loadRoutes();
            this.updateStats();
        }, 200);
    },

    _loadDistrictOverlay() {
        const district = new AMap.DistrictSearch({
            level: 'district',
            subdistrict: 1,
        });

        district.search('上海市', (status, result) => {
            if (status !== 'complete' || !result.districtList) return;
            const city = result.districtList[0];
            if (!city.districtList) return;

            city.districtList.forEach(d => {
                const bounds = d.boundaries;
                if (!bounds) return;

                bounds.forEach(bound => {
                    const polygon = new AMap.Polygon({
                        path: bound,
                        fillColor: '#e8f4e8',
                        fillOpacity: 0.4,
                        strokeColor: '#a0c8a0',
                        strokeWeight: 1,
                        strokeOpacity: 0.6,
                    });
                    map.add(polygon);
                });

                const center = d.center;
                if (center) {
                    const text = new AMap.Text({
                        position: center,
                        text: d.name,
                        offset: new AMap.Pixel(-20, -10),
                        style: {
                            'background': 'rgba(255,255,255,0.8)',
                            'border': 'none',
                            'padding': '2px 8px',
                            'border-radius': '8px',
                            'font-size': '11px',
                            'font-weight': '600',
                            'color': '#666',
                            'box-shadow': '0 1px 2px rgba(0,0,0,0.1)',
                        }
                    });
                    map.add(text);
                }
            });
        });
    },

    refreshSize() {
        if (map) {
            // 高德地图自动处理 resize
        }
    },

    loadRoutes() {
        if (!map) return;

        // 清除旧图层
        routeLayers.forEach(item => {
            if (item.polyline) map.remove(item.polyline);
            if (item.startMarker) map.remove(item.startMarker);
            if (item.endMarker) map.remove(item.endMarker);
            if (item.waypointMarkers) item.waypointMarkers.forEach(m => map.remove(m));
        });
        routeLayers = [];
        currentHighlightRouteId = null;

        const routes = RouteService.getAll();
        routes.forEach(route => {
            if (route.coordinates && route.coordinates.length > 1) {
                this._drawRoute(route);
            }
        });
    },

    _drawRoute(route) {
        const path = route.coordinates.map(c => toLngLat(c));
        const routeId = route.id;

        const smoothPath = this._generateSmoothPath(path);

        const polyline = new AMap.Polyline({
            path: smoothPath,
            strokeColor: '#2ecc71',
            strokeWeight: 6,
            strokeOpacity: 0.9,
            lineJoin: 'round',
            lineCap: 'round',
            showDir: true,
        });
        map.add(polyline);
        polyline.on('click', () => this.focusRoute(routeId));

        const startMarker = new AMap.Marker({
            position: path[0],
            content: '<div style="width:16px;height:16px;border-radius:50%;background:#2ecc71;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
            offset: new AMap.Pixel(-8, -8),
        });
        map.add(startMarker);

        const endMarker = new AMap.Marker({
            position: path[path.length - 1],
            content: '<div style="width:16px;height:16px;border-radius:50%;background:#e74c3c;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>',
            offset: new AMap.Pixel(-8, -8),
        });
        map.add(endMarker);

        const waypointMarkers = [];
        if (path.length > 2) {
            for (let i = 1; i < path.length - 1; i++) {
                const wpMarker = new AMap.Marker({
                    position: path[i],
                    content: `<div style="width:12px;height:12px;border-radius:50%;background:#3498db;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);font-size:9px;color:white;text-align:center;line-height:12px;font-weight:bold;">${i}</div>`,
                    offset: new AMap.Pixel(-6, -6),
                });
                map.add(wpMarker);
                waypointMarkers.push(wpMarker);
            }
        }

        const startInfo = new AMap.InfoWindow({ content: `<b>起点</b><br>${route.startPoint}`, offset: new AMap.Pixel(0, -16) });
        startMarker.on('click', () => startInfo.open(map, path[0]));
        const endInfo = new AMap.InfoWindow({ content: `<b>终点</b><br>${route.endPoint}`, offset: new AMap.Pixel(0, -16) });
        endMarker.on('click', () => endInfo.open(map, path[path.length - 1]));

        const routeLayer = {
            routeId: routeId,
            polyline: polyline,
            startMarker: startMarker,
            endMarker: endMarker,
            waypointMarkers: waypointMarkers,
            path: path,
        };
        routeLayers.push(routeLayer);
    },

    _generateSmoothPath(points) {
        if (points.length <= 1) return points;
        if (points.length === 2) {
            const result = [];
            const [p1, p2] = points;
            const steps = 20;
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                result.push([
                    p1[0] + (p2[0] - p1[0]) * t,
                    p1[1] + (p2[1] - p1[1]) * t,
                ]);
            }
            return result;
        }

        const smooth = [];
        const n = points.length;
        for (let i = 0; i < n - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(n - 1, i + 2)];

            const steps = 30;
            for (let j = 0; j < steps; j++) {
                const t = j / steps;
                const t2 = t * t;
                const t3 = t2 * t;

                const x = 0.5 * (
                    (2 * p1[0]) +
                    (-p0[0] + p2[0]) * t +
                    (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
                    (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3
                );
                const y = 0.5 * (
                    (2 * p1[1]) +
                    (-p0[1] + p2[1]) * t +
                    (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
                    (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3
                );
                smooth.push([x, y]);
            }
        }
        smooth.push(points[n - 1]);
        return smooth;
    },

    focusRoute(routeId) {
        if (!map) return;

        routeLayers.forEach(item => {
            if (item.routeId === routeId) {
                item.polyline.setOptions({
                    strokeColor: '#f39c12',
                    strokeWeight: 8,
                    strokeOpacity: 1,
                });
                item.polyline.setzIndex(100);
                map.setFitView([item.polyline], false, [80, 80, 80, 80]);
                currentHighlightRouteId = routeId;
            } else {
                item.polyline.setOptions({
                    strokeColor: '#2ecc71',
                    strokeWeight: 6,
                    strokeOpacity: 0.4,
                });
            }
        });

        setTimeout(() => {
            routeLayers.forEach(item => {
                if (item.routeId !== currentHighlightRouteId) {
                    item.polyline.setOptions({
                        strokeColor: '#2ecc71',
                        strokeWeight: 6,
                        strokeOpacity: 0.9,
                    });
                }
            });
        }, 4000);
    },

    updateStats() {
        const stats = RouteService.getStats();
        document.getElementById('routeCount').textContent = stats.count;
        document.getElementById('walkedKm').textContent = stats.km;
    }
};

// ============================================
// UI 工具函数
// ============================================
function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), duration);
}

function showModal(title, contentHtml) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = contentHtml;
    document.getElementById('modal').classList.remove('hidden');
}

function hideModal() {
    document.getElementById('modal').classList.add('hidden');
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor(diff / 60000);
    if (days > 0) return `${days}天前`;
    if (hours > 0) return `${hours}小时前`;
    if (mins > 0) return `${mins}分钟前`;
    return '刚刚';
}

// ============================================
// 页面路由
// ============================================
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + pageId).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageId);
    });

    const headerTitle = {
        'login': '畅行地图',
        'map': '畅行地图',
        'appointment': '出行搭子',
        'photos': '出行瞬间',
        'profile': '个人中心'
    };
    document.querySelector('.app-title').textContent = headerTitle[pageId] || '畅行地图';

    const header = document.getElementById('appHeader');
    const bottomNav = document.getElementById('bottomNav');
    const userBadge = document.getElementById('userBadge');

    if (pageId === 'login') {
        header.style.display = 'none';
        bottomNav.style.display = 'none';
    } else {
        header.style.display = 'flex';
        bottomNav.style.display = 'flex';
        if (Auth.currentUser) {
            userBadge.textContent = Auth.currentUser.nickname;
            userBadge.classList.remove('hidden');
        }
    }

    if (pageId === 'map') {
        requestAnimationFrame(() => {
            MapModule.init();
            if (mapInitialized) {
                MapModule.refreshSize();
            }
        });
        renderRouteList();
    } else if (pageId === 'appointment') {
        renderAppointments('all');
    } else if (pageId === 'photos') {
        renderPhotos();
    } else if (pageId === 'profile') {
        renderProfile();
    }
}

function checkAuthAndGo(pageId) {
    if (!Auth.isLoggedIn()) {
        showPage('login');
        showToast('请先登录');
        return false;
    }
    showPage(pageId);
    return true;
}

// ============================================
// 登录注册界面逻辑
// ============================================
function initAuthUI() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t === tab));
            document.getElementById('loginForm').classList.toggle('active', tabName === 'login');
            document.getElementById('registerForm').classList.toggle('active', tabName === 'register');
        });
    });

    document.getElementById('switchToRegister').addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.auth-tab[data-tab="register"]').click();
    });

    document.getElementById('switchToLogin').addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.auth-tab[data-tab="login"]').click();
    });

    document.querySelectorAll('input[name="role"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const disabilityGroup = document.getElementById('disabilityGroup');
            disabilityGroup.style.display = radio.value === 'disabled' ? 'block' : 'none';
        });
    });

    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        console.log('登录尝试:', username, password.length);
        const result = Auth.login(username, password);
        if (result.success) {
            showToast('登录成功，欢迎回来！');
            showPage('map');
        } else {
            showToast(result.message);
        }
    });

    document.getElementById('registerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const role = document.querySelector('input[name="role"]:checked').value;
        const userData = {
            username: document.getElementById('regUsername').value.trim(),
            password: document.getElementById('regPassword').value.trim(),
            nickname: document.getElementById('regNickname').value.trim(),
            role: role,
            disabilityType: role === 'disabled' ? document.getElementById('regDisability').value : '',
            phone: document.getElementById('regPhone').value.trim(),
        };
        console.log('注册用户:', userData.username, userData.password.length);
        if (userData.password.length < 6) {
            showToast('密码至少6位');
            return;
        }
        if (role === 'disabled' && !userData.disabilityType) {
            showToast('请选择残疾类型');
            return;
        }
        const result = Auth.register(userData);
        if (result.success) {
            showToast('注册成功！请登录');
            document.querySelector('.auth-tab[data-tab="login"]').click();
            document.getElementById('loginUsername').value = userData.username;
        } else {
            showToast(result.message);
        }
    });
}

// ============================================
// 路线列表渲染
// ============================================
function renderRouteList() {
    const routes = RouteService.getAll();
    const container = document.getElementById('routeListContainer');

    if (routes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🗺️</div>
                <div class="empty-state-text">还没有路线，快来上传第一条吧！</div>
            </div>
        `;
        return;
    }

    container.innerHTML = routes.map(route => {
        const diffText = { easy: '轻松', medium: '适中', hard: '挑战' }[route.difficulty] || '适中';
        return `
            <div class="route-card" data-route-id="${route.id}">
                <div class="route-card-header">
                    <div class="route-card-title">${route.title}</div>
                    <div class="route-card-tag">${diffText}</div>
                </div>
                <div class="route-card-desc">${route.description}</div>
                <div class="route-card-footer">
                    <div class="route-author">
                        <div class="route-author-avatar">${route.userAvatar}</div>
                        <span>${route.userName}</span>
                    </div>
                    <span>📍 ${route.distance}km · ${formatTime(route.createdAt)}</span>
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.route-card').forEach(card => {
        card.addEventListener('click', () => {
            const routeId = card.dataset.routeId;
            showRouteDetail(routeId);
        });
    });
}

function showRouteDetail(routeId) {
    const route = RouteService.getAll().find(r => r.id === routeId);
    if (!route) return;

    const diffText = { easy: '轻松', medium: '适中', hard: '挑战' }[route.difficulty] || '适中';
    const waypoints = route.waypoints || [];

    let waypointRows = '';
    if (waypoints.length > 0) {
        waypointRows = waypoints.map((wp, i) => `
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span style="font-size:13px;color:var(--text-light);">途经${i + 1}</span>
                <span style="font-size:13px;font-weight:500;">${wp}</span>
            </div>
        `).join('');
    }

    const user = Auth.getUser();
    console.log('当前用户:', user ? user.id : '未登录');
    const isOwner = user && user.id === route.userId;
    console.log('路线ID:', routeId, '路线发布者:', route.userId, '是否为所有者:', isOwner);

    const content = `
        <div style="margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
                <div style="font-size:32px;">${route.userAvatar}</div>
                <div>
                    <div style="font-weight:600;font-size:16px;">${route.userName}</div>
                    <div style="font-size:12px;color:var(--text-light);">${formatTime(route.createdAt)}发布</div>
                </div>
            </div>
            <h3 style="font-size:18px;margin-bottom:8px;">${route.title}</h3>
            <p style="color:var(--text-light);font-size:14px;line-height:1.7;">${route.description}</p>
        </div>
        <div style="background:var(--bg);border-radius:var(--radius);padding:14px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span style="font-size:13px;color:var(--text-light);">起点</span>
                <span style="font-size:13px;font-weight:500;">${route.startPoint}</span>
            </div>
            ${waypointRows}
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span style="font-size:13px;color:var(--text-light);">终点</span>
                <span style="font-size:13px;font-weight:500;">${route.endPoint}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <span style="font-size:13px;color:var(--text-light);">距离</span>
                <span style="font-size:13px;font-weight:500;">${route.distance} km</span>
            </div>
            <div style="display:flex;justify-content:space-between;">
                <span style="font-size:13px;color:var(--text-light);">难度</span>
                <span style="font-size:13px;font-weight:500;">${diffText}</span>
            </div>
        </div>
        <div style="background:#fffbeb;border-radius:var(--radius);padding:14px;margin-bottom:16px;">
            <div style="font-weight:600;font-size:14px;margin-bottom:6px;">💡 出行贴士</div>
            <p style="font-size:13px;color:#92400e;line-height:1.6;">${route.tips || '暂无特别提示'}</p>
        </div>
        <button class="btn btn-primary btn-block" onclick="focusOnRoute('${route.id}');">📍 在地图上定位</button>
        ${isOwner ? `
        <button class="btn btn-block" style="margin-top:8px;color:#f39c12;border:1px solid #f39c12;background:white;" onclick="editRoute('${route.id}');">✏️ 修改路线</button>
        <button class="btn btn-block" style="margin-top:8px;color:#e74c3c;border:1px solid #e74c3c;background:white;" onclick="deleteRoute('${route.id}');">🗑 删除路线</button>
        ` : ''}
    `;
    showModal('路线详情', content);
}

function deleteRoute(routeId) {
    if (!confirm('确定要删除这条路线吗？此操作不可撤销。')) return;
    RouteService.delete(routeId);
    hideModal();
    showToast('路线已删除');
    renderRouteList();
    MapModule.loadRoutes();
    MapModule.updateStats();
}

function focusOnRoute(routeId) {
    hideModal();
    showPage('map');
    setTimeout(() => {
        MapModule.focusRoute(routeId);
    }, 300);
}

function editRoute(routeId) {
    const route = RouteService.getAll().find(r => r.id === routeId);
    if (!route) return;
    showAddRouteModal(route);
}

function showAddRouteModal(editRoute = null) {
    const isEdit = !!editRoute;
    const title = isEdit ? '修改路线' : '上传路线';
    const submitText = isEdit ? '保存修改' : '上传路线';
    const waypoints = editRoute ? (editRoute.waypoints || []) : [];

    const waypointHtml = waypoints.map((wp, i) => `
        <div class="form-group waypoint-item" style="display:flex;gap:8px;align-items:center;">
            <input type="text" class="waypoint-input addr-input" value="${wp}" placeholder="途经点${i + 1}，如：交通大学" autocomplete="off" style="flex:1;">
            <button type="button" onclick="this.parentElement.remove();" style="flex-shrink:0;width:36px;height:36px;border:none;background:#fee;color:#e74c3c;border-radius:8px;font-size:16px;cursor:pointer;">×</button>
        </div>
    `).join('');

    const content = `
        <form id="addRouteForm">
            <div class="form-group">
                <label>路线名称</label>
                <input type="text" id="routeTitle" value="${isEdit ? editRoute.title : ''}" placeholder="给这条路线起个名字" required>
            </div>
            <div class="form-group">
                <label>起点 <span style="font-size:11px;color:#999;">（输入后从推荐中选择）</span></label>
                <input type="text" id="routeStart" class="addr-input" value="${isEdit ? editRoute.startPoint : ''}" placeholder="输入地名，如：交通大学" required autocomplete="off">
            </div>
            <div id="waypointList">${waypointHtml}</div>
            <div class="form-group">
                <button type="button" class="btn btn-block" style="border:1px dashed #2ecc71;color:#2ecc71;background:white;font-size:13px;" onclick="addWaypoint()">＋ 添加途经点</button>
            </div>
            <div class="form-group">
                <label>终点 <span style="font-size:11px;color:#999;">（输入后从推荐中选择）</span></label>
                <input type="text" id="routeEnd" class="addr-input" value="${isEdit ? editRoute.endPoint : ''}" placeholder="输入地名，如：外滩观景台" required autocomplete="off">
            </div>
            <div class="form-group">
                <label>大致距离（公里） <span style="font-size:11px;color:#999;">（填完地址后自动计算）</span></label>
                <input type="number" id="routeDistance" step="0.1" min="0.1" value="${isEdit ? editRoute.distance : ''}" placeholder="自动计算中..." readonly style="background:#f5f7fa;color:#666;">
            </div>
            <div class="form-group">
                <label>难度</label>
                <select id="routeDifficulty">
                    <option value="easy" ${isEdit && editRoute.difficulty === 'easy' ? 'selected' : ''}>轻松 - 完全无障碍</option>
                    <option value="medium" ${isEdit && editRoute.difficulty === 'medium' ? 'selected' : ''}>适中 - 有少量障碍</option>
                    <option value="hard" ${isEdit && editRoute.difficulty === 'hard' ? 'selected' : ''}>挑战 - 需要帮助</option>
                </select>
            </div>
            <div class="form-group">
                <label>路线描述</label>
                <textarea id="routeDesc" placeholder="描述一下路线的整体情况..." rows="3">${isEdit ? editRoute.description || '' : ''}</textarea>
            </div>
            <div class="form-group">
                <label>注意事项 / 贴士</label>
                <textarea id="routeTips" placeholder="有什么需要注意的地方？比如哪里有坡道、哪里有卫生间..." rows="3">${isEdit ? editRoute.tips || '' : ''}</textarea>
            </div>
            <div class="form-group">
                <label>📷 出行照片（可选）</label>
                <div class="photo-upload-trigger" id="routePhotoTrigger" style="padding:20px;border:2px dashed #ddd;border-radius:12px;text-align:center;cursor:pointer;background:#fafafa;">
                    <div style="font-size:32px;margin-bottom:8px;">📸</div>
                    <div style="font-size:14px;color:#666;">点击选择照片</div>
                    <div style="font-size:12px;color:#999;margin-top:4px;">支持从相册选择</div>
                </div>
                <input type="file" id="routePhoto" accept="image/*" style="display:none;">
                <div id="routePhotoPreview" style="margin-top:8px;display:none;">
                    <img id="routePhotoPreviewImg" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px;">
                </div>
                <textarea id="routePhotoCaption" rows="2" placeholder="为这张照片写点什么..." style="margin-top:8px;">${isEdit ? '' : ''}</textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">${submitText}</button>
        </form>
    `;
    showModal(title, content);

    // 给地址输入框绑定模糊推荐
    attachAutocomplete(document.getElementById('routeStart'));
    attachAutocomplete(document.getElementById('routeEnd'));
    document.querySelectorAll('.waypoint-input').forEach(inp => attachAutocomplete(inp));

    // 点击触发选择文件
    document.getElementById('routePhotoTrigger').addEventListener('click', () => {
        document.getElementById('routePhoto').click();
    });

    // 照片预览
    document.getElementById('routePhoto').addEventListener('change', function(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('routePhotoPreview');
        const previewImg = document.getElementById('routePhotoPreviewImg');
        if (file) {
            const reader = new FileReader();
            reader.onload = function(ev) {
                previewImg.src = ev.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            preview.style.display = 'none';
        }
    });

    document.getElementById('addRouteForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const start = document.getElementById('routeStart').value.trim();
        const end = document.getElementById('routeEnd').value.trim();
        const submitBtn = e.target.querySelector('button[type="submit"]');

        const waypointInputs = document.querySelectorAll('.waypoint-input');
        const waypoints = Array.from(waypointInputs).map(i => i.value.trim()).filter(v => v);

        submitBtn.textContent = '正在获取精确坐标...';
        submitBtn.disabled = true;

        try {
            const allAddresses = [start, ...waypoints, end];
            const results = await Promise.all(
                allAddresses.map(addr => geocodeAddress(addr).catch(err => {
                    console.warn('地理编码失败:', addr, err.message);
                    return null;
                }))
            );

            const allCoords = [];
            for (let i = 0; i < results.length; i++) {
                if (results[i]) {
                    allCoords.push(toLatLng(results[i]));
                } else {
                    allCoords.push([31.2304 + i * 0.001, 121.4737 + i * 0.001]);
                }
            }

            // 使用快速估算方法计算距离（不等待API）
            const distance = estimateDistance(allCoords);
            // 实际步行距离会比直线距离长，乘以1.3系数
            const distanceFixed = parseFloat((distance * 1.3).toFixed(1));

            const routeData = {
                title: document.getElementById('routeTitle').value.trim(),
                startPoint: start,
                endPoint: end,
                waypoints: waypoints,
                distance: distanceFixed,
                difficulty: document.getElementById('routeDifficulty').value,
                description: document.getElementById('routeDesc').value.trim(),
                tips: document.getElementById('routeTips').value.trim(),
                coordinates: allCoords
            };

            if (isEdit) {
                RouteService.update(editRoute.id, routeData);
            } else {
                RouteService.add(routeData);
            }

            const photoFile = document.getElementById('routePhoto').files[0];
            if (photoFile) {
                try {
                    const caption = document.getElementById('routePhotoCaption').value.trim();
                    const photoDataUrl = await compressImage(photoFile);
                    PhotoService.add({
                        imageUrl: photoDataUrl,
                        caption: caption || routeData.title
                    });
                } catch (photoErr) {
                    console.warn('照片处理失败:', photoErr);
                }
            }

            hideModal();
            showToast((isEdit ? '路线修改成功！' : '路线上传成功！') + '距离约' + distanceFixed + '公里');
            renderRouteList();
            MapModule.loadRoutes();
            MapModule.updateStats();
        } catch (err) {
            submitBtn.textContent = submitText;
            submitBtn.disabled = false;
            showToast('操作失败：' + (err.message || '请检查地址名称'));
        }
    });
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
    });
}

function compressImage(file, maxWidth = 800, quality = 0.6) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((maxWidth / width) * height);
                    width = maxWidth;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = () => reject(new Error('图片加载失败'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
    });
}

function calculateRouteDistance(coords) {
    return new Promise((resolve, reject) => {
        if (!amapReady() || coords.length < 2) {
            reject(new Error('地图未初始化或坐标不足'));
            return;
        }

        try {
            AMap.plugin(['AMap.Walking'], () => {
                const walking = new AMap.Walking({
                    map: null,
                    panel: null
                });

                const origin = toLngLat(coords[0]);
                const destination = toLngLat(coords[coords.length - 1]);

                let opts = {
                    origin: origin,
                    destination: destination
                };

                if (coords.length > 2) {
                    const waypoints = coords.slice(1, -1).map(c => toLngLat(c));
                    opts.waypoints = waypoints;
                }

                walking.search(opts, (status, result) => {
                    if (status === 'complete' && result.routes && result.routes.length > 0) {
                        const route = result.routes[0];
                        const distanceKm = (route.distance || 0) / 1000;
                        resolve(distanceKm);
                    } else {
                        reject(new Error('路线规划失败'));
                    }
                });
            });
        } catch (e) {
            reject(e);
        }
    });
}

function estimateDistance(coords) {
    if (coords.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        const [lat1, lng1] = coords[i];
        const [lat2, lng2] = coords[i + 1];
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        total += R * c;
    }
    return total;
}

const DISTRICT_CENTERS = {
    '黄浦区': [31.2316, 121.4937],
    '徐汇区': [31.1825, 121.4453],
    '长宁区': [31.2202, 121.4247],
    '静安区': [31.2294, 121.4617],
    '普陀区': [31.2450, 121.4020],
    '虹口区': [31.2645, 121.4920],
    '杨浦区': [31.2700, 121.5260],
    '浦东新区': [31.2210, 121.5440],
    '闵行区': [31.1120, 121.3820],
    '宝山区': [31.4050, 121.4900],
    '嘉定区': [31.3750, 121.2650],
    '金山区': [30.7420, 121.3410],
    '松江区': [31.0110, 121.2290],
    '青浦区': [31.1500, 121.1250],
    '奉贤区': [30.9180, 121.4740],
    '崇明区': [31.6200, 121.3970],
    '其他': [31.2304, 121.4737],
};

function getDistrictCenter(district) {
    return DISTRICT_CENTERS[district] || [31.2304, 121.4737];
}

function addWaypoint() {
    const list = document.getElementById('waypointList');
    const idx = list.children.length + 1;
    const div = document.createElement('div');
    div.className = 'form-group waypoint-item';
    div.style.cssText = 'display:flex;gap:8px;align-items:center;';
    div.innerHTML = `
        <input type="text" class="waypoint-input addr-input" placeholder="途经点${idx}，如：交通大学" autocomplete="off" style="flex:1;">
        <button type="button" onclick="this.parentElement.remove();" style="flex-shrink:0;width:36px;height:36px;border:none;background:#fee;color:#e74c3c;border-radius:8px;font-size:16px;cursor:pointer;">×</button>
    `;
    list.appendChild(div);
    // 给新增的途经点输入框也绑定模糊推荐
    attachAutocomplete(div.querySelector('.waypoint-input'));
}

function geocodeAddress(address, city = '上海') {
    return new Promise((resolve, reject) => {
        console.log('[地理编码] 开始解析地址:', address);
        if (!amapReady()) {
            reject(new Error('地图未初始化'));
            return;
        }

        try {
            const placeSearch = new AMap.PlaceSearch({
                city: city,
                citylimit: true,
                pageSize: 1,
                type: '',
            });

            placeSearch.search(address, (status, result) => {
                console.log('[地理编码] PlaceSearch status:', status, 'result:', result);
                let poi = null;
                
                if (status === 'complete' && result) {
                    if (result.poiList && result.poiList.pois && result.poiList.pois.length > 0) {
                        poi = result.poiList.pois[0];
                    } else if (result.pois && result.pois.length > 0) {
                        poi = result.pois[0];
                    }
                }

                if (poi) {
                    const loc = poi.location;
                    let lng, lat;
                    if (typeof loc === 'string') {
                        const parts = loc.split(',');
                        lng = parseFloat(parts[0]);
                        lat = parseFloat(parts[1]);
                    } else if (loc && loc.getLng) {
                        lng = loc.getLng();
                        lat = loc.getLat();
                    } else if (loc) {
                        lng = loc.lng;
                        lat = loc.lat;
                    }
                    console.log('[地理编码] PlaceSearch成功:', lng, lat, poi.adname);
                    if (lng !== undefined && lat !== undefined && !isNaN(lng) && !isNaN(lat)) {
                        const district = poi.adname || '';
                        resolve([lng, lat, district]);
                        return;
                    }
                }

                console.log('[地理编码] PlaceSearch失败，降级使用Geocoder');
                const geocoder = new AMap.Geocoder({ city: city });
                geocoder.getLocation(address, (status2, result2) => {
                    console.log('[地理编码] Geocoder status:', status2, 'result:', result2);
                    if (status2 === 'complete' && result2 && result2.geocodes && result2.geocodes.length > 0) {
                        const gc = result2.geocodes[0];
                        const loc2 = gc.location;
                        let lng2, lat2;
                        if (typeof loc2 === 'string') {
                            const parts2 = loc2.split(',');
                            lng2 = parseFloat(parts2[0]);
                            lat2 = parseFloat(parts2[1]);
                        } else if (loc2 && loc2.getLng) {
                            lng2 = loc2.getLng();
                            lat2 = loc2.getLat();
                        } else if (loc2) {
                            lng2 = loc2.lng;
                            lat2 = loc2.lat;
                        }
                        console.log('[地理编码] Geocoder成功:', lng2, lat2, gc.district);
                        if (lng2 !== undefined && lat2 !== undefined && !isNaN(lng2) && !isNaN(lat2)) {
                            const district2 = gc.district || '';
                            resolve([lng2, lat2, district2]);
                            return;
                        }
                    }
                    reject(new Error('地址未找到: ' + address));
                });
            });
        } catch (e) {
            console.error('[地理编码] 异常:', e);
            reject(e);
        }
    });
}

function searchAddresses(keyword, callback) {
    console.log('[模糊推荐] 搜索关键词:', keyword);
    if (!amapReady()) {
        console.warn('[模糊推荐] 地图未初始化');
        callback([]);
        return;
    }
    if (!keyword || keyword.length < 1) {
        callback([]);
        return;
    }
    try {
        const placeSearch = new AMap.PlaceSearch({
            city: '上海',
            citylimit: true,
            pageSize: 5,
            type: '',
        });
        placeSearch.search(keyword, (status, result) => {
            console.log('[模糊推荐] 搜索结果 status:', status, 'result:', result);
            if (status === 'complete' && result) {
                let pois = [];
                if (result.poiList && result.poiList.pois) {
                    pois = result.poiList.pois;
                } else if (result.pois) {
                    pois = result.pois;
                }
                console.log('[模糊推荐] 找到POI数量:', pois.length);
                callback(pois.map(p => {
                    let lng, lat;
                    const loc = p.location;
                    if (typeof loc === 'string') {
                        const parts = loc.split(',');
                        lng = parseFloat(parts[0]);
                        lat = parseFloat(parts[1]);
                    } else if (loc && loc.getLng) {
                        lng = loc.getLng();
                        lat = loc.getLat();
                    } else if (loc) {
                        lng = loc.lng;
                        lat = loc.lat;
                    }
                    return {
                        name: p.name,
                        address: p.address || p.name,
                        district: p.adname || '',
                        location: loc,
                        lng: lng,
                        lat: lat,
                    };
                }));
            } else if (status === 'error') {
                console.error('[模糊推荐] 搜索错误:', result);
                callback([]);
            } else if (status === 'no_data') {
                console.log('[模糊推荐] 无数据');
                callback([]);
            } else {
                console.log('[模糊推荐] 未知状态:', status);
                callback([]);
            }
        });
    } catch (e) {
        console.error('[模糊推荐] 异常:', e);
        callback([]);
    }
}

function attachAutocomplete(input) {
    if (!input) return;
    console.log('[模糊推荐] 绑定输入框:', input.id || input.className);
    let dropdown = null;
    let timer = null;
    let isDropdownHover = false;

    const positionDropdown = () => {
        if (!dropdown) return;
        const rect = input.getBoundingClientRect();
        dropdown.style.position = 'fixed';
        dropdown.style.left = rect.left + 'px';
        dropdown.style.top = (rect.bottom + 4) + 'px';
        dropdown.style.width = rect.width + 'px';
        dropdown.style.maxHeight = '240px';
        dropdown.style.overflowY = 'auto';
        dropdown.style.zIndex = '10000';
        dropdown.style.background = 'white';
        dropdown.style.border = '1px solid #e0e0e0';
        dropdown.style.borderRadius = '8px';
        dropdown.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)';
    };

    const showDropdown = (suggestions) => {
        removeDropdown();
        if (!suggestions || !suggestions.length) {
            console.log('[模糊推荐] 无推荐结果');
            return;
        }
        console.log('[模糊推荐] 显示推荐列表，数量:', suggestions.length);
        dropdown = document.createElement('div');
        dropdown.className = 'address-suggestions';
        dropdown.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        dropdown.addEventListener('mouseenter', () => {
            isDropdownHover = true;
        });
        dropdown.addEventListener('mouseleave', () => {
            isDropdownHover = false;
        });
        suggestions.forEach((s, idx) => {
            const item = document.createElement('div');
            item.style.cssText = 'padding:10px 12px;cursor:pointer;font-size:14px;border-bottom:1px solid #f0f0f0;';
            item.innerHTML = '<div style="font-weight:500;color:#333;">' + s.name + '</div><div style="font-size:12px;color:#999;margin-top:2px;">' + s.address + (s.district ? ' · ' + s.district : '') + '</div>';
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[模糊推荐] 用户选择:', s.name);
                input.value = s.name;
                input.dataset.district = s.district || '';
                input.dataset.lng = s.lng || '';
                input.dataset.lat = s.lat || '';
                removeDropdown();
                input.focus();
                input.dispatchEvent(new Event('change', { bubbles: true }));
            });
            dropdown.appendChild(item);
        });
        if (dropdown.lastChild) dropdown.lastChild.style.borderBottom = 'none';
        document.body.appendChild(dropdown);
        positionDropdown();
    };

    const removeDropdown = () => {
        if (dropdown) {
            dropdown.remove();
            dropdown = null;
        }
        isDropdownHover = false;
    };

    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            console.log('[模糊推荐] 输入变化，触发搜索');
            searchAddresses(input.value.trim(), showDropdown);
        }, 300);
    });

    input.addEventListener('focus', () => {
        console.log('[模糊推荐] 输入框获得焦点');
        if (input.value.trim().length >= 1) {
            searchAddresses(input.value.trim(), showDropdown);
        }
    });

    input.addEventListener('blur', () => {
        console.log('[模糊推荐] 输入框失去焦点, isDropdownHover:', isDropdownHover);
        if (!isDropdownHover) {
            setTimeout(removeDropdown, 150);
        }
    });

    const outsideClickListener = (e) => {
        if (dropdown && !dropdown.contains(e.target) && e.target !== input) {
            removeDropdown();
        }
    };

    document.addEventListener('mousedown', outsideClickListener, true);

    const scrollHandler = () => {
        if (dropdown) {
            const rect = input.getBoundingClientRect();
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            if (rect.bottom > viewportHeight || rect.top < 0) {
                removeDropdown();
            } else {
                positionDropdown();
            }
        }
    };

    window.addEventListener('scroll', scrollHandler, true);
    window.addEventListener('resize', positionDropdown);

    input._autocompleteCleanup = () => {
        document.removeEventListener('mousedown', outsideClickListener, true);
        window.removeEventListener('scroll', scrollHandler, true);
        window.removeEventListener('resize', positionDropdown);
        removeDropdown();
    };
}

// ============================================
// 预约模块渲染
// ============================================
let currentApptTab = 'all';

function renderAppointments(tab = 'all') {
    currentApptTab = tab;
    document.querySelectorAll('.mini-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.apptTab === tab);
    });

    let appts = [];
    if (tab === 'all') appts = AppointmentService.getAll();
    else if (tab === 'mine') appts = AppointmentService.getMine();
    else if (tab === 'volunteer') appts = AppointmentService.getVolunteerPosts();

    const container = document.getElementById('appointmentList');

    if (appts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🤝</div>
                <div class="empty-state-text">暂无预约记录</div>
            </div>
        `;
        return;
    }

    const user = Auth.getUser();
    container.innerHTML = appts.map(appt => {
        const statusText = { pending: '待接单', accepted: '已接单', completed: '已完成' }[appt.status];
        const statusClass = { pending: 'status-pending', accepted: 'status-accepted', completed: 'status-completed' }[appt.status];
        const disType = DISABILITY_TYPES[appt.disabilityType];
        const disabilityTag = disType ? `<span class="tag ${disType.tag}">${disType.name}</span>` : '';

        let actionBtns = [];
        if (appt.status === 'pending' && user.role === 'volunteer') {
            actionBtns.push(`<button class="btn btn-primary btn-sm" data-accept="${appt.id}">我来接单</button>`);
        }
        const isParticipant = appt.volunteerId === user.id || appt.requesterId === user.id;
        if (appt.status === 'accepted' && isParticipant) {
            actionBtns.push(`<button class="btn btn-secondary btn-sm" data-chat="${appt.id}">💬 留言</button>`);
            actionBtns.push(`<button class="btn btn-secondary btn-sm" data-complete="${appt.id}">标记完成</button>`);
        }
        if (appt.status === 'completed' && isParticipant) {
            actionBtns.push(`<button class="btn btn-secondary btn-sm" data-chat="${appt.id}">💬 查看留言</button>`);
        }

        const actionBtnHtml = actionBtns.join('');

        return `
            <div class="appointment-card">
                <div class="appointment-card-header">
                    <div class="appointment-card-title">${appt.route}</div>
                    <div class="appointment-status ${statusClass}">${statusText}</div>
                </div>
                <div class="appointment-info">
                    <div class="appointment-info-item">
                        <span>📅</span>
                        <span>${appt.date} ${appt.time}</span>
                    </div>
                    <div class="appointment-info-item">
                        <span>🧑</span>
                        <span>发起人：${appt.requesterName}</span>
                    </div>
                    <div class="appointment-info-item">
                        <span>${disabilityTag}</span>
                    </div>
                    ${appt.volunteerName ? `
                    <div class="appointment-info-item">
                        <span>🤝</span>
                        <span>志愿者：${appt.volunteerName}</span>
                    </div>` : ''}
                    <div class="appointment-info-item" style="color:var(--text-muted);font-size:12px;">
                        ${appt.needDescription}
                    </div>
                </div>
                <div class="appointment-actions">
                    ${actionBtnHtml}
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('[data-accept]').forEach(btn => {
        btn.addEventListener('click', () => {
            AppointmentService.accept(btn.dataset.accept);
            showToast('接单成功！');
            renderAppointments(currentApptTab);
        });
    });

    container.querySelectorAll('[data-complete]').forEach(btn => {
        btn.addEventListener('click', () => {
            AppointmentService.complete(btn.dataset.complete);
            showToast('已标记为完成');
            renderAppointments(currentApptTab);
        });
    });

    container.querySelectorAll('[data-chat]').forEach(btn => {
        btn.addEventListener('click', () => {
            showChatModal(btn.dataset.chat);
        });
    });
}

function showChatModal(apptId) {
    const appt = AppointmentService.getAll().find(a => a.id === apptId);
    if (!appt) return;

    const user = Auth.getUser();
    const isParticipant = appt.volunteerId === user.id || appt.requesterId === user.id;
    if (!isParticipant) {
        showToast('只有预约双方可以留言沟通');
        return;
    }

    const otherUser = appt.requesterId === user.id 
        ? { name: appt.volunteerName, avatar: appt.volunteerAvatar }
        : { name: appt.requesterName, avatar: appt.requesterAvatar };

    const content = `
        <div style="display:flex;flex-direction:column;height:65vh;">
            <div style="display:flex;align-items:center;gap:10px;padding-bottom:12px;border-bottom:1px solid var(--border);margin-bottom:12px;">
                <div style="width:40px;height:40px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-size:20px;overflow:hidden;">
                    ${otherUser.avatar && otherUser.avatar.startsWith && otherUser.avatar.startsWith('data:image') ? `<img src="${otherUser.avatar}" style="width:100%;height:100%;object-fit:cover;">` : otherUser.avatar}
                </div>
                <div>
                    <div style="font-weight:600;font-size:15px;">${otherUser.name}</div>
                    <div style="font-size:12px;color:var(--text-light);">${appt.route}</div>
                </div>
            </div>
            <div id="chatMessages" style="flex:1;overflow-y:auto;padding:8px 0;display:flex;flex-direction:column;gap:12px;">
            </div>
            <div style="display:flex;gap:8px;padding-top:12px;border-top:1px solid var(--border);">
                <input type="text" id="chatInput" placeholder="输入消息..." style="flex:1;padding:12px 16px;border:1.5px solid var(--border);border-radius:20px;font-size:14px;outline:none;" autocomplete="off">
                <button id="chatSendBtn" style="width:44px;height:44px;border-radius:50%;background:var(--primary);color:white;border:none;cursor:pointer;font-size:18px;flex-shrink:0;">➤</button>
            </div>
        </div>
    `;
    showModal('出行沟通', content);

    function renderMessages() {
        const messages = MessageService.getByAppointment(apptId);
        const container = document.getElementById('chatMessages');
        if (!container) return;

        if (messages.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:40px 20px;color:var(--text-light);">
                    <div style="font-size:48px;margin-bottom:12px;">💬</div>
                    <div style="font-size:14px;">还没有消息，开始聊天吧</div>
                </div>
            `;
            return;
        }

        container.innerHTML = messages.map(msg => {
            const isMe = msg.senderId === user.id;
            const avatarHtml = msg.senderAvatar && msg.senderAvatar.startsWith && msg.senderAvatar.startsWith('data:image')
                ? `<img src="${msg.senderAvatar}" style="width:100%;height:100%;object-fit:cover;">`
                : msg.senderAvatar;
            
            if (isMe) {
                return `
                    <div style="display:flex;justify-content:flex-end;gap:8px;align-items:flex-end;">
                        <div style="max-width:75%;">
                            <div style="background:var(--primary);color:white;padding:10px 14px;border-radius:16px 16px 4px 16px;font-size:14px;line-height:1.5;word-break:break-word;">
                                ${msg.content}
                            </div>
                            <div style="text-align:right;font-size:11px;color:var(--text-muted);margin-top:4px;">
                                ${formatChatTime(msg.createdAt)}
                            </div>
                        </div>
                        <div style="width:32px;height:32px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;overflow:hidden;">
                            ${avatarHtml}
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div style="display:flex;justify-content:flex-start;gap:8px;align-items:flex-end;">
                        <div style="width:32px;height:32px;border-radius:50%;background:var(--primary-light);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;overflow:hidden;">
                            ${avatarHtml}
                        </div>
                        <div style="max-width:75%;">
                            <div style="background:white;border:1px solid var(--border);padding:10px 14px;border-radius:16px 16px 16px 4px;font-size:14px;line-height:1.5;word-break:break-word;">
                                ${msg.content}
                            </div>
                            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
                                ${formatChatTime(msg.createdAt)}
                            </div>
                        </div>
                    </div>
                `;
            }
        }).join('');

        container.scrollTop = container.scrollHeight;
    }

    function sendMessage() {
        const input = document.getElementById('chatInput');
        const content = input.value.trim();
        if (!content) return;

        MessageService.send(apptId, content);
        input.value = '';
        renderMessages();
    }

    setTimeout(() => {
        renderMessages();

        document.getElementById('chatSendBtn').addEventListener('click', sendMessage);
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }, 50);
}

function formatChatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / 86400000);
    
    const hours = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    
    if (days === 0) {
        return `今天 ${hours}:${mins}`;
    } else if (days === 1) {
        return `昨天 ${hours}:${mins}`;
    } else {
        return `${date.getMonth() + 1}/${date.getDate()} ${hours}:${mins}`;
    }
}

function showCreateApptModal() {
    const user = Auth.getUser();
    const isDisabled = user.role === 'disabled';

    if (!isDisabled) {
        showToast('只有残障伙伴可以发起预约哦');
        return;
    }

    const content = `
        <form id="createApptForm">
            <div class="form-group">
                <label>出行路线</label>
                <input type="text" id="apptRoute" placeholder="例如：人民广场 - 南京路步行街" required>
            </div>
            <div class="form-group">
                <label>出行日期</label>
                <input type="date" id="apptDate" required>
            </div>
            <div class="form-group">
                <label>出行时间</label>
                <input type="time" id="apptTime" required>
            </div>
            <div class="form-group">
                <label>残疾类型</label>
                <select id="apptDisability">
                    <optgroup label="肢体残疾">
                        <option value="limb-mild" ${user.disabilityType === 'limb-mild' ? 'selected' : ''}>肢体残疾（轻度）</option>
                        <option value="limb-moderate" ${user.disabilityType === 'limb-moderate' ? 'selected' : ''}>肢体残疾（中度）</option>
                        <option value="limb-severe" ${user.disabilityType === 'limb-severe' ? 'selected' : ''}>肢体残疾（重度-轮椅）</option>
                    </optgroup>
                    <optgroup label="视力障碍">
                        <option value="visual-mild" ${user.disabilityType === 'visual-mild' ? 'selected' : ''}>视力障碍（低视力）</option>
                        <option value="visual-severe" ${user.disabilityType === 'visual-severe' ? 'selected' : ''}>视力障碍（全盲）</option>
                    </optgroup>
                    <optgroup label="听力障碍">
                        <option value="hearing-mild" ${user.disabilityType === 'hearing-mild' ? 'selected' : ''}>听力障碍（轻度）</option>
                        <option value="hearing-severe" ${user.disabilityType === 'hearing-severe' ? 'selected' : ''}>听力障碍（重度）</option>
                    </optgroup>
                    <optgroup label="智力与发育障碍">
                        <option value="intellectual-mild" ${user.disabilityType === 'intellectual-mild' ? 'selected' : ''}>智力障碍（轻度）</option>
                        <option value="intellectual-severe" ${user.disabilityType === 'intellectual-severe' ? 'selected' : ''}>智力障碍（重度）</option>
                        <option value="cerebral-palsy" ${user.disabilityType === 'cerebral-palsy' ? 'selected' : ''}>脑瘫</option>
                        <option value="autism" ${user.disabilityType === 'autism' ? 'selected' : ''}>孤独症（自闭症）</option>
                    </optgroup>
                    <optgroup label="其他">
                        <option value="speech" ${user.disabilityType === 'speech' ? 'selected' : ''}>言语障碍</option>
                        <option value="mental" ${user.disabilityType === 'mental' ? 'selected' : ''}>精神障碍</option>
                        <option value="other" ${user.disabilityType === 'other' ? 'selected' : ''}>其他</option>
                    </optgroup>
                </select>
            </div>
            <div class="form-group">
                <label>需要什么帮助？</label>
                <textarea id="apptNeed" rows="4" placeholder="请描述您的出行需求和需要的帮助..." required></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">发布预约</button>
        </form>
    `;
    showModal('发起出行预约', content);

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('apptDate').min = today;
    document.getElementById('apptDate').value = today;

    document.getElementById('createApptForm').addEventListener('submit', (e) => {
        e.preventDefault();
        AppointmentService.create({
            route: document.getElementById('apptRoute').value.trim(),
            date: document.getElementById('apptDate').value,
            time: document.getElementById('apptTime').value,
            disabilityType: document.getElementById('apptDisability').value,
            needDescription: document.getElementById('apptNeed').value.trim()
        });
        hideModal();
        showToast('预约发布成功！');
        renderAppointments('mine');
        document.querySelector('.mini-tab[data-appt-tab="mine"]').click();
    });
}

// ============================================
// 照片墙渲染
// ============================================
async function renderPhotos() {
    const photos = PhotoService.getAll();
    const container = document.getElementById('photoWall');

    if (photos.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: span 3;">
                <div class="empty-state-icon">📷</div>
                <div class="empty-state-text">还没有同行瞬间，快来分享吧！</div>
            </div>
        `;
        return;
    }

    container.innerHTML = photos.map(photo => `
        <div class="photo-item" data-photo-id="${photo.id}">
            <div class="photo-loading">
                <div class="spinner"></div>
            </div>
            <img src="" alt="出行照片" loading="lazy" style="display:none;">
            <div class="photo-info">
                <div class="photo-author">
                    <span>${photo.userAvatar}</span>
                    <span>${photo.userName}</span>
                </div>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.photo-item').forEach(async (item) => {
        const photoId = item.dataset.photoId;
        const img = item.querySelector('img');
        const loading = item.querySelector('.photo-loading');
        
        try {
            const imageUrl = await PhotoService.getImage(photoId);
            if (imageUrl) {
                img.src = imageUrl;
                img.onload = () => {
                    loading.style.display = 'none';
                    img.style.display = 'block';
                };
            } else {
                loading.innerHTML = '<span style="color:#999;font-size:12px;">图片加载失败</span>';
            }
        } catch (e) {
            loading.innerHTML = '<span style="color:#999;font-size:12px;">图片加载失败</span>';
        }

        item.addEventListener('click', () => {
            const photo = photos.find(p => p.id === photoId);
            if (photo) showPhotoDetail(photo);
        });
    });
}

async function showPhotoDetail(photo) {
    const user = Auth.getUser();
    const isOwner = user && user.id === photo.userId;
    
    let imageUrl = photo.imageUrl;
    if (photo.isLocal) {
        try {
            imageUrl = await PhotoService.getImage(photo.id);
        } catch (e) {
            console.warn('获取图片详情失败:', e);
        }
    }
    
    const content = `
        <div style="margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:10px;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:10px;">
                    <div style="font-size:32px;">${photo.userAvatar}</div>
                    <div>
                        <div style="font-weight:600;">${photo.userName}</div>
                        <div style="font-size:12px;color:var(--text-light);">${formatTime(photo.createdAt)}</div>
                    </div>
                </div>
                ${isOwner ? `<button id="deletePhotoBtn" style="padding:6px 12px;border:none;background:#fee;color:#e74c3c;border-radius:6px;font-size:13px;cursor:pointer;">删除</button>` : ''}
            </div>
        </div>
        <div style="border-radius:var(--radius);overflow:hidden;margin-bottom:12px;">
            <img src="${imageUrl || ''}" style="width:100%;display:block;">
        </div>
        <p style="font-size:14px;line-height:1.6;">${photo.caption || ''}</p>
    `;
    showModal('照片详情', content);

    if (isOwner) {
        document.getElementById('deletePhotoBtn').addEventListener('click', () => {
            if (confirm('确定要删除这张照片吗？')) {
                PhotoService.delete(photo.id);
                hideModal();
                showToast('照片已删除');
                renderPhotos();
                updateProfileStats();
            }
        });
    }
}

function showUploadPhotoModal() {
    const content = `
        <form id="uploadPhotoForm">
            <div class="form-group">
                <label>选择图片</label>
                <div class="photo-upload-trigger" id="photoTrigger" style="padding:30px;border:2px dashed #ddd;border-radius:12px;text-align:center;cursor:pointer;background:#fafafa;">
                    <div style="font-size:48px;margin-bottom:12px;">📸</div>
                    <div style="font-size:16px;color:#333;font-weight:500;">点击选择照片</div>
                    <div style="font-size:13px;color:#999;margin-top:6px;">从相册选择或拍照</div>
                </div>
                <input type="file" id="photoFile" accept="image/*" style="display:none;">
                <div id="photoPreview" style="margin-top:12px;display:none;">
                    <img id="photoPreviewImg" style="width:100%;max-height:300px;object-fit:cover;border-radius:12px;">
                </div>
            </div>
            <div class="form-group">
                <label>说点什么</label>
                <textarea id="photoCaption" rows="3" placeholder="分享这次出行的故事..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block" id="photoSubmitBtn">发布照片</button>
        </form>
    `;
    showModal('上传照片', content);

    // 点击触发选择文件
    document.getElementById('photoTrigger').addEventListener('click', () => {
        document.getElementById('photoFile').click();
    });

    // 图片预览
    document.getElementById('photoFile').addEventListener('change', function(e) {
        const file = e.target.files[0];
        const preview = document.getElementById('photoPreview');
        const previewImg = document.getElementById('photoPreviewImg');
        if (file) {
            const reader = new FileReader();
            reader.onload = function(ev) {
                previewImg.src = ev.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        } else {
            preview.style.display = 'none';
        }
    });

    document.getElementById('uploadPhotoForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('photoFile');
        const caption = document.getElementById('photoCaption').value.trim();
        const submitBtn = document.getElementById('photoSubmitBtn');
        const file = fileInput.files[0];

        if (!file) {
            showToast('请选择一张照片');
            return;
        }

        submitBtn.textContent = '处理中...';
        submitBtn.disabled = true;

        try {
            const compressedDataUrl = await compressImage(file);
            await PhotoService.add({
                imageUrl: compressedDataUrl,
                caption: caption
            });
            hideModal();
            showToast('照片发布成功！');
            renderPhotos();
            updateProfileStats();
        } catch (err) {
            submitBtn.textContent = '发布照片';
            submitBtn.disabled = false;
            showToast('照片上传失败：' + (err.message || '请重试'));
        }
    });
}

// ============================================
// 个人中心渲染
// ============================================
function renderProfile() {
    const user = Auth.getUser();
    if (!user) return;

    const avatarEl = document.getElementById('profileAvatar');
    if (user.avatar && user.avatar.startsWith && user.avatar.startsWith('data:image')) {
        avatarEl.innerHTML = `<img src="${user.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`;
    } else {
        avatarEl.textContent = user.avatar;
    }
    document.getElementById('profileName').textContent = user.nickname;
    document.getElementById('profileRole').textContent = ROLE_NAMES[user.role] || '用户';

    updateProfileStats();
}

function showAvatarUploadModal() {
    const user = Auth.getUser();
    if (!user) return;

    const content = `
        <div style="text-align:center;">
            <div style="margin-bottom:16px;">
                <div id="avatarPreview" style="width:100px;height:100px;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:48px;background:var(--primary-light);overflow:hidden;border:3px solid var(--primary);">
                    ${user.avatar && user.avatar.startsWith && user.avatar.startsWith('data:image') ? `<img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover;">` : user.avatar}
                </div>
            </div>
            <div class="form-group">
                <div class="photo-upload-trigger" id="avatarTrigger" style="padding:20px;border:2px dashed #2ecc71;border-radius:12px;text-align:center;cursor:pointer;background:#f0fdf4;">
                    <div style="font-size:32px;margin-bottom:8px;">📷</div>
                    <div style="font-size:14px;color:#2ecc71;font-weight:500;">选择头像照片</div>
                    <div style="font-size:12px;color:#999;margin-top:4px;">从相册选择或拍照</div>
                </div>
                <input type="file" id="avatarFile" accept="image/*" style="display:none;">
            </div>
            <button id="saveAvatarBtn" class="btn btn-primary btn-block" disabled style="opacity:0.5;">保存头像</button>
        </div>
    `;
    showModal('修改头像', content);

    let newAvatarData = null;

    document.getElementById('avatarTrigger').addEventListener('click', () => {
        document.getElementById('avatarFile').click();
    });

    document.getElementById('avatarFile').addEventListener('change', async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const compressed = await compressImage(file, 300, 0.9);
            newAvatarData = compressed;
            const preview = document.getElementById('avatarPreview');
            preview.innerHTML = `<img src="${compressed}" style="width:100%;height:100%;object-fit:cover;">`;
            const saveBtn = document.getElementById('saveAvatarBtn');
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
        } catch (err) {
            showToast('图片处理失败');
        }
    });

    document.getElementById('saveAvatarBtn').addEventListener('click', () => {
        if (!newAvatarData) return;
        Auth.updateProfile(user.id, { avatar: newAvatarData });
        hideModal();
        showToast('头像修改成功！');
        renderProfile();
    });
}

async function updateProfileStats() {
    const user = Auth.getUser();
    if (!user) return;

    const myRoutes = RouteService.getByUserId(user.id);
    const myAppts = AppointmentService.getMine();
    const myPhotos = PhotoService.getByUserId(user.id);

    document.getElementById('myRouteCount').textContent = myRoutes.length;
    document.getElementById('myApptCount').textContent = myAppts.length;
    document.getElementById('myPhotoCount').textContent = myPhotos.length;

    const quota = await checkStorageQuota();
    const fillEl = document.getElementById('storageFill');
    const textEl = document.getElementById('storageText');
    if (fillEl && textEl) {
        fillEl.style.width = Math.min(quota.usagePercent, 100) + '%';
        if (quota.usagePercent > 80) {
            fillEl.style.background = 'linear-gradient(90deg, #ff6b6b, #ee5a5a)';
        } else {
            fillEl.style.background = '';
        }
        
        let storageText = `基础数据: ${quota.usedKB}KB / 5MB`;
        if (quota.photoStats && quota.photoStats.size > 0) {
            storageText += ` | 照片: ${quota.photoStats.size}KB`;
        }
        storageText += ` (${quota.usagePercent}%)`;
        textEl.textContent = storageText;
    }
}

// ============================================
// 数据迁移与存储保护
// ============================================
function migrateData(oldVersion, newVersion) {
    console.log('数据迁移:', oldVersion || '(无版本)', '->', newVersion);
    try {
        const users = Store.get(STORAGE_KEYS.USERS, []);
        const routes = Store.get(STORAGE_KEYS.ROUTES, []);
        const appts = Store.get(STORAGE_KEYS.APPOINTMENTS, []);
        const photosIndex = Store.get(STORAGE_KEYS.PHOTOS_INDEX, []);
        const photosOld = Store.get(STORAGE_KEYS.PHOTOS, []);
        const messages = Store.get(STORAGE_KEYS.MESSAGES, []);
        const currentUser = Store.get(STORAGE_KEYS.CURRENT_USER);

        console.log('迁移前数据统计 - 用户:', users.length, '路线:', routes.length, '预约:', appts.length, '照片索引:', photosIndex.length, '旧照片:', photosOld.length, '消息:', messages.length);

        BACKUP_KEYS.forEach(keyName => {
            const key = STORAGE_KEYS[keyName];
            Store.setBackup(key);
        });

        if (users.length > 0) Store.set(STORAGE_KEYS.USERS, users);
        if (routes.length > 0) Store.set(STORAGE_KEYS.ROUTES, routes);
        if (appts.length > 0) Store.set(STORAGE_KEYS.APPOINTMENTS, appts);
        
        if (photosOld.length > 0 && photosIndex.length === 0) {
            Store.set(STORAGE_KEYS.PHOTOS_INDEX, photosOld);
            console.log('已从旧PHOTOS迁移到PHOTOS_INDEX:', photosOld.length);
        } else if (photosIndex.length > 0) {
            Store.set(STORAGE_KEYS.PHOTOS_INDEX, photosIndex);
        }
        
        if (messages.length > 0) Store.set(STORAGE_KEYS.MESSAGES, messages);
        if (currentUser) Store.set(STORAGE_KEYS.CURRENT_USER, currentUser);

        console.log('数据迁移完成，保留用户:', users.length, '路线:', routes.length);
    } catch (e) {
        console.error('数据迁移出错:', e);
        BACKUP_KEYS.forEach(keyName => {
            const key = STORAGE_KEYS[keyName];
            Store.restoreFromBackup(key);
        });
        console.log('已从迁移前备份恢复数据');
    }
}

async function checkStorageQuota() {
    try {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage.getItem(key).length + key.length;
            }
        }
        const usedKB = Math.round(total / 1024);
        const limitKB = 5000;
        const usagePercent = Math.round((usedKB / limitKB) * 100);

        const photoStats = await PhotoDB.getStats();
        
        console.log('存储使用 - localStorage:', usedKB + 'KB / ' + limitKB + 'KB (' + usagePercent + '%), IndexedDB照片:', photoStats.size + 'KB');
        if (usagePercent > 80) {
            console.warn('localStorage空间已使用' + usagePercent + '%，请注意清理');
        }
        return { usedKB, limitKB, usagePercent, photoStats };
    } catch (e) {
        return { usedKB: 0, limitKB: 5000, usagePercent: 0, photoStats: { count: 0, size: 0 } };
    }
}

function verifyDataIntegrity() {
    const users = Store.get(STORAGE_KEYS.USERS, []);
    const routes = Store.get(STORAGE_KEYS.ROUTES, []);
    const appts = Store.get(STORAGE_KEYS.APPOINTMENTS, []);
    const photos = Store.get(STORAGE_KEYS.PHOTOS_INDEX, []);
    const messages = Store.get(STORAGE_KEYS.MESSAGES, []);
    console.log('数据完整性检查 - 用户:', users.length, '路线:', routes.length, '预约:', appts.length, '照片:', photos.length, '消息:', messages.length);
    return { users, routes, appts, photos, messages };
}

// ============================================
// 初始化
// ============================================
async function initApp() {
    console.log('=== 畅行地图 v' + APP_VERSION + ' 初始化 ===');

    PhotoDB.init().catch(e => console.warn('IndexedDB 不可用:', e));

    const repaired = Store.checkAndRepair();
    if (repaired > 0) {
        console.warn('检测并修复了', repaired, '个损坏的数据项');
    }

    const savedVersion = Store.get(STORAGE_KEYS.VERSION, '');
    if (savedVersion !== APP_VERSION) {
        console.log('版本更新:', savedVersion || '(无版本)', '->', APP_VERSION);
        migrateData(savedVersion, APP_VERSION);
        Store.set(STORAGE_KEYS.VERSION, APP_VERSION);
    }

    verifyDataIntegrity();
    await checkStorageQuota();

    Auth.init();
    RouteService.initDemoData();
    AppointmentService.initDemoData();
    PhotoService.initDemoData();
    MessageService.initDemoData();

    initAuthUI();

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            checkAuthAndGo(item.dataset.page);
        });
    });

    document.getElementById('modalClose').addEventListener('click', hideModal);
    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal') hideModal();
    });

    document.getElementById('addRouteBtn').addEventListener('click', () => {
        if (!checkAuthAndGo('map')) return;
        showAddRouteModal();
    });

    document.getElementById('createAppointmentBtn').addEventListener('click', () => {
        if (!checkAuthAndGo('appointment')) return;
        showCreateApptModal();
    });

    document.getElementById('uploadPhotoBtn').addEventListener('click', () => {
        if (!checkAuthAndGo('photos')) return;
        showUploadPhotoModal();
    });

    document.querySelectorAll('.mini-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            renderAppointments(tab.dataset.apptTab);
        });
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('确定要退出登录吗？')) {
            Auth.logout();
            showToast('已退出登录');
            showPage('login');
        }
    });

    document.getElementById('menuMyRoutes').addEventListener('click', () => {
        showToast('查看我的路线');
    });
    document.getElementById('profileAvatar').addEventListener('click', () => {
        if (!Auth.isLoggedIn()) return;
        showAvatarUploadModal();
    });
    document.getElementById('menuMyAppointments').addEventListener('click', () => {
        showPage('appointment');
        renderAppointments('mine');
    });
    document.getElementById('menuMyPhotos').addEventListener('click', () => {
        showToast('查看我的照片');
    });
    document.getElementById('menuAbout').addEventListener('click', () => {
        showModal('关于畅行地图', `
            <div style="text-align:center;padding:20px 0;">
                <div style="font-size:48px;margin-bottom:12px;">♿</div>
                <h3 style="margin-bottom:8px;">畅行地图</h3>
                <p style="color:var(--text-light);font-size:14px;margin-bottom:16px;line-height:1.8;">
                    我们致力于为残障群体打造无障碍出行地图，<br>
                    记录每一条走过的路，点亮上海的每一个角落。<br>
                    让志愿者与残障伙伴结对同行，<br>
                    让每一次出行，都畅行无阻。
                </p>
                <p style="font-size:12px;color:var(--text-muted);">Version 1.0.0</p>
            </div>
        `);
    });

    if (Auth.isLoggedIn()) {
        showPage('map');
        setTimeout(() => renderRouteList(), 100);
    } else {
        showPage('login');
    }

    window.addEventListener('resize', () => {
        if (map) map.invalidateSize();
    });
}

document.addEventListener('DOMContentLoaded', initApp);
