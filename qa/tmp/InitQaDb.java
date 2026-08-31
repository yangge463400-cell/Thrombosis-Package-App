/**
 * MySQL 测试库初始化器（本次验收测试专用，可随 qa/ 删除）
 *
 * 作用：在真实 MySQL 上创建一个【独立】的测试库 thrombosis_qa，
 *       并导入项目自带的 db/schema.sql 与 db/seed.sql。
 *       不会触碰已有的 thrombosis 库。
 *
 * 安全性：仅操作 thrombosis_qa；schema.sql 中的 DROP TABLE IF EXISTS
 *         只作用在当前连接的 schema 上。
 *
 * 用法：java -cp "<mysql-connector-j>.jar" InitQaDb.java
 */
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.sql.*;
import java.util.*;

public class InitQaDb {
    static final String DB = "thrombosis_qa";
    static final String BASE = "jdbc:mysql://localhost:3306/%s?useUnicode=true&characterEncoding=utf8"
            + "&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true";

    public static void main(String[] args) throws Exception {
        String root = args.length > 0 ? args[0] : "D:/WorkBuddyFile/血栓套餐app";
        try (Connection c = DriverManager.getConnection(String.format(BASE, ""), "root", "123456")) {
            try (Statement st = c.createStatement()) {
                st.executeUpdate("CREATE DATABASE IF NOT EXISTS " + DB
                        + " DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
                System.out.println("[ok] 数据库就绪: " + DB);
            }
        }
        try (Connection c = DriverManager.getConnection(String.format(BASE, DB), "root", "123456")) {
            runScript(c, Paths.get(root, "backend/src/main/resources/db/schema.sql"));
            runScript(c, Paths.get(root, "backend/src/main/resources/db/seed.sql"));

            // 校验：12 张表是否全部建成（MySQL 允许跨表重名索引，应全部成功）
            List<String> expect = Arrays.asList("user", "package", "orders", "verify_record", "test_result",
                    "medication", "medication_record", "message", "pay_bill", "hospital", "banner", "dict_item");
            try (Statement st = c.createStatement()) {
                Set<String> got = new HashSet<>();
                ResultSet rs = st.executeQuery(
                        "SELECT table_name FROM information_schema.tables WHERE table_schema='" + DB + "'");
                while (rs.next()) got.add(rs.getString(1));
                System.out.println("\n--- 建表结果校验 ---");
                int miss = 0;
                for (String t : expect) {
                    boolean ok = got.contains(t);
                    if (!ok) miss++;
                    System.out.printf("  %-20s %s%n", t, ok ? "OK" : "缺失 !!");
                }
                System.out.println(miss == 0 ? "\n[ok] 12 张表全部建成（MySQL 下索引重名无冲突）"
                        : "\n[!!] 缺 " + miss + " 张表");
            }
        }
    }

    /** 按分号切分并执行；跳过空语句与纯注释行 */
    static void runScript(Connection c, Path p) throws Exception {
        String sql = new String(Files.readAllBytes(p), StandardCharsets.UTF_8);
        List<String> stmts = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        for (String line : sql.split("\r?\n")) {
            String t = line.trim();
            if (t.startsWith("--") || t.isEmpty()) continue;
            cur.append(line).append('\n');
            if (t.endsWith(";")) {
                String s = cur.toString().trim();
                if (s.endsWith(";")) s = s.substring(0, s.length() - 1).trim();
                if (!s.isEmpty()) stmts.add(s);
                cur.setLength(0);
            }
        }
        int ok = 0;
        try (Statement st = c.createStatement()) {
            for (String s : stmts) {
                try { st.execute(s); ok++; }
                catch (SQLException e) {
                    System.out.println("  [失败] " + s.lines().findFirst().orElse(s).trim()
                            + "\n          → " + e.getMessage());
                }
            }
        }
        System.out.println(String.format("[ok] %s：%d/%d 条语句执行成功",
                p.getFileName(), ok, stmts.size()));
    }
}
