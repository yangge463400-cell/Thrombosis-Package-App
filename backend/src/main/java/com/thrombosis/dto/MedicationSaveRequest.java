package com.thrombosis.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class MedicationSaveRequest {
    @NotBlank(message = "药物名称不能为空")
    private String drugName;
    private String dosePerTime;
    @NotNull(message = "每日次数不能为空")
    private Integer timesPerDay;
    @NotNull(message = "服用时间点不能为空")
    private List<Map<String, Object>> timePoints;
    private Integer reminderOn;
}
