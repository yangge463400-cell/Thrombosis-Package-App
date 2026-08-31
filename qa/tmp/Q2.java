import java.sql.*;
public class Q2 { public static void main(String[] a) throws Exception {
  try (Connection c = DriverManager.getConnection("jdbc:mysql://localhost:3306/thrombosis?useSSL=false&allowPublicKeyRetrieval=true","root","123456");
       Statement st = c.createStatement()) {
    ResultSet rs = st.executeQuery("SHOW INDEX FROM orders WHERE Key_name='uk_verify_code'");
    boolean found=false; while(rs.next()) found=true;
    System.out.println("存量库 orders.uk_verify_code 索引: " + (found?"存在(注:项目启动代码本就会补建,大概率用户自己启动时已加)":"不存在"));
    ResultSet r2 = st.executeQuery("SELECT COUNT(*) FROM user");
    r2.next(); System.out.println("存量库 user 行数: " + r2.getInt(1));
    ResultSet r3 = st.executeQuery("SELECT COUNT(*) FROM orders");
    r3.next(); System.out.println("存量库 orders 行数: " + r3.getInt(1));
  }
}}
