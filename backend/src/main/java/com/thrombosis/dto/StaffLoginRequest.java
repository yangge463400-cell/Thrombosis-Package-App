package com.thrombosis.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class StaffLoginRequest {
    @NotBlank(message = "账号不能为空")
    private String phone;
    @NotBlank(message = "密码不能为空")
    private String password;
}
