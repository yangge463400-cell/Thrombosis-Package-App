import java.sql.*;
public class Q4 { public static void main(String[] a) throws Exception {
  try (Connection c = DriverManager.getConnection("jdbc:mysql://localhost:3306/thrombosis_qa?useSSL=false&allowPublicKeyRetrieval=true","root","123456");
       Statement st = c.createStatement();
       ResultSet rs = st.executeQuery("SELECT id, hospital_id, status, verify_time FROM orders WHERE status='paid' ORDER BY id")) {
    while (rs.next()) System.out.println("order "+rs.getInt("id")+" hospital="+rs.getInt("hospital_id")+" verify_time="+(rs.getTimestamp("verify_time")==null?"NULL":"set"));
  }
}}
