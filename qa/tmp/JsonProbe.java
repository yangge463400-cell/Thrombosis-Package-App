import java.sql.*;
public class JsonProbe {
  public static void main(String[] a) throws Exception {
    String url = "jdbc:h2:mem:jp;MODE=MySQL;DATABASE_TO_LOWER=TRUE;CASE_INSENSITIVE_IDENTIFIERS=TRUE";
    try (Connection c = DriverManager.getConnection(url, "sa", "")) {
      c.createStatement().execute("CREATE TABLE t (id INT AUTO_INCREMENT PRIMARY KEY, v JSON)");
      // 模拟 MyBatis-Plus JacksonTypeHandler: ps.setString(i, json)
      try (PreparedStatement ps = c.prepareStatement("INSERT INTO t (v) VALUES (?)")) {
        ps.setString(1, "[\"a.png\"]"); ps.executeUpdate();
        ps.setString(1, "[]");          ps.executeUpdate();
      }
      // 模拟 seed.sql 的 JSON_ARRAY 写入
      c.createStatement().execute("INSERT INTO t (v) VALUES (JSON_ARRAY('seed.png'))");
      ResultSet rs = c.createStatement().executeQuery("SELECT id, v FROM t ORDER BY id");
      while (rs.next()) {
        String s = rs.getString("v");
        System.out.println("id=" + rs.getInt("id")
          + " | getString=[" + s + "]"
          + " | getObject.class=" + (rs.getObject("v") == null ? "null" : rs.getObject("v").getClass().getName())
          + " | getObject=[" + rs.getObject("v") + "]");
      }
    }
  }
}
