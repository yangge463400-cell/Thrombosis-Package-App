import java.sql.*;
public class Q { public static void main(String[] a) throws Exception {
  try (Connection c = DriverManager.getConnection("jdbc:mysql://localhost:3306/thrombosis_qa?useSSL=false&allowPublicKeyRetrieval=true","root","123456");
       Statement st = c.createStatement(); ResultSet rs = st.executeQuery("SELECT id, openid, phone, role FROM user ORDER BY id")) {
    while (rs.next()) System.out.println(rs.getInt(1)+" | "+rs.getString(2)+" | "+rs.getString(3)+" | "+rs.getString(4));
  }
}} 
