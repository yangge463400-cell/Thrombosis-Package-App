-- ============================================================
-- 血栓检测服务 · 种子数据
-- 注意：测试账号（user/staff/admin/hospital_admin）由后端启动时
--       自动初始化（BCrypt 编码密码），本脚本仅含业务数据。
-- ============================================================
SET NAMES utf8mb4;

-- ---------- 合作医院 6 家 ----------
INSERT INTO hospital (id, name, address, phone, city, lat, lng, detect_time, status) VALUES
(1, '北京协和医院', '北京市东城区帅府园一号', '010-69156114', '北京', 39.914000, 116.415000, '周一至周六 8:00-11:30', 'cooperating'),
(2, '北京大学第三医院', '北京市海淀区花园北路49号', '010-82266699', '北京', 39.983000, 116.358000, '周一至周日 8:00-17:00', 'cooperating'),
(3, '复旦大学附属中山医院', '上海市徐汇区枫林路180号', '021-64041990', '上海', 31.194000, 121.448000, '周一至周五 8:00-11:30', 'cooperating'),
(4, '上海交通大学医学院附属瑞金医院', '上海市黄浦区瑞金二路197号', '021-64370045', '上海', 31.213000, 121.467000, '周一至周六 8:00-12:00', 'cooperating'),
(5, '广东省人民医院', '广州市越秀区中山二路106号', '020-83827812', '广州', 23.126000, 113.280000, '周一至周五 8:00-11:30', 'cooperating'),
(6, '南方医科大学南方医院', '广州市白云区广州大道北路1838号', '020-61641888', '广州', 23.166000, 113.328000, '周一至周日 8:00-17:00', 'cooperating');

-- ---------- 检测套餐 8 个（1 个下架） ----------
INSERT INTO package (id, name, price, cover, images, items, target_population, cities, hospital_count, sales_count, notice, status) VALUES
(1, '静脉血栓风险筛查套餐', 580.00, '/images/placeholder/package1.png',
 JSON_ARRAY('/images/placeholder/package1.png','/images/placeholder/package1b.png'),
 JSON_ARRAY(JSON_OBJECT('name','D-二聚体','desc','筛查血栓形成风险的重要指标'), JSON_OBJECT('name','凝血四项','desc','评估凝血功能状态'), JSON_OBJECT('name','血常规','desc','基础血液检查'), JSON_OBJECT('name','血脂四项','desc','评估血脂代谢情况')),
 JSON_ARRAY('久坐人群','术后恢复期','有血栓家族史'),
 JSON_ARRAY('北京','上海','广州'), 6, 3520, '请空腹到院采血，检测后 3 个工作日内出具报告。', 'on'),
(2, '抗凝用药效果监测套餐', 780.00, '/images/placeholder/package2.png',
 JSON_ARRAY('/images/placeholder/package2.png'),
 JSON_ARRAY(JSON_OBJECT('name','INR 监测','desc','华法林抗凝效果核心指标'), JSON_OBJECT('name','凝血功能','desc','凝血酶原时间等'), JSON_OBJECT('name','肝肾功能','desc','评估药物代谢与安全性'), JSON_OBJECT('name','血常规','desc','基础血液检查')),
 JSON_ARRAY('正在服用抗凝药','华法林用药者','INR 需定期监测'),
 JSON_ARRAY('北京','上海','广州'), 6, 2168, '服药时间请保持稳定，采血前告知医护当前用药。', 'on'),
(3, '深静脉血栓筛查套餐', 480.00, '/images/placeholder/package3.png',
 JSON_ARRAY('/images/placeholder/package3.png'),
 JSON_ARRAY(JSON_OBJECT('name','下肢静脉超声','desc','直观检查下肢静脉血流'), JSON_OBJECT('name','D-二聚体','desc','筛查血栓形成风险'), JSON_OBJECT('name','血常规','desc','基础血液检查')),
 JSON_ARRAY('单侧下肢肿胀','长期卧床','长途旅行后'),
 JSON_ARRAY('北京','上海','广州'), 4, 1520, '超声检查无需空腹，建议穿宽松衣物。', 'on'),
