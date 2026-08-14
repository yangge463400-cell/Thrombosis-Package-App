package com.thrombosis.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class VerifyCheckRequest {
    @NotBlank(message = "核销码不能为空")
    private String code;
}
