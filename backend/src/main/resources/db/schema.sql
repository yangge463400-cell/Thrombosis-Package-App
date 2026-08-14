-- ============================================================
-- 血栓检测服务 · 数据库结构 (MySQL 8+ / utf8mb4)
-- 依据：规格文档 7.1 核心数据模型
-- 说明：幂等脚本，可重复执行（先删后建）
-- ============================================================
SET NAMES utf8mb4;

DROP TABLE IF EXISTS medication_record;
DROP TABLE IF EXISTS medication;
DROP TABLE IF EXISTS message;
DROP TABLE IF EXISTS pay_bill;
DROP TABLE IF EXISTS verify_record;
DROP TABLE IF EXISTS test_result;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS package;
DROP TABLE IF EXISTS hospital;
DROP TABLE IF EXISTS banner;
DROP TABLE IF EXISTS dict_item;
DROP TABLE IF EXISTS `user`;

-- 用户/医护/管理员 统一账号表
CREATE TABLE `user` (
  id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  openid        VARCHAR(64)  DEFAULT NULL COMMENT '微信 openid',
  unionid       VARCHAR(64)  DEFAULT NULL COMMENT '微信 unionid',
  phone         VARCHAR(20)  DEFAULT NULL COMMENT '手机号（医护/管理员作登录账号）',
  password      VARCHAR(100) DEFAULT NULL COMMENT '登录密码（BCrypt，医护/管理员用）',
  nickname      VARCHAR(64)  DEFAULT NULL COMMENT '昵称',
  avatar        VARCHAR(255) DEFAULT NULL COMMENT '头像 URL',
  gender        TINYINT      DEFAULT 0 COMMENT '性别 0未知/1男/2女',
  age           INT          DEFAULT NULL COMMENT '年龄',
  height        INT          DEFAULT NULL COMMENT '身高 cm',
  weight        DECIMAL(5,1) DEFAULT NULL COMMENT '体重 kg',
  role          VARCHAR(20)  NOT NULL DEFAULT 'user' COMMENT '角色 user/staff/hospital_admin/admin',
  hospital_id   BIGINT       DEFAULT NULL COMMENT '所属医院（医护/医院管理员）',
  status        TINYINT      NOT NULL DEFAULT 1 COMMENT '1正常 0禁用',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_openid (openid),
  KEY idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户/医护/管理员账号';

-- 检测套餐
CREATE TABLE package (
  id                 BIGINT       NOT NULL AUTO_INCREMENT,
  name               VARCHAR(128) NOT NULL COMMENT '套餐名',
  price              DECIMAL(10,2) NOT NULL COMMENT '价格',
  cover              VARCHAR(255) DEFAULT NULL COMMENT '封面图',
  images             JSON         DEFAULT NULL COMMENT '轮播图数组',
  items              JSON         DEFAULT NULL COMMENT '检测项目 [{name,desc}]',
  target_population  JSON         DEFAULT NULL COMMENT '适用人群数组',
  cities             JSON         DEFAULT NULL COMMENT '覆盖城市数组',
  hospital_count     INT          NOT NULL DEFAULT 0 COMMENT '合作医院数',
  sales_count        INT          NOT NULL DEFAULT 0 COMMENT '销量',
  notice             TEXT         COMMENT '购买须知',
  status             VARCHAR(10)  NOT NULL DEFAULT 'on' COMMENT 'on售卖中/off已下架',
  created_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检测套餐';

-- 订单（order 为保留字，表名用 orders）
CREATE TABLE orders (
  id            BIGINT       NOT NULL AUTO_INCREMENT,
  order_no      VARCHAR(32)  NOT NULL COMMENT '订单号',
  user_id       BIGINT       NOT NULL,
  package_id    BIGINT       NOT NULL,
  package_name  VARCHAR(128) DEFAULT NULL COMMENT '下单时套餐名快照',
  amount        DECIMAL(10,2) NOT NULL COMMENT '原价',
  pay_amount    DECIMAL(10,2) DEFAULT NULL COMMENT '实付',
  status        VARCHAR(20)  NOT NULL DEFAULT 'pending_pay' COMMENT 'pending_pay/paid/verified/completed/cancelled',
  pay_channel   VARCHAR(10)  DEFAULT NULL COMMENT 'wx/alipay',
  pay_time      DATETIME     DEFAULT NULL,
  verify_code   VARCHAR(6)   DEFAULT NULL COMMENT '6位核销码（支付后生成）',
  hospital_id   BIGINT       DEFAULT NULL COMMENT '核销医院',
  verify_time   DATETIME     DEFAULT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_order_no (order_no),
  UNIQUE KEY uk_verify_code (verify_code),
  KEY idx_user (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单';

-- 核销记录
CREATE TABLE verify_record (
  id           BIGINT      NOT NULL AUTO_INCREMENT,
  code         VARCHAR(6)  NOT NULL COMMENT '核销码',
  order_id     BIGINT      NOT NULL,
  package_id   BIGINT      DEFAULT NULL,
  package_name VARCHAR(128) DEFAULT NULL,
  hospital_id  BIGINT      NOT NULL,
  staff_id     BIGINT      NOT NULL COMMENT '核销医护',
  user_id      BIGINT      DEFAULT NULL,
  user_phone   VARCHAR(20) DEFAULT NULL COMMENT '用户脱敏手机号快照',
  verify_time  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status       VARCHAR(20) NOT NULL DEFAULT 'verified' COMMENT 'verified/cancelled',
  PRIMARY KEY (id),
  KEY idx_hospital (hospital_id, verify_time),
  KEY idx_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='核销记录';

-- 检测结果
CREATE TABLE test_result (
  id           BIGINT       NOT NULL AUTO_INCREMENT,
  order_id     BIGINT       NOT NULL,
  user_id      BIGINT       NOT NULL,
  package_id   BIGINT       DEFAULT NULL,
  hospital_id  BIGINT       DEFAULT NULL,
  report_items JSON         DEFAULT NULL COMMENT '指标 [{name,value,unit,range,abnormal}]',
  report_url   VARCHAR(255) DEFAULT NULL COMMENT '完整报告 URL',
  status       VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT 'pending待检测/uploaded已上传/published已发布',
  uploaded_at  DATETIME     DEFAULT NULL,
  published_at DATETIME     DEFAULT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='检测结果';

-- 用药方案
CREATE TABLE medication (
  id             BIGINT      NOT NULL AUTO_INCREMENT,
  user_id        BIGINT      NOT NULL,
  drug_name      VARCHAR(64) NOT NULL COMMENT '药物名',
  dose_per_time  VARCHAR(32) DEFAULT NULL COMMENT '每次剂量 如 3mg',
  times_per_day  INT         NOT NULL DEFAULT 1 COMMENT '每日次数',
  time_points    JSON        DEFAULT NULL COMMENT '时间点 [{id,time}]',
  reminder_on    TINYINT     NOT NULL DEFAULT 1 COMMENT '提醒开关',
  status         VARCHAR(20) NOT NULL DEFAULT 'active' COMMENT 'active/stopped',
  start_at       DATE        DEFAULT NULL,
  end_at         DATE        DEFAULT NULL,
  doctor_assessed VARCHAR(20) DEFAULT 'normal' COMMENT 'normal/thrombosis 医生评估',
  created_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用药方案';

-- 用药打卡
CREATE TABLE medication_record (
  id             BIGINT      NOT NULL AUTO_INCREMENT,
  medication_id  BIGINT      NOT NULL,
  time_point_id  VARCHAR(32) NOT NULL COMMENT '时间点 id',
  record_date    DATE        NOT NULL,
  status         VARCHAR(10) NOT NULL DEFAULT 'taken' COMMENT 'taken/untaken',
  PRIMARY KEY (id),
  UNIQUE KEY uk_med_date (medication_id, time_point_id, record_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用药打卡记录';

-- 站内消息
CREATE TABLE message (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  user_id     BIGINT       NOT NULL,
  type        VARCHAR(20)  NOT NULL DEFAULT 'system' COMMENT 'order/medication/result/package/system',
  title       VARCHAR(128) NOT NULL,
  content     TEXT,
  is_read     TINYINT      NOT NULL DEFAULT 0,
  target_type VARCHAR(20)  DEFAULT NULL COMMENT '订单/套餐/结果/用药',
  target_id   VARCHAR(32)  DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user (user_id, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='站内消息';

-- 支付账单（对账）
CREATE TABLE pay_bill (
  id               BIGINT       NOT NULL AUTO_INCREMENT,
  order_id         BIGINT       NOT NULL,
  channel          VARCHAR(10)  NOT NULL COMMENT 'wx/alipay',
  trade_no         VARCHAR(64)  NOT NULL COMMENT '渠道交易号',
  amount           DECIMAL(10,2) NOT NULL,
  status           VARCHAR(10)  NOT NULL DEFAULT 'success' COMMENT 'success/fail/refund',
  paid_at          DATETIME     DEFAULT NULL,
  sync_at          DATETIME     DEFAULT NULL,
  reconcile_status VARCHAR(10)  NOT NULL DEFAULT 'ok' COMMENT 'ok已对账/diff差异',
  PRIMARY KEY (id),
  KEY idx_channel (channel, reconcile_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付账单';

-- 合作医院
CREATE TABLE hospital (
  id           BIGINT        NOT NULL AUTO_INCREMENT,
  name         VARCHAR(128)  NOT NULL,
  address      VARCHAR(255)  DEFAULT NULL,
  phone        VARCHAR(32)   DEFAULT NULL,
  city         VARCHAR(32)   DEFAULT NULL,
  lat          DECIMAL(10,6) DEFAULT NULL,
  lng          DECIMAL(10,6) DEFAULT NULL,
  detect_time  VARCHAR(64)   DEFAULT NULL COMMENT '可检测时间',
  status       VARCHAR(20)   NOT NULL DEFAULT 'cooperating' COMMENT 'cooperating合作中/disabled停用',
  created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_city (city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='合作医院';

-- 首页轮播
CREATE TABLE banner (
  id        BIGINT      NOT NULL AUTO_INCREMENT,
  image     VARCHAR(255) NOT NULL,
  link_type VARCHAR(20) DEFAULT NULL COMMENT 'package/url/none',
  link_id   VARCHAR(32) DEFAULT NULL,
  sort      INT         NOT NULL DEFAULT 0,
  status    TINYINT     NOT NULL DEFAULT 1,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='首页轮播';

-- 字典（检测项目/城市）
CREATE TABLE dict_item (
  id    BIGINT      NOT NULL AUTO_INCREMENT,
  type  VARCHAR(32) NOT NULL COMMENT 'items/cities',
  name  VARCHAR(64) NOT NULL,
  sort  INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='字典项';
