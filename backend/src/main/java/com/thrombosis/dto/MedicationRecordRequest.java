package com.thrombosis.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class MedicationRecordRequest {
    @NotBlank(message = "时间点不能为空")
    private String timePointId;
}
