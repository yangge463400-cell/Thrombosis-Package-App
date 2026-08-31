import java.sql.*;
public class Q3 { public static void main(String[] a) throws Exception {
  try (Connection c = DriverManager.getConnection("jdbc:mysql://localhost:3306/thrombosis?useSSL=false&allowPublicKeyRetrieval=true","root","123456");
       Statement st = c.createStatement(); ResultSet rs = st.executeQuery("SELECT id,openid,phone,role,created_at FROM user ORDER BY id DESC LIMIT 2")) {
    while (rs.next()) System.out.println(rs.getInt(1)+" | "+rs.getString(2)+" | "+rs.getString(3)+" | "+rs.getString(4)+" | "+rs.getTimestamp(5));
  }
}}
