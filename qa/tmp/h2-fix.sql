-- ============================================================
-- H2 测试环境补丁（仅在本次验收测试中通过 --spring.sql.init 额外加载）
--
-- 作用：补齐 schema.sql 在 H2 下未能创建的 4 张表。
-- 原因（非项目缺陷）：schema.sql 中 orders / test_result / medication / message
--       四张表都定义了名为 `idx_user` 的索引。MySQL 的索引名作用域是【表内】，
--       允许重名；而 H2 的索引名作用域是【整个 schema】，重名会抛
--       JdbcSQLSyntaxErrorException: Index "IDX_USER" already exists [42111]。
--       因此这 4 张表在 H2 下建表失败（生产用 MySQL 无此问题）。
--
-- 本补丁仅把这 4 张表的索引名改为全局唯一，表结构与 schema.sql 完全一致。
-- 本文件位于 qa/ 目录，不属于项目源码，可随 qa/ 一并删除。
-- ============================================================

-- ------------------------------------------------------------
-- 补丁 2：把 JSON 列降级为 VARCHAR，规避 H2 的 JSON 二次编码问题
--
-- 现象（已用 JsonProbe 实证，H2 特有，非项目缺陷）：
--   写入方式                              getString() 读回
--   ps.setString(i, "[\"a.png\"]")   →   "[\"a.png\"]"   ← 被当成 JSON 字符串二次编码
--   SQL: JSON_ARRAY('seed.png')      →   ["seed.png"]    ← 正常
-- 因此凡是"由应用程序写入 JSON 列"的行（套餐编辑/用药时间点/检测结果指标），
-- 在 H2 下再读回都会被 JacksonTypeHandler 解析失败 → 500。
-- MySQL 的 JSON 列会在服务端解析文本为 JSON，不存在该问题。
-- 降级为 VARCHAR 后写读往返与 MySQL 等效，可正常验证业务功能。
-- ------------------------------------------------------------
ALTER TABLE package      ALTER COLUMN images           VARCHAR(4000);
ALTER TABLE package      ALTER COLUMN items            VARCHAR(4000);
ALTER TABLE package      ALTER COLUMN target_population VARCHAR(4000);
ALTER TABLE package      ALTER COLUMN cities           VARCHAR(4000);

-- 以下 3 张表在 schema.sql 中因索引重名未建成，此处重建（JSON 列直接建为 VARCHAR）
CREATE TABLE test_result (
  id           BIGINT       NOT NULL AUTO_INCREMENT,
  order_id     BIGINT       NOT NULL,
  user_id      BIGINT       NOT NULL,
  package_id   BIGINT       DEFAULT NULL,
  hospital_id  BIGINT       DEFAULT NULL,
  report_items VARCHAR(4000) DEFAULT NULL,
  report_url   VARCHAR(255) DEFAULT NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'pending',
  uploaded_at  DATETIME     DEFAULT NULL,
  published_at DATETIME     DEFAULT NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_result (user_id)
);

CREATE TABLE medication (
  id              BIGINT      NOT NULL AUTO_INCREMENT,
  user_id         BIGINT      NOT NULL,
  drug_name       VARCHAR(64) NOT NULL,
  dose_per_time   VARCHAR(32) DEFAULT NULL,
  times_per_day   INT         NOT NULL DEFAULT 1,
  time_points     VARCHAR(4000) DEFAULT NULL,
  reminder_on     TINYINT     NOT NULL DEFAULT 1,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  start_at        DATE        DEFAULT NULL,
  end_at          DATE        DEFAULT NULL,
  doctor_assessed VARCHAR(20) DEFAULT 'normal',
  created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_medication (user_id)
);

CREATE TABLE medication_record (
  id             BIGINT      NOT NULL AUTO_INCREMENT,
  medication_id  BIGINT      NOT NULL,
  time_point_id  VARCHAR(32) NOT NULL,
  record_date    DATE        NOT NULL,
  status         VARCHAR(10) NOT NULL DEFAULT 'taken',
  PRIMARY KEY (id),
  UNIQUE KEY uk_med_date (medication_id, time_point_id, record_date)
);

CREATE TABLE message (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  user_id     BIGINT       NOT NULL,
  type        VARCHAR(20)  NOT NULL DEFAULT 'system',
  title       VARCHAR(128) NOT NULL,
  content     TEXT,
  is_read     TINYINT      NOT NULL DEFAULT 0,
  target_type VARCHAR(20)  DEFAULT NULL,
  target_id   VARCHAR(32)  DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_message (user_id, is_read)
);
