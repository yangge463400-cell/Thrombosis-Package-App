package com.thrombosis.dto;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 管理端账号视图（医护 / 医院管理员通用）。
 * 只输出安全字段，绝不含密码；hospitalName 由 hospital 表关联查询填充。
 */
@Data
public class AccountVO {
    private Long id;
    private String phone;
    private String nickname;
    private String role;          // staff / hospital_admin
    private Long hospitalId;      // 所属医院
    private String hospitalName;  // 所属医院名称（关联 hospital 表）
    private Integer status;       // 1 正常 / 0 禁用
    private LocalDateTime createdAt;
}
