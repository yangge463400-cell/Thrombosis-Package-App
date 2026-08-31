#!/usr/bin/env bash
# ============================================================
# 测试环境启动脚本（本次验收测试专用，可随 qa/ 目录整体删除）
#
# 作用：在不改动项目任何文件的前提下启动后端，供 qa/run-tests.js 调用。
# 原理：直接 java -cp 运行已编译的 backend/target/classes，
#       通过命令行参数把数据源指向【独立测试库 thrombosis_qa】。
#
# 用法：
#   bash qa/start-backend.sh          # MySQL 模式（默认，2026-08-31 复跑用此）
#   bash qa/start-backend.sh --h2     # H2 内存库模式（无需 MySQL，用于无 DB 环境）
#
# 前置：
#   cd backend && ./mvnw.cmd -o -q compile
#   # MySQL 模式首次还需建测试库：
#   java -cp "<mysql-connector-j>.jar" qa/tmp/InitQaDb.java
# ============================================================
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1
MODE="${1:-mysql}"

# 生成依赖 classpath（离线；输出到 qa/tmp，不写入项目构建目录）
mkdir -p qa/tmp
(cd backend && ./mvnw.cmd -o -q dependency:build-classpath -Dmdep.outputFile=../qa/tmp/cp.txt) || exit 1
CP="backend/target/classes;$(cat qa/tmp/cp.txt)"

if [ "$MODE" = "--h2" ]; then
  H2_JAR="$HOME/.m2/repository/com/h2database/h2/2.3.232/h2-2.3.232.jar"
  [ -f "$H2_JAR" ] || { echo "未找到 H2：$H2_JAR"; exit 1; }
  CP="$CP;$H2_JAR"
  LOG="qa/tmp/backend.log"
  echo "模式：H2 内存库（含 qa/tmp/h2-fix.sql 补丁）"
  DB_ARGS=(
    --spring.datasource.url='jdbc:h2:mem:thrombosis;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE;DB_CLOSE_DELAY=-1'
    --spring.datasource.driver-class-name=org.h2.Driver
    --spring.datasource.username=sa
    --spring.datasource.password=
    --spring.sql.init.mode=always
    --spring.sql.init.schema-locations=classpath:db/schema.sql,file:./qa/tmp/h2-fix.sql
    --spring.sql.init.data-locations=classpath:db/seed.sql
    --spring.sql.init.continue-on-error=true
  )
else
  LOG="qa/tmp/backend-mysql.log"
  echo "模式：MySQL → thrombosis_qa（不触碰存量 thrombosis 库）"
  DB_ARGS=(
    --spring.datasource.url='jdbc:mysql://localhost:3306/thrombosis_qa?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true'
    --spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
    --spring.datasource.username=root
    --spring.datasource.password=123456
    --spring.sql.init.mode=never
  )
fi

# 若 8080 已被占用则先释放
PID=$(netstat -ano 2>/dev/null | grep ":8080" | grep LISTENING | awk '{print $5}' | head -1)
if [ -n "${PID:-}" ]; then
  echo "释放占用 8080 的进程 $PID"
  MSYS_NO_PATHCONV=1 taskkill /F /PID "$PID" >/dev/null 2>&1 || true
  sleep 3
fi

nohup java -cp "$CP" com.thrombosis.ThrombosisApplication \
  --server.port=8080 \
  "${DB_ARGS[@]}" \
  --mybatis-plus.configuration.log-impl=org.apache.ibatis.logging.nologging.NoLoggingImpl \
  > "$LOG" 2>&1 &

echo "后端启动中（PID $!），日志 $LOG，等待就绪..."
for i in $(seq 1 40); do
  if curl -s -m 2 http://localhost:8080/api/hospitals >/dev/null 2>&1; then
    echo "后端已就绪：http://localhost:8080"
    exit 0
  fi
  sleep 1
done
echo "启动超时，请查看 $LOG"
exit 1