(4, '心脑血管风险评估套餐', 680.00, '/images/placeholder/package4.png',
 JSON_ARRAY('/images/placeholder/package4.png'),
 JSON_ARRAY(JSON_OBJECT('name','血脂四项','desc','评估血脂代谢情况'), JSON_OBJECT('name','同型半胱氨酸','desc','心脑血管风险指标'), JSON_OBJECT('name','hs-CRP','desc','炎症反应指标'), JSON_OBJECT('name','颈动脉超声','desc','评估颈动脉斑块情况')),
 JSON_ARRAY('40岁以上','有高血压史','有吸烟史'),
 JSON_ARRAY('北京','上海','广州'), 5, 1830, '建议空腹 8 小时以上到院检查。', 'on'),
(5, '血栓基因检测套餐', 1280.00, '/images/placeholder/package5.png',
 JSON_ARRAY('/images/placeholder/package5.png'),
 JSON_ARRAY(JSON_OBJECT('name','FVL 基因','desc','因子 V Leiden 突变检测'), JSON_OBJECT('name','凝血酶原基因','desc','凝血酶原 G20210A 检测'), JSON_OBJECT('name','MTHFR 基因','desc','叶酸代谢相关基因')),
 JSON_ARRAY('有血栓家族史','反复血栓发作','备孕女性'),
 JSON_ARRAY('北京','上海'), 3, 620, '基因检测仅需少量血样，终身有效。', 'on'),
(6, '老年人血管健康体检套餐', 520.00, '/images/placeholder/package6.png',
 JSON_ARRAY('/images/placeholder/package6.png'),
 JSON_ARRAY(JSON_OBJECT('name','血常规','desc','基础血液检查'), JSON_OBJECT('name','血脂四项','desc','评估血脂代谢情况'), JSON_OBJECT('name','D-二聚体','desc','筛查血栓形成风险'), JSON_OBJECT('name','血压监测','desc','动态血压评估')),
 JSON_ARRAY('60岁以上','有慢性病史','日常活动减少'),
 JSON_ARRAY('北京','上海','广州'), 6, 2730, '建议由家属陪同到院，空腹检查。', 'on'),
(7, '术后血栓预防监测套餐', 860.00, '/images/placeholder/package7.png',
 JSON_ARRAY('/images/placeholder/package7.png'),
 JSON_ARRAY(JSON_OBJECT('name','D-二聚体','desc','筛查血栓形成风险'), JSON_OBJECT('name','凝血四项','desc','评估凝血功能状态'), JSON_OBJECT('name','血小板功能','desc','评估血小板活性')),
 JSON_ARRAY('骨科术后','关节置换术后','术后长期卧床'),
 JSON_ARRAY('北京','上海','广州'), 4, 890, '请携带出院小结到院，便于医护评估。', 'on'),
(8, '孕期血栓风险评估套餐', 620.00, '/images/placeholder/package8.png',
 JSON_ARRAY('/images/placeholder/package8.png'),
 JSON_ARRAY(JSON_OBJECT('name','D-二聚体','desc','筛查血栓形成风险'), JSON_OBJECT('name','凝血功能','desc','凝血酶原时间等')),
 JSON_ARRAY('孕期女性','有妊娠并发症史'),
 JSON_ARRAY('上海','广州'), 2, 0, '已下架，恢复时间另行通知。', 'off');

-- ---------- 字典：检测项目 ----------
INSERT INTO dict_item (type, name, sort) VALUES
('items', 'D-二聚体', 1), ('items', '凝血四项', 2), ('items', '血常规', 3),
('items', '血脂四项', 4), ('items', '下肢静脉超声', 5), ('items', 'INR 监测', 6),
('items', '肝肾功能', 7), ('items', '同型半胱氨酸', 8), ('items', 'hs-CRP', 9),
('items', '颈动脉超声', 10);

-- ---------- 字典：城市 ----------
INSERT INTO dict_item (type, name, sort) VALUES
('cities', '北京', 1), ('cities', '上海', 2), ('cities', '广州', 3);

-- ---------- 首页轮播 3 条 ----------
INSERT INTO banner (id, image, link_type, link_id, sort, status) VALUES
(1, '/images/placeholder/banner1.png', 'package', '1', 1, 1),
(2, '/images/placeholder/banner2.png', 'package', '2', 2, 1),
(3, '/images/placeholder/banner3.png', 'none', '', 3, 1);

