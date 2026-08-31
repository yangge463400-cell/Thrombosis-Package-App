/**
 * MySQL 只读盘点工具（不建表、不改数据，仅查询元信息）
 * 用途：在导入 schema.sql 之前确认目标库是否已存在、是否含需要保留的数据。
 * 用法：java -cp "<mysql-connector-j>.jar" DbInventory.java [密码]
 */
import java.sql.*;

public class DbInventory {
    public static void main(String[] args) throws Exception {
        String[] pwds = args.length > 0 ? new String[]{args[0]} : new String[]{"123456", "", "root", "admin123"};
        Connection c = null;
        String usedPwd = null;
        for (String p : pwds) {
            try {
                c = DriverManager.getConnection(
                    "jdbc:mysql://localhost:3306/?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true",
                    "root", p);
                usedPwd = p;
                break;
            } catch (SQLException e) { /* try next */ }
        }
        if (c == null) {
            System.out.println("CONNECT_FAIL: 无法用 root + 候选密码连接 MySQL(localhost:3306)");
            System.out.println("请告知正确的账号密码，或先执行: ALTER USER 'root'@'localhost' IDENTIFIED BY '123456';");
            return;
        }
        System.out.println("CONNECT_OK: root / (pwd=" + (usedPwd == null ? "空" : (usedPwd.isEmpty() ? "空" : usedPwd)) + ")");

        Statement st = c.createStatement();
        ResultSet rs = st.executeQuery("SELECT VERSION()");
        rs.next();
        System.out.println("VERSION: " + rs.getString(1));

        System.out.println("\n--- 现有数据库 ---");
        rs = st.executeQuery("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema','mysql','performance_schema','sys') ORDER BY schema_name");
        boolean any = false;
        while (rs.next()) { any = true; System.out.println("  " + rs.getString(1)); }
        if (!any) System.out.println("  (无业务库)");

        // thrombosis 库盘点
        rs = st.executeQuery("SELECT schema_name FROM information_schema.schemata WHERE schema_name='thrombosis'");
        if (!rs.next()) {
            System.out.println("\nthrombosis 库: 不存在（可安全新建）");
            return;
        }
        System.out.println("\n--- thrombosis 库现有表 ---");
        rs = st.executeQuery("SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema='thrombosis' ORDER BY table_name");
        boolean hasTable = false;
        while (rs.next()) {
            hasTable = true;
            System.out.printf("  %-20s 约 %s 行%n", rs.getString(1), rs.getString(2));
        }
        if (!hasTable) System.out.println("  (空库，无任何表)");
        c.close();
    }
}
