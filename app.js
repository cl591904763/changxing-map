// ============================================
// 畅行计划 - 无障碍出行地图 App
// ============================================

const STORAGE_KEYS = {
    USERS: 'changxing_users',
    CURRENT_USER: 'changxing_current_user',
    ROUTES: 'changxing_routes',
    APPOINTMENTS: 'changxing_appointments',
    PHOTOS: 'changxing_photos',
};

const DISABILITY_TYPES = {
    wheelchair: { name: '肢体残疾（轮椅）', tag: 'tag-wheelchair' },
    visual: { name: '视力障碍', tag: 'tag-visual' },
    hearing: { name: '听力障碍', tag: 'tag-hearing' },
    intellectual: { name: '智力障碍', tag: 'tag-intellectual' },
    mental: { name: '精神障碍', tag: 'tag-mental' },
    other: { name: '其他', tag: 'tag-other' },
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
            return defaultValue;
        }
    },
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('存储失败:', e);
            return false;
        }
    },
    remove(key) {
        localStorage.removeItem(key);
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
                disabilityType: 'wheelchair',
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
                disabilityType: 'visual',
                phone: '13800138003',
                avatar: '👩‍🦯',
                createdAt: Date.now()
            }
        ];
        Store.set(STORAGE_KEYS.USERS, demoUsers);
    },

    register(userData) {
        const users = Store.get(STORAGE_KEYS.USERS, []);
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
        Store.set(STORAGE_KEYS.USERS, users);
        return { success: true, user: newUser };
    },

    login(username, password) {
        const users = Store.get(STORAGE_KEYS.USERS, []);
        const user = users.find(u => u.username === username && u.password === password);
        if (!user) {
            return { success: false, message: '用户名或密码错误' };
        }
        this.currentUser = user;
        Store.set(STORAGE_KEYS.CURRENT_USER, user);
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

    delete(routeId) {
        const routes = Store.get(STORAGE_KEYS.ROUTES, []);
        const filtered = routes.filter(r => r.id !== routeId);
        Store.set(STORAGE_KEYS.ROUTES, filtered);
        return filtered.length < routes.length;
    },

    getStats() {
        const routes = this.getAll();
        const districts = new Set(routes.map(r => r.district).filter(Boolean));
        const totalKm = routes.reduce((sum, r) => sum + (r.distance || 0), 0);
        return {
            count: routes.length,
            districts: districts.size,
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
                disabilityType: 'wheelchair',
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
                disabilityType: 'visual',
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
                disabilityType: 'wheelchair',
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
// 照片墙模块
// ============================================
const PhotoService = {
    initDemoData() {
        const photos = Store.get(STORAGE_KEYS.PHOTOS, []);
        if (photos.length > 0) return;

        const demoPhotos = [
            { id: 'p1', userId: 'u1', userName: '小明', userAvatar: '🧑‍🦽', imageUrl: 'https://picsum.photos/seed/changxing1/400/400', caption: '外滩的日落真的太美了！感谢大志志愿者的陪伴 🌅', createdAt: Date.now() - 86400000 * 4 },
            { id: 'p2', userId: 'u2', userName: '大志', userAvatar: '🤝', imageUrl: 'https://picsum.photos/seed/changxing2/400/400', caption: '和小红一起逛了静安公园，她笑得好开心 😊', createdAt: Date.now() - 86400000 * 3 },
            { id: 'p3', userId: 'u3', userName: '红红', userAvatar: '👩‍🦯', imageUrl: 'https://picsum.photos/seed/changxing3/400/400', caption: '第一次独自完成图书馆路线，我做到了！', createdAt: Date.now() - 86400000 * 2 },
            { id: 'p4', userId: 'u1', userName: '小明', userAvatar: '🧑‍🦽', imageUrl: 'https://picsum.photos/seed/changxing4/400/400', caption: '徐家汇的无障碍设施越来越完善了', createdAt: Date.now() - 86400000 * 1 },
            { id: 'p5', userId: 'u2', userName: '大志', userAvatar: '🤝', imageUrl: 'https://picsum.photos/seed/changxing5/400/400', caption: '周末志愿者活动，大家都很棒！', createdAt: Date.now() - 3600000 * 12 },
            { id: 'p6', userId: 'u3', userName: '红红', userAvatar: '👩‍🦯', imageUrl: 'https://picsum.photos/seed/changxing6/400/400', caption: '咖啡店的无障碍通道好评 ☕', createdAt: Date.now() - 3600000 * 6 },
        ];
        Store.set(STORAGE_KEYS.PHOTOS, demoPhotos);
    },

    getAll() {
        return Store.get(STORAGE_KEYS.PHOTOS, []).sort((a, b) => b.createdAt - a.createdAt);
    },

    getByUserId(userId) {
        return this.getAll().filter(p => p.userId === userId);
    },

    add(photoData) {
        const photos = Store.get(STORAGE_KEYS.PHOTOS, []);
        const user = Auth.getUser();
        const newPhoto = {
            id: 'p' + Date.now(),
            userId: user.id,
            userName: user.nickname,
            userAvatar: user.avatar,
            ...photoData,
            createdAt: Date.now()
        };
        photos.unshift(newPhoto);
        Store.set(STORAGE_KEYS.PHOTOS, photos);
        return newPhoto;
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
        document.getElementById('districtCount').textContent = stats.districts;
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
        'login': '畅行计划',
        'map': '无障碍地图',
        'appointment': '出行搭子',
        'photos': '出行瞬间',
        'profile': '个人中心'
    };
    document.querySelector('.app-title').textContent = headerTitle[pageId] || '畅行计划';

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
        const password = document.getElementById('loginPassword').value;
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
            password: document.getElementById('regPassword').value,
            nickname: document.getElementById('regNickname').value.trim(),
            role: role,
            disabilityType: role === 'disabled' ? document.getElementById('regDisability').value : '',
            phone: document.getElementById('regPhone').value.trim(),
        };
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
        <button class="btn btn-block" style="margin-top:8px;color:#e74c3c;border:1px solid #e74c3c;background:white;" onclick="deleteRoute('${route.id}');">🗑 删除路线</button>
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

function showAddRouteModal() {
    const content = `
        <form id="addRouteForm">
            <div class="form-group">
                <label>路线名称</label>
                <input type="text" id="routeTitle" placeholder="给这条路线起个名字" required>
            </div>
            <div class="form-group">
                <label>起点 <span style="font-size:11px;color:#999;">（输入后从推荐中选择）</span></label>
                <input type="text" id="routeStart" class="addr-input" placeholder="输入地名，如：交通大学" required autocomplete="off">
            </div>
            <div id="waypointList"></div>
            <div class="form-group">
                <button type="button" class="btn btn-block" style="border:1px dashed #2ecc71;color:#2ecc71;background:white;font-size:13px;" onclick="addWaypoint()">＋ 添加途经点</button>
            </div>
            <div class="form-group">
                <label>终点 <span style="font-size:11px;color:#999;">（输入后从推荐中选择）</span></label>
                <input type="text" id="routeEnd" class="addr-input" placeholder="输入地名，如：外滩观景台" required autocomplete="off">
            </div>
            <div class="form-group">
                <label>大致距离（公里）</label>
                <input type="number" id="routeDistance" step="0.1" min="0.1" placeholder="例如：1.5" required>
            </div>
            <div class="form-group">
                <label>所属区域 <span style="font-size:11px;color:#999;">（填完地址自动识别）</span></label>
                <select id="routeDistrict">
                    <option value="">自动识别中...</option>
                    <option value="黄浦区">黄浦区</option>
                    <option value="徐汇区">徐汇区</option>
                    <option value="长宁区">长宁区</option>
                    <option value="静安区">静安区</option>
                    <option value="普陀区">普陀区</option>
                    <option value="虹口区">虹口区</option>
                    <option value="杨浦区">杨浦区</option>
                    <option value="浦东新区">浦东新区</option>
                    <option value="闵行区">闵行区</option>
                    <option value="其他">其他</option>
                </select>
            </div>
            <div class="form-group">
                <label>难度</label>
                <select id="routeDifficulty">
                    <option value="easy">轻松 - 完全无障碍</option>
                    <option value="medium">适中 - 有少量障碍</option>
                    <option value="hard">挑战 - 需要帮助</option>
                </select>
            </div>
            <div class="form-group">
                <label>路线描述</label>
                <textarea id="routeDesc" placeholder="描述一下路线的整体情况..." rows="3"></textarea>
            </div>
            <div class="form-group">
                <label>注意事项 / 贴士</label>
                <textarea id="routeTips" placeholder="有什么需要注意的地方？比如哪里有坡道、哪里有卫生间..." rows="3"></textarea>
            </div>
            <div class="form-group">
                <label>📷 出行照片（可选）</label>
                <input type="file" id="routePhoto" accept="image/*" style="padding:10px;">
                <textarea id="routePhotoCaption" rows="2" placeholder="为这张照片写点什么..." style="margin-top:8px;"></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">上传路线</button>
        </form>
    `;
    showModal('上传路线', content);

    // 给地址输入框绑定模糊推荐
    attachAutocomplete(document.getElementById('routeStart'));
    attachAutocomplete(document.getElementById('routeEnd'));

    document.getElementById('addRouteForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const start = document.getElementById('routeStart').value.trim();
        const end = document.getElementById('routeEnd').value.trim();
        let district = document.getElementById('routeDistrict').value;
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

            // 自动检测区域：取第一个成功结果的 district
            let detectedDistrict = '';
            for (const r of results) {
                if (r && r[2]) { detectedDistrict = r[2]; break; }
            }
            if (!district && detectedDistrict) {
                district = detectedDistrict;
                const sel = document.getElementById('routeDistrict');
                if (sel) {
                    const opt = Array.from(sel.options).find(o => o.value === district);
                    if (opt) sel.value = district;
                    else sel.value = '其他';
                }
            }

            const allCoords = [];
            for (let i = 0; i < results.length; i++) {
                if (results[i]) {
                    allCoords.push(toLatLng(results[i]));
                } else {
                    const center = getDistrictCenter(district || '其他');
                    allCoords.push([center[0] + i * 0.001, center[1] + i * 0.001]);
                }
            }

            RouteService.add({
                title: document.getElementById('routeTitle').value.trim(),
                startPoint: start,
                endPoint: end,
                waypoints: waypoints,
                distance: parseFloat(document.getElementById('routeDistance').value),
                district: district || '其他',
                difficulty: document.getElementById('routeDifficulty').value,
                description: document.getElementById('routeDesc').value.trim(),
                tips: document.getElementById('routeTips').value.trim(),
                coordinates: allCoords
            });

            const photoFile = document.getElementById('routePhoto').files[0];
            if (photoFile) {
                const caption = document.getElementById('routePhotoCaption').value.trim();
                const photoDataUrl = await readFileAsDataURL(photoFile);
                PhotoService.add({
                    imageUrl: photoDataUrl,
                    caption: caption || document.getElementById('routeTitle').value.trim()
                });
            }

            hideModal();
            showToast('路线上传成功！坐标已精确定位');
            renderRouteList();
            MapModule.loadRoutes();
            MapModule.updateStats();
        } catch (err) {
            submitBtn.textContent = '上传路线';
            submitBtn.disabled = false;
            showToast('地理编码失败：' + (err.message || '请检查地址名称'));
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

        let actionBtn = '';
        if (appt.status === 'pending' && user.role === 'volunteer') {
            actionBtn = `<button class="btn btn-primary btn-sm" data-accept="${appt.id}">我来接单</button>`;
        } else if (appt.status === 'accepted' && (appt.volunteerId === user.id || appt.requesterId === user.id)) {
            actionBtn = `<button class="btn btn-secondary btn-sm" data-complete="${appt.id}">标记完成</button>`;
        }

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
                    ${actionBtn}
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
                    <option value="wheelchair" ${user.disabilityType === 'wheelchair' ? 'selected' : ''}>肢体残疾（轮椅使用者）</option>
                    <option value="visual" ${user.disabilityType === 'visual' ? 'selected' : ''}>视力障碍</option>
                    <option value="hearing" ${user.disabilityType === 'hearing' ? 'selected' : ''}>听力障碍</option>
                    <option value="intellectual" ${user.disabilityType === 'intellectual' ? 'selected' : ''}>智力障碍</option>
                    <option value="mental" ${user.disabilityType === 'mental' ? 'selected' : ''}>精神障碍</option>
                    <option value="other" ${user.disabilityType === 'other' ? 'selected' : ''}>其他</option>
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
function renderPhotos() {
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
            <img src="${photo.imageUrl}" alt="出行照片" loading="lazy">
            <div class="photo-info">
                <div class="photo-author">
                    <span>${photo.userAvatar}</span>
                    <span>${photo.userName}</span>
                </div>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.photo-item').forEach(item => {
        item.addEventListener('click', () => {
            const photo = photos.find(p => p.id === item.dataset.photoId);
            if (photo) showPhotoDetail(photo);
        });
    });
}

function showPhotoDetail(photo) {
    const content = `
        <div style="margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
                <div style="font-size:32px;">${photo.userAvatar}</div>
                <div>
                    <div style="font-weight:600;">${photo.userName}</div>
                    <div style="font-size:12px;color:var(--text-light);">${formatTime(photo.createdAt)}</div>
                </div>
            </div>
        </div>
        <div style="border-radius:var(--radius);overflow:hidden;margin-bottom:12px;">
            <img src="${photo.imageUrl}" style="width:100%;display:block;">
        </div>
        <p style="font-size:14px;line-height:1.6;">${photo.caption || ''}</p>
    `;
    showModal('照片详情', content);
}

function showUploadPhotoModal() {
    const content = `
        <form id="uploadPhotoForm">
            <div class="form-group">
                <label>选择图片</label>
                <input type="file" id="photoFile" accept="image/*" style="padding:10px;">
            </div>
            <div class="form-group">
                <label>说点什么</label>
                <textarea id="photoCaption" rows="3" placeholder="分享这次出行的故事..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary btn-block">发布照片</button>
        </form>
    `;
    showModal('上传照片', content);

    document.getElementById('uploadPhotoForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('photoFile');
        const caption = document.getElementById('photoCaption').value.trim();
        const file = fileInput.files[0];

        if (!file) {
            showToast('请选择一张照片');
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            PhotoService.add({
                imageUrl: e.target.result,
                caption: caption
            });
            hideModal();
            showToast('照片发布成功！');
            renderPhotos();
            updateProfileStats();
        };
        reader.readAsDataURL(file);
    });
}

// ============================================
// 个人中心渲染
// ============================================
function renderProfile() {
    const user = Auth.getUser();
    if (!user) return;

    document.getElementById('profileAvatar').textContent = user.avatar;
    document.getElementById('profileName').textContent = user.nickname;
    document.getElementById('profileRole').textContent = ROLE_NAMES[user.role] || '用户';

    updateProfileStats();
}

function updateProfileStats() {
    const user = Auth.getUser();
    if (!user) return;

    const myRoutes = RouteService.getByUserId(user.id);
    const myAppts = AppointmentService.getMine();
    const myPhotos = PhotoService.getByUserId(user.id);

    document.getElementById('myRouteCount').textContent = myRoutes.length;
    document.getElementById('myApptCount').textContent = myAppts.length;
    document.getElementById('myPhotoCount').textContent = myPhotos.length;
}

// ============================================
// 初始化
// ============================================
function initApp() {
    Auth.init();
    RouteService.initDemoData();
    AppointmentService.initDemoData();
    PhotoService.initDemoData();

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
    document.getElementById('menuMyAppointments').addEventListener('click', () => {
        showPage('appointment');
        renderAppointments('mine');
    });
    document.getElementById('menuMyPhotos').addEventListener('click', () => {
        showToast('查看我的照片');
    });
    document.getElementById('menuAbout').addEventListener('click', () => {
        showModal('关于畅行计划', `
            <div style="text-align:center;padding:20px 0;">
                <div style="font-size:48px;margin-bottom:12px;">♿</div>
                <h3 style="margin-bottom:8px;">畅行计划</h3>
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
