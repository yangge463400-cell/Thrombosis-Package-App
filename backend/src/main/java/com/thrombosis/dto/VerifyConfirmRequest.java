package com.thrombosis.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class VerifyConfirmRequest {
    @NotBlank(message = "核销码不能为空")
    private String code;
    // 医院不再由客户端传入，强制使用医护账号所属医院（UserContext），防止越权
}