-- ---------- 站内消息（给种子用户 openid=mock_openid_user_001，用户 id=1） ----------
INSERT INTO message (user_id, type, title, content, is_read, target_type, target_id) VALUES
(1, 'system', '欢迎使用血栓检测服务', '您好！欢迎来到血栓检测服务小程序。您可以在「检测套餐」中选择适合的检测服务，享受血管健康管理全流程服务。', 0, '', ''),
(1, 'package', '老年人血管健康体检套餐上新', '专为 60 岁以上人群设计的血管健康体检套餐已上线，包含血脂、D-二聚体等多项检查，欢迎了解。', 0, 'package', '6'),
(1, 'result', '检测结果已出具', '您于 2026-07-20 在 北京协和医院 完成的「静脉血栓风险筛查套餐」检测结果已出具，请前往查看。', 1, 'result', '1');

-- ---------- 订单示例（用户 id=1 的历史订单，含核销码与已完成状态） ----------
INSERT INTO orders (id, order_no, user_id, package_id, package_name, amount, pay_amount, status, pay_channel, pay_time, verify_code, hospital_id, verify_time, created_at) VALUES
(1, 'TH20260720001', 1, 1, '静脉血栓风险筛查套餐', 580.00, 580.00, 'completed', 'wx', '2026-07-20 09:12:30', '862519', 1, '2026-07-20 14:30:00', '2026-07-20 09:10:00'),
(2, 'TH20260801002', 1, 2, '抗凝用药效果监测套餐', 780.00, 780.00, 'paid', 'wx', '2026-08-01 10:00:00', '395472', NULL, NULL, '2026-08-01 09:58:00'),
(3, 'TH20260810003', 1, 6, '老年人血管健康体检套餐', 520.00, 520.00, 'pending_pay', NULL, NULL, NULL, NULL, NULL, '2026-08-10 16:40:00');

-- ---------- 核销记录示例 ----------
INSERT INTO verify_record (id, code, order_id, package_id, package_name, hospital_id, staff_id, user_id, user_phone, verify_time, status) VALUES
(1, '862519', 1, 1, '静脉血栓风险筛查套餐', 1, 2, 1, '138****0001', '2026-07-20 14:30:00', 'verified'),
(2, '395472', 2, 2, '抗凝用药效果监测套餐', 1, 2, 1, '138****0001', '2026-08-02 08:15:00', 'verified');

-- ---------- 检测结果示例（用户 id=1） ----------
INSERT INTO test_result (id, order_id, user_id, package_id, hospital_id, report_items, status, uploaded_at, published_at) VALUES
(1, 1, 1, 1, 1,
 JSON_ARRAY(
   JSON_OBJECT('name','D-二聚体','value','1.52','unit','mg/L','range','0-0.5','abnormal',true),
   JSON_OBJECT('name','凝血酶原时间','value','12.8','unit','s','range','11-15','abnormal',false),
   JSON_OBJECT('name','活化部分凝血活酶时间','value','31.5','unit','s','range','25-40','abnormal',false),
   JSON_OBJECT('name','血小板计数','value','220','unit','10^9/L','range','100-300','abnormal',false),
   JSON_OBJECT('name','总胆固醇','value','5.2','unit','mmol/L','range','2.8-5.2','abnormal',false)
 ),
 'published', '2026-07-21 10:00:00', '2026-07-21 11:30:00');

-- ---------- 支付账单示例（微信 3 条 + 支付宝 2 条，含 1 条差异） ----------
INSERT INTO pay_bill (id, order_id, channel, trade_no, amount, status, paid_at, sync_at, reconcile_status) VALUES
(1, 1, 'wx', 'WX2026072012345678', 580.00, 'success', '2026-07-20 09:12:30', '2026-07-20 09:13:00', 'ok'),
(2, 2, 'wx', 'WX2026080112345679', 780.00, 'success', '2026-08-01 10:00:00', '2026-08-01 10:00:30', 'ok'),
(3, 3, 'wx', 'WX2026081012345680', 520.00, 'success', '2026-08-10 16:42:00', '2026-08-10 16:42:30', 'diff'),
(4, 1, 'alipay', 'ALI2026072034567890', 580.00, 'success', '2026-07-20 09:12:00', '2026-07-20 09:20:00', 'ok'),
(5, 2, 'alipay', 'ALI2026080134567891', 780.00, 'refund', '2026-08-01 10:00:10', '2026-08-02 09:00:00', 'diff');
