package com.thrombosis.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 新增/编辑医护、医院管理员的统一请求体。
 * - 新增时 password 必填；编辑时 password 为空表示不修改密码。
 * - hospitalId 由服务层按角色强制约束（医院管理员锁本院，平台管理员必须显式指定）。
 * - @JsonIgnoreProperties：忽略前端可能多传的只读字段（role/hospitalName/createdAt 等），
 *   避免 Jackson 因未知字段直接 500。
 */
@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class AdminUserSaveRequest {

    /** 编辑时必填 */
    private Long id;

    /** 登录账号（手机号），新增必填 */
    @NotBlank(message = "账号不能为空")
    @Size(max = 20, message = "账号过长")
    private String phone;

    /** 登录密码，新增必填；编辑时留空表示不修改 */
    @Size(min = 6, max = 32, message = "密码长度需在 6-32 位")
    private String password;

    /** 显示名称 */
    @Size(max = 64, message = "名称过长")
    private String nickname;

    /** 所属医院（平台管理员新增/编辑时必填） */
    private Long hospitalId;

    /** 1 正常 / 0 禁用 */
    private Integer status;
}
